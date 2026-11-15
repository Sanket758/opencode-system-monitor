/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { Show } from "solid-js"
import { monitor, percent, type Snapshot } from "./monitor"

/** The subset of the resolved theme this widget uses. */
type Theme = {
  text: {
    base: string
    muted: string
    feedback: { warning: { base: string }; error: { base: string } }
  }
}

const initial: Snapshot = {
  ready: false,
  cpu: 0,
  cpuSpark: "",
  cpuTemp: null,
  mem: 0,
  memBar: "",
  memUsed: "",
  memTotal: "",
  rx: "0B/s",
  tx: "0B/s",
  gpu: null,
}

function heat(theme: Theme, value: number): string {
  if (value >= 85) return theme.text.feedback.error.base
  if (value >= 60) return theme.text.feedback.warning.base
  return theme.text.base
}

function Monitor(props: { state: Snapshot; theme: Theme }) {
  const value = () => props.state
  return (
    <Show when={value().ready}>
      <box flexDirection="column">
        <text fg={props.theme.text.base}>
          <b>System</b>
        </text>
        <text>
          <span style={{ fg: props.theme.text.muted }}>CPU </span>
          <span style={{ fg: heat(props.theme, value().cpu) }}>{value().cpuSpark}</span>
          <span style={{ fg: props.theme.text.muted }}> </span>
          <span style={{ fg: heat(props.theme, value().cpu) }}>{percent(value().cpu)}</span>
          <Show when={value().cpuTemp !== null}>
            <span style={{ fg: props.theme.text.muted }}> {value().cpuTemp}°C</span>
          </Show>
        </text>
        <text>
          <span style={{ fg: props.theme.text.muted }}>MEM </span>
          <span style={{ fg: heat(props.theme, value().mem) }}>{value().memBar}</span>
          <span style={{ fg: props.theme.text.muted }}> </span>
          <span style={{ fg: heat(props.theme, value().mem) }}>{percent(value().mem)}</span>
          <span style={{ fg: props.theme.text.muted }}>
            {" "}
            {value().memUsed}/{value().memTotal}G
          </span>
        </text>
        <text>
          <span style={{ fg: props.theme.text.muted }}>NET </span>
          <span style={{ fg: props.theme.text.base }}>
            ↓{value().rx} ↑{value().tx}
          </span>
        </text>
        <Show when={value().gpu}>
          {(gpu) => (
            <text>
              <span style={{ fg: props.theme.text.muted }}>GPU </span>
              <span style={{ fg: heat(props.theme, gpu().util) }}>{percent(gpu().util)}</span>
              <span style={{ fg: props.theme.text.muted }}> {gpu().temp ?? "--"}°C</span>
            </text>
          )}
        </Show>
      </box>
    </Show>
  )
}

export default Plugin.define({
  id: "system-monitor",
  setup(context) {
    const [state, update] = context.storage.memory("system-monitor", { initial })
    const stop = monitor({
      interval: 1000,
      onUpdate: (next) => {
        update((draft) => Object.assign(draft, next))
      },
    })
    context.ui.slot({
      append: "sidebar.content",
      render: () => <Monitor state={state} theme={context.theme} />,
    })
    return stop
  },
})
