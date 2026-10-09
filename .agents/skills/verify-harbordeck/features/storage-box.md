# Storage box

A small wooden paper tray at the foot of the stamp tray holds papers stowed off the desk, to declutter it. Stowed papers leave the desk (the rest close up) and stand in the tray as a pile of sheets tinted by kind (empty tray: no sheets; up to 6 show, each one higher); the box shows a count, and they come back from the box's view. Per item, kept in desk state across reloads.

## Sub-features

- `stow-control` the `.stow-btn` (aria-label `Stow this paper`) on a paper's grip, key `x` (last-raised paper, else the reading paper), or dragging a grip onto `#stow-box` (`.drop` while over it). The paper animates into the box, then `#desk-surface .paper[data-pid]` is gone.
- `stow-count` `#stow[data-n]` and `#stow-n` = stowed papers of the item at the desk; `#stow-box` aria-label `Storage box: <n> stowed`.
- `stow-pile` `#stow-stack .leaf` = one sheet per stowed paper (last 6), class = paper kind (`manifest`, `report`, `photo`, `monitor`, `prcard`, `thread`).
- `stow-restore` click `#stow-box` -> `#stow-view` (fixed popover beside the tray, above it when narrow) with `.stow-card[data-pid]` per paper: a `.paper.mini` copy (inert, no buttons, video/iframe/audio swapped for placeholders) plus its label; click a card to bring it back at its dragged position (clamped into the desk); the view stays open on the rest. `.all` ("Bring all back", with 2+) or `Shift+X` brings every one back. Esc, `×`, a click outside or hiding the tray closes it. Empty box click: toast, no view.
- `stow-persist` `desk.stowed[itemId][pid]` in the desk localStorage state; survives reload.

## How to get to it (user POV)

- Open the office, press `X` or click a paper's small stow button, or drag a paper by its grip onto the tray; watch it slide in.
- Click the tray to see the stowed papers; click one to restore it, or `Bring all back` / `⇧X` for all.

## Driving it with hdv + ui.mjs

Preconditions:

- Baseline instance, office opened, doctor `ok`.
- A decision with several papers is at the desk (`$U click --css '#queue li' --text 'Merge PR 142'`).

- **Before.** Run `$H capture storage-box before`. `$U text --css '#stow-n'` prints nothing (empty tray).
- **Key.** `$U press x`; `$U text --css '#stow-n'` prints `1`.
- **Button.** `$U click --css '#desk-surface .paper .stow-btn'`; `#stow-n` prints `2`; `$U eval "document.querySelector('#stow-box').getAttribute('aria-label')"` prints `Storage box: 2 stowed`; `$U eval "[...document.querySelectorAll('#stow-stack .leaf')].map(e=>e.className)"` lists two kinds.
- **Drag.** `$U drag --css '#desk-surface .paper:not([data-pid=ask]) .grip' --to '#stow-box'`; `#stow-n` prints `3`.
- **Slip stays.** `$U drag --css '#desk-surface .paper[data-pid=ask] .grip' --to '#stow-box'`; the count is unchanged and the slip is still on the desk.
- **View + restore one.** `$U click --css '#stow-box'`, `$U wait --css '#stow-view .stow-card .paper.mini'`, `$H capture storage-box view`; `$U click --css '#stow-view .stow-card'`; the count drops by one, the paper is back on the desk and the view stays open.
- **Bring all.** `$U press Shift+X`; `#stow-n` prints nothing and `$U eval "document.querySelector('#stow-view').hidden"` prints `true`.
- **Persist.** `$U press x`, then `$U reload`; `#stow-n` still prints the same count.
- **After.** Run `$H capture storage-box after`.

## Gotchas

- The decision slip (`data-pid="ask"`) is never stowable: no stow button, a drag onto the box is ignored, `x` skips it, the view never holds it.
- The count is per item: selecting another item shows that item's tray.
- Stowing writes nothing to `answers.jsonl`; the only stored proof is the desk localStorage state and the tray after a reload.
- Smoke: `test/smoke/stow.spec.js`.
