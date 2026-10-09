# Desk walk

One pass through every desk area as a person uses it, for changes that touch the renderer as a whole (a split, a shared helper, boot order). Each area must still open, act and write the same `answers.jsonl` line it did before.

## Sub-features

- `walk-boot` a fresh profile opens on the Morning manifest; `Open the office` fills the desk.
- `walk-queue` clicking a queue item puts it on the desk; `n` walks the line; arrows flip scenes.
- `walk-stamp` key `1` holds a `decide` line 4 s then writes it; `u` during the hold writes nothing; `s` writes `defer`.
- `walk-ask` key `4` + note writes `ask` and clips a waiting ticket; an agent `hd reply` flips it to replied live.
- `walk-stow` `x` stows a paper, the box opens its view, `Shift+X` brings all back.
- `walk-inspect` `i`, a claim, an order in the drawer, `Match` is held for undo (`.toast.undo`), then writes a `comment` line.
- `walk-records` menu Agent log and Archive show the written lines and the filed item; `Cmd+K` search opens an item.
- `walk-modes` plain mode (`p`), chandlery (`Shift+B`), Ships out (`l`), Settings, ship phone order (`request` line), queue for after reset while an agent writes quota.json (the queued ticket stays), theme.
- `walk-reload` a reload keeps the office open and the filed item gone; no page errors throughout.

## How to get to it (user POV)

- Every entry point above is the ordinary one: keys, the header menu (`M`), the header phone icon, the queue and the desk.

## Driving it with hdv + ui.mjs

Preconditions:

- Fresh baseline instance (`$H cleanup && $H launch`), doctor `ok`, office not yet opened.

- **Flow walk.** `.agents/skills/verify-harbordeck/scripts/flow-walk.sh <dir>` on a fresh baseline drives the busy-captain flow (scene follows the desk, All stays All, fast Space, unread reply first, ticket wording, T, rail overflow, empty list, manifest, slip draft, phone dial, Inspect undo, far timed order, `hd --help`); it ends `--- 23 pass, 0 fail`.
- **Walk.** Run `.agents/skills/verify-harbordeck/scripts/desk-walk.sh [dir]`. It prints `PASS`/`FAIL` per step and ends `--- N pass, 0 fail`; `walk.log` and `01-manifest.png` ... `11-narrow.png` land in `dir` (default `$H evidence desk-walk`).
- **Proof.** Each stamp step checks the line in `$HDV_HOME/answers.jsonl`, not the toast; the reply step goes through `$H hd reply`; the error steps read a page error collector installed at boot and after the reload.

## Gotchas

- Run it on a fresh instance: it expects the seed (`Merge PR 142`, `Pick a logo direction`, `Quarantine the flaky ...`) open and the office closed.
- `ArrowRight` filters the queue to one kind; the walk clicks the `All` chip before picking an item of another kind.
- It never clicks anything that opens the system browser.
