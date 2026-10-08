#!/usr/bin/env bash
# hd-quota.sh - write HarborDeck quota.json (stamina bars) from quota-axi.
#
# Usage: hd-quota.sh [--print] [--from-json <quota-axi --json output file>]
#
# One entry per independent window that has a reset time and a length:
# {name, window: "<n>h|<n>d", used_pct, resets_at}. Shared sub-windows
# (shareOf) and windows without a percentage are skipped. Reads are cached by
# quota-axi for HD_QUOTA_MAX_AGE (default 5m), so frequent runs stay cheap.
# Env: HD (default: harbordeck), HD_QUOTA_MAX_AGE.
set -euo pipefail

HD=${HD:-harbordeck}
print=0
src=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    --print) print=1 ;;
    --from-json) shift; src=${1:?--from-json needs a file} ;;
    *) echo "usage: hd-quota.sh [--print] [--from-json <file>]" >&2; exit 2 ;;
  esac
  shift
done

if [ -n "$src" ]; then
  raw=$(cat "$src")
else
  # quota-axi exits nonzero when any provider is unavailable but still prints the full report.
  raw=$(quota-axi --json --max-age "${HD_QUOTA_MAX_AGE:-5m}") || true
fi
jq -e '.providers' >/dev/null 2>&1 <<<"$raw" || { echo "hd-quota.sh: no quota-axi report" >&2; exit 1; }

quota=$(jq '
  def names: {claude: "Claude", codex: "OpenAI Codex", cursor: "Cursor", copilot: "GitHub Copilot"};
  def window: if . % 86400 == 0 then "\(. / 86400)d" else "\((. / 3600) | ceil)h" end;
  def epoch: sub("\\.[0-9]+"; "") | sub("\\+00:00$"; "Z") | fromdateiso8601;
  [.providers[] | .provider as $p | (.windows // [])[]
   | select(.shareOf == null and .resetsAt != null and (.windowSeconds // 0) > 0)
   | select(.percentUsed != null or .percentRemaining != null)
   | {name: ((names[$p] // $p) + (if .kind == "model" then " \(.label)" else "" end)),
      window: (.windowSeconds | window),
      used_pct: ((.percentUsed // (100 - .percentRemaining)) | if . < 0 then 0 elif . > 100 then 100 else . end),
      resets_at: (.resetsAt | epoch)}]
' <<<"$raw")

if [ "$print" = 1 ]; then
  printf '%s\n' "$quota"
else
  printf '%s\n' "$quota" | "$HD" quota -
fi
