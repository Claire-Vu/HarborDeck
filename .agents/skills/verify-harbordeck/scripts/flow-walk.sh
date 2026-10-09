#!/usr/bin/env bash
# Live user walk for the flow batch (F1-F14) on the hdv instance. Prints PASS/FAIL per step; shots into $OUT.
set -u
cd "$(dirname "$0")/../../../.."
H=.agents/skills/verify-harbordeck/scripts/hdv
U="node .agents/skills/verify-harbordeck/scripts/ui.mjs"
eval "$($H env)"
OUT=${1:?out dir}; mkdir -p "$OUT"
A="$HDV_HOME/answers.jsonl"
pass=0; fail=0
step() { local name=$1; shift; if "$@" >>"$OUT/walk.log" 2>&1; then echo "PASS $name"; pass=$((pass+1)); else echo "FAIL $name"; fail=$((fail+1)); fi; }
shot() { $U shot "$OUT/$1.png" >/dev/null 2>&1; }
ev() { $U eval "$1" 2>/dev/null | sed 's/^"//;s/"$//'; }
n() { wc -l < "$A" | tr -d ' '; }
rows() { ev "document.querySelectorAll('#queue li:not(.q-lane):not(.q-later):not(.q-empty)').length"; }
pressed() { ev "document.querySelector('#filters .chip[aria-pressed=true]').textContent"; }
scene() { ev "document.querySelector('#scenes').dataset.scene"; }

$U click --role button --name 'Open the office' >/dev/null
shot 00-office

# F1
$U click --css '#queue li' --text 'Review the new dashboard' >/dev/null
step "F1 click a review -> scene review" bash -c "[ \"$(scene)\" = review ]"
shot 01-scene-follows-review
$U click --css '#queue li' --text 'Renew the domain' >/dev/null
step "F1 click a notice -> scene todo, All still pressed" bash -c "[ \"$(scene)\" = todo ] && [[ \"$(pressed)\" == All* ]]"

# F2
r0=$(rows)
for i in 1 2 3 4; do $U press ArrowRight >/dev/null; done
$U click --css '#scenes .sc-arrow.next' >/dev/null
for i in $(seq 1 $((r0+2))); do $U press n >/dev/null; done
step "F2 arrows x4, scene arrow, N x$((r0+2)): All pressed, $r0 rows" bash -c "[[ \"$(pressed)\" == All* ]] && [ \"$(rows)\" = $r0 ]"
shot 02-all-stays-all

# F5
step "F5 seed reply ticket reads 'new reply'" bash -c "$U text --css '#rail .ticket.new .tk-foot' | grep -q 'new reply'"
step "F5 sent order reads 'awaiting reply'" bash -c "$U text --css '#rail .ticket.waiting .tk-foot' | grep -q 'awaiting reply'"
shot 03-ticket-wording

# F6 (ask + agent reply via the real CLI)
$U click --css '#queue li' --text 'Quarantine the flaky' >/dev/null && $U press 4 >/dev/null && $U fill --css '.modal.noteslip textarea' --value 'How flaky, % of runs?' >/dev/null && $U click --role button --name Send >/dev/null
sleep 5
step "F6 ask line written" grep -q '"id":"flaky-e2e".*"action":"ask"' "$A"
$H hd reply flaky-e2e "About 7% of runs, all on the drag step." >>"$OUT/walk.log"
$U wait --css '#rail .ticket.new' --text 'Quarantine' >/dev/null
$U press Escape >/dev/null; $U press t >/dev/null
step "F6 T focuses the newest reply (Quarantine, not Newsletter)" bash -c "[[ \"$(ev 'document.activeElement.textContent')\" == *Quarantine* ]]"
shot 04-t-newest-reply

