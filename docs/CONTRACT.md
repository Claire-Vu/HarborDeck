# HarborDeck data contract v1

HarborDeck is a desk for the person who supervises agents. Agents put **items** in front of the user; the user stamps, comments, asks, or hands over new orders; agents read those **answers** back. Everything goes through small files in one data directory. Agents never write HTML or layout, and all presentation lives in the app.

The JSON Schemas in [`../schema/`](../schema) are normative. This page explains them. [`sample-data/`](sample-data) is a complete, valid example directory (`harbordeck validate` passes on it).

## Data directory

`$HARBORDECK_HOME`, default `~/.harbordeck/`:

| Path | Writer | Reader | Schema |
|---|---|---|---|
| `items/<id>.json` | agent | app | [`item`](../schema/item.schema.json) |
| `answers.jsonl` | app (append only) | agent | [`answer`](../schema/answer.schema.json) |
| `gaps.jsonl` | agent (append only) | app, maintainers | [`gap`](../schema/gap.schema.json) |
| `fleet.json` | agent/adapter (optional) | app | [`fleet`](../schema/fleet.schema.json) |
| `quota.json` | agent/adapter (optional) | app | [`quota`](../schema/quota.schema.json) |
| `rules.json` | agent/adapter (optional) | app | [`rules`](../schema/rules.schema.json) |
| `cursors/<name>` | agent | agent | byte offset into `answers.jsonl` |
| `scheduler.json` | scheduler | app, tools | [scheduler status](#scheduler) |
| `schedule/` | scheduler, app (queue only) | scheduler | [scheduler](#scheduler) |

File rules:

- Whole-file writes are atomic: write `.<name>.<random>.tmp` in the same directory, then rename. Readers ignore dotfiles and must tolerate a file appearing or being replaced at any time.
- JSONL files are appended one complete line per write (`\n`-terminated). A reader consumes only complete lines; a trailing partial line is still being written.
- The app never writes items or snapshots. Agents never write `answers.jsonl`; the HarborDeck scheduler appends a `request` line on the user's behalf when a request the user queued is delivered.
- Unknown fields are allowed everywhere and ignored, so producers can add fields before the app reads them.
- Relative paths inside items (`body`, artifact `path`) resolve against the data directory. The CLI always writes absolute paths.

## Items

One file per item, `items/<id>.json`, file name = `id`. Rewrite the same file to update it. Keep it small (well under 2 KB): prose lives in files referenced by path, never inline.

```json
{
  "id": "release-2-4",
  "kind": "decision",
  "project": "weather-app",
  "stream": "releases",
  "from": "mate-main",
  "title": "Ship release 2.4 to the store?",
  "summary": "Release 2.4 adds hourly radar. All 212 tests pass.",
  "body": "/abs/path/release-notes.md",
  "options": [
    {"key": "ship", "label": "Ship today", "recommended": true},
    {"key": "hold", "label": "Hold for one more beta week"}
  ],
  "artifacts": [
    {"type": "pr", "url": "https://github.com/example/weather-app/pull/88"},
    {"type": "report", "path": "/abs/path/release-notes.md"}
  ],
  "rules": ["no-release-without-word", "friday-freeze"],
  "checks": [
    {"rule": "no-release-without-word", "ok": true, "note": "held for your word"},
    {"rule": "friday-freeze", "ok": false, "note": "today is Friday"}
  ],
  "thread": [{"from": "mate-main", "text": "Beta crash rate is now 0.2%.", "at": 1791390000}],
  "priority": 1,
  "due": 1791486400,
  "created": 1791392800,
  "updated": 1791393000,
  "status": "open"
}
```

Required: `id`, `kind`, `title`, `created`, `status`.

| Field | Type | Meaning |
|---|---|---|
| `id` | slug `[A-Za-z0-9][A-Za-z0-9._-]{0,127}` | Stable key. Answers refer to it. When an item stands for an agent-side task, use that task's id. |
| `kind` | `decision` \| `answer` \| `review` \| `todo` | See [kinds](#kinds). |
| `project`, `stream` | string | Grouping. `stream` is a finer lane inside a project. |
| `from` | string | Agent id that raised it (matches `fleet.json` `firstmates[].id` when present). |
| `title` | string ≤ 300 | One line. Phrase decisions as a question. |
| `summary` | string ≤ 2000 | One to three plain sentences. The app treats each sentence as an inspectable claim. |
| `body` | path or URL | Markdown or text to read in full. Never inline prose. |
| `options` | `[{key, label, recommended?}]` | **Decision only, required there.** Keys are slugs. At most one should be recommended. |
| `artifacts` | `[{type, url \| path, label?}]` | Evidence by reference. See [artifacts](#artifacts). |
| `rules` | `[rule key]` | Standing orders this item should be read against (keys in `rules.json`). |
| `checks` | `[{rule, ok, note?}]` | The agent's own check of a standing order: `ok: true` passed, `ok: false` flagged (note says why). Advisory; the user decides. |
| `thread` | `[{from, text, at}]` | Agent follow-ups, oldest first. Replies to the user's asks land here. |
| `priority` | 1 critical, 2 high, 3 normal (default), 4 low | Queue order and emphasis. |
| `due` | epoch seconds | Deadline. |
| `created`, `updated` | epoch seconds | `created` is kept across rewrites. `updated` is set on every rewrite after the first. |
| `status` | `open` \| `resolved` | Resolved items leave the queue and stay in the archive. Writing an item again reopens it. |

### Kinds

Pick the kind by **what the user has to do**, not by what the agent did:

| Kind | The user... | App verbs | Typical source |
|---|---|---|---|
| `decision` | chooses between options | decide (with `key`), reject, needs-work, ask | a blocked task, a merge, a plan with alternatives |
| `review` | judges finished work | approve, reject, needs-work, ask, comment | a video, a design, a draft, a PR to look at |
| `answer` | reads and files | file, ask, comment | research, a report, an explanation, an FYI |
| `todo` | does something only they can do | file (done), ask | sign, pay, log in, renew a key, physical tasks |

If a response fits none of these, write the closest item if one is useful and also log a [gap](#gaps).

### Artifacts

`type` is a lowercase slug. The app renders known types and shows anything else as a link:

| Type | Rendered as |
|---|---|
| `pr` | pull/merge request card (`url`) |
| `web` | page shown in the desk's browser pane (`url`); see below |
| `lavish` | a Lavish review page (`url`), shown like `web` so the user can annotate and send feedback from the desk |
| `video` | in-desk player; comments can anchor to a time `t` |
| `image` | photo; comments can anchor to a spot `x,y` |
| `report` | readable sheet (markdown/text), dossier reader |
| `audio` | player |
| `diff` | code diff |
| `link`, `file` | link / file reference |

Exactly one of `url` (any `scheme://`) or `path` is required.

`web` and `lavish` pages render inside the app only when the URL is `http(s)` on this machine (`localhost`, `127.0.0.1`, `[::1]`) or on a host the user added in Settings → Web hosts; anything else is offered in the system browser. The page runs in its own session with no access to the desk, every permission request is denied, and links or popups that leave the allowed hosts open in the system browser. A `lavish` artifact with a `path` instead of a `url` (no running Lavish session) shows as a file card. Older apps show both types as link cards.

## Answers

The app appends one line per user action to `answers.jsonl`:

```json
{"id":"release-2-4","action":"decide","key":"ship","note":"","at":1791431241}
{"id":"onboarding-video","action":"approve","note":"","at":1791431300}
{"id":"logo-colors","action":"needs-work","note":"try a third palette","at":1791431350}
{"id":"db-research","action":"file","note":"","at":1791431400}
{"id":"onboarding-video","action":"comment","note":"mismatch: captions drift","anchor":{"artifact":"https://example.com/v.mp4","t":41.5},"at":1791431450}
{"id":"db-research","action":"ask","note":"why host B over A?","at":1791431500}
{"id":"req-1791431600-3","action":"request","note":"Add a dark theme","to":"mate-design","at":1791431600}
```

| `action` | From | Extra fields | Meaning for the agent |
|---|---|---|---|
| `decide` | decision approve stamp | `key` (required), `note` | Do the chosen option. |
| `approve` | review approve stamp | `note` | Accepted as is. |
| `file` | answer / todo approve stamp | `note` | Read (answer) or done (todo). |
| `reject` | reject stamp | `note` | No. Stop or drop it. |
| `needs-work` | needs-work stamp | `note` | Redo with the note; keep the item open. |
| `ask` | ask slip | `note` | A question. Reply with a `thread` entry. |
| `comment` | inspect match/mismatch | `note`, `anchor` | Feedback pinned to something. `anchor` may carry `claim`, `artifact`, `t` (seconds), `x`,`y` (position on an image), `heading`, `rule`. |
| `request` | new order slip | `note` (required), `to` | A new task. `id` is minted by the app; `to` is a `firstmates[].id`. The user never picks crew. |

**Undo is not an action.** After a stamp the app holds the line for about 4 seconds; Undo drops it and nothing is written. Closing the app flushes a held line. Agents therefore only ever see final lines and never need to reconcile undo.

Reading answers cheaply: remember the byte offset after the last complete line you consumed and read only bytes after it (`harbordeck answers --cursor <name>` does this). If the file is shorter than the offset, it was rotated; start from 0.

## Replies and requests

- Reply to an `ask`, `comment` or `needs-work` by appending `{from, text, at}` to the item's `thread` (`harbordeck reply <id> "<text>"`). The app shows the reply on the ticket rail.
- Reply to a `request` by writing an item whose `id` equals the request id. `harbordeck reply <request-id> "<text>"` creates a minimal `answer` item titled from the request when none exists yet; rewrite it with a richer item later if needed.

## Snapshots (optional)

The app works without them; each adds a layer to the desk.

### `rules.json`: standing orders

```json
{"friday-freeze": {"text": "No production releases on Fridays.", "source": "preferences.md:12"}}
```

Keys are the strings items use in `rules` and `checks[].rule`.

### `quota.json`: stamina

```json
[{"name": "Agent plan A", "window": "5h", "used_pct": 62, "resets_at": 1791440000},
 {"name": "Agent plan A", "window": "7d", "used_pct": 41, "resets_at": 1791720000}]
```

One bar per entry: `100 - used_pct` left, countdown to `resets_at`. `window` is `<n>h`, `<n>d` or `<n>w`. When `resets_at` is in the past the app rolls it forward by whole windows.

### `fleet.json`: who is working

```json
{
  "generated": 1791400000, "day": "2026-10-07",
  "firstmates": [{"id": "mate-main", "label": "First Mate", "domain": "everything else", "harness": "claude", "model": "opus", "state": "attending"}],
  "crew": [{"id": "crew-release", "firstmate": "mate-main", "state": "waiting", "task": "release-2-4", "task_title": "Cut release 2.4",
            "item": "release-2-4", "project": "weather-app", "harness": "claude", "model": "opus", "effort": "medium", "shipped": 5, "rework": 1}],
  "regulars": [{"id": "releases", "label": "Release train", "shipped": 4, "rework": 1}],
  "tools": [{"id": "radar-tiles", "label": "Radar tile cache", "item": "release-2-4", "state": "building"}],
  "counts": {"shipped_7d": 6, "merged_7d": 3}
}
```

- `firstmates`: the agents the user talks to; `request` targets.
- `crew[].state`: `idle | working | waiting | done`. `item` links a worker to the item it waits on.
- `regulars`: one per `stream` or project, for the regulars meter.
- `tools[].state`: `proposed | approved | building | installed`.
- Status and flavour only: nothing in the app controls crew.

## Gaps

When an agent has a response it cannot map onto an item kind (or can only squeeze in badly), it appends a line to `gaps.jsonl`:

```json
{"text": "A live progress feed for a 2 h render has no item kind; squeezed into a todo", "item": "onboarding-video", "sample": "/abs/path/progress.log", "from": "mate-design", "at": 1791399500}
```

`text` says what did not fit and why; `sample` points at an example; `item` names the item it was squeezed into, if any. The app lists gaps so HarborDeck can grow new item shapes from real cases.

## Live feed

HarborDeck is a live view, not an import. Agents write at any time; the app watches the data directory (items, snapshots, gaps) and updates the running desk without a restart or refresh. Agents get answers the same way: `harbordeck answers --cursor <name> --wait` blocks until the app appends a line and returns it at once, which is the on-answer hook for any agent loop (`adapters/firstmate/hd-bridge.sh --follow` is a complete one). Demo data is for first run only; once agents write to the data directory, only their data shows.

## Scheduler

The limit-reset scheduler (user guide: [`SCHEDULER.md`](SCHEDULER.md)) holds messages and requests until a time or until the agent's usage limit resets, then delivers each once. `harbordeck tick` (every 60 s) is the only deliverer.

```
schedule/queue/<id>.json     pending items        schedule/sent/<id>.json, schedule/failed/<id>.json   history
schedule/config.json         {"wake_command", "margin", "max_attempts", "wake_timeout", "keep_awake"}
schedule/rate-limits.json    last status-line rate_limits per account     schedule/keep-awake.json   {"pid", "until"}
schedule/off                 off switch           schedule/scheduler.log    log
```

A queue item:

```json
{"id": "reset-req-1791448100-512", "kind": "reset", "message": "Add a dark theme", "queued_at": 1791448100,
 "item": "req-1791448100-512", "request": {"id": "req-1791448100-512", "note": "Add a dark theme", "to": "mate-web"}}
```

| `kind` | Due |
|---|---|
| `at` | `due` (epoch) |
| `reset` | after every known exhausted window resets (pending `limit` items and `quota.json` windows at 100 %), else the soonest `quota.json` reset, else now; plus `margin` |
| `limit` | the wake itself: `reset` + `margin`. Fields `reset`, `source` (`statusline`, `message`, `quota`, `manual`), `window`, `hit_at`, `stalled` (`[{pane, cwd, session}]`). Records within 15 min of each other are one reset. |

An item with `request` is written to `answers.jsonl` at delivery as `{"id", "action": "request", "note", "to", "queued_at", "at"}`. The app writes queue files only to add or cancel a queued request; ids are stable, so queuing the same thing twice is one entry.

`scheduler.json` is rewritten atomically on every change (times are epoch seconds, `null` = none):

```json
{"version": 1, "updated_at": 1791448540, "enabled": true, "wake_command": true,
 "next_reset": 1791452122, "reset_due": 1791452212,
 "limits": [{"window": "five_hour", "reset": 1791452122, "wake": 1791452212, "source": "statusline", "id": "limit-1791452122"}],
 "pending": [{"id": "reset-req-1791448100-512", "kind": "reset", "due": 1791452212, "message": "Add a dark theme",
              "item": "req-1791448100-512", "request": {"id": "req-1791448100-512", "note": "Add a dark theme", "to": "mate-web"}, "queued_at": 1791448100}],
 "keep_awake": {"pid": 4242, "until": 1791452512},
 "last_delivery": {"id": "at-1791440000-3fa1c2", "kind": "at", "item": null, "delivered_at": 1791440031},
 "sent": [], "failed": []}
```

`limits` lists one entry per known reset (per window); `next_reset` is the latest of them, the time work can resume. `sent` and `failed` hold the last 10.

## Versioning

This is contract v1. Additive changes (new optional fields, new artifact types, new actions that older agents can ignore) keep v1. A breaking change bumps the schema `$id` path and this title.
