'use strict';
// Stamina views (app/renderer/stamina.js): % left from used, plain window names, freshest source wins, staleness,
// reset formatting and the run-out projection. Synthetic readings only.
const test = require('node:test');
const assert = require('node:assert');
const ST = require('../../app/renderer/stamina');

const T = 1800000000, H = 3600, D = 86400;
const q = (extra) => ({ name: 'Acme', window: '5h', used_pct: 30, resets_at: T + 2 * H, at: T - 60, ...extra });
const statusline = (at, limits) => ({ default: { at, rate_limits: limits } });

test('window names are plain: 5h stays, 7d and 1w are a week, 1d and 24h a day', () => {
  assert.deepStrictEqual(['5h', '7d', '1w', '1d', '24h', '30d'].map(ST.windowName), ['5h', 'week', 'week', 'day', 'day', '30d']);
  assert.strictEqual(ST.winSecs('7d'), 7 * D); assert.strictEqual(ST.winSecs('nonsense'), null);
});

test('a view shows % left, not used, labelled "<provider> · <window>"', () => {
  const [v] = ST.views([q({ used_pct: 18 })], { t: T });
  assert.strictEqual(v.left, 82); assert.strictEqual(v.used, 18); assert.strictEqual(v.label, 'Acme · 5h');
  assert.strictEqual(v.in, 2 * H); assert.strictEqual(v.level, 'ok');
  assert.strictEqual(ST.views([q({ window: '7d', used_pct: 95 })], { t: T })[0].label, 'Acme · week');
  assert.strictEqual(ST.views([q({ used_pct: 95 })], { t: T })[0].level, 'empty');
});

test('reset countdowns are short; ages read as "ago"', () => {
  assert.deepStrictEqual([30, 12 * 60, 4 * H + 12 * 60, 6 * D + 7 * H + 5].map(ST.dur), ['1m', '12m', '4h 12m', '6d 7h']);
  assert.deepStrictEqual([10, 5 * 60, 3 * H, 2 * D].map(ST.ago), ['just now', '5m ago', '3h ago', '2d ago']);
});

test('per-model windows come after the account windows of their provider', () => {
  const vs = ST.views([q({ window: '7d', model: 'Opal' }), q({ window: '7d' }), q({ name: 'Other' }), q()], { t: T });
  assert.deepStrictEqual(vs.map(v => v.label), ['Acme · 5h', 'Acme · week', 'Acme Opal · week', 'Other · 5h']);
  assert.deepStrictEqual(vs.map(v => v.model), [null, null, 'Opal', null]);
});

test('status line windows map to Claude rows: five_hour 5h, seven_day 7d, a model suffix becomes the model', () => {
  assert.deepStrictEqual(ST.statuslineWindow('five_hour'), { window: '5h', model: undefined });
  assert.deepStrictEqual(ST.statuslineWindow('seven_day_opal'), { window: '7d', model: 'Opal' });
  assert.strictEqual(ST.statuslineWindow('weird'), null);
  const rows = ST.fromStatusline(statusline(T, { five_hour: { used_percentage: 18.4, resets_at: T + H }, seven_day: { used_percentage: 2, resets_at: T + 3 * D } }));
  assert.deepStrictEqual(rows.map(r => [r.name, r.window, r.used_pct, r.source]), [['Claude', '5h', 18.4, 'statusline'], ['Claude', '7d', 2, 'statusline']]);
  // no default account: the freshest one
  assert.strictEqual(ST.fromStatusline({ a1: { at: T - 99, rate_limits: { five_hour: { used_percentage: 1, resets_at: T + H } } }, a2: { at: T, rate_limits: { five_hour: { used_percentage: 7, resets_at: T + H } } } })[0].used_pct, 7);
});

test('the fresher of quota.json and the status line wins for the same window', () => {
  const quota = [q({ name: 'Claude', used_pct: 20, at: T - 300 }), q({ name: 'Claude', window: '7d', used_pct: 3, resets_at: T + 3 * D, at: T - 300 }), q({ name: 'Claude', model: 'Opal', window: '7d', used_pct: 0, resets_at: T + 3 * D, at: T - 300 })];
  const fresh = statusline(T - 30, { five_hour: { used_percentage: 22, resets_at: T + 2 * H }, seven_day: { used_percentage: 2, resets_at: T + 3 * D } });
  const vs = ST.views(quota, { rates: fresh, t: T });
  assert.deepStrictEqual(vs.map(v => [v.label, v.left, v.source]), [['Claude · 5h', 78, 'statusline'], ['Claude · week', 98, 'statusline'], ['Claude Opal · week', 100, 'quota']]);
  const old = statusline(T - 900, { five_hour: { used_percentage: 5, resets_at: T + 2 * H } });
  assert.strictEqual(ST.views(quota, { rates: old, t: T })[0].left, 80, 'older status line loses');
  // a status line window quota.json lacks is added
  assert.deepStrictEqual(ST.views([], { rates: fresh, t: T }).map(v => v.label), ['Claude · 5h', 'Claude · week']);
});

