# Harbor Deck: a first-time walk

I'm the captain and this was my first time opening the desk, with no guide. I did every mission from a fresh `./deck reload`. Screenshots are in `shots/`.

A note on the tool: several times, `./deck click --text "<visible list title>"` failed with "locator.click: Timeout 8000ms exceeded". That happened for "Sign the app store developer agreement", "Merge PR 142 (calmer", "Renew the domain before" and "Pick a logo direction", and for "Add to..." (typed with three dots, while the screen shows the single "…" character). Clicking the same spot by its position always worked.

---

## 1. Find out what needs me first and deal with the most urgent thing

**Trying to:** see what needs me and handle the top item.

**Did and saw:** On load, a "Morning manifest" covered the app (`shots/start.png`). Its "FIRST UP" list read: 1. P1 Merge PR 142, 2. P1 Sign the app store developer agreement, 3. P3 Newsletter #6 draft. I clicked "Open the office". The desk opened on PR 142, and the left-hand scene said "the cat says: this one first" for it (`shots/m1-office.png`). I decided the app store agreement was more urgent: it was marked "overdue 2h" and said "The beta build is blocked until then." I clicked the Notices filter, opened the agreement, and stamped FILE (`shots/m1-filed.png`). It left the list, the count dropped from 19 to 18, and a cash counter went from $0 to $75.

**Finished:** yes.

**Findings:**
- The app gave two different answers to "what's most urgent". The manifest and the cat both pointed at PR 142, which is due in 19h. The item that was already overdue and blocking the beta was listed second. *Expected:* overdue items that block other work to come first.
- After a reload, "the cat says: this one first" was on a P4 item, "Forward September receipts to the bookkeeper", while a P2 domain renewal sat in the same scene. I couldn't tell what the cat bases its choice on. *Expected:* the "first" hint to agree with priority and due dates, or to say why.
- On a notice, the stamp's label says FILE, but the screen reader calls it "Approve". Clicking the button named "File" failed, and "Approve" worked. *Expected:* the spoken name to match the label.
- Stamping gave me money ($75) with no explanation of what the money is or what it's for. *Expected:* a word on what "cash" means, or nothing.

## 2. Decide the launch pricing question

**Trying to:** read the research and decide.

**Did and saw:** I filtered to Decisions and opened "Launch pricing". The desk showed a manifest card, a research note (`pricing-tiers.md`, with a table: one plan $1,100/month-3, free + pro $1,600), and a "Question sheet · 2" (`shots/m2-pricing.png`). The sheet also held a second, unticked row, "Review onboarding copy v2", because the card had a "+1" bundled on it. I picked "Free + pro ($9)" and clicked "Stamp the sheet". The item went away and the count dropped to 17 (`shots/m2-stamped.png`). Later, the Agent log showed `"action":"decide","key":"free-pro"`, so the choice was recorded.

**Finished:** yes.

**Findings:**
- The option letters are swapped between the research and the answer sheet. The research calls Option A "One plan" and Option B "Free + pro". The sheet has A = Free + pro (rec.) and B = One plan. Before that, the left-hand list said "recommended A". It took me a while to be sure what I was picking. *Expected:* the same letters in both places.
- The costs don't agree. A "budget-60" warning says "free tier hosting pushes tooling spend to about $70/mo", while the manifest and the research say the free tier adds about $40 a month. I couldn't tell whether $70 is the new total or something else. *Expected:* one number, or a clear "total vs. extra".
- I didn't understand the "+1" on a card (a second, unrelated question bundled in) until I saw the sheet. *Expected:* a label such as "+1 more question in this sheet".
- After stamping, the desk jumped straight to the next item without confirming what I'd chosen. Only the Undo button hinted that anything happened. *Expected:* a brief "Decided: Free + pro".

## 3. Look at the PR 142 evidence and send it back: the error text must be red

**Trying to:** check the evidence, then request one change.

**Did and saw:** The PR 142 desk showed a "PHOTO" (`checkout-mock.svg`), a "PULL REQUEST" card with a GitHub link, a "MONITOR" with a video, and further down a "CORRESPONDENCE" log (`shots/m3-evidence-more.png`). "Zoom" opened the mock larger (`shots/m3-zoom.png`). I clicked "Open" on the PR card: nothing visible happened, and no page opened inside the app (`shots/m3-pr-open.png`). I stamped NEEDS WORK. A "What needs work?" box opened, addressed "to Web mate" (`shots/m3-needswork.png`). I typed "The card error text must be red before this merges." and clicked Send. A REWORK ticket showed up in the ticket rail, and within seconds the Web mate replied: "On it: I will bring a new version to the desk with that change." (`shots/m3-reply.png`).

