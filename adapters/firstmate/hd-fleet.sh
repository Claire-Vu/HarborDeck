#!/usr/bin/env bash
# hd-fleet.sh - write HarborDeck fleet.json from a firstmate home.
#
# Usage: FM_HOME=<firstmate home> hd-fleet.sh [--print]
#
# Reads state/*.meta (harness, model, effort, project, kind) and each crew's
# current state from bin/fm-crew-state.sh (forge reads off). Secondmates
# (kind=secondmate) become counter staff (firstmates[]); every other endpoint is
# crew, titled from bin/fm-tasks-axi.sh show <task>. A crew whose id matches an open HarborDeck item gets "item" set, so the
# desk can show what a decision unblocks. --print writes to stdout instead of
# installing through `harbordeck fleet -`.
# Env: FM_HOME (required), HD (default: harbordeck), HD_MATE_ID (default:
# mate-main), HD_MATE_LABEL (default: First Mate).
set -euo pipefail

FM_HOME=${FM_HOME:?set FM_HOME to the firstmate home}
HD=${HD:-harbordeck}
MATE=${HD_MATE_ID:-mate-main}
MATE_LABEL=${HD_MATE_LABEL:-First Mate}
HD_HOME=$("$HD" path)

meta_get() {  # <file> <key>
  sed -n "s/^$2=//p" "$1" | head -n 1
}

crew_state() {  # <id> -> idle|working|waiting|done
  local line
  line=$(FM_CREW_STATE_NO_FORGE=1 "$FM_HOME/bin/fm-crew-state.sh" "$1" 2>/dev/null || true)
  case "${line#state: }" in
    working*) echo working ;;
    parked*|paused*|blocked*) echo waiting ;;
    done*) echo done ;;
    *) echo idle ;;
  esac
}

task_title() {  # <task id> -> title from the backlog, or nothing
  [ -n "$1" ] && [ -x "$FM_HOME/bin/fm-tasks-axi.sh" ] || return 0
  FM_HOME=$FM_HOME "$FM_HOME/bin/fm-tasks-axi.sh" show "$1" --full 2>/dev/null </dev/null \
    | sed -n 's/^  title: //p' | head -n 1 | sed 's/^"\(.*\)"$/\1/; s/\\"/"/g' || true
}

rows=$(
  for meta in "$FM_HOME"/state/*.meta; do
    [ -e "$meta" ] || continue
    id=$(basename "$meta" .meta)
    kind=$(meta_get "$meta" kind)
    project=$(meta_get "$meta" project)
    item=''
    task=$(meta_get "$meta" endpoint_task_id)
    [ -f "$HD_HOME/items/$id.json" ] && item=$id
    jq -n --arg id "$id" --arg kind "$kind" --arg harness "$(meta_get "$meta" harness)" \
      --arg model "$(meta_get "$meta" model)" --arg effort "$(meta_get "$meta" effort)" \
      --arg project "${project##*/}" --arg task "$task" \
      --arg title "$(task_title "$task")" --arg state "$(crew_state "$id")" --arg item "$item" --arg mate "$MATE" \
      '{id: $id, kind: $kind, harness: $harness, model: $model, effort: $effort, project: $project,
        task: $task, task_title: $title, state: $state, item: $item, firstmate: $mate}
       | with_entries(select(.value != ""))'
  done
)

fleet=$(jq -s --arg mate "$MATE" --arg label "$MATE_LABEL" '
  {generated: (now | floor), day: (now | strftime("%Y-%m-%d")),
   firstmates: ([{id: $mate, label: $label, state: "attending"}]
     + [.[] | select(.kind == "secondmate")
         | {id, label: (.project // .id), domain: (.project // ""), harness, model, state: "attending"}
         | with_entries(select(.value != null))]),
   crew: [.[] | select(.kind != "secondmate") | del(.kind)],
   regulars: ([.[] | select(.kind != "secondmate") | .project // empty] | unique | map({id: ., label: .}))}
' <<<"$rows")

if [ "${1:-}" = --print ]; then
  printf '%s\n' "$fleet"
else
  printf '%s\n' "$fleet" | "$HD" fleet -
fi
