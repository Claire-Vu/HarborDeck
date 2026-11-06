# Harbor Deck: a first-time walk as the captain

How I worked: I loaded the page fresh once at the start (`./deck reload`). After that I did the missions one after another in the same session, in the order the work came up on the desk (1, 3, 11, 7, 2, 4, 5, 8, 9, 10, 12, 6, 13, 14). The task says a reload keeps what you already did, so a reload before each mission would have shown the same state. Screenshots are in `shots/`. The `c.txt` file in this folder is a scratch copy of the accessibility snapshot that I saved while working. It is not part of the report.

---

## Mission 1: Find out what needs me first, and deal with it

**Trying to:** see what is most urgent this morning and handle it.

**Did and saw:** The page opened with a "Morning manifest" dialog (`shots/m1-manifest.png`). It had counts (8 decisions, 5 reviews, 3 research, 3 notices), a "First up" list (P1 Sign the app store developer agreement, P1 Merge PR 142, P3 Newsletter #6), "Galley", "Stamina" (usage) and "Regulars". I clicked "Open the office". The desk showed the app-store notice first: "overdue 2h", with the ask "Do it, then file" (`shots/m1-office.png`). The stamps on the right changed to File / Ask / Later. I clicked File. The item left the queue, cash at the top went from $0 to $75, and the next item (PR 142) came up (`shots/m1-after-file.png`).

**Finished:** Yes.

**Findings:**
- The morning manifest made "what first" easy to see. The "First up" list and the overdue red label were clear. I expected this, and got it.
- The manifest lists PR 142 as P1 second, but the scene picture on the left labels PR 142 "the cat says: this one first". So two places suggest two different "first" items. I expected one agreed first item.
- Filing the notice earned "$75" in a cash counter, and later a toast said "New stamp in your book: First stamp". Nothing explains what the money is for or where it comes from. I expected either no game score, or a short line explaining it.
- "Do it, then file" is clear: I sign it somewhere else, then file it here.

## Mission 2: Decide the launch pricing question

**Trying to:** read the agents' findings on pricing and decide.

**Did and saw:** I clicked "Launch pricing: one plan or free + pro?" in the left list. The desk showed a manifest card with a "budget-60" warning ("free tier hosting (+$40/mo) pushes total tooling to about $70/mo") and a research note, `pricing-tiers.md`, with the two shapes and a revenue table (`shots/m2-pricing.png`). The ask was a "Question sheet · 2". Row 1 was the pricing question with A Free + pro (rec.) and B One plan. Row 2 was "Review onboarding copy v2 · Review: not opened", and its checkbox was **unticked**. I picked B One plan and pressed the Approve stamp.

**Finished:** Yes. The archive shows "DECIDED: ONE PLAN ($7)".

**Findings:**
- **Looked broken:** row 2, "Review onboarding copy v2", was unticked and never opened, but it was approved too. The counts dropped by two (Decisions 8→7 and Reviews 5→4). The Archive later listed "APPROVED Review onboarding copy v2 · 01:14 PM", and the Agent log shows `"onboarding-copy","action":"approve"` (`shots/m10-archive.png`, `shots/m10-agentlog.png`). I expected an unticked, unopened row to stay waiting. The words "Space stamps 1 row" on the sheet also suggested only one row would be stamped.
- The "+1" badge on the list item meant "a second question is bundled with this one". I only worked that out when the sheet opened. I expected the badge to say what was attached.
- Two ways to stamp a sheet (the Approve stamp on the right and the "Stamp the sheet" button) made it unclear which one acts on which rows.
- The evidence was easy to read: summary, guardrail warning and the full note were side by side.

## Mission 3: Send PR 142 back: the error text must be red, and show where

**Trying to:** look at the evidence, then send the PR back with "error text must be red", marked on the checkout picture.

**Did and saw:** The PR card showed passing checks (never-merge-without-word, a11y-contrast, tests-green), a "Photo" panel with `checkout-mock.svg`, a PR link, a "Monitor" panel and Correspondence (`shots/m3-evidence.png`). "Zoom" on the photo opened a bigger view with A−/A+/Open but no marking tools (`shots/m3-zoom.png`). I picked "B Hold, I want changes" and pressed the Needs work stamp. A "What needs work?" dialog opened, "to Web mate, about: Merge PR 142". I typed my note and clicked "Snap desk". That opened a marking screen (Pin / Box / Arrow / Undo) over a screenshot of the **whole desk** (`shots/m3-snap.png`). I dropped pin 1 on the card fields of the small checkout picture and typed "Card error text shows here; make it red" (`shots/m3-pin.png`). Then I clicked Done and Send. A "REWORK" ticket appeared on the rail. The Web mate replied: "On it: I will bring a new version to the desk with that change" (`shots/m3-reply.png`).

**Finished:** Yes, with caveats.

**Findings:**
- The checkout picture has no visible error state or error text. I had to guess where the error text would appear and pinned the card fields. I expected the evidence to show the error message, so that I could point at it.
- I could only mark up a snapshot of the whole desk, where the checkout picture is small. I could not mark the checkout picture itself (Zoom has no pin tool). I expected to pin directly on the picture.
- The "Monitor" panel on a checkout PR plays `harbor-promo.mp4`, which seems unrelated to the checkout. I expected a checkout recording, or no monitor.
- When I scrolled over the desk, the Monitor panel scrolled inside itself instead of the desk. The last Correspondence entries were cut off until I scrolled that panel.
- After I sent it back, PR 142 **stayed in the queue** with an "UPDATED / Updated since you last looked: replies" banner. It kept coming back to the front of the desk (after the domain notice, after pricing, and after the beta sheet), with B still selected. The agent said they would bring a new version, so I expected the PR to leave my queue until that new version arrives.

## Mission 4: Read the Postgres report and mark it done

**Did and saw:** I clicked "Hosted Postgres: three options +1". The research note `hosted-postgres.md` showed a comparison table, a recommendation (Provider Quay), what was checked, and open questions (`shots/m4-postgres.png`). The sheet had row 1 ticked ("Research: file on stamp") and row 2 "Privacy-friendly analytics" unticked. I pressed File. Research went 3→2. This time only the ticked row went, and the analytics note stayed.

**Finished:** Yes. The Archive shows "FILED Hosted Postgres".

**Findings:**
- The manifest shows "$19" in the corner, and $19 is also Provider North's price in the table. I briefly read it as the price of the recommended option, but Quay is $25. I expected the corner number not to look like a fact from the report.
- Filing behaved differently from mission 2: here the unticked row was left alone. The two sheets acted inconsistently.

## Mission 5: Send First Mate a new request and read the reply

**Did and saw:** The "Ship phone" button (the speaking-tube icon at top right) opened a dialog with First Mate / Web mate / Growth mate, a text box, Snap desk, "Queue for after reset · 03:22 PM" and "Queue at time" (`shots/m5-phone.png`). First Mate was preselected. I typed the request and pressed Enter, since there is no Send button. A check mark flashed on the phone icon. A reply came within about 10 s: "Got it. Assigned to a crew; I will bring the result here when it is ready." (`shots/m5-reply.png`).

**Finished:** Yes.

**Findings:**
- There is no visible Send button. Only the small hint "⏎ send" told me that Enter sends. I expected a Send button.
- The new ticket did not show on the ticket rail. It was hidden behind "2 more ›", and clicking that paged the rail sideways in a way I could not follow (`shots/m5-tickets.png`, `shots/m5-tickets2.png`). In the end I opened it by name from the accessibility list. I expected a just-sent request to appear at the visible front of the rail.
- My own request also showed up in my **waiting queue** as a "P3 RESEARCH" item ("add a dark mode toggle…", from First Mate, `shots/m8-research-list.png`), which raised the count to 16. I expected my outgoing order not to show up as something waiting on me.

## Mission 6: Answer the three beta-invite questions in one go, picking by hand

**Did and saw:** "Beta invites: how many in the first wave? +2" opened a "Question sheet · 3" with all three rows ticked and the recommended answers (50 people / Hand-pick / Email) preselected (`shots/m6-beta.png`). Hand-pick was already the recommendation. I clicked it anyway to be sure, then clicked "Stamp the sheet". Decisions went 6→3. The Archive shows "DECIDED: 50 PEOPLE", "DECIDED: HAND-PICK", "DECIDED: EMAIL" (`shots/m6-archive.png`).

**Finished:** Yes.

**Findings:**
- I could hardly tell which option was selected and which was only recommended. Both look like boxed rows, and the selected one is only slightly tinted. I expected a clear checked or filled state.
- The sheet is long. Row 3's options were cut off at the bottom and needed scrolling inside the card.
- The side panel "Invite waves: waves.html" showed only a button, "Open in the desk browser". I did not open it.

## Mission 7: Put off the domain renewal until tomorrow morning, then bring it back

**Did and saw:** On the "Renew the domain" notice I pressed the Later stamp. A "Park it for later" dialog offered "Tomorrow morning · Nov 7 09:00 AM", "After the next usage reset", and "On a date" (`shots/m7-later.png`). I chose Tomorrow morning. A "PARKED 1" chip appeared above the storage box (`shots/m7-parked.png`). Clicking the chip listed the item with a "Bring back now" button (`shots/m7-parkedlist.png`). I clicked it, and the notice came straight back to the desk (`shots/m7-back.png`).

**Finished:** Yes.

**Findings:**
- This was easy and clear.
- The "On a date" field was prefilled with 11/08/2026, not tomorrow. That was a little surprising, but harmless.
- The Agent log records the park but has no entry for bringing it back. I am not sure whether the agents were told that it came back.

## Mission 8: Add "also show it on mobile" to the Web mate's banner order

**Did and saw:** In the phone I clicked "Add to…". A list appeared with AT THE DESK, ITEM and ORDER entries, including my "what changed since last visit" order (`shots/m8-addto.png`). A `click --text` on that row timed out, so I clicked it by position. It became an "Add to: …" chip (`shots/m8-picked.png`). I typed "also show it on mobile" and pressed Enter. The reply came from **First Mate**: "Passed to the crew working on it; they will fold it in." (`shots/m8-reply.png`).

**Finished:** Yes.

**Findings:**
- After I picked the order, the text box still said "Speak to First Mate…", and First Mate still looked selected (dimmed), even though the order belongs to the Web mate. I could not tell who would receive it. I expected the box to say it was going to the Web mate.
- The order's reply thread showed the original order and First Mate's answer, but **not my added line**. I could not see what I had sent. I expected my "also show it on mobile" to be in the thread.
- As in mission 5, the original order also sat in my waiting list as a "RESEARCH" item from the Web mate.

## Mission 9: Find Primary usage left and refill time, queue a job for after the refill, then cancel it

**Did and saw:** The usage strip in the top bar is dense ("Primary 5h 38% ↻ 2h 9m ⚠ out ~02:56 PM …"). Clicking it opened a "Stamina" panel: **Primary · 5h: 38% left, resets in 2h 6m (03:22 PM), runs out ~02:56 PM at this pace**, plus Primary week 59%, "Primary Opal · week" 80%, Backup 5h 82% and Backup week 12% (`shots/m9-usage.png`). In the phone I picked Web mate. Clicking by text timed out, so I clicked by position. I typed "run the full end-to-end suite" and clicked "Queue for after reset · 03:22 PM". A new chip "⏳ 1 queued · 03:22 PM · ☕" appeared in the top bar (`shots/m9-queued.png`). Clicking it showed the message "waiting for reset · 2h 5m · to Web mate" with "Withdraw" (`shots/m9-scheduler.png`). I clicked Withdraw, and the chip disappeared (`shots/m9-withdrawn.png`).

**Finished:** Yes.

**Findings:**
- I learned that "Stamina" means usage only after opening the panel. The top-bar strip alone is hard to read.
- "Primary Opal" is never explained. I did not work out what it is (a model? a sub-plan?).
- The usage panel says Primary runs out at ~02:56 PM, before the 03:22 PM refill. Nothing near the queue button warned me about that. Queuing after the refill was still the right move.
- The "queued" chip only appears once something is queued. That was handy, but I would not have known where to look before queuing.

## Mission 10: Reject the logo by accident, then take it back

**Did and saw:** I opened "Pick a logo direction" and pressed Reject. It happened at once, with no confirmation, and cash went up by $80 (`shots/m10-rejected.png`). An "Undo U" pill appeared at the bottom right. I clicked it about a second later. The pill vanished, but the logo did not come back (`shots/m10-undone.png`). Pressing U did nothing either (`shots/m10-u.png`). I then tried the Menu → Archive, which listed "REJECTED Pick a logo direction" (`shots/m10-archive.png`). Opening that entry showed the item and the line "Pick a logo direction → rejected", with no reopen button (`shots/m10-archive-item.png`). Right-click did nothing. ⌘K search found it as "FILED · resolved", and opening it showed the same read-only view (`shots/m10-search.png`, `shots/m10-filed-open.png`). The Agent log shows the reject was recorded and sent (`shots/m10-agentlog.png`).

**Finished:** No. The logo decision stays rejected, and I found no way to put it back in the waiting list.

**Findings:**
- **Could not undo:** the Undo pill is gone within a second or two. Clicking it right after it appeared did not restore the item. After it disappears, nothing (Archive, search, U key) offers to reopen. Later, the Undo pill after the beta-sheet stamp had also disappeared by the time I came back from the Archive. I expected Undo to stay available for a while, and an "un-reject / reopen" button on archived items.
- Reject has no confirmation, and both the Reject stamp and the "2" key fire it immediately. That makes an accidental reject easy.
- The Agent log is raw JSON with file paths (`/tmp/hdv-…/answers.jsonl`). As the captain I could not read it comfortably.

## Mission 11: Ask the Growth mate whether the newsletter mentions the new checkout

**Did and saw:** The newsletter draft came up on the desk. Its body already says "COMING UP: A calmer checkout". I pressed the Ask stamp. A dialog "Ask a follow-up · to Growth mate, about: Newsletter #6 draft" opened (`shots/m11-ask.png`). I sent the question. A ticket appeared, and about 10 s later the reply came: "Checked it. Short answer: yes, and I have added a line about it to the summary." (`shots/m11-reply.png`).

**Finished:** Yes.

**Findings:**
- The Ask stamp automatically addressed the right mate. That was clear.
- The answer says "added a line", so the agent changed the draft when I only asked a question. The list then marked the newsletter "UPDATED". I expected an answer only, not an edit.
- To read the reply I had to find the ticket on the rail. There was no notice that the answer had arrived, apart from "● new reply" on the ticket.

## Mission 12: Skip the current item for now without a time and take the next

**Did and saw:** With PR 142 in front, I clicked "Back of the line" at the top of the manifest card. The next item (Quarantine the flaky test) came up (`shots/m12-backofline.png`).

**Finished:** Yes.

**Findings:**
- "Back of the line" was easy to find and did what it says.
- Two actions later (after stamping the beta sheet), PR 142 was back in front of the desk. "Back of the line" did not seem to keep it back for long. I expected it to stay behind the other items.
- The other "skip" ideas, "X stow" and the storage box, are only explained in the tiny shortcut legend. I did not work out how the storage box differs from Back of the line.

## Mission 13: Switch to a plain list, approve one review there, come back

**Did and saw:** Menu → "Plain mode" turned the harbor into a simple list grouped into "Needs your word", "Review the work" and "Research to read and file" (`shots/m13-plain.png`). Clicking "Review the offline-mode plan" expanded it, with Approve / Reject / Needs work / Ask / Later buttons (`shots/m13-open.png`). I clicked Approve, and Reviews went 4→3 (`shots/m13-approved.png`). In the Menu, the same item now read "Back to the desk", and that brought me back to the harbor (`shots/m13-back.png`).

**Finished:** Yes.

**Findings:**
- The plain list was the clearest view of the whole morning. Its buttons have real names instead of rubber stamps.
- In plain mode the only way back is through the Menu. There is no "back to harbor" control on the page itself. I expected a visible toggle.
- The review preview tile was a grey box with an arrow and the address "127.0.0.1:58724/plan.html". It showed no picture of the plan.

## Mission 14: Turn the desk sounds off

**Did and saw:** Menu → Sound has "Desk sounds", "Harbor music" and a Volume slider (`shots/m14-menu-before.png`). I clicked "Desk sounds". The menu stayed open, and the row became filled orange (`shots/m14-state.png`). It was still orange after I closed and reopened the menu (`shots/m14-reopen.png`). The speaker icon looked the same before and after. The screen reader just says menuitem "Desk sounds", with no on/off state. Settings has no sound options (`shots/m14-settings.png`).

**Finished:** Unsure. I clicked the toggle once, but I cannot tell whether sounds are now on or off. The orange fill could mean "on", "off", or just "last focused".

**Findings:**
- The sound toggles have no visible or announced on/off state. I expected a check mark, an "On/Off" label, or a crossed-out speaker.
- The Volume slider is labelled "Music volume" to a screen reader, so it may not affect desk sounds at all.

---

## Things noticed across missions

- The ticket rail ("Tickets") shows only about three tickets. The "N more ›" / "‹ N" paging was hard to follow, and I lost track of new tickets more than once. I expected a full list or a scrolling rail.
- The shortcut legend at the bottom right is tiny and dense. Many features (stow, take recs, book, inspect, orders) were only mentioned there.
- Two `click --text` commands timed out ("Add a \"what changed…\"" in the phone list, and "Web mate" in the phone). Clicking by position worked. Visible text that I could see on screen could not be targeted by its words.
- The game layer (cash, "boats", "high tide", "crew paused", galley, pier, stamp book) sits on top of the work. I never worked out what "+6 boats", "high tide 2h 9m" or "2 crew paused" meant, beyond guessing that high tide = usage reset.

## What I believe each concept means

- **Harbor / scenes (Signpost Square, Customs Shed, Bottle Cove, Notice Board):** the four kinds of waiting items, shown as places: decisions, reviews, research notes and notices. The ‹ › arrows switch between them.
- **Window (left list):** everything waiting for me, grouped by project, with filters by kind.
- **Desk:** the one item in front of me, with its manifest (summary), the ask (what I must choose), and evidence panels (photo, PR, monitor, correspondence, research note).
- **Stamps (Approve, Reject, Needs work, Ask, Later, File):** my answer to the item in front.
- **Question sheet:** several related questions bundled so I can answer them in one stamp. The "+N" badge on a list item means extra questions are attached.
- **Ticket rail / Tickets:** things I sent out (asks, orders, rework) and the replies to them.
- **Ship phone:** where I write new orders to First Mate, the Web mate or the Growth mate, add to an existing order, or queue a message for later.
- **Parked / Later:** an item put away until a time. "Bring back now" undoes that.
- **Back of the line:** skip this item for now, with no time set.
- **Storage box / stow:** probably another way to set items aside. I never figured out how it differs from parking.
- **Stamina:** usage left on the AI subscriptions (Primary, Backup) per 5-hour and weekly window, with reset times. "Primary Opal" is a sub-meter I did not understand.
- **Scheduler chip (⏳ queued):** messages waiting to go out after a usage reset.
- **Morning manifest:** the start-of-day summary.
- **Galley / Pier:** I think these show what the crews are working on ("cooking") and what is ready. I'm not sure.
- **Cash ($) / stamp book / chandlery:** a reward score for handling items. I don't know what it is for.
- **P1–P4, guardrail tags (budget-60, a11y-contrast…):** priority, and the rules an item was checked against.
- **Archive:** what I already decided, read-only.
- **Agent log:** the raw record of my answers as the agents receive them.
- **Plain mode:** the same queue as a plain list, without the harbor art.
