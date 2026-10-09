/* Harbor Deck renderer: the Harbor Desk prototype, fed live from the data directory through window.harbor.
   Renders only from CONTRACT items (+ optional priority/due/from/checks/thread), rules.json, and the optional
   fleet.json / quota.json snapshots. Every captain action is one JSONL line appended to answers.jsonl; see emit(). */
(async () => {
'use strict';

// ------------------------------------------------------------ data (replaced wholesale on every snapshot)
const bridge = window.harbor;
if (!bridge) { document.body.textContent = 'Harbor Deck must run inside the desktop app (preload bridge missing).'; return; }
let SNAP = await bridge.snapshot();
let ITEMS = [], RULES = {}, FLEET = {}, QUOTA = [], FILES = {}, SCHED = null, byId = {};
function setData(snap) {
  SNAP = snap; ITEMS = snap.items || []; RULES = snap.rules || {}; QUOTA = Array.isArray(snap.quota) ? snap.quota : [];
  FLEET = Object.assign({ firstmates: [], crew: [], regulars: [], tools: [], counts: {} }, snap.fleet || {});
  if (!FLEET.firstmates.length) FLEET.firstmates = [{ id: 'mate', label: 'First Mate', domain: 'everything' }];
  FILES = snap.files || {}; SCHED = snap.scheduler || null; byId = Object.fromEntries(ITEMS.map(i => [i.id, i]));
}
setData(SNAP);
const KIND = { decision: 'Decision', review: 'Review', answer: 'Dispatch', todo: 'Notice' };
const KINDS = { decision: 'Decisions', review: 'Reviews', answer: 'Dispatches', todo: 'Notices' };
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
const freshPrefs = () => ({ plain: false, sound: false, music: false, musicVol: 40, theme: 'auto', filter: 'all', tab: 'window', tray: true });
// fun: the harbor game (harbor-game.js): cosmetics owned, ink and tune in use, stamp book, days at the desk, the tide goal
const freshFun = () => ({ owned: [], ink: 'red', track: 'harbor', badges: {}, spent: 0, dayCount: 0, lastDay: null, tide: null, bestRun: 0 });
const fresh = () => ({ day: 1, streak: 0, dayOpen: false, dayStart: 0, cash: 0, answers: [], items: {}, positions: {}, current: null, tickets: { seen: {}, done: {} }, fun: freshFun(), prefs: freshPrefs() });
let S = fresh();
function loadState() {
  const prefs = S.prefs; S = fresh(); S.prefs = prefs;
  try { const raw = localStorage.getItem(deskKey()); if (raw) { const p = JSON.parse(raw); delete p.prefs; delete p.answers; if ((p.demoSeed || 0) === (SNAP.demoSeed || 0)) S = Object.assign(fresh(), p, { prefs }); } } catch (e) { /* in-memory only */ }
  S.demoSeed = SNAP.demoSeed || 0; // a freshly seeded demo always starts a fresh desk
  S.fun = Object.assign(freshFun(), S.fun);
  S.answers = (SNAP.answers || []).slice();
}
try { S.prefs = Object.assign(freshPrefs(), JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')); } catch (e) { /* defaults */ }
loadState();
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

// ------------------------------------------------------------ helpers
const $ = sel => document.querySelector(sel);
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'style' && typeof v !== 'object') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
const icon = name => { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'ic'); const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', `#i-${name}`); svg.append(u); return svg; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hash = s => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; };
const fmtDate = ts => new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtTime = ts => new Date(ts * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const age = secs => { const s = Math.max(0, secs); if (s < 3600) return `${Math.round(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}h`; const d = Math.floor(s / 86400); return `${d}d${d < 3 ? ' ' + Math.floor((s % 86400) / 3600) + 'h' : ''}`; };
const sentences = text => (text || '').split(/(?<=[.!?])\s+(?=[A-Z"'(@$0-9])/).map(s => s.trim()).filter(Boolean);
const base = p => (p || '').split('/').pop();
const prio = it => it.priority || 3;
const money = n => '$' + Math.round(n).toLocaleString();
function toast(msg, cls) { const t = h('div', { class: `toast ${cls || ''}` }, msg); $('#toasts').append(t); setTimeout(() => t.remove(), 2800); }

function mdToHtml(md) {
  const lines = esc(md).split('\n'); let out = '', list = null, table = null, code = null;
  const inline = s => s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>').replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const close = () => { if (list) { out += `</${list}>`; list = null; } if (table) { out += '</tbody></table>'; table = null; } };
  for (const ln of lines) {
    let m;
    if (code != null) { if (ln.startsWith('```')) { out += `<pre><code>${code}</code></pre>`; code = null; } else code += ln + '\n'; continue; }
    if (ln.startsWith('```')) { close(); code = ''; continue; }
    if (ln.startsWith('|')) {
      const cells = ln.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (ln.match(/^\|[-:| ]+\|$/)) continue;
      if (!table) { close(); table = true; out += `<table><thead><tr>${cells.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>`; }
      else out += `<tr>${cells.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`;
      continue;
    }
    if ((m = ln.match(/^(#{1,4})\s+(.*)/))) { close(); out += `<h${m[1].length + 1} class="mdh" data-heading="${esc(m[2])}">${inline(m[2])}</h${m[1].length + 1}>`; }
    else if ((m = ln.match(/^\s*[-*]\s+(.*)/))) { if (list !== 'ul') { close(); list = 'ul'; out += '<ul>'; } out += `<li>${inline(m[1])}</li>`; }
    else if ((m = ln.match(/^\s*\d+\.\s+(.*)/))) { if (list !== 'ol') { close(); list = 'ol'; out += '<ol>'; } out += `<li>${inline(m[1])}</li>`; }
    else if (ln.trim() === '') close();
    else if (ln.startsWith('>')) { close(); out += `<blockquote>${inline(ln.slice(1))}</blockquote>`; }
    else { if (table) close(); out += `<p>${inline(ln)}</p>`; }
  }
  close(); return out;
}

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
function traits(c) {
  const t = []; const m = (c.model || '').toLowerCase();
  if (m.includes('opus')) t.push('Steady hand'); else if (m.includes('sonnet')) t.push('Quick stitch'); else if (m.includes('fable')) t.push('Storyteller'); else if (m) t.push('Second opinion');
  if (c.effort === 'low') t.push('Light touch'); else if (c.effort === 'medium') t.push('Even keel'); else if (c.effort) t.push('Deep diver');
  if ((c.rework || 0) === 0 && (c.shipped || 0) >= 3) t.push('Clean record'); else if ((c.rework || 0) >= 2) t.push('Second look');
  return t;
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
// quota: roll a stale reset forward by its window so the mock stays plausible on any day
const winSecs = w => { const m = String(w).match(/^(\d+)\s*([hdw])$/i); return m ? +m[1] * { h: 3600, d: 86400, w: 604800 }[m[2].toLowerCase()] : 86400; };
function quotaView(q) { const w = winSecs(q.window); let r = q.resets_at; const t = now(); if (r < t) r += Math.ceil((t - r) / w) * w; return { ...q, left: Math.max(0, 100 - (q.used_pct || 0)), resets: r, in: r - t }; }
const staminaMin = () => QUOTA.length ? Math.min(...QUOTA.map(q => quotaView(q).left)) : null;
const tired = () => { const m = staminaMin(); return m != null && m < 20; };

// scheduler: requests queued for after the usage-limit reset or a time (scheduler.json via the main process)
const queuedRequests = () => (SCHED?.pending || []).filter(p => p.request && !S.answers.some(a => a.action === 'request' && a.id === p.request.id));
const awakeUntil = () => (SCHED?.keep_awake && SCHED.keep_awake.until > now() ? SCHED.keep_awake.until : null);
const { dur, nextClockEpoch } = window.HarborSchedule;
const queuedLabel = p => window.HarborSchedule.queuedLabel(p, SCHED, now(), fmtTime);

// ------------------------------------------------------------ audio: desk sounds + generated harbor music
let actx = null;
const ctx = () => (actx ||= new (window.AudioContext || window.webkitAudioContext)());
function noise(dur) { const b = ctx().createBuffer(1, ctx().sampleRate * dur, ctx().sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = ctx().createBufferSource(); s.buffer = b; return s; }
function snd(kind, pitch = 1) {
  if (!S.prefs.sound) return;
  try {
    const t = ctx().currentTime, g = ctx().createGain(); g.connect(ctx().destination);
    if (kind === 'thud') { const o = ctx().createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140 * pitch, t); o.frequency.exponentialRampToValueAtTime(40 * pitch, t + .18); g.gain.setValueAtTime(.7, t); g.gain.exponentialRampToValueAtTime(.001, t + .25); o.connect(g); o.start(t); o.stop(t + .26); const n = noise(.08); const f = ctx().createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; n.connect(f); f.connect(g); n.start(t); }
    else if (kind === 'slide') { const n = noise(.35); const f = ctx().createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(2400, t + .3); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .35); n.connect(f); f.connect(g); n.start(t); }
    else if (kind === 'ding') { for (const [f, d] of [[880, 0], [1320, .05]]) { const o = ctx().createOscillator(); o.type = 'triangle'; o.frequency.value = f; const gg = ctx().createGain(); gg.gain.setValueAtTime(.18, t + d); gg.gain.exponentialRampToValueAtTime(.001, t + d + .6); o.connect(gg); gg.connect(ctx().destination); o.start(t + d); o.stop(t + d + .62); } }
    else if (kind === 'coin') { for (const [f, d] of [[1760, 0], [2217, .07]]) { const o = ctx().createOscillator(); o.type = 'square'; o.frequency.value = f * pitch; const gg = ctx().createGain(); gg.gain.setValueAtTime(.05, t + d); gg.gain.exponentialRampToValueAtTime(.001, t + d + .25); o.connect(gg); gg.connect(ctx().destination); o.start(t + d); o.stop(t + d + .3); } }
    else if (kind === 'tick') { const o = ctx().createOscillator(); o.type = 'square'; o.frequency.value = 1800; g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.001, t + .05); o.connect(g); o.start(t); o.stop(t + .06); }
    else if (kind === 'whistle') { const o = ctx().createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(1900, t); o.frequency.linearRampToValueAtTime(2300, t + .12); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + .03); g.gain.exponentialRampToValueAtTime(.001, t + .22); o.connect(g); o.start(t); o.stop(t + .24); }
    else if (kind === 'flip') { const n = noise(.12); const f = ctx().createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500; g.gain.setValueAtTime(.1, t); g.gain.exponentialRampToValueAtTime(.001, t + .12); n.connect(f); f.connect(g); n.start(t); }
  } catch (e) { /* no audio */ }
}
// Original ambient loop: slow pad chords (I - IV - vi - V-ish in D), filtered-noise surf, occasional gull chirp. Nothing sampled or fetched.
// It follows the desk: one more layer per item cleared today (bass, harp, bells, brushes, counter-melody), and it
// settles on the home chord with a rising chime once the harbor is clear. The chandlery sells a second tune.
const TRACKS = { harbor: [[146.8, 185, 220, 277.2], [196, 246.9, 293.7, 370], [123.5, 146.8, 185, 220], [110, 164.8, 220, 246.9]], night: [[146.8, 174.6, 220, 261.6], [116.5, 146.8, 174.6, 220], [174.6, 220, 261.6, 349.2], [130.8, 164.8, 196, 261.6]] };
const music = { on: false, master: null, nodes: [], timers: [], resolved: false };
function musicLayers(c, t, chord, n) {
  const tone = (f, at, len, type, vol) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; const g = c.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + .02); g.gain.exponentialRampToValueAtTime(.001, at + len); o.connect(g); g.connect(music.master); o.start(at); o.stop(at + len + .05); };
  if (n >= 1) { tone(chord[0] / 2, t + .1, 4.2, 'sine', .07); tone(chord[0] / 2, t + 4.6, 4.2, 'sine', .06); }
  if (n >= 2) for (let k = 0; k < 8; k++) tone(chord[k % 4] * 2, t + .5 + k * 1.05, .9, 'triangle', .025);
  if (n >= 3) for (const [j, d] of [[2, 1.2], [3, 5.7]]) tone(chord[j] * 4, t + d, 2.4, 'sine', .018);
  if (n >= 4) for (let k = 0; k < 16; k++) { const s = noise(.05); const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000; const g = c.createGain(); g.gain.value = k % 4 ? .012 : .022; s.connect(f); f.connect(g); g.connect(music.master); s.start(t + k * .5625); }
  if (n >= 5) for (const [j, d] of [[1, 0], [2, 2.25], [3, 4.5], [2, 6.75]]) tone(chord[j] * 3, t + d, 2, 'triangle', .015);
}
function musicResolve(c, t) { [587.3, 740, 880, 1174.7].forEach((f, k) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = c.createGain(); g.gain.setValueAtTime(0, t + k * .18); g.gain.linearRampToValueAtTime(.04, t + k * .18 + .02); g.gain.exponentialRampToValueAtTime(.001, t + k * .18 + 1.6); o.connect(g); g.connect(music.master); o.start(t + k * .18); o.stop(t + k * .18 + 1.7); }); }
function musicStart() {
  if (music.on) return; const c = ctx(); music.on = true;
  music.master = c.createGain(); music.master.gain.value = 0; music.master.connect(c.destination);
  music.master.gain.linearRampToValueAtTime(S.prefs.musicVol / 100 * .5, c.currentTime + 2);
  // surf: brown-ish noise through a slow-swelling lowpass
  const n = noise(4); n.loop = true; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; const sg = c.createGain(); sg.gain.value = .08;
  const lfo = c.createOscillator(); lfo.frequency.value = .09; const lg = c.createGain(); lg.gain.value = .05; lfo.connect(lg); lg.connect(sg.gain); lfo.start();
  n.connect(lp); lp.connect(sg); sg.connect(music.master); n.start(); music.nodes.push(n, lfo);
  // pad: chord every 9 s
  let i = 0; music.resolved = false;
  const pad = () => {
    if (!music.on) return; const t = c.currentTime; const chords = TRACKS[S.fun.track] || TRACKS.harbor; const clear = harborClear();
    const chord = clear ? chords[0] : chords[i++ % chords.length];
    if (clear && !music.resolved) musicResolve(c, t + .4); music.resolved = clear;
    musicLayers(c, t, chord, G.musicLayers(clearedToday()));
    for (const f of chord) for (const det of [-4, 4]) {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
      const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 900;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.035, t + 3); g.gain.setValueAtTime(.035, t + 6.5); g.gain.linearRampToValueAtTime(0, t + 10);
      o.connect(f2); f2.connect(g); g.connect(music.master); o.start(t); o.stop(t + 10.2);
    }
    music.timers.push(setTimeout(pad, 9000));
  };
  pad();
  const gull = () => { if (!music.on) return; const t = c.currentTime; const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(1500, t); o.frequency.linearRampToValueAtTime(2300, t + .12); o.frequency.linearRampToValueAtTime(1300, t + .35); const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.03, t + .06); g.gain.linearRampToValueAtTime(0, t + .4); o.connect(g); g.connect(music.master); o.start(t); o.stop(t + .45); music.timers.push(setTimeout(gull, 9000 + Math.random() * 18000)); };
  music.timers.push(setTimeout(gull, 5000));
}
function musicStop() { if (!music.on) return; music.on = false; const c = ctx(); music.master.gain.linearRampToValueAtTime(0, c.currentTime + 1.2); music.timers.forEach(clearTimeout); music.timers = []; const m = music.master, nodes = music.nodes; music.nodes = []; setTimeout(() => { nodes.forEach(n => { try { n.stop(); } catch (e) {} }); m.disconnect(); }, 1500); }
function musicVolume() { if (music.on && music.master) music.master.gain.linearRampToValueAtTime(S.prefs.musicVol / 100 * .5, ctx().currentTime + .2); }

// ------------------------------------------------------------ answers (UI -> agent)
function emit(line) {
  line.note ??= ''; line.at = now();
  if (!writeLine(line)) return line;
  $('#log-count').textContent = S.answers.length;
  if ($('#agentlog').classList.contains('open')) renderLog();
  return line;
}
// One append to answers.jsonl; the watcher's next snapshot re-reads the file, so the mirror stays exact.
function writeLine(line) {
  const r = bridge.appendAnswer(line);
  if (!r?.ok) { toast(`Could not write answers.jsonl: ${r?.error || 'unknown error'}`, 'warn'); return false; }
  S.answers.push(JSON.parse(r.line)); return true;
}
const jsonl = () => S.answers.map(a => JSON.stringify(a)).join('\n') + (S.answers.length ? '\n' : '');
const UNDO_MS = 4000;
function earn(it, action, pitch) { const n = payFor(it, action); if (!n) return; S.cash += n; save(); $('#cash-n').textContent = money(S.cash); snd('coin', pitch); toast(`+${money(n)}`, 'cash'); }

// ------------------------------------------------------------ queue + visitors
function queueItems() {
  const f = S.prefs.filter;
  return quick.laneSort(ITEMS.filter(i => statusOf(i) === 'open' && (f === 'all' || i.kind === f))
    .sort((a, b) => (st(a.id).awaiting - st(b.id).awaiting) || prio(a) - prio(b) || ((a.due || 9e12) - (b.due || 9e12)) || a.created - b.created || a.id.localeCompare(b.id, undefined, { numeric: true })));
}
function spriteSVG(id, kind, opts = {}) {
  const { cap, coat } = opts.reg || crewColors(id); const mate = opts.mate; const zz = opts.tired || opts.nap; const skin = opts.reg?.skin || '#f0c9a0';
  const cargo = {
    decision: `<rect x="17" y="13" width="9" height="8" fill="#b07a3a"/><rect x="17" y="16" width="9" height="1" fill="#7a4e1e"/><rect x="20" y="14" width="3" height="3" fill="#a3302c"/>`,
    review: `<rect x="17" y="12" width="9" height="9" fill="#333"/><circle cx="21.5" cy="16.5" r="3" fill="#777"/><circle cx="21.5" cy="16.5" r="1" fill="#333"/>`,
    answer: `<rect x="18" y="8" width="4" height="14" fill="#c9a66b"/><rect x="18" y="8" width="4" height="2" fill="#8a3a3a"/><rect x="18" y="20" width="4" height="2" fill="#8a3a3a"/>`,
    todo: `<rect x="17" y="11" width="8" height="10" fill="#e9e2cf"/><rect x="19" y="10" width="4" height="2" fill="#555"/><rect x="18" y="14" width="6" height="1" fill="#888"/><rect x="18" y="16" width="6" height="1" fill="#888"/>`,
    reply: `<rect x="17" y="13" width="9" height="6" fill="#f4efe0"/><path d="M17 13 L21.5 17 L26 13" stroke="#888" fill="none"/>`,
    slip: `<rect x="17" y="12" width="8" height="10" fill="#f1d9d6"/><rect x="18" y="14" width="6" height="1" fill="#a66"/><rect x="18" y="16" width="6" height="1" fill="#a66"/>`,
    pot: `<rect x="15" y="13" width="1" height="6" fill="#ccc"/><rect x="16" y="19" width="11" height="7" fill="#333"/><rect x="15" y="18" width="13" height="2" fill="#555"/><g class="steam"><rect x="19" y="14" width="1" height="2" fill="#ddd" opacity=".8"/><rect x="23" y="12" width="1" height="2" fill="#ddd" opacity=".6"/><rect x="21" y="10" width="1" height="2" fill="#ddd" opacity=".4"/></g>`,
    tray: `<rect x="15" y="15" width="11" height="2" fill="#ddd"/><rect x="18" y="12" width="5" height="3" fill="#e9c46a"/><rect x="19" y="11" width="3" height="1" fill="#c0392b"/>`,
    mug: `<rect x="15" y="14" width="4" height="4" fill="#e9e2cf"/><rect x="19" y="15" width="1" height="2" fill="#e9e2cf"/><rect x="16" y="12" width="1" height="1" fill="#ddd" opacity=".7"/>`
  }[kind] || '';
  const hats = [`<rect x="5" y="2" width="8" height="3" fill="${cap}"/><rect x="4" y="4" width="10" height="1" fill="${cap}"/>`, `<rect x="4" y="3" width="10" height="2" fill="${cap}"/><rect x="6" y="2" width="6" height="1" fill="${cap}"/><rect x="9" y="1" width="1" height="1" fill="${cap}"/>`,
    `<rect x="5" y="3" width="8" height="2" fill="${cap}"/><rect x="13" y="4" width="2" height="1" fill="${cap}"/><rect x="14" y="5" width="1" height="2" fill="${cap}"/>`, `<rect x="6" y="0" width="6" height="4" fill="#2b2318"/><rect x="6" y="3" width="6" height="1" fill="${cap}"/><rect x="4" y="4" width="10" height="1" fill="#2b2318"/>`];
  const hat = mate ? `<rect x="4" y="1" width="10" height="4" fill="#1d2a38"/><rect x="3" y="5" width="12" height="1" fill="#0e151e"/><rect x="8" y="2" width="2" height="2" fill="#f2b544"/>` : hats[opts.reg?.hat || 0];
  const eyes = zz ? `<rect x="7" y="8" width="2" height="1" fill="#222"/><rect x="10" y="8" width="2" height="1" fill="#222"/><text x="14" y="6" font-size="4" fill="#fff" font-family="monospace" class="zz">z z</text>`
    : opts.sad ? `<rect x="7" y="7" width="1" height="1" fill="#222"/><rect x="10" y="7" width="1" height="1" fill="#222"/><rect x="6" y="6" width="2" height="1" fill="#222" opacity=".6"/><rect x="10" y="6" width="2" height="1" fill="#222" opacity=".6"/>`
    : `<rect x="7" y="7" width="1" height="1" fill="#222"/><rect x="10" y="7" width="1" height="1" fill="#222"/>`;
  const mouth = opts.happy ? `<rect x="7" y="9" width="1" height="1" fill="#a66"/><rect x="8" y="10" width="2" height="1" fill="#a66"/><rect x="10" y="9" width="1" height="1" fill="#a66"/>` : opts.sad ? `<rect x="8" y="10" width="2" height="1" fill="#a66"/><rect x="7" y="11" width="1" height="1" fill="#a66"/><rect x="10" y="11" width="1" height="1" fill="#a66"/>` : `<rect x="8" y="9" width="2" height="1" fill="#a66"/>`;
  const body = mate ? '#1d2a38' : coat;
  const sweat = opts.sweat ? `<g class="drop"><rect x="14" y="5" width="1" height="1" fill="#5bc0ff"/><rect x="13" y="6" width="2" height="2" fill="#5bc0ff"/></g>` : '';
  const leftArm = opts.watch ? `<rect x="2" y="10" width="2" height="4" fill="${body}"/><rect x="1" y="8" width="3" height="2" fill="#333"/><rect x="2" y="8" width="1" height="1" fill="#ddd"/>` : `<rect x="2" y="12" width="2" height="6" fill="${body}"/>`;
  const legs = opts.sit ? `<rect x="5" y="20" width="3" height="3" fill="#2a2a3a"/><rect x="10" y="20" width="3" height="3" fill="#2a2a3a"/><rect x="2" y="23" width="14" height="5" fill="#b07a3a"/><rect x="2" y="25" width="14" height="1" fill="#7a4e1e"/>`
    : `<rect x="5" y="20" width="3" height="6" fill="#2a2a3a"/><rect x="10" y="20" width="3" height="6" fill="#2a2a3a"/><rect x="4" y="26" width="5" height="2" fill="#111"/><rect x="9" y="26" width="5" height="2" fill="#111"/>`;
  return `<svg viewBox="0 0 28 28" class="visitor${mate ? ' mate' : ''}" shape-rendering="crispEdges" aria-hidden="true">
    ${hat}<rect x="5" y="5" width="8" height="6" fill="${skin}"/>${eyes}${mouth}${sweat}
    <rect x="4" y="11" width="10" height="9" fill="${body}"/><rect x="8" y="12" width="2" height="7" fill="rgba(255,255,255,.25)"/>${mate ? '<rect x="5" y="12" width="2" height="2" fill="#f2b544"/>' : ''}
    ${leftArm}<rect x="14" y="12" width="2" height="5" fill="${body}"/><rect x="14" y="17" width="3" height="2" fill="${skin}"/>
    ${legs}${cargo}</svg>`;
}
const prioChip = it => h('span', { class: `prio p${prio(it)}`, title: `priority ${prio(it)}: ${PRIO_LABEL[prio(it)]}` }, `P${prio(it)}`);
const dueChip = it => { if (!it.due) return null; const d = it.due - now(); return h('span', { class: `due ${d < 0 ? 'over' : d < 86400 ? 'soon' : ''}`, title: `due ${fmtDate(it.due)} ${fmtTime(it.due)}` }, d < 0 ? `overdue ${age(-d)}` : `due ${age(d)}`); };
// topics, notes and bundles (topic-view.js)
const topicView = window.HarborTopicView({ h, modal, toast, fmtDate, fmtTime, KIND, ACTION_LABEL, prioChip, mateLabel, st, save, paper, statusOf, openItem, finishStamp, focus: id => { S.current = id; st(id).read = true; },
  data: () => ({ topics: SNAP.topics || {}, byId, notes: SNAP.notes || [] }), openArtifact: a => ['pr', 'link'].includes(artType(a)) ? openUrl(a.url) : openViewer(a) });
// the living harbor, the ship cat, the chandlery and the ships-out recap (harbor-scene.js)
const harbor = window.HarborScene({ h, G, modal, fmtDate, fmtTime, money, fun: () => S.fun, cash: () => S.cash, buy, equip });
const bundleOf = it => topicView.groups(queueItems().filter(i => !st(i.id).awaiting)).get(it.id) || [it];
const choiceOf = it => st(it.id).choice || it.options?.find(o => o.recommended)?.key || null;
// quick calls: letter keys, question sheet, lanes, weights, Later, take-all-recommended (quick-call.js)
const quick = window.HarborQuickCall({ h, icon, KIND, st, save, paper, toast, modal, closeModal, prioChip, choiceOf, artType: a => artType(a), bodyArtifact: b => bodyArtifact(b),
  inspectOption: (e, it, o) => { if (document.body.classList.contains('inspect')) { e.preventDefault(); pickFact({ type: 'claim', label: o.label, anchor: { claim: o.label, option: o.key } }, e.currentTarget); } },
  focusRow: id => focusRow(id), pick: id => afterPick(id), stampSheet: () => stamp('approve'), sheetCount: () => sheetCount() });
function openItem(id) { const it = byId[id]; if (!it) return; closeModal(); if (S.prefs.plain || statusOf(it) !== 'open' || st(id).awaiting) modal('viewer', it.title, plainCard(it, true)); else { stepUp(id); selectTab('window'); } }
function renderFilters() {
  const counts = { all: 0 }; for (const i of ITEMS) if (statusOf(i) === 'open') { counts.all++; counts[i.kind] = (counts[i.kind] || 0) + 1; }
  $('#filters').replaceChildren(...['all', 'decision', 'review', 'answer', 'todo'].filter(k => k === 'all' || counts[k] || S.prefs.filter === k).map(k =>
    h('button', { class: 'chip', 'aria-pressed': String(S.prefs.filter === k), onclick: () => { S.prefs.filter = k; save(); renderAll(); } }, k === 'all' ? 'All' : KINDS[k], ` ${counts[k] || 0}`)));
  $('#tab-window-count').textContent = counts.all; $('#tab-topics-count').textContent = topicView.openCount();
}
function renderQueue() {
  const list = queueItems(); const ul = $('#queue'); ul.replaceChildren(); const groups = topicView.groups(list.filter(i => !st(i.id).awaiting));
  const heads = list.filter(it => (groups.get(it.id) || [it])[0] === it); const lanes = new Set(heads.map(it => it.project || 'general'));
  let lane = null;
  for (const it of list) {
    const s = st(it.id); const m = mateFor(it); const c = crewFor(it); const flagged = flaggedCount(it); const g = groups.get(it.id) || [it];
    if (g[0] !== it) continue; // bundle members ride with the first
    const p = it.project || 'general';
    if (lanes.size > 1 && p !== lane) { lane = p; ul.append(h('li', { class: 'q-lane', 'aria-hidden': 'true' }, h('span', null, p), h('span', null, heads.filter(x => (x.project || 'general') === p).length))); }
    ul.append(h('li', { 'aria-current': String(g.some(x => x.id === S.current)), tabindex: 0, class: `${s.awaiting ? 'away' : ''} p${prio(it)}`, onclick: () => stepUp(it.id), onkeydown: e => { if (e.key === 'Enter') stepUp(it.id); } },
      h('div', { html: (w => spriteSVG(w.id, it.kind, { mate: w.mate, reg: w.reg, ...face(w), tired: tired() }))(whoBrings(it)) }),
      h('div', null,
        h('div', { class: 'q-title' }, !s.read && h('span', { class: 'unread-dot', title: 'unread' }), h('span', null, it.title), g.length > 1 ? h('span', { class: 'bundle-n', title: `bundle: ${g.map(x => x.title).join(' · ')}` }, `+${g.length - 1}`) : null, quick.weightIcons(g)),
        h('div', { class: 'q-meta' }, prioChip(it), h('span', { class: `tag ${it.kind}` }, KIND[it.kind]), topicView.chip(it), dueChip(it), flagged ? h('span', { class: 'flag', title: `${flagged} standing order flagged` }, `⚠${flagged}`) : null, h('span', { class: 'via' }, c ? `via ${crewName(c.id)}` : m.label, s.awaiting ? ' · away' : '')))));
  }
  if (!list.length) ul.append(h('li', { class: 'q-empty' }, 'Nobody at the window.'));
  const later = ITEMS.filter(i => statusOf(i) === 'later').sort((a, b) => deferredUntil(a) - deferredUntil(b));
  if (later.length) {
    ul.append(h('li', { class: 'q-lane later' }, h('span', null, 'Later'), h('span', null, later.length)));
    for (const it of later) ul.append(h('li', { class: 'q-later', tabindex: 0, title: 'Parked with the Later stamp. Click to bring it back now.', onclick: () => unpark(it.id), onkeydown: e => { if (e.key === 'Enter') unpark(it.id); } },
      h('span', { class: 'q-title' }, it.title), h('span', { class: 'q-meta' }, `back ${fmtDate(deferredUntil(it))} ${fmtTime(deferredUntil(it))}`)));
  }
  $('#btn-next').disabled = !list.some(i => !st(i.id).awaiting);
}
function impatience(it) {
  const ageD = (now() - it.created) / 86400; const dueH = it.due ? (it.due - now()) / 3600 : null;
  if ((dueH != null && dueH < 12) || ageD > 14) return 2; if ((dueH != null && dueH < 48) || ageD > 1) return 1; return 0;
}
// Crew on the item bring it themselves; otherwise the project's regular does (F2), with a mood and a memory of your recent calls.
const callsOn = project => S.answers.filter(a => byId[a.id]?.project === project).map(a => ({ action: a.action, at: a.at }));
function whoBrings(it) {
  const c = crewFor(it); if (c) return { id: c.id, name: crewName(c.id), mate: false };
  const r = G.regular(it.project); const calls = callsOn(it.project);
  return { id: r.id, name: r.name, mate: false, reg: r, mood: G.mood(calls, now()), memory: G.memory(calls, now()) };
}
const face = who => (who.mood === 'cheerful' ? { happy: true } : who.mood === 'grumpy' ? { sad: true } : {});
const present = () => ITEMS.filter(i => statusOf(i) === 'open' && !st(i.id).awaiting);
const harborClear = () => ITEMS.length > 0 && !present().length;
const clearedToday = () => Object.values(S.items).filter(s => s.status === 'resolved' && s.verdict && s.verdict.at >= S.dayStart).length;
const tideNow = () => G.tide(QUOTA.map(q => ({ ...quotaView(q), secs: winSecs(q.window) })));
function renderHarbor() {
  const t = now(); const goal = G.tideGoal(S.fun.tide, t, tideNow()); if (JSON.stringify(goal) !== JSON.stringify(S.fun.tide)) { S.fun.tide = goal; save(); }
  harbor.render({ t, open: ITEMS.filter(i => statusOf(i) === 'open'), stamina: staminaMin(), tide: tideNow(), goal, owned: S.fun.owned, days: S.fun.dayCount });
}
function renderWindowScene() {
  const w = $('#at-window'); w.replaceChildren(); w.className = 'at-window';
  const tz = tired(); const it = byId[S.current]; const t0 = now();
  // queue outside the window: one sprite per item waiting on the captain (not the one at the counter)
  const present = queueItems().filter(i => !st(i.id).awaiting); const groups = topicView.groups(present); const mine = groups.get(S.current) || [];
  const line = present.filter(i => !mine.includes(i) && groups.get(i.id)[0] === i);
  renderHarbor();
  const pq = $('#pier-queue'); pq.replaceChildren();
  // the ship cat (F8) sits on the most urgent visitor outside: highest priority, then the most impatient
  const urgent = line.slice(0, 7).reduce((a, b) => ((prio(b) - prio(a) || impatience(a) - impatience(b)) < 0 ? b : a), line[0]);
  line.slice(0, 7).forEach((i, n) => {
    const who = whoBrings(i); const lvl = impatience(i);
    const label = `${who.name}${who.mood ? ` (${who.mood})` : ''} · ${i.title} · waiting ${age(t0 - i.created)}${i.due ? ` · due ${age(i.due - t0)}` : ''}${lvl === 2 ? ' · very impatient' : lvl === 1 ? ' · getting impatient' : ''}${i === urgent ? ' · the cat says: this one first' : ''}`;
    const el = h('div', { class: `pq ${lvl ? 'tap' : ''} ${lvl === 2 ? 'fast' : ''}${i === urgent ? ' urgent' : ''}`, title: label, 'aria-label': label, style: `animation-delay:${(n * 137) % 600}ms`, onclick: () => stepUp(i.id), html: spriteSVG(who.id, i.kind, { mate: who.mate, reg: who.reg, ...face(who), tired: tz, sweat: lvl >= 1, watch: lvl === 2 }) });
    if (i === urgent) el.append(harbor.cat('on-visitor', S.fun.owned.includes('bell')));
    pq.append(el);
  });
  if (!line.length) pq.append(harbor.cat('on-pier', S.fun.owned.includes('bell'), true));
  if (line.length > 7) pq.append(h('div', { class: 'pq-more', title: `${line.length - 7} more waiting` }, `+${line.length - 7}`));
  pq.setAttribute('aria-label', `${line.length} waiting outside the window`);
  if (!it || statusOf(it) !== 'open') { w.append(h('div', { class: 'empty' }, line.length ? 'N: next at the window' : 'The pier is quiet')); return; }
  const m = mateFor(it); const who = whoBrings(it);
  w.append(h('div', { class: 'speech', title: `${m.label} · ${KIND[it.kind].toLowerCase()}` }, quick.ask(it, mine.length > 1 ? mine : [it]), who.reg ? h('small', { class: 'memory', title: `${who.name}, ${who.mood}` }, `${who.name}: ${who.memory}`) : h('small', null, who.mate ? m.label : `from ${who.name}`)),
    h('div', { class: 'walk', title: `${who.name} at the window`, html: spriteSVG(who.id, it.kind, { mate: who.mate, reg: who.reg, ...face(who), tired: tz, sweat: impatience(it) === 2 }) }));
}
function renderYard() {
  const yard = $('#yard'); if (!yard) return; yard.replaceChildren(); const tz = tired();
  const galley = h('div', { class: 'zone galley', 'aria-label': 'Galley: crew cooking' }, h('span', { class: 'zone-l' }, 'galley'), h('div', { class: 'stove', html: '<svg viewBox="0 0 24 20" shape-rendering="crispEdges"><rect x="2" y="8" width="20" height="12" fill="#4a4f58"/><rect x="4" y="10" width="7" height="6" fill="#222"/><rect x="13" y="10" width="7" height="6" fill="#c0392b" class="fire"/><rect x="18" y="0" width="3" height="8" fill="#333"/><g class="smoke"><rect x="19" y="-3" width="1" height="2" fill="#aaa" opacity=".6"/></g></svg>' }));
  const pier = h('div', { class: 'zone pier', 'aria-label': 'Pier: idle crew' }, h('span', { class: 'zone-l' }, 'pier'));
  for (const c of FLEET.crew) {
    const name = crewName(c.id);
    if (c.state === 'working') galley.append(h('div', { class: `yc cook ${tz ? 'slow' : ''}`, title: `${name} cooking: ${c.task_title || c.task}`, 'aria-label': `${name} cooking ${c.task_title || c.task}`, html: spriteSVG(c.id, 'pot', { tired: tz }) }));
    else if (c.state === 'done') galley.append(h('div', { class: 'yc pass', title: `${name}: ready at the pass (${c.task_title || c.task})`, 'aria-label': `${name} ready at the pass`, html: spriteSVG(c.id, 'tray', { tired: tz, happy: true }) }));
    else if (c.state === 'idle') { const nap = hash(c.id) % 2 === 0; pier.append(h('div', { class: `yc idle ${nap ? 'nap' : 'lounge'}`, title: `${name}: ${nap ? 'napping' : 'lounging'} (idle)`, 'aria-label': `${name} idle`, html: spriteSVG(c.id, nap ? '' : 'mug', { sit: true, nap, tired: tz }) })); }
  }
  yard.append(galley, pier);
}
function stepUp(id) {
  const it = byId[id]; if (!it) return;
  if (st(id).awaiting) { toast(`${it.title}: away, waiting on ${mateFor(it).label}`); return; }
  S.current = id; st(id).read = true; save(); snd('slide'); renderAll();
}
// The sheet's row in focus is the item at the desk; moving rows keeps the papers still (renderDesk 'calm').
function focusRow(id) { const it = byId[id]; if (!it || st(id).awaiting) return; S.current = id; st(id).read = true; save(); renderAll(); }
function unpark(id) { const s = st(id); s.undeferAt = now(); save(); snd('slide'); stepUp(id); }
// A letter (or click) picked an option on `id`: on a sheet move to the next row, else just mark it on the slip.
function afterPick(id) {
  const it = byId[id]; snd('tick'); const group = bundleOf(it);
  if (group.length > 1) { const nx = group[group.indexOf(it) + 1]; if (nx && id === S.current) focusRow(nx.id); else if (id !== S.current) focusRow(id); else renderDesk(); }
  else quick.mark($('#desk-surface .paper.ask'), st(id).choice);
}
function sheetCount() { const it = byId[S.current]; const n = it ? bundleOf(it).filter(m => !st(m.id).skipBundle).length : 0; const el = $('#desk-surface .sheet-n'); if (el) el.textContent = `${n} row${n === 1 ? '' : 's'}`; }
function pickLetter(i) {
  const it = byId[S.current]; if (!it || statusOf(it) !== 'open' || st(it.id).awaiting) return;
  const o = it.kind === 'decision' && it.options?.[i];
  if (!o) { toast(it.kind === 'decision' ? `No option ${quick.LETTERS[i]} here.` : 'Letters pick options on decisions; Space stamps this one.'); return; }
  st(it.id).choice = o.key; save(); afterPick(it.id);
}
function moveRow(d) { const it = byId[S.current]; if (!it) return; const g = bundleOf(it); const nx = g[g.indexOf(it) + d]; if (nx) focusRow(nx.id); }
function next() { const list = queueItems().filter(i => !st(i.id).awaiting && i.id !== S.current); if (list.length) stepUp(list[0].id); else { S.current = null; save(); renderAll(); } }

// ------------------------------------------------------------ desk papers
let inspectPick = null;
function renderDesk() {
  const surf = $('#desk-surface'); sheetScroll = surf.querySelector('.paper.qsheet')?.scrollTop ?? null; surf.replaceChildren();
  const it = byId[S.current];
  if (!it || statusOf(it) !== 'open') {
    lastDeskGroup = null;
    surf.append(h('div', { class: 'desk-hint' }, !ITEMS.length ? h('span', null, 'Nothing in ', h('code', null, `${SNAP.home}/items/`), ' yet. Connect an agent (see the README), or ', h('button', { class: 'tbtn', onclick: async () => { applySnapshot(await bridge.demo(true)); } }, 'load the demo day'), '.') : S.dayOpen ? 'Desk is clear. Pick someone at the window, or write a new order under Requests.' : 'The office is closed. Open the day from the morning manifest.'));
    renderTray(null); return;
  }
  const s = st(it.id); const papers = []; const claims = sentences(it.summary); const m = mateFor(it); const c = crewFor(it);
  papers.push(paper('manifest', `${KIND[it.kind]} manifest`, [
    h('div', { class: 'm-top' }, prioChip(it), dueChip(it), h('span', { class: 'spacer' }), h('span', { class: 'pay', title: 'pays on stamp (value × priority × urgency)' }, money(payFor(it, 'decide')))),
    h('h3', null, it.title),
    h('div', { class: 'meta' }, `${it.project}${it.stream ? ' · ' + it.stream : ''} · ${fmtDate(it.created)} · ${m.label}${c ? ', via ' + crewName(c.id) : ''} `, topicView.chip(it)),
    it.rules?.length ? h('div', { class: 'check-row' }, checksFor(it).map(({ rule, check }) => h('button', { class: `chk ${check ? (check.ok ? 'ok' : 'flag') : 'none'}`, title: `${rule}: ${check ? (check.ok ? 'passed' : 'FLAGGED') + ' · ' + check.note : 'tagged, not auto-checked'}`, onclick: () => openDrawer('orders') }, check ? (check.ok ? '✓' : '⚠') : '§', ' ', rule))) : null,
    (it.checks || []).some(x => x.ok === false) ? h('div', { class: 'flag-note' }, (it.checks || []).filter(x => x.ok === false).map(x => h('div', null, '⚠ ', x.note))) : null,
    h('p', { class: 'claims' }, claims.map((cl, i) => h('span', { class: `fact ${s.flags[i] === 'match' ? 'matched' : s.flags[i] === 'flag' ? 'flagged' : ''}`, onclick: e => pickFact({ type: 'claim', label: cl, anchor: { claim: cl }, idx: i }, e.currentTarget) }, cl, ' ')))
  ], 'm'));
  const seen = new Set();
  const arts = [...(it.artifacts || [])]; if (it.body && !arts.some(a => (a.path || a.url) === it.body)) arts.unshift(bodyArtifact(it.body, true));
  arts.forEach((a, i) => { const key = a.path || a.url; if (seen.has(key)) return; seen.add(key); const p = artifactPaper(it, a, i); if (p) papers.push(p); });
  // the main artifact fills the blotter; cards that only open something elsewhere (PR, link, web page) stay small
  const reading = papers.find(p => p.dataset.pid !== 'm' && !p.classList.contains('prcard')); reading?.classList.add('reading');
  const thread = threadFor(it);
  if (thread.length) papers.push(paper('thread', 'Correspondence', thread.map(x => h('div', { class: 'msg' }, h('div', { class: 'who' }, `${x.from} · ${fmtDate(x.at)} ${fmtTime(x.at)}`), h('div', null, x.text), x.anchor && h('div', { class: 'anchor' }, anchorText(x.anchor)))), 't'));
  const group = bundleOf(it);
  papers.push(group.length > 1 ? quick.sheet(it, group, { awaiting: s.awaiting }) : askSlip(it));
  // Moving between rows of one sheet keeps the papers still: no deal-in animation, the sheet keeps its scroll.
  const gk = group.map(m => m.id).join(' '); const calm = gk === lastDeskGroup; lastDeskGroup = gk;
  surf.classList.toggle('calm', calm);
  const pos = S.positions[it.id] || {};
  papers.forEach((p, i) => { p.style.zIndex = 10 + i; p.style.animationDelay = (i * 70) + 'ms'; makeDraggable(p, it.id); surf.append(p); });
  layoutPapers(papers, surf, pos);
  const sh = surf.querySelector('.paper.qsheet');
  if (sh) { if (calm && sheetScroll != null) sh.scrollTop = sheetScroll; sh.querySelector('.b-row.cur')?.scrollIntoView({ block: 'nearest' }); sheetCount(); }
  renderTray(it);
}
let lastDeskGroup = null, sheetScroll = null;
// Papers never overlap: the manifest and the ask (slip or sheet) stack on the left, the main artifact fills the
// reading column, and the rest stack in a side column (or under the reading paper when the desk is narrow).
// A paper the captain dragged keeps its spot. Below 860 px the CSS flows papers instead.
function layoutPapers(papers, surf, pos) {
  if (window.innerWidth <= 860) return;
  const W = surf.clientWidth || 900, H = surf.clientHeight || 600, G = 14, X0 = 16, Y0 = 16;
  const at = (p, x, y, w, hMax) => { if (w) p.style.width = w + 'px'; if (hMax) p.style.maxHeight = Math.max(120, hMax) + 'px'; const u = pos[p.dataset.pid]; p.style.left = (u ? Math.max(0, Math.min(u.x, W - 120)) : x) + 'px'; p.style.top = (u ? Math.max(0, Math.min(u.y, H - 60)) : y) + 'px'; };
  const man = papers.find(p => p.dataset.pid === 'm'), ask = papers.find(p => p.dataset.pid === 'ask');
  const reading = papers.find(p => p.classList.contains('reading'));
  const rest = papers.filter(p => p !== man && p !== ask && p !== reading);
  const leftW = ask?.classList.contains('qsheet') ? Math.min(440, Math.max(340, W * .36)) : 320;
  man.style.width = leftW + 'px'; man.style.maxHeight = (H * .42) + 'px';
  const manH = Math.min(man.offsetHeight, H * .42);
  at(man, X0, Y0, leftW); at(ask, X0, Y0 + manH + G, leftW, H - Y0 * 2 - manH - G);
  const rx = X0 + leftW + G * 1.5, sideW = 290;
  const roomForSide = rest.length && W - rx - X0 >= 420 + G + sideW;
  const readW = Math.max(260, Math.min(820, W - rx - X0 - (roomForSide ? sideW + G : 0)));
  let y = Y0;
  if (reading) {
    const below = roomForSide ? [] : rest;
    const belowH = below.reduce((n, p) => { p.style.width = readW + 'px'; return n + Math.min(p.offsetHeight, 220) + G; }, 0);
    const hMax = Math.max(H * .45, H - Y0 * 2 - belowH);
    at(reading, rx, y, readW, hMax); reading.style.height = hMax + 'px'; y += hMax + G;
    for (const p of below) { const ph = Math.min(p.offsetHeight, 220); at(p, rx, y, readW, ph); y += ph + G; }
  }
  if (!reading || roomForSide) {
    let x = reading ? rx + readW + G : rx; y = Y0;
    for (const p of rest) { const w = reading ? sideW : Math.min(320, W - x - X0); p.style.width = w + 'px'; const ph = Math.min(p.offsetHeight, H - Y0 * 2); if (y > Y0 && y + ph > H - Y0) { x += w + G; y = Y0; } at(p, x, y, w, H - Y0 - y); y += Math.min(p.offsetHeight, H - Y0 - y) + G; }
  }
}
// Comment anchors name files by their base name; the full path stays on hover elsewhere.
const anchorText = a => Object.entries(a).map(([k, v]) => `${k}: ${k === 'artifact' && !/^[a-z]+:\/\//i.test(v) ? base(v) : v}`).join(' · ');
function threadFor(it) {
  const s = st(it.id);
  return [...(it.thread || []).map(x => ({ ...x, from: x.from === 'captain' ? 'captain' : mateLabel(x.from) })), ...(SNAP.notes || []).filter(n => n.item === it.id).map(n => ({ from: `note · ${n.from ? mateLabel(n.from) : 'agent'}`, text: n.text, at: n.at })), ...S.answers.filter(a => a.id === it.id && ['comment', 'ask', 'needs-work'].includes(a.action)).map(a => ({ from: 'captain', text: `${a.action}: ${a.note}`, at: a.at, anchor: a.anchor, me: true }))].sort((a, b) => a.at - b.at);
}
function paper(cls, label, kids, pid, extraGrip) {
  return h('div', { class: `paper ${cls}`, dataset: { pid } }, h('div', { class: 'grip' }, h('span', null, label), h('span', { class: 'spacer' }), extraGrip || null, h('span', { class: 'drag-only', title: 'drag' }, '⋮⋮')), ...kids);
}
const fileFor = path => { const f = FILES[path]; return f && f.exists ? f : null; };
// Never print absolute paths on the desk: the file name, with the full path on hover.
const pathMeta = p => h('div', { class: 'meta path', title: p }, base(p));
const missing = p => h('p', { class: 'meta', title: p }, `not available locally: ${base(p)}`);
const EXT_TYPE = { png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', avif: 'image', mp4: 'video', m4v: 'video', webm: 'video', mov: 'video', mp3: 'audio', wav: 'audio', m4a: 'audio', pdf: 'pdf', diff: 'diff', patch: 'diff', md: 'report', markdown: 'report', txt: 'report', log: 'report', json: 'report', csv: 'report', yaml: 'report', yml: 'report' };
// The renderer understands pr | video | image | pdf | report | web | link; anything else is guessed from the path, or shown as a link/file card.
function artType(a) {
  const t = String(a.type || '').toLowerCase();
  if (a.url && (t === 'web' || t === 'lavish')) return 'web';
  if (a.path && /\.html?$/i.test(a.path) && !['pdf', 'image', 'video', 'audio'].includes(t)) return 'web'; // local HTML opens in the pane
  if (['pr', 'video', 'image', 'pdf', 'report', 'audio', 'diff'].includes(t)) return t;
  if (a.url && /^(link|file)$/.test(t)) return 'link';
  if (a.path) return EXT_TYPE[(a.path.split('.').pop() || '').toLowerCase()] || 'file';
  return /github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(a.url || '') ? 'pr' : 'link';
}
const openUrl = url => bridge.openExternal(url);
const webUrl = u => (/^https?:\/\//i.test(u || '') ? u : null);
// local file (served via harbor://) or a web URL for media
const srcFor = a => fileFor(a.path)?.url || webUrl(a.url);
const bodyArtifact = (body, isBody) => (/^[a-z][a-z0-9+.-]*:\/\//i.test(body) ? { type: 'link', url: body, label: 'Dispatch', isBody } : { type: artType({ path: body }) === 'pdf' ? 'pdf' : 'report', path: body, isBody });
function artifactPaper(it, a, i) {
  const pid = `a${i}`; const f = fileFor(a.path); const type = artType(a);
  if (type === 'link') {
    let host = a.url; try { host = new URL(a.url).host; } catch (e) { /* keep raw */ }
    return paper('prcard', a.label || a.type || 'Link', [
      h('div', { class: 'pr-num fact', onclick: e => pickFact({ type: 'point', label: host, anchor: { artifact: a.url } }, e.currentTarget) }, host),
      h('dl', { class: 'pr-meta' }, h('dt', null, 'link'), h('dd', null, h('a', { href: a.url, onclick: e => { e.preventDefault(); openUrl(a.url); } }, a.url)))
    ], pid, h('button', { class: 'ibtn', onclick: () => openUrl(a.url) }, 'Open'));
  }
  if (type === 'web') {
    let host = a.url || base(a.path); try { host = new URL(a.url).host; } catch (e) { /* keep raw */ }
    const label = a.label || (a.type === 'lavish' ? 'Lavish plan' : a.path ? 'Report page' : 'Web page');
    return paper('prcard web', label, [
      h('div', { class: 'pr-num fact', onclick: e => pickFact({ type: 'point', label: host, anchor: { artifact: a.url || a.path } }, e.currentTarget) }, host),
      a.path && !fileFor(a.path) ? missing(a.path) : h('dl', { class: 'pr-meta' }, h('dt', null, 'page'), h('dd', null, h('a', { href: '#', title: a.url || a.path, onclick: e => { e.preventDefault(); openViewer(a); } }, a.url || base(a.path)))),
      h('button', { class: 'pbtn web-open', onclick: () => openViewer(a) }, 'Open in the desk browser')
    ], pid, h('button', { class: 'ibtn', onclick: () => openViewer(a) }, 'View'));
  }
  if (type === 'pdf' || type === 'file') {
    return paper('report', type === 'pdf' ? 'Document' : 'File', [pathMeta(a.path),
      f ? (type === 'pdf' ? h('iframe', { class: 'pdf-frame', src: f.url, title: base(a.path) }) : h('p', { class: 'meta' }, f.mime || 'file')) : missing(a.path)],
      pid, f ? h('button', { class: 'ibtn', onclick: () => type === 'pdf' ? openViewer(a) : bridge.openPath(f.url) }, type === 'pdf' ? 'Read' : 'Open') : null);
  }
  if (type === 'pr') {
    const m = (a.url || '').match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    return paper('prcard', 'Pull request', [
      h('div', { class: 'pr-num fact', onclick: e => pickFact({ type: 'point', label: `PR ${m ? m[3] : ''}`, anchor: { artifact: a.url } }, e.currentTarget) }, m ? `#${m[3]}` : 'PR'),
      h('dl', { class: 'pr-meta' }, h('dt', null, 'repo'), h('dd', null, m ? `${m[1]}/${m[2]}` : '-'), h('dt', null, 'link'), h('dd', null, h('a', { href: a.url, onclick: e => { e.preventDefault(); openUrl(a.url); } }, a.url)))
    ], pid, h('button', { class: 'ibtn', onclick: () => openUrl(a.url) }, 'Open'));
  }
  if (type === 'audio') {
    const src = srcFor(a); const au = h('audio', { controls: true, preload: 'metadata', src: src || '' });
    const mark = h('button', { class: 'ibtn', onclick: e => pickFact({ type: 'point', label: `${base(a.path || a.url)} @ ${au.currentTime.toFixed(1)}s`, anchor: { artifact: a.path || a.url, t: Math.round(au.currentTime * 10) / 10 } }, e.currentTarget) }, 'Mark moment');
    return paper('monitor', a.label || 'Recording', [src ? au : missing(a.path), h('div', { class: 'leds' }, h('span', { class: 'led' }), base(a.path || a.url), h('span', { class: 'spacer' }), h('span', { class: 'inspect-only' }, mark))], pid);
  }
  if (type === 'video') {
    const v = h('video', { controls: true, preload: 'metadata', src: srcFor(a) || '' });
    const mark = h('button', { class: 'ibtn', onclick: e => pickFact({ type: 'point', label: `${base(a.path || a.url)} @ ${v.currentTime.toFixed(1)}s`, anchor: { artifact: a.path || a.url, t: Math.round(v.currentTime * 10) / 10 } }, e.currentTarget) }, 'Mark moment');
    return paper('monitor', 'Monitor', [srcFor(a) ? v : missing(a.path), h('div', { class: 'leds' }, h('span', { class: 'led' }), base(a.path || a.url), h('span', { class: 'spacer' }), h('span', { class: 'inspect-only' }, mark))], pid, h('button', { class: 'ibtn', onclick: () => openViewer(a) }, 'Full'));
  }
  if (type === 'image') {
    const img = h('img', { src: srcFor(a) || '', alt: base(a.path || a.url), loading: 'lazy', onclick: e => {
      if (document.body.classList.contains('inspect')) { const r = img.getBoundingClientRect(); pickFact({ type: 'point', label: `${base(a.path || a.url)} @ ${Math.round((e.clientX - r.left) / r.width * 100)}%,${Math.round((e.clientY - r.top) / r.height * 100)}%`, anchor: { artifact: a.path || a.url, x: +((e.clientX - r.left) / r.width).toFixed(2), y: +((e.clientY - r.top) / r.height).toFixed(2) } }, img); }
      else openViewer(a);
    } });
    return paper('photo', 'Photo', [srcFor(a) ? img : missing(a.path), h('p', { class: 'cap' }, a.label || base(a.path || a.url))], pid, h('button', { class: 'ibtn', onclick: () => openViewer(a) }, 'Zoom'));
  }
  const text = f?.text;
  if (type === 'diff' && text != null) return paper('report', a.label || 'Diff', [pathMeta(a.path), diffView(text.split('\n').slice(0, 80).join('\n'))], pid, h('button', { class: 'ibtn', onclick: () => openViewer(a) }, 'Read'));
  if (f && text == null) return paper('report', 'File', [pathMeta(a.path), h('p', { class: 'meta' }, f.mime || 'file')], pid, h('button', { class: 'ibtn', onclick: () => bridge.openPath(f.url) }, 'Open'));
  const ex = h('div', { class: 'excerpt md', html: text ? mdToHtml(text.split('\n').slice(0, 400).join('\n')) : `<p class="meta" title="${esc(a.path)}">not available locally: ${esc(base(a.path))}</p>` });
  ex.querySelectorAll('.mdh').forEach(hd => hd.classList.add('fact'));
  ex.addEventListener('click', e => { const hd = e.target.closest('.mdh'); if (hd && document.body.classList.contains('inspect')) pickFact({ type: 'point', label: `${base(a.path)} § ${hd.dataset.heading}`, anchor: { artifact: a.path, heading: hd.dataset.heading } }, hd); });
  return paper(a.isBody ? 'report dispatch' : 'report', a.isBody ? 'Dispatch' : 'Report', [pathMeta(a.path), ex], pid, h('button', { class: 'ibtn', onclick: () => openViewer(a) }, 'Read'));
}
function diffView(text) {
  return h('pre', { class: 'diff' }, text.split('\n').map(l => h('span', { class: /^\+(?!\+\+)/.test(l) ? 'add' : /^-(?!--)/.test(l) ? 'del' : /^@@/.test(l) ? 'hunk' : '' }, l + '\n')));
}
function askSlip(it) {
  const s = st(it.id); const kids = [];
  if (it.kind === 'decision' && it.options) {
    s.choice ??= it.options.find(o => o.recommended)?.key || null;
    kids.push(h('fieldset', { class: 'q' }, h('legend', null, 'Your call ', h('span', { class: 'hint' }, 'A–E pick · Space stamps')), it.options.map((o, i) => quick.option(it, o, i, s.choice === o.key, key => { s.choice = key; save(); afterPick(it.id); }, `opt-${it.id}`))));
  } else kids.push(h('p', { class: 'ql' }, { review: 'Your verdict on the work.', answer: 'Read, then file.', todo: 'Only you can do this. File it when done.' }[it.kind]));
  kids.push(h('div', { class: 'stamp-zone', id: 'stamp-zone' }, s.awaiting ? 'sent back; awaiting reply' : 'Space to stamp'));
  return paper('ask', 'The ask', kids, 'ask');
}
function makeDraggable(p, itemId) {
  const grip = p.querySelector('.grip'); let sx, sy, ox, oy, dragging = false;
  grip.addEventListener('pointerdown', e => { if (window.innerWidth <= 860 || e.target.closest('button,a')) return; dragging = true; grip.setPointerCapture(e.pointerId); sx = e.clientX; sy = e.clientY; ox = p.offsetLeft; oy = p.offsetTop; p.style.zIndex = 90; p.style.animation = 'none'; });
  grip.addEventListener('pointermove', e => { if (!dragging) return; p.style.left = (ox + e.clientX - sx) + 'px'; p.style.top = (oy + e.clientY - sy) + 'px'; });
  grip.addEventListener('pointerup', () => { if (!dragging) return; dragging = false; ((S.positions[itemId] ||= {})[p.dataset.pid] = { x: p.offsetLeft, y: p.offsetTop }); save(); snd('flip'); });
  p.addEventListener('pointerdown', () => { document.querySelectorAll('.paper').forEach(q => { if (q.style.zIndex === '90') q.style.zIndex = 40; }); if (!dragging) p.style.zIndex = 89; });
}

// ------------------------------------------------------------ stamps
const VERDICTS = ['approve', 'reject', 'needswork', 'ask'];
function trayConfig(it) {
  if (!it) return {};
  return {
    approve: { show: true, label: it.kind === 'decision' || it.kind === 'review' ? 'Approve' : 'File', cls: it.kind === 'answer' || it.kind === 'todo' ? 'file' : 'approve' },
    reject: { show: it.kind === 'decision' || it.kind === 'review', label: 'Reject', cls: 'reject' },
    needswork: { show: it.kind !== 'todo', label: 'Needs work', cls: 'needswork' },
    ask: { show: true, label: 'Ask', cls: 'ask' },
    later: { show: true, label: 'Later', cls: 'later' }
  };
}
function renderTray(it) {
  const cfg = trayConfig(it);
  document.querySelectorAll('#stamps .stamp').forEach(b => {
    const c = cfg[b.dataset.verdict]; b.disabled = !it || !c?.show || st(it.id).awaiting; b.hidden = !!(it && c && !c.show);
    b.querySelector('.lbl').textContent = c?.label || b.dataset.verdict; b.className = `stamp ${c?.cls || b.dataset.verdict}`;
  });
  $('#stamps').dataset.open = String(S.prefs.tray);
}
function toggleTray(open) { S.prefs.tray = open ?? !S.prefs.tray; save(); $('#stamps').dataset.open = String(S.prefs.tray); snd('flip'); }
function stamp(verdict, toReset) {
  const it = byId[S.current]; if (!it || statusOf(it) !== 'open') { toast('Nobody at the desk.'); return; }
  const s = st(it.id); if (s.awaiting) { toast('Already sent back; wait for the reply.'); return; }
  const cfg = trayConfig(it)[verdict]; if (!cfg?.show) return;
  if (!S.prefs.tray) toggleTray(true);
  if (verdict === 'later') return later(it, toReset);
  if (verdict === 'approve' && bundleOf(it).length > 1) return topicView.stampBundle(it, bundleOf(it));
  if (verdict === 'approve') {
    if (it.kind === 'decision') { if (!s.choice) { toast('Pick an option on the slip first.'); return; } return finishStamp(it, 'APPROVED', 'approve', { id: it.id, action: 'decide', key: s.choice }); }
    if (it.kind === 'review') return finishStamp(it, 'APPROVED', 'approve', { id: it.id, action: 'approve' });
    return finishStamp(it, 'FILED', 'file', { id: it.id, action: 'file' });
  }
  if (verdict === 'reject') return finishStamp(it, 'REJECTED', 'reject', { id: it.id, action: 'reject' });
  const action = verdict === 'ask' ? 'ask' : 'needs-work';
  openNote({ title: verdict === 'ask' ? 'Ask a follow-up' : 'What needs work?', to: `to ${mateFor(it).label}, about: ${it.title}`, placeholder: verdict === 'ask' ? 'Your question…' : 'What to change…' }, note => finishStamp(it, verdict === 'ask' ? 'FOLLOW-UP' : 'NEEDS WORK', verdict === 'ask' ? 'ask' : 'needswork', { id: it.id, action, note }, true));
}
// Later (S): park the item (and the rest of its ticked sheet) until tomorrow 9:00, or with Shift+S until just
// after the next usage reset. Writes a defer line; firstmate turns it into a hold --until.
function later(it, toReset) {
  const resets = [SCHED?.next_reset, SCHED?.reset_due, ...QUOTA.map(q => quotaView(q).resets)].filter(Boolean);
  const until = quick.laterUntil(toReset, { now: now(), resets });
  if (!until) { toast('No usage reset known; S parks it until tomorrow 9:00.'); return; }
  const others = bundleOf(it).filter(m => m !== it && !st(m.id).skipBundle);
  finishStamp(it, `LATER${others.length ? ' ×' + (others.length + 1) : ''}`, 'later', { id: it.id, action: 'defer', until }, false, others.map(m => ({ it: m, line: { id: m.id, action: 'defer', until } })));
}
// A stamp is applied at once, but its JSONL line is held for UNDO_MS. Undo restores the item and writes nothing.
// extra: [{ it, line }] for the other papers of a bundle, held, written and undone with this one.
function finishStamp(it, text, ink, line, stays, extra = [], bulk = false) {
  commitPending();
  const s = st(it.id); const src = document.querySelector(`#stamps .stamp.${ink}`) || document.querySelector('#stamps .stamp'); const zone = $('#stamp-zone');
  const snap = { item: JSON.parse(JSON.stringify(s)), cash: S.cash, current: S.current, extra: extra.map(e => [e.it.id, JSON.parse(JSON.stringify(st(e.it.id)))]) };
  flyStamp(src, zone, ink, () => {
    if (zone) { zone.textContent = ''; zone.append(h('div', { class: `impression ink-${ink}`, style: `--rot:${(hash(it.id) % 14) - 7}deg` }, text, h('small', null, `${fmtDate(now())} ${fmtTime(now())}`))); }
    line.at = now();
    // tidy run (F4): resolving stamps close together; a bulk stamp (bundle, take all recommended) never counts and
    // ends the run; Later parks rather than clears, so it neither counts nor breaks the run
    const parks = line.action === 'defer';
    if (!stays && !parks) { run = G.comboNext(run, line.at, bulk || extra.length > 0); S.fun.bestRun = Math.max(S.fun.bestRun || 0, run.n); harbor.showRun(run.n); }
    const pitch = stays || parks ? 1 : G.comboPitch(run.n), runN = stays || parks ? 0 : run.n;
    $('#desk').classList.remove('shake'); void $('#desk').offsetWidth; $('#desk').classList.add('shake'); snd('thud', pitch);
    const walk = $('#at-window .walk'); if (walk) { const who = whoBrings(it); walk.innerHTML = spriteSVG(who.id, stays ? it.kind : '', { mate: who.mate, reg: who.reg, happy: ink === 'approve' || ink === 'file', sad: ink === 'reject' }); walk.className = `walk ${stays ? 'go-off' : ink === 'reject' ? 'go-sad' : 'go-happy'}`; }
    // a defer leaves the item open; the held line itself parks it (statusOf)
    if (stays) s.awaiting = true; else if (!parks) { s.status = 'resolved'; s.verdict = line; }
    for (const e of extra) { e.line.at = line.at; if (e.line.action !== 'defer') Object.assign(st(e.it.id), { status: 'resolved', verdict: e.line }); }
    save(); $('#vault-count').textContent = ITEMS.filter(i => statusOf(i) === 'resolved').length; if (!stays) renderHarbor();
    pending = { line, extra, itemId: it.id, snap, stays, run: runN, timer: setTimeout(commitPending, UNDO_MS), toastEl: undoToast(consequence(line) + (extra.length ? ` (+${extra.length} more)` : '')) };
    if ($('#agentlog').classList.contains('open')) renderLog();
    setTimeout(() => {
      if (!pending || pending.line !== line) return; [{ it, line }, ...extra].forEach(e => earn(e.it, e.line.action, pitch));
      const bonus = G.comboBonus(runN); if (bonus) { S.cash += bonus; save(); $('#cash-n').textContent = money(S.cash); toast(`×${runN} tidy run +${money(bonus)}`, 'cash'); }
    }, 300);
    setTimeout(() => { if (!pending || pending.line !== line) return; document.querySelectorAll('#desk-surface .paper').forEach(p => p.classList.add('leaving')); setTimeout(() => { if (!pending || pending.line !== line) return; if (!stays) S.current = null; next(); }, 480); }, stays ? 1100 : 900);
  });
}
// After a clearing stamp is written (the undo hold is over): the tide goal (F7) and the stamp book (F6).
let run = { n: 0, at: 0 };
function afterClear(p) {
  const t = now(); const clear = harborClear(); const goal = S.fun.tide = G.tideGoal(S.fun.tide, t, tideNow());
  if (clear && goal && !goal.beat && t <= goal.deadline) { goal.beat = true; S.cash += 50; $('#cash-n').textContent = money(S.cash); snd('ding'); toast(`⚑ Beat the tide: the pier is clear before high tide. +${money(50)}`, 'cash'); }
  const it = byId[p.itemId]; const task = it ? ITEMS.filter(i => G.taskKey(i) === G.taskKey(it)) : [];
  awardBadges({ run: p.run, hour: new Date(p.line.at * 1000).getHours(), stamped: true, harborClear: clear, beatTide: !!goal?.beat, fullSheet: task.length >= 4 && task.every(i => statusOf(i) === 'resolved') });
  save(); renderHarbor();
}
function awardBadges(extra) {
  const ctx = { cleared: clearedToday(), run: 0, hour: new Date().getHours(), stamped: false, harborClear: false, beatTide: false, fullSheet: false, owned: new Set(S.fun.owned), days: S.fun.dayCount, spent: S.fun.spent || 0, ...extra };
  for (const k of G.earned(ctx, S.fun.badges)) { S.fun.badges[k] = now(); toast(`New stamp in your book: ${G.BADGES.find(b => b.key === k).label}`); }
  save();
}
// F10: count the calendar days the office opens; the town on the far shore grows with them
function markDay() {
  const k = G.dayKey(new Date()); if (S.fun.lastDay === k) return;
  const before = G.town(S.fun.dayCount).length; S.fun.dayCount++; S.fun.lastDay = k; const after = G.town(S.fun.dayCount);
  if (after.length > before) toast(`The harbor town grew: a ${after[after.length - 1].toLowerCase()} went up on the shore.`);
  awardBadges({}); save();
}
// F5: the chandlery sells cosmetics for the till; ink and tune can be switched once owned
function buy(key) {
  const r = G.buy(S.fun, key, S.cash); if (!r.ok) { toast(r.error, 'warn'); return; }
  const item = G.SHOP.find(x => x.key === key); S.fun = r.fun; S.cash = r.cash; save(); snd('coin'); toast(`Bought: ${item.label}`);
  awardBadges({}); applyPrefs(); if (!S.prefs.plain) renderWindowScene(); if (item.track && music.on) { musicStop(); musicStart(); }
}
function equip(change) {
  Object.assign(S.fun, change); save(); applyPrefs(); snd('tick');
  if (change.track && music.on) { musicStop(); musicStart(); }
}
function undoToast(msg) {
  const t = h('div', { class: 'toast undo' }, h('span', null, msg), h('button', { class: 'undo-btn', onclick: undoPending }, 'Undo ', h('span', { class: 'kbd' }, 'U')), h('span', { class: 'undo-bar' }));
  $('#toasts').append(t); return t;
}
function commitPending() {
  if (!pending) return; const p = pending; pending = null; clearTimeout(p.timer); p.toastEl?.remove();
  writeLine(p.line); for (const e of p.extra || []) writeLine(e.line); $('#log-count').textContent = S.answers.length;
  if ($('#agentlog').classList.contains('open')) renderLog();
  if (!p.stays) afterClear(p);
  if (!S.prefs.plain) renderRail();
}
function undoPending() {
  if (!pending) return; const p = pending; pending = null; clearTimeout(p.timer); p.toastEl?.remove();
  S.items[p.itemId] = p.snap.item; for (const [id, x] of p.snap.extra || []) S.items[id] = x; S.cash = p.snap.cash; S.current = p.itemId; save();
  run = { n: 0, at: 0 }; harbor.showRun(0); // undo breaks the tidy run
  snd('flip'); toast('Undone. Nothing was sent.'); renderAll();
}
function flyStamp(src, zone, ink, done) {
  if (!src || !zone) return done();
  const a = src.getBoundingClientRect(), b = zone.getBoundingClientRect();
  const fs = h('div', { class: `flying-stamp stamp ${ink}`, html: '<span class="handle"></span><span class="base"></span>' });
  fs.style.left = a.left + 'px'; fs.style.top = a.top + 'px'; document.body.append(fs);
  const tx = b.left + b.width / 2 - 40 - a.left, ty = b.top + b.height / 2 - 40 - a.top;
  fs.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${tx}px,${ty - 50}px) scale(1.15)`, offset: .6 }, { transform: `translate(${tx}px,${ty}px) scale(.95)` }], { duration: 380, easing: 'cubic-bezier(.3,.9,.4,1)', fill: 'forwards' }).onfinish = () => { done(); setTimeout(() => fs.remove(), 120); };
}
// ------------------------------------------------------------ ticket rail (derived from answers.jsonl + item threads)
let railFocus = 0;
function tickets() {
  const out = [];
  for (const a of S.answers) {
    if (!['ask', 'needs-work', 'request'].includes(a.action)) continue;
    const key = `${a.id}:${a.at}`; if (S.tickets.done[key]) continue;
    let title, reply = null, item = null;
    if (a.action === 'request') { title = `Order to ${mateLabel(a.to)}`; reply = (byId[a.id] ? { from: mateFor(byId[a.id]).label, text: byId[a.id].summary, at: byId[a.id].created } : null); item = byId[a.id] || null; }
    else { item = byId[a.id]; title = item?.title || a.id; const th = item?.thread || []; reply = th.filter(m => m.at >= a.at && m.from !== 'captain').sort((x, y) => x.at - y.at)[0] || null; }
    out.push({ key, a, title, reply, item, seen: !!S.tickets.seen[key] });
  }
  for (const p of queuedRequests()) out.push({ key: `queued:${p.id}`, a: { id: p.request.id, action: 'request', note: p.request.note, to: p.request.to, at: p.queued_at }, title: `Order to ${mateLabel(p.request.to)}`, reply: null, item: null, queued: p, seen: true });
  return out.sort((x, y) => ((y.reply && !y.seen) - (x.reply && !x.seen)) || ((!!y.reply) - (!!x.reply)) || (!!x.queued - !!y.queued) || x.a.at - y.a.at);
}
function renderRail(ring) {
  const rail = $('#rail'); if (!rail) return; const list = tickets(); const t0 = now();
  rail.replaceChildren(h('span', { class: 'rail-label', title: 'Things you asked for (T)' }, 'Tickets'));
  if (!list.length) { rail.append(h('span', { class: 'rail-empty' }, 'Asks and orders you send clip here')); rail.dataset.count = 0; return; }
  list.forEach((t, i) => {
    const unread = t.reply && !t.seen;
    const state = t.queued ? queuedLabel(t.queued) : t.reply ? (unread ? 'reply waiting' : 'replied') : 'waiting ' + age(t0 - t.a.at);
    rail.append(h('button', { class: `ticket ${t.queued ? 'queued' : t.reply ? 'replied' : 'waiting'} ${unread ? 'new' : ''} ${t.a.action}`, dataset: { key: t.key, i }, tabindex: i === railFocus ? 0 : -1, 'aria-label': `${t.title}: ${t.a.note}. ${state}`, onclick: e => openTicket(t, e.currentTarget), onfocus: () => { railFocus = i; } },
      h('span', { class: 'tk-head' }, h('span', { class: `tk-kind ${t.a.action}` }, { ask: 'ask', 'needs-work': 'rework', request: 'order' }[t.a.action]), h('span', { class: 'tk-title' }, t.title), unread ? h('span', { class: 'tk-badge' }, '1') : null),
      h('span', { class: 'tk-note' }, t.a.note),
      h('span', { class: 'tk-foot' }, t.queued ? `⏳ ${state}` : t.reply ? (unread ? '● reply waiting' : '✓ replied') : [h('span', { class: 'tk-dot' }), ` sent · waiting ${age(t0 - t.a.at)}`])));
  });
  rail.dataset.count = list.filter(t => t.reply && !t.seen).length;
  if (ring) { const first = rail.querySelector('.ticket.new'); if (first) { first.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } }
  railCues();
}
// An overflowing rail shows how many tickets hide off each edge (click to scroll there); the wheel scrolls it sideways.
function railCues() {
  const rail = $('#rail'); if (!rail) return; const r = rail.getBoundingClientRect(); let left = 0, right = 0;
  for (const t of rail.querySelectorAll('.ticket')) { const b = t.getBoundingClientRect(); if (b.right > r.right + 4) right++; else if (b.left < r.left + 20) left++; }
  for (const [id, n, dir] of [['#rail-left', left, -1], ['#rail-right', right, 1]]) {
    const c = $(id); c.hidden = !n; c.textContent = dir < 0 ? `‹ ${n}` : `${n} more ›`; c.title = `${n} ticket${n === 1 ? '' : 's'} ${dir < 0 ? 'before' : 'after'} these`;
    c.onclick = () => rail.scrollBy({ left: dir * rail.clientWidth * .8, behavior: 'smooth' });
  }
}
function openTicket(t, el) {
  document.querySelector('.tk-pop')?.remove();
  S.tickets.seen[t.key] = true; save(); renderRail();
  const r = el.getBoundingClientRect();
  const pop = h('div', { class: 'tk-pop', role: 'dialog', 'aria-label': 'Ticket' },
    h('div', { class: 'tk-q' }, h('span', { class: 'who' }, `you · ${fmtDate(t.a.at)} ${fmtTime(t.a.at)}`), t.a.note),
    t.queued ? h('div', { class: 'tk-r dim' }, `Held in the scheduler: ${queuedLabel(t.queued)}. It goes to ${mateLabel(t.a.to)} automatically${t.queued.kind === 'reset' ? ' once the usage limit resets' : ''}; nothing else to do.`)
      : t.reply ? h('div', { class: 'tk-r' }, h('span', { class: 'who' }, `${mateLabel(t.reply.from || 'first mate')} · ${fmtDate(t.reply.at)} ${fmtTime(t.reply.at)}`), t.reply.text) : h('div', { class: 'tk-r dim' }, `Still with ${t.a.action === 'request' ? mateLabel(t.a.to) : (t.item ? mateFor(t.item).label : 'the first mate')}. Waiting ${age(now() - t.a.at)}.`),
    t.queued ? h('div', { class: 'row' }, h('button', { class: 'pbtn ghost', onclick: async () => { pop.remove(); const r = await bridge.cancelScheduled(t.queued.id); if (r.snapshot) applySnapshot(r.snapshot); toast(r.ok ? 'Queued order withdrawn' : 'Already sent', r.ok ? '' : 'warn'); } }, 'Withdraw'), h('button', { class: 'pbtn ghost', onclick: () => pop.remove() }, 'Close')) :
    h('div', { class: 'row' }, t.item && statusOf(t.item) === 'open' ? h('button', { class: 'pbtn', onclick: () => { pop.remove(); if (S.prefs.plain) { S.prefs.plain = false; save(); } stepUp(t.item.id); } }, 'Open item') : null, h('button', { class: 'pbtn ghost', onclick: () => { S.tickets.done[t.key] = true; save(); pop.remove(); snd('flip'); renderRail(); } }, 'Done'), h('button', { class: 'pbtn ghost', onclick: () => pop.remove() }, 'Close')));
  document.body.append(pop);
  pop.style.left = Math.max(8, Math.min(window.innerWidth - 328, r.left)) + 'px'; pop.style.top = (r.bottom + 6) + 'px';
  pop.querySelector('.pbtn')?.focus();
}
function railKeys(e) {
  const btns = [...document.querySelectorAll('#rail .ticket')]; if (!btns.length) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); railFocus = (railFocus + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length; btns.forEach((b, i) => b.tabIndex = i === railFocus ? 0 : -1); btns[railFocus].focus(); snd('tick'); }
}

// ------------------------------------------------------------ inspect mode
function setInspect(on) {
  document.body.classList.toggle('inspect', on); $('#btn-inspect').setAttribute('aria-pressed', String(on));
  const b = $('#inspect-banner'); b.hidden = !on; b.textContent = 'Inspect: click a claim on the manifest, then a point of evidence (a moment, a spot on a photo, a heading, a standing order).';
  if (!on) clearPick();
}
function clearPick() { inspectPick = null; document.querySelectorAll('.fact.picked').forEach(e => e.classList.remove('picked')); document.querySelector('.popover')?.remove(); }
function pickFact(f, el) {
  if (!document.body.classList.contains('inspect')) return;
  if (!inspectPick || inspectPick.type === f.type) { clearPick(); inspectPick = f; el?.classList.add('picked'); $('#inspect-banner').textContent = `Picked ${f.type}: "${f.label}". Now click the other side.`; snd('tick'); return; }
  const claim = inspectPick.type === 'claim' ? inspectPick : f, point = inspectPick.type === 'point' ? inspectPick : f;
  showPairPopover(claim, point, el);
}
function showPairPopover(claim, point, nearEl) {
  document.querySelector('.popover')?.remove();
  const it = byId[S.current]; const anchor = Object.assign({}, claim.anchor, point.anchor);
  const pop = h('div', { class: 'popover' }, h('div', null, 'Cross-check'), h('div', { class: 'pair' }, 'Claim: ', claim.label), h('div', { class: 'pair' }, 'Evidence: ', point.label),
    h('div', { class: 'row' },
      h('button', { class: 'pbtn', onclick: () => { emit({ id: it.id, action: 'comment', note: `match: ${claim.label}`, anchor }); if (claim.idx != null) st(it.id).flags[claim.idx] = 'match'; save(); snd('tick'); earn(it, 'comment'); clearPick(); renderDesk(); } }, 'Match'),
      h('button', { class: 'pbtn danger', onclick: () => { pop.remove(); openNote({ title: 'Mismatch: what is off?', to: `comment on ${it.title}`, prefill: `mismatch: "${claim.label}" vs ${point.label}: ` }, note => { emit({ id: it.id, action: 'comment', note, anchor }); if (claim.idx != null) st(it.id).flags[claim.idx] = 'flag'; save(); snd('thud'); earn(it, 'comment'); clearPick(); renderDesk(); }); } }, 'Mismatch'),
      h('button', { class: 'pbtn ghost', onclick: clearPick }, 'Cancel')));
  document.body.append(pop);
  const r = nearEl?.getBoundingClientRect(); const x = r ? Math.min(window.innerWidth - 320, r.left) : window.innerWidth / 2 - 150, y = r ? Math.min(window.innerHeight - 180, r.bottom + 8) : 120;
  pop.style.left = Math.max(8, x) + 'px'; pop.style.top = Math.max(8, y) + 'px';
}

// ------------------------------------------------------------ drawers, modals, reader
function openDrawer(id) { document.querySelectorAll('.drawer').forEach(d => d.classList.toggle('open', d.id === id)); if (id === 'orders') renderOrders(); if (id === 'vault') renderVault(); if (id === 'agentlog') renderLog(); }
function closeDrawers() { document.querySelectorAll('.drawer.open').forEach(d => d.classList.remove('open')); }
function renderOrders() {
  const it = byId[S.current]; const checks = it ? checksFor(it) : []; const tagged = new Set(checks.map(c => c.rule));
  $('#orders-legend').textContent = it ? `${checks.filter(c => c.check?.ok === false).length} flagged on this item` : '';
  const content = $('#orders-content'); content.replaceChildren(h('p', { class: 'legend' }, 'Your saved preferences, which firstmate already follows. It auto-checks the tagged ones on each item; only look when one is flagged.'));
  if (checks.length) content.append(h('h3', { class: 'oh' }, 'On this item'), ...checks.map(({ rule, check }) => ruleRow(rule, check)));
  content.append(h('h3', { class: 'oh' }, 'All standing orders'), ...Object.keys(RULES).filter(k => !tagged.has(k)).map(k => ruleRow(k, null)));
  function ruleRow(k, check) {
    const r = RULES[k] || { text: k, source: '' };
    return h('div', { class: `rule ${check ? (check.ok ? 'ok' : 'flag') : ''}` },
      h('span', { class: 'mark' }, check ? (check.ok ? '✓' : '⚠') : '§'),
      h('div', null, h('span', { class: 'fact', onclick: e => pickFact({ type: 'point', label: `order ${k}`, anchor: { rule: k } }, e.currentTarget) }, r.text), check && h('div', { class: `note ${check.ok ? '' : 'warn'}` }, check.note), h('span', { class: 'src' }, `${k} · ${r.source || ''}`)));
  }
}
function renderVault() {
  const done = ITEMS.filter(i => statusOf(i) === 'resolved').map(i => ({ i, v: st(i.id).verdict })).sort((a, b) => (b.v?.at || 0) - (a.v?.at || 0));
  $('#vault-content').replaceChildren(done.length ? h('div', null, ...done.map(({ i, v }) => h('div', { class: 'entry', onclick: () => modal('viewer', i.title, plainCard(i, true)) },
    h('div', { class: `v ink-${v?.action === 'reject' ? 'reject' : v?.action === 'file' ? 'file' : 'approve'}` }, v ? ACTION_LABEL[v.action] : 'resolved', v?.key ? `: ${v.key}` : ''), h('div', null, i.title), h('div', { class: 'c' }, `${KIND[i.kind]} · ${i.stream || i.project} · ${v ? fmtDate(v.at) + ' ' + fmtTime(v.at) : ''}`)))) :
    h('p', { class: 'legend' }, 'Nothing filed yet.'));
}
// gaps.jsonl: responses an agent could not fit into an item kind. Listed so HarborDeck can grow new shapes.
function renderGaps() {
  const gaps = (SNAP.gaps || []).slice().reverse();
  $('#gaps').replaceChildren(h('h3', { class: 'oh' }, `Gaps (${gaps.length})`), h('p', { class: 'legend' }, 'Responses an agent could not fit into a decision, review, dispatch or notice. Each one is a case for a new desk item.'),
    ...(gaps.length ? gaps.map(g => h('div', { class: 'gap' }, h('div', null, g.text), h('div', { class: 'si-meta' }, [g.from && mateLabel(g.from), g.item && `squeezed into ${g.item}`, g.at && `${fmtDate(g.at)} ${fmtTime(g.at)}`].filter(Boolean).join(' · ')), g.sample ? h('div', { class: 'si-meta' }, 'sample: ', g.sample) : null)) : [h('p', { class: 'legend' }, 'None yet.')]));
}
function renderLog() { renderGaps(); $('#answers-path').textContent = `${SNAP.home}/answers.jsonl`; $('#log-lines').textContent = (jsonl() || '(no actions yet)\n') + (pending ? `\n# held ${UNDO_MS / 1000}s for undo, not yet written:\n${[pending.line, ...(pending.extra || []).map(e => e.line)].map(l => JSON.stringify(l)).join('\n')}` : ''); $('#log-count').textContent = S.answers.length; }
function modal(cls, titleText, content, footer, headerExtra) {
  closeModal();
  const m = h('div', { class: `modal ${cls}`, onclick: e => { if (e.target === m) closeModal(); } },
    h('div', { class: 'box', role: 'dialog', 'aria-modal': 'true', 'aria-label': titleText }, h('header', null, h('h2', null, titleText), headerExtra || null, h('button', { class: 'ibtn-top', 'aria-label': 'Close', onclick: closeModal }, icon('close'))), h('div', { class: 'content' }, content), footer && h('footer', null, footer)));
  $('#modal-root').append(m); return m;
}
function closeModal() { $('#modal-root').replaceChildren(); }
function openViewer(a) {
  const f = fileFor(a.path); let body, cls = 'dossier'; const type = artType(a);
  if (type === 'web') { const url = a.url || f?.page; if (!url) { toast(`Not available locally: ${base(a.path)}`, 'warn'); return; } return window.harborWebPane.open({ url, title: a.label || (a.type === 'lavish' ? 'Lavish plan' : a.path ? base(a.path) : 'Web page'), modal, h, toast }); }
  if (type === 'pdf') body = h('div', { class: 'mount' }, f ? h('iframe', { class: 'pdf-full', src: f.url, title: base(a.path) }) : missing(a.path));
  else if (type === 'image') body = h('div', { class: 'mount' }, srcFor(a) ? h('img', { src: srcFor(a), alt: base(a.path || a.url) }) : missing(a.path));
  else if (type === 'diff' && f?.text != null) body = h('article', { class: 'sheet' }, diffView(f.text));
  else if (type === 'video') body = h('div', { class: 'mount' }, srcFor(a) ? h('video', { src: srcFor(a), controls: true, autoplay: true }) : missing(a.path));
  else body = h('article', { class: 'sheet md', html: f?.text ? mdToHtml(f.text) : `<p>not available locally: ${esc(base(a.path))}</p>` });
  let zoom = 1; const apply = () => { body.style.setProperty('--zoom', zoom); };
  const zoomer = h('div', { class: 'zoomer' }, h('button', { class: 'tbtn', 'aria-label': 'Smaller', onclick: () => { zoom = Math.max(.7, zoom - .1); apply(); } }, 'A−'), h('button', { class: 'tbtn', 'aria-label': 'Larger', onclick: () => { zoom = Math.min(1.8, zoom + .1); apply(); } }, 'A+'));
  const ext = f ? h('button', { class: 'tbtn', title: 'Open with the default app', onclick: () => bridge.openPath(f.url) }, 'Open') : null;
  modal(cls, base(a.path || a.url), body, null, h('div', { class: 'zoomer' }, zoomer, ext));
}
function openNote(opts, onSubmit) {
  const ta = h('textarea', { placeholder: opts.placeholder || '', value: opts.prefill || '' });
  modal('noteslip', opts.title, h('div', null, h('div', { class: 'to' }, opts.to), ta), [h('button', { class: 'pbtn ghost', onclick: closeModal }, 'Cancel'), h('button', { class: 'pbtn', onclick: submit }, 'Send')]);
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  ta.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(); });
  function submit() { const v = ta.value.trim(); if (!v) { ta.focus(); return; } closeModal(); onSubmit(v); }
}

// ------------------------------------------------------------ requests (orders to firstmates), crew flavour, stamina
// One order line, from the Requests tab or the ship phone. false when answers.jsonl could not be written.
function sendOrder(note, to) {
  const n = S.answers.length;
  emit({ id: `req-${now()}-${hash(note) % 1000}`, action: 'request', note, to }); if (S.answers.length === n) return false;
  S.prefs.lastMate = to; save(); snd('ding'); toast(`Order handed to ${mateLabel(to)}`);
  if (S.prefs.plain) renderPlain(); else { renderRail(); if (S.prefs.tab === 'requests' && !typing()) renderRequests(); }
  return true;
}
function renderRequests() {
  const pane = $('#requests-pane'); pane.replaceChildren();
  const mates = FLEET.firstmates;
  let to = S.prefs.lastMate || mates[0]?.id;
  const ta = h('textarea', { class: 'order-text', placeholder: 'New order: a request, feature or idea…', rows: 3 });
  const picks = h('div', { class: 'counter' }, mates.map(m => h('button', { class: `mate-pick ${m.id === to ? 'sel' : ''}`, onclick: e => { to = m.id; picks.querySelectorAll('.mate-pick').forEach(b => b.classList.toggle('sel', b === e.currentTarget)); snd('tick'); }, title: m.domain || '' },
    h('div', { html: spriteSVG(m.id, 'slip', { mate: true, tired: tired() }) }), h('div', { class: 'mate-name' }, m.label), h('div', { class: 'mate-dom' }, m.domain || ''))));
  const send = () => { const v = ta.value.trim(); if (!v) { ta.focus(); return; } if (sendOrder(v, to)) renderRequests(); };
  // Queued orders wait in the scheduler and go out by themselves (harbordeck tick), no prompt needed.
  const queue = async when => {
    const v = ta.value.trim(); if (!v) { ta.focus(); return; }
    const id = `req-${now()}-${hash(v) % 1000}`;
    const r = await bridge.schedule({ when, request: { id, note: v, to } });
    if (!r.ok) { toast(`Could not queue: ${r.error}`, 'warn'); return; }
    S.prefs.lastMate = to; save(); ta.value = ''; snd('slide');
    toast(when === 'reset' ? `Queued for ${mateLabel(to)} after the usage limit resets` : `Queued for ${mateLabel(to)} at ${fmtTime(when)}`);
    applySnapshot(r.snapshot);
  };
  const at = h('input', { type: 'time', class: 'order-time', 'aria-label': 'Send at time', title: 'Send at this time (next occurrence)' });
  const atBtn = h('button', { class: 'pbtn ghost', disabled: true, onclick: () => { if (at.value) queue(nextClockEpoch(at.value)); } }, 'Queue at time');
  at.addEventListener('input', () => { atBtn.disabled = !at.value; });
  ta.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send(); });
  const sched = SCHED ? [SCHED.next_reset ? `next reset ${fmtTime(SCHED.next_reset)} (${dur(SCHED.next_reset - now())})` : null, !SCHED.enabled ? 'scheduler is off' : null].filter(Boolean).join(' · ') : 'scheduler unavailable';
  pane.append(h('p', { class: 'legend' }, 'Write an order slip and hand it across the counter. The first mate decides who cooks it. Out of stamina? Queue it: it goes out by itself once the usage limit resets.'), picks,
    h('div', { class: 'order-slip' }, ta,
      h('div', { class: 'row' }, h('span', { class: 'legend' }, '⌘/Ctrl+Enter sends now'), h('button', { class: 'pbtn', onclick: send }, 'Send now')),
      h('div', { class: 'row when-row' }, h('button', { class: 'pbtn ghost', onclick: () => queue('reset') }, 'Queue for after reset'), h('span', { class: 'at-group' }, at, atBtn)),
      sched ? h('div', { class: 'legend sched-note' }, sched) : null,
      awakeUntil() ? h('div', { class: 'legend sched-note' }, `☕ Keeping this Mac awake until ${fmtTime(awakeUntil())} so queued work goes out (display can still sleep).`) : null));
  const queued = queuedRequests();
  const sent = S.answers.filter(a => a.action === 'request').slice().reverse();
  if (queued.length || sent.length) pane.append(h('h3', { class: 'oh' }, 'On the counter'),
    ...queued.map(p => h('div', { class: 'slip-row queued' }, h('div', null, p.request.note), h('div', { class: 'si-meta' }, `${mateLabel(p.request.to)} · ⏳ ${queuedLabel(p)}`))),
    ...sent.map(a => h('div', { class: 'slip-row' }, h('div', null, a.note), h('div', { class: 'si-meta' }, `${mateLabel(a.to)} · ${fmtDate(a.at)} ${fmtTime(a.at)} · ${byId[a.id] ? 'replied' : a.at >= S.dayStart ? 'handed over, waiting for an item to come back' : 'earlier'}`))));
}
function renderCrewPane() {
  const pane = $('#crew-pane'); pane.replaceChildren(staminaPanel());
  const tz = tired();
  pane.append(h('h3', { class: 'oh' }, 'Counter staff'), ...FLEET.firstmates.map(m => h('div', { class: 'crew-card mate' }, h('div', { html: spriteSVG(m.id, '', { mate: true, tired: tz }) }), h('div', null, h('div', { class: 'cc-name' }, m.label, h('span', { class: 'tag idle' }, m.state || 'attending')), h('div', { class: 'cc-meta' }, `${m.domain || ''} · ${m.harness || ''} ${m.model || ''}`)))));
  pane.append(h('h3', { class: 'oh' }, 'Galley'), h('p', { class: 'legend' }, 'Who is cooking what. Crew answer to their first mate, not to you.'));
  for (const c of FLEET.crew) {
    const item = c.item && byId[c.item]; const stateLabel = { working: 'cooking', waiting: 'at the window', done: 'ready at the pass', idle: 'on the pier' }[c.state] || c.state;
    pane.append(h('div', { class: `crew-card ${c.state}` }, h('div', { html: spriteSVG(c.id, c.state === 'idle' ? '' : (item?.kind || 'decision'), { tired: tz }) }),
      h('div', null, h('div', { class: 'cc-name' }, crewName(c.id), h('span', { class: `tag ${c.state}` }, stateLabel), tz && c.state !== 'idle' ? h('span', { class: 'yawn', title: 'low stamina' }, 'yawning') : null),
        h('div', { class: 'cc-meta' }, `${mateLabel(c.firstmate)} · ${c.harness} ${c.model} · ${c.effort} · ${c.shipped || 0} shipped, ${c.rework || 0} rework`),
        h('div', { class: 'cc-traits' }, traits(c).map(t => h('span', { class: 'trait' }, t))),
        c.task ? h('div', { class: 'cc-task' }, c.task_title || c.task, c.state === 'working' && h('div', { class: 'cook' }, h('span')), item && statusOf(item) === 'open' && h('button', { class: 'ibtn', onclick: () => { stepUp(item.id); selectTab('window'); } }, 'at the window')) : null)));
  }
}
function staminaPanel() {
  const box = h('div', { class: 'stamina' }, h('h3', { class: 'oh' }, 'Stamina'));
  if (!QUOTA.length) { box.append(h('p', { class: 'legend' }, 'No subscriptions configured (quota.json).')); return box; }
  for (const q0 of QUOTA) {
    const q = quotaView(q0); const lvl = q.left < 10 ? 'empty' : q.left < 25 ? 'low' : q.left < 50 ? 'mid' : 'ok';
    box.append(h('div', { class: `sub ${lvl}` }, h('div', { class: 'sub-head' }, h('span', null, q.name, ' ', h('span', { class: 'win' }, q.window)), h('span', { class: 'left' }, `${q.left}%`)),
      h('div', { class: 'meter' }, h('span', { style: `width:${q.left}%` })),
      h('div', { class: 'sub-foot' }, `refills in ${age(q.in)} (${fmtTime(q.resets)}${q.in > 86400 ? ' ' + fmtDate(q.resets) : ''})`, q.left < 10 ? ' · nearly empty, crew will stall' : q.left < 25 ? ' · running low, crew yawning' : '')));
  }
  return box;
}
function renderSchedChip() {
  const c = $('#sched-chip'); const v = window.HarborSchedule.chip(SCHED, queuedRequests().length, now(), { fmtTime, fmtDate });
  c.hidden = !v; if (!v) return;
  c.classList.toggle('off', v.off); c.replaceChildren(h('span', null, v.text)); c.title = v.title;
}
// the scene's tide line carries the level (F3); the top bar keeps a wave per window, coloured by what is left, and its refill time
const TIDE_GLYPH = '<svg viewBox="0 0 12 8" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="2" width="3" height="1"/><rect x="3" y="1" width="3" height="1"/><rect x="6" y="2" width="3" height="1"/><rect x="9" y="1" width="3" height="1"/><rect x="0" y="5" width="3" height="1"/><rect x="3" y="4" width="3" height="1"/><rect x="6" y="5" width="3" height="1"/><rect x="9" y="4" width="3" height="1"/></svg>';
function renderStaminaMini() {
  renderSchedChip();
  const m = staminaMin(); const box = $('#stamina-cluster'); box.replaceChildren();
  if (m == null) { box.append(h('span', { class: 'dim' }, 'no quota')); return; }
  const views = QUOTA.map(quotaView); const shortest = views.reduce((a, b) => a.in < b.in ? a : b);
  for (const q of views) { const lvl = q.left < 10 ? 'empty' : q.left < 25 ? 'low' : q.left < 50 ? 'mid' : 'ok'; box.append(h('span', { class: `mini-sub ${lvl}`, title: `${q.name} ${q.window}: ${q.left}% left, refills ${fmtTime(q.resets)}${q.in > 86400 ? ' ' + fmtDate(q.resets) : ''}` }, h('span', { class: 'ms-name' }, h('span', { class: 'ms-full' }, q.name.split(' ')[0]), h('span', { class: 'ms-abbr' }, q.name.slice(0, 1)), ' ', h('b', null, q.window)), h('span', { class: 'tg', html: TIDE_GLYPH }), h('span', { class: 'ms-time' }, `↻ ${age(q.in)}`))); }
  box.append(h('span', { class: 'ms-short' }, `↻ ${age(shortest.in)}`));
  $('#stamina-cluster').className = `stamina-cluster ${m < 10 ? 'empty' : m < 25 ? 'low' : ''}${S.prefs.staminaOpen ? ' expanded' : ''}`;
  $('#tab-crew-flag').hidden = m >= 25; document.body.classList.toggle('tired', m < 20);
}
function selectTab(name) { S.prefs.tab = name; save(); document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name))); document.querySelectorAll('.tabpane').forEach(p => p.hidden = p.dataset.pane !== name); if (name === 'crew') renderCrewPane(); if (name === 'requests') renderRequests(); if (name === 'topics') $('#topics-pane').replaceChildren(topicView.list()); }

