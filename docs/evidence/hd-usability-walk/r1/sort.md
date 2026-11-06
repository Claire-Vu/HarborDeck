# Round 1: findings sorted

Walker: fresh Opus 5.5 (`claude-opus-5-5`), page only, own headless instance, 11 missions ([walker-report.md](walker-report.md)).
Auditor: fresh Opus 5.5, page only, own instance, 1440x900, captain's bar verbatim ([auditor-report.md](auditor-report.md)).
Layout check: `layout-check.js` on 32 states x 2 sizes (1440x868, 1000x640): [before](layout-check-before.txt) 1 of 63 clean, [after](layout-check-after.txt) 65 of 65 clean.

## Fix now (done in this round)

| # | From | What the user did / saw | Fix |
|---|---|---|---|
| 1 | walker M1 | Manifest "First up" and the queue put PR 142 (P1, due 19h) above the app store agreement (P1, overdue 2h, blocking the beta) | A missed deadline lifts an item one step, like a waiting worker; among equals the overdue one goes first. First up, the queue and the cat now agree |
| 2 | walker M1 | The cat's "this one first" sat on a P4 while a P2 waited in the same scene | The cat uses the queue's own order (it ranked by priority + age before) |
| 3 | walker M1 | Stamp reads FILE, screen reader says "Approve"; "File" not clickable by name | The stamp's spoken name follows its label; with no item the labels read Approve / Needs work (not "needswork") |
| 4 | walker M5, M8 | First Mate's reply to an order: popover showed name and time, empty body | The popover shows the reply item's summary, else its latest message (`hd reply` writes a thread, not a summary) |
| 5 | auditor §4 | Ticket popover opened at the window's top-left, over the header | Anchored under its ticket (the rail re-renders on open; the old element was detached) |
| 6 | walker M9 | Chip read "1 queued · ☕ 02:20 PM" while the reset was 02:15: two times, wrong one shown | Chip reads "⏳ 1 queued · 02:44 PM · ☕": the send time; the keep-awake end stays in the tooltip |
| 7 | walker M9 | "Queue for after reset" did not say which reset | The button carries the time it goes: "Queue for after reset · 02:45 PM" |
| 8 | walker M10, auditor §4 | Undo pill sat on the key legend | Toasts sit beside the open stamp tray (above it on a narrow desk) |
| 9 | layout check | Closed drawers (orders, archive, agent log) and the closed stamp tray stayed laid out off screen, reachable by Tab | Hidden when closed (visibility, after the slide) |
| 10 | layout check | At 1000x640 the stamp tray pushed the page taller than the window: Next, the legend and the desk bottom fell off screen | Tray scrolls inside its column |
| 11 | layout check, auditor §4 | PR desk: papers stacked under the photo ran past the desk bottom (correspondence off screen) | Stacked papers share what the reading paper leaves, so the column ends inside the desk |
| 12 | auditor §4 | "Stamp the sheet" cut at the sheet's bottom edge | Sheet footer sticks to the sheet's bottom while it scrolls |
| 13 | auditor §4 | Stamps handle overlapped the right edge of papers | Papers are laid out short of the handle |
| 14 | auditor §4 (menu covered once) | A clicked paper (z 89) could cover the header menu (z 60) | The desk is its own stacking context |
| 15 | auditor §4 | Inspect banner covered the ticket rail | Banner sits at the desk bottom; text "Inspect: claim → evidence", the how-to on hover |
| 16 | auditor §1, §3 | "high tide 1h 59m · 18 to clear" and "18 to zero" said the same count twice over the scene | Tide line keeps only "high tide 1h 59m"; the sill keeps "N to zero" |
| 17 | auditor §2 | "STAMPS" heading repeated the STAMPS handle | Heading removed |
| 18 | auditor §1 | Helper lines: sheet "A–E pick on the row in focus…", ask "A–E pick · Space stamps", row "not opened yet, open it to include", "Your verdict on the work.", "Only you can do this. File it when done.", empty-box toast, Standing orders / Agent log / Gaps blurbs, Settings helper line under every label, duplicate "STAMINA" in the Stamina dialog | Removed or moved to a hover tooltip; asks read "Your verdict", "Read, then file", "Do it, then file"; row reads "Review: not opened"; an empty storage box shakes instead of a toast |
| 19 | auditor "also" | Near-invisible buttons: plain-mode Later, Settings "Off"; dark theme "due 2d 23h" pale blue on beige | Later gets a fill; Off gets ink; due chips on paper use paper ink |
| 20 | auditor §4 | Ships out boat labels cut mid-word ("Merge PR 142 (calmer c") | Cut with "…" |
| 21 | layout check | Photo paper's grip 4 px wider than the paper; stow-box leaf 3 px below its stack; a wiggling "new reply" ticket tipped out of the rail | Grip matches the photo padding; leaf raised 3 px; rail 4 px taller, wiggle ±2° |
| 22 | walker M2 | Sample data: research said Option A = one plan, the sheet A = free + pro; "$70/mo" vs "$40/mo" | Report's options in the sheet's order; the flag reads "(+$40/mo) pushes total tooling to about $70/mo" |

