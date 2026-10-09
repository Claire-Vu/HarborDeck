# Limit-reset scheduler

Queue work while your agent is out of usage, and HarborDeck hands it over by itself the moment the limit resets. No prompt from you.

```
you: "Queue for after reset"  ──►  schedule/queue/  ──►  harbordeck tick (every 60 s)
agent hits its limit          ──►  limit record       │   at reset + 90 s:
quota.json window at 100 %    ──►  (detected)         │    1. wake the agent (wake command)
                                                      │    2. each queued request: answers.jsonl line + wake
```

## What it does

- **Queue**: from the app (ship phone → `⌥Enter` / *Queue for after reset*, or a time and *Queue at time*) or the CLI (`hd schedule reset "<msg>"`, `hd schedule 01:10 "<msg>"`, `+30m`, `2026-10-09 01:10`, ISO, `@epoch`).
- **Detect the reset**, agent-agnostic:
  - Claude Code: a `StopFailure` hook (matcher `rate_limit`) runs `hd limit record`. Reset time comes from the status line's `rate_limits` (exhausted window, via [`adapters/claude-code`](../adapters/claude-code)), else the limit message (`resets 3pm (Europe/Paris)`), else `quota.json`.
  - Any agent or adapter that keeps `quota.json` fresh: a window at `used_pct: 100` with a future `resets_at` counts as a limit. No hook needed.
  - By hand or from any script: `hd limit set --reset 15:00 [--window 5h]`.
- **Wake**: at reset + `margin` (90 s) `hd tick` runs your **wake command** once with a short message; then every request queued for the reset is written to `answers.jsonl` (so your agent's normal answer loop sees it) and the wake command runs for it too. Ordering: limit wake first, then queued items oldest first.
- **"After reset"** means after every known exhausted window has reset (pending limit wakes and exhausted `quota.json` windows). With nothing exhausted it waits for the soonest `quota.json` reset; with no quota data at all it goes on the next tick.
- **Keep awake (macOS)**: while anything is pending, the scheduler holds one `caffeinate -i -t <secs>` assertion until the last due item (+5 min), so idle sleep cannot skip the reset. An order queued for a clock time counts only in its last hour (a 15:15 order queued at 02:00 does not keep the Mac up for 13 hours; the desk says so when you queue it); if the Mac sleeps through that time, the order goes out when it wakes. The display still sleeps. It is released as soon as nothing is pending (or the scheduler is turned off), and it expires on its own if the scheduler stops. No sudo, no `pmset`. **`caffeinate -i` does not stop sleep when the lid is closed on battery**; the scheduler then delivers on wake, marked "delivered late". Disable: `hd scheduler config --keep-awake off`.

## Setup

```sh
npm install -g ./HarborDeck/cli                       # harbordeck / hd
hd scheduler config --wake-command "<command>"        # how to wake your agent (below)
hd scheduler install                                  # macOS: launchd job, tick every 60 s; prints the hook snippet
```

`install` writes `~/Library/LaunchAgents/dev.harbordeck.scheduler[.<hash>].plist` (hash suffix when `HARBORDECK_HOME` is not the default) and loads it; `--no-load` only writes it and prints the `launchctl bootstrap` line. `hd scheduler uninstall` unloads and removes it. On Linux `install` prints a systemd user service + timer and a cron line to install yourself:

```
* * * * * HARBORDECK_HOME="$HOME/.harbordeck" /usr/bin/node /path/to/harbordeck.js tick
```

Then add the Claude Code hook (see [`adapters/claude-code`](../adapters/claude-code)).

## Wake command

Any shell command, run through `/bin/sh -c` in the data dir, 120 s timeout. Set it with `hd scheduler config --wake-command`, or `HARBORDECK_WAKE_COMMAND` (wins over the config).

| Input | |
|---|---|
| stdin, `$HARBORDECK_MESSAGE` | the message, e.g. `[harbordeck] usage limit reset at Thu 15:00 (hit Thu 10:12). Resume work: ...` |
| `$HARBORDECK_SCHEDULE_ID`, `$HARBORDECK_SCHEDULE_KIND` | queue id; `limit`, `reset` or `at` |
| `$HARBORDECK_ITEM` | linked item or request id, if any |
| `$HARBORDECK_HOME` | the data dir |

| Exit | Meaning |
|---|---|
| 0 | delivered |
| 3 | typed but unconfirmed: counts as delivered, never retyped |
| 75 | target not reachable now: retry next tick, no attempt spent |
| other | failed: retry next tick, up to `max_attempts` (5), then `schedule/failed/` |

Presets:

```sh
# generic: anything that reaches your agent
hd scheduler config --wake-command 'tmux send-keys -t agent "$HARBORDECK_MESSAGE" Enter'
# firstmate: one typed message to the primary firstmate pane via the home's fm-send.sh
hd scheduler config --wake-command 'FM_HOME=/path/to/firstmate-home /path/to/HarborDeck/adapters/firstmate/wake.sh'
```

With no wake command, queued *requests* are still delivered (their `answers.jsonl` line is the delivery); plain messages wait until one is set.

## Safety

- **Claim before send**: a due item is renamed into `schedule/sent/` before its wake runs, so two ticks (launchd + a manual run) never deliver it twice, and a crash mid-send never resends.
- A request's `answers.jsonl` line is written once, even when its wake is retried.
- Bounded retries (`max_attempts`), then `schedule/failed/`.
- Off switch: `hd scheduler off` (or `HARBORDECK_SCHEDULER=off`); `tick` then delivers nothing and keep-awake is released. `hd scheduler on` resumes.
- Hooks never fail the agent's session: `hd limit record` and `hd limit snapshot` always exit 0 and log problems.
- Log: `schedule/scheduler.log`. Late delivery (machine was asleep) says so in the message.

## Commands

```text
hd schedule <HH:MM|+30m|YYYY-MM-DD HH:MM|ISO|@epoch|reset> "<msg>" [--item <id>] [--request [--to <agent>]]
hd schedule list [--json] | cancel <id|item id>
hd limit record | snapshot          (stdin: hook JSON | statusline JSON)
hd limit set --reset <time> [--window <name>]
hd tick
hd scheduler status [--json] | on | off
hd scheduler config [--wake-command <cmd>] [--margin <s>] [--max-attempts <n>] [--keep-awake on|off]
hd scheduler install [--no-load] [--interval <s>] | uninstall [--no-load]
```

File layout and `scheduler.json` are specified in [`CONTRACT.md`](CONTRACT.md#scheduler).
