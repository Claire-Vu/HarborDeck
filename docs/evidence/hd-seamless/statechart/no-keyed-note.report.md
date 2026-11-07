# HdDelivery

TLC reached 139 states and 407 steps. The chart draws 66 states and 182 arrows.
The chart does not draw 56 steps that stay in one chart state.
The model goes from Desk order unread, wake on its way, Firstmate firstmate idle, not listening to Desk order unread, wake on its way, Firstmate firstmate mid-turn by firstmate takes the wake, which the regions chart cannot show. So the chart draws parent states in place of regions.

## DecisionNotLost breaks
The shortest path has 2 steps:
0. Desk nothing stamped, Firstmate firstmate idle, not listening
1. you stamp on the desk: Desk decision at the bridge, Firstmate firstmate idle, not listening
2. the bridge routes it: Desk decision closed the hold, worker not told, Firstmate firstmate idle, not listening

## WorkerTold breaks
TLC's counterexample is in tlc-WorkerTold.out. It has 9 steps:
0. Desk nothing stamped, Firstmate firstmate idle, not listening
1. you stamp on the desk: Desk decision at the bridge, Firstmate firstmate idle, not listening
2. you type to firstmate: Desk decision at the bridge, Firstmate firstmate mid-turn
3. the bridge routes it: Desk decision closed the hold, worker not told, Firstmate firstmate mid-turn
4. you stamp on the desk: Desk decision closed the hold, worker not told, order at the bridge, Firstmate firstmate mid-turn
5. the bridge routes it: Desk decision closed the hold, worker not told, order unread, bridge will check, Firstmate firstmate mid-turn
6. firstmate reads its inbox: Desk decision closed the hold, worker not told, order read, Firstmate firstmate mid-turn
7. HarborDeck checks firstmate: Desk decision closed the hold, worker not told, order read, Firstmate firstmate mid-turn
8. the turn ends, no watcher: Desk decision closed the hold, worker not told, order read, Firstmate firstmate idle, not listening
9. you type to firstmate: Desk decision closed the hold, worker not told, order read, Firstmate firstmate mid-turn
The run loops through "Desk decision closed the hold, worker not told, order read, Firstmate firstmate mid-turn" and "Desk decision closed the hold, worker not told, order read, Firstmate firstmate idle, not listening" forever.

## Rules that hold
SomeoneComing, NoDeadlock, NoteRead
