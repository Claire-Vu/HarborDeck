# Image attachments, Snap and markup, Add to…

A person pastes (`⌘V`) or drops an image on the ship phone or on an Ask, Needs-work or Mismatch slip, or presses `Snap desk` to capture this window without its overlays. The main process copies the bytes at once into `<home>/attachments/<yyyy-mm>/<sha256:10>.<ext>` (0600; PNG, JPEG, WebP or GIF by magic bytes, at most 15 MB, never SVG), so nothing depends on a temp file. A thumbnail sits under the pad; clicking it opens the markup (`#markup`): numbered pins with a note each, boxes (numbered too), arrows, Undo. `Done` writes a flattened marked PNG the same way. The answer line carries `attachments: [{type, path, marked?, source, w, h, marks?}]` and the pin notes join `note` as `[1] …`. **Add to…** on the phone (off by default) aims the message at the item at the desk or a running order or ask on the rail: it goes out as a `comment` on that id (queueing is off while aimed); `×` goes back to a new order. The firstmate bridge appends `Attached: <marked or path>, …` to the inbox note.

## Sub-features

- `att-paste` paste an image into `.phone-pad` or `.modal.noteslip textarea`: `.att-thumb[data-path]` appears; the file exists under `<home>/attachments/` with mode 0600 and the exact bytes.
- `att-drop` drop an image on `#phone .phone-box` or the slip box (`.att-drop` outline while over); a non-image shows `.toast.warn` `Only PNG, JPEG, WebP or GIF…` and attaches nothing. A file dropped anywhere else never navigates the window.
- `att-send` `Enter` (phone) / `⌘Enter` (slip): the line has `attachments`; an image alone sends `See the attached image.`; the tray empties after sending; a phone hung up keeps its images like the draft.
- `att-rail` a sent order shows `.tk-att` `🖼 N` on its ticket; the ticket pop (`.tk-pop .att-mini img`) and the item's correspondence show thumbnails (marked copy first), served through `harbor://`.
- `att-snap` `Snap desk` (`.att-snap`) captures the window with `body.snapping` hiding the phone, slips, popovers, toasts and menu; the markup opens straight away. `source: "snap"`, `w`,`h` in device pixels.
- `att-markup` `.mk-tool[data-tool=pin|box|arrow]` (keys P/B/A), click = pin, drag = box/arrow, `.mk-notes .mk-note` per numbered mark (focused at once), Undo (`⌘Z`), `Done` (`⌘Enter`), `Cancel`/Esc (keys never reach the phone or desk underneath). `.att-n` shows the mark count; the line gets `marked` + `marks` and `note` ends with `[1] … [2] …`.
- `att-queue` `⌥Enter` with images queues them with the order (`schedule/queue/reset-<req>.json` `request.attachments`); `tick` writes them on the delivered line.
- `att-addto` `.addto-btn` `Add to…` → `.addto-list .addto-opt[data-id]` (`.addto-kind`: `at the desk`, `item`, `order`) → `.addto-chip` + `.addto-x`; the queue buttons are disabled while aimed; `Enter` writes `{"id":"<target>","action":"comment","note",...}` with no `to`; reopening the phone starts as a new order.
- `att-bridge` `adapters/firstmate/hd-bridge.sh` notes end `… Attached: <path>[, <path>]. Reply: …`; a keyed decide/approve/reject that carries images also sends the note.
- `att-refuse` `harbor:attach` refuses non-images and oversize; `appendAnswer` refuses an `attachments` path outside `<home>/attachments` (unit tests `test/unit/attach.test.js`).

## How to get to it (user POV)

- `⇧⌘Space` (or the megaphone) → `⌘V` / drop / `Snap desk` / `Add to…`.
- Key `4` (Ask) or `3` (Needs work) on the item at the desk → the slip → `⌘V` / drop / `Snap desk`.
- Inspect (`I`): a claim, then a point, then `Mismatch` → the slip → same tray.

## Driving it with hdv + ui.mjs

Preconditions: baseline instance, office opened, doctor `ok`. Real paste and drop come from the OS, so fire the same DOM events with a synthetic file through `$U eval` (inspection helper; the event is what the OS would deliver):

```bash
FIRE='(sel, kind) => { const b64 = "<base64 of a synthetic PNG>"; const dt = new DataTransfer(); dt.items.add(new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], "shot.png", { type: "image/png" })); const el = document.querySelector(sel); if (kind === "paste") el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); else { el.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true })); el.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true })); } }'
```

- **Paste on the phone.** `$U press Meta+Shift+Space`, `$U eval "($FIRE)('.phone-pad','paste')"`, `$U wait --css '#phone .att-thumb'`; `ls -l $HARBORDECK_HOME/attachments/*/` shows one `-rw-------` PNG. `$U fill --css '.phone-pad' --value 'hdv image order'`, `$U press Enter`; the last `answers.jsonl` line has `attachments[0].path` = that file, `source` `paste`. `$U wait --css '#rail .ticket .tk-att' --text 1`.
- **Refused drop.** Same with a `text/plain` file and kind `drop` on `#phone .phone-box`: `$U wait --css '.toast.warn' --text 'Only PNG'`, thumb count unchanged. Clicking the toast's `×` gives focus back to `.phone-pad` (`$U eval 'document.activeElement.className'` prints `phone-pad`): typing types, digits never dial, `Enter` sends.
- **Snap + markup.** `$U click --role button --name 'Snap desk'`, `$U wait --css '#markup .mk-canvas'`, `$U click --css '.mk-canvas'` (pin at the centre), `$U fill --css '.mk-notes li:nth-child(1) .mk-note' --value '...'`, `$U click --css '.mk-tool[data-tool=box]'`, `$U drag --css '.mk-canvas' --by 330,90`, fill note 2, `$U press Meta+Enter`, `$U wait --css '#phone .att-n' --text 2`, send. Copy the line's `marked` file out and look at it: the marks are drawn in and the phone is not in the picture.
- **Add to….** `$U click --role button --name 'Add to…'`, `$U text --css '.addto-opt'`, `$U click --css '.addto-opt' --text '<item title>'`, fill, `Enter`: the line is a `comment` on that id. Reopen: `$U text --css '.phone-addto'` prints `Add to…`.
- **Slip.** Select an item, `$U press 4`, fire paste on `.modal.noteslip textarea`, fill, `$U press Meta+Enter`, wait 5 s (undo hold): the `ask` line carries the image. Undo (`u`) within the hold writes nothing.
- **Bridge.** With a stub `FM_HOME`, `FM_HOME=<stub> adapters/firstmate/hd-bridge.sh --echo` prints `fm-inbox.sh note … Attached: <path>. Reply: …` per line with images; the live cursor is untouched.
- **Proof.** Screenshots with `$U shot`, the `answers.jsonl` lines, the marked PNG, the bridge echo lines. One full run: `docs/evidence/hd-workflow-mine/`.

## Gotchas

- `ui.mjs drag` starts 20,8 px inside the element's top-left (built for paper grips): use positive `--by` offsets on the canvas; negative ones clamp to the edge.
- `capturePage` can return the last composited frame; the main process invalidates and waits a beat before capturing. `test/smoke/attachments.spec.js` checks a pixel where the phone stood, repeated runs without that wait catch the phone in the snap.
- Same bytes, same file: pasting one image twice (or in two messages) names one path.
- A queued order with images waits for the reset like any other; prove delivery with `cli/test/scheduler.test.js` (`a queued request keeps its attached images`) when the reset is hours away.
