import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from '../src/scheduler.js';

const BIN = fileURLToPath(new URL('../bin/harbordeck.js', import.meta.url));
const T = 1791400000; // a fixed "now"

function setup({ wake, keepAwake = false } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-sched-'));
  S.saveConfig(home, { keep_awake: keepAwake, ...(wake !== undefined ? { wake_command: wake } : {}) });
  const env = { ...process.env, HARBORDECK_HOME: home };
  delete env.HARBORDECK_WAKE_COMMAND;
  const hd = (args, input) => {
    const r = spawnSync(process.execPath, [BIN, ...args], { input, encoding: 'utf8', env });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };
  const q = () => fs.readdirSync(path.join(home, 'schedule', 'queue')).sort();
  const dir = (d) => { try { return fs.readdirSync(path.join(home, 'schedule', d)).sort(); } catch { return []; } };
  const answers = () => { try { return fs.readFileSync(path.join(home, 'answers.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse); } catch { return []; } };
  return { home, env, hd, q, dir, answers };
}

// A wake command that appends each message (stdin) to a file and exits with $RC (default 0).
function recorder(home, rc = 0) {
  const out = path.join(home, 'woken.txt');
  return { cmd: `cat >> '${out}'; exit ${rc}`, read: () => { try { return fs.readFileSync(out, 'utf8').trim().split('\n').filter(Boolean); } catch { return []; } } };
}

test('parseWhen: relative, clock, date, ISO, epoch', () => {
  assert.equal(S.parseWhen('+30m', T), T + 1800);
  assert.equal(S.parseWhen('+2h', T), T + 7200);
  assert.equal(S.parseWhen('+1d', T), T + 86400);
  assert.equal(S.parseWhen('@1791500000', T), 1791500000);
  assert.equal(S.parseWhen('2026-10-09T10:00:00Z', T), Date.parse('2026-10-09T10:00:00Z') / 1000);
  assert.equal(S.parseWhen('2026-10-09 10:30', T), new Date(2026, 9, 9, 10, 30).getTime() / 1000);
  const hm = S.parseWhen('10:15', T);
  const d = new Date(hm * 1000);
  assert.equal(`${d.getHours()}:${d.getMinutes()}`, '10:15');
  assert.ok(hm > T && hm <= T + 86400);
  for (const bad of ['tomorrow', '25:00', '+3x', '', '@12']) assert.equal(S.parseWhen(bad, T), null, bad);
});

test('parseResetText: Claude Code limit messages, with zones', () => {
  const t = Date.parse('2026-10-08T12:00:00Z') / 1000;
  assert.equal(S.parseResetText('limit reached|1791500000', t), 1791500000);
  assert.equal(S.parseResetText("You've hit your limit · resets 3pm (UTC)", t), Date.parse('2026-10-08T15:00:00Z') / 1000);
  // 9am New York (EDT, UTC-4) is already past at 12:00Z = 08:00 EDT? no: 08:00 < 09:00, so today
  assert.equal(S.parseResetText('resets 9am (America/New_York)', t), Date.parse('2026-10-08T13:00:00Z') / 1000);
  // 7am New York is past (08:00 EDT now): tomorrow
  assert.equal(S.parseResetText('resets 7am (America/New_York)', t), Date.parse('2026-10-09T11:00:00Z') / 1000);
  assert.equal(S.parseResetText('resets Oct 12, 3:30pm (Europe/Paris)', t), Date.parse('2026-10-12T13:30:00Z') / 1000);
  assert.equal(S.parseResetText('resets at 18:45 (UTC)', t), Date.parse('2026-10-08T18:45:00Z') / 1000);
  assert.equal(S.parseResetText('no time here', t), null);
  assert.equal(S.parseResetText('resets 3', t), null);
});

test('schedule: dedupe, past times refused, cancel by item id', () => {
  const { hd, q } = setup({ wake: 'true' });
  assert.match(hd(['schedule', '+1h', 'ping']).out, /^ok schedule at-\d+-[0-9a-f]{6}\n$/);
  assert.match(hd(['schedule', 'reset', 'after', '--item', 'task-7']).out, /^ok schedule reset-task-7\n$/);
  assert.match(hd(['schedule', 'reset', 'again', '--item', 'task-7']).out, /^already queued reset-task-7\n$/);
  assert.match(hd(['schedule', '@1000000000', 'old']).err, /time is in the past/);
  assert.match(hd(['schedule', 'soonish', 'x']).err, /bad time/);
  assert.match(hd(['schedule', '+1h', '']).err, /missing "<message>"/);
  assert.equal(q().length, 2);
  assert.equal(hd(['schedule', 'cancel', 'task-7']).out, 'ok cancel reset-task-7\n');
  assert.equal(q().length, 1);
  assert.match(hd(['schedule', 'cancel', 'task-7']).err, /nothing pending/);
});

test('limit record: statusline snapshot, message, quota; dedupe adds stalled sessions', () => {
  const { home, hd, q } = setup({ wake: 'true' });
  const t = Math.floor(Date.now() / 1000);
  // not a rate limit: ignored; garbage: logged, still exit 0
  assert.equal(hd(['limit', 'record'], JSON.stringify({ error: 'server_error' })).out, '');
  assert.equal(hd(['limit', 'record'], 'not json').code, 0);
  // statusline snapshot names the exhausted window
  hd(['limit', 'snapshot'], JSON.stringify({ rate_limits: { five_hour: { used_percentage: 100, resets_at: t + 3600 }, seven_day: { used_percentage: 40, resets_at: t + 86400 } } }));
  let r = hd(['limit', 'record'], JSON.stringify({ error: 'rate_limit', cwd: '/w/a', session_id: 's1' }));
  assert.match(r.out, new RegExp(`^ok limit limit-${t + 3600} .*\\(statusline\\)`));
  // a second session hitting the same reset (a few minutes off) joins it
  fs.rmSync(path.join(home, 'schedule', 'rate-limits.json'));
  r = hd(['limit', 'record'], JSON.stringify({ error: 'rate_limit', cwd: '/w/b', session_id: 's2', last_assistant_message: `limit|${t + 3700}` }));
  assert.match(r.out, /^already pending limit-/);
  assert.equal(q().length, 1);
  const it = JSON.parse(fs.readFileSync(path.join(home, 'schedule', 'queue', q()[0]), 'utf8'));
  assert.deepEqual(it.stalled.map((s) => s.cwd), ['/w/a', '/w/b']);
  assert.equal(it.due, t + 3600 + 90);
  // quota.json fallback when nothing else knows
  const h2 = setup({ wake: 'true' });
  fs.writeFileSync(path.join(h2.home, 'quota.json'), JSON.stringify([{ name: 'Codex', window: '5h', used_pct: 100, resets_at: t + 999 }]));
  assert.match(h2.hd(['limit', 'record'], JSON.stringify({ error: 'rate_limit' })).out, /\(quota\)/);
  // unknown reset: nothing scheduled, logged
  const h3 = setup({ wake: 'true' });
  assert.equal(h3.hd(['limit', 'record'], JSON.stringify({ error: 'rate_limit', last_assistant_message: 'limit hit' })).out, '');
  assert.match(fs.readFileSync(path.join(h3.home, 'schedule', 'scheduler.log'), 'utf8'), /reset time unknown/);
  // manual, agent-agnostic
  assert.match(h3.hd(['limit', 'set', '--reset', '+2h', '--window', '5h']).out, /^ok limit limit-\d+\n$/);
  assert.match(h3.hd(['limit', 'set', '--reset', '+30d']).err, /within 8 days/);
});

test('tick: claim before send, never resend, reset ordering, request line written once', async () => {
  const { home, dir, answers } = setup();
  const w = recorder(home);
  const env = { ...process.env, HARBORDECK_WAKE_COMMAND: w.cmd };
  S.enqueue(home, { when: 'reset', request: { id: 'req-1', note: 'Add a dark theme', to: 'mate-main' } }, T);
  S.enqueue(home, { when: 'reset', message: 'plain follow-up' }, T + 1);
  S.enqueue(home, { when: T + 600, message: 'at ten past' }, T);
  S.setLimit(home, T + 3600, { window: '5h', env }, T);
  // before the reset only the timed item is due
  let r = await S.tick(home, env, T + 700);
  assert.deepEqual(r.delivered, ['at-' + (T + 600) + '-' + r.delivered[0].split('-').pop()]);
  assert.equal(w.read().length, 1);
  assert.equal(answers().length, 0);
  // at reset + margin: the limit wake first, then reset items in queue order
  r = await S.tick(home, env, T + 3600 + 90);
  assert.deepEqual(r.delivered, [`limit-${T + 3600}`, 'reset-req-1', r.delivered[2]]);
  const woken = w.read();
  assert.match(woken[1], /usage limit reset/);
  assert.match(woken[2], /request req-1 for mate-main, queued for after the usage-limit reset: Add a dark theme/);
  assert.match(woken[3], /plain follow-up/);
  assert.equal(answers().length, 1);
  assert.deepEqual({ ...answers()[0], at: 0 }, { id: 'req-1', action: 'request', note: 'Add a dark theme', to: 'mate-main', queued_at: T, at: 0 });
  // a second tick (or a racing one) sends nothing again
  r = await S.tick(home, env, T + 3600 + 200);
  assert.deepEqual(r.delivered, []);
  assert.equal(w.read().length, 4);
  assert.equal(dir('queue').length, 0);
  assert.equal(dir('sent').length, 4);
  const st = S.statusData(home, env, T + 3600 + 200);
  assert.equal(st.pending.length, 0);
  assert.equal(st.last_delivery.delivered_at, T + 3600 + 90);
});

test('tick: concurrent ticks deliver each item exactly once', async () => {
  const { home } = setup();
  const w = recorder(home);
  const env = { ...process.env, HARBORDECK_WAKE_COMMAND: `sleep 0.2; ${w.cmd}` };
  for (let i = 0; i < 5; i++) S.enqueue(home, { when: T + 10, message: `m${i}` }, T);
  await Promise.all([S.tick(home, env, T + 20), S.tick(home, env, T + 20), S.tick(home, env, T + 20)]);
  assert.equal(w.read().length, 5);
  assert.deepEqual(w.read().map((l) => l.split(': ').pop()).sort(), ['m0', 'm1', 'm2', 'm3', 'm4']);
});

test('tick: bounded retries, rc 3 counts as delivered, rc 75 defers without spending attempts', async () => {
  const { home, dir } = setup();
  S.saveConfig(home, { max_attempts: 3 });
  S.enqueue(home, { when: T + 10, message: 'flaky' }, T);
  const fail = { ...process.env, HARBORDECK_WAKE_COMMAND: 'echo nope >&2; exit 1' };
  assert.deepEqual((await S.tick(home, fail, T + 20)).retried.length, 1);
  assert.deepEqual((await S.tick(home, fail, T + 80)).retried.length, 1);
  const defer = { ...process.env, HARBORDECK_WAKE_COMMAND: 'exit 75' };
  assert.equal((await S.tick(home, defer, T + 140)).deferred.length, 1);
  const pend = S.pending(home)[0];
  assert.equal(pend.attempts, 2);
  assert.equal(pend.last_error, 'nope');
  assert.deepEqual((await S.tick(home, fail, T + 200)).failed.length, 1);
  assert.equal(dir('failed').length, 1);
  assert.equal(dir('queue').length, 0);
  assert.equal(S.statusData(home, fail, T + 300).failed[0].attempts, 3);
  // rc 3: typed but unconfirmed, never retyped
  S.enqueue(home, { when: T + 400, message: 'typed' }, T);
  const typed = { ...process.env, HARBORDECK_WAKE_COMMAND: 'exit 3' };
  assert.equal((await S.tick(home, typed, T + 410)).delivered.length, 1);
  assert.equal((await S.tick(home, typed, T + 470)).delivered.length, 0);
});

test('tick: a retried request writes its answer line only once; a deferred reset item keeps its time', async () => {
  const { home, answers } = setup();
  S.enqueue(home, { when: 'reset', request: { id: 'req-9', note: 'n' } }, T);
  S.setLimit(home, T + 100, { env: process.env }, T);
  const fail = { ...process.env, HARBORDECK_WAKE_COMMAND: 'exit 1' };
  await S.tick(home, fail, T + 200);
  assert.equal(answers().length, 1);
  // the limit wake is gone now; the request must not fall back to a later reset
  fs.writeFileSync(path.join(home, 'quota.json'), JSON.stringify([{ name: 'C', window: '5h', used_pct: 10, resets_at: T + 9000 }]));
  const ok = { ...process.env, HARBORDECK_WAKE_COMMAND: 'true' };
  const r = await S.tick(home, ok, T + 260);
  assert.ok(r.delivered.includes('reset-req-9'));
  assert.equal(answers().length, 1);
});

test('no wake command: requests still reach answers.jsonl, messages wait', async () => {
  const { home, answers } = setup({ wake: '' });
  S.enqueue(home, { when: T + 10, request: { id: 'req-2', note: 'later' } }, T);
  S.enqueue(home, { when: T + 10, message: 'needs a wake' }, T);
  const r = await S.tick(home, process.env, T + 20);
  assert.deepEqual(r.delivered, ['at-' + (T + 10) + '-req-2']);
  assert.equal(r.deferred.length, 1);
  assert.equal(answers()[0].id, 'req-2');
  assert.equal(S.pending(home).length, 1);
});

test('off switch: tick delivers nothing; on resumes', async () => {
  const { home, hd } = setup();
  const w = recorder(home);
  const env = { ...process.env, HARBORDECK_WAKE_COMMAND: w.cmd };
  S.enqueue(home, { when: T + 10, message: 'x' }, T);
  assert.equal(hd(['scheduler', 'off']).out, 'ok scheduler off\n');
  assert.deepEqual((await S.tick(home, env, T + 20)).delivered, []);
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'scheduler.json'), 'utf8')).enabled, false);
  assert.deepEqual((await S.tick(home, { ...env, HARBORDECK_SCHEDULER: 'off' }, T + 20)).delivered, []);
  hd(['scheduler', 'on']);
  assert.equal((await S.tick(home, env, T + 20)).delivered.length, 1);
});

