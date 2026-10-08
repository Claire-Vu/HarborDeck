# Ask and reply

A person asks a follow-up on an item; the question becomes a waiting ticket on the rail and an `ask` line in `answers.jsonl`; when the agent replies into the item's thread the ticket turns green and the reply reads in the ticket popover.

## Sub-features

- `ask-slip` key `4` (or the Ask stamp) opens a note slip; `Send` writes an `ask` line with the note.
- `ask-ticket` the ask clips to the rail as `.ticket.waiting`.
- `ask-reply` `hd reply <id> "<text>"` appends to the item thread; the ticket becomes `.ticket.replied.new`.
- `ask-read` clicking the ticket opens `.tk-pop` with the reply text.

## How to get to it (user POV)

- Select an item, press `4` or click the `Ask follow-up` stamp, type, press `Send`.
- Press `t` to focus the rail, or click a ticket.

## Driving it with hdv + ui.mjs

Preconditions:

- Baseline instance, office opened, doctor `ok`.
- `Quarantine the flaky drag-and-drop test?` (`flaky-e2e`) is open with no ask yet.

- **Ask.** Run `$U click --css '#queue li' --text 'Quarantine the flaky'`, `$U press 4`, `$U fill --css '.modal.noteslip textarea' --value 'how often does it fail locally?'`, `$U click --role button --name Send --exact`. Within a second `answers.jsonl` ends with `{"id":"flaky-e2e","action":"ask","note":"how often does it fail locally?",...}` (asks are not held).
- **Ticket.** Run `$U wait --css '#rail .ticket.waiting' --text 'Quarantine'`, then `$H capture ask-reply asked`.
- **Agent reply.** Run `$H hd reply flaky-e2e "Never locally; only on the slow runner."`. Stdout `ok reply flaky-e2e`; `$U wait --css '#rail .ticket.replied.new' --text 'Quarantine'` succeeds.
- **Read.** Run `$U click --css '#rail .ticket.replied.new' --text 'Quarantine'` and `$U text --css '.tk-pop'`. It contains `only on the slow runner`.
- **Proof.** Run `$H capture ask-reply replied`; `items/flaky-e2e.json` has the reply as the last `thread` entry.

## Gotchas

- `newsletter-6` already has a replied ask in the seed, so one `.ticket.replied` exists at baseline; filter by `--text`.
- The ticket title comes from the item; filter on a distinctive word.
- A reply is matched to the ask by time; a reply in the same second still counts.
