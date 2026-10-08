#!/usr/bin/env bash
# hd-rules.sh - write HarborDeck rules.json (standing orders) from a markdown
# preferences file, e.g. a firstmate home's data/captain.md.
#
# Usage: hd-rules.sh <preferences.md> [--print]
#
# Every top-level bullet ("- " or "* ") is one standing order. Its key is an
# explicit trailing "{#key}" when present, else a slug of its first six words
# (deduplicated with -2, -3, ...). Items reference these keys in --rule, --ok
# and --flag, so add {#key} to bullets you check often to keep keys stable when
# wording changes. source is "<file name>:<line>".
# Env: HD (default: harbordeck).
set -euo pipefail

HD=${HD:-harbordeck}
file=${1:?usage: hd-rules.sh <preferences.md> [--print]}
[ -f "$file" ] || { echo "hd-rules.sh: no such file: $file" >&2; exit 1; }

rules=$(awk -v src="$(basename "$file")" '
  /^[-*] / {
    text = substr($0, 3); key = ""
    if (match(text, /[ \t]*\{#[A-Za-z0-9][A-Za-z0-9._-]*\}[ \t]*$/)) {
      key = substr(text, RSTART, RLENGTH); text = substr(text, 1, RSTART - 1)
      gsub(/[ \t{}#]/, "", key)
    } else {
      n = split(tolower(text), w, /[^a-z0-9]+/); k = 0
      for (i = 1; i <= n && k < 6; i++) if (w[i] != "") { key = key (k ? "-" : "") w[i]; k++ }
      if (key == "") key = "rule"
    }
    if (seen[key]++) key = key "-" seen[key]
    printf "%s\t%s\t%s:%d\n", key, text, src, NR
  }' "$file" | jq -R -s '
  split("\n") | map(select(length > 0) | split("\t")
    | {key: .[0], value: {text: (.[1][0:1000]), source: .[2]}}) | from_entries')

if [ "${2:-}" = --print ]; then
  printf '%s\n' "$rules"
else
  printf '%s\n' "$rules" | "$HD" rules -
fi
