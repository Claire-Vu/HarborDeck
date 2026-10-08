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

Agents that prefer tools to a shell can use the MCP server instead: `hd mcp` (stdio). It exposes `harbordeck_batch`, `harbordeck_answers` and `harbordeck_gap`. Claude Code: `claude mcp add harbordeck -- harbordeck mcp`.

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
hd reply <id> "<text>"            append to the item's thread (also answers a request id)
hd resolve <id>...
hd batch                          stdin, one command per line, all-or-nothing validation
hd answers [--cursor <name> | --since-offset <n>] [--json] [--peek] [--wait [--timeout <s>]]
hd ls [--all]
hd fleet|quota|rules <file|->     validate and install a snapshot
hd gap "<text>" [--sample <path|url>] [--item <id>]
hd validate [--json]
hd path
hd mcp
```

Behaviour worth knowing:

- Writing an item with an existing id rewrites it, keeps `created` and `thread`, sets `updated`, and reopens it.
- Relative paths are made absolute against the current directory. A missing file is a warning on stderr, not an error.
- Artifact type is inferred: `/pull/N` and `/merge_requests/N` URLs are `pr`, other URLs `link`; by extension `video`, `image`, `audio`, `report` (md, txt, pdf, html), `diff`, else `file`. Prefix to override: `-a image:https://...`.
- `--opt key*` also marks a recommendation, but `+` is safe from shell globbing.
- `hd answers --wait [--timeout <s>]` blocks until the app appends an answer, then prints it: an on-answer hook is `while :; do hd answers -c me --wait | my-handler; done`.
- `hd answers` without a cursor ends with `next=<offset>`; pass it back as `--since-offset`. `--json` returns `{"next", "lines": [{"end", "answer"}]}` with each line's end offset, for routers that commit per line.
- Everything is written atomically (temp file + rename); JSONL appends are one write per line.

The data format is specified in [`docs/CONTRACT.md`](../docs/CONTRACT.md) and [`schema/`](../schema).

## Tests

```sh
cd cli && npm test
```
