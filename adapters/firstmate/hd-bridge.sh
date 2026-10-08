#!/usr/bin/env bash
# hd-bridge.sh - route HarborDeck answers into a firstmate home.
#
# Usage: FM_HOME=<firstmate home> hd-bridge.sh [--watch <seconds>] [--dry-run]
#
# Reads answers.jsonl lines added since the last run (cursor:
# <HARBORDECK_HOME>/cursors/firstmate-bridge, advanced one line at a time, so a
# failure retries from that line on the next run) and routes each:
#   decide, approve, reject  -> bin/fm-captain-hold.sh answers (keyed answer, closes the hold)
#   needs-work               -> keyed answer with mode release (held work resumes) + inbox note
#   ask, comment, request    -> bin/fm-inbox.sh note --request-id (idempotent)
#   file on a todo           -> inbox note ("done"); file on an answer -> nothing to route
# A keyed answer whose item id is not a captain-held task falls back to an
# inbox note, so no answer is ever dropped. decide/approve/reject/file also mark
# the item resolved. Item ids should therefore equal firstmate task ids when an
# item stands for a captain hold. Each note ends with the exact `harbordeck
# reply` command to answer on the desk.
# --dry-run prints the firstmate commands instead of running them and does not
# move the cursor. --watch repeats every <seconds>.
# Env: FM_HOME (required), HD (default: harbordeck).
set -euo pipefail

FM_HOME=${FM_HOME:?set FM_HOME to the firstmate home}
HD=${HD:-harbordeck}
watch=0
dry=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --watch) shift; watch=${1:?--watch needs seconds} ;;
    --dry-run) dry=1 ;;
    *) echo "usage: hd-bridge.sh [--watch <seconds>] [--dry-run]" >&2; exit 2 ;;
  esac
  shift
done

HD_HOME=$("$HD" path)
CURSOR="$HD_HOME/cursors/firstmate-bridge"
SOURCE=harbordeck

run() {  # print in dry-run, else execute
  if [ "$dry" = 1 ]; then printf 'would run:'; printf ' %q' "$@"; printf '\n'; else "$@"; fi
}

keyed() {  # <id> <answer> <label> <mode> -> 0 when the hold was closed
  local out rc=0
  if [ "$dry" = 1 ]; then
    printf 'would run: printf %q | %q answers --source %s\n' "$1	$2	$3	$4" "$FM_HOME/bin/fm-captain-hold.sh" "$SOURCE"
    return 0
  fi
  out=$(printf '%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" | "$FM_HOME/bin/fm-captain-hold.sh" answers --source "$SOURCE" 2>&1) || rc=$?
  printf '%s\n' "$out"
  [ "$rc" = 0 ] && ! grep -q '^skipped:\|^refused:' <<<"$out"
}

note() {  # <request-id> <text>
  run "$FM_HOME/bin/fm-inbox.sh" note --request-id "$1" -- "$2"
}

route() {  # <answer json>; returns nonzero when firstmate did not take it
  local a=$1 id action key note at to anchor title='' kind='' label text rid reply
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
    *) echo "hd-bridge: skipping unknown action $action on $id" >&2 ;;
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
      route "$a" || { echo "hd-bridge: routing failed at offset $off; will retry" >&2; return 1; }
    else
      echo "hd-bridge: skipping unparseable line ending at $end" >&2
    fi
    off=$end
    if [ "$dry" = 0 ]; then mkdir -p "$(dirname "$CURSOR")"; printf '%s\n' "$off" > "$CURSOR"; fi
  done < <(jq -c '.lines[]' <<<"$batch")
}

if [ "$watch" = 0 ]; then
  once
else
  while :; do once || true; sleep "$watch"; done
fi
