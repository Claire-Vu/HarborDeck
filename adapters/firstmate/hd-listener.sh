#!/usr/bin/env bash
# hd-listener.sh - make sure a firstmate session acts on what HarborDeck sends it.
#
# Usage: FM_HOME=<home> hd-listener.sh status            print "<state> <reason>"
#        FM_HOME=<home> hd-listener.sh ensure [--echo]   while a HarborDeck note is unread: wake or start firstmate unless it acts anyway
#        FM_HOME=<home> hd-listener.sh send <message>    type one message to the session, starting one if none (wake.sh)
#
# An inbox note only appends a wake to the home's queue; something must consume it. `ensure` acts only while a note
# HarborDeck wrote (request id hd-* or req-*) is still unacknowledged (`fm-inbox.sh receipts`), so the bridge can
# call it after every route and again on a timer: it re-wakes a session that never took the turn, and stops once
# firstmate has drained the note. --echo skips that check (echo mode writes no notes). States:
#   listening  a session sits at its prompt with the home's watcher live (`fm-inbox.sh ready`: can_receive, and its
#              bin/fm-watch.sh runs). The watcher never presents an inbox note (it surfaces only process-event checks;
#              notes wait for the next drain), so ensure types a wake here too
#   idle       a session is open with no watcher (opened with no turn yet, or its watcher died): ensure types a wake
#   busy       the session holding the home lock is mid-turn (herdr says working): the bridge checks again after it
#   waking     HarborDeck typed a wake less than HD_LISTENER_GRACE seconds ago
#   starting   HarborDeck started a session less than HD_LISTENER_GRACE seconds ago
#   down       no session runs for this home: ensure starts one (HD_FM_START herdr or tmux), else it stays down
#   unknown    the home cannot say (no fm-inbox.sh ready)
# The session is the lock holder (state/.lock), else the newest agent process whose working directory is FM_HOME
# (a session opened but not yet started). Its pane comes from that process's own environment (HERDR_PANE_ID,
# HERDR_SESSION; TMUX_PANE and TMUX, its tmux server), so only this home's session is ever typed into. Typing goes through the home's
# bin/fm-send.sh. Starting creates a tab in the herdr workspace labeled HD_WAKE_WORKSPACE (default firstmate;
# the workspace is created when missing) in the running herdr server, starts HD_FM_HARNESS (default claude) there
# with `herdr agent start`, then types the first message. It never starts herdr itself. HD_FM_START=tmux instead
# opens a window in tmux session HD_FM_TMUX_SESSION (default firstmate, created if missing) on this process's tmux
# server (TMUX_TMPDIR) running HD_FM_COMMAND (default claude) with the message as its first prompt. Each wake or start is
# recorded in <HARBORDECK_HOME>/cursors/firstmate-listener, so a burst of answers wakes or starts once.
# Exit: status 0; ensure 0, or 1 when the session could not be woken or started; send: fm-send's code
# (0 confirmed, 3 typed but unconfirmed), 75 when no session runs and none could be started, 2 on bad setup.
# Env: FM_HOME (required), HD (default harbordeck, else this checkout's CLI), HD_FM_START (herdr|tmux|off, default herdr), HD_FM_HARNESS,
# HD_WAKE_WORKSPACE, HD_WAKE_SESSION (herdr session, default "default"), HD_LISTENER_GRACE (default 180).
set -euo pipefail

FM_HOME=${FM_HOME:?set FM_HOME to the firstmate home}
HOME_AS_GIVEN=$FM_HOME
FM_HOME=$(cd "$FM_HOME" && pwd -P)
export FM_HOME   # fm-send and fm-inbox refuse to guess their home
HD=${HD:-$(command -v harbordeck || echo "$(cd "$(dirname "$0")/../.." && pwd)/cli/bin/harbordeck.js")}
GRACE=${HD_LISTENER_GRACE:-180}
START=${HD_FM_START:-herdr}
LABEL=${HD_WAKE_WORKSPACE:-firstmate}
HSESSION=${HD_WAKE_SESSION:-default}
WAKE="HarborDeck: the captain sent you something on the desk. It is in your inbox: drain your wakes now (run your session start first if this session has not) and act on each HarborDeck note."

