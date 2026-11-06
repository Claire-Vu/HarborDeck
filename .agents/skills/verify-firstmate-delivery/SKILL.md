---
name: verify-firstmate-delivery
description: Formally verify that everything the captain sends from HarborDeck reaches a firstmate session that acts on it, and that a decision on a held task reaches the worker waiting on it. A TLA+ model of the bridge <-> firstmate delivery protocol (adapters/firstmate/hd-bridge.sh route/listen, hd-listener.sh ensure, wake.sh) checked by TLC, plus the adapter tests that pin the model to the code. Use before and after any change to hd-bridge.sh, hd-listener.sh, wake.sh, hd-live.sh, install.sh's HD_FM_START/label handling, or firstmate-instructions.md's wake and relay rules.
---

# Verify firstmate delivery

**The promise.** Every stamp, ask, comment or order the captain makes on the desk reaches a firstmate session that acts on it, and a decide/approve/reject on a held task reaches the worker parked on that task, without the captain touching the firstmate terminal.
**The harm when it breaks.** The captain's work sits unread in firstmate's inbox (no session, or a session nobody wakes), or a worker stays blocked on a question the captain already answered. Tests rarely reach this: it needs a session opened at the wrong moment, a lost keystroke, a crash, or a bridge restart between two steps.

## Run it

```sh
.agents/skills/verify-firstmate-delivery/check.sh            # model (5 configs) + adapter tests, about 30 s
.agents/skills/verify-firstmate-delivery/check.sh --model-only
```

Needs Java 11+. The first run downloads TLC (`tla2tools.jar` 1.7.4, sha256-pinned) to `~/.cache/harbordeck-tla`; set `TLA2TOOLS=<jar>` to use one you have. Exit 0 means every verdict matched: the code's model passes, and every broken variant still breaks the rule it must. Read every result, pass or fail, with the pstack `/statechart` skill on `model/HdDelivery.tla` with that config and `model/view.mjs` as the view: it turns a TLC counterexample into the shortest path in the captain's words, and draws the passing chart (use `chart.cfg`; the full config is past the chart budget).

## What is checked

`model/HdDelivery.tla`, rules (INVARIANT or PROPERTY):

| Rule | Plain sentence |
|---|---|
| `DecisionNotLost` | A decision that closed a hold waits in firstmate's inbox until firstmate passes it on. |
| `SomeoneComing` | While a note is unread, something is on its way to act: the bridge owes a check, a wake or start is in flight, the watcher is armed, or firstmate is mid-turn. |
| `NoteRead` | Every note is eventually read (liveness). |
| `WorkerTold` | A worker waiting on a closed hold is eventually told (liveness). |

| Config | Scope | Expected |
|---|---|---|
| `HdDelivery.cfg` | an order and a held decision, up to 3 faults (session dies, typed wake lost, watcher dies, bridge restarts), every start state (not running, just opened, idle with or without watcher) | all hold (~1,600 states) |
| `chart.cfg` | one held decision, no faults | all hold (63 states), drawable |
| `before-fix.cfg` | `Listener`, `KeyedNote`, `Recheck` off: the bridge before this protocol | `SomeoneComing` breaks |
| `no-keyed-note.cfg` | keyed decide closes the hold with no note | `DecisionNotLost` breaks |
| `no-recheck.cfg` | listener after a batch only, no timer, restart forgets | `SomeoneComing` breaks |

**Assumptions** (outside the model, so a pass does not cover them): one firstmate session per home (two at once is the session lock's job); herdr's server is running when a start is needed (`hd-listener.sh` never starts herdr; with it down the desk says `down` and the bridge keeps retrying); a turn started by a HarborDeck wake or by the watcher drains the inbox and relays a closed decision (that is the instruction in `adapters/firstmate/firstmate-instructions.md`; the model cannot check the model-in-the-loop); the watcher presents a `check` wake queued before it armed; the bridge's recheck timer fires whatever the session does (strong fairness); faults are finitely many.

## Coverage: model step -> code

| Model | Code | Pinned by (`adapters/firstmate/test/run.sh`) |
|---|---|---|
| `CaptainStamps` | `app/lib/store.js` appendAnswer (one `answers.jsonl` line) | store tests |
| `BridgeRoutes` (`KeyedNote`) | `hd-bridge.sh` `route()`: `keyed` then `note "$rid" "$text. $closed"` for decide/approve/reject; defer: `hold --until` + note | "closed hold also wakes firstmate", "Later on a held task also tells firstmate" |
| `BridgeEnsure` (`Listener`) | `hd-bridge.sh` `listen()` -> `hd-listener.sh ensure`: `unread` (clear), `probe` (listening / busy / recent / idle / down), wake via `fm-send.sh`, start via herdr | all `listener:` checks |
| `owed` (`Recheck`) | `hd-bridge.sh` `OWED` (starts 1 in live mode), `--wait --timeout $RECHECK` while owed | "bridge --follow: an unread note is re-woken on the timer", "...left alone once firstmate read it" |
| `recent`, `GraceExpires` | `hd-listener.sh` `record`/`recent`, `cursors/firstmate-listener`, `HD_LISTENER_GRACE` | "does not wake again", "past the grace it wakes again" |
| `TakesTypedTurn`, `WakeLost` | `fm-send.sh` typed plane (exit 0 / 3) | wake.sh unit test (`cli/test/scheduler.test.js`) |
| `WatcherWakes`, `TurnEnds`, `Drains` | firstmate: Stop hook `bin/fm-claude-stop-autoarm.sh`, `bin/fm-session-start.sh`, `bin/fm-wake-drain.sh` (not in this repo) | live walk only (`docs/evidence/hd-seamless/`) |

Sync commit (the code this model was last confirmed against): see the commit that adds this line on branch `fm/hd-seamless` (`git log -1 --format=%h -- .agents/skills/verify-firstmate-delivery/SKILL.md`). Move it forward only after re-reading every row above at the new commit and confirming the model still describes it.

## When a check fails

- **A code test fails** (`code: adapter tests`): the code no longer does what the model's step says. If the change was not meant to change delivery, fix the code. If it was, change the model step in the same commit, rerun, and update the coverage row.
- **`HdDelivery.cfg` breaks a rule**: read the path with `/statechart`. Then replay it against the real code, one step per action (adapter test or a live walk on a scratch home, never the captain's home). If it reproduces, it is a real bug: report it with the path; never weaken the rule or the config to make it pass. If it does not reproduce, the model is wrong: fix the step that differs from the code.
- **A broken variant passes**: the model lost its teeth (a step got too strong or a rule too weak). Fix the model until it fails again.
- **Changing what the code promises** (a new answer action, a new way to start firstmate, a new fault): add the action or constant, a rule if the promise grew, and a broken variant that shows the new rule can fail.
