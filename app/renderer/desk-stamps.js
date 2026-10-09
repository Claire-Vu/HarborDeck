/* Answers and stamps: every captain action is one JSONL line appended to answers.jsonl (emit); a stamp is held for
   undo, then written; tidy runs, stamp book, chandlery purchases.
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

// ------------------------------------------------------------ answers (UI -> agent)
function emit(line) {
  line.note ??= ''; line.at = now();
  if (!writeLine(line)) return line;
  $('#log-count').textContent = S.answers.length;
  if ($('#agentlog').classList.contains('open')) renderLog();
  return line;
}
// One append to answers.jsonl; the watcher's next snapshot re-reads the file, so the mirror stays exact.
function writeLine(line) {
  const r = bridge.appendAnswer(line);
  if (!r?.ok) { toast(`Could not write answers.jsonl: ${r?.error || 'unknown error'}`, 'warn'); return false; }
  S.answers.push(JSON.parse(r.line)); return true;
}
const jsonl = () => S.answers.map(a => JSON.stringify(a)).join('\n') + (S.answers.length ? '\n' : '');
const UNDO_MS = 4000;
function earn(it, action, pitch) { const n = payFor(it, action); if (!n) return; S.cash += n; save(); $('#cash-n').textContent = money(S.cash); snd('coin', pitch); popCash(n); }

// ------------------------------------------------------------ stamps
const VERDICTS = ['approve', 'reject', 'needswork', 'ask'];
function trayConfig(it) {
  if (!it) return {};
  return {
    approve: { show: true, label: it.kind === 'decision' || it.kind === 'review' ? 'Approve' : 'File', cls: it.kind === 'answer' || it.kind === 'todo' ? 'file' : 'approve' },
    reject: { show: it.kind === 'decision' || it.kind === 'review', label: 'Reject', cls: 'reject' },
    needswork: { show: it.kind !== 'todo', label: 'Needs work', cls: 'needswork' },
    ask: { show: true, label: 'Ask', cls: 'ask' },
    later: { show: true, label: 'Later', cls: 'later' }
  };
}
function renderTray(it) {
  const cfg = trayConfig(it);
  document.querySelectorAll('#stamps .stamp').forEach(b => {
    const c = cfg[b.dataset.verdict]; b.disabled = !it || !c?.show || st(it.id).awaiting; b.hidden = !!(it && c && !c.show);
    b.querySelector('.lbl').textContent = c?.label || b.dataset.verdict; b.className = `stamp ${c?.cls || b.dataset.verdict}`;
  });
  $('#stamps').dataset.open = String(S.prefs.tray);
}
function toggleTray(open) { S.prefs.tray = open ?? !S.prefs.tray; save(); if (!S.prefs.tray) closeStowView(); $('#stamps').dataset.open = String(S.prefs.tray); snd('flip'); }
function stamp(verdict, toReset, pick) {
  const it = byId[S.current]; if (!it || statusOf(it) !== 'open') { toast('Nobody at the desk.'); return; }
  const s = st(it.id); if (s.awaiting) { toast('Already sent back; wait for the reply.'); return; }
  const cfg = trayConfig(it)[verdict]; if (!cfg?.show) return;
  if (!S.prefs.tray) toggleTray(true);
  if (verdict === 'later' && pick) return laterSlip(it);
  if (verdict === 'later') {
    const until = toReset ? HarborLater.afterReset(now(), knownResets()) : HarborLater.tomorrowNine(now());
    if (!until) { toast('No usage reset known; S parks it until tomorrow 9:00.'); return; }
    return later(it, until);
  }
  if (verdict === 'approve' && bundleOf(it).length > 1) return topicView.stampBundle(it, bundleOf(it));
  if (verdict === 'approve') {
    if (it.kind === 'decision') { if (!s.choice) { toast('Pick an option on the slip first.'); return; } return finishStamp(it, 'APPROVED', 'approve', { id: it.id, action: 'decide', key: s.choice }); }
    if (it.kind === 'review') return finishStamp(it, 'APPROVED', 'approve', { id: it.id, action: 'approve' });
    return finishStamp(it, 'FILED', 'file', { id: it.id, action: 'file' });
  }
  if (verdict === 'reject') return finishStamp(it, 'REJECTED', 'reject', { id: it.id, action: 'reject' });
  const action = verdict === 'ask' ? 'ask' : 'needs-work';
  attachView.slip({ title: verdict === 'ask' ? 'Ask a follow-up' : 'What needs work?', to: `to ${mateFor(it).label}, about: ${it.title}`, placeholder: verdict === 'ask' ? 'Your question…' : 'What to change…', draft: `${action}:${it.id}`, attach: true, rule: true }, (note, attachments, rule) => finishStamp(it, verdict === 'ask' ? 'FOLLOW-UP' : 'NEEDS WORK', verdict === 'ask' ? 'ask' : 'needswork', { id: it.id, action, note, attachments, ...(rule ? { rule: true } : {}) }, true));
}
// Later: park the item (and the rest of its ticked sheet) until `until`: S tomorrow 9:00, Shift+S just after the next
// usage reset, the Later slip (click the stamp, Alt+S) any date and time. Writes a defer line; firstmate holds the work.
function later(it, until) {
  const others = bundleOf(it).filter(m => m !== it && topicView.ticked(m));
  finishStamp(it, `LATER${others.length ? ' ×' + (others.length + 1) : ''}`, 'later', { id: it.id, action: 'defer', until }, false, others.map(m => ({ it: m, line: { id: m.id, action: 'defer', until } })));
}
// A stamp is applied at once, but its JSONL line is held for UNDO_MS. Undo restores the item and writes nothing.
// The hold starts at the key press, not when the stamp lands: an undo during the flight cancels it too; the flight
// is only the picture. extra: [{ it, line }] for the other papers of a bundle, held, written and undone with this one.
// The desk moves on at once, so the next key press lands on the next visitor; the stamped papers stay behind as a
// ghost the stamp flies onto, then leave.
function finishStamp(it, text, ink, line, stays, extra = [], bulk = false) {
  commitPending();
  const s = st(it.id); const src = document.querySelector(`#stamps .stamp.${ink}`) || document.querySelector('#stamps .stamp');
  const snap = { item: JSON.parse(JSON.stringify(s)), cash: S.cash, current: S.current, extra: extra.map(e => [e.it.id, JSON.parse(JSON.stringify(st(e.it.id)))]) };
  line.at = now();
  // tidy run (F4): resolving stamps close together; a bulk stamp (bundle, take all recommended) never counts and
  // ends the run; Later parks rather than clears, so it neither counts nor breaks the run
  const parks = line.action === 'defer';
  if (!stays && !parks) { run = G.comboNext(run, line.at, bulk || extra.length > 0); S.fun.bestRun = Math.max(S.fun.bestRun || 0, run.n); }
  const pitch = stays || parks ? 1 : G.comboPitch(run.n), runN = stays || parks ? 0 : run.n;
  // a defer leaves the item open; the held line itself parks it (statusOf), over any earlier Bring back now (both
  // are whole seconds, so a park in the same second as a pull back must clear it; undo restores it from snap)
  if (stays) s.awaiting = true; else if (!parks) { s.status = 'resolved'; s.verdict = line; } else delete s.undeferAt;
  for (const e of extra) { e.line.at = line.at; if (e.line.action !== 'defer') Object.assign(st(e.it.id), { status: 'resolved', verdict: e.line }); else delete st(e.it.id).undeferAt; }
  save(); $('#vault-count').textContent = ITEMS.filter(i => statusOf(i) === 'resolved').length;
  const p = pending = { line, extra, itemId: it.id, snap, stays, run: runN, timer: setTimeout(commitPending, UNDO_MS), toastEl: undoChip() };
  const held = () => pending === p;
  if ($('#agentlog').classList.contains('open')) renderLog();
  setTimeout(() => {
    if (!held()) return; [{ it, line }, ...extra].forEach(e => earn(e.it, e.line.action, pitch));
    const bonus = G.comboBonus(runN); if (bonus) { S.cash += bonus; save(); $('#cash-n').textContent = money(S.cash); popCash(bonus); }
  }, 300);
  const ghost = S.current === it.id ? ghostDesk() : null;
  if (S.current === it.id) { if (!stays) S.current = null; next(); } else renderAll();
  const zone = ghost?.querySelector('.stamp-zone');
  flyStamp(src, zone, ink, () => {
    if (!held()) return; // undone in flight: undoPending already dropped the ghost and brought the item back
    if (zone) { zone.textContent = ''; zone.append(h('div', { class: `impression ink-${ink}`, style: `--rot:${(hash(it.id) % 14) - 7}deg` }, text, h('small', null, `${fmtDate(line.at)} ${fmtTime(line.at)}`))); }
    if (!stays && !parks) harborScene.showRun(run.n);
    $('#desk').classList.remove('shake'); void $('#desk').offsetWidth; $('#desk').classList.add('shake'); snd('thud', pitch);
    if (!ghost) return;
    setTimeout(() => ghost.querySelectorAll('.paper').forEach(p => p.classList.add('leaving')), 220);
    setTimeout(() => ghost.remove(), 720);
  });
}
// A still copy of the papers on the desk, laid over it; the desk underneath is free to show the next visitor.
function ghostDesk() {
  const surf = $('#desk-surface'); if (!surf || S.prefs.plain || window.innerWidth <= 860 || !surf.querySelector('.paper')) return null;
  const g = surf.cloneNode(true); g.removeAttribute('id'); g.classList.add('desk-ghost'); g.inert = true; g.setAttribute('aria-hidden', 'true');
  g.querySelectorAll('[id]').forEach(e => e.removeAttribute('id')); g.querySelectorAll('video, audio, iframe').forEach(e => e.remove());
  g.querySelectorAll('.paper').forEach(p => { p.style.animation = 'none'; });
  surf.after(g); return g;
}
// After a clearing stamp is written (the undo hold is over): the tide goal (F7) and the stamp book (F6).
let run = { n: 0, at: 0 };
function afterClear(p) {
  const t = now(); const clear = harborClear(); const goal = S.fun.tide = G.tideGoal(S.fun.tide, t, tideNow());
  if (clear && goal && !goal.beat && t <= goal.deadline) { goal.beat = true; S.cash += 50; $('#cash-n').textContent = money(S.cash); snd('ding'); popCash(50); }
  const it = byId[p.itemId]; const task = it ? ITEMS.filter(i => G.taskKey(i) === G.taskKey(it)) : [];
  awardBadges({ run: p.run, hour: new Date(p.line.at * 1000).getHours(), stamped: true, harborClear: clear, beatTide: !!goal?.beat, fullSheet: task.length >= 4 && task.every(i => statusOf(i) === 'resolved') });
  save(); renderHarbor();
}
function awardBadges(extra) {
  const ctx = { cleared: clearedToday(), run: 0, hour: new Date().getHours(), stamped: false, harborClear: false, beatTide: false, fullSheet: false, owned: new Set(S.fun.owned), days: S.fun.dayCount, spent: S.fun.spent || 0, ...extra };
  for (const k of G.earned(ctx, S.fun.badges)) { S.fun.badges[k] = now(); toast(`New stamp in your book: ${G.BADGES.find(b => b.key === k).label}`); }
  save();
}
// F10: count the calendar days the office opens; the town on the far shore grows with them
function markDay() {
  const k = G.dayKey(new Date()); if (S.fun.lastDay === k) return;
  const before = G.town(S.fun.dayCount).length; S.fun.dayCount++; S.fun.lastDay = k; const after = G.town(S.fun.dayCount);
  if (after.length > before)
  awardBadges({}); save();
}
// F5: the chandlery sells cosmetics for the till; ink and tune can be switched once owned
function buy(key) {
  const r = G.buy(S.fun, key, S.cash); if (!r.ok) { toast(r.error, 'warn'); return; }
  const item = G.SHOP.find(x => x.key === key); S.fun = r.fun; S.cash = r.cash; save(); snd('coin');
  awardBadges({}); applyPrefs(); if (!S.prefs.plain) renderWindowScene(); if (item.track && music.on) { musicStop(); musicStart(); }
}
function equip(change) {
  Object.assign(S.fun, change); save(); applyPrefs(); snd('tick');
  if (change.track && music.on) { musicStop(); musicStart(); }
}
function undoChip() {
  const t = h('div', { class: 'toast undo' }, h('button', { class: 'undo-btn', onclick: undoPending }, 'Undo ', h('span', { class: 'kbd' }, 'U')), h('span', { class: 'undo-bar' }));
  $('#toasts').append(t); return t;
}
function commitPending() {
  if (!pending) return; const p = pending; pending = null; clearTimeout(p.timer); p.toastEl?.remove();
  writeLine(p.line); for (const e of p.extra || []) writeLine(e.line); $('#log-count').textContent = S.answers.length;
  if ($('#agentlog').classList.contains('open')) renderLog();
  if (!p.stays) afterClear(p);
  if (!S.prefs.plain) renderRail();
}
function undoPending() {
  if (!pending) return; const p = pending; pending = null; clearTimeout(p.timer); p.toastEl?.remove();
  document.querySelectorAll('.desk-ghost').forEach(g => g.remove());
  S.items[p.itemId] = p.snap.item; for (const [id, x] of p.snap.extra || []) S.items[id] = x; S.cash = p.snap.cash; S.current = p.itemId; save();
  run = { n: 0, at: 0 }; harborScene.showRun(0); // undo breaks the tidy run
  snd('flip'); renderAll();
}
function flyStamp(src, zone, ink, done) {
  if (!src || !zone) return done();
  const a = src.getBoundingClientRect(), b = zone.getBoundingClientRect();
  const fs = h('div', { class: `flying-stamp stamp ${ink}`, html: '<span class="handle"></span><span class="base"></span>' });
  fs.style.left = a.left + 'px'; fs.style.top = a.top + 'px'; document.body.append(fs);
  const tx = b.left + b.width / 2 - 40 - a.left, ty = b.top + b.height / 2 - 40 - a.top;
  fs.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${tx}px,${ty - 50}px) scale(1.15)`, offset: .6 }, { transform: `translate(${tx}px,${ty}px) scale(.95)` }], { duration: 380, easing: 'cubic-bezier(.3,.9,.4,1)', fill: 'forwards' }).onfinish = () => { done(); setTimeout(() => fs.remove(), 120); };
}