test('staleness: rows without their own time use quota.json mtime; older than 30 min is stale', () => {
  const noAt = { name: 'Acme', window: '5h', used_pct: 10, resets_at: T + H };
  assert.strictEqual(ST.views([noAt], { quotaAt: T - 60, t: T })[0].stale, false);
  assert.strictEqual(ST.views([noAt], { quotaAt: T - ST.STALE_AFTER - 1, t: T })[0].stale, true);
  assert.strictEqual(ST.views([noAt], { t: T })[0].stale, true, 'unknown age is stale');
});

test('a window whose reset has passed is not rolled forward: what is left is unknown', () => {
  const [v] = ST.views([q({ resets_at: T - 60 })], { t: T });
  assert.strictEqual(v.reset, true); assert.strictEqual(v.left, null); assert.strictEqual(v.level, 'unknown');
  assert.strictEqual(ST.lowest([v]), null);
  assert.strictEqual(ST.lowest(ST.views([q({ used_pct: 40 }), q({ window: '7d', used_pct: 70, resets_at: T + D })], { t: T })), 30);
});

test('run-out: linear pace from the window start, shown only when it beats the reset', () => {
  // 5h window opened 48 min before the reading, 18% used: 82% more takes ~218.7 min -> before the reset 4h12m away
  const r = { used_pct: 18, at: T, resets_at: T + 4 * H + 12 * 60 };
  assert.strictEqual(ST.projectRunOut(r, 5 * H), T + Math.round(82 * 48 * 60 / 18));
  assert.strictEqual(ST.projectRunOut({ ...r, used_pct: 5 }, 5 * H), null, 'slow pace reaches the reset first');
  assert.strictEqual(ST.projectRunOut({ ...r, resets_at: T + 5 * H - 60 }, 5 * H), null, 'too early in the window to judge');
  assert.strictEqual(ST.views([q({ ...r, window: '5h' })], { t: T })[0].runsOut, T + Math.round(82 * 48 * 60 / 18));
  const [v] = ST.views([q({ ...r, window: '5h', runs_out_at: T + 3 * H })], { t: T });
  assert.strictEqual(v.runsOut, T + 3 * H, 'the adapter\'s own projection wins');
  const [s] = ST.views([], { rates: statusline(T, { five_hour: { used_percentage: 18, resets_at: r.resets_at } }), t: T });
  assert.strictEqual(s.runsOut, T + Math.round(82 * 48 * 60 / 18), 'status line rows are projected locally');
});

test('hover text spells out left, used, local reset time, source and age, and the run-out warning', () => {
  const fmt = { fmtTime: ts => `t${ts - T}`, fmtDate: ts => `d${ts - T}` };
  const [v] = ST.views([q({ model: 'Opal', used_pct: 40, runs_out_at: T + H })], { t: T });
  const text = ST.title(v, fmt);
  assert.match(text, /^Acme Opal · 5h: 60% left \(40% used\)\. Resets t7200, in 2h 0m\./);
  assert.match(text, /only Opal usage counts/); assert.match(text, /runs out about t3600, before the reset/);
  assert.match(text, /Reading: quota\.json, 1m ago\./);
  const [w] = ST.views([q({ window: '7d', resets_at: T + 3 * D, at: T - 2 * H })], { t: T });
  assert.match(ST.title(w, fmt), /Resets t259200 d259200, in 3d 0h\..*\(stale\)/s);
  const [far] = ST.views([q({ window: '7d', used_pct: 50, resets_at: T + 3 * D, runs_out_at: T + 2 * D })], { t: T });
  assert.match(ST.title(far, fmt), /runs out about t172800 d172800, before/);
});

test('the top bar order: run-out and low windows first, then the least left, unknown last (byUrgency)', () => {
  const vs = ST.views([
    q({ name: 'Primary', window: '5h', used_pct: 20 }), q({ name: 'Primary', window: '7d', used_pct: 41, resets_at: T + 3 * D }),
    q({ name: 'Backup', window: '5h', used_pct: 18 }), q({ name: 'Backup', window: '7d', used_pct: 88, resets_at: T + 3 * D }),
    q({ name: 'Gone', window: '5h', used_pct: 50, resets_at: T - 60 }), q({ name: 'Pace', window: '5h', used_pct: 40, runs_out_at: T + H })
  ], { t: T });
  assert.deepStrictEqual(ST.byUrgency(vs).map(v => v.label), ['Backup · week', 'Pace · 5h', 'Primary · week', 'Primary · 5h', 'Backup · 5h', 'Gone · 5h']);
  assert.deepStrictEqual(ST.byUrgency(vs).map(ST.warns), [true, true, false, false, false, false]);
});
