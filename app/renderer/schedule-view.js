/* Harbor Deck renderer: pure view helpers for the limit-reset scheduler (scheduler.json from the main process).
   Loaded before app.js; no DOM, no state. */
'use strict';
window.HarborSchedule = (() => {
  const dur = secs => {
    const s = Math.max(0, secs);
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
    return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
  };
  // Next occurrence of a local HH:MM.
  const nextClockEpoch = hhmm => { const [hh, mm] = hhmm.split(':').map(Number); const d = new Date(); d.setHours(hh, mm, 0, 0); if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); return Math.floor(d.getTime() / 1000); };
  function queuedLabel(p, sched, t, fmtTime) {
    if (!sched?.enabled) return 'held: the scheduler is off (harbordeck scheduler on)';
    if (!p.due) return 'going out on the next tick';
    const d = p.due - t;
    if (d <= 0) return d < -180 ? 'overdue: is the scheduler running? (harbordeck scheduler install)' : 'going out now';
    return p.kind === 'reset' ? `waiting for reset · ${dur(d)}` : `queued for ${fmtTime(p.due)} · ${dur(d)}`;
  }
  // Top-bar chip: queued count, time to reset, keep-awake. null when there is nothing to show.
  function chip(sched, orders, t, { fmtTime, fmtDate }) {
    if (!sched) return null;
    const pend = (sched.pending || []).filter(p => p.kind !== 'limit').length;
    const reset = sched.next_reset && sched.next_reset > t ? sched.next_reset : null;
    const awake = sched.keep_awake && sched.keep_awake.until > t ? sched.keep_awake.until : null;
    if (!pend && !reset && sched.enabled) return null;
    const text = [!sched.enabled && 'scheduler off', pend && `⏳ ${pend} queued`, reset && `↻ ${dur(reset - t)}`, awake && `☕ ${fmtTime(awake)}`].filter(Boolean).join(' · ');
    const title = [!sched.enabled && 'Scheduler is off: nothing queued goes out (harbordeck scheduler on).',
      pend && `${pend} waiting in the scheduler${orders ? ` (${orders} order${orders > 1 ? 's' : ''})` : ''}; they go out by themselves.`,
      reset && `Usage limit resets at ${fmtTime(reset)}${reset - t > 86400 ? ' ' + fmtDate(reset) : ''}.`,
      awake && `Keeping this Mac awake until ${fmtTime(awake)} (display can still sleep).`].filter(Boolean).join(' ');
    return { off: !sched.enabled, text, title };
  }
  return { dur, nextClockEpoch, queuedLabel, chip };
})();
