# Ship phone

A person brings up the ship phone with the phone shortcut (default `⇧⌘Space`, a setting) or the megaphone icon in the top bar; it takes the middle of the desk with the pad focused. They dial a first mate, type, and `Enter` writes one `request` line to `answers.jsonl`; the phone hangs up with a check on the icon. `⌥Enter` (or `Queue for after reset`) and a time plus `Queue at time` hold the order in the scheduler instead (see [Queue for after reset](./scheduler.md)). The agent answers by writing an item whose id is the request id. The phone is the only desk entry point for new orders (plain mode has its own form). `Esc` or the shortcut hangs up and keeps an unsent draft. From another app the same shortcut brings Harbor Deck forward with the phone open.

## Sub-features

- `phone-open` shortcut or `#btn-phone` opens `#phone` centered, `.phone-pad` focused, `#btn-phone[aria-expanded=true]`; shortcut again or `Esc` closes it.
- `phone-dial` `1`-`9` and arrows dial while the pad is empty (digits type once speaking); `Cmd/Ctrl+1`-`9` any time; click a `.dial-pos`. The lit position is `[aria-checked=true]`; the mate of the last send or queue is remembered (a dial without a send is not).
- `phone-send` `Enter` writes `{"id":"req-…","action":"request","note","to"}` at once (no undo hold); `Shift+Enter` is a new line; `#btn-phone.sent` cue, no toast, an order ticket on the rail (text `order`, shown uppercase).
- `phone-queue` `⌥Enter` in the pad or `.phone-q` `Queue for after reset` queues for the reset; `Tab` cycles dial → `Add to…` → pad → the image tray (`Snap desk`, thumbnails) → `Queue for after reset` → input `Send at time` → `Queue at time` (enabled once a time is set; `Enter` in the time field queues). Digits and arrows in the time field never dial. Nothing reaches `answers.jsonl`; a `.ticket.queued` clips to the rail and `#sched-chip` counts it. `#sched-chip` click opens the phone.
- `phone-images` images and **Add to…** on the phone: see [attachments.md](./attachments.md).
- `phone-reply` `hd reply <request-id> "<text>"` creates an `answer` item with that id; the order ticket turns replied.
- `phone-remember` `#phone-rule` ("Remember this", off by default, reset after each send) adds `"rule":true` to the request (standing order); ticking it hands focus back to the pad so `Enter` sends. The same box is on the needs-work/ask/mismatch note slips (`#note-rule`). The order ticket shows a `.tk-pin`; once `rules.json` has an entry with `answer` = the request id, `R` (Standing orders) lists it with a pin and `sent by you`.
- `phone-modal` while the phone is up, desk keys (`1`-`4` stamps, `n`, `t`…) never reach the desk.
- `phone-setting` Settings → Phone → Shortcut: click the keycaps and press the new keys (see [settings.md](./settings.md)); Save changes the key in the app and system-wide; the hint says `Taken by another app` when the system-wide registration failed.
- `phone-global` the system-wide hotkey brings the window forward with the phone open (the only thing that raises the window).

## How to get to it (user POV)

- `⇧⌘Space` (Ctrl+Shift+Space off macOS) anywhere in the app.
- The megaphone icon (`#btn-phone`), first in the top-bar tools.
- `⇧⌘Space` from any other app (system-wide; not registered in headless runs).

## Driving it with hdv + ui.mjs

Preconditions:

- Baseline instance, office opened, doctor `ok`.

- **Open.** Run `$U press Meta+Shift+Space`, then `$U eval 'document.activeElement.className'` prints `phone-pad`; `$U shot` shows the phone centered.
- **Dial and send.** Run `$U press 2`, `$U fill --css '.phone-pad' --value 'hdv phone order'`, `$U press Enter`. `answers.jsonl` ends with `{"action":"request","note":"hdv phone order","to":"mate-web",...}`; `$U wait --css '#rail .ticket.waiting' --text 'hdv phone order'`.
- **Queue at a time.** Run `$U press Meta+Shift+Space`, `$U fill --css '.phone-pad' --value 'hdv queued order'`, `$U press Tab` three times (`Snap desk`, `Queue for after reset`, then `Send at time`), type a time with `$U press` per digit (then `a` where the locale shows AM/PM), `$U press Enter`. `$U wait --css '#rail .ticket.queued' --text 'hdv queued order'`; `$H hd schedule list` lists it; `answers.jsonl` has no such line. Queue-for-reset and delivery: [scheduler.md](./scheduler.md).
- **Agent answers.** Read the request id from the last `answers.jsonl` line, run `$H hd reply <req-id> "Done."`; `$U wait --css '#rail .ticket.replied' --text 'hdv phone order'` succeeds and `items/<req-id>.json` has kind `answer`.
- **Remember this.** `$U press Meta+Shift+Space`, `$U fill --css '.phone-pad' --value 'Never use max effort'`, `$U click --css '#phone-rule'`, `$U press Enter`: `answers.jsonl` ends with `"rule":true`, `$U wait --css '#rail .ticket .tk-pin'`. A send without the box has no `rule` key. On a Needs work slip (`$U press 3`) click `#note-rule` then `Send`; the line lands after the 4 s undo hold. Queue (`Alt+Enter`) keeps `rule` through `$H tick`. Pin the rule: add `{"text":"…","source":"x","answer":"<req-id>"}` to `rules.json`, open Standing orders: `.rule[data-rule=…]` reads `📌 … sent by you`. Bridge: `FM_HOME=<stub> $H`-home `hd-bridge.sh --dry-run` prints `Standing order:` in the note.
- **Hang up keeps the draft.** `$U press Meta+Shift+Space`, `$U fill --css '.phone-pad' --value 'draft'`, `$U press Escape`, reopen: `$U eval 'document.querySelector(".phone-pad").value'` prints `draft`; the dial is still on `mate-web`.
- **Delivery to firstmate.** `npm run test:roundtrip` drives the phone over the live bridge and asserts the stub firstmate inbox received the order (`PASS: phone order … reached firstmate`).
- **Proof.** Run `$H capture phone after` and keep the `answers.jsonl` line.

## Gotchas

- Headless runs never register the system-wide shortcut, so `phone-global` is proven by the smoke test's main-process seam (`app.emit('harbor:phone-hotkey')`) and by hand on a visible build; `ui.mjs press` reaches the in-app path only.
- `ui.mjs fill` replaces the pad, so dial before filling; a digit typed into a non-empty pad is text, not a dial.
- The request id is minted from the time and note; read it from `answers.jsonl`, never guess.
- The seed already has one sent order (`what changed since last visit`); filter tickets by text.
