#!/usr/bin/env bash
# hd-quota.sh - write HarborDeck quota.json (stamina bars) from quota-axi.
#
# Usage: hd-quota.sh [--print] [--from-json <quota-axi --json output file>]
#
# One entry per independent window that has a reset time and a length
# (windowSeconds, else inferred: five_hour/session 5h, seven_day/weekly 7d, model:* weekly 7d):
# {name, model?, window: "<n>h|<n>d", used_pct, resets_at, at?, runs_out_at?}: name is the provider,
# model is set on per-model windows, at is when quota-axi read it, runs_out_at is quota-axi's projected
# exhaustion when it comes before that window's reset. Shared sub-windows
# (shareOf) and windows without a percentage are skipped. Reads are cached by
# quota-axi for HD_QUOTA_MAX_AGE (default 5m), so frequent runs stay cheap.
# Set-up providers with no reading are reported on stderr with quota-axi's fix.
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
  # Newer quota-axi reports omit windowSeconds; infer it from the window id/kind/label.
  def length_of:
    if .id == "five_hour" or .kind == "session" then 18000
    elif .id == "seven_day" or .kind == "weekly" then 604800
    elif .kind == "model" and (((.label // "") | test("week"; "i")) or ((.id // "") | startswith("model:"))) then 604800
    else null end;
  def model_name: ((.id // "") | sub("^model:"; "")) as $m
    | if $m != "" and $m != .id then ($m[:1] | ascii_upcase) + $m[1:] else (.label // .id) end;
  (.generatedAt // null) as $gen
  | [.providers[] | .provider as $p | (.state.refreshedAt // $gen) as $at
   # projected exhaustion per limiting window, from the provider runway (quota-axi schema 5+)
   | ([.quotaSemantics.effectiveAvailability[]? | .runway // empty
       | select(.status == "projected_exhaustion" and .projectedExhaustedAt != null and .limitingWindowId != null)
       | {key: .limitingWindowId, value: (.projectedExhaustedAt | epoch)}] | from_entries) as $out
   | (.windows // [])[]
   | (.windowSeconds // length_of) as $len
   | select(.shareOf == null and .resetsAt != null and ($len // 0) > 0)
   | select(.percentUsed != null or .percentRemaining != null)
   | (.resetsAt | epoch) as $reset
   | {name: (names[$p] // $p)}
     + (if .kind == "model" then {model: model_name} else {} end)
     + {window: ($len | window),
        used_pct: ((.percentUsed // (100 - .percentRemaining)) | if . < 0 then 0 elif . > 100 then 100 else . end),
        resets_at: $reset}
     + (if $at then {at: ($at | epoch)} else {} end)
     + (if $out[.id] and $out[.id] < $reset then {runs_out_at: $out[.id]} else {} end)]
' <<<"$raw")

# Say why a set-up provider has no bars (e.g. Claude needs a one-time keychain grant).
jq -r '.providers[] | select((.notSetUp // false) | not) | select((.windows // []) == [])
  | "hd-quota.sh: no reading for \(.provider): \(.state.status // "unknown") (\(.state.error // "-"))\(if .state.remedyCommand then "; fix: \(.state.remedyCommand)" else "" end)"' <<<"$raw" >&2

if [ "$print" = 1 ]; then
  printf '%s\n' "$quota"
else
  printf '%s\n' "$quota" | "$HD" quota -
fi
