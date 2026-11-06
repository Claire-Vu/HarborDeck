# Round 2: findings sorted

Walker: fresh Opus 5.5, page only, own instance, 13 new missions aimed at controls round 1 never touched (storage box, Shift+A, desk browser, Add to…, queue at a time + withdraw, Remember this, sheet with a row left out, topics, plain mode, archive + agent log, chandlery, theme + shortcut) ([walker-report.md](walker-report.md)).
Auditor: fresh Opus 5.5, page only, own instance, same bar. Its `report.md` write was refused by the harness (a `/tmp` vs `/private/tmp` permission mismatch, fixed for round 3); its full final summary is [auditor-report.md](auditor-report.md).
Layout check: [before](layout-check-before.txt) = round 1 after (64/64); [after](layout-check-after.txt) 68/68 clean (2 new states: the chip's queued ticket, an open plain card).

## Fix now (done in this round)

| # | From | What the user did / saw | Fix |
|---|---|---|---|
| 1 | walker M10 | Plain mode: **Approve** on "Review onboarding copy v2" also decided "Launch pricing" (P2, never opened) as free-pro, same second | A plain card's Approve stamps that card only; "Approve bundle (N)" stays the way to take the sheet |
| 2 | walker M6 | The "1 queued" chip opened an empty phone; the queued ticket hid behind "1 more ›" | The chip opens the first queued ticket's popover (Withdraw there); with nothing queued it still opens the phone |
| 3 | walker M9 | Esc did not close the topic window | The #topic chip kept focus and swallowed every key; it now stops only Enter/Space |
| 4 | walker M11, M8 | Archive showed option keys ("DECIDED: FIFTY") and the stream ("launch") where search shows the project | Archive shows the option's label and the project |
| 5 | walker M10, auditor | Plain list's "$284" lagged the real cash and repeated the top bar | Cash only in the top bar |
| 6 | walker M7 | Standing orders badge "2" matched nothing in the panel | Badge tooltip: "2 standing-order flags on open items" |
| 7 | auditor | Ships out: "No boats went out today." cut at the bottom of the sea | Drawn inside the sea |
| 8 | auditor | Cash pill gold on the light bar near invisible; the usage strip jumped when cash grew | Dark gold on light; the amount keeps a fixed width |
| 9 | auditor | "Price" broke to "Pric/e" in a report table when the stamps were hidden | Tables in papers never break inside a word |
| 10 | auditor | Correspondence scrolled its own header away and looked to slide under the Monitor | A scrolling paper keeps its grip (name, controls) pinned on top |
| 11 | auditor | "Stamp the sheet" sat over the last option | The sheet's footer has an edge and a shadow: reads as a footer the rows scroll under |
| 12 | auditor | Every usage line ended "quota.json, just now · running low, crew yawning" | Source, age and crew flavour moved to the line's tooltip; "stale" and "runs out" stay |
| 13 | auditor (repeat of r1 §3) | Ships out tally twice (header and logbook) | Once, in the header |
| 14 | auditor | Web page paper: View + link + "Open in the desk browser" | One button; the page name stays a link; View gone |
| 15 | own check | Queued ticket popover: "Held in the scheduler: … It goes to First Mate automatically …; nothing else to do." | "⏳ queued for 07:00 AM · 17h 59m · to First Mate"; the rest on hover |
| 16 | layout check | Queued popover kept its open-time position when the window shrank (off the right edge at 1000x640) | Its left edge clamps to the window in CSS |

Harness (not product): the pretend firstmate now records a "Remember this" line in `rules.json` with `answer` = the line id, as real firstmate does after the bridge's "Standing order:" note (walker M7 saw the rule never reach Standing orders because the pretend agent skipped that step). Verified: the rule shows pinned in Standing orders.

## Reviewer's call (held, not built)

New this round:

| # | From | Finding | Why it is the captain's |
|---|---|---|---|
| R14 | walker M3, M8 | No way to reopen a decided item once the 4 s undo hold has passed; the Shift+A dialog's "undo still works" holds only for those 4 s (verified: U inside the hold restores all, writes nothing) | Reopening after the line went out needs a new answer action the agents act on |
| R15 | walker M5 | The phone has no visible Send button; only the "⏎ send" key hint | The phone is the keyboard-fast speaking tube the captain asked for |
| R16 | walker M6 (returned after r1 #7) | "Queue for after reset · 02:56 PM" still doesn't say whose reset (Primary 5h?) | Returned after a fix: per the skill, the captain decides (name the window = more words in the button) |
| R17 | walker M1, M4, M12 (repeat) | Item amounts ($225, $75) read as real costs, next to a "$60/month budget" standing order; rework pays less than the card says | The cash model is the captain's sim design |
| R18 | auditor (repeat of r1) | Settings "Connect an agent…" and "Command line tool…" open the same dialog; Connect still in the rejected dark style | Part of R9 (setup design pass) |
| R19 | auditor | Decision options "Hold, I want changes" / "Decide later" duplicate the Needs work / Later stamps | Options are agent-written; a CLI lint or firstmate guidance is a product call |
| R20 | auditor | ✕ plus Cancel in most dialogs | Dialog convention across the app |

Returned again (already held in round 1): R1 order replies become research items (now also a "Remember this" rule reply), R5 three scene switches, R6 "Stamp the sheet" vs Approve, R7 key legend, R11 game words (Regulars, galley, pier, crew paused, the cat), R12 phone found only as a horn icon, R13 usage strip "+1".

## Out of scope / not a defect

- The desk browser looked blank in the walker's screenshots: the pane is a native view over the window, outside the renderer the screenshot captures; `--pane` showed the page. Harness limit.
- "Reply came from First Mate" after an Add to… on a Web mate order: the pretend agent's reply.
- `x x x` in one call stowed one paper; plain presses each stow one.
- Search for "beta" also lists loose fuzzy matches below the beta items (fuzzy search by design).
- ⌘, did nothing over CDP (it is the native app menu's accelerator); `?` is not bound.
- Demo content: the PR's promo video, the plan page's own pin-a-note feedback.
- Theme in the menu (auto → light → dark, label shows the state), not in Settings.

## Keep (do not lose)

- "First up" made the answer to "what needs me first" obvious (round 1 fix holds).
- Shift+A dialog: shows each answer, lets you untick one.
- Storage box: X, the box, Bring all back.
- Topic view from a tag: open items + timeline.
- Archive + Agent log answer "what did I decide, what were they told".
- Chandlery is clear once opened; Settings shortcut capture works.
