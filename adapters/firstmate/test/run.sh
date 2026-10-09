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
if [ "$1" = open ]; then case $2 in held-1|held-2|held-3) exit 0 ;; *) exit 1 ;; esac; fi
if [ "$1" = hold ]; then printf 'hold %s\n' "$*" >> "$FM_HOME/calls.log"; exit 0; fi
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
case $1 in a) echo "state: working · source: pane · busy" ;; b) echo "state: ${B_STATE:-parked} · source: run-step · gate" ;; *) echo "state: unknown · source: none" ;; esac
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

# who's waiting: crew blocked/paused on an item by id, hold question (<task>.qN) or topic
"$HD" batch >/dev/null <<'EOF'
decision b.q1 "Which palette?" --opt warm+ --opt cool
decision by-topic "Ship it?" --opt yes -t b
todo for-a "Busy crew's item" -t a
EOF
"$here/hd-fleet.sh" >/dev/null
w() { jq -c '.waiting // []' "$HARBORDECK_HOME/items/$1.json"; }
check "waiting: crew on its own item" test "$(w b)" = '["b"]'
check "waiting: hold question and topic match" test "$(w b.q1)$(w by-topic)" = '["b"]["b"]'
check "waiting: working crew blocks nothing" test "$(w for-a)" = '[]'
check "waiting: not an edit, updated untouched" test "$(jq -r '.updated // "none"' "$HARBORDECK_HOME/items/b.json")" = none
ino=$(ls -i "$HARBORDECK_HOME/items/b.json" | awk '{print $1}')
"$here/hd-fleet.sh" >/dev/null
check "waiting: unchanged refresh writes nothing" test "$(ls -i "$HARBORDECK_HOME/items/b.json" | awk '{print $1}')" = "$ino"
B_STATE=working "$here/hd-fleet.sh" >/dev/null
check "waiting: cleared once the crew works again" test "$(w b)$(w by-topic)" = '[][]'
"$HD" resolve b.q1 by-topic for-a >/dev/null

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
# newer quota-axi: no windowSeconds; length inferred from id/kind, model windows kept
cat > "$tmp/quota-new.json" <<'EOF'
{"providers":[
 {"provider":"claude","windows":[
   {"id":"five_hour","label":"session","kind":"session","resetsAt":"2026-10-08T13:09:59.985382+00:00","percentRemaining":80},
   {"id":"seven_day","label":"weekly","kind":"weekly","resetsAt":"2026-10-08T11:59:59.985404+00:00","percentRemaining":84},
   {"id":"model:fable","label":"Fable week","kind":"model","resetsAt":"2026-10-08T11:59:59.985563+00:00","percentRemaining":75}]},
 {"provider":"codex","windows":[]}]}
EOF
check "quota: windows without windowSeconds" test "$("$here/hd-quota.sh" --print --from-json "$tmp/quota-new.json" 2>/dev/null | jq -c '.')" = \
  '[{"name":"Claude","window":"5h","used_pct":20,"resets_at":1791464999},{"name":"Claude","window":"7d","used_pct":16,"resets_at":1791460799},{"name":"Claude","model":"Fable","window":"7d","used_pct":25,"resets_at":1791460799}]'
# reading time and projected run-out (quota-axi schema 5): at from the provider refresh, runs_out_at only on the
# limiting window and only when it comes before that window's reset; other providers pass through
cat > "$tmp/quota-runway.json" <<'EOF'
{"generatedAt":"2026-10-08T09:00:00Z","providers":[
 {"provider":"claude","state":{"refreshedAt":"2026-10-08T08:58:00.123Z"},
  "quotaSemantics":{"effectiveAvailability":[
   {"scope":"all_models","runway":{"status":"projected_exhaustion","projectedExhaustedAt":"2026-10-08T12:30:00Z","limitingWindowId":"five_hour"}},
   {"scope":"model:fable","runway":{"status":"projected_exhaustion","projectedExhaustedAt":"2026-10-20T00:00:00Z","limitingWindowId":"model:fable"}}]},
  "windows":[
   {"id":"five_hour","kind":"session","resetsAt":"2026-10-08T13:00:00Z","percentRemaining":40},
   {"id":"model:fable","label":"Fable week","kind":"model","resetsAt":"2026-10-12T00:00:00Z","percentRemaining":90}]},
 {"provider":"acme","windows":[{"id":"day","resetsAt":"2026-10-09T00:00:00Z","percentUsed":5,"windowSeconds":86400}]}]}
