# Scenes

The big top window shows one scene per item kind, over the harbor sky: Signpost Square (decisions), Customs Shed (reviews), Bottle Cove (research, kind `answer`) and Notice Board (to-dos). Every open item of the kind is one figure (one waiting person per open decision); a figure opens its item at the desk, and a settled one leaves the scene. Each scene has one quirk (hover the name), an empty scene says all clear, and a meter with per-scene pips along the window sill shows how far the desk is from zero. The arrows and the scene name + count sit on the glass; Left/Right arrows or the on-screen arrows flip scenes; the kind chips below the crew yard jump to theirs. The visitor at the desk speaks in a bubble under the name: the question clamps to two lines and the speaker line ellipsizes, full text on hover. Every word on the glass sits on a solid plate: title, arrows, the tide bar and the sill along the bottom, and the all-clear card parked just above them, so nothing reads over the boats.

## Sub-features

- `scene-count` `#scenes[data-scene][data-count]`; `#scenes .sc-fig:not(.leaving)` count = the kind's chip count = `.sc-count`.
- `scene-follow` the window always shows the scene of the item at the desk: clicking a queue row, a search hit, a ticket's `Open item`, `N` or the auto-advance after a stamp flips `#scenes[data-scene]` to that item's kind.
- `scene-flip` `ArrowLeft`/`ArrowRight` and `.sc-arrow.prev|.next` cycle decision → review → answer → todo and wrap; the front of that scene's line comes to the desk (none when the scene is empty). With `All` pressed the list stays `All` (the window flips, the list does not); with a kind chip pressed the filter moves along with the scene.
- `scene-line` figures stand single file toward the desk (right), the one at the desk first (`.sc-fig.at-desk`, a step ahead); the line is P1 first, then oldest, then anyone sent back, then anyone away. With a kind shown, `#queue` lists that line (no lanes).
- `scene-back` key `W` or `.paper.manifest .back-btn` (`Back of the line`) moves the desk item to the end of its line and calls the next; writes nothing to `answers.jsonl`; marks clear when the office opens a new day.
- `scene-walk` `N` / `#btn-next` steps to the one behind the desk item in the list shown; with a kind chip pressed, past the end, the next busy scene's front; else back to the front. `All` stays `All`.
- `scene-index` clicking a `.sc-pip` or `.sc-go` (shown when empty) jumps to that scene and calls its front of the line (the list filter as for the arrows); a kind chip also narrows the list to that kind.
- `scene-open` clicking `.sc-fig` puts its item on the desk (`.sc-fig.at-desk`); an item away on an ask is `.sc-fig.away`.
- `scene-leave` a resolving stamp leaves a `.sc-fig.leaving` ghost for ~1 s; `u` brings the figure back.
- `scene-quirks` decisions: `.placard` with option letters, `★` on the recommended one; reviews: `.sc-fig.flagged .pennant` when a standing order is flagged; research: `.sink1`/`.sink2` with age; to-dos: `.soon` flutters within a day, `.overdue` pinned red.
- `scene-zero` `.sc-clear` (a solid plate above the tide bar) reads `All clear`; `.sc-left` reads `<n> to zero` (`Zero waiting` at zero) plus parked items (`· <k> parked`) and paused crew; `.sc-zero` adds `· <k> parked` too, so zero never hides parked work; `.sc-pip.clear` per empty scene.

## How to get to it (user POV)

- Open the office; the scene fills the window at the top of the left column.
- Press `←`/`→` (not while typing, not on a desk radio) or click the arrows beside the scene name.
- Click a kind chip or a pip under the meter.

## Driving it with hdv + ui.mjs

Preconditions:

- Baseline instance, office opened, doctor `ok`.

- **Before.** Run `$H capture scenes before`. `$U eval "document.querySelector('#scenes').dataset.scene + ' ' + document.querySelectorAll('#scenes .sc-fig').length"` prints `decision <n>` with `<n>` equal to the `Decisions` chip count.
- **Follow.** `$U click --css '#queue li' --text 'Review the new dashboard'`; `#scenes[data-scene=review]`. `$U click --css '#queue li' --text 'Renew the domain'`; `#scenes[data-scene=todo]`. `#filters .chip[aria-pressed=true]` still reads `All`.
- **Flip.** `$U click --css '#queue li' --text 'Merge PR 142'`, `$U press ArrowRight`; `#scenes[data-scene=review]`, `.sc-name` reads `Customs Shed`, the desk title is the scene's front figure, and `#filters .chip[aria-pressed=true]` still reads `All` with the same row count. `$U click --css '#scenes .sc-arrow.prev'` returns to `decision`.
- **Open + leave.** `$U click --css '#filters .chip' --text 'Notices'`, then `$U click --css '#scenes .sc-fig'`; the desk title is that notice. `$U press 1`; `$U wait --css '#scenes .sc-fig.leaving'`; the figure count drops by one and the `answers.jsonl` line lands after the hold.
- **All clear.** Stamp the remaining notices the same way; `$U wait --css '#scenes .sc-clear' --text 'All clear'`; `$U click --css '#scenes .sc-go'` jumps to the next busy scene.
- **Back of the line.** `$U press w`; the desk title becomes the second in line, that title is now last in `#queue`, and `answers.jsonl` is unchanged.
- **Walk.** With `All` pressed, `$U press n` repeatedly walks the whole list in order (the window follows each visitor) and `All` stays pressed. With a kind chip pressed it visits every figure once, then flips to the next busy scene.
- **After.** Run `$H capture scenes after`.

## Gotchas

- Flipping a scene replaces the desk item with the front of its line but never narrows an `All` list; only a kind chip narrows it (then arrows move that filter along; click `All` to widen it again).
- A kind chip with zero items is hidden; reach an empty kind with its `.sc-pip` or the arrows.
- Arrow keys do nothing while a modal or the phone is open.
- Arrow keys inside the ticket rail still move between tickets; they flip scenes only outside it.
