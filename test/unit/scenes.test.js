'use strict';
// Scenes (app/renderer/scene-view.js): one per kind, a figure per open item, arrow order, progress to zero.
const test = require('node:test');
const assert = require('node:assert');
const SC = require('../../app/renderer/scene-view');

const it = (id, kind, status = 'open') => ({ id, kind, status });
const open = i => i.status === 'open';

test('scenes: one per item kind, each with a name and a quirk', () => {
  assert.deepStrictEqual(SC.KINDS, ['decision', 'review', 'answer', 'todo']);
  for (const s of SC.SCENES) { assert.ok(s.name && s.quirk && s.clear && s.one && s.many); assert.strictEqual(SC.byKind[s.kind], s); }
  assert.strictEqual(new Set(SC.SCENES.map(s => s.name)).size, SC.SCENES.length);
});

test('group and tally: the count is literal, open items only, order kept', () => {
  const g = SC.group([it('d1', 'decision'), it('r1', 'review'), it('d2', 'decision'), it('d3', 'decision', 'resolved'), it('t1', 'todo', 'later'), it('x', 'mystery')], open);
  assert.deepStrictEqual(g.decision.map(i => i.id), ['d1', 'd2']);
  assert.deepStrictEqual(g.review.map(i => i.id), ['r1']);
  assert.deepStrictEqual(g.answer, []); assert.deepStrictEqual(g.todo, []);
  assert.deepStrictEqual(SC.tally(g), { decision: 2, review: 1, answer: 0, todo: 0, total: 3 });
  // one open decision is one figure
  assert.strictEqual(SC.tally(SC.group([it('only', 'decision')], open)).decision, 1);
});

test('step: arrows wrap around; an unknown scene starts at an end', () => {
  assert.strictEqual(SC.step('decision', 1), 'review');
  assert.strictEqual(SC.step('todo', 1), 'decision');
  assert.strictEqual(SC.step('decision', -1), 'todo');
  assert.strictEqual(SC.step('all', 1), 'decision');
  assert.strictEqual(SC.step('all', -1), 'todo');
});

test('nextBusy: the next scene with anyone waiting, null at zero', () => {
  const c = { decision: 0, review: 0, answer: 2, todo: 1, total: 3 };
  assert.strictEqual(SC.nextBusy('decision', c), 'answer');
  assert.strictEqual(SC.nextBusy('todo', c), 'answer');
  assert.strictEqual(SC.nextBusy('answer', { ...c, todo: 0 }), 'answer'); // only itself left
  assert.strictEqual(SC.nextBusy('decision', { decision: 0, review: 0, answer: 0, todo: 0, total: 0 }), null);
});

test('progress toward zero and who left', () => {
  assert.deepStrictEqual(SC.progress(3, 1), { left: 3, cleared: 1, pct: 25, zero: false });
  assert.deepStrictEqual(SC.progress(0, 4), { left: 0, cleared: 4, pct: 100, zero: true });
  assert.strictEqual(SC.progress(0, 0).zero, true);
  assert.deepStrictEqual(SC.leavers(['a', 'b', 'c'], ['a', 'c', 'd']), ['b']);
});
