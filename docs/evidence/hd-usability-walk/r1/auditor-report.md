# Harbor Deck audit against the captain's bar

Window: 1440 × 900, driven only through `./deck`. Sample data, Day 1 into Day 2.
Screenshots are in `shots/`. Every shot listed here is the 800 px copy. The `--full` captures I took first never landed in `shots/`: `./deck look <name> --full` printed "saved" but left no file. `cp` from `look.png` needed approval I didn't have, so I retook every state without `--full`. Two states could not be retaken; they are marked "no shot".

Command failures, as I saw them:
- `./deck click --role button --name "Undo U"` on the Undo pill timed out (8 s).
- Clicking the "firstmate" / "Other agent" tabs by role, "Command line tool…" by text, and a plain-mode row by its text all timed out. Clicking at a point worked.
- Clicking `--text "Advanced"` in Settings worked. `--role textbox --name "Speak to First Mate…"` in the phone timed out, but typing straight away went into the field.
- Pressing Reject on the decision desk stamped "Merge PR 142" as rejected straight away, with no dialog. It is now in the Archive (`archive.png`), because Undo could not be clicked.

---

## 1. Strings that explain instead of naming a thing or an action

Desk and papers
- Desk, before the office opens: "The office is closed. Open the day from the morning manifest." (no shot; I read it in the screen-reader tree on first launch)
- Decision manifest banner: "Updated since you last looked: replies" (no shot; it was on the Merge PR 142 paper, and that state was lost with the `--full` captures)
- Question sheet: "A–E pick on the row in focus and move on · J/K row · Space stamps every ticked row". → `final.png`
- Question sheet row 2: "Review: not opened yet, open it to include". → `final.png`
- Drop zones: "SPACE TO STAMP" and "SPACE STAMPS 1 ROW". → `scene-customs.png`, `final.png`
- "The ask" captions: "Your call A–E pick · Space stamps", "Your verdict on the work.", "Read, then file.", "Only you can do this. File it when done." → `scene-customs.png`, `scene-cove.png`, `scene-notice.png`
- Photo and Monitor captions repeat the file name under the media: "checkout-mock.svg", "● harbor-promo.mp4". → `scene-customs.png`
- Stamps column: the long key legend "X stow · Space/1 stamp · A–E pick · J/K row · S later · ⌥S pick a date · ⇧A take recs · 2 reject · 3 rework · 4 ask · U undo · ⇧B book · T tickets · N next · O topic · I inspect · R orders · ←/→ scene · ⌘K search · M menu · Esc". → `final.png`
- Storage box empty toast: "Nothing stowed. Drag a paper here, or press X." → `storage-empty.png`

Scene and left column
- Under the scene: "high tide 1h 59m · 18 to clear +6 boats" and "18 to zero · 1 crew paused". These are status sentences, not names. → `final.png`
- Scene speech bubble flavour lines: "Tinker Fen: Still smarting from the l…", "Net-mender Juno: First time at your w…". → `final.png`, `scene-notice.png`

Top bar and its popovers
- Usage strip: "⚠ out ~06:46 AM", "⚠ out ~01:50 PM". → `final.png`
- Stamina popover: "resets in 2h 3m (02:15 PM) · runs out ~01:50 PM at this pace · quota.json, 6m ago" and "running low, crew yawning". → `usage.png`
- Chandlery: a caption under every item ("A lamp on the pier, lit after dark.", "Approvals land in sea teal.", …), the header "CHANDLERY · COSMETIC ONLY", and "Just the shore so far. Next building after 1 more day at the desk (1 so far)." → `cash.png`, `cash-scrolled.png`
- Header on Day 2: "Day 2 · 1-day streak". → `office-closed.png`

Menu entries and dialogs
- Inspect banner: "Inspect: click a claim on the manifest, then a point of evidence (a moment, a spot on a photo, a heading, a standing order)." → `inspect.png`
- Standing orders: "Your saved preferences, which firstmate already follows. It auto-checks the tagged ones on each item; only look when one is flagged." and "1 flagged on this item". → `orders.png`
- Agent log: "One line of …/answers.jsonl per action. Your agent tails this file; nothing else crosses the wire." and "GAPS (1) Responses an agent could not fit into a decision, review, research note or notice. Each one is a case for a new desk item." → `agentlog.png`
- Ships out: chips "2 boats out", "Tide still coming in · 18 moored"; Logbook "↳ Scout Quill can finish "Two-step checkout"; unlocks Two-step checkout", "↳ nothing was waiting on it". → `shipsout.png`, `shipsout-log.png`
- Search footer: "↑↓ move ⏎ open Esc close" and "41 on file". → `search.png`
- Ship phone: the hint row "1–9 dial ⏎ send ⌘V image ⌥⏎ after reset ⇧⏎ new line Esc hang up", and "⌘V or drop an image here". → `phone.png`
- Ask / Needs work / Later dialogs: "to First Mate, about: …", "to Growth mate, about: …", "Back on the desk: Sign the app store developer agreement", "⌘V or drop an image here". → `stamp-ask.png`, `stamp-needswork.png`, `stamp-later.png`
- Morning manifest: "Friday, November 6 · 1-day streak · $305 in the till"; Stamina lines "resets in … · quota.json, 10m ago · running low, crew yawning"; the "Space" label next to "Open the office". → `manifest.png`