**Finished:** yes.

**Findings:**
- The evidence doesn't show the thing I was deciding on. The mock is grey placeholder bars with no error state at all. The monitor plays `harbor-promo.mp4`, a harbor boat loop that has nothing to do with checkout. The correspondence says "Screenshot on the desk", but the only picture is that placeholder mock. *Expected:* a real screenshot of the new checkout, including how a card error looks.
- "Open" on the pull request card did nothing I could see. *Expected:* the PR to open, or a message that it opened elsewhere.
- After I sent it back, PR 142 still sat at the top of Decisions as P1, with the same Merge / Hold / Decide-later choices ready to stamp. Only the screen-reader text added "· away". On screen, I could have merged it by accident while the fix was still in progress. *Expected:* a visible "sent back, waiting on Web mate" state.
- Good: the NEEDS WORK box said who it was going to, and the reply was easy to find on the ticket rail.

## 4. Read the hosted-Postgres report and mark it done

**Trying to:** read the report, then make it stop asking for me.

**Did and saw:** Under Research, the report showed in a panel. "Read" opened a clean full-page reader (`shots/m4-read.png`): Provider Quay recommended at $25. I pressed Escape and clicked "Stamp the sheet" (the FILE stamp would also do it). The report left the list, and Research went from 3 to 2 (`shots/m4-filed.png`). The bundled "+1", "Privacy-friendly analytics", stayed behind as its own item.

**Finished:** yes.

**Findings:**
- "File" turned out to mean "done, stop showing it". I worked that out from "THE ASK: Read, then file." *Expected:* none; this one was clear enough.
- A research report again came as a "Question sheet" with a second report tucked in. That's a strange shape for "read this". *Expected:* one report per card.

## 5. Send First Mate a new request and find the reply

**Trying to:** send "add a dark mode toggle to the board app settings", then read the answer.

**Did and saw:** Nothing in the menu was for sending a new message. The only way in was the unlabeled orange horn icon at the top right, which the screen reader calls "Ship phone". It opened a phone with First Mate / Web mate / Growth mate, "Add to…", a text box, "Queue for after reset" and "Queue at time" (`shots/m5-phone.png`). First Mate was already selected. I typed the request and pressed Enter. An "ORDER to First Mate" ticket appeared, and about 10 seconds later it showed "new reply". Clicking the ticket opened a popover with my message and the header "FIRST MATE · NOV 6 12:08 PM", but **no reply text under it** (`shots/m5-reply.png`). I clicked "Open item". The reply was on a new desk card: "Got it. Assigned to a crew; I will bring the result here when it is ready." (`shots/m5-item.png`).

**Finished:** yes, after a detour.

**Findings:**
- The way to talk to my agents is a small unlabeled horn icon. I only found it after looking through the menu. *Expected:* a visible "Message a mate" or "New request" button.
- The ticket popover showed First Mate's name and time with an empty body. It looked like a blank reply. *Expected:* the reply text right there, as it is for the Web mate and Growth mate replies.
- My own request came back as a new **Research** card on my to-do list ("Read, then file", P3, $19). In the scene, it was voiced by "Cartwright Ysolde", a name I'd never seen. Sending a request added a chore for me, and the count went up. *Expected:* my request to live under "things I asked for", not as a new item waiting on me.

## 6. Answer the three beta-invite questions in one go

**Trying to:** answer all three together.

**Did and saw:** Opening "Beta invites: how many in the first wave? +2" showed a "Question sheet · 3" with all three questions ticked and the recommended answers preselected (50 people, Hand-pick, Email). There was also an "INVITE WAVES / waves.html" panel with "Open in the desk browser" (`shots/m6-beta.png`). I wanted "Waitlist order". My first click on it only moved focus to that row: the manifest switched to question 2, the waves.html panel disappeared, and Hand-pick stayed selected (`shots/m6-picked.png`). A second click selected Waitlist order (`shots/m6-picked2.png`). I clicked "Stamp the sheet". All three items left, and the count went from 17 to 14 (`shots/m6-stamped.png`). The log shows fifty, waitlist and email.

**Finished:** yes.

**Findings:**
- On a row that isn't in focus, the first click on an answer is swallowed and only moves focus. *Expected:* one click to pick the answer.
- When I moved to another row, the supporting panel (waves.html) vanished. *Expected:* the panel to stay while I answer the related questions.
- Good: answering several questions at once, with the recommendations prefilled, was quick once I understood the sheet.

## 7. Put off renewing the domain until tomorrow, then bring it back

**Trying to:** snooze it to tomorrow, check it will return, then undo the snooze.

