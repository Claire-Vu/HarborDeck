#!/usr/bin/env bash
# Records the live-feed evidence (test/evidence/harbor-live.mjs) of the real Electron app with the ystack
# evidence runner (~/.agents/skills/evidence). The app opens a window for the length of the run.
#
# Usage: test/evidence/run.sh [demo | real] [evidence run flags, e.g. --gif]
#   demo (default): synthetic data dir and a stub firstmate home; safe to commit or attach.
#   real: a throwaway COPY of $HARBORDECK_HOME (default ~/.harbordeck) and the firstmate home in $FM_HOME, with
#         the bridge in echo mode (firstmate commands are printed, never run). Set HD_EV_STAMP (a decision id)
#         and HD_EV_ASK (an item id). Output stays local under ~/.local/share/evidence/harbordeck-real/.
# Env: EVIDENCE (default ~/.agents/skills/evidence/bin/evidence.mjs), HD_EV_PORT (default 9333).
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
mode=${1:-demo}; [ "$#" -eq 0 ] || shift
EVIDENCE=${EVIDENCE:-$HOME/.agents/skills/evidence/bin/evidence.mjs}
port=${HD_EV_PORT:-9333}; shim_port=$((port + 1))
src=${HARBORDECK_HOME:-$HOME/.harbordeck}
tmp=$(mktemp -d)
pids=()
cleanup() { for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done; wait 2>/dev/null || true; rm -rf "$tmp"; }
trap cleanup EXIT

export HD_EV_HD="$root/cli/bin/harbordeck.js" HD_EV_HOME="$tmp/home" HD_EV_BRIDGE_LOG="$tmp/bridge.log"
export HARBORDECK_HOME="$HD_EV_HOME" HD="$HD_EV_HD" HARBORDECK_FROM=mate-main
case "$mode" in
  demo)
    project=harbordeck
    export FM_HOME="$tmp/fm" HD_EV_STAMP=ship-24 HD_EV_ASK=db-research
    mkdir -p "$FM_HOME/bin"
    # Echo mode only asks the read-only `open` predicate; ship-24 stands for a captain hold.
    printf '#!/usr/bin/env bash\n[ "$1" = open ] && [ "$2" = ship-24 ]\n' > "$FM_HOME/bin/fm-captain-hold.sh"
    chmod +x "$FM_HOME/bin/fm-captain-hold.sh"
    mkdir -p "$tmp/reports" && printf '# Hosted Postgres options\n\nNeon and Supabase both fit the budget.\n' > "$tmp/reports/db.md"
    "$HD" batch >/dev/null <<EOF
decision ship-24 "Merge PR 24 (checkout rewrite)?" -s "CI green; four fixes bundled." --opt merge+ --opt hold -a https://github.com/example/shop/pull/24 -p 2
answer db-research "Hosted Postgres for the side project" -s "Neon free tier covers it; Supabase if we want auth too." -b $tmp/reports/db.md
review onboarding-copy "Onboarding copy, round 2" -s "Shorter steps, friendlier tone."
EOF
    ;;
  real)
    project=harbordeck-real
    : "${FM_HOME:?set FM_HOME to the firstmate home}" "${HD_EV_STAMP:?set HD_EV_STAMP}" "${HD_EV_ASK:?set HD_EV_ASK}"
    mkdir -p "$HD_EV_HOME" && cp -R "$src/." "$HD_EV_HOME/"
    rm -rf "$HD_EV_HOME/answers.jsonl" "$HD_EV_HOME/cursors"
    ;;
  *) echo "usage: run.sh [demo | real] [evidence flags]" >&2; exit 2 ;;
esac

HD_BRIDGE_MODE=echo "$root/adapters/firstmate/hd-bridge.sh" --follow > "$HD_EV_BRIDGE_LOG" 2>&1 &
pids+=($!)
HARBORDECK_USER_DATA="$tmp/profile" "$root/node_modules/.bin/electron" "$root" --remote-debugging-port="$port" > "$tmp/electron.log" 2>&1 &
pids+=($!)
node "$root/test/evidence/cdp-shim.js" "http://127.0.0.1:$port" "$shim_port" > "$tmp/shim.log" 2>&1 &
pids+=($!)
for _ in $(seq 1 100); do curl -sf "http://127.0.0.1:$port/json/list" | grep -q '"page"' && break; sleep 0.2; done

rc=0
node "$EVIDENCE" run "$root/test/evidence/harbor-live.mjs" --project "$project" --attach --cdp "http://127.0.0.1:$shim_port" --repo "$root" "$@" || rc=$?
echo "bridge (echo) log:"; sed 's/^/  /' "$HD_EV_BRIDGE_LOG"
exit "$rc"
