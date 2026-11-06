# firstmate adapter

Scripts that connect any firstmate home to HarborDeck without changing firstmate. They read firstmate's own state and CLIs and write through the `harbordeck` CLI, so everything they install is schema-checked.

**To set up a home, follow [SETUP.md](SETUP.md)**: `install.sh` does everything below, including a launchd agent and the firstmate-side instructions.

| Script | Writes | From |
|---|---|---|
| `hd-fleet.sh` | `fleet.json`, each open item's `waiting` | `state/*.meta` + `bin/fm-crew-state.sh <id>` per endpoint; a crew blocked/paused/parked whose id or task id is the item id, the `<task>` of a `<task>.qN` item, or the item's topic is waiting on it (one `hd batch` of `waiting` lines, only when a list changed) |
| `hd-quota.sh` | `quota.json` | `quota-axi --json` (cached reads) |
| `hd-rules.sh <prefs.md>` | `rules.json` | a markdown preferences file such as `data/captain.md` |
| `hd-bridge.sh` | firstmate holds and inbox notes | new lines in `answers.jsonl` (`--follow`: live, on every append) |
| `install.sh` | CLI links, app settings, launchd agent, firstmate instructions | see [SETUP.md](SETUP.md) |
| `hd-listener.sh` | a typed wake into the open firstmate session, or a new session in herdr | `status`: will a firstmate session act on what the desk sends? `ensure`: make it so (the bridge runs it) |
| `wake.sh` | one typed message to the primary firstmate session (`bin/fm-send.sh`), starting one when none runs | the scheduler's wake command ([`docs/SCHEDULER.md`](../../docs/SCHEDULER.md)) |
| `hd-live.sh` | all of the above, continuously | runs the bridge in `--follow` mode and refreshes fleet (10 s), quota (120 s) and rules (on file change) |

Requirements: bash, `jq`, the `harbordeck` CLI on `PATH` (or `HD=/path/to/harbordeck.js`), `quota-axi` for the quota script, and `herdr` for starting a firstmate session that is not running.

## Setup

```sh
export FM_HOME=/path/to/firstmate-home          # required by hd-fleet.sh and hd-bridge.sh
export HARBORDECK_FROM=mate-main                # signs items and replies
A=/path/to/HarborDeck/adapters/firstmate

"$A/hd-rules.sh" "$FM_HOME/data/captain.md"     # standing orders, re-run when the file changes
"$A/hd-quota.sh"                                # stamina bars
"$A/hd-fleet.sh"                                # crew scene
"$A/hd-bridge.sh" --dry-run                     # preview how pending answers would route
"$A/hd-live.sh"                                 # live: answers route the instant they land, snapshots stay fresh
```

`hd-live.sh` is the normal way to run it: items and replies firstmate writes appear on the running desk immediately (the app watches the data dir), every user action reaches firstmate the moment it is appended, and crew, stamina and standing orders keep refreshing. Tune with `HD_FLEET_EVERY`/`HD_QUOTA_EVERY`. Run it under firstmate's process supervisor, launchd, or a terminal pane.

Each snapshot run replaces its file atomically, so the app never sees a half-written file.

## Writing items from firstmate

Use the plain CLI (see `skill/SKILL.md`). Two conventions make the bridge work:

- **An item that stands for a captain hold uses the held task id as its item id**, e.g. `hd decision v2 "Merge the v2 bundle?" --opt merge+ --opt hold -a pr:<url>`. The bridge then answers that exact hold.
- Set `-f <mate id>` (or `HARBORDECK_FROM`) to the counter-staff id in `fleet.json` (`mate-main` by default, secondmates by their endpoint id).

## How answers route

`hd-bridge.sh --follow` waits on the answers file and routes each line as soon as it lands; without flags it routes what is pending and exits. It reads only lines added since its cursor (`$HARBORDECK_HOME/cursors/firstmate-bridge`), advancing it one line at a time; a failed route leaves the cursor on that line for the next run.

