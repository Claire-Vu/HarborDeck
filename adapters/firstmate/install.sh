#!/usr/bin/env bash
# install.sh - connect a firstmate home to HarborDeck. Idempotent: re-run it to update; --uninstall undoes it.
#
# Usage: adapters/firstmate/install.sh [--fm-home <dir>] [--data-dir <dir>] [--mode live|echo] [--from <id>]
#                                      [--pending deliver|skip] [--bin-dir <dir>] [--settings-dir <dir>] [--no-service] [--uninstall]
#
#  1. Links the `harbordeck` and `hd` commands into --bin-dir (default ~/.local/bin).
#  2. Creates the data dir (default $HARBORDECK_HOME or ~/.harbordeck) and points the app at it, with the
#     firstmate home as the Artifact root, in the app's settings.json (in --settings-dir, default the app's profile).
#  3. Starts the bridge cursor at the end of answers.jsonl on the first install and when switching from echo
#     to live, so answers written before (tests, echo runs) are never replayed into firstmate. On a re-install,
#     answers past the cursor (written while the bridge was down) need --pending: deliver routes them, skip drops
#     them (cursor to the end); without it install.sh lists them and stops before changing anything.
#  4. On macOS, installs and (re)starts the launchd agent dev.harbordeck.firstmate, which runs hd-live.sh:
#     the on-answer bridge (--follow) plus fleet, quota and rules feeders, and fails unless it is running after. --mode echo makes the bridge log
#     the firstmate commands instead of running them. Elsewhere, or with --no-service, prints the command.
#  5. Writes the firstmate-side instructions to <fm-home>/data/harbordeck.md and one standing order
#     pointing at them into <fm-home>/data/captain.md (between harbordeck markers, replaced on re-run).
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
fm_home=${FM_HOME:-}
data_dir=${HARBORDECK_HOME:-$HOME/.harbordeck}
mode=live
from=${HARBORDECK_FROM:-mate-main}
bin_dir=$HOME/.local/bin
service=1
uninstall=0
pending=''
settings_dir=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    --fm-home) shift; fm_home=${1:?} ;;
    --data-dir) shift; data_dir=${1:?} ;;
    --mode) shift; mode=${1:?} ;;
    --from) shift; from=${1:?} ;;
    --bin-dir) shift; bin_dir=${1:?} ;;
    --pending) shift; pending=${1:?} ;;
    --settings-dir) shift; settings_dir=${1:?} ;;
    --no-service) service=0 ;;
    --uninstall) uninstall=1 ;;
    -h|--help) sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "install.sh: unknown argument $1 (see --help)" >&2; exit 2 ;;
  esac
  shift
