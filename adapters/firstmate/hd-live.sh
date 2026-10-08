#!/usr/bin/env bash
# hd-live.sh - keep a running HarborDeck in sync with a firstmate home, live.
#
# Usage: FM_HOME=<firstmate home> hd-live.sh [<preferences.md>]
#
# - Answers: runs `hd-bridge.sh --follow`, so every stamp, ask, comment or
#   request reaches firstmate the moment the app appends it.
# - Crew: refreshes fleet.json every HD_FLEET_EVERY seconds (default 10).
# - Stamina: refreshes quota.json every HD_QUOTA_EVERY seconds (default 120).
# - Standing orders: re-reads the preferences file (default
#   $FM_HOME/data/captain.md) whenever it changes.
# Items and replies need no feeder: firstmate writes them with `harbordeck`
# and the app watches the data dir. Stop with Ctrl-C; the bridge stops with it.
# Env: FM_HOME (required), HD, HD_FLEET_EVERY, HD_QUOTA_EVERY, HD_BRIDGE_MODE (live|echo;
# echo logs the firstmate commands instead of running them).
set -uo pipefail

FM_HOME=${FM_HOME:?set FM_HOME to the firstmate home}
export FM_HOME
here=$(cd "$(dirname "$0")" && pwd)
prefs=${1:-$FM_HOME/data/captain.md}
fleet_every=${HD_FLEET_EVERY:-10}
quota_every=${HD_QUOTA_EVERY:-120}

echo "hd-live: bridge mode ${HD_BRIDGE_MODE:-live}" >&2
"$here/hd-bridge.sh" --follow &
bridge=$!
trap 'kill "$bridge" 2>/dev/null; exit 0' INT TERM EXIT

rules_mtime='' last_quota=0
while :; do
  "$here/hd-fleet.sh" >/dev/null || echo "hd-live: fleet refresh failed" >&2
  now=$(date +%s)
  if [ $((now - last_quota)) -ge "$quota_every" ]; then
    "$here/hd-quota.sh" >/dev/null || echo "hd-live: quota refresh failed" >&2
    last_quota=$now
  fi
  if [ -f "$prefs" ]; then
    m=$(stat -f %m "$prefs" 2>/dev/null || stat -c %Y "$prefs")
    if [ "$m" != "$rules_mtime" ]; then
      "$here/hd-rules.sh" "$prefs" >/dev/null && rules_mtime=$m || echo "hd-live: rules refresh failed" >&2
    fi
  fi
  kill -0 "$bridge" 2>/dev/null || { echo "hd-live: bridge exited" >&2; exit 1; }
  sleep "$fleet_every"
done
