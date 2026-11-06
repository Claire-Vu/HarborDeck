# HdDelivery

TLC reached 54 states and 135 steps. The chart draws 17 states and 23 arrows.

## DecisionNotLost breaks
The shortest path has 2 steps:
0. Desk nothing stamped, Firstmate firstmate idle, not listening
1. you stamp on the desk: Desk decision at the bridge, Firstmate firstmate idle, not listening
2. the bridge routes it: Desk decision closed the hold, worker not told, Firstmate firstmate idle, not listening

## SomeoneComing breaks
The shortest path has 2 steps:
0. Desk nothing stamped, Firstmate firstmate idle, not listening
1. you stamp on the desk: Desk order at the bridge, Firstmate firstmate idle, not listening
2. the bridge routes it: Desk order unread, Firstmate firstmate idle, not listening

## NoteRead breaks
TLC's counterexample is in tlc-NoteRead.out. It has 6 steps:
0. Desk nothing stamped, Firstmate firstmate listening
1. you stamp on the desk: Desk decision at the bridge, Firstmate firstmate listening
2. you stamp on the desk: Desk decision at the bridge, order at the bridge, Firstmate firstmate listening
3. the bridge routes it: Desk decision at the bridge, order unread, Firstmate firstmate listening
4. the bridge routes it: Desk decision closed the hold, worker not told, order unread, Firstmate firstmate listening
5. you type to firstmate: Desk decision closed the hold, worker not told, order unread, Firstmate firstmate mid-turn
6. the turn ends, watcher armed: Desk decision closed the hold, worker not told, order unread, Firstmate firstmate listening
The run loops through "Desk decision closed the hold, worker not told, order unread, Firstmate firstmate listening" and "Desk decision closed the hold, worker not told, order unread, Firstmate firstmate mid-turn" forever.

## WorkerTold breaks
TLC's counterexample is in tlc-WorkerTold.out. It has 8 steps:
0. Desk nothing stamped, Firstmate firstmate idle, not listening
1. you stamp on the desk: Desk decision at the bridge, Firstmate firstmate idle, not listening
2. the bridge routes it: Desk decision closed the hold, worker not told, Firstmate firstmate idle, not listening
3. you stamp on the desk: Desk decision closed the hold, worker not told, order at the bridge, Firstmate firstmate idle, not listening
4. you type to firstmate: Desk decision closed the hold, worker not told, order at the bridge, Firstmate firstmate mid-turn
5. the bridge routes it: Desk decision closed the hold, worker not told, order unread, Firstmate firstmate mid-turn
6. firstmate reads its inbox: Desk decision closed the hold, worker not told, order read, Firstmate firstmate mid-turn
7. the turn ends, no watcher: Desk decision closed the hold, worker not told, order read, Firstmate firstmate idle, not listening
8. you type to firstmate: Desk decision closed the hold, worker not told, order read, Firstmate firstmate mid-turn
The run loops through "Desk decision closed the hold, worker not told, order read, Firstmate firstmate mid-turn" and "Desk decision closed the hold, worker not told, order read, Firstmate firstmate idle, not listening" forever.

## Rules that hold
NoDeadlock
