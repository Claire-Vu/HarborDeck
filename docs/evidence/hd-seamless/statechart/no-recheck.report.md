# HdDelivery

TLC reached 91 states and 288 steps. The chart draws 55 states and 176 arrows.
The chart does not draw 16 steps that stay in one chart state.
The model goes from Desk order unread, wake on its way, Firstmate firstmate idle, not listening to Desk order unread, wake on its way, Firstmate firstmate mid-turn by firstmate takes the wake, which the regions chart cannot show. So the chart draws parent states in place of regions.

## SomeoneComing breaks
The shortest path has 3 steps:
0. Desk nothing stamped, Firstmate firstmate idle, not listening
1. you stamp on the desk: Desk order at the bridge, Firstmate firstmate idle, not listening
2. the bridge routes it: Desk order unread, bridge will check, Firstmate firstmate idle, not listening
3. the bridge restarts: Desk order unread, Firstmate firstmate idle, not listening (after a fault)

## NoteRead breaks
TLC's counterexample is in tlc-NoteRead.out. It has 6 steps:
0. Desk nothing stamped, Firstmate firstmate idle, not listening
1. you stamp on the desk: Desk order at the bridge, Firstmate firstmate idle, not listening
2. you type to firstmate: Desk order at the bridge, Firstmate firstmate mid-turn
3. the bridge routes it: Desk order unread, bridge will check, Firstmate firstmate mid-turn
4. the bridge restarts: Desk order unread, Firstmate firstmate mid-turn (after a fault)
5. the turn ends, no watcher: Desk order unread, Firstmate firstmate idle, not listening (after a fault)
6. you type to firstmate: Desk order unread, Firstmate firstmate mid-turn (after a fault)
The run loops through "Desk order unread, Firstmate firstmate mid-turn (after a fault)" and "Desk order unread, Firstmate firstmate idle, not listening (after a fault)" forever.

## Rules that hold
DecisionNotLost, NoDeadlock, WorkerTold
