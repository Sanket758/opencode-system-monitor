# opencode-system-monitor

A Linux system monitor that lives in the [OpenCode](https://opencode.ai) TUI sidebar.

```
System
CPU ▁▁▂▁▂▂▁▁▂▁  16% 78°C
MEM ██████░░░░  55% 8.4/15.3G
NET ↓1.9K/s ↑720B/s
GPU   0% 71°C
```

It sits below the built-in sidebar sections (Context, MCP, Todo) and refreshes once a second.
Everything is coloured with the active OpenCode theme, so it follows whatever palette you use —
values turn yellow at 60% and red at 85%.

## Install

```bash
opencode plugin add github:Sanket758/opencode-system-monitor
```

That is the whole thing: it adds the plugin to your global config and it loads automatically.
Open a session and the panel appears in the sidebar — no restart, no build step.

Uninstall:

```bash
opencode plugin remove opencode-system-monitor
```

## Requirements

- **Linux** — reads `/proc/stat`, `/proc/meminfo`, `/proc/net/dev`.
- **NVIDIA GPU (optional)** — `nvidia-smi` on `PATH`. The GPU row appears when present and
  quietly disappears when it is not; nothing else changes.
- **CPU temperature (optional)** — exposed via `coretemp`, `k10temp`, `zenpower` or
  `cpu_thermal` in `/sys/class/hwmon`.

## What it reads

| Row | Source | Notes |
| --- | --- | --- |
| CPU | `/proc/stat` | Delta of busy vs. total jiffies, 10-sample sparkline |
| MEM | `/proc/meminfo` | `used = MemTotal − MemAvailable`, i.e. the same figure `free -h` prints. Page cache counts as available, not used. |
| NET | `/proc/net/dev` | Bytes per second across all interfaces except `loopback` |
| GPU | `nvidia-smi` | Utilization and temperature, polled every third tick |

`MEM 55% 8.4/15.3G` is GiB, so a "16 GB" machine shows ~15.3G — firmware reserves the rest.
Percentage and absolute figure always share that denominator.

## Manual install

To run an editable copy instead of the packaged plugin:

```bash
mkdir -p ~/.config/opencode/plugins/system-monitor
cp src/*.ts src/*.tsx ~/.config/opencode/plugins/system-monitor/
```

OpenCode discovers `plugins/<name>/` directories and falls back to `index.ts` / `tui.tsx`
when there is no `package.json`.

## Development

The published package ships prebuilt `dist/` bundles, so installing needs no build step.
To rebuild after editing `src/`:

```bash
bun run build
```

`src/tui.tsx` carries a `/** @jsxImportSource @opentui/solid */` pragma and `tsconfig.json`
sets the same — without it the JSX compiles against React, which OpenCode does not ship.

## License

MIT
