# harbordeck CLI (`hd`)

The agent side of HarborDeck. One short command writes one desk item; one command reads the user's new answers. No dependencies beyond Node 18+.

## Install

```sh
git clone https://github.com/Claire-Vu/HarborDeck.git
npm install -g ./HarborDeck/cli      # installs `harbordeck` and the short alias `hd`
hd path                              # prints the data dir: $HARBORDECK_HOME or ~/.harbordeck
```

Or run it in place: `node HarborDeck/cli/bin/harbordeck.js help`. On macOS `/usr/bin/hd` is a hexdump alias; npm's global bin normally comes first in `PATH`, and `harbordeck` always works.

## For agent authors

Connecting an agent takes three things:

1. **Install the CLI** (above) where the agent runs, and point it at the app's data dir with `HARBORDECK_HOME` if it is not `~/.harbordeck`. Set `HARBORDECK_FROM=<agent id>` so items and replies are signed.
2. **Teach the agent**: install [`skill/SKILL.md`](../skill/SKILL.md) as an Agent Skill (Claude Code: copy `skill/` to `~/.claude/skills/harbordeck/`; Codex and other harnesses that read skills: their skills dir), or paste [`skill/AGENTS-snippet.md`](../skill/AGENTS-snippet.md) into the project's `AGENTS.md`/`CLAUDE.md`.
3. **Read answers back** at each turn (`hd answers --cursor <agent id>`) or live: `hd answers --cursor <agent id> --wait` returns the moment the user acts. Agents with an orchestrator can route lines automatically; see [`adapters/firstmate`](../adapters/firstmate) for a complete example.

Agents that prefer tools to a shell can use the MCP server instead: `hd mcp` (stdio). It exposes `harbordeck_batch`, `harbordeck_answers`, `harbordeck_gap` and `harbordeck_topic`. Claude Code: `claude mcp add harbordeck -- harbordeck mcp`.

### Why it is cheap

- An item is one command of roughly 30-80 tokens. A whole reply is one `hd batch` call.
- Reports, videos, images and PRs are referenced by path or URL; nothing is copied.
- Output is one `ok <kind> <id>` line per write, errors one line each.
- `hd answers --cursor` returns only new lines (nothing at all when there are none).

### Mapping a response onto items

| The user must... | Kind |
|---|---|
| choose between options | `decision` (`--opt key+` marks the recommendation) |
| judge finished work | `review` |
| read and file | `answer` |
| do something only they can do | `todo` |

One item per thing the user acts on. Information with no action needs no item. If a response fits none of the kinds, write the closest useful item and record the gap: `hd gap "<what didn't fit and why>" --item <id> --sample <path>`. Gaps collect in `gaps.jsonl` and drive new item shapes.

## Commands

```text
hd decision <id> "<title>" --opt key+ --opt key=Label [flags]
hd answer|review|todo <id> "<title>" [flags]
  -s/--sum "<one line>"   -b/--body <path|url>   -a/--art [type:]<path|url> (repeat)
  -p/--pri 1-4   -d/--due <epoch|ISO|+12h|+2d>   -f/--from <agent>   --project <p>   --stream <s>
  -r/--rule <key> (repeat)   --ok <rule>[:note]   --flag <rule>:<note>
  -t/--topic <slug>   --rel <id>[,<id>]   -w/--waiting <worker>[,<worker>]   (kept when a rewrite omits them)
  --why key="<one line>"   (decisions, repeat) what an option means or costs
  --opt-art key=[type:]<path|url>   (decisions, repeat) a sample of an option, previewed in its row
hd reply <id> "<text>"            append to the item's thread (also answers a request id)
hd resolve <id>...
hd waiting <id> [<worker>...]     who is blocked on it (none: clear); not an edit, nothing written if unchanged
hd batch                          stdin, one command per line, all-or-nothing validation
hd note <id|topic:slug> "<text>" [-a <path|url>]   keep a remark with its item or topic
hd topics [--json]                one line per topic
hd topic <slug> [--json]          the topic's timeline
hd answers [--cursor <name> | --since-offset <n>] [--json] [--peek] [--wait [--timeout <s>]]
hd ls [--all]
hd fleet|quota|rules <file|->     validate and install a snapshot
hd gap "<text>" [--sample <path|url>] [--item <id>]
hd validate [--json]
hd path
hd mcp

hd schedule <HH:MM|+30m|ISO|@epoch|reset> "<msg>" [--item <id>] [--request [--to <agent>]]
hd schedule list [--json] | cancel <id>
hd limit record | snapshot | set --reset <time> [--window <name>]
hd tick
hd scheduler status [--json] | on | off | config [...] | install [--no-load] | uninstall
```

The `schedule`/`limit`/`tick`/`scheduler` commands are the limit-reset scheduler: hold work until the usage limit resets, then wake the agent through a configurable command. See [`docs/SCHEDULER.md`](../docs/SCHEDULER.md).

Behaviour worth knowing:

- Writing an item with an existing id rewrites it, keeps `created`, `thread`, and `topic`/`rel`/`waiting` unless given again, sets `updated`, and reopens it.
- `hd note <id> "..."` appends to `notes.jsonl` with the item's topic; `hd note topic:<slug> "..."` notes a topic directly and creates it if new (`ok note topic:x (new topic)`). An unknown item id is an error: note the topic instead, or log a gap.
- `hd topic <slug>` prints one line per event (`MM-DD HH:MM`, local time): `+ <kind> <id> "<title>"`, `reply`, `you <action>`, `note`, `resolved`, after the open items. Long text is clipped; `--json` has it all.
- Relative paths are made absolute against the current directory. A missing file is a warning on stderr, not an error.
- Artifact type is inferred: `/pull/N` and `/merge_requests/N` URLs are `pr`, other URLs `link`; by extension `video`, `image`, `audio`, `report` (md, txt, pdf, html), `diff`, else `file`. Prefix to override: `-a image:https://...`.
- `-a web:<url>` shows a local page (dev server, local report) in the desk's browser pane. `-a lavish:<url>` does the same for a Lavish review page; `-a lavish:<file.html>` runs `lavish-axi <file> --no-open` to start or resume its session and stores the session URL (the path, with a warning, when `lavish-axi` is missing or `HARBORDECK_LAVISH=0`).
- `--opt key*` also marks a recommendation, but `+` is safe from shell globbing.
- An id shaped `<task>.q<N>` gets topic `<task>` when no `-t` is given (and none is kept from a rewrite), so a task's questions bundle into one question sheet on the desk.
- `hd answers --wait [--timeout <s>]` blocks until the app appends an answer, then prints it: an on-answer hook is `while :; do hd answers -c me --wait | my-handler; done`.
- `hd answers` without a cursor ends with `next=<offset>`; pass it back as `--since-offset`. `--json` returns `{"next", "lines": [{"end", "answer"}]}` with each line's end offset, for routers that commit per line.
- Everything is written atomically (temp file + rename); JSONL appends are one write per line.

The data format is specified in [`docs/CONTRACT.md`](../docs/CONTRACT.md) and [`schema/`](../schema).

## Tests

```sh
cd cli && npm test
```
