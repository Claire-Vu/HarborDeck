# Living harbor

The window scene carries desk status with no extra keys: one boat per open task (sail size by question count) that sails out once its task is settled, the project's recurring regular at the window with a mood and a one-line memory, a ship cat on the most urgent visitor outside, sky and weather from the real clock and the lowest stamina, and a tide line rising toward the next refill. Quick clearing stamps build a tidy run; cash buys cosmetics in the chandlery; milestones fill a stamp book; the shore town grows with days at the desk; `L` shows the ships-out recap; the harbor music adds a layer per item cleared today.

## Sub-features

- `harbor-boats` one `#sc-boats .hb` per open task (topic, else id without `.qN`), up to 8; `.window-frame[data-boats]` holds the full count; a settled task leaves a `.hb.sailing` ghost that sails out.
- `harbor-sky` `.window-frame[data-phase=night|dawn|day|dusk]` from the local hour; `[data-weather=fair|cloudy|rain]` from the lowest stamina (rain below 20 %).
- `harbor-tide` `#sc-tide text` reads `high tide <time>` (or `⚑ beat the tide`); the top bar `#stamina-cluster .mini-sub` shows a wave glyph and `↻ <refill>` per window, no bars.
- `harbor-regulars` with no crew on the item, the visitor is the project's regular; `#at-window .speech small.memory` reads `<Trade Name>: <memory>`.
- `harbor-cat` `#pier-queue .pq.urgent .ship-cat` on the most urgent waiting visitor; `.ship-cat.on-pier.nap` when nobody waits.
- `harbor-run` `#run` shows `×N tidy run` for resolving stamps within 8 s; `u` hides it; bundle stamps never count.
- `harbor-book-shop` cash chip or `b` opens `.modal.chandlery-modal`: `.sb-stamp` (`.got` when earned), `.shop-row` buy buttons; badge toast `New stamp in your book: …` (small corner chip).
- `harbor-tide-goal` clearing every present item before the shortest window's refill pays a `.cash-pop` (+$50) once per tide, no toast.
- `harbor-recap` `l` opens the `Ships out` modal: `.recap-boat` per task cleared today, `.recap-tally`, `details.logbook` with the full report; `Close the day` as before.
- `harbor-town` `#sc-town .bldg` count = floor(days the office opened / 2).
- `harbor-music` with music on, layers follow items cleared today; a rising chime when the harbor clears (listen; no DOM handle).

## How to get to it (user POV)

- Open the office and look at the window; stamp items with `1`-`4` as usual.
- Click the cash chip in the top bar, or press `b`.
- Press `l` (or the Ships out top bar button).

## Driving it with hdv + ui.mjs

Preconditions:

- Baseline instance, office opened, doctor `ok`; fresh profile (stamp book empty, till $0).

- **Before.** Run `$H capture harbor before`. `$U eval "document.querySelector('.window-frame').dataset.boats"` prints the boat count; `$U eval "document.querySelector('.window-frame').dataset.phase"` matches the local hour.
- **Regular and cat.** `$U text --css '#at-window .speech small.memory'` prints `…: First time at your window.`; `$U wait --css '#pier-queue .pq.urgent .ship-cat'` succeeds.
- **Sail out + run.** `$U press 1`, then `$U wait --css '#sc-boats .hb.sailing'`; data-boats drops by one when that task had one item. Press `1` again within 8 s after the next item reaches the desk: `$U wait --css '#run' --text '×2 tidy run'` (the badge appears after the stamp lands, ~0.4 s). `$U press u`: `#run` loses `show`.
- **Book and shop.** After the hold, `$U wait --css '.toast' --text 'First stamp'`. `$U press b`; `$U text --css '.modal.chandlery-modal .sb-stamp.got'` lists `First stamp`. Buy with `$U click --css '.modal.chandlery-modal .shop-row' --text 'Dock lamp'` only via its button: `$U click --role button --name '$40'`; the row then reads `owned` and `#sc-lamp rect` exists.
- **Recap.** `$U press Escape`, `$U press l`; `$U wait --css '.modal.ledger .recap-boat'`; `$U text --css '.recap-tally'`.
- **Weather.** `echo '[{"name":"Solo","window":"5h","used_pct":95,"resets_at":'$(( $(date +%s)+3600 ))'}]' | $H hd quota -`; `.window-frame[data-weather]` becomes `rain` and `#sc-tide text` shows `high tide 1h …`.
- **After.** Run `$H capture harbor after`. Proof of a stamp stays the `answers.jsonl` line; the harbor writes nothing to the data dir (its state is local desk storage).

## Gotchas

- Desk state (till, owned items, stamp book, day count) is per profile; `$H cleanup && $H launch` resets it. There is no CLI to set cash: earn it by stamping (the overdue P1 notice pays $75).
- The sky follows the machine clock, so the expected phase must be computed at assertion time.
- The window scene is `aria-hidden`; assert through the ids/classes above, not the ARIA snapshot.
- The `.hb.sailing` ghost lives ~2 s; wait for it right after the stamp.
