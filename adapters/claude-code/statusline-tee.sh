#!/bin/sh
# statusline-tee.sh - Claude Code status line wrapper that hands rate_limits to
# the HarborDeck scheduler, so a later `harbordeck limit record` knows exactly
# which window is exhausted and when it resets.
#
# settings.json: "statusLine": {"type": "command", "command": "/path/to/statusline-tee.sh"}
# Keep your own status line: HD_STATUSLINE="<your command>" (gets the same stdin).
# Without one, prints a minimal "5h 62% · 7d 41%" usage line.
# Env: HD (default: harbordeck).
input=$(cat)
printf '%s' "$input" | "${HD:-harbordeck}" limit snapshot >/dev/null 2>&1 &

if [ -n "${HD_STATUSLINE:-}" ]; then
  printf '%s' "$input" | sh -c "$HD_STATUSLINE"
  exit
fi
command -v jq >/dev/null 2>&1 || exit 0
printf '%s' "$input" | jq -r '
  [(.rate_limits.five_hour.used_percentage // empty | "5h \(floor)%"),
   (.rate_limits.seven_day.used_percentage // empty | "7d \(floor)%")]
  | if length == 0 then "usage: n/a" else join(" · ") end'
