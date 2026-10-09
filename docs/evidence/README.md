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

## Stamp art

`docs/evidence/stamp-art/{before,after}/` are headless captures (`HARBORDECK_HEADLESS=1`, `test/smoke/launch.js`, seeded demo data) of the stamp tray (dark, light, hover), a stamp in hand mid-flight, a stamped slip, every ink colour, and the top-bar megaphone (dark, light, open).

## Megaphone colour

`docs/evidence/megaphone/` are headless captures (`HARBORDECK_HEADLESS=1`, `test/smoke/launch.js`, seeded demo data) of the top-bar megaphone in light and dark, magnified 6x: `before` is the pre-stamp-art icon (monochrome), `current` the red/cream drawing that was replaced, `after` the original shape with colour (brown handle, red horn, brass bell rim).

## Paper tray

`docs/evidence/paper-tray/` are headless captures (`HARBORDECK_SHOTS=docs/evidence/paper-tray npx playwright test test/smoke/stow.spec.js`, seeded demo data) of the storage box empty, holding three stowed papers, and its open view of mini paper cards.

## Pixel-block stamps

`docs/evidence/stamp-pixel/` are headless captures (`test/smoke/launch.js`, seeded demo data) of the stamp tray (`2-tray`, `1-tray-desk`), the Approve stamp pressed (`3-pressed`), a stamp in hand (`4-in-hand`), the five impressions on the decision slip (`5-impression-*`) and the narrow tray (`6-phone-tray`).
