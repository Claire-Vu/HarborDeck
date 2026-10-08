// Limit-reset scheduler: hold messages and requests until a time or until the
// agent's usage limit resets, then deliver each exactly once through a
// configurable wake command. Shared by the CLI (`hd schedule|limit|tick|scheduler`)
// and the desktop app (queue a request, read status). Pure Node, no deps.
//
// State, all under the data dir (docs/CONTRACT.md "Scheduler"):
//   schedule/queue/<id>.json   pending          schedule/sent/, schedule/failed/   history
//   schedule/config.json       wake_command, margin, max_attempts
//   schedule/rate-limits.json  last statusline rate_limits per account (Claude Code)
//   schedule/off               off switch       schedule/scheduler.log   log
//   schedule/keep-awake.json   pid + end of the one caffeinate -i assertion (macOS)
//   scheduler.json             status for UIs, rewritten on every change
//
// Safety: an item is claimed (renamed into sent/) before its wake runs and is
// never resent after that, so a duplicate tick or a crash cannot wake twice.
// A failed wake goes back to the queue for the next tick, up to max_attempts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { writeAtomic, SLUG } from './store.js';

export const DEFAULTS = { wake_command: '', margin: 90, max_attempts: 5, wake_timeout: 120, keep_awake: process.platform === 'darwin' };
export const DEDUPE_WINDOW = 15 * 60; // limit records this close are the same reset
export const MAX_HORIZON = 8 * 86400; // a 7d window plus slack; later is a parse error
const LATE = 600; // due this long ago (machine asleep): say so in the message
const RC_UNCONFIRMED = 3; // wake typed the message but could not confirm it landed: delivered, never retry
const RC_DEFER = 75; // EX_TEMPFAIL: target not reachable now; retry next tick without spending an attempt

const now = () => Math.floor(Date.now() / 1000);
const sha = (s, n = 6) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, n);

export function paths(home) {
  const dir = path.join(home, 'schedule');
  return {
    home, dir,
    queue: path.join(dir, 'queue'), sent: path.join(dir, 'sent'), failed: path.join(dir, 'failed'),
    config: path.join(dir, 'config.json'), rates: path.join(dir, 'rate-limits.json'),
    off: path.join(dir, 'off'), log: path.join(dir, 'scheduler.log'), lock: path.join(dir, '.lock'),
    awake: path.join(dir, 'keep-awake.json'),
    status: path.join(home, 'scheduler.json'), answers: path.join(home, 'answers.jsonl'), quota: path.join(home, 'quota.json'),
  };
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function log(home, msg) {
  const p = paths(home);
  fs.mkdirSync(p.dir, { recursive: true });
  fs.appendFileSync(p.log, `${new Date().toISOString()} ${msg}\n`);
}

// Short read-modify-write sections only; wake commands run outside the lock.
function withLock(home, fn) {
  const p = paths(home);
  fs.mkdirSync(p.dir, { recursive: true });
  const wait = new Int32Array(new SharedArrayBuffer(4));
  for (let i = 0; ; i++) {
    try { fs.mkdirSync(p.lock); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { if (Date.now() - fs.statSync(p.lock).mtimeMs > 30000) { fs.rmdirSync(p.lock); continue; } } catch { continue; }
      if (i > 400) throw new Error('scheduler lock busy');
      Atomics.wait(wait, 0, 0, 25);
    }
  }
  try { return fn(); } finally { try { fs.rmdirSync(p.lock); } catch { /* gone */ } }
}

// ------------------------------------------------------------ config

export function loadConfig(home, env = process.env) {
  const cfg = { ...DEFAULTS, ...readJson(paths(home).config, {}) };
  if (env.HARBORDECK_WAKE_COMMAND !== undefined) cfg.wake_command = env.HARBORDECK_WAKE_COMMAND;
  if (env.HARBORDECK_WAKE_MARGIN !== undefined && /^\d+$/.test(env.HARBORDECK_WAKE_MARGIN)) cfg.margin = Number(env.HARBORDECK_WAKE_MARGIN);
  return cfg;
}

export function saveConfig(home, patch) {
  const p = paths(home);
  const next = { ...readJson(p.config, {}), ...patch };
  writeAtomic(p.config, JSON.stringify(next, null, 1) + '\n');
  return next;
}

export const isOff = (home, env = process.env) => env.HARBORDECK_SCHEDULER === 'off' || fs.existsSync(paths(home).off);

export function setEnabled(home, on) {
  const p = paths(home);
  fs.mkdirSync(p.dir, { recursive: true });
  if (on) fs.rmSync(p.off, { force: true }); else fs.writeFileSync(p.off, '');
  log(home, on ? 'turned on' : 'turned off');
  writeStatus(home);
}

// ------------------------------------------------------------ time parsing

const pad = (n) => String(n).padStart(2, '0');

// Epoch of a wall-clock time in an IANA zone (or the local zone when tz is falsy).
export function zonedEpoch(y, mo, d, h, mi, tz) {
  if (!tz) return Math.floor(new Date(y, mo - 1, d, h, mi, 0).getTime() / 1000);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  const wall = Date.UTC(y, mo - 1, d, h, mi, 0);
  let t = wall;
  for (let i = 0; i < 3; i++) { // converge on the zone offset (twice covers DST edges)
    const f = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    const seen = Date.UTC(+f.year, +f.month - 1, +f.day, +f.hour % 24, +f.minute, +f.second);
    t += wall - seen;
  }
  return Math.floor(t / 1000);
}

// Wall-clock parts of an epoch in tz (or local).
function partsIn(epoch, tz) {
  if (!tz) { const d = new Date(epoch * 1000); return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate() }; }
  const f = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(epoch * 1000)).map((x) => [x.type, x.value]));
  return { y: +f.year, mo: +f.month, d: +f.day };
}