## Reviewer's call (held for the captain, not built)

| # | From | Finding | Why it is the captain's |
|---|---|---|---|
| R1 | walker M5, M8 | A reply to a phone order arrives as a new Research item on the captain's list ("my request became my chore"; count goes up) | CONTRACT: a reply to a request is an `answer` item. Changing where order replies live changes the product model |
| R2 | walker M8 (failed) | "Add to…" cannot reach running crew work (e.g. "Rewrite the drag-and-drop test"); the galley is picture only | CONTRACT: fleet crew is "status and flavour only, nothing in the app controls crew". Proposal: list working crew tasks in Add to…, send a `comment` on the task id, let `hd reply` accept it |
| R3 | walker M3 | After Needs work and the mate's "on it" reply, PR 142 is back on top as a normal P1 with Merge preselected; easy to merge by mistake mid-rework | How a sent-back item looks after the agent acknowledges is a product-model call |
| R4 | walker M7 | "Bring back now" on a parked item writes nothing; firstmate keeps its hold until the deferred date | Needs a new answer action and a bridge change (adapters/firstmate, out of this branch's scope) |
| R5 | auditor §2, §3 | Three scene/kind switches (‹ › arrows, count pips, kind chips) and the left list repeating the scene line | Reverses the captain's scene + window layout decisions |
| R6 | auditor §2 | "Stamp the sheet" duplicates Space / the Approve stamp | The walker used the button to finish M4 and M6; removing it trades discoverability for the bar |
| R7 | auditor §1, §3 | The key legend in the stamp column (and the phone's key row) | A cheat sheet the captain may want for speed; it is also the largest explaining string left |
| R8 | walker M10 | Reject is one click with no reason box; cash is paid for any verdict, reject included | The stamp flow and cash model are the captain's management-sim design |
| R9 | auditor "also" | Connect an agent is still the dark modal with plain inputs, a dev-style checkbox, monospace blocks and consent paragraphs | Restyling setup and trimming its consent text is a design pass of its own |
| R10 | walker M2, M4 | Bundled "+1" reads: a research report arrives as a question sheet with another report tucked in | Bundling is the quick-calls design |
| R11 | walker, all | Game words (tide, boats, galley, pier, crew paused, Stamina, chandlery) never explained | The captain asked for the management-sim feel; tooltips exist |
| R12 | walker M5 | The phone (only way to send a new order) is a small horn icon; the walker looked in the menu first | A menu entry would be a second control for the same job |
| R13 | auditor §4 | Usage strip folds windows behind "+1"/"+2" | The captain asked for refill times per subscription; showing all needs more header room |

## Out of scope / not a defect

- Walker tool mismatches: `click --text` matched a longer title ("Waitlist order" hit the question "Pick by waitlist order…"), so the first click "moved focus only". Reproduced with a direct click: one click picks. Harness fixed for round 2 (exact visible match first).
- PR card "Open" went to the system browser (the walk guard logs it instead of opening).
- Sample media (placeholder mock, harbor promo video on the PR) and the pretend agent's reply wording.
- Desk moving on after a stamp, including Ask (the Papers-Please flow); no "Decided: …" toast (the captain rejected decision toasts).
- Speech-bubble memory line ends in "…" by design; full text on hover.

## Keep (do not lose)

- Morning manifest as the start: counts, First up, galley, stamina.
- Needs work / Ask slips say who they go to ("to Web mate").
- Replies easy to find on the ticket rail; "new reply" state.
- Later slip: clear when it comes back; Parked shelf.
- Usage numbers and reset times easy to read.
- Question sheet with recommendations prefilled: quick once understood.
- Agent log shows exactly what went out.
