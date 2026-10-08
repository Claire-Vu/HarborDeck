# Requests

A person writes a new order in the Requests tab and hands it to a first mate; it becomes a `request` line in `answers.jsonl` and an order ticket; the agent answers by writing an item whose id is the request id.

## Sub-features

- `request-send` `Send now` (or Cmd/Ctrl+Enter) writes `{"action":"request","note",...,"to"}` immediately (no undo hold).
- `request-mate` the mate picker sets `to` (defaults to the first first mate).
- `request-ticket` the order clips to the rail as `ORDER` `.ticket.waiting` and lists under `On the counter`.
- `request-reply` `hd reply <request-id> "<text>"` creates an `answer` item with that id; the ticket turns replied.

## How to get to it (user POV)

- Left `Requests` tab, type in the order slip, press `Send now`.

## Driving it with hdv + ui.mjs

Preconditions:

- Baseline instance, office opened, doctor `ok`.

- **Write and send.** Run `$U click --css '.tab[data-tab="requests"]'`, `$U fill --css '#requests-pane textarea' --value 'Add a dark theme'`, `$U click --role button --name 'Send now'`. `answers.jsonl` ends with `{"id":"req-<epoch>-<n>","action":"request","note":"Add a dark theme","to":"mate-main",...}`.
- **Ticket.** Run `$U wait --css '#rail .ticket.waiting' --text 'Add a dark theme'`.
- **Agent answers.** Read the id from the last line, run `$H hd reply <req-id> "Dark theme shipped behind a toggle."`. `$U wait --css '#rail .ticket.replied' --text 'Add a dark theme'` succeeds and `items/<req-id>.json` exists with kind `answer`.
- **Proof.** Run `$H capture requests after`.

## Gotchas

- The request id is minted by the app from the time and note; read it from `answers.jsonl`, never guess.
- The seed already has one sent order (`what changed since last visit`); filter tickets by text.
