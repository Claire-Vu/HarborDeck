# garden: next steps

Ordered by evidence and measured cost. Each step ends in a verifiable state (`garden check .` passes with a lower baseline).

- The gate runs in `npm test` (`npm run garden`); add it to CI once the repo has one.
- Protect generated/lock files from hand-merging: package-lock.json (.gitattributes merge driver plus CI regeneration check).
- Run `garden hotspots .` once; split the top conflict files and give registries one registration call per feature.
- After every repeated correction run /correct; record the new check as a library rule so the next repo is offered it.
