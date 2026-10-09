# Queue for after reset

Out of usage, a person queues an order for after the limit resets (or for a time); it waits as a countdown ticket while the Mac is kept awake, and the scheduler tick delivers it once: a `request` line in `answers.jsonl` plus the wake command, and the ticket flips to sent.

## Sub-features

- `sched-queue-reset` `Queue for after reset` adds `schedule/queue/reset-<req-id>.json`; ticket `.ticket.queued` reads `waiting for reset · <time>`.
- `sched-queue-at` time input `Send at time` + `Queue at time` queues for the next occurrence of that clock time.
- `sched-cli` `hd schedule reset|+30m|HH:MM "<msg>" [--request]` queues from the terminal; `hd schedule list` shows it.
- `sched-chip` `#sched-chip` shows queued count, time to reset and keep-awake (`☕`).
- `sched-awake` while anything is pending one stub caffeinate holds `-i -t <secs>`; released when nothing is pending.
- `sched-withdraw` the queued ticket's `Withdraw` button cancels it; from the terminal `hd schedule cancel <id|item id>`.
- `sched-deliver` after the reset, `tick` runs the wake for the limit, then writes the queued request to `answers.jsonl` and wakes for it; the ticket becomes `.ticket.waiting` with `sent`.
- `sched-once` a second tick delivers nothing.

## How to get to it (user POV)

- Ship phone: write the order, press `⌥Enter` (or `Queue for after reset`), or pick a time and press `Queue at time`.
- Terminal: `hd schedule reset "<msg>" --request`.
- The rail ticket, the top-bar chip, and `Withdraw` in the ticket popover.

## Driving it with hdv + ui.mjs

Preconditions:

- Baseline instance, office opened, doctor `ok` (doctor's last check proves the stub wake is configured; `launch` set margin 0).
- An exhausted window resetting soon. Run `echo '[{"name":"Solo","window":"5h","used_pct":100,"resets_at":'$(( $(date +%s)+30 ))'}]' | $H hd quota -`.

- **Queue.** Run `$U press Meta+Shift+Space`, `$U fill --css '.phone-pad' --value 'Write the weekly digest'`, `$U press Alt+Enter`. `$U wait --css '#rail .ticket.queued' --text 'Write the weekly digest'` succeeds and `$U text --css '#rail .ticket.queued .tk-foot'` reads `⏳ waiting for reset · <n>m`.
- **Held, not sent.** `$H hd schedule list` lists `reset-req-...` and a `limit-<reset>` wake; `answers.jsonl` has no `Write the weekly digest`; `$U text --css '#sched-chip'` reads `⏳ 1 queued · ↻ ... · ☕ ...`; `$HDV_HOME/schedule/keep-awake.json` names a live pid running `$HDV_STATE/bin/caffeinate -i -t <secs>`. Run `$H capture scheduler queued`.
- **Too early.** Run `$H tick` before the reset. It delivers nothing.
- **Deliver.** After the reset time run `$H tick`. Stdout `delivered limit-<reset>` then `delivered reset-req-...`; `$H wake-log` shows one `limit` and one `reset` line; `answers.jsonl` ends with `{"id":"req-...","action":"request","note":"Write the weekly digest","to":"<mate dialed last>","queued_at":...,"at":...}`.
- **Ticket flips.** `$U wait --css '#rail .ticket.waiting' --text 'Write the weekly digest'`; its `.tk-foot` reads `sent · waiting <n>m`; `#rail .ticket.queued` is gone; `scheduler.json` has `"keep_awake": null` when nothing else is queued.
- **Once.** Run `$H tick` again. It prints nothing new and `wake.log` is unchanged.
- **Withdraw.** Queue another order, click its ticket, then `$U click --role button --name Withdraw`. `$H hd schedule list` no longer lists it and nothing is written at the next tick.
- **CLI entry.** Run `$H hd schedule +1m "Check the deploy" --request` and `$H hd schedule list`; tick after a minute delivers it the same way.
- **Proof.** Run `$H capture scheduler delivered`; `delivered.state/` holds `answers.jsonl`, `scheduler.json` and `wake.log`.

## Gotchas

- Only `$H tick` delivers; there is no launchd job in a verification run, by design. Never run `hd scheduler install`.
- `margin` is 0 only because `launch` set it; the product default is 90 s after the reset.
- "After reset" waits for every exhausted window; a second window at 100 % with a later reset holds the order longer.
- Without the quota line at 100 %, a reset-queued order goes on the very next tick.
- The stub wake log is the only wake proof; a real wake (`adapters/firstmate/wake.sh`) is never run here.
