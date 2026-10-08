// CLI verbs of the limit-reset scheduler: schedule, limit, tick, scheduler (see docs/SCHEDULER.md).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFlags } from './args.js';
import { SLUG, homeDir, writeAtomic } from './store.js';
import * as sched from './scheduler.js';

const fail = (msg) => { throw new Error(msg); };
const now = () => Math.floor(Date.now() / 1000);
function checkId(id, what) {
  if (!SLUG.test(id)) fail(`bad ${what} "${id}" (letters, digits, . _ -; max 128)`);
  return id;
}


function whenOf(v) {
  if (v === 'reset') return 'reset';
  const t = sched.parseWhen(v);
  if (t === null) fail(`bad time "${v}" (HH:MM, +30m, +2h, YYYY-MM-DD HH:MM, ISO, @epoch or reset)`);
  return t;
}

function showPending(st, ctx) {
  if (!st.pending.length) { ctx.out('nothing pending'); return; }
  for (const i of st.pending) {
    const when = i.due ? sched.fmtTime(i.due) : 'next tick';
    ctx.out(`${i.id} ${i.kind} due ${when}${i.item ? ` item=${i.item}` : ''} ${i.message}`);
  }
}

function cmdSchedule(argv, ctx) {
  const home = ctx.store.home;
  const { pos, flags } = parseFlags(argv, { item: {}, request: { bool: true }, to: {}, json: { bool: true } });
  if (pos[0] === 'list') {
    const st = sched.statusData(home, ctx.env);
    if (flags.json) ctx.out(JSON.stringify(st.pending)); else showPending(st, ctx);
    return 0;
  }
  if (pos[0] === 'cancel') {
    const id = pos[1] || fail('schedule cancel: missing <id>');
    const hits = sched.cancel(home, id);
    if (!hits.length) fail(`schedule cancel: nothing pending for ${id}`);
    for (const h of hits) ctx.out(`ok cancel ${h}`);
    return 0;
  }
  const [when, msg, ...extra] = pos;
  if (!when) fail('schedule: missing <time|reset>');
  if (!msg || !msg.trim()) fail('schedule: missing "<message>"');
  if (extra.length) fail(`schedule: unexpected "${extra[0]}" (quote the message)`);
  if (flags.to && !flags.request) fail('schedule: --to needs --request');
  const opts = { when: whenOf(when), message: msg };
  if (flags.item) checkId(flags.item, 'item id');
  if (flags.request) opts.request = { id: flags.item || `req-${now()}-${Math.floor(Math.random() * 1000)}`, note: msg, to: flags.to || ctx.env.HARBORDECK_TO || undefined };
  else if (flags.item) opts.item = flags.item;
  let r;
  try { r = sched.enqueue(home, opts); } catch (e) { fail(`schedule: ${e.message}`); }
  ctx.out(r.created ? `ok schedule ${r.id}` : `already queued ${r.id}`);
  if (!sched.loadConfig(home, ctx.env).wake_command && !opts.request) ctx.warn('warning: no wake_command configured; it waits until one is (hd scheduler config --wake-command <cmd>)');
  return 0;
}

async function cmdLimit(argv, ctx) {
  const home = ctx.store.home;
  const [sub, ...rest] = argv;
  if (sub === 'record' || sub === 'snapshot') {
    parseFlags(rest, {});
    // Hook and statusline entry points: never fail the agent's session.
    try {
      const input = ctx.readStdin() || '';
      if (sub === 'snapshot') sched.snapshotRateLimits(home, input, ctx.env);
      else {
        const r = sched.recordLimit(home, input, ctx.env);
        if (r) ctx.out(`${r.created ? 'ok limit' : 'already pending'} ${r.id} reset ${sched.fmtTime(r.reset)} (${r.source})`);
      }
    } catch (e) {
      try { sched.log(home, `limit ${sub} error: ${e.message}`); } catch { /* nowhere to log */ }
    }
    return 0;
  }
  if (sub === 'set') {
    const { pos, flags } = parseFlags(rest, { reset: {}, window: {} });
    if (pos.length) fail(`limit set: unexpected "${pos[0]}"`);
    if (!flags.reset) fail('limit set: missing --reset <time>');
    const t = whenOf(flags.reset);
    if (t === 'reset') fail('limit set: --reset needs a time');
    let r;
    try { r = sched.setLimit(home, t, { window: flags.window, env: ctx.env }); } catch (e) { fail(`limit set: ${e.message}`); }
    ctx.out(`${r.created ? 'ok limit' : 'already pending'} ${r.id}`);
    return 0;
  }
  fail('limit: use record | snapshot | set --reset <time>');
}

async function cmdTick(argv, ctx) {
  parseFlags(argv, {});
  const r = await sched.tick(ctx.store.home, ctx.env);
  for (const [k, ids] of Object.entries(r)) for (const id of ids) ctx.out(`${k} ${id}`);
  return r.failed.length ? 1 : 0;
}

const BIN = fileURLToPath(new URL('../bin/harbordeck.js', import.meta.url));

