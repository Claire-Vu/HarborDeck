/* Stamina: subscription usage windows for the top bar, crew tab, manifest and harbor tide. Pure functions, no DOM.
   Two sources: quota.json (any provider, from an adapter such as hd-quota.sh) and the Claude Code status line
   snapshot (schedule/rate-limits.json, Claude only). The same window from both sources shows the fresher reading.
   A view says what is LEFT (100 - used), when it resets, how old the reading is and, when the pace so far would
   empty the window before it resets, roughly when. Loaded before app.js in the renderer; required by unit tests. */
(function (root) {
'use strict';

const STALE_AFTER = 30 * 60; // a reading older than this is marked stale
const MIN_PACE_SECS = 15 * 60; // project a run-out only after this much of the window has passed
const STATUSLINE_NAME = 'Claude'; // the status line only reports Claude Code's account windows

// "5h" | "7d" | "1w" -> seconds (null when unreadable)
const winSecs = w => { const m = String(w).match(/^(\d+)\s*([hdw])$/i); return m ? +m[1] * { h: 3600, d: 86400, w: 604800 }[m[2].toLowerCase()] : null; };
// plain window name: 7d / 1w -> week, 1d / 24h -> day, otherwise as written
function windowName(w) {
  const s = winSecs(w);
  if (s === 604800) return 'week';
  if (s === 86400) return 'day';
  return String(w);
}
// countdown: 12m, 4h 12m, 6d 7h
function dur(secs) {
  const s = Math.max(0, secs);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}
// how old a reading is: just now, 4m, 2h, 3d
function ago(secs) {
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}
const level = left => left == null ? 'unknown' : left < 10 ? 'empty' : left < 25 ? 'low' : left < 50 ? 'mid' : 'ok';

// Claude Code status line rate_limits key -> window: five_hour -> 5h, seven_day -> 7d, seven_day_opus -> 7d of Opus.
const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, twelve: 12, thirty: 30 };
function statuslineWindow(key) {
  const m = String(key).match(/^([a-z]+|\d+)_(hour|day|week)s?(?:_(.+))?$/i);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? +m[1] : NUM[m[1].toLowerCase()];
  if (!n) return null;
  const model = m[3] ? m[3].charAt(0).toUpperCase() + m[3].slice(1) : undefined;
  return { window: `${n}${m[2][0].toLowerCase()}`, model };
}
// rate-limits.json ({<account>: {at, rate_limits}}) -> quota-shaped rows. The default account if present, else the freshest.
function fromStatusline(rates) {
  if (!rates || typeof rates !== 'object') return [];
  const acct = rates.default || Object.values(rates).filter(a => a && a.at).sort((a, b) => b.at - a.at)[0];
  if (!acct || !acct.rate_limits || !acct.at) return [];
  const rows = [];
  for (const [key, w] of Object.entries(acct.rate_limits)) {
    const win = statuslineWindow(key); const used = Number(w && w.used_percentage); const resets = Number(w && w.resets_at);
    if (!win || !Number.isFinite(used) || !(resets > 0)) continue;
    rows.push({ name: STATUSLINE_NAME, model: win.model, window: win.window, used_pct: Math.min(100, Math.max(0, used)), resets_at: Math.round(resets), at: acct.at, source: 'statusline' });
  }
  return rows;
}

const sameWindow = (a, b) => a.name.toLowerCase() === b.name.toLowerCase() && (a.model || '') === (b.model || '') && winSecs(a.window) === winSecs(b.window);

// Linear pace: the share used since the window opened, carried forward. null when it reaches the reset first.
function projectRunOut(r, secs) {
  if (!secs || !r.at || r.used_pct <= 0 || r.used_pct >= 100) return null;
  const elapsed = r.at - (r.resets_at - secs);
  if (elapsed < MIN_PACE_SECS) return null;
  const out = Math.round(r.at + (100 - r.used_pct) * elapsed / r.used_pct);
  return out < r.resets_at ? out : null;
}

// quota rows + status line -> one view per window, account windows before per-model ones, grouped by provider.
// opts: { quotaAt (quota.json mtime, for rows without `at`), rates (rate-limits.json), t (now, epoch seconds) }
function views(quota, opts = {}) {
  const t = opts.t || Math.floor(Date.now() / 1000);
  const rows = (Array.isArray(quota) ? quota : []).filter(q => q && q.name && winSecs(q.window))
    .map(q => ({ ...q, at: q.at || opts.quotaAt || null, source: 'quota' }));
  for (const s of fromStatusline(opts.rates)) {
    const i = rows.findIndex(r => sameWindow(r, s));
    if (i < 0) rows.push(s); else if (s.at > (rows[i].at || 0)) rows[i] = s;
  }
  const order = [...new Set(rows.map(r => r.name))];
  rows.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name) || !!a.model - !!b.model || winSecs(a.window) - winSecs(b.window));
  return rows.map(r => {
    const secs = winSecs(r.window); const reset = r.resets_at <= t; const age = r.at ? Math.max(0, t - r.at) : null;
    const left = reset ? null : Math.round(100 - r.used_pct);
    // an adapter's own projection (quota.json runs_out_at) wins over the linear one
    const runsOut = reset ? null : r.runs_out_at ? (r.runs_out_at < r.resets_at ? r.runs_out_at : null) : projectRunOut(r, secs);
    return {
      name: r.name, model: r.model || null, window: r.window, secs, win: windowName(r.window),
      label: `${r.name}${r.model ? ' ' + r.model : ''} · ${windowName(r.window)}`,
      used: reset ? null : Math.round(r.used_pct), left, level: level(left),
      resets: r.resets_at, in: r.resets_at - t, reset, at: r.at, age, stale: age == null || age > STALE_AFTER,
      source: r.source, runsOut: runsOut && runsOut > t ? runsOut : null
    };
  });
}

const SOURCE = { statusline: 'Claude Code status line', quota: 'quota.json' };
// hover text: every number with its meaning, the reset in local time, the source and its age
function title(v, { fmtTime, fmtDate }) {
  const when = ts => `${fmtTime(ts)}${v.in > 20 * 3600 ? ' ' + fmtDate(ts) : ''}`;
  const lines = [v.reset
    ? `${v.label}: reset at ${when(v.resets)}; no reading since, so what is left is unknown.`
    : `${v.label}: ${v.left}% left (${v.used}% used). Resets ${when(v.resets)}, in ${dur(v.in)}.`];
  if (v.model) lines.push(`Per-model window: only ${v.model} usage counts here; the account windows still apply.`);
  if (v.runsOut) lines.push(`At this pace it runs out about ${fmtTime(v.runsOut)}${v.runsOut - (v.resets - v.in) > 20 * 3600 ? ' ' + fmtDate(v.runsOut) : ''}, before the reset.`);
  lines.push(`Reading: ${SOURCE[v.source]}, ${v.age == null ? 'time unknown' : ago(v.age)}${v.stale ? ' (stale)' : ''}.`);
  return lines.join('\n');
}

const known = vs => vs.filter(v => v.left != null);
const lowest = vs => { const k = known(vs); return k.length ? Math.min(...k.map(v => v.left)) : null; };

const api = { STALE_AFTER, MIN_PACE_SECS, winSecs, windowName, dur, ago, level, statuslineWindow, fromStatusline, projectRunOut, views, title, lowest };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HarborStamina = api;
})(typeof window !== 'undefined' ? window : globalThis);
