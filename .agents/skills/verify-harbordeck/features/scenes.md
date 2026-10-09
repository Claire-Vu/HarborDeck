# Scenes

The big top window shows one scene per item kind, over the harbor sky: Signpost Square (decisions), Customs Shed (reviews), Bottle Cove (dispatches) and Notice Board (to-dos). Every open item of the kind is one figure (one waiting person per open decision); a figure opens its item at the desk, and a settled one leaves the scene. Each scene has one quirk (hover the name), an empty scene says all clear, and a meter with per-scene pips along the window sill shows how far the desk is from zero. The arrows and the scene name + count sit on the glass; Left/Right arrows or the on-screen arrows flip scenes; the kind chips below the crew yard jump to theirs. The visitor at the desk speaks in a bubble under the name.

## Sub-features

- `scene-count` `#scenes[data-scene][data-count]`; `#scenes .sc-fig:not(.leaving)` count = the kind's chip count = `.sc-count`.
- `scene-flip` `ArrowLeft`/`ArrowRight` and `.sc-arrow.prev|.next` cycle decision → review → answer → todo and wrap; the matching `#filters .chip` is pressed; the desk item does not change.
- `scene-index` clicking a kind chip, a `.sc-pip` or `.sc-go` (shown when empty) jumps to that scene.
- `scene-open` clicking `.sc-fig` puts its item on the desk (`.sc-fig.at-desk`); an item away on an ask is `.sc-fig.away`.
- `scene-leave` a resolving stamp leaves a `.sc-fig.leaving` ghost for ~1 s; `u` brings the figure back.
- `scene-quirks` decisions: `.placard` with option letters, `★` on the recommended one; reviews: `.sc-fig.flagged .pennant` when a standing order is flagged; dispatches: `.sink1`/`.sink2` with age; to-dos: `.soon` flutters within a day, `.overdue` pinned red.
- `scene-zero` `.sc-clear` reads `All clear`; `.sc-left` reads `<n> to zero` (`Zero waiting` at zero) plus paused crew; `.sc-pip.clear` per empty scene.

## How to get to it (user POV)

- Open the office; the scene fills the window at the top of the left column.
- Press `←`/`→` (not while typing, not on a desk radio) or click the arrows beside the scene name.
- Click a kind chip or a pip under the meter.

## Driving it with hdv + ui.mjs

Preconditions:

- Baseline instance, office opened, doctor `ok`.

- **Before.** Run `$H capture scenes before`. `$U eval "document.querySelector('#scenes').dataset.scene + ' ' + document.querySelectorAll('#scenes .sc-fig').length"` prints `decision <n>` with `<n>` equal to the `Decisions` chip count.
- **Flip.** `$U press ArrowRight`; `#scenes[data-scene=review]` and `.sc-name` reads `Customs Shed`. `$U click --css '#scenes .sc-arrow.prev'` returns to `decision`.
- **Open + leave.** `$U click --css '#filters .chip' --text 'Notices'`, then `$U click --css '#scenes .sc-fig'`; the desk title is that notice. `$U press 1`; `$U wait --css '#scenes .sc-fig.leaving'`; the figure count drops by one and the `answers.jsonl` line lands after the hold.
- **All clear.** Stamp the remaining notices the same way; `$U wait --css '#scenes .sc-clear' --text 'All clear'`; `$U click --css '#scenes .sc-go'` jumps to the next busy scene.
- **After.** Run `$H capture scenes after`.

## Gotchas

- Flipping a scene also sets the queue filter to that kind, so `N` walks only that kind; click `All` to widen it again.
- A kind chip with zero items is hidden; reach an empty kind with its `.sc-pip` or the arrows.
- Arrow keys do nothing while a modal or the phone is open.
- Arrow keys inside the ticket rail still move between tickets; they flip scenes only outside it.
