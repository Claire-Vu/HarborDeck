---
name: verify-harbordeck
description: Launch, drive and prove Harbor Deck end to end - the Electron desk (app/), the `harbordeck`/`hd` CLI, answers.jsonl, and the limit-reset scheduler - on an isolated synthetic data dir. Use after any change to the renderer, main/preload, the CLI, the data contract, the scheduler, or the firstmate/claude-code adapters, and whenever a change needs proof that an item written by an agent shows up live, a stamp lands in answers.jsonl, or queued work is delivered by a tick.
---

# Verify Harbor Deck

Harbor Deck has three surfaces, all tied together by one data directory (`docs/CONTRACT.md`):

- **Primary:** the Electron desk (`app/`). A person stamps items; each action becomes one line in `answers.jsonl`.
- **CLI:** `harbordeck`/`hd` (`cli/`). Agents write items, reply, read answers, and queue/deliver scheduled work.
- **Scheduler:** `harbordeck tick` delivers queued requests after a usage-limit reset and runs a wake command.

Read [`features/README.md`](features/README.md) before choosing a recipe. The feature map is the maintained verification source; a proof that drives one convenient entry point is incomplete when the map lists others.

The skill lives in `.agents/skills/verify-harbordeck/`; `.claude/skills/verify-harbordeck` and `.cursor/skills/verify-harbordeck` are relative symlinks to it, so every harness finds the same copy. Edit only the `.agents` path. All paths below are relative to the worktree root. `H=.agents/skills/verify-harbordeck/scripts/hdv` and `U=.agents/skills/verify-harbordeck/scripts/ui.mjs` are the two helpers.

## Isolation rules

- Only synthetic data. Never point anything at `~/.harbordeck`, a firstmate home, the installed app at `~/.local/share/harbordeck-app`, `~/Library/LaunchAgents`, or launchd. `hdv` sets `HARBORDECK_HOME`, `HARBORDECK_USER_DATA`, `HARBORDECK_CAFFEINATE` and `HARBORDECK_LAUNCHD_DIR` to its own state dir for every app and CLI call it makes.
- Never click anything that calls the system browser (`Browser ↗`, `Open in your browser`, off-machine links in a pane page): it acts on the user's desktop.
- Never run a bare `hd`/`harbordeck` (it defaults to `~/.harbordeck`): go through `$H hd ...`, or `eval "$($H env)"` first.
- Never run `hd scheduler install` or `uninstall`, and never the real `caffeinate`. `hdv` installs a stub caffeinate and a stub wake command that only logs.
- One instance per worktree (state dir `/tmp/hdv-<hash of worktree path>`, override `HDV_STATE`). Two worktrees run side by side on different CDP ports. `launch` refuses to start over a live instance.

## Launch

Once per worktree: `npm install` (if Electron reports `failed to install correctly`: `npm approve-scripts electron && npm rebuild electron`).

```bash
H=.agents/skills/verify-harbordeck/scripts/hdv
$H launch            # seeded synthetic data dir (17 items, fleet, quota, rules, 2 answers) + the demo web page on loopback; no pretend agent
$H launch --demo     # the app's own demo mode instead: same seed in the private profile, plus the pretend agent
$H launch --visible  # show the window (default is headless)
```

Ready when it prints `ready  pid=<pid>  site=http://127.0.0.1:<port>/  cdp=http://127.0.0.1:<port>  home=<dir>  run=<run-id>` (it waits for the renderer on CDP and the data dir). The app runs headless (`HARBORDECK_HEADLESS=1`): no window on screen, no Dock icon, never takes focus, yet it paints, so `ui.mjs` drives and screenshots it as usual. Pass `--visible` when a human wants to watch. CDP picks the first free port from 9340 (`--port N` to choose). `launch` also writes the scheduler config into the synthetic data dir: wake command = stub, `margin` 0, keep-awake on (stub). Use the default mode for verification: the `--demo` pretend agent writes replies and resolves items on its own, which races your assertions. Use `--demo` only to verify demo mode itself.

## Doctor

Run before the first drive, and again whenever anything looks off (a drive failed, the window looks stale):

```bash
$H doctor
```

