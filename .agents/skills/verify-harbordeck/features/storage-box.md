# Storage box

A small crate at the foot of the stamp tray holds papers stowed off the desk, to declutter it. Stowed papers leave the desk (the rest close up), the box shows a count, and they come back from the box. Per item, kept in desk state across reloads.

## Sub-features

- `stow-control` the `.stow-btn` on a paper's grip, key `x` (last-raised paper, else the reading paper), or dragging a grip onto `#stow-box` (`.drop` while over it). The paper animates into the box, then `#desk-surface .paper[data-pid]` is gone.
- `stow-count` `#stow[data-n]` and `#stow-n` = stowed papers of the item at the desk; `#stow-box` aria-label `Storage box: <n> stowed`.
- `stow-restore` click `#stow-box` -> `#stow-list` buttons (`.stowed`, one per paper); click one to bring it back at its dragged position (clamped into the desk). `.all` ("Bring all back", with 2+) or `Shift+X` brings every one back.
- `stow-persist` `desk.stowed[itemId][pid]` in the desk localStorage state; survives reload.

## How to get to it (user POV)

Open the office, press `X` or click a paper's small stow button, watch it slide into the crate; click the crate to list and restore.

Smoke: `test/smoke/stow.spec.js`.
