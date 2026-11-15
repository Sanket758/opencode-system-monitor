import { Plugin } from "@opencode/plugin"

/** Server entry exists only so the package layout matches the documented plugin shape; the widget is TUI-only. */
export default Plugin.define({
  id: "system-monitor",
  setup() {},
})
