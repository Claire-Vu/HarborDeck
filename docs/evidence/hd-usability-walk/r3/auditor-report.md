# Harbor Deck: no-clutter audit

I used only the app window that `./deck` drives, at 1440 × 900, with the sample data. Every screenshot is full size and lives in `shots/`. I covered the morning manifest, the desk in each scene, all four paper kinds (decision, review, research or question sheet, notice), the stamps and what each opens, the ticket rail and its popover and overflow, the storage box (empty and full), the ship phone, the header cash and usage buttons, every menu entry, Settings and the Connect an agent dialog, plain mode, keyboard-only views (O, T, I, ⌥S, Tab, Space), and both light and dark theme.

Problems I hit while driving the app:
- `⌘,` (listed in the menu as the Settings shortcut) did nothing when I pressed it. Settings opened only from the menu (`shots/19-settings-dark.png` shows the screen after I pressed it: unchanged).
- Pressing `?` did nothing (`shots/54-help-key.png`).
- The Pull request paper's **Open** button gave no visible result (`shots/38-pr-open.png`).

---

## 1. Strings that explain instead of naming a thing or an action

| Where | String(s) | Shot |
|---|---|---|
| Scene panel, over the harbor art | `19 to zero · 2 crew paused`, `high tide 2h 9m`, `+7 boats` | `shots/02-desk-open.png` |
| Scene panel speech bubble, over the scene | `Net-mender Juno: First time at your w…`, `Cartwright Ysolde: Back again today.`, `from Scout Quill`, `2 papers on Infra` | `shots/02-desk-open.png`, `shots/32-ticket-open-item.png`, `shots/33-decision.png`, `shots/48-back-of-line.png` |
| "The ask" slip on every paper | `Do it, then file`, `Read, then file`, `Your verdict`, `Your call` | `shots/02-desk-open.png`, `shots/32-ticket-open-item.png`, `shots/46-review.png`, `shots/33-decision.png` |
| Stamp drop zone | `SPACE TO STAMP`, `SPACE STAMPS 1 ROW` / `2 ROWS` | `shots/02-desk-open.png`, `shots/48-back-of-line.png`, `shots/49-sheet-q2.png` |
| Question sheet rows | `Research: file on stamp`, `Research: not opened` | `shots/48-back-of-line.png`, `shots/49-sheet-q2.png` |
| Stamp column, bottom right (always visible) | Shortcut legend paragraph: `X stow · Space/1 stamp · A–E pick · J/K row · S later · ⌥S pick a date · ⇧A take recs · 2 reject · 3 rework · 4 ask · U undo · ⇧B book · T tickets · N next · O topic · I inspect · R orders · ←/→ scene · ⌘K search · M menu · Esc` | `shots/02-desk-open.png` |
| Morning manifest | `Last 7 days: 9 shipped, 3 merged, 2 reworked, 3 reports.`; `runs out ~02:57 PM at this pace`; `Space` hint next to Open the office | `shots/01-home.png` |
| Stamina popover (header usage) | `resets in 2h 5m (03:22 PM) · runs out ~02:57 PM at this pace` (one line like this under each meter) | `shots/52-usage-popover.png` |
| Header usage strip | `⚠ out ~07:53 AM`, `⚠ out ~02:57 PM` | `shots/02-desk-open.png` |
| Inspect mode | Bottom pill `Inspect: claim → evidence` | `shots/06-inspect.png` |
| Search | Footer `↑↓ move ↩ open Esc close` and `40 on file`; empty state `Nothing matches.` | `shots/04-search.png`, `shots/05-search-empty.png` |
| Plain mode | `19 open · 2 actions` | `shots/07-plain.png` |
| Chandlery | `CHANDLERY · COSMETIC ONLY`; a description line under each item (`A lamp on the pier, lit after dark.`, `Approvals land in sea teal.` …); `Just the shore so far. Next building after 1 more day at the desk (1 so far).` | `shots/09-chandlery.png`, `shots/10-chandlery-bottom.png` |
| Standing orders drawer | `0 flagged on this item` | `shots/11-orders.png` |
| Ships out | `No boats went out today.` (drawn over the sea art), `Tide still coming in · 19 moored`, `Nothing cleared yet.` | `shots/13-ships-out.png`, `shots/14-ships-out-logbook.png` |
| Agent log | Raw path `/tmp/hdv-uw-r3-auditor/home/answers.jsonl` and a raw JSON block; gap caption `Growth mate · squeezed into promo-cut-v2 · …` | `shots/15-agent-log.png` |
| Settings | `paths resolve in the data folder only`, `default, in your home folder`, `Set by HARBORDECK_HOME, which wins over the folder below.`, `Reading /tmp/hdv-uw-r3-auditor/home`, `(source checkout)`, placeholder `add a host, e.g. devbox.lan:8080` | `shots/19-settings-dark.png`, `shots/58-settings-light.png` |
| Connect an agent dialog | Status `Last agent write 2m ago (gaps.jsonl). Data directory …`; paragraphs `Agents put items on the desk with the hd command. This will link…`, `Adds Harbor Deck's MCP server to Claude Code, so every session…`, `This will:` plus bullet list, `Connects a firstmate home: the bridge routes…`, `This will run adapters/firstmate/install.sh, which:` plus bullets, `Any agent with a shell: install the command line tool above, then paste…`, `Agents that take MCP servers (stdio):`, `Optional: tell it when to use the desk (paste into CLAUDE.md)` | `shots/21-connect-agent.png`, `shots/22-connect-firstmate.png`, `shots/23-connect-other.png` |
| Ship phone | `⌘V or drop an image here`; key legend row `1–9 dial · ⏎ send · ⌘V image · ⌥⏎ after reset · ⇧⏎ new line · Esc hang up` | `shots/25-phone.png` |
| Ask follow-up dialog | `to Web mate, about: Privacy-friendly analytics`; `⌘V or drop an image here` | `shots/50-ask-stamp.png` |
| Park for later dialog | `Back on the desk: Privacy-friendly analytics` | `shots/51-later-date.png` |
| Topic dialog (O, or a #tag) | `2 open · 2 items · 1 note · last Nov 6 08:12 AM` | `shots/55-key-o-topic.png`, `shots/62-hashtag-click.png` |
| Ticket rail | Vertical `TICKETS` label; status lines on tickets `awaiting reply · 5h`, `● new reply`, `✓ replied` | `shots/02-desk-open.png`, `shots/30-ticket-answered.png` |
| Archive card | `Research · board-app ·` (ends on a dangling separator) | `shots/12-archive.png` |

## 2. Pairs of controls that do the same job

| Pair | Shot |
|---|---|
| Header **$ cash button** and menu **Chandlery & stamp book**: both open the same Chandlery dialog | `shots/53-cash-button.png`, `shots/09-chandlery.png` |
| Header **usage strip** (opens Stamina popover) and the morning manifest **Stamina** column: the same five meters with the same reset lines | `shots/52-usage-popover.png`, `shots/01-home.png` |
| Scene **‹ / › arrows** and scene count badges (`8 5 4 3`) in the scene panel, and the **filter chips** (`Decisions 8 · Reviews 5 · Research 3 · Notices 3`) under it: both switch between the same four kinds (choosing the Research chip also switches the scene to Bottle Cove) | `shots/47-filter-research.png` |
| Settings **Connect an agent…** and **Command line tool…**: both open the same Connect an agent dialog | `shots/21-connect-agent.png`, `shots/59-cli-tool.png` |
| Decision slip option **C "Decide later"** and the **LATER** stamp | `shots/33-decision.png` |
| Decision slip option **B "Hold, I want changes"** and the **NEEDS WORK** stamp | `shots/33-decision.png` |
| Question sheet **Stamp the sheet** button and the **FILE** stamp / Space | `shots/48-back-of-line.png` |
| Plain mode: radio options **Merge / Hold, I want changes / Decide later** next to the **Approve / Reject / Needs work / Ask / Later** buttons; **Ask** button next to the **Ask a follow-up…** field and its own **Ask** button | `shots/08-plain-item.png` |
| **ASK** stamp (Ask a follow-up dialog) and the **ship phone** with **Add to…** that item: both send a message about the item to its mate | `shots/50-ask-stamp.png`, `shots/26-phone-addto.png` |
| Ticket popover **Open item** and clicking the item in the left column; popover **Done** and **Close** sit side by side | `shots/31-ticket-popover.png` |
| Pull request paper **Open** button and the **link** URL on the same paper | `shots/33-decision.png` |
| Dialog **×** and **Cancel** (Settings, Ask follow-up, Park for later); **×** and **Done** (Connect an agent) | `shots/19-settings-dark.png`, `shots/50-ask-stamp.png`, `shots/51-later-date.png`, `shots/21-connect-agent.png` |
| Ship phone **Queue for after reset · 03:24 PM** and the time field with **Queue at time**; Park dialog **After the next usage reset** and **On a date / Park** | `shots/25-phone.png`, `shots/51-later-date.png` |
| Agent log **Copy** and **Export** | `shots/15-agent-log.png` |

## 3. Rows, strips or panels that repeat what is already on screen

| What | Already shown in | Shot |
|---|---|---|
| Left column "Window" item list (with project headings and counts) | Scene line-up of characters for the same items; Ships out "Still waiting on you"; Search list; plain mode list | `shots/02-desk-open.png`, `shots/14-ships-out-logbook.png` |
| Filter chip counts `Decisions 8 / Reviews 5 …` | Scene title badge (`SIGNPOST SQUARE 8`) and scene count badges `8 5 3 3`; manifest "At the window" list; plain mode section headings `NEEDS YOUR WORD (8)` | `shots/02-desk-open.png`, `shots/01-home.png`, `shots/07-plain.png` |
| Scene speech bubble repeating the selected paper title (`Merge PR 142 (calmer checkout)? from Scout Quill`) | Title of the manifest paper on the desk and the highlighted left-column card | `shots/33-decision.png` |
| `high tide 2h 9m` in the scene | Header `Primary 5h … ↻ 2h 9m` | `shots/02-desk-open.png` |
| Each left-column card shows a kind badge (`DECISION`) and the `#tag` | Also given by the filter chip and the scene; plain mode shows `#checkout` and `checkout` next to each other | `shots/07-plain.png`, `shots/33-decision.png` (`checkout · … #checkout`) |
| Correspondence paper on the desk repeating the ticket reply (`Got it. Assigned to a crew…`, `is the weekly digest opt-in?`) | Ticket rail ticket and its popover | `shots/32-ticket-open-item.png`, `shots/46-review.png`, `shots/31-ticket-popover.png` |
| A phone order (`Please check the domain renewal price`) shows up three times: as a ticket, as a research item in the left column / scene (counts went 19 → 20), and as its own paper | One place would do | `shots/30-ticket-answered.png`, `shots/63-next-button.png` |
| Phone **Add to…** list (`AT THE DESK / ITEM / ORDER …`) | Ticket rail and current paper | `shots/26-phone-addto.png` |
| Chandlery `Till $0` / `0 buildings` header row | Header `$` button; Harbor town section | `shots/09-chandlery.png` |
| Ships out header `0 cleared · $0 · 19 waiting` and chips `0 boats out`, `Tide still coming in · 19 moored` | Each other and the header | `shots/13-ships-out.png` |
| Topic dialog **Still open** list and **Timeline** listing the same item(s) | Each other | `shots/62-hashtag-click.png`, `shots/55-key-o-topic.png` |
| Settings `Reading /tmp/…/home` row and **Data folder** row | Connect dialog `Data directory /tmp/…/home` line | `shots/19-settings-dark.png`, `shots/21-connect-agent.png` |
| Stamp book in Chandlery: 11 empty dashed circles with very faint labels | Takes half of the dialog for nothing earned | `shots/09-chandlery.png` |
| Big empty paper areas: Correspondence paper filling the desk for one line; Pull request paper after the photo is stowed | Same content in the ticket / link | `shots/32-ticket-open-item.png`, `shots/39-photo-minimized.png` |
| Persistent **Undo (U)** pill after every stamp | `U undo` already in the shortcut legend | `shots/45-stamp-approve-after.png` |
| Topic view exists (O and every #tag open it) | The captain said "Topics isn't that useful either" | `shots/55-key-o-topic.png` |

## 4. Clipped, spilling, overlapping or off screen

| What | Shot |
|---|---|
| Ticket popover runs past the top of the window and covers the header usage strip; the top of the popover is cut off at y = 0 | `shots/31-ticket-popover.png` |
| Ticket rail overflow: the 4th ticket is cut by the `1 more ›` button (`Dr…`); after paging, the first ticket is cut by `‹ 1` and the last (`Draft a reply to the b…`) is still cut by `1 more ›`. The rail rod stops short of both ends. | `shots/66-four-tickets.png`, `shots/67-tickets-more.png` |
| Money float `+$225` / `+$75` lands on top of the vertical `TICKETS` label and the rail's left edge | `shots/44-stamp-approve-mid.png`, `shots/64-file-notice-mid.png` |
| Monitor paper: video cropped at the bottom (boat cut off); after scrolling, the player's time and controls row is cut at the top (`0:00 / 0:10` half visible) | `shots/33-decision.png`, `shots/34-decision-scrolled.png`, `shots/39-photo-minimized.png` |
| Correspondence paper cut at the bottom edge of the window (third note hidden until you scroll inside it) | `shots/33-decision.png` |
| Document paper's embedded PDF viewer cut at the bottom of the window | `shots/49-sheet-q2.png` |
| Storage box popover lays over the Monitor and Correspondence papers and runs past the desk edge into the stamp column | `shots/40-storage-box.png` |
| Standing orders and Agent log drawers cover the right end of the header (usage strip cut mid-"week", phone and menu hidden) | `shots/11-orders.png`, `shots/15-agent-log.png` |
| Header usage strip shows only `Backup week` and `Primary 5h/week`, with the rest folded into `+1`/`+2`; on the first load the `+1` sits against the strip's right border | `shots/01-home.png`, `shots/02-desk-open.png` |
| Scene speech bubble text truncated (`First time at your w…`) and drawn over the busy scene; scene status text (`19 to zero · 2 crew paused`, count badges) drawn over the harbor art | `shots/02-desk-open.png`, `shots/18-dark.png` |
| Left-column card titles clipped at the panel bottom behind the Next bar (`Launch pricing: one plan / or free + pro?` half hidden) | `shots/02-desk-open.png` |
| Undo pill sits over the bottom-right corner of the desk | `shots/45-stamp-approve-after.png` |
| Hiding the stamp column (Tab) reflows every paper, and the Photo paper then reaches the bottom edge of the window | `shots/43-stamps-toggled.png` |
| Dark theme: **Back of the line** loses its box and shows as faint text on the paper header; paper `—` (stow) handles and **Read** buttons are near-invisible | `shots/18-dark.png`, `shots/49-sheet-q2.png` |
| Ask follow-up and Park dialogs: the **×** close is near-invisible (very faint on cream) | `shots/50-ask-stamp.png`, `shots/51-later-date.png` |
| Chandlery stamp book: badge labels are near-invisible (`FIVE IN A ROW`, `NIGHT OWL`…, faint beige on beige) | `shots/09-chandlery.png` |
| Connect an agent dialog: long paths wrap mid-word (`…/<worktree>/Harbo` / `rDeck…` [path redacted], `…/us` / `erhome/…`); the instruction block's text runs into the Copy button column and the MCP block is cut at the dialog bottom | `shots/21-connect-agent.png`, `shots/23-connect-other.png`, `shots/59-cli-tool.png` |
| Connect an agent dialog uses a dark navy (or plain white in light theme) style unlike the parchment Settings; it has a plain grey input (`~/firstmate`), a dev-style checkbox and a big monospace command block, the pattern the captain rejected as "this ugly" | `shots/22-connect-firstmate.png`, `shots/59-cli-tool.png` |
| Settings Advanced: `On answer` toggle plus a raw shell path text box (`~/bin/wake-agent.sh`) | `shots/20-settings-advanced.png` |
| Ship phone and Park dialog use native date/time inputs (`--:-- --` with a system clock icon; `11/08/2026, 09:00 AM`) that clash with the styled controls | `shots/25-phone.png`, `shots/51-later-date.png` |
| Agent log shows raw JSON lines hard-wrapped mid-word (`we` / `ekly`, `boar` / `ds`) | `shots/15-agent-log.png` |
