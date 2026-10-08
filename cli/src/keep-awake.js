// macOS keep-awake: hold exactly one `caffeinate -i -t <secs>` assertion. Idle system sleep is
// blocked, the display may still sleep. It ends on its own at `until`, so a crashed scheduler never
// keeps the Mac up for good; each sync extends, replaces or kills it. No sudo, no pmset.
// caffeinate -i does not prevent sleep when the lid is closed on battery.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { writeAtomic } from './store.js';
import { fmtTime } from './when.js';

export const AWAKE_SLACK = 300;

export const awakeOps = (env) => ({
  bin: env.HARBORDECK_CAFFEINATE || 'caffeinate',
  // Only ever kill a pid that is still our caffeinate (pids get reused).
  alive(pid, bin) {
    const r = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
    const cmd = (r.stdout || '').trim();
    return r.status === 0 && cmd.includes(path.basename(bin)) && / -i -t \d+/.test(cmd);
  },
  start(bin, secs) {
    const c = spawn(bin, ['-i', '-t', String(secs)], { detached: true, stdio: 'ignore' });
    c.on('error', () => { /* no caffeinate here */ });
    c.unref();
    return c.pid;
  },
  stop(pid) { try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ } },
});

// file: where { pid, until } is kept. until: wanted end (epoch), or null to release.
// Returns the assertion now held, or null.
export function holdAwake(file, until, t, ops, log) {
  let cur = null;
  try { cur = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* none */ }
  const held = cur && cur.pid && cur.until > t && ops.alive(cur.pid, ops.bin) ? cur : null;
  if (!until) {
    if (held) { ops.stop(held.pid); log(`keep-awake released (pid ${held.pid})`); }
    if (cur) fs.rmSync(file, { force: true });
    return null;
  }
  if (held && Math.abs(held.until - until) < 60) return held;
  if (held) ops.stop(held.pid);
  const pid = ops.start(ops.bin, until - t);
  if (!pid) { fs.rmSync(file, { force: true }); return null; }
  const next = { pid, until };
  writeAtomic(file, JSON.stringify(next) + '\n');
  log(`keep-awake until ${fmtTime(until)} (caffeinate -i pid ${pid})`);
  return next;
}
