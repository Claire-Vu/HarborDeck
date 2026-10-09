# Ask and reply

A person asks a follow-up on an item; the question becomes a waiting ticket on the rail and an `ask` line in `answers.jsonl`; when the agent replies into the item's thread the ticket turns green and the reply reads in the ticket popover.

## Sub-features

- `ask-slip` key `4` (or the Ask stamp) opens a note slip; `Send` writes an `ask` line with the note.
- `ask-ticket` the ask clips to the rail as `.ticket.waiting`; its `.tk-foot` reads `awaiting reply · <age>`.
- `ask-reply` `hd reply <id> "<text>"` appends to the item thread; the ticket becomes `.ticket.replied.new` reading `● new reply` (`✓ replied` once opened). Unread replies sit first on the rail, the newest first.
- `ask-read` clicking the ticket opens `.tk-pop` with the reply text; `t` focuses the newest unread reply.
- `ask-space` `Space` on an item whose reply is unread opens that reply (`.tk-pop`, toast `New reply: read it, then Space stamps.`) and writes nothing; the next `Space` stamps.

## How to get to it (user POV)

- Select an item, press `4` or click the `Ask follow-up` stamp, type, press `Send`.
- Press `t` to focus the rail, or click a ticket.

## Driving it with hdv + ui.mjs

Preconditions:

- Baseline instance, office opened, doctor `ok`.
- `Quarantine the flaky drag-and-drop test?` (`flaky-e2e`) is open with no ask yet.

- **Ask.** Run `$U click --css '#queue li' --text 'Quarantine the flaky'`, `$U press 4`, `$U fill --css '.modal.noteslip textarea' --value 'how often does it fail locally?'`, `$U click --role button --name Send --exact`. The undo chip shows; after the 4 s hold (`$U wait --css '.toast.undo' --gone --timeout 7000`) `answers.jsonl` ends with `{"id":"flaky-e2e","action":"ask","note":"how often does it fail locally?",...}` and the ticket appears.
- **Ticket.** Run `$U wait --css '#rail .ticket.waiting' --text 'Quarantine'`, then `$H capture ask-reply asked`.
- **Agent reply.** Run `$H hd reply flaky-e2e "Never locally; only on the slow runner."`. Stdout `ok reply flaky-e2e`; `$U wait --css '#rail .ticket.replied.new' --text 'Quarantine'` succeeds.
- **T.** `$U press Escape`, `$U press t`, then `$U eval 'document.activeElement.textContent'`: it contains `Quarantine` (the newest reply, ahead of the seed's `Newsletter #6`).
- **Space reads first.** `$U click --css '#queue li' --text 'Quarantine the flaky'`, `$U press ' '`: `.tk-pop` contains `only on the slow runner`, no `.toast.undo`, `answers.jsonl` unchanged. `$U press Escape` closes it.
- **Read.** Run `$U click --css '#rail .ticket.replied' --text 'Quarantine'` and `$U text --css '.tk-pop'`. It contains `only on the slow runner`.
- **Proof.** Run `$H capture ask-reply replied`; `items/flaky-e2e.json` has the reply as the last `thread` entry.

## Gotchas

- `newsletter-6` already has a replied ask in the seed, so one `.ticket.replied` exists at baseline; filter by `--text`.
- The ticket title comes from the item; filter on a distinctive word.
- A reply is matched to the ask by time; a reply in the same second still counts.