Settings
- A helper line under every label: "Relative paths not found in the data folder resolve here.", "Besides localhost, sites the desk browser may show.", "A made-up harbor to try the desk.", "A source checkout updates with git.", "Opens the ship phone.", "Agents leave items here and read your answers.", "Connect Claude Code, firstmate or another agent; install the hd command.", "Runs after every answer line; it gets the line on stdin and in $HARBORDECK_LINE." → `settings-light.png`, `settings-advanced.png`
- Value sub-lines: "paths resolve in the data folder only", "default, in your home folder". → `settings-light.png`
- "Set by HARBORDECK_HOME, which wins over the folder below." and "Reading /tmp/…/home". → `settings-light.png`
- Connect an agent: "Last agent write 2m ago (items/…json). Data directory …", "Agents put items on the desk with the hd command. This will link hd and harbordeck in ~/.local/bin to …", "Adds Harbor Deck's MCP server to Claude Code, so every session gets the desk tools…", the "This will:" bullet lists, "Connects a firstmate home: the bridge routes your stamps back…", "Any agent with a shell: install the command line tool above, then paste this into its instructions file…", "Agents that take MCP servers (stdio):". → `connect-agent.png`, `connect-firstmate.png`, `connect-other.png`

## 2. Pairs of controls that do the same job

- **Scene arrows ‹ › vs. the scene count pills (6 5 4 3) vs. the "All / Decisions / Reviews / Research / Notices" chips.** All three switch which kind of paper you are looking at. → `final.png`
- **"Next N" button (left column) vs. the › scene arrow / J-K / the scene queue.** All of them move you to the next waiting paper. → `final.png`
- **"Stamp the sheet" button vs. the "SPACE STAMPS 1 ROW" drop zone vs. the Approve stamp.** All three commit the question sheet. → `final.png`
- **"Back of the line" button on the manifest vs. the Later stamp.** Both move the paper out of the way to come back to later. → `final.png`
- **Stow controls:** each paper's "—" (Stow this paper) button, dragging a paper onto the box, and the X key. The toast lists both drag and X. → `final.png`, `storage-empty.png`
- **"STAMPS" heading at the top of the column vs. the vertical "STAMPS / TAB" handle.** Both label the stamp column. The handle also toggles the column, which the Tab key already does. → `final.png`, `stamps-toggled.png`
- **Header "$305" cash pill vs. Menu › "Chandlery & stamp book ⇧B".** Both open the Chandlery. → `menu.png`, `cash.png`
- **Header usage strip vs. its "Stamina" popover**, which lists the same five meters again. → `final.png`, `usage.png`
- **Settings "Connect an agent…" vs. "Command line tool…".** Both open the same "Connect an agent" dialog; the second only highlights the top box. → `connect-agent.png`, `cli-tool.png`
- **Ask stamp (dialog "Ask a follow-up") vs. Ship phone "Add to… › AT THE DESK / ITEM" vs. ticket popover "Open item".** All of these send a question about the paper on the desk to its mate. → `stamp-ask.png`, `phone-addto.png`, `ticket-pop.png`
- **Plain mode: the "Ask" button vs. the "Ask a follow-up…" field with its own "Ask" button**, side by side in the same card. → `plain-item.png`
- **Search ⌘K and Plain mode.** Both list every open item. → `search.png`, `plain-item.png`
- **Ticket popover: "Done" vs. "Close".** → `ticket-pop.png`
- **Phone "Queue for after reset" vs. "Queue at time" with its time field.** → `phone.png`
- **Later dialog "Tomorrow morning" / "After the next usage reset" rows vs. "On a date" + "Park".** Three ways to park in one dialog, plus the S / ⇧S / ⌥S keys. → `stamp-later.png`
- **Ships out "Close the day" vs. Morning manifest "Open the office".** These are the day boundary twice. The X on the manifest skips it entirely and still opens the desk. → `shipsout.png`, `manifest.png`, `office-closed.png`

## 3. Rows, strips or panels that cost space for something already shown elsewhere