test('reset due: max of exhausted windows, else soonest quota reset, else now', () => {
  const { home } = setup();
  const cfg = S.loadConfig(home);
  assert.equal(S.resetDue(home, [], cfg, T), 0);
  fs.writeFileSync(path.join(home, 'quota.json'), JSON.stringify([
    { name: 'C', window: '5h', used_pct: 40, resets_at: T + 5000 }, { name: 'C', window: '7d', used_pct: 50, resets_at: T + 90000 }]));
  assert.equal(S.resetDue(home, [], cfg, T), T + 5000 + 90);
  fs.writeFileSync(path.join(home, 'quota.json'), JSON.stringify([
    { name: 'C', window: '5h', used_pct: 100, resets_at: T + 5000 }, { name: 'C', window: '7d', used_pct: 100, resets_at: T + 90000 }]));
  assert.equal(S.resetDue(home, [{ kind: 'limit', due: T + 300 }], cfg, T), T + 90000 + 90);
  // exhausted quota windows show up as limits in status even without a hook
  const st = S.statusData(home, process.env, T);
  assert.deepEqual(st.limits.map((l) => l.window), ['C 5h', 'C 7d']);
  assert.equal(st.next_reset, T + 90000);
});

test('scheduler.json: written on change with pending, limits, enabled', () => {
  const { home, hd } = setup({ wake: 'x' });
  hd(['schedule', '+1h', 'one']);
  hd(['limit', 'set', '--reset', '+3h', '--window', '5h']);
  const st = JSON.parse(fs.readFileSync(path.join(home, 'scheduler.json'), 'utf8'));
  assert.equal(st.version, 1);
  assert.equal(st.enabled, true);
  assert.equal(st.wake_command, true);
  assert.equal(st.pending.length, 2);
  assert.deepEqual(st.limits.map((l) => [l.window, l.source]), [['5h', 'manual']]);
  assert.equal(st.next_reset, st.limits[0].reset);
  assert.equal(st.keep_awake, null);
  const j = JSON.parse(hd(['scheduler', 'status', '--json']).out);
  assert.equal(j.pending.length, 2);
});

