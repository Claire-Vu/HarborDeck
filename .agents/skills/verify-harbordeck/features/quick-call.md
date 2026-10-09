# Quick calls

Clearing the desk takes one keystroke per answer: letter keys pick a decision's option (each with an optional grey "why" line), Space stamps, a task's `<task>.qN` questions arrive as one question sheet settled with one stamp, Later (`S`) parks an item and writes a `defer` line, and Shift+A takes every low-stakes recommendation at once. The queue groups lanes by project with weight icons, papers never overlap or print absolute paths, a local `.html` report opens in the browser pane, the morning manifest shows only what has something in it, the ticket rail scrolls with the wheel, and the stamp tray never overlaps at short heights.

## Sub-features

- `qc-letters` `a`-`e` pick option A-E on the decision at the desk; `.paper.ask label.opt.on` follows; option `.why` lines show under labels.
- `qc-space` Space stamps approve/file (the same line as `1`); Enter never stamps.
- `qc-sheet` items sharing a topic (an id `<task>.qN` gets topic `<task>` from the CLI) show one `.paper.qsheet`: a `.b-row` per item, the focused row `.b-row.cur` is the item at the desk; a letter picks on it and moves to the next row; `j`/`k` move; Space or `Stamp the sheet` writes one line per ticked row. A `rel` link never bundles. The head (the queue row, in its own project lane) is the weightiest member: a decision, then a review, to-do, report; then priority. Decision rows start ticked; a review, report or to-do row starts unticked (`.b-row.skip.unseen`, `<Kind>: not opened yet, open it to include`) until its row has been focused (`j`/`k`, click), so one Space never approves or files unseen work; a hand tick or untick wins. Plain mode's `Approve bundle (N)` counts only opened cards.
- `qc-why` `hd decision ... --why <key>="<line>"` stores `options[].why`; the slip, sheet, plain mode and Shift+A list show it.
- `qc-later` `s` writes `{"action":"defer","until":<tomorrow 09:00>}`; Shift+S until just after the next usage reset; a click on the Later stamp (or Alt+S, or plain mode's Later) opens `.modal.laterslip`: two `.ls-opt` (Tomorrow morning `S`, After the next usage reset `⇧S`, disabled with no reset known) and `.ls-at` (datetime-local) + `Park`, which writes `until` = exactly that local minute; past or invalid times are refused with a toast. The item moves to the queue's `Later` lane (`#queue li.q-later`) and the Parked shelf (`#parked-btn` / `#parked-n` above the storage box; `#parked-view .parked-row[data-id]` with `.pk-when` `back <date> <time>` and `.pk-back` `Bring back now`); a click on either brings it back now, writing nothing (during the undo hold it is the undo). A sheet parks every ticked row.
- `qc-parked-count` parked items are counted, never hidden behind a zero: `#scenes .sc-left` `<n> to zero · <k> parked` / `Zero waiting · <k> parked`, `.sc-zero` `⚑ Zero waiting anywhere · <k> parked`, the manifest's At the window, and plain mode (`Parked for later (<k>)` with Bring back now).
- `qc-sweep` Shift+A opens `.modal.sweep` listing P3-P4 decisions with a recommendation; untick rows; Shift+A again or `Stamp N recommended` writes one `decide` per ticked row; undoable as one; never counts toward a tidy run.
- `qc-lanes` `#queue li.q-lane` headers per project; `.wt[data-weight]` on each row (`video`, `pr`, `report`, `quick`); filter chips with a zero count are hidden.
- `qc-speech` `#at-window .speech` says the ask: the item's title, or `N quick calls on <Topic>` for a sheet.
- `qc-layout` desk papers never overlap; the main artifact (report, image, video, PDF) fills a reading column; a desk too narrow for two columns (small window, stamps open) stacks them full width and scrolls; the papers lay out again when the stamp tray opens or closes; file names only, the full path on hover. The page never scrolls sideways at any window size, tray open or closed (`test/smoke/layout.spec.js`).
- `qc-html` a local `.html` artifact shows as a `.paper.web` card; `Open in the desk browser` opens it in `.modal.web` with its own CSS/JS from the same folder; nothing outside that folder and no hidden files are served.
- `qc-manifest` empty manifest sections are hidden; Space opens the office; at launch the manifest is skipped when nothing changed since `Close the day`.
- `qc-rail` an overflowing ticket rail scrolls with the mouse wheel; `#rail-right` / `#rail-left` show `N more ›` / `‹ N` and page the rail on click.
- `qc-tray` the five tray stamps (Approve, Reject, Needs work, Ask, Later) never overlap at any window height; the tray scrolls when short.
- `qc-bridge` firstmate's bridge maps a `defer` on a held task (or a `<task>.qN` of one) to `fm-captain-hold.sh hold <task> --reason "captain deferred <id> on HarborDeck until <YYYY-MM-DD HH:MM>" --until <date>`, else an inbox note ending `back on the desk <YYYY-MM-DD HH:MM>`. The hold takes a date only and lifts on it, so `<date>` is the first local date at or after `until` (rounded up, never early).

## How to get to it (user POV)

- Open the office with Space on the manifest.
- Select a decision, press a letter, press Space. Seed sheet: `Beta invites: how many in the first wave?` (`beta-invites.q1`-`q3`, `+2` on its queue row).
- Press `s` on any item; find it under `Later` at the bottom of the queue and on the `Parked` tag above the storage box. Click the Later stamp to pick a date and time.
- Press Shift+A anywhere on the desk.
- Agent side: `hd decision <task>.q1 "<question?>" --opt a+ --opt b --why a="<line>"` (no `-t` needed); `hd answer <id> "<title>" -a report:<file.html>`.

## Driving it with hdv + ui.mjs

Preconditions:

- Baseline instance, doctor `ok`, the `Morning manifest` showing.

- **Before.** Run `$H capture quick-call before`.
- **Manifest.** Run `$U press ' '`. The manifest closes; `$U text --css '#desk-surface .paper.manifest h3'` prints a title.
- **Letters + Space.** Run `$U click --css '#queue li' --text 'Quarantine the flaky'`, `$U press b`, `$U text --css '#desk-surface .paper.ask label.opt.on'` prints `B Keep it blocking`; `$U press ' '`; after 5 s the last `answers.jsonl` line is `{"id":"flaky-e2e","action":"decide","key":"keep",...}`.
- **Sheet.** Run `$U click --css '#queue li' --text 'Beta invites'`; `$U text --css '#at-window .speech'` starts `3 quick calls on Beta invites`; `$U press b`, `$U press a`, `$U press c` (each moves `.b-row.cur` down); `$U press ' '`; after 5 s three `decide` lines for `beta-invites.q1`-`q3` with keys `two-hundred`, `waitlist`, `both`.
- **Mixed topic (B2/B3).** `$H hd decision hdv-x1 "Adopt the new font?" --opt yes+ --opt no -t hdv-brand -p 2`, `$H hd review hdv-x2 "Review the brand deck v3" -s "22 slides" -t hdv-brand`, `$H hd answer hdv-x3 "Font licensing costs" --rel hdv-x1 --project other`. The queue shows `Adopt the new font?` with `+1` and `Font licensing costs` on its own row; select the decision: `$U text --css '#desk-surface .paper.qsheet .b-row.skip .b-verb'` prints `Review: not opened yet, open it to include`; `$U press ' '`; after 5 s exactly one new line, `{"id":"hdv-x1","action":"decide","key":"yes",...}`. Seed: `Launch pricing` stays in the `board-app` lane with `+1` (onboarding copy), and `Competitor scan` (rel only) keeps its own row.
- **Why.** `$H hd decision hdv-host.q1 "Host?" --opt edge+ --opt mac --why edge="free tier"`; `jq .options "$HDV_HOME/items/hdv-host.q1.json"` shows `why`, and `.topic` is `hdv-host`.
- **Later.** Select `Renew the domain`, `$U press s`, `$U wait --css '#queue li.q-later' --text 'Renew the domain'`; after 5 s the last line is `{"id":"todo-domain","action":"defer","until":<tomorrow 09:00 local epoch>,...}`.
- **Later slip + Parked shelf.** Select `Renew the domain`, `$U click --css '#stamps .stamp[data-verdict=later]'`, `$U fill --css '.modal.laterslip .ls-at' --value <YYYY-MM-DD>T14:30`, `$U click --css '.modal.laterslip .ls-pick .pbtn' --text Park`; after 5 s the last line's `until` is that local minute. `$U click --css '#parked-btn'`, `$U text --css '#parked-view .parked-row'` lists it with `back <date> 02:30 PM`; `$U text --css '#scenes .sc-left'` ends `· <k> parked`; `$U click --css '#parked-view .parked-row[data-id="todo-domain"] .pk-back'` puts it at the desk and writes nothing. With every other item resolved (`$H hd resolve ...`), `.sc-zero` reads `⚑ Zero waiting anywhere · <k> parked`.
- **Sweep.** `$U press Shift+A`, `$U wait --css '.modal.sweep .sw-row'`, `$U text --css '.modal.sweep .sw-row'` (rows depend on what the steps above left open), `$U press Shift+A`; after 5 s one `decide` line per listed row with the recommended key.
- **Local HTML.** `$H hd answer hdv-html "Invite waves" -p 1 -a report:"$HDV_HOME/assets/beta/waves.html"`, select it, `$U click --role button --name 'Open in the desk browser'`, `$U text --pane --css '#state'` prints `script loaded from the same folder`; `$U click --css '.modal.web [aria-label=Close]'`.
- **Layout + paths.** `$U eval` a pairwise rectangle check over `#desk-surface .paper` returns no overlaps; `$U text --css '#desk-surface'` contains no `$HDV_HOME` path.
- **Rail + tray.** Append 9 `request` lines with `$H hd`-free JSON to `answers.jsonl` (ids `hdv-req-N`); `$U wait --css '#rail-right'` (reads `<n> more ›`); `$U shot tray.png --size 960x600` shows five separate stamps.
- **Proof.** Run `$H capture quick-call after`; save the `answers.jsonl` diff in `proof.md`.

## Gotchas

- Letters, Space, `s`, `j`/`k` and Shift+A do nothing while a modal, the ship phone, a textarea or a text input has focus; Space on the manifest and Shift+A in the sweep list are the two exceptions.
- `B` is option B; the chandlery and stamp book moved to Shift+B.
- A row's option click also moves focus like a letter; assert `.b-row.cur` before the next key.
- Later lines are held for undo like any stamp; the `Later` lane appears at once, the file line after 5 s.
- Bundled items (same topic) ride under their bundle head in the queue, so `click --css '#queue li' --text` cannot reach a member; and after a scene flip the queue shows one kind only (click `All`).
- `test/smoke/quick-call.spec.js` and `test/smoke/later.spec.js` cover every sub-feature headless; `adapters/firstmate/test/run.sh` covers `qc-bridge`.