done
[ -n "$fm_home" ] || { echo "install.sh: pass --fm-home <firstmate home> or set FM_HOME" >&2; exit 2; }
fm_home=$(cd "$fm_home" && pwd)
case "$mode" in live|echo) ;; *) echo "install.sh: --mode is live or echo" >&2; exit 2 ;; esac
case "$pending" in ''|deliver|skip) ;; *) echo "install.sh: --pending is deliver or skip" >&2; exit 2 ;; esac
case "$data_dir" in "~"*) data_dir=$HOME${data_dir#\~} ;; esac

LABEL=dev.harbordeck.firstmate
plist=$HOME/Library/LaunchAgents/$LABEL.plist
log=$HOME/Library/Logs/harbordeck-firstmate.log
instructions=$fm_home/data/harbordeck.md
prefs=$fm_home/data/captain.md
BEGIN='<!-- harbordeck:begin -->'
END='<!-- harbordeck:end -->'
if [ -n "$settings_dir" ]; then :
elif [ "$(uname)" = Darwin ]; then settings_dir="$HOME/Library/Application Support/Harbor Deck"
else settings_dir="${XDG_CONFIG_HOME:-$HOME/.config}/Harbor Deck"; fi
say() { printf '%s\n' "$*"; }

strip_block() {  # remove our marked block from captain.md
  [ -f "$prefs" ] && grep -qF "$BEGIN" "$prefs" || return 0
  awk -v b="$BEGIN" -v e="$END" '$0 == b {skip = 1; next} skip && $0 == e {skip = 0; next} !skip' "$prefs" > "$prefs.hd-tmp"
  mv "$prefs.hd-tmp" "$prefs"
}

if [ "$uninstall" = 1 ]; then
  if [ -f "$plist" ]; then launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true; rm -f "$plist"; say "removed launchd agent $LABEL"; fi
  for c in harbordeck hd; do [ "$(readlink "$bin_dir/$c" 2>/dev/null)" != "$root/cli/bin/harbordeck.js" ] || { rm -f "$bin_dir/$c"; say "removed $bin_dir/$c"; }; done
  strip_block; rm -f "$instructions"; say "removed firstmate instructions"
  say "kept the data dir $data_dir and the app settings"
  exit 0
fi

# Answers past the live cursor were never routed (the bridge was down). Decide before anything changes.
cursor=$data_dir/cursors/firstmate-bridge
was_echo=0; [ ! -f "$plist" ] || ! grep -q '<string>echo</string>' "$plist" || was_echo=1
if [ "$mode" = live ] && [ "$was_echo" = 0 ] && [ -s "$cursor" ] && [ -f "$data_dir/answers.jsonl" ]; then
  off=$(cat "$cursor"); size=$(wc -c < "$data_dir/answers.jsonl" | tr -d ' ')
  if [ "$off" -lt "$size" ]; then
    case "$pending" in
      skip) echo "$size" > "$cursor"; say "bridge: skipped $((size - off)) bytes of unrouted answers; cursor at byte $size" ;;
      deliver) say "bridge: delivering unrouted answers from byte $off" ;;
      *) { echo "install.sh: answers.jsonl has answers the bridge never routed (from byte $off):"
           tail -c +"$((off + 1))" "$data_dir/answers.jsonl"
           echo "re-run with --pending deliver (route them to firstmate) or --pending skip (drop them)"; } >&2
         exit 2 ;;
    esac
  fi
fi

for t in node jq; do command -v "$t" >/dev/null || { echo "install.sh: $t is required" >&2; exit 1; }; done
for s in fm-captain-hold.sh fm-inbox.sh fm-crew-state.sh; do
  [ -x "$fm_home/bin/$s" ] || { echo "install.sh: $fm_home is not a firstmate home (no bin/$s)" >&2; exit 1; }
done
command -v quota-axi >/dev/null || say "note: quota-axi not found; stamina bars stay empty until it is installed"

# 1. CLI
mkdir -p "$bin_dir"
for c in harbordeck hd; do ln -sfn "$root/cli/bin/harbordeck.js" "$bin_dir/$c"; done
say "cli: $bin_dir/harbordeck -> $root/cli/bin/harbordeck.js"
case ":$PATH:" in *":$bin_dir:"*) ;; *) say "note: add $bin_dir to PATH for the agents that call harbordeck" ;; esac
HD=$root/cli/bin/harbordeck.js

# 2. data dir + app settings
export HARBORDECK_HOME=$data_dir
mkdir -p "$data_dir/items"
mkdir -p "$settings_dir"
settings="$settings_dir/settings.json"
[ -s "$settings" ] || echo '{}' > "$settings"
dd=$data_dir; [ "$data_dir" != "$HOME/.harbordeck" ] || dd=''
jq --arg dd "$dd" --arg ar "$fm_home" '.dataDir = $dd | .artifactRoot = $ar' "$settings" > "$settings.hd-tmp" && mv "$settings.hd-tmp" "$settings"
say "app: data dir $data_dir, artifact root $fm_home ($settings)"

# 3. bridge cursor: a fresh install, or a switch from echo to live, starts at the end of answers.jsonl, so
#    answers written before (tests, echo runs) are never replayed into firstmate.
if [ ! -e "$cursor" ] || { [ "$mode" = live ] && [ "$was_echo" = 1 ]; }; then
  mkdir -p "$(dirname "$cursor")"
  if [ -f "$data_dir/answers.jsonl" ]; then wc -c < "$data_dir/answers.jsonl" | tr -d ' ' > "$cursor"; else echo 0 > "$cursor"; fi
  say "bridge: cursor starts at byte $(cat "$cursor") of answers.jsonl (earlier answers are not replayed)"