**Did and saw:** With the domain notice open, I clicked LATER. A "Park it for later" box offered "Tomorrow morning – Nov 7 09:00 AM", "After the next usage reset – Nov 6 02:16 PM" and "On a date" (`shots/m7-later.png`). I chose Tomorrow morning. The item moved to a "LATER" section at the bottom of the list, labeled "back Nov 7 09:00 AM", and a "PARKED 1" tag appeared over the stamps (`shots/m7-parked.png`). Clicking the parked row brought it straight back to the desk with no question asked (`shots/m7-click-later.png`).

**Finished:** yes.

**Findings:**
- Good: it was clear that the item would come back, and when.
- One click on a parked row un-parks it, with no confirmation or sign that the snooze was cancelled. That was easy here, but a stray click could undo a snooze. *Expected:* a short "Un-parked" note, or an explicit "Bring back now" button.
- Afterwards, the Agent log still showed `"action":"defer" ... "until":1794067200` for the domain and no later entry for bringing it back. My agents may still think it's parked until tomorrow. *Expected:* a matching log line when I bring it back.
- The "On a date" field defaults to 11/08, not tomorrow. *Expected:* none, just a small oddity.

## 8. Add "also cover touch-screen drag" to the crew rewriting the flaky drag-and-drop test

**Trying to:** add a note to work already in progress.

**Did and saw:** The morning manifest listed "Cooper Idris: Rewrite the drag-and-drop test (cooking)" under GALLEY. I looked for that work everywhere:
- The phone's "Add to…" list only showed the open desk item, two items with my tickets on them, and my two orders. The running rewrite wasn't there (`shots/m8-addto-open.png`).
- I clicked, double-clicked and hovered on the GALLEY picture: nothing happened, and the screen reader treats it as plain text (`shots/m8-galley.png`, `shots/m8-galley-hover.png`).
- The ticket rail's "more" only lists things I asked for (`shots/m8-moretickets.png`).
- Search (⌘K) for "drag" found only the separate decision "Quarantine the flaky drag-and-drop test?" (`shots/m8-search.png`).
- Menu > Agent log is a raw JSON list of my answers (`shots/m8-agentlog.png`), and Menu > Ships out is a day summary (`shots/m8-shipsout.png`).

As a fallback, I phoned First Mate: "For the crew rewriting the flaky drag-and-drop test right now: also cover touch-screen drag." It went out as a brand-new ORDER, not attached to the running work. The popover again showed First Mate's name with no reply text, and the request also landed on my desk as a new Research card (count went from 14 to 15) (`shots/m8-after.png`, `shots/m8-reply.png`).

**Finished:** only partly. The message reached First Mate, but not attached to the running work.

**Findings:**
- I couldn't find running crew work anywhere I could act on it. The galley only shows it as a picture, and only in the morning manifest is it written out. *Expected:* a clickable "in progress" list, with "Add to…" offering those jobs.
- The decision "Quarantine the flaky drag-and-drop test?" and the running "Rewrite the drag-and-drop test" sound related, but nothing links them. *Expected:* related work grouped or cross-linked.
- The blank First Mate reply and the "my request becomes my chore" problem from Mission 5 happened again.

## 9. Check what's left on Primary and when it refills, then queue "run the full end-to-end suite" for after the refill

**Trying to:** read the usage, then schedule the run.

**Did and saw:** I clicked the usage strip at the top. A "Stamina" window opened (`shots/m9-usage.png`): **Primary · 5h: 38% left, resets in 2h 4m (02:15 PM), runs out ~01:49 PM at this pace.** Primary · week: 59% left, resets Nov 9 at 05:05 PM. Under it was an indented "Primary Opal · week 80%". In the phone, I typed the request and clicked "Queue for after reset". The ticket read "run the full end-to-end suite ⏳ waiting for reset · 2h 4m", and a new header chip appeared: "1 queued · ☕ 02:20 PM" (`shots/m9-queued.png`).

**Finished:** yes.

**Findings:**
- The queued time (02:20 PM) doesn't match the reset time (02:15 PM). I couldn't tell which one is right, or whether there's a deliberate 5-minute buffer. *Expected:* the same time, or a note explaining the gap.
- "Queue for after reset" doesn't say which reset it means: Primary 5h, Primary week, or Backup. I guessed Primary 5h from the matching 2h 4m countdown. *Expected:* the button to name the subscription and the time.
- I never figured out "Primary Opal · week" (or the "+1" / "+2" at the end of the usage strip). *Expected:* a short label for what Opal is.
- The usage window is called "Stamina", and the morning manifest also says the crew is "yawning" when usage runs low. That took a second to map onto "subscription usage".
- Good: the usage numbers and reset times were easy to find and read.

## 10. Reject the logo by accident, then take it back

