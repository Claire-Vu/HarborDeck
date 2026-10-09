#!/usr/bin/env node
import fs from 'node:fs';
import { run } from '../src/main.js';

// Started by the app bundle's hd-app on Electron-as-Node: commands this CLI runs (wake commands, hooks) must not inherit that.
delete process.env.ELECTRON_RUN_AS_NODE;

const code = await run(process.argv.slice(2), {
  out: (s) => process.stdout.write(`${s}\n`),
  err: (s) => process.stderr.write(`${s}\n`),
  // Only commands that take "-" or a batch read stdin, so an interactive shell never blocks.
  readStdin: () => (process.stdin.isTTY ? null : fs.readFileSync(0, 'utf8')),
});
process.exitCode = code;
