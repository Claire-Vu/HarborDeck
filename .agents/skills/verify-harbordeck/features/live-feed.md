# Live agent writes

Agents write items and snapshots into the data directory at any time, and the running desk shows them without a restart or refresh.

## Sub-features

- `live-cli-item` `hd decision|answer|review|todo` adds an item to the queue.
- `live-batch` one `hd batch` adds several items, all-or-nothing.
- `live-rewrite` writing an existing id updates it in place and reopens it.
- `live-resolve` `hd resolve <id>` takes it out of the queue into the Archive (menu `M` → `Archive`, `#btn-vault`).
- `live-file` a raw `items/<id>.json` written by any process appears too.
- `live-snapshots` `hd quota -` and `hd fleet -` update stamina chips (features/stamina.md) and crew sprites.
- `live-invalid` an unreadable item file is skipped and listed in Settings; the desk keeps working.

## How to get to it (user POV)

- Nothing to do: keep the desk open while the agent writes.
- The `All` chip count and the queue update; the Archive (in the menu) lists resolved items.
- Stamina bars sit in the top bar; crew sprites in the galley/pier.

## Driving it with hdv + ui.mjs

Preconditions:

- Baseline instance, office opened, doctor `ok`.
- No item id starts with `hdv-`.

- **Before.** Run `$H capture live-feed before`.
- **CLI item.** Run `$H hd decision hdv-palette "Which palette for the launch page?" -s "Warm tested better." --opt warm+ --opt cool -p 1`. Stdout is `ok decision hdv-palette`; `$U wait --css '#queue li' --text 'Which palette'` succeeds.
- **Batch.** Run `printf '%s\n' 'todo hdv-renew "Renew the maps API key" -d +3d' 'answer hdv-note "Hosted DB note" -s "Neon fits."' | $H hd batch`. Two `ok` lines; both titles appear in `#queue li`.
- **Resolve.** Run `$H hd resolve hdv-note`. `$U wait --css '#queue li' --text 'Hosted DB note' --gone` succeeds; `items/hdv-note.json` has `"status": "resolved"`; `$U click --css '#btn-menu'`, `$U click --css '#btn-vault'`, `$U text --css '#vault'` lists `Hosted DB note`, `$U press Escape`.
- **Raw file.** Write `{"id":"hdv-raw","kind":"todo","title":"Raw file item","created":<now>,"status":"open"}` to `$HDV_HOME/items/hdv-raw.json`. `Raw file item` appears in the queue.
- **Snapshots.** Remove a leftover `$HDV_HOME/schedule/rate-limits.json` (a status-line snapshot adds `Claude` chips), then run `echo '[{"name":"Solo","window":"5h","used_pct":95,"resets_at":'$(( $(date +%s)+3600 ))'}]' | $H hd quota -`. `$U eval 'document.querySelectorAll("#stamina-cluster .mini-sub").length'` prints `1`.
- **Fleet.** `echo '{"crew":[{"id":"hdv-c1","state":"working","task":"x"}]}' | $H hd fleet -` prints `ok fleet`; a few seconds later `$U eval 'document.querySelectorAll("#yard .yc.cook").length'` prints `1`.
- **Proof.** Run `$H capture live-feed after`; `after.state/items.tsv` lists the `hdv-` items with their status.

## Gotchas

- The watcher debounces; wait on the queue, not a sleep.
- The CLI resolves relative `-b`/`-a` paths against its cwd and only warns on a missing file.
- `hd quota`/`hd fleet` validate first; a schema error writes nothing (check the exit code).
