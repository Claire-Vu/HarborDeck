---------------------------- MODULE HdDelivery ----------------------------
(***************************************************************************)
(* The HarborDeck -> firstmate delivery protocol (adapters/firstmate/).     *)
(* Promise: every stamp, ask, comment or request the captain makes on the  *)
(* desk reaches a firstmate session that acts on it, and a decision on a   *)
(* held task reaches the worker waiting on that task, with no touch of the *)
(* firstmate terminal.                                                      *)
(*                                                                         *)
(* One step here is one step in the code (see ../SKILL.md, coverage):      *)
(*   BridgeRoutes   hd-bridge.sh route(): keyed() + note() for one line    *)
(*   BridgeEnsure   hd-bridge.sh listen() -> hd-listener.sh ensure         *)
(*   GraceExpires   HD_LISTENER_GRACE passes on cursors/firstmate-listener *)
(*   TakesTypedTurn the session takes the typed wake / first prompt        *)
(*   Drains         fm-session-start / fm-wake-drain + relay by fm-send    *)
(*   TurnEnds       Claude Stop hook fm-claude-stop-autoarm.sh             *)
(* No step wakes firstmate from its watcher: fm-watch.sh surfaces only     *)
(* process-event `check` rows, never an inbox note's (the live walk found  *)
(* this; notes wait for the next drain). An armed watcher is not delivery. *)
(***************************************************************************)
EXTENDS Naturals

CONSTANTS
  Answers,    \* what the captain stamps; "dec" decides the held task a worker waits on, "req" is an order
  MaxFaults,  \* how many faults may happen: a session dies, a typed wake is lost, the watcher dies, the bridge restarts
  KeyedNote,  \* TRUE: a keyed decide on a held task is also an inbox note (route(), "$closed")
  Listener,   \* TRUE: after a batch the bridge runs hd-listener.sh ensure (listen())
  Recheck,    \* TRUE: --follow re-runs ensure while a HarborDeck note is unread (OWED), and a restart starts owed
  TrustWatcher \* TRUE: ensure leaves a session with a live watcher alone (the listener before the live walk)

VARIABLES
  stamped,  \* answers the desk appended to answers.jsonl
  toRoute,  \* appended answers past the bridge cursor, not routed yet
  inbox,    \* HarborDeck notes in state/inbox firstmate has not drained; each queued one `check` wake
  hold,     \* "held" | "closed": the captain hold that "dec" answers
  worker,   \* "waiting" | "told": the worker parked on that held task
  session,  \* "none" | "opened" (process up, no turn yet) | "idle" (between turns) | "busy" (mid-turn)
  duty,     \* the running turn was started to drain (a typed wake), so it drains before it ends
  watcher,  \* the home's watcher is armed (it supervises workers; it never presents an inbox note)
  typed,    \* a prompt typed into the session's pane that it has not taken as a turn yet
  recent,   \* hd-listener.sh recorded a wake or start younger than HD_LISTENER_GRACE
  owed,     \* the bridge will run hd-listener.sh ensure: after a batch, then on its timer while notes are unread
  faults

vars == <<stamped, toRoute, inbox, hold, worker, session, duty, watcher, typed, recent, owed, faults>>
sess == <<session, duty, watcher, typed>>

Listening == session = "idle" /\ watcher

Init ==
  /\ stamped = {} /\ toRoute = {} /\ inbox = {}
  /\ hold = "held" /\ worker = "waiting"
  /\ session \in {"none", "opened", "idle"}   \* not running, just opened by hand, or open between turns
  /\ watcher \in IF session = "idle" THEN BOOLEAN ELSE {FALSE}
  /\ duty = FALSE /\ typed = FALSE /\ recent = FALSE /\ owed = FALSE /\ faults = 0

\* The desk appends one answer line (app/lib/store.js appendAnswer).
CaptainStamps(a) ==
  /\ a \notin stamped
  /\ stamped' = stamped \cup {a}
  /\ toRoute' = toRoute \cup {a}
  /\ UNCHANGED <<inbox, hold, worker, sess, recent, owed, faults>>

\* route(): an inbox note (fm-inbox.sh note queues one `check` wake); "dec" first closes the hold with a keyed
\* answer (fm-captain-hold.sh answers), and notes it only with KeyedNote. The cursor moves past the line after.
BridgeRoutes(a) ==
  /\ a \in toRoute
  /\ toRoute' = toRoute \ {a}
  /\ hold' = IF a = "dec" THEN "closed" ELSE hold
  /\ inbox' = IF a = "dec" /\ ~KeyedNote THEN inbox ELSE inbox \cup {a}
  /\ owed' = (owed \/ Listener)
  /\ UNCHANGED <<stamped, worker, sess, recent, faults>>

\* hd-listener.sh ensure, run by listen() once the batch is routed: "clear" when firstmate read every HarborDeck
\* note (and the wake record is dropped); nothing while it is mid-turn or a wake/start is younger than the grace;
\* else it types the wake into the open session (fm-send.sh), watcher or not, or starts a session with the wake
\* as its first prompt.
BridgeEnsure ==
  /\ owed /\ toRoute = {}
  /\ IF inbox = {}
       THEN owed' = FALSE /\ recent' = FALSE /\ UNCHANGED <<session, typed>>
       ELSE /\ owed' = Recheck
            /\ IF (TrustWatcher /\ Listening) \/ recent \/ session = "busy"
                 THEN UNCHANGED <<session, typed, recent>>
                 ELSE /\ typed' = TRUE /\ recent' = TRUE
                      /\ session' = IF session = "none" THEN "opened" ELSE session
  /\ UNCHANGED <<stamped, toRoute, inbox, hold, worker, duty, watcher, faults>>

