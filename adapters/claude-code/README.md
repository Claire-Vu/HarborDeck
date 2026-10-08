# Claude Code adapter

Lets the [limit-reset scheduler](../../docs/SCHEDULER.md) know when a Claude Code session hits its usage limit and when that limit resets.

| File | Does |
|---|---|
| `settings.snippet.json` | the `StopFailure` hook (matcher `rate_limit`) running `harbordeck limit record`, and the status line below |
| `statusline-tee.sh` | status line wrapper: hands `rate_limits` to `harbordeck limit snapshot` in the background, then runs your own status line (`HD_STATUSLINE="<cmd>"`) or prints `5h 62% · 7d 41%` |

## Setup

1. Install the CLI and the scheduler: `npm install -g ./HarborDeck/cli && hd scheduler install`.
2. Merge `settings.snippet.json` into `~/.claude/settings.json` (fix the status line path; keep your own status line via `HD_STATUSLINE`, e.g. `"command": "HD_STATUSLINE=~/.claude/statusline.sh /path/to/statusline-tee.sh"`).
3. Set a wake command, e.g. `hd scheduler config --wake-command 'tmux send-keys -t claude "continue" Enter'`.

The status line step is optional: without it, `limit record` reads the reset from the limit message (`resets 3pm (Europe/Paris)`) or `quota.json`. With it, the exact window that is at 100 % is used. Several accounts (`CLAUDE_CONFIG_DIR`) are kept apart.

`limit record` stores who stalled (`cwd`, session id, and the pane from `HARBORDECK_PANE`, `HERDR_PANE_ID` or `TMUX_PANE`) and puts that list in the wake message. Several sessions hitting the same reset share one wake. Hooks always exit 0, so a scheduler problem never breaks a session; see `schedule/scheduler.log`.

Claude Code may also resume a session on its own at reset ("automatic continue"); the scheduler is the backstop for the agent that supervises the rest, and a duplicate wake is harmless.
