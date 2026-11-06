#!/usr/bin/env bash
# wake.sh - HarborDeck scheduler wake command for a firstmate home.
#
# Usage: harbordeck scheduler config --wake-command "FM_HOME=/path/to/home /path/to/wake.sh"
#
# Delivers the scheduler's message (stdin, else $HARBORDECK_MESSAGE) as one typed
# message to the primary firstmate session through the home's own bin/fm-send.sh.
# Firstmate then resumes supervision and nudges stalled crew; this never types into
# crew panes. Target: $HD_WAKE_TARGET (<herdr-session>:<pane-id>), else the pane of
# the session holding the home's lock, or of the newest session opened in the home
# (hd-listener.sh). When no session runs, hd-listener.sh starts one (HD_FM_START,
# default herdr) with this message as its first prompt.
# Exit: fm-send's own code (0 confirmed, 3 typed but unconfirmed: the scheduler
# counts both as delivered and never retypes); 75 when no session runs and none
# could be started (the scheduler retries next tick without spending an attempt);
# 2 on bad setup.
set -euo pipefail

FM_HOME=${FM_HOME:-}
[ -n "$FM_HOME" ] || { echo "wake.sh: set FM_HOME to the firstmate home" >&2; exit 2; }
[ -x "$FM_HOME/bin/fm-send.sh" ] || { echo "wake.sh: $FM_HOME/bin/fm-send.sh not found" >&2; exit 2; }
export FM_HOME   # fm-send refuses to guess its home

msg=$(cat || true)
[ -n "$msg" ] || msg=${HARBORDECK_MESSAGE:-}
[ -n "$msg" ] || { echo "wake.sh: empty message" >&2; exit 2; }

[ -z "${HD_WAKE_TARGET:-}" ] || exec "$FM_HOME/bin/fm-send.sh" "$HD_WAKE_TARGET" "$msg"
exec "$(cd "$(dirname "$0")" && pwd)/hd-listener.sh" send "$msg"
