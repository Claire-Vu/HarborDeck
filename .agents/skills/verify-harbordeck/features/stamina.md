# Stamina (usage left)

The top bar shows how much of each subscription usage window is left, readable without the scene: per provider (`Claude`), one chip per window (`5h`, `week`, then per-model windows such as `Fable · week` set apart by a dashed rule), each with a filled bar and **% left**, `↻ <countdown>` to the reset, `⚠ out ~<time>` when the pace so far empties it before the reset, and `STALE` when the reading is over 30 min old. Hovering a chip spells out left/used, the reset in local time, the source (`quota.json` or `Claude Code status line`) and its age. The same window from both sources shows the fresher reading. Clicking the chips opens the same windows in long form.

## Sub-features

- `stamina-chip` `#stamina-cluster .ms-group` per provider (`.ms-prov` = name), `.mini-sub` per window: `.ms-name` (`5h`, `week`, `day`, `<Model> · week`), `.ms-bar i`, `.ms-pct` (`82%`, `?` after a reset with no new reading), `.ms-time` (`↻ 4h 12m` or `reset`).
- `stamina-model` per-model windows (quota.json `model`) carry `.mini-sub.model`, after their provider's account windows.
- `stamina-runout` `.ms-warn` `⚠ out ~<time>` (dated when not within ~20 h): quota.json `runs_out_at`, else a linear projection from the window start (needs 15 min of the window).
- `stamina-fresh` `schedule/rate-limits.json` (Claude Code status line via `hd limit snapshot`) replaces a staler quota.json reading of `Claude` 5h/7d, and adds windows quota.json lacks.
- `stamina-stale` `.ms-stale` `STALE` when the reading (quota.json `at`, else the file's mtime; the status line's `at`) is over 30 min old.
- `stamina-title` each `.mini-sub[title]` reads `<Provider[ Model]> · <window>: N% left (M% used). Resets <local time>, in <countdown>.` plus run-out, per-model and `Reading: <source>, <age>` lines.
- `stamina-long` click `#stamina-cluster` (wider than 860 px) → `.modal.stamina-modal .stamina .sub` per window with the long form; at 860 px or less the click expands the chips in place.

## How to get to it (user POV)

- Look at the top bar; hover a chip for the details.
- Click the cluster for the long form.
- Narrower windows drop the bars and day-plus countdowns first (≤1360 px), then all countdowns (≤1120 px); names and % left stay.

## Driving it with hdv + ui.mjs

Preconditions:

- Baseline instance, office opened, doctor `ok`. `t=$(date +%s)`.

- **Quota reading.** `echo '[{"name":"Claude","window":"5h","used_pct":17,"resets_at":'$((t+15120))',"at":'$((t-300))'},{"name":"Claude","window":"7d","used_pct":3,"resets_at":'$((t+540000))',"at":'$((t-300))'},{"name":"Claude","model":"Fable","window":"7d","used_pct":0,"resets_at":'$((t+540000))',"at":'$((t-300))'}]' | $H hd quota -`. `$U text --css '#stamina-cluster'` prints `Claude 5h 83% ↻ 4h 12m ⚠ out ~<time> week 97% ↻ 6d 6h Fable · week 100% ↻ 6d 6h` (17 % used 5 min after the window opened already projects a run-out).
- **Fresher status line wins.** `echo '{"rate_limits":{"five_hour":{"used_percentage":18,"resets_at":'$((t+15120))'},"seven_day":{"used_percentage":2,"resets_at":'$((t+540000))'}}}' | $H hd limit snapshot`. The 5h chip shows `82%` and a later `⚠ out ~<time>`; `$U eval '[...document.querySelectorAll("#stamina-cluster .mini-sub")].map(e=>e.title).join("\n")'` shows `Claude Code status line, just now` for 5h and week, `quota.json, 5m ago` for Fable.
- **Stale and reset.** `rm $HDV_HOME/schedule/rate-limits.json`, then write a quota row with `"at":'$((t-10800))'` and `"resets_at":'$((t-600))'`: its chip shows `?`, `reset`, `STALE`.
- **Any provider.** A row `{"name":"Acme","window":"1d",...}` gets its own `.ms-group` labelled `Acme` with `day`.
- **Capture.** `$H capture stamina header`.

## Gotchas

- The status line only reports Claude Code's account windows, always named `Claude`; it merges with quota.json rows named `Claude` (same `model`, same window length).
- A reset that has passed is never rolled forward: what is left is unknown until a new reading lands.
- Expected texts assume the default 1440 px window: at 1120-1360 px the week chips drop their `↻`, at 860 px or less bars and countdowns hide until the cluster is clicked.
- The app reloads on `rate-limits.json` writes (polled every 3 s), so allow a few seconds after `hd limit snapshot`.
