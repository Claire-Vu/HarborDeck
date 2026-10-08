# firstmate adapter

Scripts that connect any firstmate home to HarborDeck without changing firstmate. They read firstmate's own state and CLIs and write through the `harbordeck` CLI, so everything they install is schema-checked.

| Script | Writes | From |
|---|---|---|
| `hd-fleet.sh` | `fleet.json` | `state/*.meta` + `bin/fm-crew-state.sh <id>` per endpoint |
| `hd-quota.sh` | `quota.json` | `quota-axi --json` (cached reads) |
| `hd-rules.sh <prefs.md>` | `rules.json` | a markdown preferences file such as `data/captain.md` |
| `hd-bridge.sh` | firstmate holds and inbox notes | new lines in `answers.jsonl` |

Requirements: bash, `jq`, the `harbordeck` CLI on `PATH` (or `HD=/path/to/harbordeck.js`), and `quota-axi` for the quota script.

## Setup

```sh
export FM_HOME=/path/to/firstmate-home          # required by hd-fleet.sh and hd-bridge.sh
export HARBORDECK_FROM=mate-main                # signs items and replies
A=/path/to/HarborDeck/adapters/firstmate

"$A/hd-rules.sh" "$FM_HOME/data/captain.md"     # standing orders, re-run when the file changes
"$A/hd-quota.sh"                                # stamina bars
"$A/hd-fleet.sh"                                # crew scene
"$A/hd-bridge.sh" --dry-run                     # preview how pending answers would route
"$A/hd-bridge.sh" --watch 20                    # route answers every 20 s
```

Snapshots can be refreshed on firstmate's heartbeat or a simple loop, e.g. `while :; do "$A/hd-fleet.sh"; "$A/hd-quota.sh"; sleep 120; done`. Each run replaces the file atomically.

## Writing items from firstmate

Use the plain CLI (see `skill/SKILL.md`). Two conventions make the bridge work:

- **An item that stands for a captain hold uses the held task id as its item id**, e.g. `hd decision v2 "Merge the v2 bundle?" --opt merge+ --opt hold -a pr:<url>`. The bridge then answers that exact hold.
- Set `-f <mate id>` (or `HARBORDECK_FROM`) to the counter-staff id in `fleet.json` (`mate-main` by default, secondmates by their endpoint id).

## How answers route

`hd-bridge.sh` reads only lines added since its cursor (`$HARBORDECK_HOME/cursors/firstmate-bridge`), advancing it one line at a time; a failed route leaves the cursor on that line for the next run.

| Answer | firstmate call |
|---|---|
| `decide` | `bin/fm-captain-hold.sh answers --source harbordeck` with `<id>\t<key>\t<option label>\tdone`; a note, if any, also goes to the inbox |
| `approve`, `reject` | keyed answer `approve[: note]` / `reject[: note]`, mode `done` |
| `needs-work` | keyed answer `needs-work: <note>`, mode `release` (held work resumes), plus an inbox note |
| `ask`, `comment` | `bin/fm-inbox.sh note --request-id hd-<id>-<action>-<at> -- <text>` |
| `request` | `bin/fm-inbox.sh note --request-id <request id> -- HarborDeck request for <to>: <note>` |
| `file` | todo: inbox note "done"; answer: nothing to route |

- When a keyed answer names an item that is not a captain-held task (`fm-captain-hold.sh` reports `skipped:`), the bridge sends an inbox note instead, so no answer is lost.
- `--request-id` keys make inbox notes idempotent: replaying a line never creates a second note.
- `decide`, `approve`, `reject` and `file` mark the item resolved on the desk.
- Every note that expects an answer ends with the exact command to reply, e.g. `Reply: harbordeck reply <id> "<text>"`.

## Fleet mapping

`fm-crew-state.sh` runs with `FM_CREW_STATE_NO_FORGE=1` (no network). Its states map to the desk's crew states: `working` → working; `parked`, `paused`, `blocked` → waiting; `done` → done; anything else → idle. Endpoints with `kind=secondmate` become counter staff (`firstmates[]`); all others are crew. A crew whose id matches an item id gets `item` set. `HD_MATE_ID`/`HD_MATE_LABEL` name the main home (default `mate-main`, `First Mate`).

## Rules mapping

Each top-level bullet (`- ` or `* `) of the preferences file is one standing order. Its key is a trailing `{#key}` when present, otherwise a slug of its first six words. Add `{#key}` to bullets that items check often so keys survive rewording.

## Tests

```sh
adapters/firstmate/test/run.sh     # runs every script against a stub firstmate home
```
