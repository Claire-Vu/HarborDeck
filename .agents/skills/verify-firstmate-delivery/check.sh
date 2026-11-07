#!/usr/bin/env bash
# check.sh - verify the HarborDeck -> firstmate delivery promise (see SKILL.md).
#
# Usage: .agents/skills/verify-firstmate-delivery/check.sh [--model-only]
#
# 1. Model: TLC on model/HdDelivery.tla, every config, each against its expected verdict:
#      HdDelivery.cfg   the code as it is: every rule holds (2 answers, up to 3 faults)
#      chart.cfg        the same code, one decision, no faults: small enough to draw with /statechart
#      before-fix.cfg   the bridge before this check existed: SomeoneComing must break
#      no-keyed-note.cfg a held decide without its note: DecisionNotLost must break
#      no-recheck.cfg   listener after a batch only, no recheck timer: SomeoneComing must break
#      trust-watcher.cfg the listener leaves a session with a live watcher alone: a note is never read (liveness)
#    A broken variant that passes means the model can no longer fail: treat it as a failed check.
# 2. Code: adapters/firstmate/test/run.sh, whose bridge and listener tests pin each model step to the code.
# TLC is tla2tools.jar 1.7.4 (sha256-pinned), downloaded once into ~/.cache/harbordeck-tla, or $TLA2TOOLS.
# Needs Java 11+ (`java`, or $JAVA). Exit 0 only when every verdict matches.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../../.." && pwd)
model=$here/model
SHA=936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88
jar=${TLA2TOOLS:-$HOME/.cache/harbordeck-tla/tla2tools-1.7.4.jar}
java=${JAVA:-java}
if [ ! -f "$jar" ]; then
  mkdir -p "$(dirname "$jar")"
  curl -fsSL -o "$jar.tmp" https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar || { echo "check: cannot download TLC" >&2; exit 2; }
  mv "$jar.tmp" "$jar"
fi
[ "$(shasum -a 256 "$jar" | cut -d' ' -f1)" = "$SHA" ] || { echo "check: $jar is not tla2tools 1.7.4" >&2; exit 2; }

fails=0
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
verdict() {  # <cfg> <expected: pass | the rule that must break>
  local out got
  out=$("$java" -XX:+UseParallelGC -jar "$jar" -workers 1 -metadir "$tmp/$1" -config "$model/$1" "$model/HdDelivery.tla" 2>&1)
  if grep -q 'Model checking completed. No error has been found.' <<<"$out"; then got=pass
  elif got=$(grep -oE 'Invariant [A-Za-z]+ is violated' <<<"$out" | head -n 1 | cut -d' ' -f2) && [ -n "$got" ]; then :
  elif grep -q 'Temporal properties were violated' <<<"$out"; then got=liveness
  elif grep -q 'Deadlock reached' <<<"$out"; then got=deadlock
  else got="error: $(grep -m1 -i error <<<"$out")"; fi
  if [ "$got" = "$2" ]; then echo "ok   $1: $got $(grep -oE '[0-9]+ distinct states' <<<"$out" | tail -n 1)"
  else echo "FAIL $1: expected $2, got $got"; printf '%s\n' "$out" > "$here/model/$1.tlc.out"; echo "     TLC output: model/$1.tlc.out (read it with /statechart)"; fails=$((fails + 1)); fi
}
verdict HdDelivery.cfg pass
verdict chart.cfg pass
verdict before-fix.cfg SomeoneComing
verdict no-keyed-note.cfg DecisionNotLost
verdict no-recheck.cfg SomeoneComing
verdict trust-watcher.cfg liveness

if [ "${1:-}" != --model-only ]; then
  if out=$("$root/adapters/firstmate/test/run.sh" 2>&1); then echo "ok   code: adapter tests ($(grep -c '^ok' <<<"$out") checks)"
  else grep '^FAIL' <<<"$out"; echo "FAIL code: adapters/firstmate/test/run.sh"; fails=$((fails + 1)); fi
fi
[ "$fails" = 0 ] && echo "delivery verified" || { echo "$fails check(s) failed"; exit 1; }
