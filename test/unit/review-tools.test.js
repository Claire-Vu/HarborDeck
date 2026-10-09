'use strict';
// What changed (changes.js) and search ranking (search-view.js): the pure parts, in node.
const test = require('node:test');
const assert = require('node:assert');
const CH = require('../../app/renderer/changes');
const SR = require('../../app/renderer/search-view');

const item = over => ({ id: 'x', title: 'Pick a host?', summary: 'Host A is cheaper. Host B is faster.', options: [{ key: 'a', label: 'Host A' }, { key: 'b', label: 'Host B' }], artifacts: [{ type: 'report', path: '/r/a.md' }], ...over });

test('what changed: nothing new is null; no earlier version is null', () => {
  const d = CH.digest(item(), 'line one\nline two', [{ at: 10 }]);
  assert.strictEqual(CH.diff(d, CH.digest(item(), 'line one\nline two', [{ at: 10 }])), null);
  assert.strictEqual(CH.diff(undefined, d), null);
});

test('what changed: only the new parts', () => {
  const was = CH.digest(item(), '# Hosts\nA: $5\nB: $9', [{ at: 10 }]);
  const now = CH.digest(item({ title: 'Pick a host today?', summary: 'Host A is cheaper. Host B now matches the price.',
    options: [{ key: 'a', label: 'Host A' }, { key: 'b', label: 'Host B (discounted)' }, { key: 'c', label: 'Neither' }],
    artifacts: [{ type: 'report', path: '/r/a.md' }, { type: 'image', path: '/r/chart.png' }] }), '# Hosts\nB: $5\nA: $5', [{ at: 10 }, { at: 20 }]);
  assert.deepStrictEqual(CH.diff(was, now), { title: 'Pick a host?', claims: ['Host B now matches the price.'], options: ['b', 'c'], arts: ['/r/chart.png'], since: 10, lines: ['B: $5'] });
  assert.strictEqual(CH.describe(CH.diff(was, now)), 'title, 1 sentence, 2 options, 1 paper, replies, 1 body line');
});

test('what changed: moved body lines are not news; long bodies are not compared', () => {
  assert.deepStrictEqual(CH.newLines('a\nb\nb', 'b\na\nb\nc'), ['c']);
  const big = 'x'.repeat(30000);
  assert.strictEqual(CH.digest(item(), big, []).body, null);
  assert.strictEqual(CH.diff(CH.digest(item(), big, []), CH.digest(item(), big + 'y', [])), null);
});

test('search: substring beats scatter, word starts win, every word must match', () => {
  assert.ok(SR.score('host', 'pick a host?') > SR.score('hst', 'pick a host?'));
  assert.ok(SR.score('pr', 'pricing launch') > SR.score('pr', 'flaky e2e repro'));
  assert.strictEqual(SR.score('zz', 'pick a host?'), null);
  const all = SR.index([
    { title: 'Merge PR 142 (calmer checkout)?', keys: 'pr-142-checkout checkout board-app' },
    { title: 'Pick a logo direction', keys: 'logo-direction logo brand', text: 'Warm or cool palette.' },
    { title: '#checkout', keys: 'checkout' },
    { title: 'Newsletter #6 draft', keys: 'newsletter-6 newsletter brand' }
  ]);
  assert.deepStrictEqual(SR.rank(all, 'logo').map(e => e.title), ['Pick a logo direction']);
  assert.deepStrictEqual(SR.rank(all, 'palette').map(e => e.title), ['Pick a logo direction'], 'summary text, substring');
  assert.deepStrictEqual(SR.rank(all, 'mrg chk').map(e => e.title), ['Merge PR 142 (calmer checkout)?'], 'fuzzy, two words');
  assert.strictEqual(SR.rank(all, 'brand news')[0].title, 'Newsletter #6 draft');
  assert.deepStrictEqual(SR.rank(all, 'qqq'), []);
  assert.strictEqual(SR.rank(all, '').length, 4, 'empty query keeps the given order');
});

test('search: a few thousand entries rank instantly', () => {
  const all = SR.index(Array.from({ length: 5000 }, (_, i) => ({ title: `Item ${i} about ${['release', 'pricing', 'logo', 'infra'][i % 4]} work`, keys: `item-${i} topic-${i % 50}`, text: 'A summary sentence. Another one.' })));
  const t0 = process.hrtime.bigint();
  for (const q of ['r', 're', 'rel', 'rele', 'relea', 'release 42']) SR.rank(all, q);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 300, `six keystrokes over 5000 entries took ${ms.toFixed(0)} ms`);
  assert.strictEqual(SR.rank(all, 'item 4242 logo')[0].keys, 'item-4242 topic-42');
});
