#!/bin/bash
# Desk walk: one real user path through every desk area (boot, queue, stamps, undo, quick call, ask + rail, live reply,
# stow box, inspect, drawers, search, scenes, keys, Later, plain mode, chandlery, ships out, settings, phone, menu,
# reload). Prints PASS/FAIL per step and saves screenshots. Usage, from the worktree root on a fresh `hdv launch`:
#   .agents/skills/verify-harbordeck/scripts/desk-walk.sh [evidence-dir]
H=.agents/skills/verify-harbordeck/scripts/hdv; U=.agents/skills/verify-harbordeck/scripts/ui.mjs
eval "$($H env)"
E=${1:-$($H evidence desk-walk)}; mkdir -p $E; LOG=$E/walk.log; : > $LOG
A="$HDV_HOME/answers.jsonl"
step() { local name="$1"; shift; if out=$("$@" 2>&1); then echo "PASS  $name" | tee -a $LOG; else echo "FAIL  $name :: $out" | tee -a $LOG; fi; }
lines() { wc -l < "$A" | tr -d ' '; }
has() { grep -q "$1" "$A"; }
shot() { $U shot "$E/$1.png" --size 1280x760 >/dev/null; }

ERRS="window.__errs=[];addEventListener('error',e=>__errs.push(e.message));addEventListener('unhandledrejection',e=>__errs.push(String(e.reason)));1"
$U eval "$ERRS" >/dev/null
step "boot: morning manifest shows" $U wait --css '.modal .box h2' --text 'Morning manifest'
shot 01-manifest
step "day-cycle: Open the office fills the desk" bash -c "$U click --role button --name 'Open the office' && $U wait --css '#desk-surface .paper.manifest h3'"
shot 02-desk
step "window-queue: click queue item puts it on the desk" bash -c "$U click --css '#queue li' --text 'Merge PR 142' && $U text --css '#desk-surface .paper.manifest h3' | grep -q 'Merge PR 142'"
n0=$(lines)
step "stamps: key 1 shows undo chip, nothing written yet" bash -c "$U press 1 && $U wait --css '.toast.undo' && [ \$(wc -l < '$A' | tr -d ' ') = $n0 ]"
sleep 5
step "stamps: after hold one decide line for pr-142-checkout" bash -c "[ \$(wc -l < '$A' | tr -d ' ') = $((n0+1)) ] && tail -1 '$A' | grep -q '\"id\":\"pr-142-checkout\".*\"action\":\"decide\".*\"key\":\"merge\"'"
step "stamps: undo (u) during hold writes nothing" bash -c "$U click --css '#queue li' --text 'Pick a logo direction' && $U press 2 && $U wait --css '.toast.undo' && $U press u && sleep 5 && [ \$(wc -l < '$A' | tr -d ' ') = $((n0+1)) ]"
step "quick call: letter c picks option C on the logo slip" bash -c "$U click --css '#queue li' --text 'Pick a logo direction' && $U press c && $U text --css '#desk-surface .paper.ask label.opt.on' | grep -q 'Beacon'"
shot 03-pick
step "ask slip + ticket rail: 4, note, Send -> waiting ticket" bash -c "$U click --css '#queue li' --text 'Quarantine the flaky' && $U press 4 && $U fill --css '.modal.noteslip textarea' --value 'hdv: which test file?' && $U click --role button --name 'Send' && $U wait --css '#rail .ticket.waiting' --text 'Quarantine'"
sleep 5
step "ask: ask line in answers.jsonl" bash -c "grep -q '\"id\":\"flaky-e2e\".*\"action\":\"ask\"' '$A'"
step "live sync: agent reply (hd reply) flips ticket to replied" bash -c "$H hd reply flaky-e2e 'hdv: drag-drop.spec.ts' >/dev/null && $U wait --css '#rail .ticket.replied' --text 'Quarantine' --timeout 15000"
shot 04-rail-replied
step "stow box: x stows a paper (count 1)" bash -c "$U click --css '#queue li' --text 'Merge PR 142' ; $U click --css '#queue li' --text 'Pick a logo direction' && $U press x && $U wait --css '#stow[data-n=\"1\"]'"
step "stow box: click box opens view with a card" bash -c "$U click --css '#stow-box' && $U wait --css '#stow-view .stow-card'"
shot 05-stow
step "stow box: Shift+X brings all back" bash -c "$U press Escape && $U press Shift+X && $U wait --css '#stow[data-n=\"0\"]'"
step "inspect: i shows banner, claim + order -> popover" bash -c "$U press i && $U wait --css '#inspect-banner:not([hidden])' && $U click --css '#desk-surface .paper.manifest .fact' && $U press r && $U click --css '#orders .rule .fact' && $U wait --css '.popover'"
shot 06-inspect
n1=$(lines)
step "inspect: Match is held for undo, then writes a comment line" bash -c "$U click --role button --name 'Match' && $U wait --css '.toast.undo' && [ \$(wc -l < '$A' | tr -d ' ') = $n1 ] && sleep 5 && [ \$(wc -l < '$A' | tr -d ' ') = $((n1+1)) ] && tail -1 '$A' | grep -q '\"action\":\"comment\".*match:'"
step "drawers: Escape closes, menu -> Agent log shows lines" bash -c "$U press Escape && $U press i && $U press m && $U click --css '#btn-log' && $U text --css '#log-lines' | grep -q 'flaky-e2e'"
shot 07-agent-log
step "drawers: menu -> Archive lists the stamped PR" bash -c "$U press Escape && $U press m && $U click --css '#btn-vault' && $U text --css '#vault-content' | grep -q 'Merge PR 142'"
step "search: Cmd+K 'newsletter' Enter opens it on the desk" bash -c "$U press Escape && $U press Meta+k && $U fill --css '.modal.search .sr-in' --value 'newsletter' && $U press Enter && $U text --css '#desk-surface .paper.manifest h3' | grep -qi 'newsletter'"
step "scenes: ArrowRight flips the scene" bash -c "a=\$($U eval 'document.querySelector(\"#scenes\").dataset.scene'); $U press ArrowRight; b=\$($U eval 'document.querySelector(\"#scenes\").dataset.scene'); [ \"\$a\" != \"\$b\" ]"
step "keys: n walks to the next visitor" bash -c "a=\$($U text --css '#desk-surface .paper.manifest h3'); $U press n; sleep .5; b=\$($U text --css '#desk-surface .paper.manifest h3'); [ \"\$a\" != \"\$b\" ]"
n2=$(lines)
step "later: s writes a defer line after the hold" bash -c "$U click --css '#filters .chip' --text 'All' && $U click --css '#queue li' --text 'Pick a logo direction' && $U press s && sleep 5 && tail -1 '$A' | grep -q '\"id\":\"logo-direction\".*\"action\":\"defer\"'"
step "plain mode: p shows cards, p returns to desk" bash -c "$U press p && $U wait --css '#plain-mode:not([hidden]) .pcard' && $U eval 'document.querySelector(\"#desk-mode\").hidden' | grep -q true"
shot 08-plain
step "plain mode: back to desk" bash -c "$U press p && $U eval 'document.querySelector(\"#plain-mode\").hidden' | grep -q true"
step "chandlery: Shift+B opens chandlery + stamp book" bash -c "$U press Shift+B && $U wait --css '.modal.chandlery-modal' && $U press Escape"
step "day-cycle: l opens Ships out recap" bash -c "$U press l && $U wait --css '.modal .box h2' --text 'Ships out'"
shot 09-ships-out
step "settings: menu -> Settings shows data dir; Cancel closes" bash -c "$U press Escape && $U press m && $U click --css '#btn-settings' && $U wait --css '.modal.settings-modal' && $U text --css '.modal.settings-modal' | grep -q '$HDV_HOME' && $U click --role button --name 'Cancel' && $U wait --css '.modal.settings-modal' --gone"
step "console: no page errors so far" bash -c "$U eval 'window.__errs.length' | grep -qx 0"
step "phone: header icon opens the ship phone; Escape hangs up" bash -c "$U click --css '#btn-phone' && $U wait --css '#phone .phone-box' && $U press Escape && $U wait --css '#phone .phone-box' --gone"
step "phone: quota lands while typing; Alt+Enter queues for reset and the ticket stays" bash -c "$U click --css '#btn-phone' && $U fill --css '#phone .phone-pad' --value 'hdv: after the reset' && echo '[{\"name\":\"Solo\",\"window\":\"5h\",\"used_pct\":100,\"resets_at\":'\$(( \$(date +%s)+8000 ))'}]' | $H hd quota - >/dev/null && sleep 1.5 && $U press Alt+Enter && $U wait --css '#rail .ticket.queued' --text 'after the reset' && sleep 1 && $U wait --css '#rail .ticket.queued' --text 'after the reset' --timeout 500"
step "orders: phone order sends a request line" bash -c "n=\$(wc -l < '$A'); $U click --css '#btn-phone' && $U fill --css '#phone .phone-pad' --value 'hdv: check the build' && $U press Enter && sleep 1 && tail -1 '$A' | grep -q '\"action\":\"request\".*hdv: check the build'"
step "menu: theme toggles to light" bash -c "$U press m && $U click --css '#btn-theme' && $U eval 'document.documentElement.dataset.theme' | grep -q light && $U press Escape"
shot 10-light
step "persistence: reload keeps the office open and the stamped PR filed" bash -c "$U reload && $U wait --css '#desk-surface' && $U eval \"$ERRS\" >/dev/null && ! $U text --css '#queue' | grep -q 'Merge PR 142' && $U eval 'document.querySelector(\".modal .box h2\")?.textContent || \"none\"' | grep -qv 'Morning manifest'"
step "layout: narrow window flows papers" bash -c "$U shot $E/11-narrow.png --size 820x760 >/dev/null"
step "console: no page errors since reload" bash -c "$U eval 'window.__errs.length' | grep -qx 0"
echo "--- $(grep -c PASS $LOG) pass, $(grep -c FAIL $LOG) fail"