// ------------------------------------------------------------ day cycle: morning manifest, shift report
function meter(score, max) { const pct = Math.max(0, Math.min(100, Math.round(((score + max) / (2 * max)) * 100))); return h('div', { class: 'meter' }, h('span', { style: `width:${pct}%` })); }
function regularsBoard() { return h('div', { class: 'regulars' }, FLEET.regulars.map(r => { const sc = regularScore(r, false), d = regularScore(r, true); return h('div', { class: 'regular' }, h('div', { class: 'rg-name' }, r.label, h('span', { class: 'rg-delta' }, d ? (d > 0 ? `+${d}` : `${d}`) : '')), meter(sc, 12)); })); }
function topItems(n) { return ITEMS.filter(i => statusOf(i) === 'open').sort((a, b) => prio(a) - prio(b) || ((a.due || 9e12) - (b.due || 9e12)) || a.created - b.created).slice(0, n); }
// The manifest shows only what has something in it; Space opens the office.
function openManifest() {
  const open = ITEMS.filter(i => statusOf(i) === 'open'); const counts = {}; for (const i of open) counts[i.kind] = (counts[i.kind] || 0) + 1;
  const cooking = FLEET.crew.filter(c => c.state !== 'idle'); const c7 = FLEET.counts;
  const week = [[c7.shipped_7d, 'shipped'], [c7.merged_7d, 'merged'], [c7.rework_7d, 'reworked'], [c7.reports_7d, 'reports']].filter(([n]) => n);
  const content = h('div', { class: 'manifest-sheet' },
    h('div', { class: 'ms-head' }, h('div', { class: 'ms-day' }, `Day ${S.day}`), h('div', null, new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), S.streak ? ` · ${S.streak}-day streak` : '', S.cash ? ` · ${money(S.cash)} in the till` : '')),
    h('div', { class: 'ms-grid' },
      h('section', null, h('h3', null, 'At the window'), h('ul', null, Object.entries(KIND).map(([k, l]) => counts[k] ? h('li', null, `${counts[k]} ${(counts[k] > 1 ? KINDS[k] : l).toLowerCase()}`) : null), !open.length && h('li', null, 'nobody waiting')), open.length ? [h('h3', null, 'First up'), h('ol', null, topItems(3).map(i => h('li', null, prioChip(i), ' ', i.title)))] : null),
      cooking.length ? h('section', null, h('h3', null, 'Galley'), h('ul', null, cooking.map(c => h('li', null, `${crewName(c.id)}: ${c.task_title || c.task || ''} (${{ working: 'cooking', waiting: 'at the window', done: 'ready' }[c.state] || c.state})`)))) : null,
      QUOTA.length ? h('section', null, staminaPanel()) : null,
      FLEET.regulars.length ? h('section', null, h('h3', null, 'Regulars'), regularsBoard()) : null),
    week.length ? h('p', { class: 'ms-foot' }, `Last 7 days: ${week.map(([n, w]) => `${n} ${w}`).join(', ')}.`) : null);
  modal('ledger manifest', 'Morning manifest', content, [h('span', { class: 'legend' }, 'Space'), h('button', { class: 'pbtn', onclick: () => openOffice() }, 'Open the office')]);
}
function openOffice(quiet) { S.dayOpen = true; S.dayStart = S.dayStart || now(); S.closedSig = null; markDay(); save(); closeModal(); if (!quiet) snd('ding'); if (!S.current) next(); else renderAll(); }
// What is waiting, for "did anything change overnight": open items and their last rewrite.
const openSig = () => ITEMS.filter(i => statusOf(i) === 'open').map(i => `${i.id}@${i.updated || i.created}`).sort().join(' ');
// A closed office: the manifest, unless nothing changed since the day was closed; then straight to work.
function morning() {
  if (S.closedSig != null && S.closedSig === openSig()) { openOffice(true); toast('Nothing new since you closed the day; the office is open.'); }
  else openManifest();
}
function openLedger() {
  const A = answersToday(); const t0 = now();
  const resolved = A.filter(a => ['decide', 'approve', 'reject', 'file'].includes(a.action));
  const cashToday = resolved.concat(A.filter(a => ['ask', 'needs-work', 'comment'].includes(a.action))).reduce((n, a) => n + (byId[a.id] ? payFor(byId[a.id], a.action) : 0), 0);
  const waiting = ITEMS.filter(i => statusOf(i) === 'open').sort((a, b) => a.created - b.created);
  const cooking = FLEET.crew.filter(c => c.state === 'working'), finished = FLEET.crew.filter(c => c.state === 'done');
  const sec = (title, body) => h('section', { class: 'rp' }, h('h3', null, title), body);
  const content = h('div', { class: 'report' },
    h('div', { class: 'rp-head' }, h('span', null, `Day ${S.day} · ${fmtDate(t0)} ${fmtTime(t0)}`), h('span', null, `${resolved.length} cleared · ${money(cashToday)} earned · ${waiting.length} waiting`)),
    sec('Decided', resolved.length ? h('ul', null, resolved.map(a => { const it = byId[a.id]; const u = it ? unblocks(it) : []; return h('li', null, h('b', null, consequence(a)), u.length ? h('div', { class: 'sub-line' }, '↳ ', u.join('; ')) : h('div', { class: 'sub-line dim' }, '↳ nothing was waiting on it')); })) : h('p', { class: 'dim' }, 'Nothing cleared yet.')),
    A.filter(a => ['ask', 'needs-work', 'request'].includes(a.action)).length ? sec('Sent across the counter', h('ul', null, A.filter(a => ['ask', 'needs-work', 'request'].includes(a.action)).map(a => h('li', null, consequence(a))))) : null,
    sec('Still waiting on you', waiting.length ? h('ul', null, waiting.map(i => h('li', null, prioChip(i), ' ', i.title, h('span', { class: 'dim' }, ` · waiting ${age(t0 - i.created)}`), i.due ? [' · ', dueChip(i)] : null))) : h('p', { class: 'dim' }, 'Nothing. Clear pier.')),
    sec('Galley', h('ul', null, finished.map(c => h('li', null, `✓ ${crewName(c.id)} finished "${c.task_title || c.task}"`)), cooking.map(c => h('li', null, `… ${crewName(c.id)} still cooking "${c.task_title || c.task}"`)), h('li', null, `Cash earned today: ${money(cashToday)} (till: ${money(S.cash)})`), QUOTA.length ? h('li', null, 'Stamina left: ', QUOTA.map(quotaView).map(q => `${q.name} ${q.window} ${q.left}%`).join(' · ')) : null)),
    sec("Tomorrow's top 3", h('ol', null, topItems(3).map(i => h('li', null, prioChip(i), ' ', i.title, i.due ? h('span', { class: 'dim' }, ` · due ${fmtDate(i.due)}`) : null)))));
  const doneToday = Object.entries(S.items).filter(([, s]) => s.status === 'resolved' && s.verdict && s.verdict.at >= S.dayStart).map(([id]) => byId[id] || { id, title: id, project: 'desk' });
  const recap = harbor.recap({ day: S.day, cleared: G.boats(doneToday), earned: cashToday, waiting: waiting.length, tide: S.fun.tide, run: S.fun.bestRun || 0,
    badgesToday: Object.entries(S.fun.badges).filter(([, at]) => at >= S.dayStart).map(([k]) => G.BADGES.find(b => b.key === k)?.label).filter(Boolean), logbook: content });
  modal('ledger', 'Ships out', recap, [
    h('button', { class: 'pbtn ghost', title: 'Clears cash, day count, read marks and paper positions. answers.jsonl is never touched.', onclick: () => { if (confirm('Reset the desk? Clears cash, day count and paper positions. answers.jsonl is kept.')) { commitPending(); try { localStorage.removeItem(deskKey()); } catch (e) {} loadState(); closeModal(); renderAll(); openManifest(); } } }, 'Reset desk'),
    h('button', { class: 'pbtn ghost', onclick: () => navigator.clipboard?.writeText(content.textContent).then(() => toast('Report copied')) }, 'Copy'),
    h('button', { class: 'pbtn', onclick: () => { S.day++; S.streak = A.length ? S.streak + 1 : 0; S.dayOpen = false; S.dayStart = now(); S.fun.bestRun = 0; run = { n: 0, at: 0 }; S.closedSig = openSig(); save(); closeModal(); snd('ding'); renderAll(); openManifest(); } }, 'Close the day')]);
}

