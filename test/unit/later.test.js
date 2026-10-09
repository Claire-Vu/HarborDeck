'use strict';
// Later (app/renderer/later.js): when a parked item comes back on the desk. S = tomorrow 9:00, Shift+S = just after the
// next usage reset, the Later slip = any date and time ahead.
const test = require('node:test');
const assert = require('node:assert');
const L = require('../../app/renderer/later');

const at = (y, mo, d, h = 0, mi = 0) => Math.floor(new Date(y, mo - 1, d, h, mi) / 1000);

test('tomorrow 9:00 local, across a month end', () => {
  assert.strictEqual(L.tomorrowNine(at(2026, 10, 9, 2, 24)), at(2026, 10, 10, 9));
  assert.strictEqual(L.tomorrowNine(at(2026, 10, 31, 23, 59)), at(2026, 11, 1, 9));
});

test('after the next reset: the soonest reset still ahead, plus a minute; null when none is known', () => {
  const now = at(2026, 10, 9, 2, 24);
  assert.strictEqual(L.afterReset(now, [now + 9000, now - 60, now + 3600]), now + 3660);
  assert.strictEqual(L.afterReset(now, [now - 60]), null);
  assert.strictEqual(L.afterReset(now, []), null);
});

test('a picked date and time: local epoch seconds, only when ahead of now', () => {
  const now = at(2026, 10, 9, 2, 24);
  assert.strictEqual(L.picked('2026-10-12T14:30', now), at(2026, 10, 12, 14, 30));
  assert.strictEqual(L.picked('2026-10-12T14:30:00', now), at(2026, 10, 12, 14, 30)); // some pickers add seconds
  assert.strictEqual(L.picked('2026-10-09T02:00', now), null); // already past
  assert.strictEqual(L.picked('', now), null);
  assert.strictEqual(L.picked('next week', now), null);
  assert.strictEqual(L.picked('2026-02-30T09:00', now), null); // no such day
});

test('inputValue: an epoch as the picker value, round trip through picked', () => {
  const t = at(2026, 11, 3, 4, 31);
  assert.strictEqual(L.inputValue(t), '2026-11-03T04:31');
  assert.strictEqual(L.picked(L.inputValue(t), t - 60), t);
});
