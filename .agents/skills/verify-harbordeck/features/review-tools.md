# Review tools

Three helpers for getting through the desk: a `⏸ N` badge counts the workers paused until the captain answers an item and lifts it in the queue; when an agent rewrites an item the captain already looked at, the queue marks it `updated` and the desk lights only the new parts, cleared once seen; and Cmd/Ctrl+K opens a search palette over every item (open, parked, filed), topic and note.

## Sub-features

- `rt-waiting` `.waitn` on queue rows, the desk manifest and plain cards; its title names the workers; count = item `waiting` plus `fleet.json` crew in state `waiting` whose `item` is the id; each worker lifts the item one priority step.
- `rt-waiting-cli` `hd ... -w <a>,<b>` sets it, rewrites keep it, `hd waiting <id> [<worker>...]` replaces it (none clears) without bumping `updated`; unchanged lists write nothing.
- `rt-waiting-fleet` firstmate's `hd-fleet.sh` (every `hd-live` refresh) sets each open item's `waiting` to the crew blocked/paused/parked on it by id, task id, `<task>.qN` or topic.
- `rt-updated` a read item rewritten by an agent shows `.upd` "updated" on its queue row, plain card and rail ticket; `waiting` changes alone never count.
- `rt-lit` at the desk: `.chg-note` lists what changed; `.paper.manifest h3.chg` (title, `title="was: ..."`), `.claims .fact.chg` (new sentences only), `.paper.ask .chg` (new or relabelled options), `.paper.chg` (new artifact papers, grip label `new`), `.paper.thread .msg.chg` (new replies and notes), `.paper.dispatch .md .chg` (new body lines, also in the Read viewer).
- `rt-clear` stepping to another item and back shows no `.chg`; reload clears highlights too.
- `rt-search` Cmd/Ctrl+K or menu `Search` opens `.modal.search`: `.sr-in` focused, `.sr-row.item|.topic|.note`, `aria-selected` row; type to filter (fuzzy on titles, ids, topics; substring on summaries and note text), arrows move, Enter opens (item at the desk, filed item in the viewer, topic page, a note's item), Esc or Cmd/Ctrl+K closes; never opens while the ship phone is up.

## How to get to it (user POV)

- Look at the queue: badges on rows; `updated` on rewritten rows.
- Agent side: `hd waiting <id> <worker>...`, `hd <kind> <id> ... -w <worker>`, or a rewrite of an existing item.
- Press Cmd+K (Ctrl+K off macOS), or `M` then `Search`.

## Driving it with hdv + ui.mjs

Preconditions:

- Baseline instance, doctor `ok`, office opened.

- **Before.** Run `$H capture review-tools before`.
- **Waiting.** `$U text --css '#queue li .waitn'` prints `⏸1` for `Merge PR 142` and `Newsletter #6`. Run `$H hd waiting rename-repo hdv-a hdv-b hdv-c`; it prints `ok waiting rename-repo 3`; `$U wait --css '#queue li .waitn' --text '3'`; the row moves above the P2 items; `jq .updated "$HDV_HOME/items/rename-repo.json"` is unchanged.
- **What changed.** `$U click --css '#queue li' --text 'Pick a logo direction'`, then `$U click --css '#queue li' --text 'Merge PR 142'`. Rewrite with `$H hd decision logo-direction "Pick a logo direction (with D)" -s "Three directions, all original. D is B with a heavier stroke." --opt a --opt b+ --opt d -t logo`; `$U wait --css '#queue li .upd' --text 'updated'`; click the row; `$U text --css '#desk-surface .chg-note'` lists `title, 1 sentence, ...`; `$U text --css '#desk-surface .claims .fact.chg'` prints only the new sentence. Click another row and back: `$U eval "document.querySelectorAll('#desk-surface .chg').length"` is `0`.
- **Search.** `$U press Meta+k`; `$U fill --css '.sr-in' --value 'restore test numbers'`; `$U text --css '.sr-row[aria-selected=true]'` shows a `Note`; `$U press Enter`; the desk shows `Hosted Postgres: three options`. `$U press Meta+k`, `$U fill --css '.sr-in' --value '#launch'`, ArrowDown to the `Topic` row, Enter: the topic page opens.
- **Phone guard.** `$U click --css '#btn-phone'`, `$U press Meta+k`: no `.modal.search`; `$U press Escape`.
- **After.** Run `$H capture review-tools after`.

## Gotchas

- Highlights need an earlier look: an item never opened (unread dot) has nothing to compare, so a rewrite only shows on the second look. Read items from before this feature count as seen at first launch.
- Body lines compare as a set: moved lines are not news; bodies over 20 KB are not compared.
- Off macOS the key is `Control+k`. Inside the phone, Cmd/Ctrl+K is swallowed by design.
- `hd waiting` on a firstmate home is overwritten by the next `hd-fleet.sh` refresh; there the feed owns the field.
