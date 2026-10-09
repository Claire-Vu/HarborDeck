# Connect an agent, command line tool, updates

A fresh desk (empty data dir, setup never finished) opens on **Connect an agent** instead of the Morning manifest. It installs the `hd`/`harbordeck` command line tool into `~/.local/bin`, connects Claude Code (registers the `harbordeck mcp` server with `claude mcp add`), firstmate (runs `adapters/firstmate/install.sh`) or shows the snippets for any other agent. Every change is listed before the button that makes it. A status light shows when an agent last wrote to the data dir. Settings has the same entries plus the app version and a Check for updates button; the packaged app reports a newer GitHub release with a Download link (unsigned) or Restart to update (Developer ID-signed).

## Sub-features

- `first-run` `.modal.connect-modal` titled `Welcome to Harbor Deck: connect an agent` on an empty data dir with `onboarded` unset in the profile's `settings.json`; Skip for now / Done set `onboarded: true` and open the Morning manifest. A desk with items never shows it.
- `status-light` `.cn-status.none|live|recent|idle`: newest of `items/*.json`, `notes.jsonl`, `gaps.jsonl`, `fleet.json` (live under 10 min); `answers.jsonl` does not count. Updates live while the panel is open.
- `cli-install` `#cn-cli`: `#cn-cli-install` links `hd` and `harbordeck` in `~/.local/bin` (source checkout: to `cli/bin/harbordeck.js`; packaged: to the bundle's `cli/bin/hd-app`, which needs no Node); Uninstall removes only those links; a link to another install shows a Replace button; a real file is never touched; a PATH hint when the folder is not on PATH.
- `claude-code` `.cn-tabs` radio `Claude Code`: the plan lists `claude mcp add harbordeck -s user [-e HARBORDECK_HOME=<dir>] -- ~/.local/bin/harbordeck mcp`; `Connect Claude Code` links the CLI if needed, runs it, prints the output in `#cn-out`.
- `firstmate` radio `firstmate`: `#cn-fm-home` + Choose…, a launchd checkbox, the `install.sh` command; `Connect firstmate` runs it, the app reloads its settings (Artifact root = the firstmate home); install.sh's unrouted-answers stop becomes Deliver them / Skip them.
- `other-agent` radio `Other agent`: the AGENTS.md snippet, an `mcpServers` JSON block, a link to CONTRACT.md.
- `settings-rows` Settings > Agent connection > `Agents` (`Connect an agent…`, `Command line tool…`: opens with `#cn-cli.focus`) and Settings > General > `Version` (`.set-ver`, `#btn-update-check`).
- `updates` source checkout: Check for updates toasts `Updates come from git…`. Packaged: newer release -> `#toasts .toast.update` `Harbor Deck X is out.` + `Download` (unsigned; nothing downloaded) or `is ready.` + `Restart to update` (signed); no release -> warn toast `Could not check for updates: no release is published yet`.
- `menus` File > Connect an Agent…, App menu > Install Command Line Tool… and Check for Updates… (native menu: driven only by `test/smoke/onboarding.spec.js`).

## How to get to it (user POV)

- Start the app on an empty data dir: the setup opens by itself.
- File > Connect an Agent…, or Settings (⌘,) > Agents > Connect an agent… / Command line tool….
- App menu > Install Command Line Tool…; App menu > Check for Updates…, or Settings > Version > Check for updates.

## Driving it with hdv + ui.mjs

Preconditions:

- `$H launch --empty` (an empty data dir; the app gets a sandbox `HOME` at `$HDV_USERHOME` and a stub `claude` that logs to `$HDV_STATE/claude.log`), doctor `ok`, `eval "$($H env)"`. Never drive Install/Connect on an instance without the sandbox HOME.
- The whole walk is scripted: `.agents/skills/verify-harbordeck/scripts/connect-walk.sh` (launches, drives, captures `connect/<step>`, cleans up; exit 1 on any FAIL).

- **First run.** `$U wait --css '.connect-modal h2' --text 'Welcome to Harbor Deck'`; `$U wait --css '.cn-status.none'`.
- **Install the CLI.** `$U click --css '#cn-cli-install'`, `$U wait --css '#cn-cli' --text 'are linked in'`; `readlink "$HDV_USERHOME/.local/bin/hd"` is the checkout's `cli/bin/harbordeck.js`.
- **Uninstall.** `$U click --css '#cn-cli button' --text 'Uninstall'`; `$HDV_USERHOME/.local/bin` is empty.
- **Claude Code.** `$U wait --css '.cn-panel ul' --text 'claude mcp add harbordeck -s user'`; `$HDV_STATE/claude.log` does not exist yet; `$U click --role button --name 'Connect Claude Code'`, `$U wait --css '#cn-out.ok'`; `claude.log` holds `mcp add harbordeck -s user -e HARBORDECK_HOME=$HDV_HOME -- $HDV_USERHOME/.local/bin/harbordeck mcp` and the links are back.
- **Status light.** `HARBORDECK_HOME=$HDV_HOME $HDV_USERHOME/.local/bin/hd todo hdv-hello "Say hello" -t hdv-onboarding`; `$U wait --css '.cn-status.live' --text 'items/hdv-hello.json'`.
- **firstmate.** Make a stub home (`$HDV_STATE/fm/bin/fm-captain-hold.sh`, `fm-inbox.sh`, `fm-crew-state.sh`, empty executables; `$HDV_STATE/fm/data/`); `$U click --role radio --name firstmate`, `$U fill --css '#cn-fm-home' --value "$HDV_STATE/fm"`, `$U press Tab`, untick `$U click --css '.cn-panel .set-check'`; `$U click --role button --name 'Connect firstmate'`, `$U wait --css '#cn-out.ok' --text 'service: not installed'`; `fm/data/captain.md` has `{#harbordeck}`, the profile `settings.json` has `artifactRoot` = the stub home, no `$HDV_USERHOME/Library/LaunchAgents`.
- **Other agent.** `$U click --role radio --name 'Other agent'`; `.cn-panel` shows `"mcpServers"` and `hd decision`.
- **Done.** `$U click --css '.connect-modal footer button' --text 'Done'`; the Morning manifest shows; `settings.json` has `"onboarded": true`; after `$U reload` no `.modal.connect-modal`.
- **Settings.** `$U press m`, `$U click --css '#btn-settings'`; `#btn-update-check` -> toast `source checkout`; Save keeps `onboarded` and `artifactRoot`; `Command line tool…` opens `#cn-cli.focus`.
- **Packaged app.** Build with a local feed and run `node .agents/skills/verify-harbordeck/scripts/packaged-walk.cjs <evidence-dir>` (build commands in its header): first run, install links the bundle's `hd-app`, `hd --version` and `hd decision` with `PATH=/usr/bin:/bin` (no Node), the light turns live, a 9.9.9 feed shows `Harbor Deck 9.9.9 is out.` + Download with no `.zip` fetched, a 404 feed shows `no release is published yet`.

## Gotchas

- `hdv launch` (seeded) never shows the first run: it has items. Use `--empty`.
- In a source checkout the links point at `harbordeck.js`, which needs `node` on PATH; only the packaged app's `hd-app` runs without Node.
- The installer and the onboarding light read the app's login-shell PATH; the PATH hint in `#cn-cli` names the folder to add.
- Evidence for a public commit shows the CLI and install.sh paths of the checkout it ran from: run the walks from a copy under `/tmp` (`cp -cR <worktree> /tmp/<dir>`, `HDV_EVIDENCE_ROOT=/tmp/<dir>/ev`, `TMPDIR=/tmp/<dir>/tmp` for the packaged walk) so no real home path is captured, and grep the text files before committing.
- Never click `Download` on the update notice or the CONTRACT.md link: they open the system browser.
- Update checks need the packaged app; headless runs never check on their own, only on Check for updates.
