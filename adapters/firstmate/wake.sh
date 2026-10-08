#!/usr/bin/env bash
# wake.sh - HarborDeck scheduler wake command for a firstmate home.
#
# Usage: harbordeck scheduler config --wake-command "FM_HOME=/path/to/home /path/to/wake.sh"
#
# Delivers the scheduler's message (stdin, else $HARBORDECK_MESSAGE) as one typed
# message to the primary firstmate pane through the home's own bin/fm-send.sh.
# Firstmate then resumes supervision and nudges stalled crew; this never types into
# crew panes. Target: $HD_WAKE_TARGET (<herdr-session>:<pane-id>), else the single
# agent pane in the herdr workspace labeled $HD_WAKE_WORKSPACE (default firstmate),
# in herdr session $HD_WAKE_SESSION (default "default").
# Exit: fm-send's own code (0 confirmed, 3 typed but unconfirmed: the scheduler
# counts both as delivered and never retypes); 75 when no target pane is found
# (the scheduler retries next tick without spending an attempt); 2 on bad setup.
set -euo pipefail

FM_HOME=${FM_HOME:-}
[ -n "$FM_HOME" ] || { echo "wake.sh: set FM_HOME to the firstmate home" >&2; exit 2; }
[ -x "$FM_HOME/bin/fm-send.sh" ] || { echo "wake.sh: $FM_HOME/bin/fm-send.sh not found" >&2; exit 2; }
export FM_HOME   # fm-send refuses to guess its home

msg=$(cat || true)
[ -n "$msg" ] || msg=${HARBORDECK_MESSAGE:-}
[ -n "$msg" ] || { echo "wake.sh: empty message" >&2; exit 2; }

target=${HD_WAKE_TARGET:-}
if [ -z "$target" ]; then
  label=${HD_WAKE_WORKSPACE:-firstmate}
  if ! spaces=$(herdr workspace list 2>&1) || ! agents=$(herdr agent list 2>&1); then
    echo "wake.sh: herdr unavailable: ${spaces:0:200} ${agents:-}" >&2; exit 75
  fi
  panes=$(jq -r --arg l "$label" --argjson s "$spaces" '
    ([$s.result.workspaces[] | select(.label == $l) | .workspace_id]) as $ids
    | [.result.agents[] | select(.workspace_id as $w | $ids | index($w)) | .pane_id] | .[]' <<<"$agents")
  n=$(grep -c . <<<"$panes" || true)
  if [ "$n" != 1 ]; then
    echo "wake.sh: expected one agent pane in herdr workspace '$label', found $n" >&2; exit 75
  fi
  target="${HD_WAKE_SESSION:-default}:$panes"
fi

exec "$FM_HOME/bin/fm-send.sh" "$target" "$msg"