| Answer | firstmate call |
|---|---|
| `decide` | `bin/fm-captain-hold.sh answers --source harbordeck` with `<id>\t<key>\t<option label>\tdone`, plus an inbox note naming the answer and asking firstmate to pass it to the worker waiting on that task |
| `approve`, `reject` | keyed answer `approve[: note]` / `reject[: note]`, mode `done`, plus the same inbox note |
| `needs-work` | keyed answer `needs-work: <note>`, mode `release` (held work resumes), plus an inbox note |
| `ask`, `comment` | `bin/fm-inbox.sh note --request-id hd-<id>-<action>-<at> -- <text>` |
| `request` | `bin/fm-inbox.sh note --request-id <request id> -- HarborDeck request for <to>: <note>` |
| `file` | todo: inbox note "done"; answer: nothing to route |
| `defer` | held task (or `<task>.qN` of one): `bin/fm-captain-hold.sh hold <task> --until <date>` plus an inbox note to park the worker; otherwise an inbox note |

- **Someone acts on it.** An inbox note only queues a wake in the home; it needs a live consumer. After each batch the bridge runs `hd-listener.sh ensure`, which acts only while a note HarborDeck wrote (request id `hd-*`/`req-*`) is unacknowledged (`fm-inbox.sh receipts`): nothing when the home's watcher is live (`fm-inbox.sh ready`) or the session holding the home lock is mid-turn; a typed wake (`fm-send.sh`) into the session's own pane when a session is open but nothing listens (for example opened by hand, no turn yet, or a home with no crew, where the Stop hook arms no watcher); and when no session runs, a new tab in the herdr workspace `HD_WAKE_WORKSPACE` (default `firstmate`, created if missing) running `HD_FM_HARNESS` (default `claude`) with the wake as its first prompt (`HD_FM_START=off` to never start one; it never starts herdr itself). A wake or start is recorded in `cursors/firstmate-listener` and not repeated for `HD_LISTENER_GRACE` seconds (180). `--follow` re-checks every `HD_BRIDGE_RECHECK` seconds (30) while such a note is unread, and a (re)started bridge checks at once, so a lost keystroke, a session that died before draining, or a bridge restart never strands a note. The log says which (`hd-bridge: firstmate starting firstmate in default:w7:p1`, `... listening watcher live`, `... clear: ...`), and `fleet.json`'s main mate `state` carries the same word, which the desk shows on each waiting ticket.
- The session is found by the home lock's pid (`fm-inbox.sh ready`), else the newest agent process whose working directory is the home. Its pane comes from that process's own environment (`HERDR_PANE_ID`/`HERDR_SESSION`, or `TMUX_PANE` on its own tmux server), so only that home's session is typed into, never a crew pane or another home.
- The protocol is model-checked: `.agents/skills/verify-firstmate-delivery/check.sh` (TLA+ model plus these tests).
- When a keyed answer names an item that is not a captain-held task (`fm-captain-hold.sh` reports `skipped:`), the bridge sends an inbox note instead, so no answer is lost.
- `--echo` (or `HD_BRIDGE_MODE=echo`, which `hd-live.sh` and `install.sh --mode echo` pass through) logs each firstmate command with a timestamp instead of running it. It still asks the read-only `fm-captain-hold.sh open` predicate, so it shows exactly what live mode would do. HarborDeck-side effects still happen, and echo mode keeps its own cursor (`firstmate-bridge.echo`). `--dry-run` is a one-shot preview that changes nothing.
- `--request-id` keys make inbox notes idempotent: replaying a line never creates a second note.
- `decide`, `approve`, `reject` and `file` mark the item resolved on the desk.
- Every note that expects an answer ends with the exact command to reply, e.g. `Reply: harbordeck reply <id> "<text>"`.

## Fleet mapping

`fm-crew-state.sh` runs with `FM_CREW_STATE_NO_FORGE=1` (no network); each crew's `task_title` comes from `bin/fm-tasks-axi.sh show <task> --full`. Its states map to the desk's crew states: `working` → working; `parked`, `paused`, `blocked` → waiting; `done` → done; anything else → idle. Endpoints with `kind=secondmate` become counter staff (`firstmates[]`); all others are crew. A crew whose id matches an item id gets `item` set. `HD_MATE_ID`/`HD_MATE_LABEL` name the main home (default `mate-main`, `First Mate`).

## Rules mapping

Each top-level bullet (`- ` or `* `) of the preferences file is one standing order. Its key is a trailing `{#key}` when present, otherwise a slug of its first six words. Add `{#key}` to bullets that items check often so keys survive rewording.

## Tests

```sh
adapters/firstmate/test/run.sh     # runs every script against a stub firstmate home
```
