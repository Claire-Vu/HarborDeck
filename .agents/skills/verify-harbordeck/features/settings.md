# Settings

A person opens Settings (menu `Settings`, `⌘,`) and gets a paper sheet in four sections. **General**: the artifact folder (shown by name with its parent dimmed, `Choose…` opens the system folder picker, `Reset` falls back), web hosts the desk browser may show as chips, demo data. **Phone**: the ship-phone shortcut as keycaps (`⇧⌘Space`); click them, press the new keys, `Esc` cancels, `Off` clears. **Agent connection**: the data dir being read (and whether `HARBORDECK_HOME` overrides it) and the data folder picker. **Advanced** (folded unless the hook is on): the on-answer command with an on/off switch. `Save` writes every field to `<userData>/settings.json`; `Cancel` writes nothing.

## Sub-features

- `set-sections` regions `General`, `Phone`, `Agent connection`, plus the `Advanced` fold (`.set-adv`, open when the hook is on; its summary reads `on answer: on`).
- `set-reading` `.set-reading code` is the data dir being read; `Set by HARBORDECK_HOME…` when the env var wins; `(demo data)` in demo mode.
- `set-folder` `.fp-name` / `.fp-where` show a folder by name and parent; `Choose…` (system picker), `Reset` (only when set) clears it.
- `set-hosts` `.chip-in` (label `Add a web host`): Enter, comma or space adds a lower-cased chip; `Remove <host>` drops one; Backspace on an empty field drops the last; text left in the field at Save is kept.
- `set-shortcut` button `Phone shortcut: click, then press the keys` (`.kc`, `data-accel` = the accelerator): click → `Press keys…`; a modifier (⌘/Ctrl, ⌃, ⌥) plus a letter, digit, Space or F-key records it (Cmd on a Mac, Ctrl elsewhere, saves as `CommandOrControl`); a bare or Shift-only key is refused with a hint; `Esc` cancels only the recording; `Off` clears (top-bar icon only). Recording never opens the phone; the system-wide hotkey is let go meanwhile.
- `set-hook` `Run a command on every answer` switch + `On-answer command` field.
- `set-demo` `Load demo data` / `Restart demo` / `Back to my data`.
- `set-skipped` unreadable item files are listed at the top.

## How to get to it (user POV)

- Menu (`M` or `#btn-menu`) → `Settings` (`#btn-settings`).
- `⌘,` (Ctrl+, off macOS) from the app menu.

## Driving it with hdv + ui.mjs

Preconditions:

- Baseline instance, office opened, doctor `ok`. The profile's settings file is `$(dirname $HDV_HOME)/**/settings.json` (find it under the state dir).

- **Open.** `$U press m`, `$U click --css '#btn-settings'`, `$U wait --css '.modal.settings-modal'`; `$U text --css '.modal.settings-modal .set-h'` prints `GENERAL PHONE AGENT CONNECTION ADVANCED`.
- **Record a shortcut.** `$U click --role button --name 'Phone shortcut: click, then press the keys'` (`$U text --css .kc` → `Press keys…`), `$U press Meta+Shift+J`; `$U eval "document.querySelector('.kc').dataset.accel"` → `CommandOrControl+Shift+J`, `#phone` absent.
- **Hosts.** `$U fill --css '.chip-in' --value 'devbox.lan:8080'`, `$U press Enter`; a `.chip-host` appears.
- **Hook.** `$U click --css '.set-adv summary'`, `$U click --css '.set-switch'`, `$U fill --css '.set-cmd' --value '/bin/true'`.
- **Save.** `$U click --role button --name Save`; settings.json has the new `phoneShortcut`, `webHosts`, `onAnswer`; `$U press Meta+Shift+J` then `$U wait --css '#phone .phone-box'`.
- **Proof.** `$U shot` in each theme (`$U eval "document.documentElement.dataset.theme='light'"`), plus the settings.json contents.

## Gotchas

- Never click `Choose…` in a headless run: it opens a native folder picker. Set a folder with `window.harbor.setSettings` and check how it is shown instead.
- Headless runs never register the system-wide hotkey; recording is proven in-app (`ui.mjs press`).
- `Load demo data` swaps the data dir to the private demo copy; restart from baseline afterwards.