EOF
check "quota: reading time, run-out before reset, any provider" test "$("$here/hd-quota.sh" --print --from-json "$tmp/quota-runway.json" 2>/dev/null | jq -c '.')" = \
  '[{"name":"Claude","window":"5h","used_pct":60,"resets_at":1791464400,"at":1791449880,"runs_out_at":1791462600},{"name":"Claude","model":"Fable","window":"7d","used_pct":10,"resets_at":1791763200,"at":1791449880},{"name":"acme","window":"1d","used_pct":5,"resets_at":1791504000,"at":1791450000}]'

# rules
printf '# Prefs\n\n- Never ship a release on Fridays.\n- Keep infra under $30/mo. {#budget-30}\n  - nested detail is ignored\n* Never ship a release on Fridays, holidays too.\n' > "$tmp/prefs.md"
"$here/hd-rules.sh" "$tmp/prefs.md" >/dev/null
rules="$HARBORDECK_HOME/rules.json"
check "rules: slug keys, explicit keys, dedupe" test "$(jq -c 'keys_unsorted' "$rules")" = '["never-ship-a-release-on-fridays","budget-30","never-ship-a-release-on-fridays-2"]'
check "rules: text and source" test "$(jq -c '.["budget-30"]' "$rules")" = '{"text":"Keep infra under $30/mo.","source":"prefs.md:4"}'

# rules: a trailing {@id} links the order to the Remember-this message it came from
printf -- '- Never use max effort. {#no-max} {@req-1-2}\n- Plain rule.\n' > "$tmp/prefs-sent.md"
check "rules: {@id} becomes answer" test "$("$here/hd-rules.sh" "$tmp/prefs-sent.md" --print | jq -c '.["no-max"], .["plain-rule"]' | tr -d '\n')" = \
  '{"text":"Never use max effort.","source":"prefs-sent.md:1","answer":"req-1-2"}{"text":"Plain rule.","source":"prefs-sent.md:2"}'