GraceExpires ==
  /\ recent /\ recent' = FALSE
  /\ UNCHANGED <<stamped, toRoute, inbox, hold, worker, sess, owed, faults>>

\* The captain opens firstmate by hand, and leaves it at its prompt (gap 1's start).
CaptainOpens ==
  /\ session = "none" /\ session' = "opened"
  /\ UNCHANGED <<stamped, toRoute, inbox, hold, worker, duty, watcher, typed, recent, owed, faults>>

\* The session takes the typed wake (or its first prompt) as a turn that drains.
TakesTypedTurn ==
  /\ typed /\ session \in {"opened", "idle"}
  /\ session' = "busy" /\ duty' = TRUE /\ typed' = FALSE /\ watcher' = FALSE
  /\ UNCHANGED <<stamped, toRoute, inbox, hold, worker, recent, owed, faults>>

\* The captain types something else in the firstmate terminal: a turn that need not look at the inbox.
CaptainTurn ==
  /\ session \in {"opened", "idle"}
  /\ session' = "busy" /\ duty' = FALSE /\ watcher' = FALSE
  /\ UNCHANGED <<stamped, toRoute, inbox, hold, worker, typed, recent, owed, faults>>

\* The turn's wake drain presents every note; firstmate acts on each and sends the decision to the waiting worker.
\* The wake record names the note it was typed for, so once that note is read the record no longer holds a newer
\* note back (hd-listener.sh recent()).
Drains ==
  /\ session = "busy" /\ inbox # {}
  /\ inbox' = {} /\ duty' = FALSE /\ recent' = FALSE
  /\ worker' = IF "dec" \in inbox /\ hold = "closed" THEN "told" ELSE worker
  /\ UNCHANGED <<stamped, toRoute, hold, session, watcher, typed, owed, faults>>

\* The turn ends (a wake turn once nothing is left to drain). The Stop hook arms the watcher, or does not
\* (no supervision need, or no lock yet).
TurnEnds ==
  /\ session = "busy" /\ (~duty \/ inbox = {})
  /\ session' = "idle" /\ watcher' \in BOOLEAN
  /\ UNCHANGED <<stamped, toRoute, inbox, hold, worker, duty, typed, recent, owed, faults>>

\* Faults, at most MaxFaults in a run.
SessionDies ==
  /\ faults < MaxFaults /\ session # "none"
  /\ session' = "none" /\ duty' = FALSE /\ watcher' = FALSE /\ typed' = FALSE /\ faults' = faults + 1
  /\ UNCHANGED <<stamped, toRoute, inbox, hold, worker, recent, owed>>
WakeLost ==   \* fm-send typed it but the submit never landed (exit 3)
  /\ faults < MaxFaults /\ typed
  /\ typed' = FALSE /\ faults' = faults + 1
  /\ UNCHANGED <<stamped, toRoute, inbox, hold, worker, session, duty, watcher, recent, owed>>
WatcherDies ==
  /\ faults < MaxFaults /\ watcher
  /\ watcher' = FALSE /\ faults' = faults + 1
  /\ UNCHANGED <<stamped, toRoute, inbox, hold, worker, session, duty, typed, recent, owed>>
BridgeRestarts ==   \* launchd restarts hd-live.sh; a fresh bridge starts owed only with Recheck
  /\ faults < MaxFaults
  /\ owed' = (Listener /\ Recheck) /\ faults' = faults + 1
  /\ UNCHANGED <<stamped, toRoute, inbox, hold, worker, sess, recent>>

Next ==
  \/ \E a \in Answers : CaptainStamps(a) \/ BridgeRoutes(a)
  \/ BridgeEnsure \/ GraceExpires
  \/ CaptainOpens \/ TakesTypedTurn \/ CaptainTurn \/ Drains \/ TurnEnds
  \/ SessionDies \/ WakeLost \/ WatcherDies \/ BridgeRestarts

\* The bridge, the listener's clock, and a firstmate turn that has work keep going; a check the bridge owes or a typed
\* prompt that is offered again and again is eventually taken. The captain need not do anything.
Fairness ==
  /\ \A a \in Answers : WF_vars(BridgeRoutes(a))
  /\ SF_vars(BridgeEnsure) /\ WF_vars(GraceExpires)   \* the recheck timer fires whatever the session does
  /\ SF_vars(TakesTypedTurn)
  /\ WF_vars(Drains) /\ WF_vars(TurnEnds)

Spec == Init /\ [][Next]_vars /\ Fairness

----------------------------------------------------------------------------
\* Rules the captain agreed to.

\* A decision that closed a hold is never silent: until firstmate passes it on, it waits in firstmate's inbox.
DecisionNotLost == (hold = "closed" /\ worker = "waiting") => "dec" \in inbox

\* While a note is unread, something is on its way to act on it: the bridge still owes a check, a wake or start
\* is in flight, or firstmate is mid-turn. An armed watcher does not count. Never a note with nobody coming.
SomeoneComing ==
  inbox # {} => (owed \/ toRoute # {} \/ recent \/ typed \/ session = "busy")

\* Every note is read, and the worker hears the decision, with no help from the captain.
NoteRead == inbox # {} ~> inbox = {}
WorkerTold == hold = "closed" ~> worker = "told"
=============================================================================