test('keep awake: one assertion, extended, replaced only when stale, released when empty', () => {
  const { home } = setup({ keepAwake: true });
  const calls = [];
  let live = new Set();
  let nextPid = 100;
  const ops = {
    bin: 'caffeinate',
    alive: (pid) => live.has(pid),
    start: (bin, secs) => { const pid = nextPid++; live.add(pid); calls.push(['start', pid, secs]); return pid; },
    stop: (pid) => { live.delete(pid); calls.push(['stop', pid]); },
  };
  const data = (dues, enabled = true) => ({ enabled, pending: dues.map((d) => ({ due: d })) });
  // nothing pending: nothing held
  assert.equal(S.syncKeepAwake(home, data([]), process.env, T, ops), null);
  // pending: one assertion until the last due + slack
  let a = S.syncKeepAwake(home, data([T + 600, T + 3600]), process.env, T, ops);
  assert.deepEqual(a, { pid: 100, until: T + 3600 + 300 });
  assert.deepEqual(calls, [['start', 100, 3900]]);
  // same horizon: kept, no second process
  assert.equal(S.syncKeepAwake(home, data([T + 3600]), process.env, T + 60, ops).pid, 100);
  assert.equal(calls.length, 1);
  // later item: replaced (old one stopped first), still exactly one alive
  a = S.syncKeepAwake(home, data([T + 7200]), process.env, T + 60, ops);
  assert.equal(a.pid, 101);
  assert.deepEqual(calls.slice(1), [['stop', 100], ['start', 101, 7200 + 300 - 60]]);
  assert.equal(live.size, 1);
  // the process died on its own (expired or killed): restarted
  live = new Set();
  assert.equal(S.syncKeepAwake(home, data([T + 7200]), process.env, T + 120, ops).pid, 102);
  // a recorded pid that is not ours any more is never killed
  live = new Set();
  S.syncKeepAwake(home, data([]), process.env, T + 200, ops);
  assert.ok(!calls.some((c) => c[0] === 'stop' && c[1] === 102));
  assert.equal(fs.existsSync(path.join(home, 'schedule', 'keep-awake.json')), false);
  // released as soon as nothing is pending, or when switched off
  S.syncKeepAwake(home, data([T + 900]), process.env, T + 300, ops);
  S.syncKeepAwake(home, data([T + 900], false), process.env, T + 310, ops);
  assert.deepEqual(calls.at(-1), ['stop', 103]);
  assert.equal(live.size, 0);
  // keep_awake off in config: never starts
  S.saveConfig(home, { keep_awake: false });
  assert.equal(S.syncKeepAwake(home, data([T + 900]), process.env, T + 400, ops), null);
});