# bridge
"$HD" batch >/dev/null <<'EOF'
decision held-1 "Ship 2.4?" --opt "ship+=Ship today" --opt hold
decision free-1 "Palette?" --opt warm --opt cool
review held-2 "Video"
answer res-1 "Research"
todo td-1 "Sign form"
decision held-3.q2 "Hosting?" --opt edge+ --opt mac
decision free-2 "Later maybe?" --opt yes+ --opt no
EOF
cat > "$HARBORDECK_HOME/answers.jsonl" <<'EOF'
{"id":"held-1","action":"decide","key":"ship","note":"","at":1}
{"id":"free-1","action":"decide","key":"warm","note":"cozier","at":2}
{"id":"held-2","action":"needs-work","note":"slower voice","at":3}
{"id":"res-1","action":"ask","note":"why host B?","at":4}
{"id":"res-1","action":"file","note":"","at":5}
{"id":"td-1","action":"file","note":"","at":6}
{"id":"req-9","action":"request","note":"Add dark theme","to":"sm","at":7}
{"id":"held-3.q2","action":"defer","until":1791540000,"note":"","at":10}
{"id":"free-2","action":"defer","until":1791540000,"note":"","at":11}
{"id":"req-10","action":"request","note":"Never use max effort","to":"sm","rule":true,"at":12}
{"id":"res-1","action":"needs-work","note":"always cite sources","rule":true,"at":13}
EOF
day=$(date -r 1791540000 +%Y-%m-%d 2>/dev/null || date -d @1791540000 +%Y-%m-%d)
"$here/hd-bridge.sh" --dry-run > "$tmp/dry.txt"
check "bridge: dry run touches nothing" test ! -e "$FM_HOME/calls.log"
check "bridge: dry run lists routes" grep -q "fm-inbox.sh note --request-id req-9" "$tmp/dry.txt"
cp -R "$HARBORDECK_HOME" "$tmp/hd-echo"
HARBORDECK_HOME="$tmp/hd-echo" "$here/hd-bridge.sh" --echo > "$tmp/echo.txt" 2>/dev/null
check "bridge --echo: touches no firstmate state" test ! -e "$FM_HOME/calls.log"
check "bridge --echo: held decision would close the hold" grep -qE '^[0-9TZ:-]+ would run: printf .*held-1.*fm-captain-hold.sh answers --source harbordeck' "$tmp/echo.txt"
check "bridge --echo: unheld decision would note instead" grep -qF "hd-free-1-decide-2" "$tmp/echo.txt"
check "bridge --echo: harbordeck side still resolves" test "$(jq -r .status "$tmp/hd-echo/items/held-1.json")" = resolved
check "bridge --echo: own cursor advanced, live cursor untouched" test -s "$tmp/hd-echo/cursors/firstmate-bridge.echo" -a ! -e "$tmp/hd-echo/cursors/firstmate-bridge"
HARBORDECK_HOME="$tmp/hd-echo" "$here/hd-bridge.sh" --echo > "$tmp/echo2.txt" 2>/dev/null
check "bridge --echo: second run routes nothing" test ! -s "$tmp/echo2.txt"
"$HD" answers --since-offset 0 >/dev/null
"$here/hd-bridge.sh" >/dev/null 2>&1
log="$FM_HOME/calls.log"
check "bridge: held decision is a keyed answer" grep -qF "hold answers --source harbordeck | held-1	ship	Ship today	done" "$log"
check "bridge: unheld decision falls back to a note" grep -qF 'inbox note --request-id hd-free-1-decide-2 -- HarborDeck decide on free-1 "Palette?": warm (Warm) - cozier' "$log"
check "bridge: needs-work releases and notes" grep -qF "held-2	needs-work: slower voice		release" "$log"
check "bridge: needs-work note says how to reply" grep -qF "HarborDeck needs-work on held-2 \"Video\": slower voice. Reply: $HD reply held-2" "$log"
check "bridge: ask becomes a note" grep -qF "request-id hd-res-1-ask-4" "$log"
check "bridge: filing an answer sends nothing" test "$(grep -c 'res-1-file' "$log")" = 0
check "bridge: filing a todo reports done" grep -qF "HarborDeck file on td-1 \"Sign form\": done" "$log"
check "bridge: request keeps its id" grep -qF "request-id req-9 -- HarborDeck request for sm: Add dark theme" "$log"
check "bridge: rule request carries Standing order" grep -qF "request-id req-10 -- HarborDeck request for sm: Never use max effort. Standing order: file it in your captain preferences" "$log"
check "bridge: rule note names the answer id" grep -qF "(answer id req-10)" "$log"
check "bridge: rule on needs-work carries Standing order" grep -qE "request-id hd-res-1-needs-work-13 -- .*always cite sources\. Standing order:" "$log"
check "bridge: plain request has no Standing order" test "$(grep -F 'request-id req-9 ' "$log" | grep -c 'Standing order')" = 0
check "bridge: decided items resolved" test "$(jq -r .status "$HARBORDECK_HOME/items/held-1.json")" = resolved
check "bridge: Later on a question defers its held task" grep -qF "hold hold held-3 --reason captain deferred held-3.q2 on HarborDeck until $day --until $day" "$log"
check "bridge: Later on an unheld item is a note" grep -qF "request-id hd-free-2-defer-11 -- HarborDeck defer on free-2 \"Later maybe?\": later, back on the desk $day" "$log"
check "bridge: deferred item stays open" test "$(jq -r .status "$HARBORDECK_HOME/items/held-3.q2.json")" = open
check "bridge: asked item stays open" test "$(jq -r .status "$HARBORDECK_HOME/items/held-2.json")" = open
before=$(wc -l < "$log")
"$here/hd-bridge.sh" >/dev/null 2>&1
check "bridge: second run routes nothing" test "$(wc -l < "$log")" = "$before"

