'use strict';
// Bundles (app/renderer/topic-view.js): open items arrive together by topic only, never by a rel link; the head is the
// weightiest member (decision, review, to-do, report; then priority); an unopened review or report is not on the stamp.
const test = require('node:test');
const assert = require('node:assert');

globalThis.window = globalThis.window || {};
require('../../app/renderer/topic-view');
const state = {};
const view = window.HarborTopicView({ st: id => (state[id] ||= {}) });
const it = (id, kind, extra) => ({ id, kind, priority: 3, ...extra });

test('a rel link never bundles; a shared topic does', () => {
  const items = [it('font', 'decision', { topic: 'brand', project: 'brand' }), it('deck', 'review', { topic: 'brand', project: 'brand' }), it('quote', 'answer', { rel: ['font'], project: 'other' })];
  const g = view.groups(items);
  assert.deepStrictEqual(g.get('font').map(m => m.id), ['font', 'deck']);
  assert.deepStrictEqual(g.get('quote').map(m => m.id), ['quote']);
});

test('the head is the decision even when a report sorts first with a higher priority', () => {
  const items = [it('licence', 'answer', { topic: 't', priority: 1 }), it('deck', 'review', { topic: 't', priority: 2 }), it('font', 'decision', { topic: 't', priority: 2 }), it('font2', 'decision', { topic: 't', priority: 3 })];
  assert.deepStrictEqual(view.groups(items).get('licence').map(m => m.id), ['font', 'licence', 'deck', 'font2']);
});

test('decisions start ticked; reviews and reports only once opened; a hand tick or untick wins', () => {
  const [d, r, a] = [it('d', 'decision'), it('r', 'review'), it('a', 'answer')];
  assert.deepStrictEqual([d, r, a].map(view.ticked), [true, false, false]);
  state.r.read = true; state.a.skipBundle = false; state.d.skipBundle = true;
  assert.deepStrictEqual([d, r, a].map(view.ticked), [false, true, true]);
});