# F4
$U press Escape >/dev/null
$U click --css '#queue li' --text 'Quarantine the flaky' >/dev/null
c=$(n); $U press ' ' >/dev/null; sleep .3
step "F4 first Space opens the unread reply, writes nothing" bash -c "$U text --css '.tk-pop' | grep -q 'About 7%' && [ \"$(ev "document.querySelectorAll('.toast.undo').length")\" = 0 ] && [ $(n) = $c ]"
shot 05-space-opens-reply
$U press ' ' >/dev/null
step "F4 second Space stamps (undo chip)" $U wait --css '.toast.undo'
$U press u >/dev/null; sleep 4.5
step "F4 undo: nothing written" bash -c "[ $(n) = $c ]"
$U press Escape >/dev/null

# F3 + F8
$U click --css '#filters .chip' --text 'Notices' >/dev/null
c=$(n)
$U press ' ' >/dev/null; $U press ' ' >/dev/null; $U press ' ' >/dev/null
shot 06-fast-clear-mid
sleep 5
step "F3 three quick Spaces -> three notices filed" bash -c "[ \$(tail -n +$((c+1)) '$A' | grep -c '\"action\":\"file\"') = 3 ]"
step "F8 empty list text on one line" bash -c "[ \"$(ev "Math.round(document.querySelector('#queue li.q-empty').getBoundingClientRect().height)")\" -lt 50 ]"
shot 07-empty-queue

# F10
$U click --css '#filters .chip' --text 'All' >/dev/null
$U click --css '#queue li' --text 'Review the new dashboard' >/dev/null
for i in 1 2 3 4 5; do $U press x >/dev/null; sleep .5; done
step "F10 manifest has no stow control and stays after 5x X" bash -c "[ \"$(ev "document.querySelectorAll('#desk-surface .paper.manifest .stow-btn').length")\" = 0 ] && [ \"$(ev "document.querySelectorAll('#desk-surface .paper.manifest').length")\" = 1 ]"
shot 08-manifest-stays
$U press Shift+X >/dev/null

# F11
$U press 3 >/dev/null; $U fill --css '.modal.noteslip textarea' --value 'The legend overlaps the chart on narrow screens' >/dev/null; $U press Escape >/dev/null; $U press 3 >/dev/null
step "F11 slip draft kept after Esc" bash -c "[ \"$(ev "document.querySelector('.modal.noteslip textarea').value")\" = 'The legend overlaps the chart on narrow screens' ]"
shot 09-slip-draft
$U press Escape >/dev/null

# F9
$U click --css '#btn-phone' >/dev/null; $U press 3 >/dev/null; $U fill --css '.phone-pad' --value 'Draft for growth' >/dev/null; $U press Escape >/dev/null; $U click --css '#btn-phone' >/dev/null
step "F9 reopened phone keeps draft and dial (mate-growth)" bash -c "[ \"$(ev "document.querySelector('.dial-pos[aria-checked=true]').dataset.mate + '|' + document.querySelector('.phone-pad').value")\" = 'mate-growth|Draft for growth' ]"
shot 10-phone-dial-kept
$U fill --css '.phone-pad' --value '' >/dev/null; $U press Escape >/dev/null

