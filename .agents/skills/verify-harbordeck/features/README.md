# Harbor Deck verification map

This directory is the maintained source for verifying Harbor Deck's user-facing behavior. Read this index before driving the app, then use the matching feature file as the recipe. `H` and `U` below are `.agents/skills/verify-harbordeck/scripts/hdv` and `.../ui.mjs`, as in the skill.

## Baseline preconditions

- Launch with `$H launch` (seeded synthetic data dir, no pretend agent) and require every `$H doctor` line to be `ok`.
- `eval "$($H env)"` in the shell that drives, so `ui.mjs` and chrome-devtools-axi reach this instance only.
- Seed state: 20 items (19 open), among them `Merge PR 142 (calmer checkout)?` (`pr-142-checkout`, decision, recommended `merge`), `Pick a logo direction` (`logo-direction`), `Quarantine the flaky drag-and-drop test?` (`flaky-e2e`), `Newsletter #6 draft` (`newsletter-6`, its ask already replied), `Review the offline-mode plan` (`plan-offline`, a `web` artifact on the run's loopback demo page `$HDV_SITE`), the question sheet `beta-invites.q1`-`q3` (topic `beta-invites`, options with `why` lines, q1 carries the local report `assets/beta/waves.html`); 2 answer lines; first mates `mate-main` (First Mate), `mate-web`, `mate-growth`; quota windows below 100 %.
- A fresh profile opens on the `Morning manifest` dialog. Every recipe starts with `$U click --role button --name 'Open the office'` (or `$U press ' '`).
- Never drive an instance this run did not launch. Never run a bare `hd`; use `$H hd`.

## Driving conventions

- UI actions go through `ui.mjs` with an ARIA role + name or the app's ids/classes listed in the skill. Never click chrome-devtools-axi `@uid` refs (the desk re-renders every second).
- Agent actions go through `$H hd`, scheduler delivery through `$H tick`. Wait on visible state (`$U wait ...`) and on files, never on a fixed sleep, except the 4 s undo hold.
- The left column has no tabs: the scene window, the crew yard, the kind chips and the queue are always there. A kind chip filters the queue; click `All` to see every item.
- Select the item you mean (`$U click --css '#queue li' --text '<title>'`) before every stamp key; the desk moves on after a stamp.
- Use ids prefixed `hdv-` for anything you create, so it never collides with seed ids.
- Restart from baseline (`$H cleanup && $H launch`) instead of undoing mutations by hand.

## Proof and skip reporting

- UI proof: `$H capture <feature> before|after` (screenshot + ARIA snapshot + data-dir state) around the action.
- CLI proof: the command, stdout, stderr and exit code, saved under `$H evidence <feature>`.
- Mutation proof: a second view of the stored value: the `answers.jsonl` line, `items/<id>.json`, `scheduler.json` or `wake.log`, not only the screen.
- Record the feature ID and entry point with every artifact in `proof.md`.
- Report an unreachable path with the attempted command and the unmet precondition. Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior, then exactly four H2 sections in this order: `Sub-features` (short IDs, one line each), `How to get to it (user POV)` (every entry point), `Driving it with hdv + ui.mjs` (starts with `Preconditions:`, then labeled bullets pairing each user action with an exact command and observable result), `Gotchas`. Keep implementation details out; name only user paths, stable handles, required state, commands and observable proof.

## Features

- [Quick calls](./quick-call.md) covers letter keys + Space, question sheets, why lines, Later/defer, take all recommended, lanes and weights, paper layout, local HTML in the pane, the lean manifest, rail scrolling and the stamp tray.
- [Review tools](./review-tools.md) covers who's waiting (badge, queue lift, `hd waiting`, the firstmate fleet fill), what changed (updated marks, only-new highlights, cleared once seen) and Cmd/Ctrl+K search.
- [Stamp items](./stamp.md) covers stamping each kind by key and tray, the undo hold, and the line in `answers.jsonl`.
- [Stamina](./stamina.md) covers the top bar usage chips: % left per window, countdowns, run-out warning, per-model windows, stale readings, quota.json vs the Claude Code status line.
- [Live agent writes](./live-feed.md) covers CLI and file item writes, resolve, and fleet/quota snapshots appearing on the running desk.
- [Ask and reply](./ask-reply.md) covers the ask slip, the waiting ticket, the agent's `hd reply`, and reading it on the rail.
- [Image attachments](./attachments.md) covers pasting, dropping and snapping images onto the phone and the Ask / Needs-work / Mismatch slips, the markup (pins, boxes, arrows, notes), the `attachments` answer field, thumbnails on the rail, queueing with images, Add to… (a comment on running work) and the bridge's `Attached:` relay.
- [Ship phone](./phone.md) covers the phone shortcut and header icon, dialing a first mate, sending with Enter, queueing for the reset or a time, the agent answering a request id, hanging up, and the shortcut setting.
- [Browser pane](./browser-pane.md) covers web/lavish artifact cards, the in-desk page, its controls, and the refusal of off-machine pages.
- [Scenes](./scenes.md) covers one scene per kind with a figure per open item, arrow and chip navigation, figures leaving on a stamp, the per-scene quirks and progress to zero.
- [Storage box](./storage-box.md) covers stowing desk papers (control, `X`, drag onto the box), the count, restoring one or all, and persistence across reloads.
- [Living harbor](./harbor.md) covers boats per task, sky/weather/tide, regulars, the ship cat, tidy runs, stamp book + chandlery, beat the tide, the ships-out recap, the town and music layers.
- [Queue for after reset](./scheduler.md) covers queuing from the app and the CLI, the countdown ticket and chip, keep-awake, withdraw, and delivery by `tick` with the stub wake.

Not yet mapped (add a file when they ship or need proof): Settings (data directory, artifact root, on-answer hook), Inspect mode (claim/evidence `comment` lines), plain mode, archive, standing orders drawer, demo mode (`$H launch --demo`), the `harbor://` media protocol, the MCP server (`hd mcp`), topics, Settings → Web hosts.
