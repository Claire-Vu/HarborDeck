---
name: harbordeck
description: Put work that needs the user (decisions, reviews, reports to read, things only they can do) on the HarborDeck desk with the `hd` CLI, read their answers back, and log responses that don't fit. Use whenever you would otherwise ask the user to choose, approve, read, or act, and HarborDeck is installed (`hd path` works).
---

# HarborDeck

The user works from HarborDeck, a desk app. Instead of writing a long message and waiting, turn each thing that needs them into one **item** with one short `hd` command, then read their **answers** back. Keep your own report files where they are; items only point at them.

## Pick the kind by what the user must do

| The user must... | Kind | Example |
|---|---|---|
| choose between options | `decision` | merge or hold, plan A or B |
| judge finished work | `review` | a video, a design, a draft |
| read and file | `answer` | research, a report, an explanation |
| do something only they can | `todo` | sign, pay, log in, renew a key |

Split a reply into one item per thing the user acts on. Information with no action at all needs no item.

## Write items (one line each)

```sh
hd decision <id> "<question?>" -s "<one line>" --opt <key>+ --opt <key>="<Label>" [--why <key>="<line>"]... [--opt-art <key>=<path|url>]... [-a <path|url>]... [-p 1-4] [-d +2d]
hd review   <id> "<title>" -s "<one line>" -a video:<path> -a pr:<url>
hd answer   <id> "<title>" -s "<the finding in 1-3 sentences>" -b <report.md>
hd todo     <id> "<what to do>" -s "<why, by when>" -d 2026-11-01
```

- `id`: a short stable slug; reuse the task id when the item stands for a task. Re-running a command with the same id rewrites the item (thread and created time are kept).
- `+` after an option key marks your recommendation. Labels default to the key.
- `-s`: plain sentences, no markdown. `-b`/`-a`: **paths or URLs only**. Never paste report text into a flag. Artifact type comes from the extension or URL; prefix to force it (`pr:`, `video:`, `image:`, `report:`).
- `-p` priority 1 critical … 4 low (default 3). `-d` due: epoch, ISO date, or `+12h`/`+2d`.
- Standing orders: `-r <rule>` to tag, `--ok <rule>[:note]` when you checked it passes, `--flag <rule>:<why>` when it does not.
- `-t <topic>`: a short slug for what the item is about; reuse it for everything on the same subject. `--rel <id>,<id>` links related items. Items sharing a topic reach the user together, as one question sheet; a `--rel` link does not bundle.
- Several questions on one task: ids `<task>.q1`, `<task>.q2`, ...; the CLI defaults their topic to `<task>`.
- `--why <key>="<few words>"`: what an option means or costs, shown under it, so the recommendation explains itself.
- `--opt-art <key>=<[type:]path|url>`: a sample of that option, previewed in its row: a thumbnail (image), a play button (audio/video), or an open link (web/html). Use it when options are things to see or hear (voices, logos, mockups) instead of pasting paths into the title. A local file must exist: a missing one fails the command (nothing is written).
- `-w <worker>,<worker>`: who is blocked until the user answers; the desk shows the count and puts the item earlier. Update it later with `hd waiting <id> [<worker>...]` (no workers clears it); that is not an edit.

## Keep later remarks with their item

When you learn or say something more about an existing item or topic, attach it instead of leaving it only in chat (one line, about 20 tokens):

```sh
hd note <id> "<one or two sentences>" [-a <path|url>]
hd note topic:<slug> "<text>"        # a topic with no item yet is created by its first note
hd topic <slug>                      # the topic's timeline, to catch up before you act
```

If it belongs to no item or topic, `hd gap` it.

Several items at once, one process, nothing written if any line is wrong:

```sh
hd batch <<'EOF'
decision pr24 "Merge PR 24?" -s "Bundles four fixes; CI green." --opt merge+ --opt hold -a https://github.com/o/r/pull/24
answer survey "B-roll tools survey" -s "Two free sources cover most shots." -b reports/broll.md
todo api-key "Renew the maps API key" -d +9d -t maps-api
note pr24 "CI rerun green after the cache fix."
EOF
```

## Read answers back

```sh
hd answers --cursor <your-name>     # only lines since your last read; prints nothing when there are none
```

Running as a long-lived loop? `hd answers --cursor <your-name> --wait` blocks until the user acts and returns the new lines immediately. Items you write show up on the running desk at once.

Each line is JSON: `{"id","action","key"?,"note"?,"anchor"?,"to"?,"at"}`. Act on it:

| action | do |
|---|---|
| `decide` | carry out option `key` |
| `approve` / `file` | done; move on |
| `reject` | stop that work |
| `needs-work` | redo per `note`, then rewrite the item |
| `ask` / `comment` | answer with `hd reply <id> "<text>"` |
| `request` | a new task for you (`to` = you); reply with `hd reply <id> "<text>"` or write an item with that `id` |

`hd resolve <id>` when an item no longer needs the user. `hd ls` lists open items.

## When a response doesn't fit

If what you need to show doesn't map onto these kinds (a live progress feed, a form with many fields, a ranking, a calendar...), still write the closest useful item if there is one, and log the gap so HarborDeck can grow:

```sh
hd gap "<what didn't fit and why>" [--item <id>] [--sample <path>]
```

## Keep it cheap

- One command per item; batch a whole reply. Output is one `ok` line per write.
- Never duplicate prose: summaries are 1-3 sentences, everything else is a path.
- Read answers with a cursor, never by dumping `answers.jsonl`.
- Data dir: `$HARBORDECK_HOME` (default `~/.harbordeck`). Set `HARBORDECK_FROM=<your id>` and optionally `HARBORDECK_PROJECT` once in your environment. Full contract: `docs/CONTRACT.md` in the HarborDeck repo.
