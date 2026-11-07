# Usability walk: HarborDeck (hd-usability-walk)

The ystack `usability-walk` loop, run three times on this branch. Each round had the same setup:

- A fresh **walker** (Opus 5.5, `claude-opus-5-5`) played the captain on a first visit. It worked real missions on the page only, in an unrelated scratch folder, against its own headless `hdv` instance on synthetic data.
- A fresh **auditor** (Opus 5.5, same isolation) held the page to the captain's bar: the preferences in captain.md plus the no-clutter rules.
- The designer ran `layout-check.js` on every state at 1440x868 and 1000x640.

Findings went into four buckets: **Fix now** (fixed on this branch), **Reviewer's call** (held for the captain, not built), **Out of scope** and **Keep**. The loop stopped after round 3: three rounds were done, and the findings left were minor, the captain's calls, or repeats that returned after a fix (those go to the captain).

The layout check runs scroll-aware: a box scrolled inside an in-window scroll box is not counted as off-window, the same exemption the script's box rule makes. Each `layout-check-*.txt` still prints the raw list under every state as `raw-only` lines. Full-size shots (walker, auditor, layout states) are kept under `~/.local/share/verify-harbordeck/usability-walk/`, and the JPGs here are downscaled copies.

| Round | Walker missions | Fix now | Reviewer's call (new) | Layout check (state checks clean) | Tests after |
|---|---|---|---|---|---|
| [1](r1/sort.md) | 11 | 22 | R1-R13 | 0/62 before, 64/64 after | smoke and unit green |
| [2](r2/sort.md) | 13 (controls round 1 missed) | 16 | R14-R20 | 64/64 before, 68/68 after | smoke 114/114, unit green |
| [3](r3/sort.md) | 14 (core goals again + controls never reached) | 15 | R21-R26 | 68/68 before, 72/72 after | smoke 115/115, unit 88/88 |

Each round folder holds `walker-report.md`, `auditor-report.md`, `sort.md` (every finding and its bucket), `layout-check-before.txt` / `layout-check-after.txt`, and the matching `before/` and `after/` shots.

## Round 1

Fixes ([sort](r1/sort.md)):
- First up, the queue and the cat agree on an overdue item.
- First Mate's order reply shows in its ticket, and the popover sits under its ticket.
- The File stamp's spoken name follows its label.
- The scheduler chip shows the send time, and the queue button shows its time.
- The undo chip moved off the key legend.
- Closed drawers and the tray are hidden.
- Papers fit the desk, and the sheet footer is sticky.
- Helper lines moved to tooltips.
- Contrast fixes, and consistent sample data.

Before → after: [first up](r1/before/01-first-up.jpg) → [after](r1/after/01-first-up.jpg) · [PR desk](r1/before/02-pr-desk.jpg) → [after](r1/after/02-pr-desk.jpg) · [question sheet](r1/before/03-question-sheet.jpg) → [after](r1/after/03-question-sheet.jpg) · [ticket popover](r1/before/04-ticket-popover.jpg) → [after](r1/after/04-ticket-popover.jpg) · [empty reply](r1/before/05-first-mate-reply-empty.jpg) · [queued chip](r1/before/06-queued-chip.jpg) → [queue button](r1/after/06-phone-queue-button.jpg) · [undo chip](r1/before/07-undo-chip.jpg) → [after](r1/after/07-undo-chip.jpg) · [PR desk 1000x640](r1/before/08-pr-desk-1000x640.jpg) → [after](r1/after/08-pr-desk-1000x640.jpg) · [settings](r1/before/09-settings.jpg) → [after](r1/after/09-settings.jpg) · [inspect](r1/before/10-inspect.jpg) → [after](r1/after/10-inspect.jpg)

Layout check: [before](r1/layout-check-before.txt), [after](r1/layout-check-after.txt).

Walker's concepts, in its own words:

