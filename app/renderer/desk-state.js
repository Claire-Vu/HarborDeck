/* Desk data and state: the snapshot from window.harbor, desk state kept per data directory, Later (defer) parking,
   and what the desk derives from items and fleet.json (crew, changes, pay, stamina, scheduler).
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

// ------------------------------------------------------------ data (replaced wholesale on every snapshot)
const bridge = window.harbor;
let SNAP = null; // the first snapshot is loaded by app.js
let ITEMS = [], RULES = {}, FLEET = {}, QUOTA = [], FILES = {}, SCHED = null, byId = {};
function setData(snap) {
  SNAP = snap; ITEMS = snap.items || []; RULES = snap.rules || {}; QUOTA = Array.isArray(snap.quota) ? snap.quota : [];
  FLEET = Object.assign({ firstmates: [], crew: [], regulars: [], tools: [], counts: {} }, snap.fleet || {});
  if (!FLEET.firstmates.length) FLEET.firstmates = [{ id: 'mate', label: 'First Mate', domain: 'everything' }];
  FILES = snap.files || {}; SCHED = snap.scheduler || null; byId = Object.fromEntries(ITEMS.map(i => [i.id, i]));
}
const KIND = { decision: 'Decision', review: 'Review', answer: 'Research', todo: 'Notice' };
const KINDS = { decision: 'Decisions', review: 'Reviews', answer: 'Research', todo: 'Notices' };
const ACTION_LABEL = { decide: 'decided', approve: 'approved', reject: 'rejected', 'needs-work': 'sent back', comment: 'noted', ask: 'asked', file: 'filed', request: 'ordered', defer: 'parked for later' };
const NAMES = ['Bosun Ferris', 'Painter Mabs', 'Scout Quill', 'Deckhand Rook', 'Rigger Tansy', 'Lookout Pell', 'Purser Wren', 'Cooper Idris', 'Pilot Marlow', 'Chandler Vey'];
const CAPS = ['#c8552d', '#e0b23a', '#4f8a5b', '#3b6f9e', '#8a3a7a', '#2d8a8a', '#a8632d', '#5a5fb0'];
const VALUE = { decision: 40, review: 30, answer: 15, todo: 25 };
const PRIO_MULT = { 1: 3, 2: 2, 3: 1.25, 4: 1 };
const PRIO_LABEL = { 1: 'critical', 2: 'high', 3: 'normal', 4: 'low' };
const G = window.HarborGame;

// ------------------------------------------------------------ state
// answers come from answers.jsonl (S.answers is a mirror, never persisted here); the rest is local desk state,
// kept per data directory. Prefs are shared by all directories.
const PREFS_KEY = 'harbor-deck-prefs';
const deskKey = () => `harbor-deck-desk:${SNAP.home}`;
const freshPrefs = () => ({ plain: false, sound: false, music: false, musicVol: 40, theme: 'auto', filter: 'all', tray: true });
// fun: the harbor game (harbor-game.js): cosmetics owned, ink and tune in use, stamp book, days at the desk, the tide goal
const freshFun = () => ({ owned: [], ink: 'red', track: 'harbor', badges: {}, spent: 0, dayCount: 0, lastDay: null, tide: null, bestRun: 0 });
const fresh = () => ({ day: 1, streak: 0, dayOpen: false, dayStart: 0, cash: 0, answers: [], items: {}, positions: {}, stowed: {}, current: null, tickets: { seen: {}, done: {} }, fun: freshFun(), prefs: freshPrefs() });
let S = fresh();
function loadState() {
  const prefs = S.prefs; S = fresh(); S.prefs = prefs;
  try { const raw = localStorage.getItem(deskKey()); if (raw) { const p = JSON.parse(raw); delete p.prefs; delete p.answers; if ((p.demoSeed || 0) === (SNAP.demoSeed || 0)) S = Object.assign(fresh(), p, { prefs }); } } catch (e) { /* in-memory only */ }
  S.demoSeed = SNAP.demoSeed || 0; // a freshly seeded demo always starts a fresh desk
  S.fun = Object.assign(freshFun(), S.fun);
  S.answers = (SNAP.answers || []).slice();
  for (const x of Object.values(S.items)) delete x.shown; // highlights last one look
}
const save = () => { try { const { answers, prefs, ...desk } = S; localStorage.setItem(deskKey(), JSON.stringify(desk)); localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ } };
const now = () => Math.floor(Date.now() / 1000);
const st = id => (S.items[id] ||= { status: null, read: false, awaiting: false, flags: {} });
let pending = null; // one held stamp line, flushed after the undo window
// Later (defer lines): an open item is parked until its latest defer's `until`, unless the agent rewrote it after
// the defer or the captain pulled it back early. Held (pending) lines count, so a Later is visible at once.
let deferMemo = { key: null, map: {} };
function defers() {
  const held = pending ? [pending.line, ...(pending.extra || []).map(e => e.line)] : [];
  const key = `${S.answers.length}:${held.map(l => l.id + l.at).join()}`;
  if (deferMemo.key !== key) { const map = {}; for (const a of [...S.answers, ...held]) if (a.action === 'defer') map[a.id] = a; deferMemo = { key, map }; }
  return deferMemo.map;
}
function deferredUntil(it) {
  const a = defers()[it.id]; if (!a || it.status !== 'open') return 0;
  if ((it.updated || it.created) > a.at || (st(it.id).undeferAt || 0) >= a.at) return 0;
  return a.until > now() ? a.until : 0;
}
const statusOf = it => st(it.id).status || (deferredUntil(it) ? 'later' : it.status);

