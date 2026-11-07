# hd-seamless: HarborDeck to firstmate, end to end

The captain opens HarborDeck and works. Every stamp, ask, comment or order reaches a firstmate session that acts on it. A decision on a held task reaches the worker waiting on it. Nobody touches the firstmate terminal.

## Setup (isolated, throwaway)

- **firstmate:** a disposable lab home from firstmate's own `bin/fm-live-lab.sh` (the same firstmate code as the captain's home). It runs a real Claude Sonnet primary, a gated lab worker (`lab76f96daab579-worker`) and a private tmux server. Paths read `<lab>`.
- **desk:** the `verify-harbordeck` instance (`hdv`), a headless Electron app on a synthetic data dir (`<hdv-home>`). All UI actions go through `ui.mjs`, as the captain would do them.
- **bridge:** `adapters/firstmate/install.sh --no-service --start tmux` (no launchd), then the `hd-live.sh` command it prints, run by hand with its pid recorded. Starting firstmate uses the lab's tmux. `herdr` is a refusing stub first on PATH. `harbordeck` on PATH is a wrapper pinned to `<hdv-home>`.
- **Phase A** ran main's `adapters/` (from `git archive main`) against the same kind of lab. **Phase B** ran this branch.

## Before: main (Phase A)

| Gap | What happened | Evidence |
|---|---|---|
| 1. A request to a freshly opened session | Routed at 19:09:24Z with "firstmate will pick this up at its next check". Still unread 3 min later; the session sat at its prompt. `fm-inbox.sh ready` said `can_receive: true`. | [01](01-main-gap1-order-unread-after-3min.jpg), [phase-a-gap1-main.txt](phase-a-gap1-main.txt) |
| 3. A decide on a held task | The hold closed, but no note was sent. The worker's inbox was unchanged after 2.5 min. | [02](02-main-gap3-decided-worker-untold.jpg), [phase-a-gap3-main.txt](phase-a-gap3-main.txt) |

## After: this branch (Phase B)

Every row was driven from the desk. Each was confirmed on firstmate's side, in [bridge-log.txt](bridge-log.txt), [firstmate-actions.txt](firstmate-actions.txt) (the lab sessions' own transcripts) and [worker-steering-messages.txt](worker-steering-messages.txt). Times are UTC.

