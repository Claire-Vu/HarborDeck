#!/usr/bin/env bash
# live user drive of the Later batch on the hdv instance; run from the /tmp copy
set -u
export _ZO_DOCTOR=0
cd /tmp/hd-later/HarborDeck
H=.agents/skills/verify-harbordeck/scripts/hdv; U=.agents/skills/verify-harbordeck/scripts/ui.mjs
eval "$($H env)"
E=$($H evidence later); RES="$E/results.txt"; : > "$RES"
pass() { echo "PASS $*" | tee -a "$RES"; }; fail() { echo "FAIL $*" | tee -a "$RES"; }
chk() { local d=$1; shift; if "$@"; then pass "$d"; else fail "$d"; fi; }
run() { echo "\$ $*" >> "$E/transcript.txt"; "$@" >> "$E/transcript.txt" 2>&1; local rc=$?; echo "exit $rc" >> "$E/transcript.txt"; return $rc; }
A="$HARBORDECK_HOME/answers.jsonl"; n() { wc -l < "$A" | tr -d ' '; }
last() { tail -1 "$A"; }

$H capture later 00-before >/dev/null
run $U press ' '
# 1. Later stamp click -> the slip with three choices
run $U click --css '#queue li' --text 'Renew the domain'
run $U click --css '#stamps .stamp[data-verdict=later]'
run $U wait --css '.modal.laterslip'
opts=$($U text --css '.modal.laterslip .ls-opt'); echo "$opts" >> "$E/transcript.txt"
chk "slip offers tomorrow 9:00 (S)" grep -q 'Tomorrow morning' <<<"$opts"
chk "slip offers after the next usage reset (⇧S)" grep -q 'After the next usage reset' <<<"$opts"
chk "slip has a date/time picker" $U wait --css '.modal.laterslip .ls-at'
pick=$(date -v+3d +%Y-%m-%d)T14:30; want=$(date -j -f '%Y-%m-%dT%H:%M:%S' "$pick:00" +%s)
run $U fill --css '.modal.laterslip .ls-at' --value "$pick"
$U shot "$E/01-later-slip.png" >/dev/null
b=$(n); run $U click --css '.modal.laterslip .ls-pick .pbtn' --text 'Park'
sleep 5.5
chk "picked date/time writes one defer line with until=$want ($pick)" test "$(n)" = $((b+1)) -a "$(jq -c 'select(.id=="todo-domain") | [.action,.until]' <<<"$(last)")" = "[\"defer\",$want]"
echo "line: $(last)" >> "$RES"
# 2. Shift+S on another item: after the next reset
reset=$(jq '[.[] | select(.resets_at > now) | .resets_at] | min' "$HARBORDECK_HOME/quota.json")
run $U click --css '#queue li' --text 'Forward September receipts'
b=$(n); run $U press Shift+S; sleep 5.5
chk "Shift+S writes until = next reset + 60 ($((reset+60)))" test "$(jq -c '[.id,.action,.until]' <<<"$(last)")" = "[\"todo-receipts\",\"defer\",$((reset+60))]"
echo "line: $(last)" >> "$RES"
# 3. S still one key: tomorrow 9:00
nine=$(date -v+1d -v9H -v0M -v0S +%s)
run $U click --css '#filters .chip' --text 'All'
run $U click --css '#queue li' --text 'Rename the repo'
run $U press s; sleep 5.5
chk "S writes until = tomorrow 09:00 ($nine)" test "$(jq -c '[.id,.action,.until]' <<<"$(last)")" = "[\"rename-repo\",\"defer\",$nine]"
# 4. Parked shelf
chk "shelf shows 3 parked" test "$($U text --css '#parked-n')" = 3
run $U click --css '#parked-btn'
run $U wait --css '#parked-view .parked-row'
$U text --css '#parked-view .parked-row' >> "$RES"
$U shot "$E/02-parked-shelf.png" >/dev/null
chk "shelf row has its return time" grep -q '2:30 PM\|14:30' <<<"$($U text --css '#parked-view .parked-row')"
sill=$($U text --css '#scenes .sc-left'); echo "sill: $sill" >> "$RES"
chk "window sill counts parked" grep -q '· 3 parked' <<<"$sill"
# 5. Bring back now
b=$(n); run $U click --css '#parked-view .parked-row[data-id="todo-domain"] .pk-back'
sleep 1
chk "Bring back now puts it at the desk" test "$($U text --css '#desk-surface .paper.manifest h3')" = 'Renew the domain before it lapses'
chk "Bring back now writes nothing" test "$(n)" = "$b"
chk "shelf now 2" test "$($U text --css '#parked-n')" = 2
$U shot "$E/03-brought-back.png" >/dev/null
# 6. everything else cleared by the agents: zero waiting, but 2 parked
ids=$($H hd ls 2>/dev/null | awk '$4=="open"{print $1}' | grep -v -e todo-receipts -e rename-repo)
run $H hd resolve $ids
sleep 2
zero=$($U text --css '#scenes .sc-zero'); left=$($U text --css '#scenes .sc-left'); echo "all clear: $zero | sill: $left" >> "$RES"
chk "all clear says parked: '$zero'" test "$zero" = '⚑ Zero waiting anywhere · 2 parked'
chk "sill says 'Zero waiting · 2 parked'" grep -q '^Zero waiting · 2 parked' <<<"$left"
$U shot "$E/04-zero-but-parked.png" >/dev/null
# 7. reload: still parked, still counted
run $U reload; sleep 3
chk "after reload the shelf still shows 2" test "$($U text --css '#parked-n')" = 2
# 8. plain mode lists them with Bring back now
run $U press p; sleep 1
pl=$($U text --css '#plain-mode .plain-group.parked'); echo "plain: $pl" >> "$RES"
chk "plain mode lists Parked for later (2)" grep -qi 'Parked for later (2)' <<<"$pl"
$U shot "$E/05-plain-parked.png" >/dev/null
run $U press p
$H capture later 99-after >/dev/null
# 9. bridge (F15): live run against a stub firstmate home
FM=$(mktemp -d /tmp/hdv-fm-XXXX); mkdir -p "$FM/bin"
cat > "$FM/bin/fm-captain-hold.sh" <<'STUB'
#!/usr/bin/env bash
if [ "$1" = open ]; then [ "$2" = todo-receipts ] || [ "$2" = todo-domain ]; exit; fi
printf 'fm-captain-hold.sh %s\n' "$*" >> "$FM_HOME/received.log"
STUB
printf '#!/usr/bin/env bash\nprintf "fm-inbox.sh %%s\\n" "$*" >> "$FM_HOME/received.log"\n' > "$FM/bin/fm-inbox.sh"
chmod +x "$FM"/bin/*.sh
run env FM_HOME="$FM" HD="$PWD/cli/bin/harbordeck.js" adapters/firstmate/hd-bridge.sh
grep -E 'defer|deferred' "$FM/received.log" | tee "$E/bridge-received.txt" >> "$RES"
rd=$(date -r $((reset+60)) +%Y-%m-%d); rt=$(date -r $((reset+60)) '+%Y-%m-%d %H:%M'); rdn=$(date -j -v+1d -f %Y-%m-%d "$rd" +%Y-%m-%d)
chk "Shift+S hold carries exact time and a date never before it" grep -qF "hold todo-receipts --reason captain deferred todo-receipts on HarborDeck until $rt --until $rdn" "$E/bridge-received.txt"
pt=$(date -r $want '+%Y-%m-%d %H:%M'); pd=$(date -j -v+1d -f %Y-%m-%d "${pt% *}" +%Y-%m-%d)
chk "picked date/time hold: until $pt -> --until $pd" grep -qF "hold todo-domain --reason captain deferred todo-domain on HarborDeck until $pt --until $pd" "$E/bridge-received.txt"
chk "unheld item gets an inbox note with the exact time" grep -qF "back on the desk $(date -r $nine '+%Y-%m-%d %H:%M')" "$E/bridge-received.txt"
rm -rf "$FM"
echo "evidence: $E"; grep -c PASS "$RES"; grep FAIL "$RES" || true
