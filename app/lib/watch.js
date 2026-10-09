'use strict';
// Watches a data directory (top level + items/ + the status line usage snapshot) and calls onChange once per burst of writes.
// fs.watch misses events on some filesystems, so a slow stat poll backs it up.
const fs = require('fs');
const path = require('path');

function signature(home) {
  const parts = [];
  for (const dir of [home, path.join(home, 'items')]) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { continue; }
    for (const n of names.sort()) {
      try { const s = fs.statSync(path.join(dir, n)); if (s.isFile()) parts.push(`${dir}/${n}:${s.size}:${s.mtimeMs}`); } catch (e) { /* raced */ }
    }
  }
  const rates = path.join(home, 'schedule', 'rate-limits.json');
  try { const s = fs.statSync(rates); parts.push(`${rates}:${s.size}:${s.mtimeMs}`); } catch (e) { /* no status line tee */ }
  return parts.join('|');
}

function watchHome(home, onChange, { debounceMs = 120, pollMs = 3000 } = {}) {
  let timer = null, last = signature(home), closed = false;
  const fire = () => {
    timer = null; if (closed) return;
    const sig = signature(home); if (sig === last) return; last = sig; onChange();
  };
  const kick = () => { if (!closed) { clearTimeout(timer); timer = setTimeout(fire, debounceMs); } };
  const watchers = [];
  const attach = dir => { try { watchers.push(fs.watch(dir, kick)); } catch (e) { /* dir may not exist yet; the poll covers it */ } };
  attach(home); attach(path.join(home, 'items'));
  const poll = setInterval(kick, pollMs);
  return { close() { closed = true; clearTimeout(timer); clearInterval(poll); watchers.forEach(w => w.close()); } };
}

module.exports = { watchHome, signature };