fi

# 4. live feeders + on-answer bridge
live_cmd="FM_HOME=$fm_home HD=$HD HARBORDECK_HOME=$data_dir HARBORDECK_FROM=$from HD_BRIDGE_MODE=$mode $here/hd-live.sh"
if [ "$service" = 1 ] && [ "$(uname)" = Darwin ]; then
  mkdir -p "$(dirname "$plist")" "$(dirname "$log")"
  x() { printf '%s' "$1" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g'; }
  cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$(x "$here/hd-live.sh")</string></array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>FM_HOME</key><string>$(x "$fm_home")</string>
    <key>HD</key><string>$(x "$HD")</string>
    <key>HARBORDECK_HOME</key><string>$(x "$data_dir")</string>
    <key>HARBORDECK_FROM</key><string>$(x "$from")</string>
    <key>HD_BRIDGE_MODE</key><string>$mode</string>
    <key>PATH</key><string>$(x "$PATH")</string>
  </dict>
  <key>WorkingDirectory</key><string>$(x "$fm_home")</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$(x "$log")</string>
  <key>StandardErrorPath</key><string>$(x "$log")</string>
</dict>
</plist>
EOF
  domain=gui/$(id -u)
  launchctl bootout "$domain/$LABEL" 2>/dev/null || true
  # bootout returns before the old agent is gone; bootstrapping over it fails ("5: Input/output error")
  # and leaves no agent at all, so wait for it to go, retry, then check the new one is running.
  for _ in $(seq 1 50); do launchctl print "$domain/$LABEL" >/dev/null 2>&1 || break; sleep 0.2; done
  for i in 1 2 3 4 5; do
    err=$(launchctl bootstrap "$domain" "$plist" 2>&1) && break
    [ "$i" -lt 5 ] || { echo "install.sh: launchctl bootstrap failed: $err" >&2; exit 1; }
    sleep 1
  done
  for _ in $(seq 1 50); do launchctl print "$domain/$LABEL" 2>/dev/null | grep -q 'state = running' && break; sleep 0.2; done
  launchctl print "$domain/$LABEL" 2>/dev/null | grep -q 'state = running' || {
    echo "install.sh: launchd agent $LABEL is not running; last log lines:" >&2; tail -5 "$log" >&2 2>/dev/null; exit 1; }
  say "service: launchd agent $LABEL running hd-live.sh (bridge mode: $mode), log $log"
else
  say "service: not installed; run this under your process supervisor or a terminal pane:"
  say "  $live_cmd"
fi

# 5. firstmate-side instructions (private: the home's data/ dir)
home_env=''; [ "$data_dir" = "$HOME/.harbordeck" ] || home_env=", \`HARBORDECK_HOME=$data_dir\`"
sed -e "s|@HD_HOME@|$data_dir|g" -e "s|@FROM@|$from|g" -e "s|@HOME_ENV@|$home_env|g" "$here/firstmate-instructions.md" > "$instructions"
touch "$prefs"
strip_block
{
  [ ! -s "$prefs" ] || [ -z "$(tail -c 1 "$prefs")" ] || echo
  echo "$BEGIN"
  echo "- HarborDeck is the captain's desk: put every captain-facing decision, review, report and todo on it with the \`harbordeck\` CLI as data/harbordeck.md says (a captain hold's item uses the held task id; always \`-t <topic>\`; later mentions of an item or topic also go on it with \`harbordeck note\`), and log anything that fits no item with \`harbordeck gap\`. {#harbordeck}"
  echo "$END"
} >> "$prefs"
say "firstmate: instructions in $instructions; standing order {#harbordeck} in $prefs"
say "done. Open Harbor Deck; switch modes with: $0 --fm-home $fm_home --mode live|echo"
