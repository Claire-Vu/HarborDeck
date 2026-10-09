# Architecture

How Harbor Deck is put together and where new code goes. Data formats: [CONTRACT.md](CONTRACT.md). Scheduler: [SCHEDULER.md](SCHEDULER.md).

## Process model

```
 agents ──items/*.json──▶  data dir  ◀──answers.jsonl── (app only appends)
                              │  ▲
                    watch.js  │  │ appendAnswer
                              ▼  │
 ┌────────────── main (app/main.js, Node) ──────────────┐
 │ store · watch · settings · hook · harbor:// · IPC    │
 │ web-pane (WebContentsView, own session)              │
 └───────▲──────────────────────────────────▲───────────┘
         │ ipcMain.handle / .on             │ separate view, no bridge
 ┌───────┴────────┐  contextBridge   ┌──────┴──────────────────┐
 │ preload.js     │ ───────────────▶ │ renderer (app/renderer) │   browser pane
 │ window.harbor  │                  │ sandboxed, no node      │   (persist:harbor-web)
 └────────────────┘                  └─────────────────────────┘
```

- **main** (`app/main.js`, `app/lib/`): owns the data dir, the watcher, settings, the on-answer hook, the `harbor://` protocol, menu, the ship-phone shortcut, demo mode. Imports the CLI's `scheduler.js` and `topics.js` so app and `harbordeck tick` share one queue format. `store.js` is pure Node (unit-testable, no Electron).
- **preload** (`app/preload.js`): the only door. Every method is a narrow IPC call; add a bridge method here and a matching `ipcMain` handler, nothing else.
- **renderer** (`app/renderer/`): plain HTML/CSS/JS, no framework, no build step. Scripts attach to `window` and are loaded by `<script>` tags in `index.html`.
- **browser pane** (`app/lib/web-pane.js`, `web-allow.js`, renderer `web-pane.js`): a `WebContentsView` laid over a mount box. Own session partition, no preload, all permissions denied, downloads cancelled.

## Data dir and contract flow

`$HARBORDECK_HOME`, else Settings, else `~/.harbordeck/`.

1. **In**: agents write `items/<id>.json` (plus optional `fleet.json`, `quota.json`, `rules.json`, `gaps.jsonl`, `notes.jsonl`). `watch.js` coalesces fs events (with a stat-poll backup); main rebuilds the snapshot and sends `harbor:update`. Unreadable files are skipped and listed in Settings.
2. **Out**: a stamp, question or order is one line appended to `answers.jsonl` via `harbor:answer`. Stamps are held ~4 s in the renderer for Undo; a held line is flushed synchronously on unload. The app never writes items; agents never write `answers.jsonl`.
3. **Bridges**: [`adapters/`](../adapters) (firstmate, claude-code) and the `harbordeck`/`hd` CLI ([`cli/`](../cli)) are the agent side. They read `answers.jsonl` by cursor, write items, and the optional *On answer* hook (`app/lib/hook.js`) wakes an agent per line. The scheduler (`cli/src/scheduler.js`, launchd tick) delivers queued orders after a limit reset.

Schemas live in [`schema/`](../schema); change a field there and in CONTRACT.md together.

## Renderer layout: where a new feature goes

`app/renderer/app.js` is the desk shell and is **frozen**: it is grandfathered at its current size and must not grow. A new feature is a new module:

1. Create `app/renderer/<feature>-view.js` (specific name; no `utils`/`helpers`). Expose one object on `window` (`window.harborFeature = (() => {...})()`), take what it needs from `app.js` as arguments (`h`, `modal`, `toast`, the snapshot) instead of reaching into desk state.
2. Add a `<script>` tag before `app.js` in `index.html`, and the file to `npm run check`.
3. Call it from `app.js` with a one-line hook. Style goes in `styles.css` (a split is planned; keep new rules grouped under a comment header).
4. Pure logic with no DOM goes in a unit-testable file with a `test/unit/` test (see `stamina.js`, `harbor-game.js`).

Source files must stay under 400 non-blank lines (`test/unit/file-size.test.js`, mirroring the garden rule); the grandfathered ceilings can only go down.

## Security rules

- `BrowserWindow`: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`. Never loosen these.
- The renderer loads only `file://` (own app files). Popups are denied; any navigation off `file://` is cancelled and opened in the system browser (`http(s)` only).
- **Web-pane allow-list** (`web-allow.js`): `http(s)` to loopback, or hosts the user lists in Settings; no credentials in URLs. Everything else goes to the system browser. The pane has no preload, no node, permissions denied, its own `persist:harbor-web` session.
- **`harbor://`**: `harbor://file/...` serves only files referenced by current items (path in the snapshot's allow set); text and SVG get a `default-src 'none'` CSP. `harbor://page/...` exists in the pane's session only and serves a referenced local `.html` and its folder, never hidden files or folders. Both support Range.
- IPC handlers validate their input; `open-path` and `open-external` check the allow set / URL scheme.
- Public repo: no private data or secrets in code, fixtures or docs. Demo content is synthetic.

## Testing rules

- Unit: `npm test` (`node --test test/unit`), then the garden gate. CLI: `(cd cli && npm test)`.
- Smoke: `npm run test:smoke` drives the real app with Playwright.
- **Start the app only through `launchApp()` in `test/smoke/launch.js`.** It is headless by default (`HARBORDECK_HEADLESS=1`: no window, focus or Dock icon, still paints for screenshots) and isolates `HARBORDECK_HOME` and `HARBORDECK_USER_DATA`. `test/unit/no-direct-launch.test.js` fails any other launcher. `HARBORDECK_HEADLESS=0` is the explicit opt-in to watch.
- Tests use synthetic data dirs (`app/demo/seed.js`), never the real `~/.harbordeck`.
- Full proof of an agent round trip: the `verify-harbordeck` skill (`.agents/skills/verify-harbordeck`).

## CI

`.github/workflows/ci.yml` runs on push and PR to `main` (macOS): `npm ci`, `npm test`, `npm run check`, headless smoke suite, `npm audit --audit-level=high`. The ystack garden library is private, so `npm run garden` skips itself in CI; its file-growth rule is enforced there by `test/unit/file-size.test.js`. Run garden locally when installed.
