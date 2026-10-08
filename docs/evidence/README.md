# Live-feed evidence

Recorded by `test/evidence/run.sh demo` with the ystack evidence runner: the real Electron app, with synthetic data and a stub firstmate home, and the bridge in echo mode.

1. Open the office.
2. An agent posts two items with one `harbordeck batch`, and they appear in the queue live.
3. Key `1` stamps a decision. After the undo hold, the line lands in `answers.jsonl`, and the bridge logs `printf 'ship-24\tmerge\tMerge\tdone' | fm-captain-hold.sh answers --source harbordeck`.
4. Key `4` sends an ask. It clips to the ticket rail, and the bridge logs `fm-inbox.sh note --request-id hd-db-research-ask-<at> -- ...`.
5. The agent runs `harbordeck reply`, and the ticket turns green.
6. The reply reads on the rail.

![contact sheet](live-feed-sheet.png)

Video: [live-feed.mp4](live-feed.mp4)
