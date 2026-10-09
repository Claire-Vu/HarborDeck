# Live-feed evidence

Recorded by `test/evidence/run.sh demo` with the ystack evidence runner: the real Electron app, with synthetic data and a stub firstmate home, and the bridge in echo mode.

1. Open the office.
2. An agent posts two items with one `harbordeck batch`, and they appear in the queue live.
3. Key `1` stamps a decision. After the undo hold, the line lands in `answers.jsonl`, and the bridge logs `printf 'ship-24\tmerge\tMerge\tdone' | fm-captain-hold.sh answers --source harbordeck`.
4. Key `4` sends an ask. It clips to the ticket rail, and the bridge logs `fm-inbox.sh note --request-id hd-db-research-ask-<at> -- ...`.
5. The agent runs `harbordeck reply`, and the ticket turns green.
6. The reply reads on the rail.

![contact sheet](live-feed-sheet.png)

Video: [live-feed.mp4](live-feed.mp4)

## Verification skill proof run

`docs/evidence/verify-harbordeck/` is one run of the project's verification skill (`.agents/skills/verify-harbordeck/`) on synthetic data: launch, doctor, an agent's `harbordeck decision` appearing live, key `1` writing `answers.jsonl` after the undo hold, an order queued for after reset in Requests and `harbordeck tick` delivering it through the stub wake command, the demo plan page opening and taking a click in the in-desk browser pane, then cleanup. [`transcript.txt`](verify-harbordeck/transcript.txt) is the full command log with exit codes; the screenshots, `answers.jsonl` and `wake.log` are the captured state.

## Image attachments (hd-workflow-mine)

