#!/usr/bin/env bash
# Adapter tests against a stub firstmate home. Run: adapters/firstmate/test/run.sh
set -euo pipefail

here=$(cd "$(dirname "$0")/.." && pwd)
root=$(cd "$here/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export HD="$root/cli/bin/harbordeck.js" HARBORDECK_HOME="$tmp/hd" FM_HOME="$tmp/fm"
fails=0
check() {  # <description> <command...>
  if "${@:2}"; then echo "ok   $1"; else echo "FAIL $1"; fails=$((fails + 1)); fi
}

mkdir -p "$FM_HOME/bin" "$FM_HOME/state"
cat > "$FM_HOME/bin/fm-captain-hold.sh" <<'EOF'
#!/usr/bin/env bash
in=$(cat); printf 'hold %s | %s\n' "$*" "$in" >> "$FM_HOME/calls.log"
id=${in%%$'\t'*}
if [ "$id" = held-1 ] || [ "$id" = held-2 ]; then echo "closed: $id"; else echo "skipped: $id (not held)"; exit 1; fi
EOF
cat > "$FM_HOME/bin/fm-inbox.sh" <<'EOF'
#!/usr/bin/env bash
printf 'inbox %s\n' "$*" >> "$FM_HOME/calls.log"
EOF
cat > "$FM_HOME/bin/fm-crew-state.sh" <<'EOF'
#!/usr/bin/env bash
case $1 in a) echo "state: working · source: pane · busy" ;; b) echo "state: parked · source: run-step · gate" ;; *) echo "state: unknown · source: none" ;; esac
EOF
chmod +x "$FM_HOME"/bin/*.sh
printf 'kind=ship\nharness=claude\nmodel=opus\neffort=medium\nproject=/x/projects/weather-app\nendpoint_task_id=a\n' > "$FM_HOME/state/a.meta"
printf 'kind=ship\nharness=codex\nmodel=gpt\nproject=/x/projects/bakery-site\nendpoint_task_id=b\n' > "$FM_HOME/state/b.meta"
printf 'kind=secondmate\nharness=claude\nmodel=opus\nproject=/x/projects/bakery-site\n' > "$FM_HOME/state/sm.meta"

# fleet
"$HD" todo b "Item for crew b" >/dev/null
"$here/hd-fleet.sh" >/dev/null
fleet="$HARBORDECK_HOME/fleet.json"
check "fleet: crew states mapped" test "$(jq -c '[.crew[] | [.id, .state]]' "$fleet")" = '[["a","working"],["b","waiting"]]'
check "fleet: crew linked to its item" test "$(jq -r '.crew[] | select(.id == "b") | .item' "$fleet")" = b
check "fleet: secondmate is counter staff" test "$(jq -c '[.firstmates[].id]' "$fleet")" = '["mate-main","sm"]'
check "fleet: project basenames" test "$(jq -c '[.regulars[].id]' "$fleet")" = '["bakery-site","weather-app"]'

# quota
cat > "$tmp/quota.json" <<'EOF'
{"providers":[
 {"provider":"claude","windows":[
   {"id":"s","label":"Session","kind":"session","percentUsed":62,"resetsAt":"2026-10-08T10:00:00.000Z","windowSeconds":18000},
   {"id":"w","label":"Weekly","kind":"weekly","percentRemaining":59,"resetsAt":"2026-10-12T00:00:00Z","windowSeconds":604800},
   {"id":"o","label":"Opus share","kind":"model","percentUsed":10,"shareOf":"w","resetsAt":"2026-10-12T00:00:00Z","windowSeconds":604800}]},
 {"provider":"codex","windows":[]}]}
EOF
"$here/hd-quota.sh" --from-json "$tmp/quota.json" >/dev/null
check "quota: windows converted" test "$(jq -c '.' "$HARBORDECK_HOME/quota.json")" = \
  '[{"name":"Claude","window":"5h","used_pct":62,"resets_at":1791453600},{"name":"Claude","window":"7d","used_pct":41,"resets_at":1791763200}]'

# rules
printf '# Prefs\n\n- Never ship a release on Fridays.\n- Keep infra under $30/mo. {#budget-30}\n  - nested detail is ignored\n* Never ship a release on Fridays, holidays too.\n' > "$tmp/prefs.md"
"$here/hd-rules.sh" "$tmp/prefs.md" >/dev/null
rules="$HARBORDECK_HOME/rules.json"
check "rules: slug keys, explicit keys, dedupe" test "$(jq -c 'keys_unsorted' "$rules")" = '["never-ship-a-release-on-fridays","budget-30","never-ship-a-release-on-fridays-2"]'
check "rules: text and source" test "$(jq -c '.["budget-30"]' "$rules")" = '{"text":"Keep infra under $30/mo.","source":"prefs.md:4"}'

# bridge
"$HD" batch >/dev/null <<'EOF'
decision held-1 "Ship 2.4?" --opt "ship+=Ship today" --opt hold
decision free-1 "Palette?" --opt warm --opt cool
review held-2 "Video"
answer res-1 "Research"
todo td-1 "Sign form"
EOF
cat > "$HARBORDECK_HOME/answers.jsonl" <<'EOF'
{"id":"held-1","action":"decide","key":"ship","note":"","at":1}
{"id":"free-1","action":"decide","key":"warm","note":"cozier","at":2}
{"id":"held-2","action":"needs-work","note":"slower voice","at":3}
{"id":"res-1","action":"ask","note":"why host B?","at":4}
{"id":"res-1","action":"file","note":"","at":5}
{"id":"td-1","action":"file","note":"","at":6}
{"id":"req-9","action":"request","note":"Add dark theme","to":"sm","at":7}
EOF
"$here/hd-bridge.sh" --dry-run > "$tmp/dry.txt"
check "bridge: dry run touches nothing" test ! -e "$FM_HOME/calls.log"
check "bridge: dry run lists routes" grep -q "fm-inbox.sh note --request-id req-9" "$tmp/dry.txt"
"$HD" answers --since-offset 0 >/dev/null
"$here/hd-bridge.sh" >/dev/null
log="$FM_HOME/calls.log"
check "bridge: held decision is a keyed answer" grep -qF "hold answers --source harbordeck | held-1	ship	Ship today	done" "$log"
check "bridge: unheld decision falls back to a note" grep -qF 'inbox note --request-id hd-free-1-decide-2 -- HarborDeck decide on free-1 "Palette?": warm (Warm) - cozier' "$log"
check "bridge: needs-work releases and notes" grep -qF "held-2	needs-work: slower voice		release" "$log"
check "bridge: needs-work note says how to reply" grep -qF "HarborDeck needs-work on held-2 \"Video\": slower voice. Reply: $HD reply held-2" "$log"
check "bridge: ask becomes a note" grep -qF "request-id hd-res-1-ask-4" "$log"
check "bridge: filing an answer sends nothing" test "$(grep -c 'res-1-file' "$log")" = 0
check "bridge: filing a todo reports done" grep -qF "HarborDeck file on td-1 \"Sign form\": done" "$log"
check "bridge: request keeps its id" grep -qF "request-id req-9 -- HarborDeck request for sm: Add dark theme" "$log"
check "bridge: decided items resolved" test "$(jq -r .status "$HARBORDECK_HOME/items/held-1.json")" = resolved
check "bridge: asked item stays open" test "$(jq -r .status "$HARBORDECK_HOME/items/held-2.json")" = open
before=$(wc -l < "$log")
"$here/hd-bridge.sh" >/dev/null
check "bridge: second run routes nothing" test "$(wc -l < "$log")" = "$before"

# live: --follow routes a new answer without being re-run
"$here/hd-bridge.sh" --follow >/dev/null 2>&1 &
follower=$!
sleep 1
echo '{"id":"res-1","action":"comment","note":"live one","at":8}' >> "$HARBORDECK_HOME/answers.jsonl"
for _ in $(seq 1 50); do grep -q 'hd-res-1-comment-8' "$log" && break; sleep 0.1; done
kill "$follower" 2>/dev/null; wait "$follower" 2>/dev/null || true
check "bridge --follow: new answer routed live" grep -q 'hd-res-1-comment-8' "$log"

# hd-live: bridge follows, snapshots refresh, everything stops together
rm -f "$HARBORDECK_HOME/fleet.json" "$HARBORDECK_HOME/rules.json"
cp "$tmp/quota.json" "$tmp/qa.json"
mkdir -p "$tmp/qbin"; printf '#!/usr/bin/env bash\ncat "%s"\n' "$tmp/qa.json" > "$tmp/qbin/quota-axi"; chmod +x "$tmp/qbin/quota-axi"
PATH="$tmp/qbin:$PATH" HD_FLEET_EVERY=1 "$here/hd-live.sh" "$tmp/prefs.md" >/dev/null 2>&1 &
live=$!
sleep 1.5
echo '{"id":"res-1","action":"ask","note":"live two","at":9}' >> "$HARBORDECK_HOME/answers.jsonl"
for _ in $(seq 1 50); do grep -q 'hd-res-1-ask-9' "$log" && break; sleep 0.1; done
check "hd-live: answer routed live" grep -q 'hd-res-1-ask-9' "$log"
check "hd-live: fleet and rules written" test -s "$HARBORDECK_HOME/fleet.json" -a -s "$HARBORDECK_HOME/rules.json"
kill "$live"; wait "$live" 2>/dev/null || true; sleep 0.3
check "hd-live: no processes left behind" bash -c "! pgrep -f 'hd-bridge.sh --follow' >/dev/null"

[ "$fails" = 0 ] && echo "all adapter tests passed" || { echo "$fails failed"; exit 1; }
