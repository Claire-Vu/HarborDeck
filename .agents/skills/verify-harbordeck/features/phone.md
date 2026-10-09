# Ship phone

A person brings up the ship phone with the phone shortcut (default `⇧⌘Space`, a setting) or the speaking-tube icon in the top bar; it takes the middle of the desk with the pad focused. They dial a first mate, type, and `Enter` writes the same `request` line as the Requests tab; the phone hangs up with a check on the icon. `Esc` or the shortcut hangs up and keeps an unsent draft. From another app the same shortcut brings Harbor Deck forward with the phone open.

## Sub-features

- `phone-open` shortcut or `#btn-phone` opens `#phone` centered, `.phone-pad` focused, `#btn-phone[aria-expanded=true]`; shortcut again or `Esc` closes it.
- `phone-dial` `1`-`9` and arrows dial while the pad is empty (digits type once speaking); `Cmd/Ctrl+1`-`9` any time; click a `.dial-pos`. The lit position is `[aria-checked=true]`; the last dialed is remembered (shared with the Requests tab).
- `phone-send` `Enter` writes `{"id":"req-…","action":"request","note","to"}` at once (no undo hold); `Shift+Enter` is a new line; `#btn-phone.sent` cue, `Order handed to …` toast, an `ORDER` ticket on the rail.
- `phone-modal` while the phone is up, desk keys (`1`-`4` stamps, `n`, `t`…) never reach the desk.
- `phone-setting` Settings → Phone shortcut changes the key in the app and system-wide; the note under it says `Taken by another app` when the system-wide registration failed.
- `phone-global` the system-wide hotkey brings the window forward with the phone open (the only thing that raises the window).

## How to get to it (user POV)

- `⇧⌘Space` (Ctrl+Shift+Space off macOS) anywhere in the app.
- The speaking-tube icon, first in the top-bar tools.
- `⇧⌘Space` from any other app (system-wide; not registered in headless runs).

## Driving it with hdv + ui.mjs

Preconditions:

- Baseline instance, office opened, doctor `ok`.

- **Open.** Run `$U press Meta+Shift+Space`, then `$U eval 'document.activeElement.className'` prints `phone-pad`; `$U shot` shows the phone centered.
- **Dial and send.** Run `$U press 2`, `$U fill --css '.phone-pad' --value 'hdv phone order'`, `$U press Enter`. `answers.jsonl` ends with `{"action":"request","note":"hdv phone order","to":"mate-web",...}`; `$U wait --css '#rail .ticket.waiting' --text 'hdv phone order'`.
- **Hang up keeps the draft.** `$U press Meta+Shift+Space`, `$U fill --css '.phone-pad' --value 'draft'`, `$U press Escape`, reopen: `$U eval 'document.querySelector(".phone-pad").value'` prints `draft`; the dial is still on `mate-web`.
- **Delivery to firstmate.** `npm run test:roundtrip` drives the phone over the live bridge and asserts the stub firstmate inbox received the order (`PASS: phone order … reached firstmate`).
- **Proof.** Run `$H capture phone after` and keep the `answers.jsonl` line.

## Gotchas

- Headless runs never register the system-wide shortcut, so `phone-global` is proven by the smoke test's main-process seam (`app.emit('harbor:phone-hotkey')`) and by hand on a visible build; `ui.mjs press` reaches the in-app path only.
- `ui.mjs fill` replaces the pad, so dial before filling; a digit typed into a non-empty pad is text, not a dial.
- The request id is minted from the time and note; read it from `answers.jsonl`.