`docs/evidence/hd-workflow-mine/` is a live run on the verify-harbordeck instance (synthetic data, headless): a pasted image on the phone (`1`), a refused text drop (`2`), the order's ticket with `🖼 1` and its pop with the thumbnail (`3`, `4`), Snap desk with a pin, a box and an arrow (`5`), the marked thumbnail on the phone (`6`), the flattened marked copy the crew receives, with no phone in it (`7`), Add to… listing the desk item and running orders (`8`) and aimed at the desk item (`9`), an Ask slip (`10`) and a Mismatch slip (`11`) carrying images, and the bridge's `Attached:` inbox notes in echo mode (`bridge-echo.txt`). After the rebase onto "Remember this" (#33): the phone with an image, Add to… and Remember this together (`12`), and a Needs-work slip with an image and Remember this (`13`).

## Stamp art

`docs/evidence/stamp-art/{before,after}/` are headless captures (`HARBORDECK_HEADLESS=1`, `test/smoke/launch.js`, seeded demo data) of the stamp tray (dark, light, hover), a stamp in hand mid-flight, a stamped slip, every ink colour, and the top-bar megaphone (dark, light, open).

## Megaphone colour

`docs/evidence/megaphone/` are headless captures (`HARBORDECK_HEADLESS=1`, `test/smoke/launch.js`, seeded demo data) of the top-bar megaphone in light and dark, magnified 6x: `before` is the pre-stamp-art icon (monochrome), `current` the red/cream drawing that was replaced, `after` the original shape with colour (brown handle, red horn, brass bell rim).

## Paper tray

`docs/evidence/paper-tray/` are headless captures (`HARBORDECK_SHOTS=docs/evidence/paper-tray npx playwright test test/smoke/stow.spec.js`, seeded demo data) of the storage box empty, holding three stowed papers, and its open view of mini paper cards.

## Pixel-block stamps

`docs/evidence/stamp-pixel/` are headless captures (`test/smoke/launch.js`, seeded demo data) of the stamp tray (`2-tray`, `1-tray-desk`), the Approve stamp pressed (`3-pressed`), a stamp in hand (`4-in-hand`), the five impressions on the decision slip (`5-impression-*`) and the narrow tray (`6-phone-tray`).

## Scene legibility and the scene line

`docs/evidence/scene-legibility/{before,after}/` are headless captures (`hdv launch`, synthetic seed, window crop at 2x) of the top scene window at 1000x630, 1280x800 and 1440x900: `busy-*` is Signpost Square with every decision waiting, `allclear-*` is Bottle Cove emptied (research resolved with `hd resolve`). The left column is a fixed 300 px, so the window is the same size at all three. `before` has the title, tide label and all-clear text drawn over the boats; `after` plates every word (title, arrows, the tide bar on the sill, the all-clear card), and the decisions stand single file with the one at the desk in front. `after/back-of-line-1280x800.png` is the same scene after `W`: the next one steps up.

## Distribution: connect an agent, command line tool, updates (hd-distribution)

`docs/evidence/hd-distribution/` holds three live runs, all headless, on synthetic data, with a sandbox `HOME`:

- `connect/` is `.agents/skills/verify-harbordeck/scripts/connect-walk.sh` on `hdv launch --empty`, 15/15 PASS. It covers:
  - the first-run setup
  - Install and Uninstall Command Line Tool
  - Claude Code with a stub `claude` (`04-claude.log` holds the exact `mcp add` it received)
  - the status light turning live on an agent write through the installed `hd`
  - firstmate (`install.sh` against a stub home, no launchd)
  - Other agent, then Done
  - the neighbouring flows: a stamp landing in `answers.jsonl`, reload, the Settings Agents and Version rows, Save, the menu

  `transcript.txt` has every command with its exit code.
- `seeded/`: a desk that already has items skips the setup, and stamping is unchanged (2/2 PASS).
- `packaged/` is `scripts/packaged-walk.cjs` on an ad-hoc-signed `Harbor Deck.app` build pointed at a local update feed, 8/8 PASS. It covers:
  - the first run in the built app
  - Install linking the bundle's `hd-app`
  - `hd` running with `PATH=/usr/bin:/bin`, i.e. no Node (`03-hd-without-node.txt`)
  - a 9.9.9 release showing "Harbor Deck 9.9.9 is out." with Download and nothing downloaded (`05`)
  - no release yet: "no release is published yet" (`08`)

## User-test bug batch (hd-ut-bugs)

`docs/evidence/hd-ut-bugs/` is a live headless run of the verify-harbordeck instance (synthetic data, run from a `/tmp` copy) driving each fix as a user would; [`walk.txt`](hd-ut-bugs/walk.txt) is the command log with 24 PASS lines. B1: `2` then `u` back to back writes nothing and the item stays (`01`). B3: after stamping Merge PR 142 and the logo, Launch pricing stays in the board-app lane with only its topic mate, and the rel-linked Competitor scan keeps its own row (`02`). B2: a decision, a review on the same topic and a rel-linked report: the sheet leaves the unopened review unticked and one Space writes only the `decide` line (`03`); the seed sheet before and after opening the review with `j` (`04`, `05`). B4: the refused-drop toast, then after `×` the pad keeps focus and takes typing, a digit included (`06`, `07`). B5: at 1440 px with an order queued, the low Backup week window leads, the healthiest fold into `+2`, nothing is cut (`08`).

## Desk flow batch (hd-ut-flow)

`docs/evidence/hd-ut-flow/` is a live headless run of `.agents/skills/verify-harbordeck/scripts/flow-walk.sh` on the verify-harbordeck instance (synthetic data, run from a `/tmp` copy): the scene following the item at the desk (`01`), All kept after arrows, the scene arrow and N (`02`), ticket wording `new reply` / `awaiting reply` (`03`), T on the newest reply (`04`), the first Space opening an unread reply (`05`), three quick Spaces clearing three notices (`06`) and the one-line empty list (`07`), the manifest staying on the desk (`08`), a note slip keeping its draft (`09`), the phone keeping its dial with the draft (`10`), Inspect Match held for undo (`11`), the rail's overflow cue in its own gutter (`12`), and the keep-awake notice for a far timed order (`13`). `walk.txt` is the step results, `cli-transcript.txt` the `hd --help` / `--version` / `--opt-art` checks, `bridge-dry-run.txt` the bridge routing (no `match:` note).

## Later: pick a date, the Parked shelf, honest counts (hd-ut-later)

`docs/evidence/hd-ut-later/` is a live `hdv` run (headless, synthetic seed, run from a `/tmp` copy) driven by [`drive.sh`](hd-ut-later/drive.sh), 19/19 PASS ([`results.txt`](hd-ut-later/results.txt), commands in [`transcript.txt`](hd-ut-later/transcript.txt)): a click on the Later stamp opens the Later slip with Tomorrow morning, After the next usage reset and a date and time (`01`); a picked 14:30 three days out, Shift+S and S each write the exact `until`; the Parked shelf above the storage box lists the three with their return times while the sill reads `16 to zero · 3 parked` (`02`); Bring back now puts one at the desk and writes nothing (`03`); with everything else resolved the window reads `⚑ Zero waiting anywhere · 2 parked` and `Zero waiting · 2 parked` (`04`); the shelf survives a reload; plain mode lists `Parked for later (2)` (`05`). The bridge, run live against a stub firstmate home, sends the exact local time in the hold reason and a `--until` date rounded up so it never lifts early ([`bridge-received.txt`](hd-ut-later/bridge-received.txt)).
