# Set up HarborDeck for a firstmate home

This makes HarborDeck a live feed of a real firstmate home. Firstmate writes captain-facing items with the `harbordeck` CLI. The desk shows the crew and stamina. Every stamp goes back to firstmate the moment you make it. Nothing in firstmate changes: the adapter only calls firstmate's own scripts.

```
firstmate ── harbordeck decision/review/answer/todo ──▶ ~/.harbordeck/items ──▶ Harbor Deck (watches the dir)
firstmate ◀── fm-captain-hold.sh answers / fm-inbox.sh note ── hd-bridge.sh --follow ◀── answers.jsonl ◀── stamps
state/*.meta, fm-crew-state.sh, quota-axi, data/captain.md ── hd-live.sh ──▶ fleet.json, quota.json, rules.json
```

## Requirements

- macOS (the installer manages a launchd agent; on Linux it prints the command to run under your supervisor).
- Node 18+, `jq`, `quota-axi` (for the stamina bars), and a firstmate home with `bin/fm-captain-hold.sh`, `bin/fm-inbox.sh` and `bin/fm-crew-state.sh`.

## Install

```sh
git clone https://github.com/Claire-Vu/HarborDeck.git && cd HarborDeck
npm install
adapters/firstmate/install.sh --fm-home ~/firstmate --mode echo    # safe first run: logs firstmate commands, runs none
```

The installer is idempotent. Re-run it to update or switch modes. It:

1. Links `harbordeck` and `hd` into `~/.local/bin` (`--bin-dir` to change). That directory must be on the `PATH` of the agents.
2. Creates `~/.harbordeck` (`--data-dir` or `$HARBORDECK_HOME` to change). It points the app at that directory, with the firstmate home as the Artifact root, so `data/<task>/report.md` paths open on the desk.
3. Starts the bridge cursor at the end of `answers.jsonl`, so older answers are never replayed into firstmate. A switch from echo to live does the same. On a live re-install, answers past the cursor (made while the bridge was down) stop the installer: it lists them and changes nothing until you re-run it with `--pending deliver` (route them now) or `--pending skip` (drop them).
4. Installs and starts the launchd agent `dev.harbordeck.firstmate`. It runs `hd-live.sh`: the on-answer bridge (`hd-bridge.sh --follow`), the crew feed (every 10 s), stamina (every 120 s) and standing orders (whenever `data/captain.md` changes). It logs to `~/Library/Logs/harbordeck-firstmate.log` and restarts if it exits. On a re-install it waits for the old agent to exit before loading the new one, and fails unless the new one is running.
5. Writes the firstmate-side instructions to `<home>/data/harbordeck.md`. It also adds one standing order pointing at them to `<home>/data/captain.md`, between `<!-- harbordeck:begin/end -->` markers. Both files are in the home's private, git-ignored `data/` directory.

Options: `--from <id>` signs items and replies (default `mate-main`). `--no-service` skips launchd and prints the `hd-live.sh` command instead. `--uninstall` removes the agent, the CLI links and the instructions, and keeps the data dir.

## Check it

```sh
launchctl print gui/$(id -u)/dev.harbordeck.firstmate | grep state   # state = running
tail -f ~/Library/Logs/harbordeck-firstmate.log                       # "hd-bridge: following ...", then "hd-bridge: routed <action> <id>" per answer
harbordeck validate                                                   # ok: 1 fleet, 1 quota, 1 rules, N items, ...
```

Then open the app and stamp something. In echo mode the log shows the exact firstmate command, for example:

```
2026-10-08T08:50:59Z would run: printf $'ship-24\tmerge\tMerge\tdone' | ~/firstmate/bin/fm-captain-hold.sh answers --source harbordeck
2026-10-08T08:51:09Z would run: ~/firstmate/bin/fm-inbox.sh note --request-id hd-db-research-ask-1791449464 -- HarborDeck ask on db-research ...
```

## Go live

```sh
adapters/firstmate/install.sh --fm-home ~/firstmate --mode live
```

If answers piled up while no bridge ran (tests, or an agent that was down), the installer lists them and asks for `--pending deliver` or `--pending skip`.

From then on a stamp on a held task closes that hold. An ask, a comment, a request, or a stamp on an item that is not a held task becomes an inbox note. Answers made while in echo mode are skipped, not replayed. The routing table is in [README.md](README.md#how-answers-route).

## Stamina bars

`quota-axi` reads Claude usage from the macOS keychain. It needs one grant from you:

```sh
quota-axi --allow-keychain-prompt     # click "Always Allow"
```

Until then the top bar shows "no quota", and the log names the provider and the fix. The feeder only uses quota-axi's cached reads, which are at most 5 minutes old.

## Put existing captain calls on the desk

New holds go on the desk as firstmate raises them, per `data/harbordeck.md`. For calls that were already open at install time, firstmate writes one batch, with one line per call and the held task id as the item id:

```sh
cd ~/firstmate && HARBORDECK_PROJECT=<repo> harbordeck batch <<'EOF'
decision <task-id> "<question?>" -s "<one line>" --opt <key>+ --opt <key>="<Label>" -b data/<task>/report.md
review <task-id> "<title>" -s "<one line>" -a https://github.com/<owner>/<repo>/pull/<n>
todo <id> "<what only the captain can do>" -s "<why>"
EOF
```

Cost, measured on a real home with 16 open items written in one batch: 193 bytes per line on average (123 to 293), or about 50 input tokens. Each item returns a 30-byte `ok` line, about 8 tokens. The whole batch took 60 ms. Each item file on disk is about 470 bytes.

## Launch the app

```sh
npm start                     # from the checkout
npm run dist                  # builds dist/mac-arm64/Harbor Deck.app; drag it to /Applications
open "dist/mac-arm64/Harbor Deck.app"
```

The build is unsigned. The first time, right-click the app and choose **Open**. Both ways read the settings the installer wrote.

## Proof

`test/evidence/run.sh` records the live round trip with the ystack evidence runner: items posted by the CLI appear on the desk, a stamp and an ask reach the bridge, and a `harbordeck reply` lands on the ticket rail. `demo` uses synthetic data. `real` uses a throwaway copy of your data dir, with the bridge in echo mode against your home:

```sh
test/evidence/run.sh demo
FM_HOME=~/firstmate HD_EV_STAMP=<held decision id> HD_EV_ASK=<item id> test/evidence/run.sh real   # stays in ~/.local/share/evidence
```
