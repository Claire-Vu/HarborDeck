#!/usr/bin/env bash
# Connect walk: first run on an empty desk (Connect an agent), Install/Uninstall Command Line Tool, Claude Code (stub
# claude), the status light, firstmate (install.sh against a stub home, no launchd), Other agent, Done, then the
# neighbours: stamping, reload, Settings (Agents and Version rows, Save), the menu. Launches its own `hdv launch --empty`
# (sandbox HOME), prints PASS/FAIL per step, captures each step under `hdv evidence connect`, and cleans up.
# Usage, from the worktree root: .agents/skills/verify-harbordeck/scripts/connect-walk.sh
H=.agents/skills/verify-harbordeck/scripts/hdv; U=.agents/skills/verify-harbordeck/scripts/ui.mjs
$H cleanup >/dev/null 2>&1; $H launch --empty || exit 1; $H doctor || exit 1
eval "$($H env)"; E=$($H evidence connect); T=$E/transcript.txt; : > $T; R=$E/results.txt; : > $R
links() { for f in "$1"/*; do [ -L "$f" ] && echo "$(basename "$f") -> $(readlink "$f")"; done; return 0; }  # names + targets, no owner column
run() { echo "\$ $*" >> $T; "$@" >> $T 2>&1; local c=$?; echo "[exit $c]" >> $T; return $c; }
step() { local n=$1; shift; echo "## $n" >> $T; if "$@"; then echo "PASS $n" | tee -a $R; else echo "FAIL $n" | tee -a $R; fi; $H capture connect "$n" >/dev/null; }
s01() { run $U wait --css '.modal.connect-modal' && run $U wait --css '.connect-modal h2' --text 'Welcome to Harbor Deck' && run $U wait --css '.cn-status.none' --text 'No agent has written'; }
s02() { run $U click --css '#cn-cli-install' && run $U wait --css '#cn-cli' --text 'are linked in' && run links "$HDV_USERHOME/.local/bin" && [ "$(readlink "$HDV_USERHOME/.local/bin/hd")" = "$(pwd -P)/cli/bin/harbordeck.js" ] && run "$HDV_USERHOME/.local/bin/hd" --version; }
s03() { run $U click --css '#cn-cli button' --text 'Uninstall' && run $U wait --css '#cn-cli-install' && [ -z "$(ls -A "$HDV_USERHOME/.local/bin")" ]; }
s04() { run $U wait --css '.cn-panel ul' --text "claude mcp add harbordeck -s user -e HARBORDECK_HOME=$HDV_HOME -- $HDV_USERHOME/.local/bin/harbordeck mcp" && [ ! -e $HDV_STATE/claude.log ] &&
  run $U click --role button --name 'Connect Claude Code' && run $U wait --css '#cn-out.ok' --text 'Added stdio MCP server' && run cat $HDV_STATE/claude.log && run links "$HDV_USERHOME/.local/bin" &&
  grep -qxF "mcp add harbordeck -s user -e HARBORDECK_HOME=$HDV_HOME -- $HDV_USERHOME/.local/bin/harbordeck mcp" $HDV_STATE/claude.log && [ -L "$HDV_USERHOME/.local/bin/harbordeck" ]; }
s05() { run env HARBORDECK_HOME="$HDV_HOME" HARBORDECK_FROM=mate-main "$HDV_USERHOME/.local/bin/hd" todo hdv-hello "Say hello to the desk" -s "Written through the installed hd." -t hdv-onboarding &&
  run $U wait --css '.cn-status.live' --text 'items/hdv-hello.json' && run $U text --css '.cn-status'; }
FM=$HDV_STATE/fm
s06() { mkdir -p $FM/bin $FM/data; for s in fm-captain-hold.sh fm-inbox.sh fm-crew-state.sh; do printf '#!/bin/sh\n' > $FM/bin/$s; chmod +x $FM/bin/$s; done
  run $U click --role radio --name 'firstmate' && run $U fill --css '#cn-fm-home' --value "$FM" && run $U press Tab && run $U wait --css '.cn-panel pre' --text "--fm-home $FM" &&
  run $U click --css '.cn-panel .set-check' && [ "$($U eval "document.querySelector('.cn-panel .set-check input').checked")" = false ]; }
s07() { run $U click --role button --name 'Connect firstmate' && run $U wait --css '#cn-out.ok' --text 'service: not installed' --timeout 30000 &&
  run grep -c '{#harbordeck}' $FM/data/captain.md && run test -s $FM/data/harbordeck.md && run cat $HDV_STATE/profile/settings.json &&
  grep -q "\"artifactRoot\": \"$FM\"" $HDV_STATE/profile/settings.json && [ ! -e $HDV_USERHOME/Library/LaunchAgents ]; }
s08() { run $U click --role radio --name 'Other agent' && run $U wait --css '.cn-panel' --text '"mcpServers"' && run $U wait --css '.cn-panel' --text 'hd decision'; }
s09() { run $U click --css '.connect-modal footer button' --text 'Done' && run $U wait --css '.modal.connect-modal' --gone && run $U wait --css '.modal.manifest' &&
  grep -q '"onboarded": true' $HDV_STATE/profile/settings.json; }
s10() { run $U click --role button --name 'Open the office' && run $U click --css '#queue li' --text 'Say hello to the desk' && run $U wait --css '#desk-surface .paper.manifest h3' --text 'Say hello' &&
  run $U press 1 && for i in $(seq 1 40); do grep -q '"id":"hdv-hello"' $HDV_HOME/answers.jsonl 2>/dev/null && break; sleep 0.25; done && run tail -1 $HDV_HOME/answers.jsonl && grep -q '"id":"hdv-hello","action":"file"' $HDV_HOME/answers.jsonl; }
s11() { run $U reload && run $U wait --css '#queue' && sleep 1 && [ "$($U eval "document.querySelectorAll('.modal.connect-modal').length")" = 0 ]; }
s12() { run $U press m && run $U click --css '#btn-settings' && run $U wait --css '.modal.settings-modal' && run $U text --css '.settings-modal .set-row:has(#btn-update-check)' &&
  run $U click --css '#btn-update-check' && run $U wait --css '#toasts .toast' --text 'source checkout'; }
s13() { run $U click --css '.settings-modal footer .pbtn' --text 'Save' && run $U wait --css '.modal.settings-modal' --gone && sleep 0.5 && run cat $HDV_STATE/profile/settings.json &&
  grep -q '"onboarded": true' $HDV_STATE/profile/settings.json && grep -q "\"artifactRoot\": \"$FM\"" $HDV_STATE/profile/settings.json; }
s14() { run $U press m && run $U click --css '#btn-settings' && run $U click --role button --name 'Command line tool…' && run $U wait --css '.connect-modal #cn-cli.focus' && run $U wait --css '.connect-modal h2' --text 'Connect an agent' && run $U wait --css '.cn-status.live'; }
s15() { run $U click --css '.connect-modal footer button' --text 'Done' && run $U wait --css '.modal.connect-modal' --gone && run $U press m && run $U wait --css '#menu' && run $U press Escape; }
step 01-first-run s01; step 02-cli-install s02; step 03-cli-uninstall s03; step 04-claude-code s04; step 05-light-live s05
step 06-firstmate-plan s06; step 07-firstmate-connected s07; step 08-other-agent s08; step 09-done s09; step 10-stamp s10
step 11-reload s11; step 12-settings-version s12; step 13-settings-save s13; step 14-settings-cli s14; step 15-menu-intact s15
$H cleanup >/dev/null
echo "evidence: $E"
grep -q FAIL "$R" && exit 1 || exit 0
