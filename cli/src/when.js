// Time parsing for the scheduler: "when" arguments and the reset time in a limit message.
const now = () => Math.floor(Date.now() / 1000);

const pad = (n) => String(n).padStart(2, '0');

// Epoch of a wall-clock time in an IANA zone (or the local zone when tz is falsy).
export function zonedEpoch(y, mo, d, h, mi, tz) {
  if (!tz) return Math.floor(new Date(y, mo - 1, d, h, mi, 0).getTime() / 1000);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  const wall = Date.UTC(y, mo - 1, d, h, mi, 0);
  let t = wall;
  for (let i = 0; i < 3; i++) { // converge on the zone offset (twice covers DST edges)
    const f = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    const seen = Date.UTC(+f.year, +f.month - 1, +f.day, +f.hour % 24, +f.minute, +f.second);
    t += wall - seen;
  }
  return Math.floor(t / 1000);
}

// Wall-clock parts of an epoch in tz (or local).
function partsIn(epoch, tz) {
  if (!tz) { const d = new Date(epoch * 1000); return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate() }; }
  const f = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(epoch * 1000)).map((x) => [x.type, x.value]));
  return { y: +f.year, mo: +f.month, d: +f.day };
}

// Next occurrence of h:mi (today or tomorrow) after t.
function nextClock(h, mi, t, tz) {
  const p = partsIn(t, tz);
  let e = zonedEpoch(p.y, p.mo, p.d, h, mi, tz);
  if (e <= t) { const q = partsIn(t + 86400, tz); e = zonedEpoch(q.y, q.mo, q.d, h, mi, tz); }
  return e;
}

// "HH:MM" (next occurrence), "+30m" "+2h" "+1d", "YYYY-MM-DD HH:MM" (local), ISO 8601, "@<epoch>".
// Returns epoch seconds, or null when unparseable.
export function parseWhen(s, t = now()) {
  s = String(s).trim();
  let m;
  if ((m = /^@(\d{9,11})$/.exec(s))) return Number(m[1]);
  if ((m = /^\+(\d+(?:\.\d+)?)([smhd])$/.exec(s))) return t + Math.round(Number(m[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[m[2]]);
  if ((m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s))) return nextClock(+m[1], +m[2], t);
  if ((m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(s))) return zonedEpoch(+m[1], +m[2], +m[3], +m[4], +m[5]);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) { const v = Date.parse(s); return Number.isNaN(v) ? null : Math.floor(v / 1000); }
  return null;
}

const MONTHS = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');

// Reset time from a limit message: "resets 3pm", "resets Oct 9, 3:30pm (Europe/Paris)",
// "resets at 15:00", or a "...|<epoch>" suffix. Returns epoch seconds or null.
export function parseResetText(text, t = now()) {
  if (!text) return null;
  let m = /\|(\d{10})\b/.exec(text);
  if (m) return Number(m[1]);
  m = /resets?\s+(?:at\s+)?(?:([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(?:at\s+)?)?(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?(?:\s*\(([A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+|UTC)\))?/i.exec(text);
  if (!m) return null;
  const [, mon, day, hs, mins, ap, tz0] = m;
  if (!ap && mins === undefined) return null; // "resets 3" is not a time
  let h = Number(hs);
  if (ap) { if (h < 1 || h > 12) return null; h = (h % 12) + (/^p/i.test(ap) ? 12 : 0); } else if (h > 23) return null;
  const mi = Number(mins || 0);
  let tz = tz0 || null;
  if (tz) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { tz = null; } }
  if (mon && MONTHS.includes(mon.toLowerCase().slice(0, 3))) {
    const mo = MONTHS.indexOf(mon.toLowerCase().slice(0, 3)) + 1;
    let y = partsIn(t, tz).y;
    let e = zonedEpoch(y, mo, Number(day), h, mi, tz);
    if (e < t - 86400) e = zonedEpoch(++y, mo, Number(day), h, mi, tz);
    return e;
  }
  return nextClock(h, mi, t, tz);
}

export function fmtTime(epoch) {
  const d = new Date(epoch * 1000);
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