| # | Scenario (entry point) | What firstmate did | Result | Evidence |
|---|---|---|---|---|
| S1 | Request; session opened by hand, no turn, no watcher (phone) | The desk showed `idle`. Order 10 at 20:08:30, wake typed 20:08:35, `PONG10` on the rail 20:08:53. | PASS | [06](06-hand-opened-reply-on-rail.jpg) |
| S2 | Request; session at its prompt with its watcher live (phone) | Order 3 at 19:35:38, wake typed 19:35:43, `PONG3` at 19:35:51. Before 8099720, order 2 sat 8 min as "listening". | PASS | [05](05-listening-reply-on-rail.jpg) |
| S3 | Request; firstmate not running (phone) | The desk showed `down`. Order 11 at 20:13:02, claude started in tmux at 20:13:05 (the ticket said "starting up"), `PONG11` at 20:13:27. Same run at 19:36: `PONG4` 21 s after send. | PASS | [03](03-not-running-ticket-starting-up.jpg), [04](04-not-running-reply-on-rail.jpg) |
| S4 | Decide on a held task (stamp a/Space) | Hold closed and note at 19:37:47, wake at 19:37:50. The answer was in the worker's inbox at 19:38:05 (001), and the worker read it. | PASS | [07](07-held-decide-worker-waiting-badge.jpg) (⏸1 badge before) |
| S5 | `.qN` question sheet on a held call (one stamp) | Two notes, wake at 19:44:53. firstmate closed the hold with `answer` and relayed both answers at 19:45:12 (003). | PASS | [08](08-question-sheet.jpg) |
| S6a | Approve on a held review (key 1) | Hold closed at 19:49:01; the worker was told at 19:49:41 (004). | PASS | worker 004 |
| S6b | Reject on a held review (key 2) | Hold closed at 19:50:10; the worker was told at 19:50:22 (005). | PASS | worker 005 |
| S6c | Needs-work with a note (key 3, slip) | Released and noted at 19:50:48; the worker was told "add a Sources section" at 19:51:00 (006). | PASS | worker 006 |
| S7 | Later on a held call (Later slip, 11-07 09:30) | `hold --until 2026-11-08` plus a note. The worker was told to park at 19:51:48 (007). The item is on the Parked shelf. | PASS | [09](09-later-parked.jpg) |
| S8 | Ask on a report (key 4, slip) | Note, then wake at 19:52:32; reply on the rail at 19:52:46. | PASS | [10](10-ask-reply-on-rail.jpg) |
| S8b | Comment via the phone's **Add to…** | Note, then wake at 20:06:40; `SEEN` on the item at 20:06:44. | PASS | [03](03-not-running-ticket-starting-up.jpg) (correspondence pane) |
| S9a | File a report (key 1) | Resolved; the bridge routed no note and typed no wake. | PASS | bridge-log 19:53:15 |
| S9b | File a todo | "done" note, wake at 19:45:40. firstmate recorded the todo done in its backlog. | PASS | firstmate-actions 19:45 |
| S10 | Topics and notes (phone order) | firstmate ran `harbordeck note topic:lab-notes`. The desk topic page (key `o`) shows the note. | PASS | [11](11-topic-page-firstmate-note.jpg) |
| S11 | Screenshot attachment (phone **Snap desk**) | The note carried `Attached: …png`. firstmate opened the image and replied with the paper's title, correctly. | PASS | [12](12-phone-snap-desk-attached.jpg), [13](13-attachment-reply.jpg) |
| S12 | Standing order (**Remember this**) | A `captain.md` bullet `{@req-…}` and a `rules.json` pin. In a burst right after another order, it was woken in 3 s and filed in 9 s. | PASS | [14](14-standing-orders-pinned.jpg) |
| S13 | Usage/quota bar | hd-live ran `hd-quota.sh` (`quota-axi`). The chips match `quota.json` (5h 50% left with countdown and run-out warning, week 94%, Fable 100%). | PASS | [15](15-stamina-bar.jpg) |
| S14 | Queue at a time (phone), real `harbordeck tick` | The tick delivered at 13:06 local. The adapter `wake.sh` typed into the session (rc 0), then the bridge woke it. `PONG9` at 20:06:11; the ticket went from queued to replied. | PASS | [16](16-scheduler-queued-ticket.jpg), [17](17-scheduler-delivered-replied.jpg), [scheduler-wake.log](scheduler-wake.log) |
| S15 | Crew waiting (fleet feed) | hd-fleet set `waiting` on the held item. The desk showed ⏸1 and "1 crew paused". `fleet.json` mate `state` tracks the listener. | PASS | [07](07-held-decide-worker-waiting-badge.jpg) |

## Found by the live walk, fixed on this branch

| Finding | Effect | Fix |
|---|---|---|
| A note's reply command had no data dir | With `--data-dir`, firstmate's `harbordeck reply` went to `~/.harbordeck` ("no such item or request"), so order 1's reply never reached the desk. On main too. | cddd62d: the hint carries `HARBORDECK_HOME=<dir>` off the default dir |
| firstmate's watcher never presents an inbox note | `fm-watch.sh` surfaces only `procevent:` rows; a captain note waits for the next drain. The listener trusted a live watcher, so an idle session at its prompt never read the note (order 2, 8 min). | 8099720: the listener wakes `idle` and `listening` alike. The model drops its watcher wake; `trust-watcher.cfg` fails liveness. |
| The wake grace held a later note back | After a wake was taken, a new note inside 180 s waited out the grace (2.5 min). | 30617de: the record names its note and holds only while that note is unread (model: `Drains` ends `recent`) |
| `hd-rules.sh` had no path | firstmate ran `find /` hunting for it (about 2 min). | 30617de: the note names the `{@id}` marker, and the instructions carry the absolute path and say the feed refreshes the desk |

