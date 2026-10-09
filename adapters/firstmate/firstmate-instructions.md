# HarborDeck: the captain's desk

<!-- Installed by HarborDeck adapters/firstmate/install.sh into the home's private data dir. Re-running install.sh rewrites this file. -->

The captain works from HarborDeck. Everything that needs the captain goes on the desk as an **item**, written with the `harbordeck` CLI (`hd` is the same command). The desk is a live view of `@HD_HOME@`; items appear the moment you write them. A long message is no substitute for an item.

Environment for every call: `HARBORDECK_FROM=@FROM@` (secondmates: your own endpoint id), `HARBORDECK_PROJECT=<repo>`@HOME_ENV@. Run from the firstmate home so relative report paths resolve.

## What becomes an item

| Captain must... | Kind | Command |
|---|---|---|
| pick between options (every captain hold with choices) | decision | `harbordeck decision <task-id> "<question?>" -s "<one line>" --opt <key>+ --opt <key>="<Label>" --why <key>="<what it means or costs>" [-b <report>]` |
| judge finished work (PR, video, design, draft) | review | `harbordeck review <task-id> "<title>" -s "<one line>" -a <pr url or file>` |
| review a plan you presented with Lavish | decision or review | add `-a lavish:<session url>` (or `-a lavish:<file.html>`; the CLI finds the session URL) |
| read a finished report | answer | `harbordeck answer <task-id> "<title>" -s "<finding, 1-3 sentences>" -b data/<task>/report.md` |
| do something only they can (log in, pay, sign, grant access) | todo | `harbordeck todo <id> "<what>" -s "<why>" -d <due>` |

- **A captain hold and its item share one id: the held task id.** Raise the hold with `bin/fm-captain-hold.sh hold` as usual, then write the item. The bridge answers that exact hold when the captain stamps it.
- **Always set `-t <topic>`**: a short slug for the subject (the project feature, release, vendor, or the task family), reused by every item about it; add `--rel <id>,<id>` for related items in other topics. Items sharing a topic or link reach the captain as one bundle. `harbordeck topics` lists existing topics: reuse one before inventing a new one.
- `+` marks your recommendation. Give each option a `--why <key>="<few words>"` (what it means or costs) so the captain can decide without opening the report. `-s` is plain sentences. `-b`/`-a` take paths or URLs only; never paste report text.
- A hold with several questions: one decision per question, ids `<task-id>.q1`, `.q2`, ..., all with `-t <task-id>` (the CLI sets that topic for a `.qN` id when you omit `-t`), so they reach the captain as one question sheet answered with one stamp. Those answers arrive as inbox notes; once all are in, close the hold with `bin/fm-captain-hold.sh answer`.
- Presenting a Lavish plan: always attach it with `-a lavish:<url>` so the captain can annotate it inside the desk. Keep polling Lavish for the feedback as usual; the desk stamp is the verdict, Lavish carries the annotations.
- Several items: `harbordeck batch` with one command per line on stdin (one process, all or nothing).
- Priority `-p 1`..`4` (1 = blocks work now); due `-d +2d` or an ISO date.
- Standing orders from captain.md: `--ok <rule>` when an item complies, `--flag <rule>:<why>` when it does not.

## Mentions go on the item, not only in chat

Whenever you tell the captain (chat, status, summary) anything about an existing item or topic, also attach it:

```sh
harbordeck note <id> "<one or two sentences>" [-a <path|url>]     # about one item
harbordeck note topic:<slug> "<text>"                             # about the subject; a new slug creates the topic
```

It lands live on the topic page and the item's correspondence, so it is not lost in the scroll. Before acting on a topic, `harbordeck topic <slug>` gives its timeline (open items, stamps, replies, notes). If a remark belongs to no item or topic, `harbordeck gap "<what and why>"` instead.

## Answers come back by themselves

The HarborDeck bridge (launchd job `dev.harbordeck.firstmate`) routes every stamp the moment it lands:

- decide / approve / reject on a held task: a keyed answer through `bin/fm-captain-hold.sh answers --source harbordeck` (closes the hold); `needs-work` releases the hold and also sends an inbox note.
- defer (the captain's **Later** stamp) on a held task, or on a `<task-id>.qN` question of one: `bin/fm-captain-hold.sh hold <task-id> --until <date>`, the date the item comes back on the desk. Park that work until then; the item stays open.
- ask / comment / request, and stamps on items that are not held tasks: an inbox note starting `HarborDeck <action> on <id>`, ending with the exact reply command.

Answer every ask with `harbordeck reply <id> "<text>"`; the reply lands on the captain's ticket rail. When a hold closes another way (chat, terminal), run `harbordeck resolve <id>` so the desk matches.

## When a response fits no item

Still write the closest item if one helps, then log the gap so HarborDeck can grow:

```sh
harbordeck gap "<what did not fit and why>" [--item <id>] [--sample <path>]
```

Examples: a live progress feed, a ranking, a form with many fields, a calendar, a multi-question hold.

## Keep it cheap

One short line per item (about 50 tokens), one note about 20, one `ok` line back. Batch a whole reply, notes included. Never `cat` answers.jsonl; the bridge reads it for you.