# live: --follow routes a new answer without being re-run
"$here/hd-bridge.sh" --follow >/dev/null 2> "$tmp/follow.err" &
follower=$!
sleep 1
echo '{"id":"res-1","action":"comment","note":"live one","at":8}' >> "$HARBORDECK_HOME/answers.jsonl"
for _ in $(seq 1 50); do grep -q 'hd-res-1-comment-8' "$log" && break; sleep 0.1; done
kill "$follower" 2>/dev/null; wait "$follower" 2>/dev/null || true
check "bridge --follow: new answer routed live" grep -q 'hd-res-1-comment-8' "$log"
check "bridge --follow: logs start and each route with a time" bash -c "grep -qE '^[0-9TZ:-]+ hd-bridge: following ' '$tmp/follow.err' && grep -qE '^[0-9TZ:-]+ hd-bridge: routed comment res-1' '$tmp/follow.err'"

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
kids=$(pgrep -P "$live" | tr '\n' ' ')
kill "$live"; wait "$live" 2>/dev/null || true; sleep 0.3
check "hd-live: no processes left behind" bash -c "for p in $kids; do ! kill -0 \$p 2>/dev/null || exit 1; done"

# install.sh: fake HOME, stub launchctl, the stub firstmate home
ih="$tmp/ihome"; mkdir -p "$ih" "$tmp/lbin"
# Stub launchctl modelled on launchd: bootout returns while the old agent is still going away, and a
# bootstrap before it is gone fails with "5: Input/output error" (what left the real agent unloaded).
cat > "$tmp/lbin/launchctl" <<STUB
#!/usr/bin/env bash
st="$tmp/launchd"; echo "launchctl \$*" >> "$tmp/launchctl.log"
gone() { n=\$(cat "\$st.going" 2>/dev/null) || return 0; [ "\$n" -le 0 ] && { rm -f "\$st.going" "\$st"; return 0; }; echo \$((n - 1)) > "\$st.going"; return 1; }
case \$1 in
  bootout) [ ! -e "\$st" ] || echo 3 > "\$st.going" ;;
  print) gone && [ ! -e "\$st" ] && exit 113; echo "state = running" ;;
  bootstrap) gone || { echo "Bootstrap failed: 5: Input/output error" >&2; exit 5; }; touch "\$st" ;;
