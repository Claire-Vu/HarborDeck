# Browser pane

An item can carry a `web` or `lavish` artifact; the desk shows it as a `Web page`/`Lavish plan` card and opens a loopback (or Settings-allowed) page inside the desk in a framed browser pane, while anything off the machine goes to the system browser instead.

## Sub-features

- `web-card` a `web`/`lavish` artifact renders as a card with the host and a `View` button.
- `web-open` `View` (or the page link) opens `.modal.web` with the address bar and the page in the pane.
- `web-interactive` the page is live: clicks and scripts work inside it.
- `web-controls` `←` Back, `↻` Reload, `Browser ↗`, `Full`/`Restore`, `Close` (removes the pane).
- `web-refused` a non-loopback URL not in Settings → Web hosts shows `.web-refused` with `Open in your browser`; no pane opens.
- `web-cli` `hd ... -a web:<url>` and `-a lavish:<file.html>` write those artifacts.

## How to get to it (user POV)

- Select an item with a web artifact (seed: `Review the offline-mode plan`), press `View` on its card.
- Agent side: `hd review <id> "<title>" -a web:http://127.0.0.1:<port>/page.html`.

## Driving it with hdv + ui.mjs

Preconditions:

- Baseline instance from `$H launch` (it serves `app/demo/assets/web` on a loopback port, `HDV_SITE`, and seeds `plan-offline` pointing at `${HDV_SITE}plan.html`), office opened, doctor `ok`.

- **Select.** Run `$U click --css '.tab[data-tab="window"]'` and `$U click --css '#queue li' --text 'offline-mode plan'`. `$U text --css '#desk-surface .paper.prcard'` shows `PLAN PAGE` and `127.0.0.1:<port>`.
- **Open.** Run `$U click --css '#desk-surface .paper.prcard button' --text View` and `$U wait --css '.modal.web'`. `$U text --css '.modal.web .web-addr'` prints `${HDV_SITE}plan.html`.
- **Page renders.** Run `$U text --pane --css h1`. It prints `Plan: offline mode for boards`.
- **Interact.** Run `$U click --pane --css '#s2'` and `$U text --pane --css '#count'`. It prints `1 notes pinned`.
- **Proof.** Run `$H capture browser-pane open`; `open.pane.png` shows the page, `open.png` the desk frame around it.
- **Close.** Run `$U click --css '.modal.web [aria-label=Close]'`, then `$U wait --css '.modal.web' --gone`; `$U text --pane --css h1` now fails with `no browser pane open`.
- **CLI entry.** Run `$H hd review hdv-web "Web artifact from the CLI" -a "web:${HDV_SITE}plan.html"`; the new item's card opens the same page.
- **Refused.** Run `$H hd answer hdv-ext "Outside page" -a web:https://example.net/`, select it, press `View`. `$U wait --css '.web-refused'` succeeds and `--pane` finds no page. Do not press `Open in your browser`.

## Gotchas

- The pane is a separate WebContentsView over the desk: desk screenshots and ARIA snapshots show an empty frame. Use `--pane` (and `capture`'s `.pane.png`) for the page itself.
- `Browser ↗`, `Open in your browser`, and off-machine links inside the page (`#ext` in the plan) call the system browser on the user's desktop. Never click them in a verification run; prove the refusal by the `.web-refused` state instead.
- `button Close` matches hidden drawer close buttons first; scope it with `.modal.web [aria-label=Close]`.
- `-a lavish:<file>` needs `lavish-axi` on PATH to resolve a URL; without it the artifact is a file card.
