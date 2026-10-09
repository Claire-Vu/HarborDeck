/* Later: when a parked item comes back on the desk. S parks it until tomorrow 9:00, Shift+S until just after the next
   known usage reset, and the Later slip (parked-shelf.js) until any date and time ahead. Pure, unit-tested in node;
   loaded before app.js. */
'use strict';
const HarborLater = (() => {
  const sec = d => Math.floor(d / 1000);
  function tomorrowNine(now) { const d = new Date(now * 1000); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return sec(d); }
  // a minute after the soonest reset still ahead, so the window has refilled; null when no reset is known
  function afterReset(now, resets) { const r = resets.filter(x => x > now).sort((a, b) => a - b)[0]; return r ? r + 60 : null; }
  // a datetime-local value ("2026-10-12T14:30", seconds optional) as local epoch seconds; null unless real and ahead
  function picked(value, now) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/.exec(value || ''); if (!m) return null;
    const d = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
    if (d.getMonth() !== m[2] - 1 || d.getDate() !== +m[3]) return null; // 30 February rolls over: refuse it
    return sec(d) > now ? sec(d) : null;
  }
  const pad = n => String(n).padStart(2, '0');
  const inputValue = t => { const d = new Date(t * 1000); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  return { tomorrowNine, afterReset, picked, inputValue };
})();
if (typeof module === 'object') module.exports = HarborLater;
