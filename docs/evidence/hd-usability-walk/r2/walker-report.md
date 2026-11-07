# Harbor Deck: first-time walk

I walked through all 13 missions, each starting from `./deck reload`. A reload kept everything I had done before, so each mission started from the state the earlier ones left behind. Screenshots are in `shots/`.

---

## Mission 1: What needs me first

**Trying to:** open the desk and deal with whatever is most urgent.

**Did and saw:** On first load a "Morning manifest" opened (`shots/m1-manifest.png`). It had counts "at the window" (8 decisions, 5 reviews, 3 research, 3 notices), a **First up** list (1. P1 Sign the app store developer agreement, 2. P1 Merge PR 142, 3. P3 Newsletter #6 draft), a "Galley" list of crew work, "Stamina" meters and "Regulars" bars. I clicked **Open the office**. The app store agreement was already on the desk with "The ask: Do it, then file" (`shots/m1-office.png`). I stamped **File**. "+$75" floated up, the cash went from $0 to $75, a toast said "New stamp in your book: First stamp", and the PR moved onto the desk (`shots/m1-filed.png`, `shots/m2-pr.png`).

**Finished:** yes.

**Findings:**
- The "First up" list made the answer obvious. It was easy.
- The header shows "Backup week 12%" first, but the manifest also lists "Backup · 5h 82% left". The header hides the 5h Backup meter and shows "+1" for something I couldn't see. *Expected:* the header to show the same meters as the manifest, or say what "+1" stands for.
- Filing a real-world task ("only the account holder can accept it") just marks it done. Nothing asks whether I actually signed it. *Expected:* nothing else; this is fine, I just noticed it.
- For a moment the old paper and the new paper overlapped on the desk (text from the next item showed through the old card, `shots/m1-filed.png`). It settled after about a second. *Expected:* a clean switch.
- The "$75" on the card meant nothing to me until the cash went up. *Expected:* a hint about what the dollar amounts on items are.
- I didn't understand "Regulars" (The checkout, Launch prep, Brand studio, Engine room, each with a coloured bar). *Expected:* a label saying what the bars measure.

---

## Mission 2: Clear the PR clutter, then bring it back

**Trying to:** leave only the decision on the desk for PR 142, hide the rest without losing it, then restore it.

**Did and saw:** The PR came with five papers: Decision manifest, The ask, Photo, Pull request, Monitor and Correspondence. The papers other than the manifest and the ask had a "Stow this paper" control (a small dash) and the hint "X stow". Pressing X stowed one paper at a time into a box at the bottom right (`shots/m2-x.png`). Four presses left only the manifest and "Your call" (`shots/m2-cleared.png`). Clicking the box opened "Storage box · 4 papers" with **Bring all back** (`shots/m2-box.png`), and that restored all four (`shots/m2-back.png`).

**Finished:** yes.

**Findings:**
- When I sent three X presses in one go (`x x x`), only one paper was stowed. Pressing X again after a short pause worked. *Expected:* each press to stow a paper.
- The stow control is a faint dash in each paper's corner. I only found it through the "X stow" hint in the shortcut text at the bottom right. *Expected:* a clearer hide/stow button on each paper.
- The storage box at the bottom right is easy to miss until a badge number appears on it. *Expected:* a labelled box, or a count visible from the start.
- The PR's **Monitor** paper plays "harbor-promo.mp4", a promo video, on a checkout pull request. I couldn't tell why it belongs to this PR. *Expected:* a checkout preview or nothing.

---

## Mission 3: Take recommendations on low-stakes decisions, except the repo rename

**Trying to:** clear the low-stakes decisions in one go while keeping the repo-rename question open.

**Did and saw:** The hint "⇧A take recs" led me to Shift+A, which opened "Take all recommended: Only P3-P4 decisions with a recommendation. Untick anything you want to read first. One stamp, undo still works." It listed five items with the recommended answer for each (`shots/m3-takerecs.png`). I unticked the repo rename (`shots/m3-unticked.png`) and clicked **Stamp 4 recommended**. Decisions went from 8 to 4, cash went to $275, and an Undo toast appeared (`shots/m3-stamped.png`). The repo rename stayed open.

Because mission 8 needs the beta-invite questions still open, I then tried to undo. I clicked the **Undo** toast and the toast disappeared, but nothing came back (`shots/m3-undo.png`). Pressing U did nothing either (`shots/m3-undo2.png`). The Archive listed all four as decided and had no reopen option (`shots/archive.png`, `shots/archive-item.png`).

**Finished:** yes, as asked.

**Findings:**
- The dialog was very clear: it showed each answer and let me untick items. I only found it through the shortcut text, though; I saw no visible button for it on the desk. *Expected:* a "Take recommendations" button near the decisions.
- **Undo didn't undo the batch stamp.** The dialog promises "undo still works", but neither the toast nor U brought the four decisions back. The Agent log later shows no undo entry. *Expected:* the four decisions to come back as waiting.
- Nothing I could find reopens a decided item. Neither the Archive nor the item view has a "reopen" or "change answer" option. *Expected:* some way to reverse a decision before it reaches the agent, or after.
- After the batch, the "the cat says: this one first" tag moved from PR 142 to Launch pricing in the scene list. I never worked out what the cat's pick is based on. *Expected:* a short reason next to the cat's pick.
- The batch included the "email or app" invite question, but nothing tells you it is part of a three-question sheet. On the window list the sheet looks like one item ("Beta invites… +2"). *Expected:* the batch dialog to group the three questions under one sheet.

---

## Mission 4: Read the offline-mode plan in the app, send it back

**Trying to:** read the plan page without leaving the app, then ask for "a section on sync conflicts".

**Did and saw:** I clicked "Review the offline-mode plan" in the left list. The desk showed a "Plan page" paper with **View** and **Open in the desk browser**. The second one opened a "PLAN PAGE" overlay with ←, ↻, "Browser ↗", Full and ×. In the window screenshot the page area was **blank white** (`shots/m4-browser.png`), but the in-app pane showed the plan: three steps, "Click a step to pin a note to it", "0 notes pinned" (`shots/m4-pane.png`). I closed the browser, stamped **Needs work**, and a "What needs work? to Web mate" box opened. I typed the text and clicked Send (`shots/m4-typed.png`). The item left the list and cash went up by $9. About 10 seconds later the ticket rail showed "REWORK Review the offline-mode plan · a section on sync conflicts · new reply · UPDATED" (`shots/m4-after.png`).

**Finished:** yes.

**Findings:**
- In the full-window view the in-app browser area was empty white. Only the pane view showed the page. *Expected:* to see the page inside the overlay.
- The card said $38, but sending it back as Needs work paid $9. Nothing explained the difference. *Expected:* the card amount, or a note that rework pays less.
- The plan page offers its own way to give feedback ("pin a note to a step"), alongside the desk's Needs work stamp. I didn't know which one the agent reads. I used the stamp. *Expected:* one clear place for feedback, or a note on which one the agent reads.
- The "UPDATED" item came back on the list right away, so I couldn't tell whether the agent had added the section or only replied. *Expected:* to see whether the plan itself changed.

---

## Mission 5: Add "also show it on mobile" to the banner order

**Trying to:** add to the existing Web mate order rather than start a new one.

**Did and saw:** I clicked the "ORDER Order to Web mate … awaiting reply 5h" ticket. A popover showed the order and "Still with Web mate. Waiting 5h", with only **Done** and **Close** (`shots/m5-ticket.png`). That gave me no way to add to it. I tried the **Ship phone** button (top right, a horn icon with no label), which has three mates to dial and an **Add to…** chip (`shots/m5-phone.png`). I dialed Web mate, clicked Add to…, and picked "order Add a 'what changed since last visit' banner to boards" (`shots/m5-addto.png`). Then I typed the message (`shots/m5-typed.png`) and pressed Enter. The ticket changed to "✓ replied". When opened, it said "**First Mate** · Passed to the crew working on it; they will fold it in." **Open item** showed my "comment: also show it on mobile" in the Correspondence (`shots/m5-openitem.png`).

**Finished:** yes.

**Findings:**
- The order ticket itself has no "add" or "reply" option. I had to guess that the unlabeled horn icon was the way to talk to agents. *Expected:* an "Add to this order" option on the ticket.
- The phone has no visible Send button. Only the key hint "⏎ send" at the bottom says how to send. *Expected:* a Send button.
- I sent to Web mate, but the reply came from **First Mate**. *Expected:* the Web mate to answer, or a note that First Mate relays.
- The ticket popover didn't show my addition. Only "Open item" did. *Expected:* the popover to show the whole thread, including my comment.
- After this, the order turned into a **Research** item ("Research manifest", $19, "Read, then file") in Bottle Cove, and the research count went from 3 to 4 (`shots/m6-time.png`). An order I gave was now listed as research waiting on me. *Expected:* the order to stay on the ticket rail, not join my inbox as research.
- The phone remembers the last mate dialed (Web mate) the next time it opens. I nearly sent the next message to the wrong mate. *Expected:* it to open on First Mate, or to show clearly who is dialed.

---

## Mission 6: Schedule "rerun the nightly build" for 7:00 tomorrow, then cancel

**Trying to:** queue a message for later, then withdraw it before it goes.

**Did and saw:** In the Ship phone I dialed First Mate, typed the message, typed 07:00 AM into the time field and clicked **Queue at time** (`shots/m6-time.png`). A toast said "Queued for 07:00 AM. The Mac is kept awake from 06:00 AM…". A chip "⏳ 1 queued · 07:00 AM" appeared in the header, and a ticket "queued for 07:00 AM · 18h 9m" went to an overflow "1 more ›" on the rail (`shots/m6-queued.png`). Clicking the header chip only opened a blank Ship phone with no list of queued items (`shots/m6-scheduler.png`). Through "1 more ›" I opened the queued ticket: "Held in the scheduler… nothing else to do", with **Withdraw**. Withdraw removed the chip and the ticket (`shots/m6-withdrawn.png`).

**Finished:** yes.

**Findings:**
- The time field takes only a time, not a date. It worked out that 07:00 meant tomorrow (18h 9m away), but I couldn't pick a date myself. *Expected:* a date as well, or wording such as "next 07:00".
- The header "queued" chip is labelled "Scheduler: queued work…", but clicking it opened an empty phone instead of the queued list. *Expected:* to see and cancel queued items there.
- The queued ticket was hidden behind "1 more ›" on the rail, so I had to hunt for it. *Expected:* a queued order to show on the rail, or in the scheduler chip.
- "Queue for after reset · 02:56 PM" sits next to the time field. I took "reset" to mean the Primary 5h usage window, but that is a guess. *Expected:* the button to say which reset it means.

---

## Mission 7: Give First Mate a standing rule, then find the rules

**Trying to:** make "routine tasks must never use maximum effort" a remembered rule, and find where rules live.

**Did and saw:** In the Ship phone I dialed First Mate, typed the rule, ticked **Remember this** and pressed Enter (`shots/m7-remember.png`). The ticket showed a 📌 pin. First Mate replied: "Got it. Assigned to a crew; I will bring the result here when it is ready." (`shots/m7-ticket.png`). I found **Standing orders** in the Menu (also on R). It lists 9 rules (never merge without my word, tests green, WCAG AA, … "Default to medium effort…"), but **my rule was not among them**, even after waiting (`shots/m7-orders.png`). Instead my rule turned up as a **Research** item from "Cartwright Ysolde" in Bottle Cove with "Read, then file" (`shots/m7-item.png`). Later the Agent log showed my message was recorded with `"rule":true`.

**Finished:** partly. I found where standing rules are kept, but my rule never appeared there.

**Findings:**
- "Remember this" didn't add the rule to Standing orders. *Expected:* it to appear as a new standing order, or as one proposed for my approval.
- First Mate's reply treated the rule as a one-off task ("assigned to a crew"). *Expected:* "Noted as a standing order".
- The rule came back to me as a research item to read and file, which made no sense to me. *Expected:* no new inbox item for a rule I gave.
- The Menu shows a number next to Standing orders ("2", later "1") that didn't match anything I could see in the panel. The panel header said "0 flagged on this item". I never worked out what the count means. *Expected:* the number to match something visible in the panel.
- The list mixes "standing order N", "design notes", "brand notes", "style guide" and "finance notes". I wasn't sure whether those are all rules of the same weight. *Expected:* a note on whether these sources count the same.

---

## Mission 8: Answer two beta-invite questions, leave email-or-app waiting

**Trying to:** answer the first-wave and how-to-pick questions and keep the email one open.

**Did and saw:** All three beta-invite questions had already been decided by the mission 3 batch (that mission asked for every low-stakes decision except the repo rename), and Undo hadn't reversed it. Search for "beta" showed all three as "Filed … resolved" (`shots/m8-search.png`). The #beta-invites topic said "Nothing open. All settled." (`shots/m8-topic.png`). I found no way to reopen the email question.

**Finished:** no. Mission 3 had already settled all three questions, and I found no way to reopen one.

**Findings:**
- The same failures as in mission 3: Undo didn't work, and decided items can't be reopened. *Expected:* a way to put a decided question back to waiting.
- In the Archive, the beta decisions are labelled "Decision · **launch**", but Search labels them "board-app" with the topic #beta-invites. *Expected:* one consistent project label.
- Searching "beta" also returned unrelated items (Postgres, app store, domain, logo, PR). The results look loosely matched. *Expected:* only beta-related results.

---

## Mission 9: Everything about the launch

**Trying to:** see what is open and what has happened about the launch.

**Did and saw:** I clicked a **#launch** tag on Launch pricing. A "Topic · launch" window opened with "2 open · 2 items · 2 notes", **Still open** (Review onboarding copy v2; Launch pricing), and a **Timeline** (decision raised, review raised, a note about the annual-plan survey, a note "Launch date pencilled in for the 20th, once pricing is settled") (`shots/m9-launch.png`). ⌘K search for "launch" gave the same pieces (`shots/m9-search.png`).

**Finished:** yes.

**Findings:**
- The topic view was clear and quick to reach from a tag. *Expected:* nothing else.
- The beta-invite decisions are labelled "launch" in the Archive, but they don't appear in the #launch topic. I wasn't sure the topic shows everything about the launch. *Expected:* the launch topic to include them, or one name for both.
- Escape didn't close the topic window. It stayed open behind my next action and I had to click ×. *Expected:* Escape to close it.

---

## Mission 10: Plain list, approve one review, back to the harbor

**Trying to:** switch to a plain list, approve a review, and switch back.

**Did and saw:** Menu → **Plain mode P** gave a simple list grouped as "Needs your word (4)", "Review the work (5)", "Research to read and file (5)" and "Notices: only you (2)", with "16 open · $284 · 10 actions" (`shots/m10-plain.png`). Clicking "Review onboarding copy v2" expanded it with Approve / Reject / Needs work / Ask / Later and an extra **Approve bundle (2)** (`shots/m10-open.png`). I clicked **Approve**. The count dropped from 16 to **14**: the review was approved, and "Launch pricing: one plan or free + pro?" also moved to Resolved as "**decided: free-pro**" (`shots/m10-after-approve.png`). The Agent log confirms both at the same second. The cash on the plain page stayed $284. Menu → **Back to the desk P** returned to the harbor, where the cash jumped to $442 (`shots/m10-back.png`).

**Finished:** yes, the switch and the approval worked, but a second item (a P2 pricing decision) was decided along with it.

**Findings:**
- **Approving one review also decided Launch pricing**, a P2 decision I hadn't opened. It was decided as "free-pro", and as far as I could tell the recommendation was A. I clicked the button labelled "Approve", not "Approve bundle (2)". *Expected:* only the review to be approved.
- I never figured out what "Approve bundle (2)" bundles. *Expected:* the button to name the items it would approve.
- The plain list shows no stamp buttons until you click a row. That was fine once I tried it. *Expected:* nothing else.
- The cash didn't update in plain mode. It only caught up after I went back to the harbor. *Expected:* the plain list to show the new total right away.
- The way back is "Back to the desk" in the menu, while the way in was called "Plain mode". Both are on P. *Expected:* one name for the toggle.

---

## Mission 11: What I decided today and what agents were told

**Trying to:** list my decisions and see the exact words sent to agents.

**Did and saw:** Menu → **Archive** lists decided/filed items with the choice ("DECIDED: FIFTY", "DECIDED: EMAIL", "FILED", "RESOLVED") and times (`shots/archive.png`). Menu → **Agent log** shows a file path and raw JSON lines, one per action: id, action, key, note, "to" and a timestamp (`shots/m11-log.png`). These include the batch decisions, the needs-work note, "also show it on mobile", the rule with `"rule":true`, and the approve plus the free-pro pricing decision. It also has a "Gaps (1)" section about a progress feed squeezed into a review.

**Finished:** yes.

**Findings:**
- The Agent log is raw JSON with Unix timestamps and internal ids ("mate-web", "req-1793…"). It shows exactly what was sent, but it is hard to read. *Expected:* plain sentences, for example "12:47 PM told Tinker Fen: 50 people".
- The Archive shows the decision key ("fifty", "hand", "free-pro") rather than the full answer text I picked. *Expected:* the answer as it was worded when I chose it.
- The withdrawn "rerun the nightly build" doesn't appear in the log. That is correct, since it never went out. *Expected:* nothing else.
- "Gaps" in the Agent log meant nothing to me. *Expected:* a sentence saying what a gap is.

---

## Mission 12: What the money is for, and spend some

**Trying to:** understand the cash and buy something.

**Did and saw:** I clicked the cash in the header ("Cash: chandlery and stamp book"). The **Chandlery** opened: Till $442, a **Stamp book** of 12 achievements (1 earned), and a shop marked "**cosmetic only**" (dock lamp $40, cat's bell, pennants, stamp inks, a tune, a lighthouse), plus "Harbor town: next building after 1 more day at the desk" (`shots/m12-cash.png`). I bought the Dock lamp. The till went to $402, the lamp showed "owned", and I earned the "First purchase" stamp (`shots/m12-bought.png`).

**Finished:** yes.

**Findings:**
- It's clear once opened that the money comes from clearing items and is only for decoration. *Expected:* nothing else.
- Until then, the dollar amounts on every item ($225 on the PR, $75 on a notice) looked like real costs or budget. That is especially confusing next to a standing order about a "$60 a month" tooling budget. *Expected:* the item amounts to be visibly marked as reward points, not dollars.
- After buying the lamp I didn't spot it in the scene. *Expected:* to see the lamp on the pier.

---

## Mission 13: Dark desk and a new phone shortcut

**Trying to:** switch to dark mode and rebind the shortcut that opens the line to agents.

**Did and saw:** Settings (Menu → Settings ⌘,) has a **Phone** section with "Shortcut ⇧ ⌘ Space" (`shots/m13-settings.png`). I clicked it, pressed Ctrl+Shift+P, and it showed ⌃ ⇧ P (`shots/m13-shortcut.png`). After Save, Ctrl+Shift+P opened the Ship phone. Theme isn't in Settings. It is in the Menu as "Theme: auto", and each click cycles auto → light → dark. Dark mode darkened the frame and sidebar, but the desk papers stay cream (`shots/m13-dark.png`).

**Finished:** yes.

**Findings:**
- I looked for the theme in Settings first. It's only in the Menu. *Expected:* theme in Settings too.
- The theme item cycles through three states with no list of choices. I had to click twice to reach dark. *Expected:* a choice of auto, light or dark.
- In my test, the old shortcut ⇧⌘Space didn't open the phone, either before or after the change, so I can't confirm it ever worked. The new Ctrl+Shift+P did open it. *Expected:* the listed shortcut to open the phone.
- Calling it the "Phone" in Settings and "Ship phone" on the button tied it together for me. Nothing calls it "the line to your agents", but the horn icon fits. *Expected:* nothing else.

---

## What I think each concept means

- **Harbor / scenes** (Signpost Square, Customs Shed, Bottle Cove, Notice Board): the inbox split by kind: decisions, reviews, research notes and notices. The arrows step through them.
- **Window**: the list on the left of everything waiting for me, filterable by kind.
- **Desk**: the middle area where the current item's papers lie: manifest (summary), the ask (what I must do), and extras (photo, PR, monitor, correspondence).
- **Stamps**: my answers: Approve, Reject, Needs work, Ask, Later, File.
- **Storage box / stow**: a place to hide papers off the desk without losing them.
- **Tickets / ticket rail**: things I asked my agents for (orders, asks, reworks) and whether they've replied.
- **Ship phone**: the line to my lead agents (First Mate, Web mate, Growth mate). I can send now, queue for later, attach to an existing item, or mark a message "Remember this".
- **Standing orders**: the permanent rules my agents follow. They show up as tags on items (for example "✓ tests-green").
- **Topics (#tags)**: threads that gather open items and a timeline of notes for one subject.
- **Archive**: what I've decided or filed.
- **Agent log**: the raw record of every answer sent to agents.
- **Cash / chandlery / stamp book**: game rewards for clearing items, spent on cosmetic harbor decorations, plus achievements.
- **Usage meters (Primary, Backup, Opal)**: how much of each AI subscription's 5-hour and weekly allowance is left, and when it runs out or resets.
- **Plain mode**: the same inbox as a simple list without the harbor art.
- **P1–P4**: priority. **"rec."**: the agent's recommended answer.
- I never figured out: **galley** (I guess the work the crew is cooking), **pier**, **high tide** and "+N boats", "**crew paused**", "**the cat says: this one first**", "**Regulars**" bars, "**Inspect**", "Gaps", and what the Menu badge counts.