## Formal model

`.agents/skills/verify-firstmate-delivery/check.sh` → [model-check.txt](model-check.txt): the code's model passes (1,137 states, up to 3 faults). Every broken variant breaks its rule: before-fix `SomeoneComing`, no-keyed-note `DecisionNotLost`, no-recheck `SomeoneComing`, trust-watcher liveness. The `/statechart` reports and charts are in [statechart/](statechart/). The trust-watcher path reads "firstmate listening, decision and order unread, bridge will check, forever", which is what the live walk saw for order 2.

## Observations, not fixed here

- Replies show `agent` when firstmate omits `HARBORDECK_FROM`. The hint has no `--from`, and the instructions ask for the env var.
- A queued order prompts firstmate twice: the scheduler's `wake.sh`, then the bridge's wake. The second turn finds nothing. Harmless.
- `fm-inbox.sh ready` keeps `can_receive: true` for up to 300 s after the watcher dies (beacon grace). The listener also requires a live `fm-watch.sh`.
- A needs-work ticket waits for a desk reply. firstmate relayed it to the worker but did not reply on the desk.
- A date-only hold rounds up, so Later to 11-07 09:30 holds the worker until 11-08. The item returns to the desk at 09:30 on the 7th, and a stamp then closes the hold.
- Not exercised live: the herdr start path and herdr busy detection (stub-tested; the run must not touch the real herdr), and the launchd service (`--no-service`).

## Incidents during this run

1. **A test reached the real herdr (11:25 local).** The first adapter test run's stub `fm-inbox.sh` had no `ready`, so the listener saw `down`. Its herdr start path then ran against the real `herdr` on PATH. It opened a tab named `firstmate` in the captain's real firstmate workspace, with claude stopped at a trust dialog for a deleted temp dir. After confirming the tab was ours, it was closed with `herdr tab close`. **Fix:** the adapter tests put refusing stub `herdr` and `tmux` first on PATH and check that neither was reached. The listener never starts a session outside a firstmate home (`bin/fm-session-start.sh` must exist).
2. **A pattern kill hit the captain's processes (12:00:41 local).** `pkill -f 'bin/fm-watch.sh' -U $(id -u) --` was meant to stop the lab watcher. BSD `pkill` stops reading options at the first pattern, so `-U`, the uid and `--` became extra patterns. It sent SIGTERM to every user process whose command line contained `--` or the uid: the captain's browser tabs, Obsidian, the installed Harbor Deck helpers, the shared no-mistakes daemon (it respawned), the real `dev.harbordeck.firstmate` bridge (launchd restarted it), several Claude sessions, and this run's own desk and lab sessions. The captain's firstmate primary survived. It was reported at once, and firstmate recovered everything. **Rule since:** no `pkill`, `killall` or pattern kills. A process is stopped only by its recorded pid, after its command line is checked (`stop-tree.sh <pid> "<exact command line>"` here).
3. **A read of the real data dir (read-only).** Order 1's reply in the lab followed the bridge's reply hint, which had no `HARBORDECK_HOME` (finding 1). The CLI looked the request up in `~/.harbordeck` and failed before writing anything. **Fixed** in cddd62d. From then on, a `harbordeck` wrapper pinned to the desk's synthetic data dir sat first on the lab's PATH.
4. **A disk-wide search.** The lab firstmate ran `find /` hunting for `hd-rules.sh` (finding 4). It was stopped by exact pid, and the path is fixed.

Not touched at any point: launchd jobs (`--no-service`), the installed Harbor Deck app, the real firstmate home. After incident 2, the real herdr session was never touched either.