- **The left "Window" list** shows every paper that the scene queue already shows as characters lining up (same titles, counts and P-levels). → `final.png`
- **The filter chips "All 18 / Decisions 6 / Reviews 5 / Research 4 / Notices 3"** repeat the scene count pills right above them (6 5 4 3). → `final.png`
- **The two status lines under the scene** ("18 to clear" and "18 to zero") repeat each other and the "All 18" chip. "high tide 1h 59m" repeats the Primary 5h reset already in the header. → `final.png`
- **The Galley and Pier panels** repeat the scene's "crew paused" line and what the Morning manifest's GALLEY list shows. → `final.png`, `manifest.png`
- **The ticket rail** repeats the ORDER/ITEM rows in the ship phone's "Add to…" list, and the "Correspondence" paper. → `final.png`, `phone-addto.png`
- **The decision manifest summary paragraph** repeats what the Research paper next to it says (prices, +$40/mo hosting). The yellow "⚠ free tier hosting pushes tooling spend to about $70/mo" box repeats the "budget-60" chip and Standing orders' "ON THIS ITEM". → `final.png`, `orders.png`
- **Tag chips on the manifest** ("#launch", "board-app · launch") repeat the same tag shown on the left-column row. → `final.png`
- **The stamp key legend** in the Stamps column repeats the keys already shown on the menu entries, the drop zones and the phone. → `final.png`, `menu.png`
- **Morning manifest** "AT THE WINDOW", "GALLEY" and "STAMINA" repeat the scene counts, the Galley panel and the header usage strip. → `manifest.png`
- **Stamina popover** title "Stamina" plus section label "STAMINA". → `usage.png`
- **Chandlery** "Till $305" repeats the header cash pill. → `cash.png`
- **Ships out** "2 cleared · $310 · 18 waiting" appears in the Day header and again as "2 cleared · $310 earned · 18 waiting" in the Logbook. "STILL WAITING ON YOU" repeats the window list. → `shipsout-log.png`
- **Standing orders "ON THIS ITEM"** repeats the order chips already on the paper (budget-60, no-dark-patterns). → `orders.png`

## 4. Clipped, spilling, overlapping or off screen

- **"Stamp the sheet" button** sits on the bottom edge of the window and is cut off on the decision desk (light and dark, and behind the manifest). → `final.png`, `dark.png`, `manifest.png`
- **Ticket popover** opens anchored to the top-left corner, over the header (clock, Day) and the scene, not under its ticket. Its top edge starts at the window top. → `ticket-pop.png`, `ticket-pop-dark.png`
- **The "STAMPS / TAB" handle** overlaps the right edge of the paper next to it. With the column collapsed it sits over the research paper's border. → `final.png`, `stamps-toggled.png`
- **The Undo pill** after a stamp lands on top of the key legend at the bottom of the Stamps column, covering "R orders · ←/→ scene · ⌘K search · M menu · Esc". → `undo-overlap.png`
- **Inspect banner** covers the ticket rail (the "Order to Web mate" ticket is half hidden). → `inspect.png`
- **Scene speech bubble text** is truncated with "…": "Tinker Fen: Still smarting from the l…", "Net-mender Juno: First time at your w…". → `final.png`, `scene-notice.png`
- **Ships out boats**: the labels on the boats are cut mid-word, "Merge PR 142 (calmer c". → `shipsout.png`, `shipsout-log.png`
- **Header usage strip** cuts off its meters and ends with "+1" / "+2". The Opal and Backup 5h windows are hidden, and fewer fit on Day 2 than on Day 1. → `final.png`, `office-closed.png`
- **Left column**: the last visible card ("Review the 10-second promo cut") is cut by the "Next N" bar. → `final.png`
- **Morning manifest "REGULARS"** bars are cut at the bottom ("Engine room" bar half shown) above the footer. → `manifest.png`
- **Text drawn straight over the harbor scene**: the "high tide … · 18 to clear +6 boats" band and the small A·B / ABC sign labels over the characters. → `final.png`
- **Menu**, seen once (on switching theme from the open menu): the lower half of the menu (Sound/Look/Settings) was covered by the desk papers, with "Desk sounds" half hidden. I could not reproduce it, and that screenshot was one of the `--full` captures that never saved (no shot).

## Also matching the captain's earlier flags

- **Near-invisible buttons:** plain-mode "Later" (grey text on a grey box); the Settings "Off" button next to the Shortcut field; the "Connect firstmate" button in Connect an agent (faint on faint). → `plain-item.png`, `settings-light.png`, `connect-firstmate.png`
- **The rejected Settings look is still reachable:** "Connect an agent" is a dark navy modal unlike the beige Settings. It has plain inputs ("~/firstmate"), a dev-style checkbox ("Run the bridge as a background service (launchd agent dev.harbordeck.firstmate)"), big monospace command/JSON blocks, and lone "Install" / "Connect firstmate" buttons. → `connect-agent.png`, `connect-firstmate.png`, `connect-other.png`
- **Dark theme:** the manifest's "due 2d 23h" is pale blue on beige, close to unreadable. → `dark.png`