function cmdScheduler(argv, ctx) {
  const home = ctx.store.home;
  const [sub, ...rest] = argv;
  if (sub === 'status' || !sub) {
    const { flags } = parseFlags(rest, { json: { bool: true } });
    const st = sched.writeStatus(home, undefined, ctx.env);
    if (flags.json) { ctx.out(JSON.stringify(st)); return 0; }
    ctx.out(`scheduler ${st.enabled ? 'on' : 'OFF'} · wake_command ${st.wake_command ? 'set' : 'not set'} · ${home}`);
    for (const l of st.limits) ctx.out(`limit ${l.window || '?'} resets ${sched.fmtTime(l.reset)} (${l.source})`);
    if (st.keep_awake) ctx.out(`keeping awake until ${sched.fmtTime(st.keep_awake.until)} (caffeinate pid ${st.keep_awake.pid})`);
    showPending(st, ctx);
    if (st.last_delivery) ctx.out(`last delivery ${st.last_delivery.id} at ${sched.fmtTime(st.last_delivery.delivered_at)}`);
    for (const f of st.failed) ctx.out(`failed ${f.id} after ${f.attempts}: ${f.error}`);
    return 0;
  }
  if (sub === 'on' || sub === 'off') { parseFlags(rest, {}); sched.setEnabled(home, sub === 'on'); ctx.out(`ok scheduler ${sub}`); return 0; }
  if (sub === 'config') {
    const { pos, flags } = parseFlags(rest, { 'wake-command': {}, margin: {}, 'max-attempts': {}, 'keep-awake': {} });
    if (pos.length) fail(`scheduler config: unexpected "${pos[0]}"`);
    const patch = {};
    if (flags['wake-command'] !== undefined) patch.wake_command = flags['wake-command'];
    if (flags.margin !== undefined) { if (!/^\d+$/.test(flags.margin)) fail('--margin must be seconds'); patch.margin = Number(flags.margin); }
    if (flags['max-attempts'] !== undefined) { if (!/^[1-9]\d*$/.test(flags['max-attempts'])) fail('--max-attempts must be >= 1'); patch.max_attempts = Number(flags['max-attempts']); }
    if (flags['keep-awake'] !== undefined) { if (!/^(on|off)$/.test(flags['keep-awake'])) fail('--keep-awake on|off'); patch.keep_awake = flags['keep-awake'] === 'on'; }
    if (Object.keys(patch).length) sched.saveConfig(home, patch);
    ctx.out(JSON.stringify(sched.loadConfig(home, ctx.env)));
    return 0;
  }
  if (sub === 'install' || sub === 'uninstall') return cmdInstall(sub, rest, ctx);
  fail('scheduler: use status | on | off | config | install | uninstall');
}

function cmdInstall(sub, argv, ctx) {
  const { pos, flags } = parseFlags(argv, { 'no-load': { bool: true }, interval: {} });
  if (pos.length) fail(`scheduler ${sub}: unexpected "${pos[0]}"`);
  const home = ctx.store.home;
  const interval = flags.interval === undefined ? 60 : Number(flags.interval);
  if (!Number.isInteger(interval) || interval < 10) fail('--interval must be >= 10 seconds');
  const spec = { node: process.execPath, bin: BIN, home, envPath: ctx.env.PATH || '/usr/bin:/bin', interval };
  if (process.platform !== 'darwin' && !ctx.env.HARBORDECK_LAUNCHD_DIR) {
    const u = sched.systemdUnits(spec);
    ctx.out(`# Not macOS: install one of these yourself.
# systemd --user: ~/.config/systemd/user/harbordeck-scheduler.service
${u.service}
# ~/.config/systemd/user/harbordeck-scheduler.timer, then: systemctl --user enable --now harbordeck-scheduler.timer
${u.timer}
# or crontab -e:
${u.cron}`);
    if (sub === 'install') ctx.out(`
# Claude Code hook (~/.claude/settings.json):
${sched.hookSnippet(BIN)}`);
    return 0;
  }
  const dir = ctx.env.HARBORDECK_LAUNCHD_DIR || path.join(process.env.HOME || '', 'Library', 'LaunchAgents');
  const label = sched.launchdLabel(home, homeDir({}));
  const plist = path.join(dir, `${label}.plist`);
  const domain = `gui/${process.getuid()}`;
  const launchctl = (...a) => spawnSync('launchctl', a, { encoding: 'utf8' });
  if (sub === 'uninstall') {
    if (!flags['no-load']) launchctl('bootout', `${domain}/${label}`);
    fs.rmSync(plist, { force: true });
    ctx.out(`ok uninstall ${plist}`);
    return 0;
  }
  fs.mkdirSync(path.join(home, 'schedule'), { recursive: true });
  writeAtomic(plist, sched.launchdPlist({ ...spec, label }));
  ctx.out(`ok install ${plist}`);
  if (flags['no-load']) ctx.out(`load it: launchctl bootstrap ${domain} ${plist}`);
  else {
    launchctl('bootout', `${domain}/${label}`);
    const r = launchctl('bootstrap', domain, plist);
    if (r.status !== 0) fail(`launchctl bootstrap failed: ${(r.stderr || r.stdout).trim()}`);
    ctx.out(`ok loaded ${label}`);
  }
  ctx.out(`\nClaude Code hook (~/.claude/settings.json; see adapters/claude-code):\n${sched.hookSnippet(BIN)}`);
  if (!sched.loadConfig(home, ctx.env).wake_command) ctx.out('\nnext: hd scheduler config --wake-command "<cmd>"  (message on stdin and in $HARBORDECK_MESSAGE)');
  return 0;
}

export const SCHEDULER_COMMANDS = { schedule: cmdSchedule, limit: cmdLimit, tick: cmdTick, scheduler: cmdScheduler };