Every line must be `ok`: app pid alive, the pid runs this worktree's Electron, the CDP port is owned by that pid tree, the window is titled `Harbor Deck`, the data dir lives in the state dir, the app log says it reads that data dir, and the scheduler's wake command is the stub. It also prints `build <branch>@<sha>` (with `(dirty)` for uncommitted product changes) and item/answer counts. A `FAIL` means relaunch: `$H cleanup && $H launch`.

## Drive

```bash
eval "$($H env)"     # HARBORDECK_HOME, CHROME_DEVTOOLS_AXI_BROWSER_URL/SESSION, HDV_HOME, HDV_RUN_ID for this instance
U=.agents/skills/verify-harbordeck/scripts/ui.mjs
```

**UI: `ui.mjs`** (Playwright over the app's CDP port; each call connects, acts once, disconnects; exit 1 with a one-line reason on failure):

```bash
$U click --role button --name 'Open the office'      # ARIA role + accessible name
$U click --css '#queue li' --text 'Merge PR 142'     # app id/class + visible text
$U press 1                                           # keyboard: 1-4 stamp, u undo, n next, t tickets, p plain, Escape
$U fill --css '.modal.noteslip textarea' --value 'why?'
$U wait --css '#rail .ticket.replied' --text 'Quarantine' [--gone] [--timeout 15000]
$U text --css '#desk-surface .paper.manifest h3'     # print matching text
$U aria --out f.aria.yml ; $U shot f.png ; $U eval 'document.title'   # inspection only
$U text --pane --css h1 ; $U click --pane --css '#s2' ; $U shot --pane p.png   # inside the open browser pane
```

Stable handles (from `app/renderer/index.html` and `app.js`):

| Handle | What |
|---|---|
| button `Open the office` | closes the Morning manifest shown on a fresh profile; every drive starts here |
| `#queue li` + item title | an item in the window queue; click selects it onto the desk |
| `#desk-surface .paper.manifest h3` | title of the item on the desk |
| `.tab[data-tab="window"\|"requests"\|"crew"]` | left tabs |
| `#stamps .stamp[data-verdict=approve\|reject\|needswork\|ask]`, keys `1`-`4` | stamps |
| `.toast.undo` | the 4 s undo hold after a stamp; `u` drops it |
| `.modal.noteslip textarea` + button `Send` | note slip for Ask / Needs work |
| `#rail .ticket.waiting\|.queued\|.replied[.new]`, `.tk-foot`, `.tk-pop` | ticket rail (asks, orders, queued orders) and its popover |
| `#requests-pane textarea`, buttons `Send now`, `Queue for after reset`, `Queue at time`, input `Send at time` | Requests tab |
| `#sched-chip` | scheduler chip: `⏳ N queued · ↻ <reset> · ☕ <awake until>` |
| button `Agent log` → `#log-lines` | the exact answers.jsonl lines, plus a held line |
| `#stamina-cluster .mini-sub`, `#yard .yc.cook` | stamina bars, crew sprites (from quota.json / fleet.json) |
| `#desk-surface .paper.prcard` + button `View`, `.modal.web`, `.web-addr`, `.web-refused`, `.modal.web [aria-label=Close]` | browser pane frame for `web`/`lavish` artifacts; the page itself is `ui.mjs --pane` |

`chrome-devtools-axi` also attaches (`eval "$($H env)"` sets its browser URL and a per-instance session) and is fine for reading (`snapshot`, `screenshot`, `console`). Do not click with its `@uid` refs: the desk re-renders every second (clock, animations), so refs go `STALE_REF` between the snapshot and the click. Use `ui.mjs` for every action.

**CLI / agent side: `$H hd ...`** (the real CLI with this instance's env, `HARBORDECK_FROM=mate-main`):

```bash
$H hd decision hdv-palette "Which palette?" -s "Warm tested better." --opt warm+ --opt cool -p 1
$H hd batch < items.txt ; $H hd reply <id> "<text>" ; $H hd resolve <id>
$H hd answers --cursor verify ; $H hd ls ; $H hd validate
echo '[{"name":"Solo","window":"5h","used_pct":100,"resets_at":'$(( $(date +%s)+20 ))'}]' | $H hd quota -
$H hd schedule list ; $H tick ; $H wake-log
```

`$H tick` is the real `harbordeck tick` (exactly what launchd runs every 60 s), so a delivery you see came through production code. There is no launchd job: nothing delivers until you tick.

## Evidence

Proof goes to `~/.local/share/verify-harbordeck/<run-id>/<feature>/` and survives cleanup.

```bash
$H capture <feature> <step>      # <step>.png + <step>.aria.yml (UI) and <step>.state/ (answers.jsonl, items.tsv, scheduler.json, wake.log)
$H evidence <feature>            # print/create the dir for anything else (CLI transcripts, proof.md)
```

Per exercised feature save: a `before` capture, the action (the exact `ui.mjs`/`hd` commands with stdout and exit code), an `after` capture, and a `proof.md` naming the feature ID, entry point, `build` line from doctor, assertions checked, and artifact names.

Proof standards:

- Exercise the real user path: clicks and keys through `ui.mjs`, agent writes through `$H hd`, delivery through `$H tick`. `ui.mjs eval` is for reading state, never for calling `window.harbor.*` or setting DOM state.
- Capture the action and the resulting state, not just the final screen. A stamp's proof is the line in `answers.jsonl` (after the hold), not the toast. A delivery's proof is the `request` line in `answers.jsonl` plus the stub wake log, and the ticket flipping from queued to sent.
- Verify side effects alongside the screen: `answers.jsonl` lines, `items/<id>.json` (thread, status), `scheduler.json`, `schedule/sent/`, `wake.log`.
- The only mocks are at boundaries the product already isolates: the wake command (configurable by design) and caffeinate (`HARBORDECK_CAFFEINATE`).

Recorded proof (video, contact sheet, manifest) of the live round trip including the firstmate bridge: `test/evidence/run.sh demo` (repo-owned; launches its own isolated instance with a stub firstmate home, needs `~/.agents/skills/evidence`). Output lands in `~/.local/share/evidence/harbordeck/<run-id>/`. It never uses the `hdv` instance.

## Live agent round trip

`npm run test:roundtrip` (`node test/live/agent-roundtrip.mjs [--model <m>] [--keep]`) proves the firstmate loop with a real agent and times each leg. It launches its own headless `hdv` instance (own `HDV_STATE`, so it runs beside yours), a stub firstmate home whose `fm-captain-hold.sh`/`fm-inbox.sh` write ms-stamped lines to `received.log`, and `hd-bridge.sh --follow` in live mode. A `claude -p` agent (default `--model haiku`; `AGENT_CMD` to swap) posts a decision with the CLI and blocks on `fm-wait`; the script stamps it on the desk through Playwright, and the agent must reply with the stamped key. It prints one line per leg and PASS/FAIL, and saves `legs.json`, `bridge.log`, `agent.log`, `received.log` under `~/.local/share/verify-harbordeck/roundtrip-<id>/`.

| Leg | Typical |
|---|---|
| item posted -> on the desk | ~0.2 s |
| stamp -> answer line | ~4.4 s (the desk's undo hold, by design) |
| answer line -> firstmate received (bridge) | ~0.4 s |
| firstmate received -> agent acted | ~1-2 s (agent turn) |

A bridge leg over ~2 s, or a FAIL, is a regression: read `bridge.log` (timestamped `hd-bridge: routed ...` per answer).

## Cleanup

```bash
$H cleanup
```

Kills only what `launch` started (the recorded Electron pid, the demo web page server, and the stub caffeinate pid the scheduler recorded, each verified by command line) and stops this instance's chrome-devtools-axi bridge, then deletes the state dir (synthetic data dir, profile, logs). Evidence under `~/.local/share/verify-harbordeck/` stays. Never `pkill`/`killall` Electron or Harbor Deck: the user's installed copy may be running. Run cleanup after every failed iteration too, then confirm: `lsof -nP -iTCP:<port> -sTCP:LISTEN` prints nothing.

## Extending

New user-facing surface (topics, a new item kind, a new artifact type): add `features/<feature>.md` in the README's contract shape and list it in the README index; put any new stable handle in the Drive table; give `ui.mjs`/`hdv` a subcommand only when a recipe cannot be driven with the existing ones. When routes, selectors or behavior change, run `/maintain-verification-skill` and update this skill in the same change.
