'use strict';
// Which URLs the in-desk browser pane may show: http(s) on this machine by default, plus hosts the user
// adds in Settings ("host" or "host:port"). Everything else opens in the system browser instead.
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

function parseHosts(v) {
  const list = Array.isArray(v) ? v : String(v || '').split(/[\s,]+/);
  return [...new Set(list.map(s => String(s).trim().toLowerCase()).filter(Boolean))];
}

function isAllowedWebUrl(raw, extraHosts = []) {
  let u; try { u = new URL(String(raw)); } catch (e) { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  if (LOOPBACK.has(u.hostname)) return true;
  return parseHosts(extraHosts).some(h => h === u.hostname || h === u.host);
}

module.exports = { isAllowedWebUrl, parseHosts };