log() { printf '%s hd-listener: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }

record_file() { printf '%s/cursors/firstmate-listener' "$("$HD" path)"; }
record() {  # <waking|starting> <target>
  local f; f=$(record_file); mkdir -p "$(dirname "$f")"
  printf '%s %s %s\n' "$1" "$(date +%s)" "$2" > "$f.tmp" && mv "$f.tmp" "$f"
}
recent() {  # -> "<waking|starting> <target>" when one is younger than GRACE
  local f what at target; f=$(record_file)
  { read -r what at target < "$f"; } 2>/dev/null || return 1
  [ $(( $(date +%s) - at )) -lt "$GRACE" ] || return 1
  printf '%s %s\n' "$what" "$target"
}

pane_env() {  # <pid> <var> -> value from the process's own environment
  if [ -r "/proc/$1/environ" ]; then tr '\0' '\n' < "/proc/$1/environ" | sed -n "s/^$2=//p" | head -n 1
  else ps -E -ww -o command= -p "$1" 2>/dev/null | tr ' ' '\n' | sed -n "s/^$2=//p" | head -n 1; fi
}

target_of() {  # <pid> -> fm-send target for the pane the process runs in, or nothing
  local pane tp
  pane=$(pane_env "$1" HERDR_PANE_ID)
  if [ -n "$pane" ]; then printf '%s:%s\n' "$(pane_env "$1" HERDR_SESSION | grep . || echo default)" "$pane"; return; fi
  tp=$(pane_env "$1" TMUX_PANE)
  # through the session's own tmux server (a private socket, e.g. a lab's), not whichever one this process reaches
  [ -z "$tp" ] || TMUX=$(pane_env "$1" TMUX) tmux display-message -p -t "$tp" '#{session_name}:#{window_index}.#{pane_index}' 2>/dev/null || true
}

secs() {  # ps etime ([[dd-]hh:]mm:ss) -> seconds
  local t=$1 d=0 h=0 m s
  case $t in *-*) d=${t%%-*}; t=${t#*-} ;; esac
  s=${t##*:}; t=${t%:*}; m=${t##*:}
  [ "$t" = "$m" ] || h=${t%:*}
  echo $(( 10#$d * 86400 + 10#$h * 3600 + 10#$m * 60 + 10#$s ))
}

newest_session() {  # -> pid of the youngest agent process whose working directory is FM_HOME, or nothing
  local pids p best='' best_age='' age
  pids=$(ps -Ao pid=,comm= | awk '{n = $2; sub(".*/", "", n)} n ~ /^(claude|codex|grok|cursor-agent|kimi|omp|pi|opencode)(\.exe)?$/ {print $1}' | paste -sd, -)
  [ -n "$pids" ] || return 0
  # one lsof for all of them: "p<pid>" then "n<cwd>" per process
  for p in $(lsof -a -d cwd -p "$pids" -Fpn 2>/dev/null | awk -v h="$FM_HOME" '/^p/ {p = substr($0, 2)} /^n/ && substr($0, 2) == h {print p}'); do
    age=$(secs "$(ps -o etime= -p "$p" | tr -d ' ')")
    if [ -z "$best" ] || [ "$age" -lt "$best_age" ]; then best=$p; best_age=$age; fi
  done
  printf '%s' "$best"
}

watching() {  # a live watcher for this home: its own bin/fm-watch.sh, running (ready's beacon stays fresh for minutes after one dies)
  pgrep -f -- "$FM_HOME/bin/fm-watch.sh" >/dev/null 2>&1 || pgrep -f -- "$HOME_AS_GIVEN/bin/fm-watch.sh" >/dev/null 2>&1
}

READY='' PID='' TARGET='' RECENT='' TMUXV=''
unread() {  # -> number of HarborDeck notes firstmate has not acknowledged yet
  "$FM_HOME/bin/fm-inbox.sh" receipts --all-pending 2>/dev/null \
    | jq -r '[.pending[]? | select((.request_id // "") | test("^(hd-|req-)"))] | length' 2>/dev/null | grep . || echo 0
}

probe() {  # sets STATE, WHY, PID, TARGET, RECENT (the pane of a wake or start younger than GRACE)
  local can lock live why r watcher=no
  STATE=unknown WHY='' PID='' TARGET='' RECENT=''
  READY=$("$FM_HOME/bin/fm-inbox.sh" ready 2>/dev/null) || { WHY="fm-inbox.sh ready failed"; return 0; }
  can=$(jq -r '.can_receive' <<<"$READY"); lock=$(jq -r '.lock.state' <<<"$READY"); live=$(jq -r '.lock.live_harness' <<<"$READY")
  why=$(jq -r '.wake_consumer.reason // "?"' <<<"$READY")
  if [ "$lock" = held ] && [ "$live" = true ]; then PID=$(jq -r '.lock.pid // empty' <<<"$READY"); else PID=$(newest_session); fi
  [ -z "$PID" ] || { TARGET=$(target_of "$PID"); TMUXV=$(pane_env "$PID" TMUX); }
  ! r=$(recent) || RECENT=${r#* }
  if [ -n "$RECENT" ]; then STATE=${r%% *} WHY="HarborDeck is ${r%% *} it in $RECENT"; return 0; fi
  [ "$can" != true ] || ! watching || watcher=yes
  if [ -z "$PID" ]; then
    if [ "$watcher" = yes ]; then STATE=listening WHY="watcher live, but no session found to type into"; else STATE=down WHY="no firstmate session for $FM_HOME"; fi
    return 0
  fi
  if [ "$lock" = held ] && [ "${TARGET%%:*}" = "$HSESSION" ] && [ "$(herdr agent get "${TARGET#*:}" 2>/dev/null | jq -r '.result.agent.agent_status // ""')" = working ]; then
    STATE=busy WHY="mid-turn in ${TARGET:-pid $PID}; the bridge checks again after this turn"; return 0
  fi
  if [ "$watcher" = yes ]; then STATE=listening WHY="watcher live in session pid $PID in ${TARGET:-an unknown pane}"; return 0; fi
  [ "$can" != true ] || why="beacon fresh but no fm-watch.sh running"
  STATE=idle WHY="session pid $PID in ${TARGET:-an unknown pane}, no watcher ($why)"
}

tmux_env() {  # a tmux pane: point tmux (TMUX, TMUX_TMPDIR) at that pane's own server, as its processes see it
  [ -n "$TMUXV" ] || return 0
  export TMUX=$TMUXV TMUX_TMPDIR; TMUX_TMPDIR=$(dirname "$(dirname "${TMUXV%%,*}")")
}

type_into() {  # <target> <message> -> fm-send's exit code
  ( tmux_env; "$FM_HOME/bin/fm-send.sh" "$1" "$2" >&2 )
}

start_tmux() {  # <first message>: a window in tmux session HD_FM_TMUX_SESSION (on this process's tmux server,
  local s=${HD_FM_TMUX_SESSION:-firstmate} cmd t  # TMUX_TMPDIR) running HD_FM_COMMAND with the message as its first prompt
  cmd="${HD_FM_COMMAND:-claude} $(printf '%q' "$1")"
  if tmux has-session -t "=$s" 2>/dev/null; then t=$(tmux new-window -d -P -F '#{session_name}:#{window_index}' -t "=$s:" -n firstmate -c "$FM_HOME" "$cmd")
  else t=$(tmux new-session -d -P -F '#{session_name}:#{window_index}' -s "$s" -n firstmate -c "$FM_HOME" "$cmd"); fi || { log "tmux unavailable, cannot start firstmate"; return 75; }
  [ -n "$t" ] || { log "tmux made no window"; return 1; }
  record starting "$t"
  log "started ${HD_FM_COMMAND:-claude} in tmux window $t for $FM_HOME, the wake as its first prompt"
  printf '%s\n' "$t"
}

start_session() {  # <first message> -> 0 started (target on stdout), 75 cannot start here
  local spaces ws out pane
  case "$START" in herdr|tmux) ;; *) log "not starting firstmate (HD_FM_START=$START)"; return 75 ;; esac
  [ -x "$FM_HOME/bin/fm-session-start.sh" ] || { log "not starting firstmate: $FM_HOME is not a firstmate home"; return 75; }
  [ "$START" = herdr ] || { start_tmux "$1"; return; }
  [ "$HSESSION" = default ] || { log "starting only in the default herdr session, not $HSESSION"; return 75; }
  spaces=$(herdr workspace list 2>&1) || { log "herdr unavailable, cannot start firstmate: ${spaces:0:200}"; return 75; }
  ws=$(jq -r --arg l "$LABEL" '[.result.workspaces[] | select(.label == $l) | .workspace_id][0] // empty' <<<"$spaces")
  if [ -n "$ws" ]; then out=$(herdr tab create --workspace "$ws" --cwd "$FM_HOME" --label firstmate --no-focus)
  else out=$(herdr workspace create --cwd "$FM_HOME" --label "$LABEL" --no-focus); fi
  pane=$(jq -r '.result.root_pane.pane_id // empty' <<<"$out")
  [ -n "$pane" ] || { log "herdr made no pane: ${out:0:200}"; return 1; }
  record starting "$HSESSION:$pane"
  log "starting ${HD_FM_HARNESS:-claude} in herdr pane $HSESSION:$pane (workspace $LABEL) for $FM_HOME"
  herdr agent start "$LABEL" --kind "${HD_FM_HARNESS:-claude}" --pane "$pane" --timeout 120000 >/dev/null || { log "herdr agent start failed in $pane"; return 1; }
  type_into "$HSESSION:$pane" "$1" || true
  printf '%s\n' "$HSESSION:$pane"
}

cmd=${1:-}; [ "$#" = 0 ] || shift
case "$cmd" in
  status)
    probe; printf '%s %s\n' "$STATE" "$WHY" ;;
  ensure)
    echo_mode=0; [ "${1:-}" != --echo ] || echo_mode=1
    lockd="$(dirname "$(record_file)")/firstmate-listener.lock"; mkdir -p "$(dirname "$lockd")"
    for _ in $(seq 1 50); do  # one decision at a time: two routes must not start two sessions
      if mkdir "$lockd" 2>/dev/null; then trap 'rmdir "$lockd" 2>/dev/null || true' EXIT; break; fi; sleep 0.2
    done
    # all read: a wake HarborDeck recorded was taken, so the desk shows the session as it is, not "being woken"
    if [ "$echo_mode" = 0 ] && [ "$(unread)" = 0 ]; then rm -f "$(record_file)"; echo "clear: firstmate has read everything HarborDeck sent"; exit 0; fi
    probe
    case "$STATE" in
      idle|listening)  # the watcher presents no inbox note, so an open session at its prompt gets the wake either way
        if [ -z "$TARGET" ]; then log "session ${PID:+pid $PID }has no pane to type into"; printf '%s %s\n' "$STATE" "$WHY"; exit 1; fi
        if [ "$echo_mode" = 1 ]; then printf 'would run: %q %q %q\n' "$FM_HOME/bin/fm-send.sh" "$TARGET" "$WAKE"; printf '%s %s\n' "$STATE" "$WHY"; exit 0; fi
        record waking "$TARGET"
        rc=0; type_into "$TARGET" "$WAKE" || rc=$?
        if [ "$rc" = 0 ] || [ "$rc" = 3 ]; then printf 'waking typed a wake into %s\n' "$TARGET"; else printf '%s wake failed (fm-send exit %s)\n' "$STATE" "$rc"; exit 1; fi ;;
      down)
        if [ "$echo_mode" = 1 ]; then printf 'would start firstmate (%s) for %s\n' "$START" "$FM_HOME"; printf 'down %s\n' "$WHY"; exit 0; fi
        rc=0; t=$(start_session "$WAKE") || rc=$?
        if [ "$rc" = 0 ]; then printf 'starting firstmate in %s\n' "$t"; else printf 'down %s; could not start one\n' "$WHY"; exit 1; fi ;;
      *) printf '%s %s\n' "$STATE" "$WHY" ;;
    esac ;;
  send)
    msg=${1:-}; [ -n "$msg" ] || { echo "hd-listener: send needs a message" >&2; exit 2; }
    [ -x "$FM_HOME/bin/fm-send.sh" ] || { echo "hd-listener: $FM_HOME/bin/fm-send.sh not found" >&2; exit 2; }
    probe
    TARGET=${TARGET:-$RECENT}   # a session HarborDeck is starting has a pane before its process shows
    if [ -n "$TARGET" ]; then tmux_env; exec "$FM_HOME/bin/fm-send.sh" "$TARGET" "$msg"; fi
    [ -z "$PID" ] || { log "session pid $PID has no pane to type into"; exit 75; }
    rc=0; start_session "$msg" >/dev/null || rc=$?
    exit "$rc" ;;
  *) sed -n '2,5p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2 ;;
esac
