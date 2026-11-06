# Round 3: findings sorted

Walker: fresh Opus 5.5, page only, own instance. It had 14 missions: the core captain goals again (what first, pricing, PR rework with mark-up, Postgres report, new order, beta sheet by hand, park and bring back, Add to…, usage and queue after reset, undo a reject, ask) and the controls rounds 1 and 2 never reached (back of the line, plain mode and back, desk sounds) ([walker-report.md](walker-report.md)).
Auditor: fresh Opus 5.5, page only, own instance, same bar, 67 shots ([auditor-report.md](auditor-report.md)).
Layout check: [before](layout-check-before.txt) is round 2's after (68/68); [after](layout-check-after.txt) 72/72 clean (new: the rail after three orders, and paged).

## Fix now (done in this round)

| # | From | What the user did or saw | Fix |
|---|---|---|---|
| 1 | walker M2 | Pricing sheet: picked "One plan" and pressed Approve. The unticked, never-opened "Review onboarding copy v2" row was approved too (reproduced: two lines, `onboarding-copy approve` and `pricing-launch decide`) | Picking an option on the last decision row moved focus onto the review row, and that move counted as opening it, which ticked it. A pick now moves only to the next decision row, so a row to read opens only by J/K or a click. Reproduced again after the fix: one line. New smoke check |
| 2 | auditor §4 | Ticket popover ran past the top of the window and over the usage strip | Round 2 regression: a `//` comment placed in the middle of a line swallowed `pop.style.top`. The popover sits under its ticket again. The branch diff was scanned for the same slip |
| 3 | walker M5, auditor §4 | A just-sent order hid behind "2 more ›". Paging left tickets cut at both edges | A ticket sent within the last 30 s scrolls into view. A page click moves the ticket cut at that edge to the opposite edge, whole, with its neighbour fully off screen and room left for the cue that is about to appear. The TICKETS label scrolls with the tickets, so nothing slides under it |
| 4 | walker M14 | Desk sounds: clicked, row turned orange, and the walker could not tell whether sound was on or off. A screen reader says only "menuitem" | Sound and music are menu checkboxes (`aria-checked`). The row ends in "on" or "off" |
| 5 | walker M12 | After "Back of the line", PR 142 was back in front two stamps later | With All shown, the next item after a stamp (or N) came from the urgency queue, which ignored the line. Anyone sent back now stays behind the rest. New smoke check |
| 6 | walker M8 | Add to… a Web mate order: the pad still said "Speak to First Mate…" | The pad names the owner of what the message is added to ("Speak to Web mate…") |
| 7 | walker M8 | The line added to the order was missing from the order's ticket | The ticket shows "you added · time" with the text, under the order |
| 8 | auditor §1 | Archive card "Research · board-app ·" ends on a dangling separator | Empty parts are dropped |
| 9 | auditor §1 | Standing orders drawer always said "0 flagged on this item" | Shown only when something is flagged |
| 10 | auditor §4 | Dark theme: "Back of the line", the paper `—` and Read buttons almost vanish on paper | Paper buttons take the paper ink and an edge that shows on both paper tones |
| 11 | auditor §4 | Ask and Park dialogs: × nearly invisible on cream (dark theme) | × takes the slip's ink, like Settings and the ledger |
| 12 | auditor §4 | Chandlery stamp book labels faint beige on beige | Unearned labels are in the faint paper ink (still unlike the red earned stamp) |
| 13 | walker M6 | The picked option and the recommended one looked alike | A picked option has a heavier green edge and fill |
| 14 | auditor §1 | Settings: "default, in your home folder", "paths resolve in the data folder only", "Set by HARBORDECK_HOME, which wins over the folder below." | The folder shows its name only, with the meaning on hover. The warning reads "Set by HARBORDECK_HOME", with the rest on hover |
| 15 | auditor §4, own check | Usage strip "+1" clipped against the strip's right border (measured: content 13 px wider than the box) | The strip folded only when it re-rendered. It now refits when its room changes (a badge or chip beside it, the cash growing) and once fonts load |

## Reviewer's call (held, not built)

New this round:

| # | From | Finding | Why it is the captain's |
|---|---|---|---|
| R21 | walker M1 (returned after r1 #2) | The cat marks the first item in the scene ("this one first" on PR 142 in Signpost Square), while First up starts with the app store notice | Returned after a fix. Should the cat mean the day's first or the scene's first? That is the sim's design |
| R22 | walker M3 | Mark-up works only on a snapshot of the whole desk. Zoom on the photo has no pin tool | Mark-up on any picture is a new ability, not a fix |
| R23 | walker M13 | Plain mode's only way back is the menu (or P) | A visible toggle would add a control to every plain screen |
| R24 | auditor §3 | The topic view (O, every #tag) is still there, though the captain said "Topics isn't that useful either" | Removing a feature reverses a shipped decision |
| R25 | auditor §2 | The header $ and menu "Chandlery & stamp book" open the same dialog. Ticket popover "Done" sits beside "Close" | Same family as R18 and R20 (one control per job across the app) |
| R26 | auditor §4 | Drawers (Standing orders, Agent log) cover the right end of the header. Native date and time inputs. Agent log raw JSON | Drawer layout and the log's exact-lines design ("Agent log shows exactly what went out" is on the Keep list) |

Returned again (already held in rounds 1 and 2; the stop rule sends these to the captain):
- R1: orders show up as research items on the captain's own list (M5, M8; counts go up).
- R3: a sent-back PR returns as a normal P1 with B still picked (M3).
- R4: Bring back writes no line (M7).
- R5: three scene switches, and the list repeats the scene.
- R6: Stamp the sheet next to Approve (M2).
- R7: the key legend.
- R8: reject has no confirm (M10).
- R9 and R18: the Connect dialog, including paths that wrap mid-word.
- R10: the "+1" bundle badge (M2).
- R11: game words (M9 "Primary Opal", tide, boats).
- R13: usage strip "+N".
- R14: no reopen once the hold has passed (M10). The walker's Undo click landed after the 4 s hold; U inside the hold works (verified in round 2).
- R15: no Send button on the phone (M5).
- R17: item cash reads as real money (M1, M4 "$19").
- R19: agent-written options duplicate the stamps.
- R20: × next to Cancel.

## Out of scope / not a defect

- Demo content: the checkout mock has no error state, and the PR monitor plays the harbor promo (M3).
- The pretend agent edited the newsletter when asked only a question (M11). That is the responder's wording.
- `click --text` timeouts on the phone dial and Add to… list. Harness only: a click by position worked.
- "On a date" prefilled two days out (M7): Tomorrow morning is the option right above it.
- A scrolled paper's content passes under its pinned grip (the Monitor's controls row), by design since round 2.
- Speech bubble ends in "…" with the full text on hover (round 1).
- Money float over the rail's left end for a moment.

## Keep (do not lose)

- Morning manifest and First up: "made what first easy to see" (M1).
- Park for later and Bring back now: "easy and clear" (M7).
- Ask stamp addresses the right mate (M11). Back of the line is easy to find (M12).
- Plain mode: "the clearest view of the whole morning" (M13).
- Usage popover answers how much is left and when it refills (M9). The queued chip leads to Withdraw (M9; round 2 fix holds).
- Beta sheet with recommendations prefilled: three answers in one stamp (M6).
