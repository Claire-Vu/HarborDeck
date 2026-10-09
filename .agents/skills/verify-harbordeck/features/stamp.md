# Stamp items

A person picks an item at the window and stamps it; after a 4 second undo hold the app appends exactly one line to `answers.jsonl`, and an undone stamp writes nothing.

## Sub-features

- `stamp-decide` key `1` on a decision writes `decide` with the recommended option's `key`.
- `stamp-approve-file` key `1` on a review writes `approve`; on an answer or todo writes `file`.
- `stamp-reject` key `2` writes `reject`.
- `stamp-needswork` key `3` opens a note slip; `Send` writes `needs-work` with the note.
- `stamp-tray` the `#stamps` tray buttons do the same as the keys; the fifth, `Later`, writes `defer` (see quick-call.md).
- `stamp-undo` `u` or `z` (or the chip's `Undo`) during the hold drops the line. The hold starts at the key press: an undo during the ~0.4 s stamp flight, before the chip shows, cancels too.
- `stamp-log` the Agent log drawer shows the written lines and a held line.

## How to get to it (user POV)

- Click an item in the window queue, then press `1`-`4` (or Space for `1`).
- Click a stamp in the stamp tray (`Tab` toggles the tray).
- Open the menu (`M`) and pick `Agent log` to see what was sent.

## Driving it with hdv + ui.mjs

Preconditions:

- Baseline instance, office opened, doctor `ok`.
- `Merge PR 142 (calmer checkout)?` and `Pick a logo direction` are open.

- **Before.** Run `$H capture stamp before`.
- **Select.** Click the PR item. Run `$U click --css '#queue li' --text 'Merge PR 142'`. `$U text --css '#desk-surface .paper.manifest h3'` prints `Merge PR 142 (calmer checkout)?`.
- **Stamp.** Press `1`. Run `$U press 1` then `$U wait --css '.toast.undo'`. The undo chip (`Undo U`, bottom-right, no text about the decision) shows and `answers.jsonl` has no new line yet (`wc -l "$HDV_HOME/answers.jsonl"` unchanged).
- **Hold elapses.** Wait 5 s. The last line of `$HDV_HOME/answers.jsonl` is `{"id":"pr-142-checkout","action":"decide","key":"merge",...}`.
- **Undo.** Select `Pick a logo direction`, press `2`, then `u` within 4 s. Run `$U click --css '#queue li' --text 'Pick a logo'`, `$U press 2`, `$U wait --css '.toast.undo'`, `$U press u`. After 5 s `answers.jsonl` is byte-identical to before.
- **Quick undo (in flight).** Select `Rename the repo`, then `$U press 2` and `$U press u` back to back (the second key lands well inside the flight). After 5 s `answers.jsonl` is byte-identical, the item is still at the desk and in the queue, and no `.toast.undo` remains.
- **Tray.** Select another decision or review (answers and to-dos have no reject stamp) and click a tray stamp. Run `$U click --css '#stamps .stamp[data-verdict=reject]'`. A `reject` line lands after the hold.
- **Log.** Run `$U click --css '#btn-menu'`, `$U click --role menuitem --name 'Agent log'` and `$U text --css '#log-lines'`. It lists the same lines as the file.
- **Proof.** Run `$H capture stamp after` and save the diff of `answers.jsonl` in `proof.md`.

## Gotchas

- The hold is about 4 s; assert the file after 5 s, never right after the key.
- Keys do nothing while a textarea, input or modal has focus, and nothing on a fresh profile until `Open the office` closes the manifest.
- After a stamp the desk moves to another item (~1.4 s in) unless you select something else first; a pick made during the hold/animation wins (covered by `test/smoke/stamp-select-race.spec.js`). Undo during the hold still restores the stamped item.
- Closing the app flushes a held line; cleanup during a hold can write it.
