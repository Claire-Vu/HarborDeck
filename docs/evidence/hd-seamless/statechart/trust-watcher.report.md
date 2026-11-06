# HdDelivery

TLC reached 215 states and 662 steps. The chart draws 92 states and 260 arrows.
The chart does not draw 117 steps that stay in one chart state.
The model goes from Desk decision unread, wake on its way, Firstmate firstmate idle, not listening to Desk decision unread, wake on its way, Firstmate firstmate mid-turn by firstmate takes the wake, which the regions chart cannot show. So the chart draws parent states in place of regions.

## NoteRead breaks
TLC's counterexample is in tlc-NoteRead.out. It has 4 steps:
0. Desk nothing stamped, Firstmate firstmate listening
1. you stamp on the desk: Desk decision at the bridge, Firstmate firstmate listening
2. the bridge routes it: Desk decision unread, bridge will check, Firstmate firstmate listening
3. you stamp on the desk: Desk decision unread, order at the bridge, bridge will check, Firstmate firstmate listening
4. the bridge routes it: Desk decision unread, order unread, bridge will check, Firstmate firstmate listening
The run stops in "Desk decision unread, order unread, bridge will check, Firstmate firstmate listening" forever.

## WorkerTold breaks
TLC's counterexample is in tlc-WorkerTold.out. It has 8 steps:
0. Desk nothing stamped, Firstmate firstmate idle, not listening
1. you stamp on the desk: Desk decision at the bridge, Firstmate firstmate idle, not listening
2. you type to firstmate: Desk decision at the bridge, Firstmate firstmate mid-turn
3. you stamp on the desk: Desk decision at the bridge, order at the bridge, Firstmate firstmate mid-turn
4. the bridge routes it: Desk decision at the bridge, order unread, bridge will check, Firstmate firstmate mid-turn
5. firstmate reads its inbox: Desk decision at the bridge, order read, Firstmate firstmate mid-turn
6. the bridge routes it: Desk decision unread, order read, bridge will check, Firstmate firstmate mid-turn
7. the turn ends, watcher armed: Desk decision unread, order read, bridge will check, Firstmate firstmate listening
8. you type to firstmate: Desk decision unread, order read, bridge will check, Firstmate firstmate mid-turn
The run loops through "Desk decision unread, order read, bridge will check, Firstmate firstmate mid-turn" and "Desk decision unread, order read, bridge will check, Firstmate firstmate listening" forever.

## Rules that hold
DecisionNotLost, SomeoneComing, NoDeadlock
