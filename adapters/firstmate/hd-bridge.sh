#!/usr/bin/env bash
# hd-bridge.sh - route HarborDeck answers into a firstmate home.
#
# Usage: FM_HOME=<firstmate home> hd-bridge.sh [--follow | --watch <seconds>] [--dry-run | --echo]
#
# Reads answers.jsonl lines added since the last run (cursor:
# <HARBORDECK_HOME>/cursors/firstmate-bridge, advanced one line at a time, so a
# failure retries from that line on the next run) and routes each:
#   decide, approve, reject  -> bin/fm-captain-hold.sh answers (keyed answer, closes the hold)
#   needs-work               -> keyed answer with mode release (held work resumes) + inbox note
#   ask, comment, request    -> bin/fm-inbox.sh note --request-id (idempotent)
#   defer (Later stamp)      -> bin/fm-captain-hold.sh hold <task> --until <local date of until>
#                               (a <task>.qN question defers its held task), else an inbox note
#   file on a todo           -> inbox note ("done"); file on an answer -> nothing to route
# A keyed answer whose item id is not a captain-held task falls back to an
# inbox note, so no answer is ever dropped. decide/approve/reject/file also mark
# the item resolved. Item ids should therefore equal firstmate task ids when an
# item stands for a captain hold. Each note ends with the exact `harbordeck
# reply` command to answer on the desk.
# --dry-run prints the firstmate commands instead of running them and does not
# move the cursor. --echo is a safe live mode: firstmate commands are printed
# (one timestamped "would run:" line each) instead of run, while HarborDeck-side
# effects (resolve) happen and a separate cursor (firstmate-bridge.echo)
# advances, so --follow --echo can run unattended. --follow stays running and routes each answer the moment
# the app appends it (file watch via `harbordeck answers --wait`); this is the
# live on-answer hook. --watch <seconds> polls instead.
# Env: FM_HOME (required), HD (default: harbordeck), HD_BRIDGE_MODE (live|echo:
# same as passing --echo when "echo").
set -euo pipefail

FM_HOME=${FM_HOME:?set FM_HOME to the firstmate home}
HD=${HD:-harbordeck}
watch=0
follow=0
dry=0
echo_mode=0
[ "${HD_BRIDGE_MODE:-live}" != echo ] || echo_mode=1
while [ "$#" -gt 0 ]; do
  case "$1" in
    --watch) shift; watch=${1:?--watch needs seconds} ;;
    --follow) follow=1 ;;
    --dry-run) dry=1 ;;
    --echo) echo_mode=1 ;;
    *) echo "usage: hd-bridge.sh [--follow | --watch <seconds>] [--dry-run | --echo]" >&2; exit 2 ;;
  esac
  shift
done

HD_HOME=$("$HD" path)
CURSOR="$HD_HOME/cursors/firstmate-bridge"
[ "$echo_mode" = 0 ] || CURSOR="$CURSOR.echo"
SOURCE=harbordeck

