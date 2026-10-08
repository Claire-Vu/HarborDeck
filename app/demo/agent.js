'use strict';
// A pretend agent for demo mode: tails answers.jsonl like a real one would and answers through the same
// files (rewrites items, writes new items). Lets a new user see replies land without connecting anything.
const fs = require('fs');
const path = require('path');

const now = () => Math.floor(Date.now() / 1000);
function rewrite(home, id, fn) {
  const file = path.join(home, 'items', `${id}.json`);
  let it; try { it = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return; }
  fn(it); const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(it, null, 1) + '\n'); fs.renameSync(tmp, file);
}
function mateLabel(home, id) {
  try { const f = JSON.parse(fs.readFileSync(path.join(home, 'fleet.json'), 'utf8')); return (f.firstmates.find(m => m.id === id) || {}).label || 'First Mate'; } catch (e) { return 'First Mate'; }
}

function startDemoAgent(home, { replyMs = 6000, resolveMs = 1500 } = {}) {
  const file = path.join(home, 'answers.jsonl');
  let offset = 0; try { offset = fs.statSync(file).size; } catch (e) { /* no answers yet */ }
  const timers = new Set();
  const later = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); try { fn(); } catch (e) { /* demo only */ } }, ms); timers.add(t); };
  const handle = a => {
    if (a.action === 'ask' || a.action === 'needs-work') {
      later(replyMs, () => rewrite(home, a.id, it => {
        it.thread = it.thread || [];
        const text = a.action === 'ask' ? `Good question. Short answer: yes, and I added a line about it to the summary. (demo reply to "${a.note}")` : `On it: "${a.note}". I will bring a new version to the window. (demo reply)`;
        it.thread.push({ from: mateLabel(home, it.from), text, at: now() });
      }));
    } else if (a.action === 'request') {
      later(replyMs + 2000, () => {
        const it = { id: a.id, kind: 'answer', project: 'orders', from: a.to, priority: 3, title: `Order received: ${a.note.slice(0, 48)}`, summary: `Filed in the backlog and assigned. I will bring the result here when it is ready. (demo reply)`, created: now(), status: 'open' };
        fs.writeFileSync(path.join(home, 'items', `${a.id}.json`), JSON.stringify(it, null, 1) + '\n');
      });
    } else if (['decide', 'approve', 'reject', 'file'].includes(a.action)) {
      later(resolveMs, () => rewrite(home, a.id, it => { it.status = 'resolved'; }));
    }
  };
  const poll = setInterval(() => {
    let size = 0; try { size = fs.statSync(file).size; } catch (e) { return; }
    if (size < offset) offset = 0; if (size === offset) return;
    const fd = fs.openSync(file, 'r'); const buf = Buffer.alloc(size - offset); fs.readSync(fd, buf, 0, buf.length, offset); fs.closeSync(fd);
    const text = buf.toString('utf8'); const end = text.lastIndexOf('\n'); if (end < 0) return;
    offset += Buffer.byteLength(text.slice(0, end + 1));
    for (const ln of text.slice(0, end).split('\n')) { try { handle(JSON.parse(ln)); } catch (e) { /* torn line */ } }
  }, 500);
  return { stop() { clearInterval(poll); timers.forEach(clearTimeout); } };
}

module.exports = { startDemoAgent };