> - **Morning manifest:** a start-of-day summary: counts, what's first, work in progress, usage.
> - **Window / list (All, Decisions, Reviews, Research, Notices):** everything my agents are waiting on me for, split by kind.
> - **Decision:** pick one of a few lettered options; usually one is marked "rec." (recommended).
> - **Review:** look at a piece of work and give a verdict (approve, reject, needs work).
> - **Research:** a report to read and then "file" (mark done).
> - **Notice:** a to-do only I can do; file it when done.
> - **Question sheet:** several related questions answered and stamped together; "+1"/"+2" on a card means more questions are bundled in.
> - **Stamps (Approve/File, Reject, Needs work, Ask, Later):** my answers. Needs work and Ask send a message back to the mate. Later parks an item until a time.
> - **Later / Parked:** snoozed items that come back at a set time.
> - **Tickets (rail at the top):** things I asked for (orders, asks, rework) and whether they've been answered.
> - **Ship phone:** where I send new messages to First Mate, Web mate or Growth mate, add to existing things, or queue a message until usage resets or until a set time.
> - **Stamina / usage strip:** how much of each AI subscription window (5-hour, weekly) is left and when it refills.
> - **Queued (☕ time):** messages held until the usage refills.
> - **Galley:** work my crews are doing right now (I could only see it, not act on it).
> - **Pier, tide, boats, cash:** I never figured these out. They seem to be game decoration for "items left to clear" and a reward for clearing them.
> - **The cat:** a hint at which item to do first. It didn't always match what looked most urgent.
> - **Undo:** takes back the last stamp.
> - **Agent log:** the raw record of what was actually sent to the agents.

## Round 2

Fixes ([sort](r2/sort.md)):
- Plain-mode Approve stamps one card.
- The queued chip opens its ticket (with Withdraw there).
- Esc closes the topic window.
- The archive shows option labels and the project.
- Cash shows only in the top bar.
- The orders badge has a tooltip.
- Ships-out text sits inside the sea.
- The cash pill is readable, and tables never break inside a word.
- Paper grips are pinned, and the sheet footer has an edge.
- Usage lines are shorter.
- The ships-out tally appears once.
- Web papers have one way to open the page.
- The queued popover is shorter and clamped to the window.

Before → after: [plain approve](r2/before/01-plain-approve-decided-two.jpg) · [chip](r2/before/02-chip-opened-empty-phone.jpg) → [after](r2/after/02-chip-opens-queued.jpg) · [standing orders](r2/before/03-standing-orders-no-rule.jpg) → [after](r2/after/03-standing-order-pinned.jpg) · [ships out](r2/before/04-ships-out-empty-cut.jpg) → [after](r2/after/04-ships-out-empty.jpg) · [thread](r2/before/05-thread-scrolled.jpg) → [after](r2/after/05-thread-scrolled.jpg) · [sheet footer](r2/before/06-sheet-footer.jpg) → [after](r2/after/06-sheet-footer.jpg) · [archive](r2/before/07-archive-keys.jpg) → [after](r2/after/07-archive-labels.jpg) · [stamina](r2/before/08-stamina.jpg) → [after](r2/after/08-stamina.jpg) · [web paper](r2/before/09-web-paper.jpg) → [after](r2/after/09-web-paper.jpg)

Layout check: [before](r2/layout-check-before.txt), [after](r2/layout-check-after.txt).

Walker's concepts, in its own words:

> - **Harbor / scenes** (Signpost Square, Customs Shed, Bottle Cove, Notice Board): the inbox split by kind: decisions, reviews, research notes and notices. The arrows step through them.
> - **Window**: the list on the left of everything waiting for me, filterable by kind.
> - **Desk**: the middle area where the current item's papers lie: manifest (summary), the ask (what I must do), and extras (photo, PR, monitor, correspondence).
> - **Stamps**: my answers: Approve, Reject, Needs work, Ask, Later, File.
> - **Storage box / stow**: a place to hide papers off the desk without losing them.
> - **Tickets / ticket rail**: things I asked my agents for (orders, asks, reworks) and whether they've replied.
> - **Ship phone**: the line to my lead agents (First Mate, Web mate, Growth mate). I can send now, queue for later, attach to an existing item, or mark a message "Remember this".
> - **Standing orders**: the permanent rules my agents follow. They show up as tags on items (for example "✓ tests-green").
> - **Topics (#tags)**: threads that gather open items and a timeline of notes for one subject.
> - **Archive**: what I've decided or filed.
> - **Agent log**: the raw record of every answer sent to agents.
> - **Cash / chandlery / stamp book**: game rewards for clearing items, spent on cosmetic harbor decorations, plus achievements.
> - **Usage meters (Primary, Backup, Opal)**: how much of each AI subscription's 5-hour and weekly allowance is left, and when it runs out or resets.
> - **Plain mode**: the same inbox as a simple list without the harbor art.
> - **P1–P4**: priority. **"rec."**: the agent's recommended answer.
> - I never figured out: **galley** (I guess the work the crew is cooking), **pier**, **high tide** and "+N boats", "**crew paused**", "**the cat says: this one first**", "**Regulars**" bars, "**Inspect**", "Gaps", and what the Menu badge counts.

## Round 3

Fixes ([sort](r3/sort.md)):
- A pick on a sheet never ticks an unopened row. Before, picking B moved focus onto the review row, and one stamp approved it.
- The ticket popover sits under its ticket again (a round 2 regression).
- A just-sent ticket scrolls into view, and rail pages land on whole tickets.
- Sound toggles say on or off.
- Back of the line holds with All shown.
- Add to… names who hears it, and the added line stays on the ticket.
- The archive has no dangling separator.
- "0 flagged" is gone.
- Dark-theme paper buttons and dialog × are readable, and so are stamp book labels.
- The picked option is clearer.
- Settings helper text moved to tooltips.
- The usage strip refits when its room changes.

Before → after: [sheet](r3/before/01-sheet-unopened-row.jpg) + [archive shows it approved](r3/before/01b-archive-approved-unopened.jpg) → [after](r3/after/01-sheet-pick-stays.jpg) · [ticket popover](r3/before/02-ticket-popover.jpg) → [after](r3/after/02-ticket-popover.jpg) · [new ticket hidden](r3/before/03-rail-new-ticket-hidden.jpg) → [after](r3/after/03-rail-new-ticket-in-view.jpg) · [rail paged](r3/before/04-rail-paged.jpg) → [after](r3/after/04-rail-paged.jpg) · [sound](r3/before/05-sound-state.jpg) → [after](r3/after/05-sound-on.jpg) · [archive](r3/before/06-archive.jpg) → [after](r3/after/06-archive.jpg) · [dark paper buttons](r3/before/07-dark-paper-buttons.jpg) → [after](r3/after/07-dark-paper-buttons.jpg) · [dark ×](r3/before/08-dark-ask-close.jpg) → [after](r3/after/08-dark-ask-close.jpg) · [chandlery](r3/before/09-chandlery.jpg) → [after](r3/after/09-chandlery.jpg) · [Add to…](r3/before/10-phone-addto.jpg) → [after](r3/after/10-phone-addto-web-mate.jpg) · [ticket](r3/before/11-ticket-no-added-line.jpg) → [after](r3/after/11-ticket-added-line.jpg) · [orders](r3/before/12-orders.jpg) → [after](r3/after/12-orders.jpg) · [picked option](r3/before/13-sheet-picked.jpg) → [after](r3/after/13-sheet-picked.jpg) · [settings](r3/before/14-settings.jpg) → [after](r3/after/14-settings.jpg)

Layout check: [before](r3/layout-check-before.txt), [after](r3/layout-check-after.txt).

Walker's concepts, in its own words:

> - **Harbor / scenes (Signpost Square, Customs Shed, Bottle Cove, Notice Board):** the four kinds of waiting items, shown as places: decisions, reviews, research notes and notices. The ‹ › arrows switch between them.
> - **Window (left list):** everything waiting for me, grouped by project, with filters by kind.
> - **Desk:** the one item in front of me, with its manifest (summary), the ask (what I must choose), and evidence panels (photo, PR, monitor, correspondence, research note).
> - **Stamps (Approve, Reject, Needs work, Ask, Later, File):** my answer to the item in front.
> - **Question sheet:** several related questions bundled so I can answer them in one stamp. The "+N" badge on a list item means extra questions are attached.
> - **Ticket rail / Tickets:** things I sent out (asks, orders, rework) and the replies to them.
> - **Ship phone:** where I write new orders to First Mate, the Web mate or the Growth mate, add to an existing order, or queue a message for later.
> - **Parked / Later:** an item put away until a time. "Bring back now" undoes that.
> - **Back of the line:** skip this item for now, with no time set.
> - **Storage box / stow:** probably another way to set items aside. I never figured out how it differs from parking.
> - **Stamina:** usage left on the AI subscriptions (Primary, Backup) per 5-hour and weekly window, with reset times. "Primary Opal" is a sub-meter I did not understand.
> - **Scheduler chip (⏳ queued):** messages waiting to go out after a usage reset.
> - **Morning manifest:** the start-of-day summary.
> - **Galley / Pier:** I think these show what the crews are working on ("cooking") and what is ready. I'm not sure.
> - **Cash ($) / stamp book / chandlery:** a reward score for handling items. I don't know what it is for.
> - **P1–P4, guardrail tags (budget-60, a11y-contrast…):** priority, and the rules an item was checked against.
> - **Archive:** what I already decided, read-only.
> - **Agent log:** the raw record of my answers as the agents receive them.
> - **Plain mode:** the same queue as a plain list, without the harbor art.

## Reviewer's calls (held for the captain)

The `sort.md` of each round has the full reasoning.

- **R1** Replies to orders become research items on the captain's own list. (Repeated in all 3 rounds.)
- **R2** Add to… cannot reach running crew work. The contract keeps fleet as status only.
- **R3** A sent-back item returns as a normal P1 with its old pick. (Repeated.)
- **R4** Bring back writes no line, so firstmate keeps its hold. This needs a bridge change. (Repeated.)
- **R5** There are three scene switches, and the list repeats the scene.
- **R6** "Stamp the sheet" sits next to the Approve stamp.
- **R7** The key legend, and the phone's key row.
- **R8** Reject has no reason box and no confirm, and cash is paid for any verdict.
- **R9 / R18** Connect an agent: the rejected dark style, consent paragraphs, and two Settings buttons that open it.
- **R10** Bundled "+N" reports.
- **R11** Game words are never explained (tide, boats, galley, pier, crew paused, Opal).
- **R12** The phone is found only as a horn icon.
- **R13** The usage strip folds windows into "+N".
- **R14** There is no reopen once the 4 s undo hold has passed. (Repeated.)
- **R15** The phone has no Send button. (Repeated.)
- **R16** "Queue for after reset" does not name its window. This returned after the round-1 fix.
- **R17** Item cash reads as real money. (Repeated.)
- **R19** Agent-written options duplicate the stamps.
- **R20** Dialogs have × next to Cancel.
- **R21** The cat marks the scene's first item, not the day's. This returned after the round-1 fix.
- **R22** Mark-up works only on a desk snapshot, not on the picture itself.
- **R23** Plain mode is left only through the menu (or P).
- **R24** The topic view stays, though the captain said "Topics isn't that useful either".
- **R25** The header $ and the menu Chandlery open the same dialog, and Done sits beside Close on tickets.
- **R26** Drawers cover the header's right end, date and time inputs are native, and the Agent log shows raw JSON.
