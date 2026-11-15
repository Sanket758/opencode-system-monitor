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
git clone --depth 1 https://github.com/Sanket758/opencode-system-monitor.git ~/.config/opencode/plugins/system-monitor
```

That is the whole thing. OpenCode auto-discovers every directory under
`~/.config/opencode/plugins/`, loads `index.ts` and `tui.tsx` from it, and the panel appears in
the sidebar. No build step, no restart.

Update with `git -C ~/.config/opencode/plugins/system-monitor pull`.
Uninstall with `rm -rf ~/.config/opencode/plugins/system-monitor`.

### Why not `opencode plugin add`?

Installing it as a package (`opencode plugin add github:Sanket758/opencode-system-monitor`) does
not work on OpenCode 2.3.0. Package plugins are loaded from `node_modules`, and OpenCode only
rewrites *runtime* import specifiers there — not bare ones — so `@opentui/solid`, which exists only
inside the OpenCode binary, cannot be resolved:

```
Cannot find package '@opentui/solid' imported from
  .../node_modules/opencode-system-monitor/tui.tsx
```

A directory under `~/.config/opencode/plugins/` gets all specifiers rewritten, so that is the
supported install path for this build. If a later OpenCode release fixes package TUI plugins,
this repo can gain a `package.json` again without source changes.

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

## Files

| File | Role |
| --- | --- |
| `index.ts` | Server entry — required by the plugin shape, does nothing |
| `monitor.ts` | Sampling and formatting, no UI code |
| `tui.tsx` | The sidebar widget and its slot registration |

`tui.tsx` carries a `/** @jsxImportSource @opentui/solid */` pragma. Without it the JSX compiles
against React, which OpenCode does not ship, and the plugin fails with
`Cannot find package 'react'`.

## License

MIT
