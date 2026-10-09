'use strict';
// The harbor game rules (app/renderer/harbor-game.js): boats per task, regulars, sky/tide, tidy runs, stamp book,
// chandlery, town and music layers.
const test = require('node:test');
const assert = require('node:assert');
const G = require('../../app/renderer/harbor-game');

const it = (id, extra) => ({ id, title: id, project: 'p', priority: 3, ...extra });

test('boats: one per task; q-series share a boat, a topic wins, sail grows with calls', () => {
  const b = G.boats([it('build.q1'), it('build.q2'), it('build.q3'), it('solo', { priority: 1 }), it('x', { topic: 'launch' }), it('y', { topic: 'launch' })]);
  assert.deepStrictEqual(b.map(x => [x.key, x.calls]), [['solo', 1], ['build', 3], ['launch', 2]]);
  assert.strictEqual(b[0].title, 'solo'); assert.strictEqual(b[1].title, 'Build');
  assert.ok(G.sailHeight(4) > G.sailHeight(1)); assert.strictEqual(G.sailHeight(40), G.sailHeight(6));
});

test('regulars: stable per project, mood and memory follow recent calls', () => {
  assert.deepStrictEqual(G.regular('harbordeck'), G.regular('harbordeck'));
  assert.notStrictEqual(G.regular('harbordeck').name, G.regular('content-tools').name);
  const t = 1e9, day = 86400;
  assert.strictEqual(G.mood([], t), 'new'); assert.strictEqual(G.memory([], t), 'First time at your window.');
  const good = [1, 2, 3].map(k => ({ action: 'approve', at: t - k * 3600 }));
  assert.strictEqual(G.mood(good, t), 'cheerful'); assert.strictEqual(G.memory(good, t), '3rd call settled this week!');
  assert.strictEqual(G.mood([{ action: 'reject', at: t - 60 }], t), 'grumpy');
  assert.strictEqual(G.memory([{ action: 'needs-work', at: t - 60 }], t), 'Brought the reworked papers back.');
  assert.strictEqual(G.memory([{ action: 'approve', at: t - 30 * day }], t), 'Back after a quiet week.');
});

test('sky, weather and tide', () => {
  assert.deepStrictEqual([2, 6, 12, 19, 22].map(G.sky), ['night', 'dawn', 'day', 'dusk', 'night']);
  assert.deepStrictEqual([null, 80, 30, 10].map(G.weather), ['fair', 'fair', 'cloudy', 'rain']);
  assert.strictEqual(G.tide([]), null);
  const t = G.tide([{ name: 'A', window: '5h', secs: 18000, in: 4500, resets: 99 }, { name: 'B', window: '7d', secs: 604800, in: 90000, resets: 999 }]);
  assert.strictEqual(t.name, 'A'); assert.strictEqual(t.level, .75); assert.strictEqual(t.resets, 99);
});

test('tidy run: stamps within the gap build, a gap resets, bulk never counts', () => {
  let s = G.comboNext(null, 100, false); assert.strictEqual(s.n, 1);
  s = G.comboNext(s, 105, false); assert.strictEqual(s.n, 2);
  s = G.comboNext(s, 105 + G.RUN_GAP, false); assert.strictEqual(s.n, 3);
  assert.strictEqual(G.comboNext(s, 200, false).n, 1);
  assert.strictEqual(G.comboNext(s, 106, true).n, 0);
  assert.ok(G.comboPitch(3) > G.comboPitch(2) && G.comboPitch(2) > G.comboPitch(1)); assert.strictEqual(G.comboPitch(1), 1);
  assert.strictEqual(G.comboBonus(1), 0); assert.strictEqual(G.comboBonus(3), 10);
});

test('stamp book: earned once, only what the context proves', () => {
  const base = { cleared: 1, run: 1, hour: 12, stamped: true, harborClear: false, beatTide: false, fullSheet: false, owned: new Set(), days: 1, spent: 0 };
  assert.deepStrictEqual(G.earned(base, {}), ['first']);
  assert.deepStrictEqual(G.earned(base, { first: 1 }), []);
  assert.deepStrictEqual(G.earned({ ...base, hour: 3, run: 5 }, { first: 1 }), ['five', 'night']);
  assert.ok(G.earned({ ...base, days: 10 }, {}).includes('town'));
});

test('chandlery: buy deducts, never twice, never on credit; ink and tune switch on purchase', () => {
  const fun = { owned: [], ink: 'red', track: 'harbor', spent: 0 };
  assert.strictEqual(G.buy(fun, 'lamp', 10).ok, false);
  const r = G.buy(fun, 'ink-teal', 100); assert.ok(r.ok); assert.strictEqual(r.cash, 40); assert.strictEqual(r.fun.ink, 'teal'); assert.strictEqual(r.fun.spent, 60);
  assert.strictEqual(G.buy(r.fun, 'ink-teal', 100).error, 'already owned');
  assert.strictEqual(G.buy(fun, 'track-night', 500).fun.track, 'night');
  assert.strictEqual(G.buy(fun, 'nope', 500).ok, false);
});

test('beat the tide goal re-arms after its deadline', () => {
  const tide = { resets: 500 };
  assert.strictEqual(G.tideGoal(null, 100, null), null);
  const g = G.tideGoal(null, 100, tide); assert.deepStrictEqual(g, { deadline: 500, beat: false });
  const won = { ...g, beat: true }; assert.strictEqual(G.tideGoal(won, 400, tide), won);
  assert.deepStrictEqual(G.tideGoal(won, 501, { resets: 900 }), { deadline: 900, beat: false });
});

test('town grows every two days and stops when complete; music layers cap', () => {
  assert.deepStrictEqual(G.town(1), []); assert.deepStrictEqual(G.town(4), ['Net shed', 'Fish market']);
  assert.strictEqual(G.town(999).length, G.BUILDINGS.length); assert.strictEqual(G.nextBuildingIn(3), 1); assert.strictEqual(G.nextBuildingIn(999), null);
  assert.strictEqual(G.dayKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.deepStrictEqual([0, 2, 9].map(G.musicLayers), [0, 2, G.MAX_LAYERS]);
});
