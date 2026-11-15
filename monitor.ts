import { execFile } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"

export type Gpu = {
  util: number
  temp: number | null
}

export type Snapshot = {
  ready: boolean
  cpu: number
  cpuSpark: string
  cpuTemp: number | null
  mem: number
  memBar: string
  memUsed: string
  memTotal: string
  rx: string
  tx: string
  gpu: Gpu | null
}

const BLOCKS = "▁▂▃▄▅▆▇█"
export const BARS = 10

type CpuTick = { idle: number; total: number }
type NetTick = { rx: number; tx: number }

function readCpuTick(): CpuTick | null {
  try {
    const line = readFileSync("/proc/stat", "utf8").split("\n")[0]
    if (!line?.startsWith("cpu")) return null
    const parts = line.trim().split(/\s+/).slice(1).map(Number)
    if (parts.length < 4 || parts.some((n) => !Number.isFinite(n))) return null
    const idle = parts[3] + (parts[4] ?? 0)
    const total = parts.reduce((sum, n) => sum + n, 0)
    return { idle, total }
  } catch {
    return null
  }
}

function readNetTick(): NetTick | null {
  try {
    const lines = readFileSync("/proc/net/dev", "utf8").split("\n").slice(2)
    let rx = 0
    let tx = 0
    let seen = false
    for (const line of lines) {
      const at = line.indexOf(":")
      if (at < 0) continue
      const name = line.slice(0, at).trim()
      if (!name || name === "lo") continue
      const fields = line.slice(at + 1).trim().split(/\s+/).map(Number)
      if (fields.length < 9) continue
      seen = true
      rx += fields[0]
      tx += fields[8]
    }
    return seen ? { rx, tx } : null
  } catch {
    return null
  }
}

function readMemory(): { used: number; total: number } | null {
  try {
    const info = readFileSync("/proc/meminfo", "utf8")
    const total = Number(/MemTotal:\s+(\d+)/.exec(info)?.[1]) * 1024
    const available = Number(/MemAvailable:\s+(\d+)/.exec(info)?.[1]) * 1024
    if (!total || !Number.isFinite(available)) return null
    return { used: total - available, total }
  } catch {
    return null
  }
}

/** Package temperature from coretemp / k10temp / zenpower, if the kernel exposes one. */
function findCpuTemp(): string | null {
  const names = new Set(["coretemp", "k10temp", "zenpower", "cpu_thermal"])
  try {
    for (const entry of readdirSync("/sys/class/hwmon")) {
      const dir = `/sys/class/hwmon/${entry}`
      let name: string
      try {
        name = readFileSync(`${dir}/name`, "utf8").trim()
      } catch {
        continue
      }
      if (!names.has(name)) continue
      try {
        readFileSync(`${dir}/temp1_input`)
        return `${dir}/temp1_input`
      } catch {}
    }
  } catch {}
  return null
}

function readTemp(path: string | null): number | null {
  if (!path) return null
  try {
    const milli = Number(readFileSync(path, "utf8").trim())
    return Number.isFinite(milli) ? Math.round(milli / 1000) : null
  } catch {
    return null
  }
}

function sparkline(samples: number[]): string {
  let out = ""
  for (const sample of samples) {
    const index = Math.max(0, Math.min(BLOCKS.length - 1, Math.round((sample / 100) * (BLOCKS.length - 1))))
    out += BLOCKS[index]
  }
  return out
}

export function bar(percent: number): string {
  const filled = Math.max(0, Math.min(BARS, Math.round((percent / 100) * BARS)))
  return "█".repeat(filled) + "░".repeat(BARS - filled)
}

export function rate(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "0B/s"
  const units = ["B", "K", "M", "G", "T"]
  let value = bytesPerSecond
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)}${units[unit]}/s`
}

export function gib(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0"
  return (bytes / 1024 ** 3).toFixed(1)
}

export function percent(value: number): string {
  return `${String(Math.round(Math.max(0, Math.min(100, value)))).padStart(3)}%`
}

function queryGpu(done: (gpu: Gpu | null, missing: boolean) => void) {
  execFile(
    "nvidia-smi",
    ["--query-gpu=utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"],
    { timeout: 1500 },
    (error, stdout) => {
      if (error) return done(null, (error as NodeJS.ErrnoException).code === "ENOENT")
      const first = stdout.trim().split("\n")[0]
      if (!first) return done(null, false)
      const [util, temp] = first.split(",").map((field) => Number(field.trim()))
      if (!Number.isFinite(util)) return done(null, false)
      done({ util, temp: Number.isFinite(temp) ? temp : null }, false)
    },
  )
}

const GPU_EVERY = 3

export function monitor(input: {
  interval: number
  onUpdate: (snapshot: Snapshot) => void
}): () => void {
  const tempPath = findCpuTemp()
  const history: number[] = new Array(BARS).fill(0)

  let cpuPrev = readCpuTick()
  let netPrev = readNetTick()
  let netAt = Date.now()
  let gpu: Gpu | null = null
  let gpuMissing = false
  let ticks = 0

  const tick = () => {
    const cpuNow = readCpuTick()
    let cpu = 0
    if (cpuPrev && cpuNow) {
      const idle = cpuNow.idle - cpuPrev.idle
      const total = cpuNow.total - cpuPrev.total
      if (total > 0) cpu = (1 - idle / total) * 100
    }
    cpuPrev = cpuNow

    history.push(cpu)
    if (history.length > BARS) history.shift()

    const netNow = readNetTick()
    const now = Date.now()
    const seconds = Math.max(0.001, (now - netAt) / 1000)
    let rx = 0
    let tx = 0
    if (netPrev && netNow) {
      rx = Math.max(0, (netNow.rx - netPrev.rx) / seconds)
      tx = Math.max(0, (netNow.tx - netPrev.tx) / seconds)
    }
    netPrev = netNow
    netAt = now

    const memory = readMemory()

    input.onUpdate({
      ready: true,
      cpu,
      cpuSpark: sparkline(history),
      cpuTemp: readTemp(tempPath),
      mem: memory ? (memory.used / memory.total) * 100 : 0,
      memBar: bar(memory ? (memory.used / memory.total) * 100 : 0),
      memUsed: memory ? gib(memory.used) : "",
      memTotal: memory ? gib(memory.total) : "",
      rx: rate(rx),
      tx: rate(tx),
      gpu,
    })
  }

  const timer = setInterval(tick, input.interval)
  const gpuTimer = setInterval(() => {
    if (gpuMissing || ticks++ % GPU_EVERY !== 0) return
    queryGpu((next, missing) => {
      gpu = next
      if (missing) gpuMissing = true
    })
  }, input.interval)
  tick()

  return () => {
    clearInterval(timer)
    clearInterval(gpuTimer)
  }
}