// Next occurrence of h:mi (today or tomorrow) after t.
function nextClock(h, mi, t, tz) {
  const p = partsIn(t, tz);
  let e = zonedEpoch(p.y, p.mo, p.d, h, mi, tz);
  if (e <= t) { const q = partsIn(t + 86400, tz); e = zonedEpoch(q.y, q.mo, q.d, h, mi, tz); }
  return e;
}

// "HH:MM" (next occurrence), "+30m" "+2h" "+1d", "YYYY-MM-DD HH:MM" (local), ISO 8601, "@<epoch>".
// Returns epoch seconds, or null when unparseable.
export function parseWhen(s, t = now()) {
  s = String(s).trim();
  let m;
  if ((m = /^@(\d{9,11})$/.exec(s))) return Number(m[1]);
  if ((m = /^\+(\d+(?:\.\d+)?)([smhd])$/.exec(s))) return t + Math.round(Number(m[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[m[2]]);
  if ((m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s))) return nextClock(+m[1], +m[2], t);
  if ((m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(s))) return zonedEpoch(+m[1], +m[2], +m[3], +m[4], +m[5]);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) { const v = Date.parse(s); return Number.isNaN(v) ? null : Math.floor(v / 1000); }
  return null;
}

const MONTHS = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');

// Reset time from a limit message: "resets 3pm", "resets Oct 9, 3:30pm (Europe/Paris)",
// "resets at 15:00", or a "...|<epoch>" suffix. Returns epoch seconds or null.
export function parseResetText(text, t = now()) {
  if (!text) return null;
  let m = /\|(\d{10})\b/.exec(text);
  if (m) return Number(m[1]);
  m = /resets?\s+(?:at\s+)?(?:([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(?:at\s+)?)?(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?(?:\s*\(([A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+|UTC)\))?/i.exec(text);
  if (!m) return null;
  const [, mon, day, hs, mins, ap, tz0] = m;
  if (!ap && mins === undefined) return null; // "resets 3" is not a time
  let h = Number(hs);
  if (ap) { if (h < 1 || h > 12) return null; h = (h % 12) + (/^p/i.test(ap) ? 12 : 0); } else if (h > 23) return null;
  const mi = Number(mins || 0);
  let tz = tz0 || null;
  if (tz) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { tz = null; } }
  if (mon && MONTHS.includes(mon.toLowerCase().slice(0, 3))) {
    const mo = MONTHS.indexOf(mon.toLowerCase().slice(0, 3)) + 1;
    let y = partsIn(t, tz).y;
    let e = zonedEpoch(y, mo, Number(day), h, mi, tz);
    if (e < t - 86400) e = zonedEpoch(++y, mo, Number(day), h, mi, tz);
    return e;
  }
  return nextClock(h, mi, t, tz);
}

export function fmtTime(epoch) {
  const d = new Date(epoch * 1000);
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ------------------------------------------------------------ queue

function readDir(dir) {
  let names;
  try { names = fs.readdirSync(dir); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  return names.filter((n) => n.endsWith('.json') && !n.startsWith('.')).sort();
}

export function pending(home) {
  const p = paths(home);
  const out = [];
  for (const name of readDir(p.queue)) {
    const it = readJson(path.join(p.queue, name), null);
    if (it && it.id) out.push(it);
  }
  return out;
}

// Exhausted quota.json windows (used_pct >= 100, future reset) count as limits too,
// so any agent that keeps quota.json fresh gets reset-gating without a hook.
export function quotaLimits(home, t = now()) {
  const q = readJson(paths(home).quota, []);
  if (!Array.isArray(q)) return [];
  return q.filter((w) => w && Number(w.used_pct) >= 100 && Number(w.resets_at) > t && Number(w.resets_at) <= t + MAX_HORIZON)
    .map((w) => ({ reset: Number(w.resets_at), window: `${w.name} ${w.window}`, source: 'quota' }));
}

// When "reset" items go: after every known exhausted window has reset (pending limit
// wakes and exhausted quota windows), else at the soonest future quota reset, else now.
export function resetDue(home, items, cfg, t = now()) {
  const limits = items.filter((i) => i.kind === 'limit').map((i) => i.due);
  const quota = quotaLimits(home, t).map((l) => l.reset + cfg.margin);
  const blocking = [...limits, ...quota];
  if (blocking.length) return Math.max(...blocking);
  const q = readJson(paths(home).quota, []);
  const future = (Array.isArray(q) ? q : []).map((w) => Number(w && w.resets_at)).filter((r) => r > t && r <= t + MAX_HORIZON);
  return future.length ? Math.min(...future) + cfg.margin : 0;
}

export const effectiveDue = (item, rdue) => (item.kind === 'reset' && !item.due ? rdue : item.due || 0);

// Queue a message (and optionally a deferred request) for a time or for the next reset.
// opts: { when: 'reset' | epoch, message, item?, request?: { id, note, to? } }
// Returns { id, created } (created false when an identical item was already queued).
export function enqueue(home, opts, t = now()) {
  const message = String(opts.message || (opts.request && opts.request.note) || '').trim();
  if (!message) throw new Error('empty message');
  const item = { kind: opts.when === 'reset' ? 'reset' : 'at', message, queued_at: t };
  if (item.kind === 'at') {
    if (!Number.isInteger(opts.when)) throw new Error('bad time');
    if (opts.when <= t) throw new Error('time is in the past');
    item.due = opts.when;
  }
  if (opts.request) {
    const r = opts.request;
    if (!r.id || !SLUG.test(r.id)) throw new Error(`bad request id "${r.id}"`);
    if (!String(r.note || '').trim()) throw new Error('request needs a note');
    item.request = { id: r.id, note: String(r.note), ...(r.to ? { to: String(r.to) } : {}) };
    item.item = r.id;
  } else if (opts.item) {
    if (!SLUG.test(opts.item)) throw new Error(`bad item id "${opts.item}"`);
    item.item = opts.item;
  }
  // Stable id: the same message/item for the same time is one queue entry.
  const key = item.item || sha(message);
  item.id = item.kind === 'at' ? `at-${item.due}-${key}` : `reset-${item.item ? key : `${t}-${key}`}`;
  item.id = item.id.slice(0, 128);
  const p = paths(home);
  return withLock(home, () => {
    const file = path.join(p.queue, `${item.id}.json`);
    if (fs.existsSync(file) || fs.existsSync(path.join(p.sent, `${item.id}.json`))) return { id: item.id, created: false };
    writeAtomic(file, JSON.stringify(item, null, 1) + '\n');
    log(home, `queued ${item.id} for ${item.kind === 'at' ? fmtTime(item.due) : 'the next reset'}`);
    // Pin exhausted quota windows as limit wakes now, so a reset passing between ticks is not lost.
    materializeQuota(home, loadConfig(home), t);
    writeStatus(home, t);
    return { id: item.id, created: true };
  });
}

// Cancel by queue id or by linked item/request id. Returns the removed ids.
export function cancel(home, id) {
  const p = paths(home);
  return withLock(home, () => {
    const hits = pending(home).filter((i) => i.id === id || i.item === id).map((i) => i.id);
    for (const h of hits) fs.rmSync(path.join(p.queue, `${h}.json`), { force: true });
    if (hits.length) { log(home, `cancelled ${hits.join(', ')}`); writeStatus(home); }
    return hits;
  });
}

// ------------------------------------------------------------ limits

// Add a limit wake for `reset` unless one within DEDUPE_WINDOW is pending; a repeat
// only adds who stalled. Caller holds the lock.
function addLimit(home, { reset, source, window, stalled }, cfg, t) {
  const p = paths(home);
  for (const it of pending(home)) {
    if (it.kind !== 'limit' || Math.abs(it.reset - reset) > DEDUPE_WINDOW) continue;
    if (stalled && !it.stalled.some((s) => JSON.stringify(s) === JSON.stringify(stalled))) {
      it.stalled.push(stalled);
      writeAtomic(path.join(p.queue, `${it.id}.json`), JSON.stringify(it, null, 1) + '\n');
    }
    return { id: it.id, created: false };
  }
  const it = { kind: 'limit', id: `limit-${reset}`, reset, due: reset + cfg.margin, source, hit_at: t, stalled: stalled ? [stalled] : [] };
  if (window) it.window = window;
  if (fs.existsSync(path.join(p.sent, `${it.id}.json`))) return { id: it.id, created: false };
  writeAtomic(path.join(p.queue, `${it.id}.json`), JSON.stringify(it, null, 1) + '\n');
  log(home, `limit ${source}${window ? ` ${window}` : ''}: wake scheduled ${fmtTime(it.due)}`);
  return { id: it.id, created: true };
}

// Exhausted quota.json windows become limit wakes (caller holds the lock). Returns true when any was added.
function materializeQuota(home, cfg, t) {
  let added = false;
  for (const q of quotaLimits(home, t)) added = addLimit(home, { ...q, stalled: null }, cfg, t).created || added;
  return added;
}

export function setLimit(home, reset, { source = 'manual', window, stalled, env = process.env } = {}, t = now()) {
  if (!(reset > t && reset <= t + MAX_HORIZON)) throw new Error('reset must be in the future and within 8 days');
  const cfg = loadConfig(home, env);
  return withLock(home, () => { const r = addLimit(home, { reset, source, window, stalled }, cfg, t); writeStatus(home, t); return r; });
}

const accountKey = (env) => (env.CLAUDE_CONFIG_DIR ? sha(env.CLAUDE_CONFIG_DIR, 8) : 'default');

// Statusline tee: keep the last rate_limits block per Claude account.
export function snapshotRateLimits(home, input, env = process.env, t = now()) {
  const data = JSON.parse(input);
  if (!data || typeof data !== 'object' || !data.rate_limits) return false;
  const p = paths(home);
  const all = readJson(p.rates, {});
  all[accountKey(env)] = { at: t, rate_limits: data.rate_limits };
  writeAtomic(p.rates, JSON.stringify(all, null, 1) + '\n');
  return true;
}

function resetFromRates(home, env, t) {
  const snap = readJson(paths(home).rates, {})[accountKey(env)];
  const wins = [];
  for (const [name, w] of Object.entries((snap && snap.rate_limits) || {})) {
    const used = Number(w && w.used_percentage); const at = Number(w && w.resets_at);
    if (Number.isFinite(used) && at > t) wins.push({ used, at, name });
  }
  const full = wins.filter((w) => w.used >= 100);
  if (full.length) { const w = full.reduce((a, b) => (b.at > a.at ? b : a)); return { reset: w.at, window: w.name, sure: true }; }
  if (wins.length) { const w = wins.reduce((a, b) => (b.used > a.used ? b : a)); return { reset: w.at, window: w.name, sure: false }; }
  return null;
}

// StopFailure hook (Claude Code, matcher rate_limit): hook JSON on stdin.
// Reset from: statusline snapshot (exhausted window), the limit message, quota.json.
export function recordLimit(home, input, env = process.env, t = now()) {
  let hook;
  try { hook = JSON.parse(input); } catch { log(home, 'limit record: stdin is not hook JSON; ignored'); return null; }
  if (!hook || typeof hook !== 'object' || (hook.error && hook.error !== 'rate_limit')) return null;
  const text = ['last_assistant_message', 'error_details', 'message'].map((k) => hook[k] || '').join(' ');
  let found = null;
  const snap = resetFromRates(home, env, t);
  if (snap && snap.sure) found = { reset: snap.reset, source: 'statusline', window: snap.window };
  if (!found) { const r = parseResetText(text, t); if (r) found = { reset: r, source: 'message' }; }
  if (!found) { const q = quotaLimits(home, t).sort((a, b) => b.reset - a.reset)[0]; if (q) found = { reset: q.reset, source: 'quota', window: q.window }; }
  if (!found && snap) found = { reset: snap.reset, source: 'statusline-highest', window: snap.window };
  if (!found || !(found.reset > t && found.reset <= t + MAX_HORIZON)) {
    log(home, `limit hit, reset time unknown; nothing scheduled (${text.slice(0, 160).replace(/\s+/g, ' ')})`);
    return null;
  }
  const stalled = { pane: env.HARBORDECK_PANE || env.HERDR_PANE_ID || env.TMUX_PANE || '', cwd: hook.cwd || '', session: hook.session_id || '' };
  const cfg = loadConfig(home, env);
  return withLock(home, () => { const r = addLimit(home, { ...found, stalled }, cfg, t); writeStatus(home, t); return { ...r, ...found }; });
}

// ------------------------------------------------------------ delivery

export function render(item, t = now()) {
  let text;
  if (item.kind === 'limit') {
    const who = [...new Set((item.stalled || []).map((s) => s.pane || s.cwd).filter(Boolean))].join(', ');
    text = `[harbordeck] usage limit reset at ${fmtTime(item.reset)} (hit ${fmtTime(item.hit_at)}). Resume work: check sessions stalled by the limit${who ? ` (${who})` : ''}.`;
  } else if (item.request) {
    const r = item.request;
    text = `[harbordeck] request ${r.id}${r.to ? ` for ${r.to}` : ''}, queued ${item.kind === 'reset' ? 'for after the usage-limit reset' : `for ${fmtTime(item.due)}`}: ${r.note}`;
  } else {
    text = `[harbordeck] ${item.kind === 'reset' ? 'queued for after the usage-limit reset' : `scheduled for ${fmtTime(item.due)}`}: ${item.message}`;
  }
  if (item._due && t - item._due > LATE) text += ` (delivered late: due ${fmtTime(item._due)})`;
  return text;
}

function runWake(command, text, item, home, timeoutSec) {
  return new Promise((resolve) => {
    const shell = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : '/bin/sh';
    const args = process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-c', command];
    const env = {
      ...process.env, HARBORDECK_HOME: home, HARBORDECK_MESSAGE: text, HARBORDECK_SCHEDULE_ID: item.id,
      HARBORDECK_SCHEDULE_KIND: item.kind, HARBORDECK_ITEM: item.item || '',
    };
    let child;
    try { child = spawn(shell, args, { cwd: home, env, stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { resolve({ code: 127, out: e.message }); return; }
    let out = '';
    const grab = (d) => { if (out.length < 2000) out += d; };
    child.stdout.on('data', grab); child.stderr.on('data', grab);
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutSec * 1000);
    child.on('error', (e) => { clearTimeout(timer); resolve({ code: 127, out: e.message }); });
    child.on('close', (code, sig) => { clearTimeout(timer); resolve({ code: sig ? 124 : code, out: out.trim() }); });
    child.stdin.on('error', () => { /* command ignored stdin */ });
    child.stdin.end(text + '\n');
  });
}

// A deferred request reaches agents the normal way: one request line in answers.jsonl,
// written at delivery time, exactly once.
function appendRequest(home, item, t) {
  const r = item.request;
  const line = { id: r.id, action: 'request', note: r.note, ...(r.to ? { to: r.to } : {}), queued_at: item.queued_at, at: t };
  fs.appendFileSync(paths(home).answers, JSON.stringify(line) + '\n');
}

// Deliver every due item once. Returns a summary { delivered, retried, failed, deferred }.
export async function tick(home, env = process.env, t = now()) {
  const res = { delivered: [], retried: [], failed: [], deferred: [] };
  if (isOff(home, env)) return res;
  const p = paths(home);
  const cfg = loadConfig(home, env);
  // Claim under the lock: due items move to sent/ so no other tick can take them.
  const claimed = withLock(home, () => {
    const changed = materializeQuota(home, cfg, t);
    const all = pending(home);
    const rdue = resetDue(home, all, cfg, t);
    const due = all.map((i) => ({ i, d: effectiveDue(i, rdue) }))
      .filter((x) => x.d <= t)
      .sort((a, b) => a.d - b.d || (a.i.kind !== 'limit') - (b.i.kind !== 'limit') || (a.i.queued_at || 0) - (b.i.queued_at || 0));
    const out = [];
    for (const { i, d } of due) {
      // Without a wake command, only requests can be delivered (answers.jsonl); messages wait.
      if (!cfg.wake_command && !i.request) { res.deferred.push(i.id); continue; }
      fs.mkdirSync(p.sent, { recursive: true });
      try { fs.renameSync(path.join(p.queue, `${i.id}.json`), path.join(p.sent, `${i.id}.json`)); } catch { continue; } // another tick won
      out.push({ ...i, _due: d });
    }
    if (changed || out.length) writeStatus(home, t, env);
    return out;
  });
  if (res.deferred.length && !claimed.length) log(home, `no wake_command; ${res.deferred.length} message(s) waiting`);
  for (const item of claimed) {
    const { _due, ...rec } = item;
    const sentFile = path.join(p.sent, `${item.id}.json`);
    let ok = true; let detail = '';
    if (item.request && !item.answer_written) {
      try { appendRequest(home, item, t); rec.answer_written = t; writeAtomic(sentFile, JSON.stringify(rec, null, 1) + '\n'); } catch (e) { ok = false; detail = `answers.jsonl: ${e.message}`; }
    }
    let code = 0;
    if (ok && cfg.wake_command) {
      const r = await runWake(cfg.wake_command, render(item, t), item, home, cfg.wake_timeout);
      code = r.code; detail = r.out.slice(0, 300);
      ok = code === 0 || code === RC_UNCONFIRMED;
    }
    if (ok) {
      rec.delivered_at = t; rec.wake_rc = code;
      writeAtomic(sentFile, JSON.stringify(rec, null, 1) + '\n');
      log(home, `${item.id} delivered${cfg.wake_command ? ` (wake rc=${code})` : ' (answers.jsonl only)'}`);
      res.delivered.push(item.id);
      continue;
    }
    withLock(home, () => {
      if (code === RC_DEFER) {
        rec.due = rec.due || t; // a reset item keeps the time it became due
        writeAtomic(path.join(p.queue, `${item.id}.json`), JSON.stringify(rec, null, 1) + '\n');
        fs.rmSync(sentFile, { force: true });
        log(home, `${item.id} deferred (wake rc=75): ${detail}`);
        res.deferred.push(item.id);
        return;
      }
      rec.attempts = (rec.attempts || 0) + 1;
      rec.last_error = detail;
      if (rec.attempts < cfg.max_attempts) {
        rec.due = rec.due || t;
        writeAtomic(path.join(p.queue, `${item.id}.json`), JSON.stringify(rec, null, 1) + '\n');
        fs.rmSync(sentFile, { force: true });
        log(home, `${item.id} wake failed rc=${code}, retry next tick (${rec.attempts}/${cfg.max_attempts}): ${detail}`);
        res.retried.push(item.id);
      } else {
        fs.mkdirSync(p.failed, { recursive: true });
        writeAtomic(path.join(p.failed, `${item.id}.json`), JSON.stringify(rec, null, 1) + '\n');
        fs.rmSync(sentFile, { force: true });
        log(home, `${item.id} failed after ${rec.attempts} attempts: ${detail}`);
        res.failed.push(item.id);
      }
    });
  }
  // Resync every tick: starts, extends or releases the keep-awake assertion; status is
  // rewritten only when something changed so idle ticks stay quiet.
  withLock(home, () => {
    const t2 = now();
    const data = statusData(home, env, t2);
    const before = JSON.stringify(data.keep_awake);
    data.keep_awake = syncKeepAwake(home, data, env, t2);
    if (claimed.length || JSON.stringify(data.keep_awake) !== before) writeAtomic(p.status, JSON.stringify(data, null, 1) + '\n');
  });
  return res;
}

// ------------------------------------------------------------ status

function recent(dir, n = 10) {
  return readDir(dir).map((name) => readJson(path.join(dir, name), null)).filter(Boolean)
    .sort((a, b) => (a.delivered_at || a.queued_at || a.hit_at || 0) - (b.delivered_at || b.queued_at || b.hit_at || 0)).slice(-n);
}

// The scheduler.json shape (docs/CONTRACT.md). Times are epoch seconds; null means none.
export function statusData(home, env = process.env, t = now()) {
  const p = paths(home);
  const cfg = loadConfig(home, env);
  const items = pending(home);
  const rdue = resetDue(home, items, cfg, t);
  const limits = [
    ...items.filter((i) => i.kind === 'limit').map((i) => ({ window: i.window || null, reset: i.reset, wake: i.due, source: i.source, id: i.id })),
    ...quotaLimits(home, t).filter((q) => !items.some((i) => i.kind === 'limit' && Math.abs(i.reset - q.reset) <= DEDUPE_WINDOW))
      .map((q) => ({ window: q.window, reset: q.reset, wake: q.reset + cfg.margin, source: 'quota', id: null })),
  ].sort((a, b) => a.reset - b.reset);
  const sent = recent(p.sent).map((i) => ({ id: i.id, kind: i.kind, item: i.item || null, delivered_at: i.delivered_at || null }));
  const last = sent.filter((s) => s.delivered_at).pop() || null;
  return {
    version: 1,
    updated_at: t,
    enabled: !isOff(home, env),
    wake_command: Boolean(cfg.wake_command),
    next_reset: limits.length ? Math.max(...limits.map((l) => l.reset)) : null,
    reset_due: rdue || null,
    limits,
    pending: items.map((i) => ({
      id: i.id, kind: i.kind, due: effectiveDue(i, rdue) || null, message: i.message || render(i, t),
      item: i.item || null, ...(i.request ? { request: i.request } : {}), queued_at: i.queued_at || i.hit_at || null,
      ...(i.attempts ? { attempts: i.attempts } : {}),
    })).sort((a, b) => (a.due || 0) - (b.due || 0)),
    keep_awake: (() => { const a = readJson(p.awake, null); return a && a.until > t ? a : null; })(),
    last_delivery: last,
    sent,
    failed: recent(p.failed).map((i) => ({ id: i.id, kind: i.kind, item: i.item || null, attempts: i.attempts || 0, error: i.last_error || '' })),
  };
}

export function writeStatus(home, t = now(), env = process.env) {
  const data = statusData(home, env, t);
  data.keep_awake = syncKeepAwake(home, data, env, t);
  writeAtomic(paths(home).status, JSON.stringify(data, null, 1) + '\n');
  return data;
}

// ------------------------------------------------------------ keep awake (macOS)
// While anything is pending, hold exactly one `caffeinate -i -t <secs>` assertion: idle
// system sleep is blocked, the display may still sleep. It ends on its own at `until`
// (the last due item + slack), so a crashed scheduler never keeps the Mac up for good;
// every status write extends, replaces or kills it. No sudo, no pmset.
const AWAKE_SLACK = 300;

const awakeOps = (env) => ({
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

// Returns the assertion now held ({ pid, until }) or null. `ops` is injectable for tests.
export function syncKeepAwake(home, data, env = process.env, t = now(), ops = awakeOps(env)) {
  const p = paths(home);
  const cfg = loadConfig(home, env);
  const cur = readJson(p.awake, null);
  const held = cur && cur.pid && cur.until > t && ops.alive(cur.pid, ops.bin) ? cur : null;
  const want = cfg.keep_awake && data.enabled && data.pending.length > 0;
  if (!want) {
    if (held) { ops.stop(held.pid); log(home, `keep-awake released (pid ${held.pid})`); }
    if (cur) fs.rmSync(p.awake, { force: true });
    return null;
  }
  const until = Math.min(Math.max(t, ...data.pending.map((i) => i.due || t)) + AWAKE_SLACK, t + MAX_HORIZON);
  if (held && Math.abs(held.until - until) < 60) return held;
  if (held) ops.stop(held.pid);
  const pid = ops.start(ops.bin, until - t);
  if (!pid) { fs.rmSync(p.awake, { force: true }); return null; }
  const next = { pid, until };
  writeAtomic(p.awake, JSON.stringify(next) + '\n');
  log(home, `keep-awake until ${fmtTime(until)} (caffeinate -i pid ${pid})`);
  return next;
}

// ------------------------------------------------------------ install (launchd / systemd / cron)

export function launchdLabel(home, defaultHome) {
  return home === defaultHome ? 'dev.harbordeck.scheduler' : `dev.harbordeck.scheduler.${sha(home, 8)}`;
}

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function launchdPlist({ label, node, bin, home, envPath, interval = 60 }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- harbordeck scheduler: runs "harbordeck tick" every ${interval}s. Remove with "harbordeck scheduler uninstall". -->
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xml(label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(node)}</string>
    <string>${xml(bin)}</string>
    <string>tick</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HARBORDECK_HOME</key>
    <string>${xml(home)}</string>
    <key>PATH</key>
    <string>${xml(envPath)}</string>
  </dict>
  <key>StartInterval</key>
  <integer>${interval}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardErrorPath</key>
  <string>${xml(path.join(home, 'schedule', 'launchd.err'))}</string>
</dict>
</plist>
`;
}

export function systemdUnits({ node, bin, home, envPath, interval = 60 }) {
  const q = (s) => `"${String(s).replace(/(["\\])/g, '\\$1')}"`;
  return {
    service: `[Unit]\nDescription=harbordeck scheduler tick\n\n[Service]\nType=oneshot\nEnvironment=HARBORDECK_HOME=${q(home)}\nEnvironment=PATH=${q(envPath)}\nExecStart=${q(node)} ${q(bin)} tick\n`,
    timer: `[Unit]\nDescription=harbordeck scheduler tick every ${interval}s\n\n[Timer]\nOnBootSec=${interval}\nOnUnitActiveSec=${interval}\n\n[Install]\nWantedBy=timers.target\n`,
    cron: `* * * * * HARBORDECK_HOME=${q(home)} PATH=${q(envPath)} ${q(node)} ${q(bin)} tick`,
  };
}

export function hookSnippet(bin) {
  return JSON.stringify({ hooks: { StopFailure: [{ matcher: 'rate_limit', hooks: [{ type: 'command', command: `${bin} limit record` }] }] } }, null, 2);
}