**Trying to:** undo an accidental reject so the logo choice is still waiting.

**Did and saw:** On "Pick a logo direction" (three logos shown, B recommended; `shots/m10-logo.png`), I clicked REJECT. It took effect instantly, with no confirmation and no reason asked. The item left, the count went from 15 to 14, and cash went up by $80 (`shots/m10-rejected.png`). An "Undo U" button appeared at the bottom right. I clicked it. The logo item came back exactly as it was, and the cash dropped back to $394 (`shots/m10-undone.png`). The Agent log had no reject line (`shots/m10-log.png`).

**Finished:** yes.

**Findings:**
- Reject is one click with no confirmation and no box for a reason, unlike Needs work and Ask. *Expected:* at least a reason box, given how easily it happened.
- The Undo button is small, sits on top of the keyboard-shortcut text in the bottom-right corner, and gives no sign of how long it stays. *Expected:* a clearer "Rejected 'Pick a logo direction' – Undo" near what I did.
- Rejecting earned money ($80). That makes the cash feel like a reward for clearing items, whatever the decision. Confusing.

## 11. Ask the Growth mate whether the newsletter draft mentions the new checkout

**Trying to:** send a question and read the answer.

**Did and saw:** On "Newsletter #6 draft", I stamped ASK. The "Ask a follow-up" box was addressed "to Growth mate, about: Newsletter #6 draft" (`shots/m11-ask.png`). I typed the question and clicked Send. The desk jumped to a different item ("Review the 10-second promo cut"). After about 10 seconds, the ticket rail showed the question with "new reply · UPDATED", and the newsletter card got an "UPDATED" badge (`shots/m11-wait.png`). Clicking the ticket showed: "Checked it. Short answer: yes, and I have added a line about it to the summary." (`shots/m11-reply.png`).

**Finished:** yes.

**Findings:**
- After Send, the desk moved me to another item, so I lost sight of the one I'd just asked about. *Expected:* to stay on the newsletter until I moved on.
- The reply says the agent edited the draft ("added a line"). I only asked a question, and it's not clear the draft changed under me. *Expected:* to be told what changed, or asked before the change.
- Good: the reply was quick and easy to find on the ticket rail.

---

## Things seen across all missions
- I found a lot of harbor and game wording that I never understood and that nothing explained: "high tide 2h 9m", "+7 boats", "19 to zero", "2 crew paused", "Galley", "Pier", the scene names (Signpost Square, Customs Shed, Bottle Cove, Notice Board), cash in dollars, "chandlery and stamp book", and "new stamps: First stamp". I never learned what "2 crew paused" meant or how to unpause them. *Expected:* plain labels, or a hover explanation.
- I didn't recognize several agent names (Scout Quill, Chandler Vey, Tinker Fen, Cooper Idris, Net-mender Juno, Cartwright Ysolde). Cards say things like "Growth mate, via Chandler Vey", so I had to guess which crew belongs to which mate. *Expected:* each name shown together with its mate.
- The Agent log is raw JSON with file paths. It was useful for checking what was really sent, but it's not readable for a captain.

## What I believe each concept means
- **Morning manifest:** a start-of-day summary: counts, what's first, work in progress, usage.
- **Window / list (All, Decisions, Reviews, Research, Notices):** everything my agents are waiting on me for, split by kind.
- **Decision:** pick one of a few lettered options; usually one is marked "rec." (recommended).
- **Review:** look at a piece of work and give a verdict (approve, reject, needs work).
- **Research:** a report to read and then "file" (mark done).
- **Notice:** a to-do only I can do; file it when done.
- **Question sheet:** several related questions answered and stamped together; "+1"/"+2" on a card means more questions are bundled in.
- **Stamps (Approve/File, Reject, Needs work, Ask, Later):** my answers. Needs work and Ask send a message back to the mate. Later parks an item until a time.
- **Later / Parked:** snoozed items that come back at a set time.
- **Tickets (rail at the top):** things I asked for (orders, asks, rework) and whether they've been answered.
- **Ship phone:** where I send new messages to First Mate, Web mate or Growth mate, add to existing things, or queue a message until usage resets or until a set time.
- **Stamina / usage strip:** how much of each AI subscription window (5-hour, weekly) is left and when it refills.
- **Queued (☕ time):** messages held until the usage refills.
- **Galley:** work my crews are doing right now (I could only see it, not act on it).
- **Pier, tide, boats, cash:** I never figured these out. They seem to be game decoration for "items left to clear" and a reward for clearing them.
- **The cat:** a hint at which item to do first. It didn't always match what looked most urgent.
- **Undo:** takes back the last stamp.
- **Agent log:** the raw record of what was actually sent to the agents.