// ------------------------------------------------------------ plain mode
function actionsFor(it) {
  const cfg = trayConfig(it); const s = st(it.id); const out = []; const run = v => { S.current = it.id; s.read = true; save(); stamp(v); };
  for (const v of [...VERDICTS, 'later']) if (cfg[v]?.show) out.push(h('button', { class: `abtn ${cfg[v].cls}`, disabled: s.awaiting, title: v === 'later' ? 'Park it until tomorrow 9:00' : null, onclick: () => run(v) }, cfg[v].label));
  const group = bundleOf(it); if (group.length > 1) out.push(h('button', { class: 'abtn approve', disabled: s.awaiting, title: group.map(m => m.title).join(' · '), onclick: () => topicView.stampBundle(it, group) }, `Approve bundle (${group.length})`));
  return out;
}
function plainCard(it, openByDefault) {
  const s = st(it.id); const resolved = statusOf(it) === 'resolved';
  const arts = [...(it.artifacts || [])]; if (it.body && !arts.some(a => (a.path || a.url) === it.body)) arts.unshift(bodyArtifact(it.body));
  const thread = threadFor(it); const flagged = (it.checks || []).filter(x => x.ok === false);
  const d = h('details', { class: 'pcard', open: openByDefault || false, ontoggle: () => { if (d.open && !s.read) { s.read = true; save(); } } },
    h('summary', null, prioChip(it), h('span', null, h('div', { class: 't' }, !s.read && h('span', { class: 'unread-dot', style: 'display:inline-block;margin-right:6px' }), it.title, flagged.length ? h('span', { class: 'flag' }, ` ⚠${flagged.length}`) : null), h('div', { class: 's' }, h('span', { class: `tag ${it.kind}` }, KIND[it.kind]), ' ', topicView.chip(it), ` ${it.stream || it.project} · ${fmtDate(it.created)}`, it.due ? [' · ', dueChip(it)] : null, s.awaiting ? ' · awaiting reply' : '')), h('span', { class: 's' }, resolved ? (s.verdict ? ACTION_LABEL[s.verdict.action] + (s.verdict.key ? `: ${s.verdict.key}` : '') : 'resolved') : money(payFor(it, 'decide')))),
    h('div', { class: 'body' },
      h('p', { class: 'summary-text' }, it.summary),
      flagged.length ? h('div', { class: 'flag-note' }, flagged.map(x => h('div', null, `⚠ ${x.rule}: ${x.note}`))) : null,
      arts.length ? h('div', { class: 'ev-row' }, arts.map(a => { const f = fileFor(a.path); return h('button', { class: 'ev-thumb', onclick: () => ['pr', 'link'].includes(artType(a)) ? openUrl(a.url) : openViewer(a) }, artType(a) === 'image' && srcFor(a) ? h('img', { src: srcFor(a), alt: '' }) : artType(a) === 'video' && srcFor(a) ? h('video', { src: srcFor(a), muted: true, preload: 'metadata' }) : h('div', { class: 'ph' }, artType(a) === 'pr' ? 'PR' : a.url ? '↗' : '¶'), h('span', null, a.url ? (a.url.match(/pull\/\d+/) || [a.url.replace(/^https?:\/\//, '')])[0] : base(a.path))); })) : null,
      it.kind === 'decision' && it.options && !resolved ? h('fieldset', null, h('legend', null, 'Your call'), it.options.map(o => h('label', { class: 'opt' }, h('input', { type: 'radio', name: `p-${it.id}`, value: o.key, checked: (s.choice ??= it.options.find(x => x.recommended)?.key) === o.key, onchange: () => { s.choice = o.key; save(); } }), h('span', null, o.label, o.recommended && h('span', { class: 'rec' }, 'rec.'), o.why && h('span', { class: 'why' }, o.why))))) : null,
      resolved ? h('div', { class: 'verdict' }, s.verdict ? consequence(s.verdict) : 'Resolved by the agent.') : h('div', { class: 'actions' }, actionsFor(it)),
      thread.length ? h('div', { class: 'thread' }, thread.map(x => h('div', { class: `msg ${x.me || x.from === 'captain' ? 'me' : ''}` }, h('div', { class: 'who' }, `${x.from} · ${fmtDate(x.at)} ${fmtTime(x.at)}`), x.text))) : null,
      !resolved && !s.awaiting ? (() => { const inp = h('input', { placeholder: 'Ask a follow-up…', onkeydown: e => { if (e.key === 'Enter') send(); } }); const send = () => { const v = inp.value.trim(); if (!v) return; const line = emit({ id: it.id, action: 'ask', note: v }); s.awaiting = true; save(); earn(it, 'ask'); toast(consequence(line)); renderPlain(); }; return h('div', { class: 'follow' }, inp, h('button', { class: 'abtn ask', onclick: send }, 'Ask')); })() : null));
  return d;
}
function renderPlain() {
  const root = $('#plain-mode'); root.replaceChildren();
  const open = ITEMS.filter(i => statusOf(i) === 'open'); const f = S.prefs.filter;
  root.append(h('div', { class: 'plain-filters' }, ...['all', 'decision', 'review', 'answer', 'todo'].map(k => h('button', { class: 'chip', 'aria-pressed': String(f === k), onclick: () => { S.prefs.filter = k; save(); renderPlain(); } }, k === 'all' ? 'All' : KINDS[k])), h('span', { class: 'count' }, `${open.length} open · ${money(S.cash)} · ${S.answers.length} actions`)));
  const groups = [['decision', 'Needs your word'], ['review', 'Review the work'], ['answer', 'Dispatches to read and file'], ['todo', 'Notices: only you']];
  for (const [k, label] of groups) {
    if (f !== 'all' && f !== k) continue;
    const rows = open.filter(i => i.kind === k).sort((a, b) => st(a.id).awaiting - st(b.id).awaiting || prio(a) - prio(b) || ((a.due || 9e12) - (b.due || 9e12)) || a.created - b.created); if (!rows.length) continue;
    root.append(h('section', { class: 'plain-group' }, h('h2', null, label, ` (${rows.length})`), rows.map(i => plainCard(i))));
  }
  if (f === 'all') {
    const ta = h('textarea', { rows: 2, placeholder: 'New order to the first mate…' }); let to = S.prefs.lastMate || FLEET.firstmates[0]?.id;
    const sel = h('select', { onchange: e => { to = e.target.value; } }, FLEET.firstmates.map(m => h('option', { value: m.id, selected: m.id === to }, m.label)));
    const send = () => { const v = ta.value.trim(); if (!v) return; const id = `req-${now()}-${hash(v) % 1000}`; emit({ id, action: 'request', note: v, to }); S.prefs.lastMate = to; save(); toast(`Order handed to ${mateLabel(to)}`); renderPlain(); };
    root.append(h('section', { class: 'plain-group' }, h('h2', null, 'New order'), h('div', { class: 'pcard order-plain' }, ta, h('div', { class: 'row' }, sel, h('button', { class: 'abtn file', onclick: send }, 'Hand it over')))));
    root.append(h('section', { class: 'plain-group' }, h('h2', null, 'Scene, in words'), h('div', { class: 'pcard scene-text' }, h('div', null, `${open.length} waiting outside the window${open.filter(i => impatience(i) === 2).length ? `, ${open.filter(i => impatience(i) === 2).length} very impatient` : ''}.`), h('div', null, `${G.boats(open).length} boats moored in the harbor; ${G.town(S.fun.dayCount).length} buildings in town.`), ...FLEET.crew.map(c => h('div', null, `${crewName(c.id)}: ${{ working: 'cooking ' + (c.task_title || c.task), done: 'ready at the pass with ' + (c.task_title || c.task), waiting: 'waiting on you (' + (c.task_title || c.task) + ')', idle: hash(c.id) % 2 === 0 ? 'napping on the pier' : 'lounging on the pier' }[c.state] || c.state}${tired() ? ', yawning' : ''}`)))));
    root.append(h('section', { class: 'plain-group' }, h('h2', null, 'Topics'), h('div', { class: 'pcard topics-plain' }, topicView.list())));
    const done = ITEMS.filter(i => statusOf(i) === 'resolved');
    if (done.length) root.append(h('section', { class: 'plain-group' }, h('h2', null, `Resolved (${done.length})`), done.map(i => plainCard(i))));
  }
}

// ------------------------------------------------------------ wiring
function setMi(sel, ic, label) { const b = $(sel); b.querySelector('use').setAttribute('href', `#i-${ic}`); b.querySelector('.mi-l').textContent = label; b.title = label; }
function applyPrefs() {
  if (S.prefs.theme === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = S.prefs.theme;
  setMi('#btn-theme', { auto: 'auto', light: 'sun', dark: 'moon' }[S.prefs.theme], `Theme: ${S.prefs.theme}`);
  $('#btn-sound').setAttribute('aria-pressed', String(S.prefs.sound)); $('#btn-music').setAttribute('aria-pressed', String(S.prefs.music)); $('#music-vol').value = S.prefs.musicVol;
  $('#btn-plain').setAttribute('aria-pressed', String(S.prefs.plain)); setMi('#btn-plain', S.prefs.plain ? 'desk' : 'plain', S.prefs.plain ? 'Back to the desk' : 'Plain mode');
  $('#desk-mode').hidden = S.prefs.plain; $('#plain-mode').hidden = !S.prefs.plain; $('#btn-inspect').disabled = S.prefs.plain;
  $('#cash-n').textContent = money(S.cash); document.body.dataset.ink = S.fun.ink || 'red'; renderStaminaMini(); renderPhoneButton();
  const flagged = ITEMS.filter(i => statusOf(i) === 'open').reduce((n, i) => n + flaggedCount(i), 0); for (const id of ['#orders-flag', '#orders-flag2']) { $(id).hidden = !flagged; $(id).textContent = flagged; }
}
function renderAll(keepDesk) {
  applyPrefs();
  $('#shift-label').textContent = `Day ${S.day}${S.streak ? ` · ${S.streak}-day streak` : ''}`;
  $('#vault-count').textContent = ITEMS.filter(i => statusOf(i) === 'resolved').length; $('#log-count').textContent = S.answers.length;
  if (S.prefs.plain) { renderPlain(); return; }
  renderFilters(); renderQueue(); renderWindowScene(); renderYard(); if (keepDesk) renderTray(byId[S.current]); else renderDesk(); renderRail(); selectTab(S.prefs.tab || 'window');
  if ($('#orders').classList.contains('open')) renderOrders();
}
// ------------------------------------------------------------ live data: snapshots pushed by the main process on every change
// Waiting on a reply = the latest ask/needs-work for the item has no non-captain thread entry after it.
function computeAwaiting(it) {
  const asks = S.answers.filter(a => a.id === it.id && (a.action === 'ask' || a.action === 'needs-work'));
  if (pending && pending.stays && pending.itemId === it.id) asks.push(pending.line);
  const last = asks.sort((a, b) => a.at - b.at).pop(); if (!last) return false;
  return !(it.thread || []).some(m => m.at >= last.at && m.from !== 'captain');
}
function syncItems(prevById) {
  let replies = 0; const fresh = [];
  for (const it of ITEMS) {
    const s = st(it.id);
    // a verdict hides an item locally; per the contract, the agent rewriting it as open (newer `updated`) reopens it
    if (s.status === 'resolved' && it.status === 'open' && s.verdict && (it.updated || it.created) > s.verdict.at) { s.status = null; s.verdict = null; s.read = false; }
    const was = s.awaiting; s.awaiting = statusOf(it) === 'open' && computeAwaiting(it);
    if (was && !s.awaiting) replies++;
    if (prevById && !prevById[it.id] && it.status === 'open') fresh.push(it);
  }
  for (const a of S.answers) if (a.action === 'request' && prevById && byId[a.id] && !prevById[a.id]) replies++;
  return { replies, fresh: fresh.filter(it => !S.answers.some(a => a.action === 'request' && a.id === it.id)) };
}
let deferred = null;
// What the desk papers show: the current item, its notes and its bundle. Anything else changing keeps the papers still.
const deskSig = () => { const it = byId[S.current]; return JSON.stringify(it ? [it, (SNAP.notes || []).filter(n => n.item === it.id), bundleOf(it).map(m => m.id)] : null); };
function applySnapshot(snap) {
  const prevHome = SNAP.home, prevById = byId, prevNotes = SNAP.notes || [], curBefore = deskSig();
  setData(snap);
  if (snap.home !== prevHome || (snap.demoSeed || 0) !== (S.demoSeed || 0)) { loadState(); syncItems(null); closeModal(); renderAll(); if (!S.dayOpen) morning(); else if (!S.current) next(); return; }
  S.answers = (snap.answers || []).slice();
  const { replies, fresh } = syncItems(prevById);
  save();
  if (S.current && !byId[S.current]) S.current = null;
  renderAll(deskSig() === curBefore); phone.refresh();
  if ($('#agentlog').classList.contains('open')) renderLog();
  topicView.update(prevNotes);
  if (replies) { snd('ding'); if (!S.prefs.plain) renderRail(true); toast(replies > 1 ? `${replies} replies landed on the rail` : 'A reply landed on the rail'); }
  if (fresh.length) { snd('slide'); toast(fresh.length > 1 ? `${fresh.length} new at the window` : `New at the window: ${fresh[0].title}`); }
  if (snap.errors?.length) console.warn('harbor: unreadable items', snap.errors);
}
// Never re-render under the captain's typing: hold the snapshot until focus leaves the field.
const typing = () => { const a = document.activeElement; return a && a.matches('textarea, input:not([type=range]):not([type=radio]), select'); };
bridge.onUpdate(snap => { if (typing()) { deferred = snap; return; } applySnapshot(snap); });
document.addEventListener('focusout', () => setTimeout(() => { if (deferred && !typing()) { const s = deferred; deferred = null; applySnapshot(s); } }, 50));
syncItems(null);

// ------------------------------------------------------------ settings
async function openSettings() {
  const cur = await bridge.getSettings();
  const field = (label, value, hint, choose) => {
    const inp = h('input', { type: 'text', value: value || '', placeholder: hint, spellcheck: false });
    return { inp, row: h('label', { class: 'set-row' }, h('span', { class: 'set-l' }, label), h('span', { class: 'set-in' }, inp, choose ? h('button', { class: 'tbtn', type: 'button', onclick: async () => { const d = await bridge.chooseDir(label); if (d) inp.value = d; } }, 'Choose…') : null)) };
  };
  const dir = field('Data directory', cur.dataDir, '~/.harbordeck', true);
  const root = field('Artifact root', cur.artifactRoot, 'optional: relative paths not found in the data directory resolve here', true);
  const hosts = field('Web hosts', (cur.webHosts || []).join(', '), 'optional: hosts besides localhost the desk browser may show, e.g. devbox.lan:8080');
  const phoneKey = field('Phone shortcut', cur.phoneShortcut, 'empty: no shortcut, the top-bar icon only. e.g. CommandOrControl+Shift+Space');
  const phoneNote = { ok: 'Works from any app: brings the desk forward with the phone open.', taken: 'Taken by another app: works inside Harbor Deck only.', invalid: 'Not a valid shortcut.', off: '' }[cur.phoneKey] || '';
  const hookOn = h('input', { type: 'checkbox', checked: !!cur.onAnswer.enabled });
  const hookCmd = h('textarea', { rows: 2, placeholder: 'e.g. ~/bin/wake-agent.sh   (the JSON line arrives on stdin and in $HARBORDECK_LINE)', value: cur.onAnswer.command || '', spellcheck: false });
  const content = h('div', { class: 'settings' },
    h('p', { class: 'legend' }, 'Now reading ', h('code', null, cur.home), cur.demo ? ' (demo data)' : '', cur.envHome && !cur.demo ? ' · set by HARBORDECK_HOME, which wins over the field below' : ''),
    dir.row, root.row, hosts.row, phoneKey.row, phoneNote ? h('p', { class: 'legend set-hint' }, phoneNote) : null,
    h('div', { class: 'set-row' }, h('span', { class: 'set-l' }, 'On answer'), h('span', { class: 'set-in col' }, h('label', { class: 'set-check' }, hookOn, ' Run a command after every line written to answers.jsonl'), hookCmd)),
    h('div', { class: 'set-row' }, h('span', { class: 'set-l' }, 'Demo'), h('span', { class: 'set-in' },
      h('button', { class: 'tbtn', type: 'button', onclick: async () => { commitPending(); closeModal(); applySnapshot(await bridge.demo(true)); toast('Demo data loaded (fresh day)'); } }, cur.demo ? 'Restart demo' : 'Load demo data'),
      cur.demo ? h('button', { class: 'tbtn', type: 'button', onclick: async () => { commitPending(); closeModal(); applySnapshot(await bridge.demo(false)); } }, 'Back to my data') : null)),
    SNAP.errors?.length ? h('div', { class: 'flag-note' }, h('div', null, `${SNAP.errors.length} item file(s) skipped:`), SNAP.errors.slice(0, 8).map(e => h('div', null, `${e.file}: ${e.error}`))) : null);
  modal('settings-modal', 'Settings', content, [h('button', { class: 'pbtn ghost', onclick: closeModal }, 'Cancel'), h('button', { class: 'pbtn', onclick: async () => {
    commitPending();
    const snap = await bridge.setSettings({ dataDir: dir.inp.value.trim(), artifactRoot: root.inp.value.trim(), webHosts: hosts.inp.value, phoneShortcut: phoneKey.inp.value.trim(), onAnswer: { enabled: hookOn.checked, command: hookCmd.value.trim() } });
    closeModal(); applySnapshot(snap); toast('Settings saved');
  } }, 'Save')]);
}
// ------------------------------------------------------------ ship phone (phone-view.js): a quick order to a first mate from anywhere
let phoneDraft = '';
const phone = window.HarborPhone({ h, snd, mates: () => FLEET.firstmates, settings: () => SNAP.settings || {}, lastMate: () => S.prefs.lastMate,
  sprite: id => spriteSVG(id, 'slip', { mate: true, tired: tired() }), draft: { get: () => phoneDraft, set: v => { phoneDraft = v; } }, send: sendOrder });
function renderPhoneButton() {
  const set = SNAP.settings || {}, key = HarborPhoneKeys.label(set.phoneShortcut), b = $('#btn-phone');
  const note = { taken: ' The system-wide shortcut is taken by another app: it works inside Harbor Deck only. Pick another in Settings.', invalid: ' The shortcut in Settings is not valid.' }[set.phoneKey] || '';
  b.title = `Ship phone: a quick order to a first mate${key ? ` (${key})` : ''}.${note}`; b.classList.toggle('key-off', !!note);
  if (key) b.setAttribute('aria-keyshortcuts', set.phoneShortcut.replace(/CommandOrControl|CmdOrCtrl/i, /Mac/.test(navigator.platform) ? 'Meta' : 'Control')); else b.removeAttribute('aria-keyshortcuts');
}
$('#btn-phone').onclick = () => phone.toggle();
bridge.onPhone(how => how === 'toggle' ? phone.toggle() : phone.open());

bridge.onMenu(async what => {
  if (what === 'settings') openSettings();
  else if (what === 'demo-on' || what === 'demo-off') { commitPending(); closeModal(); applySnapshot(await bridge.demo(what === 'demo-on')); }
});

const tickClock = () => { $('#clock').textContent = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); };
tickClock(); setInterval(tickClock, 1000); let parkedSig = ITEMS.filter(i => statusOf(i) === 'later').length;
setInterval(() => { const n = ITEMS.filter(i => statusOf(i) === 'later').length; if (n !== parkedSig) { parkedSig = n; if (!typing()) renderAll(true); } renderStaminaMini(); if (!S.prefs.plain) { renderHarbor(); renderRail(); if (S.prefs.tab === 'crew') renderCrewPane(); if (S.prefs.tab === 'requests' && !typing()) renderRequests(); } }, 30000);
$('#btn-next').onclick = next;
$('#btn-inspect').onclick = () => setInspect(!document.body.classList.contains('inspect'));
$('#btn-shop').onclick = () => harbor.openChandlery();
$('#btn-orders').onclick = () => $('#orders').classList.contains('open') ? closeDrawers() : openDrawer('orders');
$('#btn-vault').onclick = () => $('#vault').classList.contains('open') ? closeDrawers() : openDrawer('vault');
$('#btn-log').onclick = () => $('#agentlog').classList.contains('open') ? closeDrawers() : openDrawer('agentlog');
$('#btn-ledger').onclick = openLedger;
$('#btn-settings').onclick = openSettings;
// header menu: one popover for everything that is not at-a-glance status; toggles (sound, music, theme, volume) keep it open
const menuEl = $('#menu'), menuBtn = $('#btn-menu');
const menuOpen = () => !menuEl.hidden;
function setMenu(on) {
  menuEl.hidden = !on; menuBtn.setAttribute('aria-expanded', String(on));
  if (on) { const r = menuBtn.getBoundingClientRect(); menuEl.style.top = `${Math.round(r.bottom + 4)}px`; menuItems()[0]?.focus(); } else if (menuEl.contains(document.activeElement)) menuBtn.focus();
}
const menuItems = () => [...menuEl.querySelectorAll('button.mi:not(:disabled), input.vol')];
menuBtn.onclick = () => setMenu(!menuOpen());
menuEl.addEventListener('click', e => { const b = e.target.closest('button.mi'); if (b && !['btn-sound', 'btn-music', 'btn-theme'].includes(b.id)) setMenu(false); });
menuEl.addEventListener('keydown', e => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const its = menuItems(), i = its.indexOf(document.activeElement); if (e.target.matches('input')) return; e.preventDefault();
  its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length]?.focus();
});
document.addEventListener('pointerdown', e => { if (menuOpen() && !menuEl.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false); });
$('#sched-chip').onclick = () => { if (S.prefs.plain) { S.prefs.plain = false; save(); renderAll(); } selectTab('requests'); };
$('#stamina-cluster').onclick = () => { if (window.innerWidth <= 860) { S.prefs.staminaOpen = !S.prefs.staminaOpen; save(); renderStaminaMini(); return; } if (S.prefs.plain) { S.prefs.plain = false; save(); renderAll(); } selectTab('crew'); };
$('#cash').onclick = () => harbor.openChandlery();
$('#btn-plain').onclick = () => { S.prefs.plain = !S.prefs.plain; save(); setInspect(false); renderAll(); };
$('#btn-sound').onclick = () => { S.prefs.sound = !S.prefs.sound; save(); applyPrefs(); snd('ding'); };
$('#btn-music').onclick = () => { S.prefs.music = !S.prefs.music; save(); applyPrefs(); try { S.prefs.music ? musicStart() : musicStop(); } catch (e) { toast('Audio unavailable'); } };
$('#music-vol').oninput = e => { S.prefs.musicVol = +e.target.value; save(); musicVolume(); };
$('#btn-theme').onclick = () => { S.prefs.theme = { auto: 'light', light: 'dark', dark: 'auto' }[S.prefs.theme]; save(); applyPrefs(); };
$('#btn-log-copy').onclick = () => navigator.clipboard?.writeText(jsonl()).then(() => toast('answers.jsonl copied'));
$('#btn-log-export').onclick = () => { const a = h('a', { href: URL.createObjectURL(new Blob([jsonl()], { type: 'application/x-ndjson' })), download: 'answers.jsonl' }); a.click(); };
$('#tray-handle').onclick = () => toggleTray();
$('#rail').addEventListener('wheel', e => { const rail = e.currentTarget; if (rail.scrollWidth <= rail.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; e.preventDefault(); rail.scrollLeft += e.deltaY; }, { passive: false });
$('#rail').addEventListener('scroll', railCues);
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeDrawers);
document.querySelectorAll('#stamps .stamp').forEach(b => b.onclick = e => stamp(b.dataset.verdict, e.shiftKey));
document.querySelectorAll('.tab').forEach(t => t.onclick = () => selectTab(t.dataset.tab));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && menuOpen()) { setMenu(false); return; }
  if (e.key === 'Escape') { closeModal(); closeDrawers(); clearPick(); document.querySelector('.tk-pop')?.remove(); return; }
  const tgt = e.target instanceof Element ? e.target : document.body;
  if (tgt.matches('textarea,select,input:not([type=radio]):not([type=checkbox])') || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (phone.isOpen()) return; // the ship phone is modal: no desk keys (letters, Space, S, Shift+A) while it is up
  const box = document.querySelector('#modal-root .modal');
  if (box && (e.key === ' ' || (e.shiftKey && k === 'a'))) {
    // Space opens the office from the manifest; Shift+A again stamps the take-all-recommended list
    const go = box.classList.contains('manifest') && e.key === ' ' ? box.querySelector('footer .pbtn') : box.classList.contains('sweep') && k === 'a' ? box.querySelector('footer .pbtn:not(.ghost)') : null;
    if (go) { e.preventDefault(); go.click(); }
    return;
  }
  if (tgt.matches('input') && !tgt.closest('#desk-surface')) return; // a radio or checkbox on the desk still takes letters and Space
  if (k === 'u' || k === 'z') { if (pending) { e.preventDefault(); undoPending(); } return; }
  if (k === 'm') { e.preventDefault(); setMenu(!menuOpen()); return; }
  if (k === 'p') { e.preventDefault(); $('#btn-plain').click(); return; }
  if (S.prefs.plain) return;
  if (tgt.closest('#rail')) { railKeys(e); if (e.key.startsWith('Arrow')) return; }
  if (e.key === 'Tab' && !tgt.closest('.modal,.drawer')) { e.preventDefault(); toggleTray(); return; }
  if (k === 't') { e.preventDefault(); const b = document.querySelector('#rail .ticket.new') || document.querySelector('#rail .ticket'); if (b) { railFocus = +b.dataset.i; b.focus(); } else toast('No tickets on the rail.'); }
  else if (k === 'n') next(); else if (k === 'b' && e.shiftKey) $('#btn-shop').click(); /* plain B picks option B (quick calls) */ else if (k === 'i') setInspect(!document.body.classList.contains('inspect')); else if (k === 'r') $('#btn-orders').click(); else if (k === 'l') openLedger();
  else if (k === 'o') { const it = byId[S.current]; if (it?.topic) topicView.open(it.topic); else toast(it ? 'No topic on this item.' : 'Nobody at the desk.'); }
  else if ('1234'.includes(k) && k) { e.preventDefault(); if (!document.querySelector('.modal')) stamp(VERDICTS[+k - 1]); }
  else if (box) return;
  // quick calls: Space stamps (never Enter), A-E pick, J/K move on a sheet, S later, Shift+A take all recommended
  else if (e.key === ' ') { e.preventDefault(); if (document.activeElement?.matches('button,a,[tabindex]')) document.activeElement.blur(); stamp('approve'); }
  else if (e.shiftKey && k === 'a') { e.preventDefault(); quick.openSweep(queueItems().filter(i => !st(i.id).awaiting), sweep); }
  else if (!e.shiftKey && 'abcde'.includes(k) && k) { e.preventDefault(); pickLetter('abcde'.indexOf(k)); }
  else if (k === 'j') moveRow(1); else if (k === 'k') moveRow(-1);
  else if (k === 's') { e.preventDefault(); stamp('later', e.shiftKey); }
});
// Take all recommended: one stamp writes the recommended option for every ticked decision; undone together.
function sweep(list) {
  const lines = list.map(it => ({ it, line: { id: it.id, action: 'decide', key: it.options.find(o => o.recommended).key } }));
  S.current = list[0].id; st(list[0].id).read = true; save(); renderAll();
  finishStamp(list[0], `APPROVED ×${lines.length}`, 'approve', lines[0].line, false, lines.slice(1), true); // bulk: never a tidy run
}
window.addEventListener('beforeunload', commitPending);
window.addEventListener('resize', () => { if (!S.prefs.plain) { renderDesk(); railCues(); } });

renderAll();
if (!S.dayOpen) morning(); else { markDay(); if (!S.current) next(); }
const low = QUOTA.map(quotaView).filter(q => q.left < 10); if (low.length) setTimeout(() => toast(`Stamina nearly empty: ${low.map(q => `${q.name} ${q.window}`).join(', ')}. Refill in ${age(low[0].in)}.`, 'warn'), 1500);
if (S.prefs.music) { const once = () => { try { musicStart(); } catch (e) {} document.removeEventListener('pointerdown', once); }; document.addEventListener('pointerdown', once); }
})();
