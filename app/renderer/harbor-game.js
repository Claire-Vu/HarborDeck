/* Harbor game rules: pure functions behind the living harbor (boats, regulars, sky, tide, tidy runs, stamp book,
   chandlery, town, music layers). No DOM and no desk state: app.js and harbor-scene.js pass data in. Loaded as a
   plain script in the renderer (window.HarborGame) and as a CommonJS module by the unit tests. Every name and
   character here is original. */
(function (root) {
'use strict';
const hash = s => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; };
const DAY = 86400;

// ------------------------------------------------------------ F1 living harbor: one boat per open task
// A task is the item's topic, else its id without a question suffix (`build.q3` -> `build`), else the item.
const taskKey = it => it.topic || String(it.id).replace(/\.q\d+$/i, '');
const taskTitle = (key, items) => items.length === 1 ? items[0].title : key.replace(/[-_]+/g, ' ').replace(/^\w/, c => c.toUpperCase());
function boats(items) {
  const by = new Map();
  for (const it of items) { const k = taskKey(it); if (!by.has(k)) by.set(k, []); by.get(k).push(it); }
  return [...by].map(([key, list]) => ({ key, items: list, calls: list.length, project: list[0].project || 'desk', title: taskTitle(key, list), prio: Math.min(...list.map(i => i.priority || 3)) }))
    .sort((a, b) => a.prio - b.prio || b.calls - a.calls || a.key.localeCompare(b.key));
}
const sailHeight = calls => 8 + Math.min(calls, 6) * 3;

// ------------------------------------------------------------ F2 regulars: one recurring character per project
const FIRST = ['Odette', 'Brannoc', 'Juno', 'Pim', 'Marisol', 'Tobin', 'Halvard', 'Ysolde', 'Corwin', 'Netta', 'Rasmus', 'Fen', 'Ottilie', 'Barnaby', 'Sunniva', 'Iggy'];
const TRADE = ['Sail-maker', 'Harbormaster', 'Tinker', 'Grocer', 'Net-mender', 'Lamplighter', 'Ropewalker', 'Boatwright', 'Fishwife', 'Cartwright', 'Tide-reader', 'Cooper'];
const COATS = ['#c8552d', '#3b6f9e', '#4f8a5b', '#8a3a7a', '#2d8a8a', '#a8632d', '#5a5fb0', '#b0405a'];
const SKINS = ['#f0c9a0', '#e2b48a', '#c98f62', '#a86f48', '#8d5a3b', '#f3d2b3'];
function regular(project) {
  const p = String(project || 'desk'); const x = hash(p);
  return { id: `reg:${p}`, project: p, name: `${TRADE[x % TRADE.length]} ${FIRST[(x >> 4) % FIRST.length]}`, coat: COATS[(x >> 8) % COATS.length], cap: COATS[(x >> 11) % COATS.length], skin: SKINS[(x >> 14) % SKINS.length], hat: (x >> 17) % 4 };
}
// mood and a one-line memory from the captain's recent calls on this project (answers: [{ action, at, project }])
const WEEK = 7 * DAY;
const GOOD = new Set(['decide', 'approve', 'file']), BAD = new Set(['reject', 'needs-work']);
const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
function mood(calls, t) {
  const recent = calls.filter(a => t - a.at < WEEK);
  const good = recent.filter(a => GOOD.has(a.action)).length, bad = recent.filter(a => BAD.has(a.action)).length;
  return bad > good ? 'grumpy' : good >= 3 ? 'cheerful' : good > bad ? 'content' : recent.length ? 'patient' : 'new';
}
function memory(calls, t) {
  const recent = calls.filter(a => t - a.at < WEEK).sort((a, b) => a.at - b.at); const last = recent[recent.length - 1];
  if (!last) return calls.length ? 'Back after a quiet week.' : 'First time at your window.';
  const merges = recent.filter(a => a.action === 'approve' || a.action === 'decide').length;
  if (last.action === 'reject') return 'Still smarting from the last no.';
  if (last.action === 'needs-work') return 'Brought the reworked papers back.';
  if (merges >= 2) return `${ord(merges).replace(/^\w/, c => c.toUpperCase())} call settled this week!`;
  if (t - last.at < DAY) return 'Back again today.';
  return 'Good to see you again.';
}

// ------------------------------------------------------------ F3 sky, weather, tide
// phase from the local hour; weather from the lowest stamina left (%)
function sky(hour) {
  if (hour < 5 || hour >= 21) return 'night';
  if (hour < 7) return 'dawn';
  if (hour >= 18) return 'dusk';
  return 'day';
}
const SKY = {
  night: { s1: '#0b1730', s2: '#1d3156', sea: '#123a58', sea2: '#0c2c45' },
  dawn: { s1: '#f2b48a', s2: '#f7dcb8', sea: '#3d6f90', sea2: '#2d5d7f' },
  day: { s1: '#a9d6ee', s2: '#cfe8f5', sea: '#3f7fa6', sea2: '#2c6a8f' },
  dusk: { s1: '#d9805f', s2: '#f2c38f', sea: '#2f5f82', sea2: '#244f70' }
};
function weather(stamina) { if (stamina == null) return 'fair'; if (stamina < 20) return 'rain'; if (stamina < 50) return 'cloudy'; return 'fair'; }
// tide: 0 low .. 1 high; high tide is the next refill of the shortest window. views: [{ window secs, in secs, resets }]
function tide(views) {
  if (!views.length) return null;
  const v = views.reduce((a, b) => (a.in < b.in ? a : b));
  return { level: Math.max(0, Math.min(1, 1 - v.in / v.secs)), in: v.in, resets: v.resets, name: v.name, window: v.window };
}

// ------------------------------------------------------------ F4 tidy run
const RUN_GAP = 8; // seconds between resolving stamps that keep a run going
// state { n, at } -> next state. Bulk (bundle) stamps never count: they end the run.
function comboNext(state, t, bulk) {
  if (bulk) return { n: 0, at: 0 };
  return { n: state && state.n && t - state.at <= RUN_GAP ? state.n + 1 : 1, at: t };
}
const comboPitch = n => Math.pow(2, Math.min(Math.max(n - 1, 0), 8) / 12); // a semitone per stamp, capped at an octave less a third
const comboBonus = n => (n > 1 ? 5 * Math.min(n - 1, 10) : 0);

// ------------------------------------------------------------ F6 stamp book
// ctx: { cleared, run, hour, harborClear, beatTide, fullSheet, owned (Set), days, spent }
const BADGES = [
  { key: 'first', label: 'First stamp', test: c => c.cleared >= 1 },
  { key: 'five', label: 'Five in a row', test: c => c.run >= 5 },
  { key: 'night', label: 'Night owl', test: c => c.stamped && c.hour < 5 },
  { key: 'early', label: 'Early tide', test: c => c.stamped && c.hour >= 5 && c.hour < 7 },
  { key: 'sheet', label: 'Full sheet', test: c => c.fullSheet },
  { key: 'clear', label: 'Clear harbor', test: c => c.harborClear },
  { key: 'tide', label: 'Beat the tide', test: c => c.beatTide },
  { key: 'ten', label: 'Ten in a day', test: c => c.cleared >= 10 },
  { key: 'week', label: 'Seven days', test: c => c.days >= 7 },
  { key: 'shop', label: 'First purchase', test: c => c.spent > 0 },
  { key: 'light', label: 'Lightkeeper', test: c => c.owned.has('lighthouse') },
  { key: 'town', label: 'Town charter', test: c => town(c.days).length >= 5 }
];
const earned = (ctx, have) => BADGES.filter(b => !have[b.key] && b.test(ctx)).map(b => b.key);

// ------------------------------------------------------------ F5 chandlery: cosmetics only
const SHOP = [
  { key: 'lamp', label: 'Dock lamp', price: 40, what: 'A lamp on the pier, lit after dark.' },
  { key: 'bell', label: "Cat's brass bell", price: 30, what: 'The ship cat jingles when it moves.' },
  { key: 'pennants', label: 'Project pennants', price: 80, what: 'Each boat flies its project colour.' },
  { key: 'ink-teal', label: 'Teal stamp ink', price: 60, what: 'Approvals land in sea teal.', ink: 'teal' },
  { key: 'ink-violet', label: 'Violet stamp ink', price: 60, what: 'Approvals land in harbor violet.', ink: 'violet' },
  { key: 'ink-gold', label: 'Gold stamp ink', price: 120, what: 'Approvals land in gold leaf.', ink: 'gold' },
  { key: 'track-night', label: 'Night-watch tune', price: 120, what: 'A second harbor tune, slower and in a minor key.', track: 'night' },
  { key: 'lighthouse', label: 'Lighthouse', price: 200, what: 'A lighthouse on the point, beam sweeping at night.' }
];
function buy(fun, key, cash) {
  const item = SHOP.find(s => s.key === key);
  if (!item) return { ok: false, error: 'unknown item' };
  if (fun.owned.includes(key)) return { ok: false, error: 'already owned' };
  if (cash < item.price) return { ok: false, error: 'not enough in the till' };
  return { ok: true, cash: cash - item.price, fun: { ...fun, owned: [...fun.owned, key], spent: (fun.spent || 0) + item.price, ink: item.ink || fun.ink, track: item.track || fun.track } };
}

// ------------------------------------------------------------ F7 beat the tide: clear the pier before the next refill
// goal { deadline, beat } re-arms once its deadline passes
function tideGoal(goal, t, tideNow) {
  if (!tideNow) return null;
  if (!goal || t > goal.deadline) return { deadline: tideNow.resets, beat: false };
  return goal;
}

// ------------------------------------------------------------ F10 harbor town: a building every 2 days the office opens
const BUILDINGS = ['Net shed', 'Fish market', 'Chandlery', 'Tavern', 'Rope walk', 'Boatyard', 'Customs house', 'Windmill', 'Clock tower', 'Harbor hall'];
const DAYS_PER_BUILDING = 2;
const town = days => BUILDINGS.slice(0, Math.min(BUILDINGS.length, Math.floor((days || 0) / DAYS_PER_BUILDING)));
const nextBuildingIn = days => (town(days).length >= BUILDINGS.length ? null : DAYS_PER_BUILDING - ((days || 0) % DAYS_PER_BUILDING));
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ------------------------------------------------------------ F9 music: a layer per item cleared today, resolved when clear
const MAX_LAYERS = 5;
const musicLayers = cleared => Math.min(MAX_LAYERS, Math.max(0, cleared || 0));

const api = { hash, taskKey, boats, sailHeight, regular, mood, memory, ord, sky, SKY, weather, tide, RUN_GAP, comboNext, comboPitch, comboBonus, BADGES, earned, SHOP, buy, tideGoal, BUILDINGS, DAYS_PER_BUILDING, town, nextBuildingIn, dayKey, MAX_LAYERS, musicLayers };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HarborGame = api;
})(typeof window !== 'undefined' ? window : globalThis);
