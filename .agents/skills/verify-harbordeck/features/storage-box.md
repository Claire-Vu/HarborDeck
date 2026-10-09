# Storage box

The decision slip (`data-pid="ask"`) is never stowable: no stow button, drag onto the box is ignored, `x` skips it, the list never holds it. A small wooden document tray at the foot of the stamp tray holds papers stowed off the desk, to declutter it. Stowed papers leave the desk (the rest close up) and stand in the tray as a pile of sheets tinted by kind (empty tray: no sheets; up to 6 show, each one higher); the box shows a count, and they come back from the box's view. Per item, kept in desk state across reloads.

## Sub-features

- `stow-control` the `.stow-btn` on a paper's grip, key `x` (last-raised paper, else the reading paper), or dragging a grip onto `#stow-box` (`.drop` while over it). The paper animates into the box, then `#desk-surface .paper[data-pid]` is gone.
- `stow-count` `#stow[data-n]` and `#stow-n` = stowed papers of the item at the desk; `#stow-box` aria-label `Storage box: <n> stowed`.
- `stow-pile` `#stow-stack .leaf` = one sheet per stowed paper (last 6), class = paper kind (`manifest`, `report`, `photo`, `monitor`, `prcard`, `thread`).
- `stow-restore` click `#stow-box` -> `#stow-view` (fixed popover beside the tray, above it when narrow) with `.stow-card[data-pid]` per paper: a `.paper.mini` copy (inert, no buttons, video/iframe/audio swapped for placeholders) plus its label; click a card to bring it back at its dragged position (clamped into the desk); the view stays open on the rest. `.all` ("Bring all back", with 2+) or `Shift+X` brings every one back. Esc, `×`, a click outside or hiding the tray closes it. Empty box click: toast, no view.
- `stow-persist` `desk.stowed[itemId][pid]` in the desk localStorage state; survives reload.

## How to get to it (user POV)

Open the office, press `X` or click a paper's small stow button, watch it slide into the tray; click the tray to see the stowed papers and click one to restore it.

Smoke: `test/smoke/stow.spec.js`.