esac
STUB
chmod +x "$tmp/lbin/launchctl"
mkdir -p "$FM_HOME/data"; printf '# Captain preferences\n\n- Keep it short.\n' > "$FM_HOME/data/captain.md"
inst() { HOME="$ih" PATH="$tmp/lbin:$PATH" HARBORDECK_HOME= "$here/install.sh" --fm-home "$FM_HOME" --data-dir "$ih/hd" "$@" >/dev/null; }
echo '{"id":"x","action":"file","at":1}' > "$tmp/ans"; mkdir -p "$ih/hd"; cp "$tmp/ans" "$ih/hd/answers.jsonl"
inst --mode echo
check "install: re-install over a running agent succeeds" inst --mode echo
check "install: cli linked" test "$(readlink "$ih/.local/bin/harbordeck")" = "$root/cli/bin/harbordeck.js"
if [ "$(uname)" = Darwin ]; then settings="$ih/Library/Application Support/Harbor Deck/settings.json"; else settings="$ih/.config/Harbor Deck/settings.json"; fi
check "install: app points at the data dir and firstmate home" test "$(jq -c '[.dataDir, .artifactRoot]' "$settings")" = "[\"$ih/hd\",\"$FM_HOME\"]"
check "install: bridge starts after existing answers" test "$(cat "$ih/hd/cursors/firstmate-bridge")" = "$(wc -c < "$tmp/ans" | tr -d ' ')"
check "install: one standing order block after two runs" test "$(grep -c '{#harbordeck}' "$FM_HOME/data/captain.md")" = 1
check "install: captain prefs kept" grep -qx -- '- Keep it short.' "$FM_HOME/data/captain.md"
check "install: instructions filled in" grep -qF "HARBORDECK_FROM=mate-main" "$FM_HOME/data/harbordeck.md"
"$here/hd-rules.sh" "$FM_HOME/data/captain.md" --print > "$tmp/r.json"
check "install: block is one standing order" test "$(jq -c 'keys' "$tmp/r.json")" = '["harbordeck","keep-it-short"]'
if [ "$(uname)" = Darwin ]; then
  plist="$ih/Library/LaunchAgents/dev.harbordeck.firstmate.plist"
  check "install: launchd agent runs hd-live in echo mode" bash -c "plutil -lint '$plist' >/dev/null && grep -q '<string>echo</string>' '$plist' && grep -q 'hd-live.sh' '$plist'"
  check "install: agent (re)started" test "$(grep -c 'launchctl bootstrap' "$tmp/launchctl.log")" -ge 2
  check "install: re-install waits out the old agent, then it runs" test -e "$tmp/launchd" -a ! -e "$tmp/launchd.going"
fi
if [ "$(uname)" = Darwin ]; then
  echo '{"id":"y","action":"file","at":2}' >> "$ih/hd/answers.jsonl"
  inst --mode live
  check "install: echo -> live skips answers seen in echo mode" test "$(cat "$ih/hd/cursors/firstmate-bridge")" = "$(wc -c < "$ih/hd/answers.jsonl" | tr -d ' ')"
  check "install: live mode in the agent" grep -q '<string>live</string>' "$plist"
  # answers written while the bridge was down: never routed silently, never dropped silently
  off=$(cat "$ih/hd/cursors/firstmate-bridge")
  echo '{"id":"z","action":"decide","key":"merge","at":3}' >> "$ih/hd/answers.jsonl"
  : > "$tmp/launchctl.log"
  rc=0; HOME="$ih" PATH="$tmp/lbin:$PATH" HARBORDECK_HOME= "$here/install.sh" --fm-home "$FM_HOME" --data-dir "$ih/hd" --mode live >/dev/null 2> "$tmp/pending.err" || rc=$?
  check "install: unrouted answers stop a re-install untouched" test "$rc" = 2 -a "$(cat "$ih/hd/cursors/firstmate-bridge")" = "$off" -a ! -s "$tmp/launchctl.log"
  check "install: and are listed" grep -qF '"id":"z"' "$tmp/pending.err"
  inst --mode live --pending deliver
  check "install: --pending deliver keeps the cursor" test "$(cat "$ih/hd/cursors/firstmate-bridge")" = "$off"
  inst --mode live --pending skip
  check "install: --pending skip moves past them" test "$(cat "$ih/hd/cursors/firstmate-bridge")" = "$(wc -c < "$ih/hd/answers.jsonl" | tr -d ' ')"
fi
inst --uninstall
check "uninstall: block, instructions and links removed" bash -c "! grep -q harbordeck '$FM_HOME/data/captain.md' && [ ! -e '$FM_HOME/data/harbordeck.md' ] && [ ! -e '$ih/.local/bin/hd' ]"
check "uninstall: captain prefs intact" test "$(cat "$FM_HOME/data/captain.md")" = "$(printf '# Captain preferences\n\n- Keep it short.')"

[ "$fails" = 0 ] && echo "all adapter tests passed" || { echo "$fails failed"; exit 1; }
