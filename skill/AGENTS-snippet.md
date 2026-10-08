<!-- Paste into a project's AGENTS.md / CLAUDE.md to connect an agent to HarborDeck. -->
## HarborDeck

The user reviews agent work in HarborDeck. When something needs them, write an item with `hd` (the HarborDeck CLI; `harbordeck` is the same command) instead of a long message:

- `hd decision <id> "<question?>" -s "<one line>" --opt <key>+ --opt <key>` when they must choose (`+` = recommended).
- `hd review <id> "<title>" -s "<one line>" -a <path|url>` when they must judge finished work.
- `hd answer <id> "<title>" -s "<finding>" -b <report path>` when they only need to read it.
- `hd todo <id> "<what>" -d <due>` when only they can do it.
- Several at once: `hd batch` with one command per line on stdin.

Paths and URLs only, never pasted report text; summaries are 1-3 plain sentences. Read replies with `hd answers --cursor <your-name>`; answer `ask`/`comment` lines with `hd reply <id> "<text>"`. If a response fits no kind, run `hd gap "<what didn't fit and why>"`. Run `hd help` for flags.