# F12
$U click --css '#queue li' --text 'Review the new dashboard' >/dev/null
$U press i >/dev/null; $U click --css '#desk-surface .paper.manifest .fact' >/dev/null; $U click --css '#desk-surface .paper.photo img' >/dev/null
c=$(n); $U click --css '.popover .pbtn' --text 'Match' >/dev/null
step "F12 Match shows undo chip, nothing written yet" bash -c "$U wait --css '.toast.undo' && [ $(n) = $c ]"
shot 11-inspect-match-held
$U press u >/dev/null; sleep 4.5
step "F12 undo: no comment written" bash -c "[ $(n) = $c ]"
$U click --css '#desk-surface .paper.manifest .fact' >/dev/null; $U click --css '#desk-surface .paper.photo img' >/dev/null; $U click --css '.popover .pbtn' --text 'Match' >/dev/null; sleep 4.5
step "F12 Match kept: comment line after the hold" bash -c "tail -1 '$A' | grep -q '\"action\":\"comment\".*match:'"
$U press i >/dev/null
fm=$(mktemp -d /tmp/hdv-fm.XXXXXX); mkdir -p "$fm/bin"; printf '#!/usr/bin/env bash\nexit 1\n' > "$fm/bin/fm-captain-hold.sh"; printf '#!/usr/bin/env bash\necho "inbox $*" >> "%s/calls.log"\n' "$fm" > "$fm/bin/fm-inbox.sh"; chmod +x "$fm"/bin/*.sh
printf '#!/bin/sh\nexec node "%s/cli/bin/harbordeck.js" "$@"\n' "$PWD" > "$fm/bin/hd"; chmod +x "$fm/bin/hd"
FM_HOME=$fm HD="$fm/bin/hd" HARBORDECK_HOME=$HDV_HOME adapters/firstmate/hd-bridge.sh --dry-run > "$OUT/bridge-dry-run.txt" 2>>"$OUT/walk.log"
step "F12 bridge routes the ask but not the match: comment" bash -c "grep -q 'flaky-e2e' '$OUT/bridge-dry-run.txt' && ! grep -q 'match:' '$OUT/bridge-dry-run.txt'"

# F7: eight orders through the phone
for i in 1 2 3 4 5 6 7 8; do $U click --css '#btn-phone' >/dev/null; $U press 1 >/dev/null; $U fill --css '.phone-pad' --value "hdv order $i for the crew" >/dev/null; $U press Enter >/dev/null; done
sleep 2.5
step "F7 overflow cue beside the rail, no ticket clipped" bash -c "[ \"$(ev "(()=>{const r=document.querySelector('#rail').getBoundingClientRect(),c=document.querySelector('#rail-right');const cr=c.getBoundingClientRect();return !c.hidden&&cr.left>=r.right-1&&[...document.querySelectorAll('#rail .tk-foot')].every(f=>f.getBoundingClientRect().bottom<=r.bottom)})()")\" = true ]"
shot 12-rail-overflow

# F13
at=$(date -v+3H +%H:%M)
$U click --css '#btn-phone' >/dev/null; $U fill --css '.phone-pad' --value 'hdv far timed order' >/dev/null; $U fill --css '.phone-at' --value "$at" >/dev/null; $U click --css '.phone-q' --text 'Queue at time' >/dev/null
step "F13 toast warns the Mac is kept awake only from an hour before" bash -c "$U text --css '.toast' | grep -q 'kept awake from'"
shot 13-queue-far-time
step "F13 no keep-awake held for an order 3 h away" bash -c "node -e 'const s=require(process.argv[1]);process.exit(s.pending.some(p=>p.kind===\"at\")&&s.keep_awake===null?0:1)' '$HDV_HOME/scheduler.json'"

# F14
{ echo '$ hd --help | head -1'; $H hd --help | head -1; echo '$ hd -h | head -1'; $H hd -h | head -1; echo '$ hd batch --help | head -1'; $H hd batch --help </dev/null | head -1
  echo '$ hd --version'; $H hd --version; echo 'package.json version:'; node -p "require('./package.json').version"
  echo '$ hd decision hdv-x "Pick?" --opt a+ --opt-art a=art/missing.png'; $H hd decision hdv-x "Pick?" --opt a+ --opt-art a=art/missing.png; echo "exit $?"; } > "$OUT/cli-transcript.txt" 2>&1
step "F14 help works, versions match, missing --opt-art exits 1" bash -c "grep -c '^harbordeck (hd)' '$OUT/cli-transcript.txt' | grep -q 3 && [ \"\$(sed -n '/--version/{n;p;}' '$OUT/cli-transcript.txt')\" = \"\$(node -p \"require('./package.json').version\")\" ] && grep -q '^exit 1' '$OUT/cli-transcript.txt' && [ ! -e '$HDV_HOME/items/hdv-x.json' ]"

echo "--- $pass pass, $fail fail"