log() { printf '%s hd-bridge: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }  # stderr: the service log

would() {  # prefix for a command that is printed instead of run
  [ "$echo_mode" = 0 ] || printf '%s ' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'would run:'
}

run() {  # print in dry-run, else execute
  if [ "$dry" = 1 ]; then would; printf ' %q' "$@"; printf '\n'; else "$@"; fi
}

fm() {  # a firstmate command: also only printed in echo mode
  if [ "$echo_mode" = 1 ] && [ "$dry" = 0 ]; then would; printf ' %q' "$@"; printf '\n'; else run "$@"; fi
}

keyed() {  # <id> <answer> <label> <mode> -> 0 when the hold was closed
  local out rc=0
  if [ "$dry" = 1 ] || [ "$echo_mode" = 1 ]; then
    # Echo mirrors live routing: ask the read-only predicate whether the hold is open.
    [ "$echo_mode" = 0 ] || "$FM_HOME/bin/fm-captain-hold.sh" open "$1" </dev/null >/dev/null 2>&1 || return 1
    would; printf ' printf %q | %q answers --source %s\n' "$1	$2	$3	$4" "$FM_HOME/bin/fm-captain-hold.sh" "$SOURCE"
    return 0
  fi
  out=$(printf '%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" | "$FM_HOME/bin/fm-captain-hold.sh" answers --source "$SOURCE" 2>&1) || rc=$?
  printf '%s\n' "$out"
  [ "$rc" = 0 ] && ! grep -q '^skipped:\|^refused:' <<<"$out"
}

held() {  # <task-id> -> 0 when firstmate holds it for the captain (read-only predicate)
  [ "$dry" = 1 ] && return 0
  "$FM_HOME/bin/fm-captain-hold.sh" open "$1" </dev/null >/dev/null 2>&1
}

note() {  # <request-id> <text>
  fm "$FM_HOME/bin/fm-inbox.sh" note --request-id "$1" -- "$2"
}

route() {  # <answer json>; returns nonzero when firstmate did not take it
  local a=$1 id action key note at to anchor title='' kind='' label text rid reply until day task
  id=$(jq -r '.id' <<<"$a"); action=$(jq -r '.action' <<<"$a")
  key=$(jq -r '.key // ""' <<<"$a"); note=$(jq -r '.note // ""' <<<"$a"); at=$(jq -r '.at // 0' <<<"$a")
  to=$(jq -r '.to // "any mate"' <<<"$a"); anchor=$(jq -c '.anchor // empty' <<<"$a")
  if [ -f "$HD_HOME/items/$id.json" ]; then
    title=$(jq -r '.title // ""' "$HD_HOME/items/$id.json"); kind=$(jq -r '.kind // ""' "$HD_HOME/items/$id.json")
  fi
  rid="hd-$id-$action-$at"
  rid=${rid:0:128}
  text="HarborDeck $action on $id${title:+ \"$title\"}"
  reply="Reply: $HD reply $id \"<text>\""
  case "$action" in
    decide)
      label=$(jq -r --arg k "$key" '[.options[]? | select(.key == $k) | .label][0] // ""' "$HD_HOME/items/$id.json" 2>/dev/null || true)
      text="$text: $key${label:+ ($label)}${note:+ - $note}"
      if keyed "$id" "$key" "$label" done; then
        [ -z "$note" ] || note "$rid" "$text" || return 1
      else
        note "$rid" "$text" || return 1
      fi ;;
    approve|reject)
      keyed "$id" "$action${note:+: $note}" "" done || note "$rid" "$text${note:+: $note}" || return 1 ;;
    needs-work)
      keyed "$id" "needs-work: $note" "" release || true
      note "$rid" "$text: $note. $reply" || return 1 ;;
    ask|comment)
      note "$rid" "$text: $note${anchor:+ (anchor $anchor)}. $reply" || return 1 ;;
    request)
      note "$id" "HarborDeck request for $to: $note. $reply" || return 1 ;;
    file)
      [ "$kind" != todo ] || note "$rid" "$text: done${note:+ - $note}" || return 1 ;;
    defer)
      until=$(jq -r '.until // 0' <<<"$a")
      day=$(date -r "$until" +%Y-%m-%d 2>/dev/null || date -d "@$until" +%Y-%m-%d)
      task=$id
      held "$task" || { [[ $id =~ \.q[0-9]+$ ]] && held "${id%.q*}" && task=${id%.q*}; } || task=''
      if [ -n "$task" ]; then
        fm "$FM_HOME/bin/fm-captain-hold.sh" hold "$task" --reason "captain deferred $id on HarborDeck until $day" --until "$day" || return 1
      else
        note "$rid" "$text: later, back on the desk $day${note:+ - $note}" || return 1
      fi ;;
    *) log "skipping unknown action $action on $id" ;;
  esac
  case "$action" in
    decide|approve|reject|file) [ -z "$kind" ] || run "$HD" resolve "$id" || return 1 ;;
  esac
}

once() {
  local off batch line end a
  off=$(cat "$CURSOR" 2>/dev/null || echo 0)
  batch=$("$HD" answers --since-offset "$off" --json)
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    end=$(jq -r '.end' <<<"$line")
    a=$(jq -c '.answer // empty' <<<"$line")
    if [ -n "$a" ]; then
      route "$a" || { log "routing failed at offset $off: $a; will retry"; return 1; }
      [ "$dry" = 1 ] || log "routed $(jq -r '"\(.action) \(.id)"' <<<"$a")"
    else
      log "skipping unparseable line ending at $end"
    fi
    off=$end
    if [ "$dry" = 0 ]; then mkdir -p "$(dirname "$CURSOR")"; printf '%s\n' "$off" > "$CURSOR"; fi
  done < <(jq -c '.lines[]' <<<"$batch")
}

if [ "$follow" = 1 ]; then
  log "following $HD_HOME/answers.jsonl from byte $(cat "$CURSOR" 2>/dev/null || echo 0) into $FM_HOME$([ "$echo_mode" = 0 ] || echo ' (echo)')"
  waiter=''
  trap '[ -z "$waiter" ] || kill "$waiter" 2>/dev/null; exit 0' INT TERM
  while :; do
    once || sleep 5   # a failed route retries from the same line
    # Background + wait so a stop signal is handled at once and the waiter goes with us.
    "$HD" answers --since-offset "$(cat "$CURSOR" 2>/dev/null || echo 0)" --wait --timeout 300 >/dev/null &
    waiter=$!
    wait "$waiter" || true
    waiter=''
  done
elif [ "$watch" = 0 ]; then
  once
else
  while :; do once || true; sleep "$watch"; done
fi