// ------------------------------------------------------------ derived game data
const mateFor = it => FLEET.firstmates.find(f => f.id === it.from) || FLEET.firstmates[0] || { id: 'mate', label: 'First Mate' };
function crewName(id) { return NAMES[hash(id) % NAMES.length]; }
function crewColors(id) { return { cap: CAPS[hash(id) % CAPS.length], coat: CAPS[(hash(id) >> 3) % CAPS.length] }; }
function crewFor(it) {
  const linked = FLEET.crew.find(c => c.item === it.id); if (linked) return linked;
  // never credit an item to crew working on another project
  const mine = FLEET.crew.filter(c => c.firstmate === mateFor(it).id && (!c.project || c.project === it.project));
  const pool = mine.filter(c => it.kind === 'answer' ? /scout/.test(c.id) : !/scout/.test(c.id));
  const list = pool.length ? pool : mine;
  return list.length ? list[hash(it.stream || it.id) % list.length] : null;
}
const answersToday = () => S.answers.filter(a => a.at >= S.dayStart);
function regularDelta(a) { const it = byId[a.id]; if (!it) return null; const d = { decide: 2, approve: 2, file: 1, 'needs-work': -1, reject: -2 }[a.action]; return d == null ? null : { stream: it.stream || it.project, d }; }
function regularScore(r, todayOnly) { let s = todayOnly ? 0 : (r.shipped || 0) * 2 - (r.rework || 0); for (const a of (todayOnly ? answersToday() : S.answers)) { const x = regularDelta(a); if (x && x.stream === r.id) s += x.d; } return s; }
function consequence(a) {
  if (a.action === 'request') return `Order to ${mateLabel(a.to)}: "${a.note.slice(0, 70)}${a.note.length > 70 ? '…' : ''}"`;
  const it = byId[a.id]; if (!it) return `${a.id} → ${ACTION_LABEL[a.action] || a.action}`;
  const opt = it.options?.find(o => o.key === a.key);
  let tail = ACTION_LABEL[a.action] || a.action; if (opt) tail += `: ${opt.label}`;
  if (a.action === 'defer') tail += ` until ${fmtDate(a.until)} ${fmtTime(a.until)}`;
  if (a.note && a.action !== 'decide') tail += ` ("${a.note.slice(0, 60)}${a.note.length > 60 ? '…' : ''}")`;
  return `${it.title} → ${tail}`;
}
const mateLabel = id => FLEET.firstmates.find(f => f.id === id)?.label || id;
function unblocks(it) {
  const out = [];
  for (const c of FLEET.crew) if (c.item === it.id && c.state === 'waiting') out.push(`${crewName(c.id)} can finish "${c.task_title || c.task}"`);
  for (const t of FLEET.tools) if (t.item === it.id && t.state !== 'installed') out.push(`unlocks ${t.label}`);
  return out;
}
// Who's waiting: workers blocked or paused until the captain answers (the item's `waiting`, plus crew in fleet.json
// waiting on it). Each one lifts the item a priority step in the queue.
const waitingOn = it => [...new Set([...(it.waiting || []), ...FLEET.crew.filter(c => c.item === it.id && c.state === 'waiting').map(c => c.id)])];
const crewLabel = id => (FLEET.crew.some(c => c.id === id) ? crewName(id) : id);
const waitChip = it => { const w = waitingOn(it); return w.length ? h('span', { class: 'waitn', title: `${w.length} worker${w.length > 1 ? 's' : ''} paused until you answer: ${w.map(crewLabel).join(', ')}` }, h('span', { class: 'wi', 'aria-hidden': 'true' }, '⏸'), w.length) : null; };
const urgency = (a, b) => (prio(a) - waitingOn(a).length) - (prio(b) - waitingOn(b).length) || waitingOn(b).length - waitingOn(a).length || ((a.due || 9e12) - (b.due || 9e12)) || a.created - b.created;
// What changed (changes.js): the version the captain last looked at is kept in the desk state as `seen`.
const CH = HarborChanges;
const agentMsgs = it => [...(it.thread || []).filter(m => m.from !== 'captain'), ...(SNAP.notes || []).filter(n => n.item === it.id)];
const digestOf = it => CH.digest(it, it.body ? fileFor(it.body)?.text ?? null : null, agentMsgs(it));
const changesOf = it => CH.diff(S.items[it.id]?.seen, digestOf(it));
// The captain is looking at it now: remember this version. On the desk what was new stays lit (`shown`) while it is there.
function lookAt(it, keep) { const s = st(it.id); const d = changesOf(it); if (keep && d) s.shown = d; s.seen = digestOf(it); save(); return keep ? s.shown || null : d; }
const updChip = (it, d) => (d ? h('span', { class: 'upd', title: `Updated since you last looked: ${CH.describe(d)}` }, 'updated') : null);
function checksFor(it) { const map = {}; for (const c of it.checks || []) map[c.rule] = c; return (it.rules || []).map(k => ({ rule: k, check: map[k] })); }
const flaggedCount = it => (it.checks || []).filter(c => c.ok === false).length;
function payFor(it, action) {
  const basePay = VALUE[it.kind] * PRIO_MULT[prio(it)];
  let mult = 1, bonus = 0;
  if (it.due) { const hrs = (it.due - now()) / 3600; if (hrs >= 0 && hrs < 48) mult = 1.5; else if (hrs >= 48) mult = 1.2; if (hrs >= 0) bonus = .25; }
  if (action === 'comment') return 5;
  if (action === 'ask' || action === 'needs-work') return Math.round(basePay * .25);
  if (action === 'request' || action === 'defer') return 0;
  return Math.round(basePay * mult * (1 + bonus));
}
// stamina: one view per usage window from quota.json and the Claude Code status line, fresher reading wins (stamina.js)
const ST = window.HarborStamina;
const staminaViews = () => ST.views(QUOTA, { quotaAt: SNAP.quota_at, rates: SNAP.rates, t: now() });
const staminaMin = () => ST.lowest(staminaViews());
const staminaTitle = v => ST.title(v, { fmtTime, fmtDate });
const staminaWhen = ts => `${ts - now() > 20 * 3600 ? fmtDate(ts) + ' ' : ''}${fmtTime(ts)}`; // a time, dated when not today-ish
const tired = () => { const m = staminaMin(); return m != null && m < 20; };

// scheduler: requests queued for after the usage-limit reset or a time (scheduler.json via the main process)
const queuedRequests = () => (SCHED?.pending || []).filter(p => p.request && !S.answers.some(a => a.action === 'request' && a.id === p.request.id));
const { dur, nextClockEpoch } = window.HarborSchedule;
const queuedLabel = p => window.HarborSchedule.queuedLabel(p, SCHED, now(), fmtTime);