test('keep awake: CLI starts and releases a real (stub) caffeinate process', async () => {
  const { home, env, hd } = setup({ keepAwake: true, wake: 'true' });
  const stub = path.join(home, 'caffeinate-stub');
  fs.writeFileSync(stub, '#!/bin/sh\nsleep 60\n');
  fs.chmodSync(stub, 0o755);
  env.HARBORDECK_CAFFEINATE = stub;
  const ps = (pid) => spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).stdout.trim();
  const r = spawnSync(process.execPath, [BIN, 'schedule', '+2s', 'soon'], { env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const st = JSON.parse(fs.readFileSync(path.join(home, 'scheduler.json'), 'utf8'));
  assert.ok(st.keep_awake && st.keep_awake.pid, 'assertion recorded');
  assert.match(ps(st.keep_awake.pid), /-i -t \d+/);
  await new Promise((res) => setTimeout(res, 2500));
  assert.equal(hd(['tick']).out, 'delivered at-' + st.pending[0].due + '-' + st.pending[0].id.split('-').pop() + '\n');
  await new Promise((res) => setTimeout(res, 200));
  assert.equal(ps(st.keep_awake.pid), '');
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'scheduler.json'), 'utf8')).keep_awake, null);
});

test('install: launchd plist into a given dir (no load), uninstall removes it', () => {
  const { home, env } = setup();
  const la = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-la-'));
  const run = (args) => spawnSync(process.execPath, [BIN, ...args], { env: { ...env, HARBORDECK_LAUNCHD_DIR: la }, encoding: 'utf8' });
  const r = run(['scheduler', 'install', '--no-load']);
  assert.equal(r.status, 0, r.stderr);
  const [name] = fs.readdirSync(la);
  assert.match(name, /^dev\.harbordeck\.scheduler\.[0-9a-f]{8}\.plist$/);
  const plist = fs.readFileSync(path.join(la, name), 'utf8');
  assert.match(plist, /<string>tick<\/string>/);
  assert.match(plist, /<key>StartInterval<\/key>\s*<integer>60<\/integer>/);
  assert.ok(plist.includes(`<string>${home}</string>`));
  assert.match(r.stdout, /launchctl bootstrap gui\/\d+ /);
  assert.match(r.stdout, /"StopFailure"/);
  assert.match(r.stdout, /limit record/);
  assert.equal(run(['scheduler', 'uninstall', '--no-load']).status, 0);
  assert.deepEqual(fs.readdirSync(la), []);
});

test('firstmate wake preset: finds the firstmate pane and calls fm-send with FM_HOME', () => {
  const root = fileURLToPath(new URL('../../adapters/firstmate/wake.sh', import.meta.url));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-fm-'));
  const fm = path.join(tmp, 'fm'); const bin = path.join(tmp, 'bin');
  fs.mkdirSync(path.join(fm, 'bin'), { recursive: true }); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(fm, 'bin', 'fm-send.sh'), `#!/bin/sh\nprintf '%s|%s|%s\\n' "$FM_HOME" "$1" "$2" >> "${tmp}/sent"\nexit \${SEND_RC:-0}\n`);
  fs.writeFileSync(path.join(bin, 'herdr'), `#!/bin/sh
case "$1 $2" in
  "workspace list") echo '{"result":{"workspaces":[{"workspace_id":"w1","label":"firstmate"},{"workspace_id":"w2","label":"other"}]}}' ;;
  "agent list") [ -n "$NO_AGENT" ] && echo '{"result":{"agents":[]}}' || echo '{"result":{"agents":[{"workspace_id":"w2","pane_id":"p9"},{"workspace_id":"w1","pane_id":"p3"}]}}' ;;
  *) exit 1 ;;
esac
`);
  for (const f of [path.join(fm, 'bin', 'fm-send.sh'), path.join(bin, 'herdr')]) fs.chmodSync(f, 0o755);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, FM_HOME: fm };
  let r = spawnSync(root, [], { input: 'wake up\n', env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(path.join(tmp, 'sent'), 'utf8'), `${fm}|default:p3|wake up\n`);
  // explicit target, message from env; fm-send rc 3 passes through (delivered, unconfirmed)
  r = spawnSync(root, [], { input: '', env: { ...env, HD_WAKE_TARGET: 's:p1', HARBORDECK_MESSAGE: 'from env', SEND_RC: '3' }, encoding: 'utf8' });
  assert.equal(r.status, 3);
  assert.match(fs.readFileSync(path.join(tmp, 'sent'), 'utf8'), /\|s:p1\|from env\n$/);
  // no firstmate pane: 75 (defer, try next tick)
  r = spawnSync(root, [], { input: 'x', env: { ...env, NO_AGENT: '1' }, encoding: 'utf8' });
  assert.equal(r.status, 75);
  assert.match(r.stderr, /found 0/);
  // FM_HOME is required
  const noHome = { ...env }; delete noHome.FM_HOME;
  assert.equal(spawnSync(root, [], { input: 'x', env: noHome, encoding: 'utf8' }).status, 2);
});
