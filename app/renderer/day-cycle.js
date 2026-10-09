/* Day cycle: the morning manifest, opening the office, the ships-out shift report.
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

// ------------------------------------------------------------ day cycle: morning manifest, shift report
function meter(score, max) { const pct = Math.max(0, Math.min(100, Math.round(((score + max) / (2 * max)) * 100))); return h('div', { class: 'meter' }, h('span', { style: `width:${pct}%` })); }
function regularsBoard() { return h('div', { class: 'regulars' }, FLEET.regulars.map(r => { const sc = regularScore(r, false), d = regularScore(r, true); return h('div', { class: 'regular' }, h('div', { class: 'rg-name' }, r.label, h('span', { class: 'rg-delta' }, d ? (d > 0 ? `+${d}` : `${d}`) : '')), meter(sc, 12)); })); }
function topItems(n) { return ITEMS.filter(i => statusOf(i) === 'open').sort(urgency).slice(0, n); }
// The manifest shows only what has something in it; Space opens the office.
function openManifest() {
  const open = ITEMS.filter(i => statusOf(i) === 'open'); const counts = {}; for (const i of open) counts[i.kind] = (counts[i.kind] || 0) + 1;
  const cooking = FLEET.crew.filter(c => c.state !== 'idle'); const c7 = FLEET.counts;
  const week = [[c7.shipped_7d, 'shipped'], [c7.merged_7d, 'merged'], [c7.rework_7d, 'reworked'], [c7.reports_7d, 'reports']].filter(([n]) => n);
  const content = h('div', { class: 'manifest-sheet' },
    h('div', { class: 'ms-head' }, h('div', { class: 'ms-day' }, `Day ${S.day}`), h('div', null, new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), S.streak ? ` · ${S.streak}-day streak` : '', S.cash ? ` · ${money(S.cash)} in the till` : '')),
    h('div', { class: 'ms-grid' },
      h('section', null, h('h3', null, 'At the window'), h('ul', null, Object.entries(KIND).map(([k, l]) => counts[k] ? h('li', null, `${counts[k]} ${(counts[k] > 1 ? KINDS[k] : l).toLowerCase()}`) : null), !open.length && h('li', null, 'nobody waiting')), open.length ? [h('h3', null, 'First up'), h('ol', null, topItems(3).map(i => h('li', null, prioChip(i), ' ', i.title)))] : null),
      cooking.length ? h('section', null, h('h3', null, 'Galley'), h('ul', null, cooking.map(c => h('li', null, `${crewName(c.id)}: ${c.task_title || c.task || ''} (${{ working: 'cooking', waiting: 'at the window', done: 'ready' }[c.state] || c.state})`)))) : null,
      staminaViews().length ? h('section', null, staminaPanel()) : null,
      FLEET.regulars.length ? h('section', null, h('h3', null, 'Regulars'), regularsBoard()) : null),
    week.length ? h('p', { class: 'ms-foot' }, `Last 7 days: ${week.map(([n, w]) => `${n} ${w}`).join(', ')}.`) : null);
  modal('ledger manifest', 'Morning manifest', content, [h('span', { class: 'legend' }, 'Space'), h('button', { class: 'pbtn', onclick: () => openOffice() }, 'Open the office')]);
}
function openOffice(quiet) { S.dayOpen = true; S.dayStart = S.dayStart || now(); S.closedSig = null; for (const s of Object.values(S.items)) delete s.back; markDay(); save(); closeModal(); if (!quiet) snd('ding'); if (!S.current) next(); else renderAll(); }
// What is waiting, for "did anything change overnight": open items and their last rewrite.
const openSig = () => ITEMS.filter(i => statusOf(i) === 'open').map(i => `${i.id}@${i.updated || i.created}`).sort().join(' ');
// A closed office: the manifest, unless nothing changed since the day was closed; then straight to work.
function morning() {
  if (S.closedSig != null && S.closedSig === openSig()) { openOffice(true); toast('Nothing new since you closed the day; the office is open.'); }
  else openManifest();
}
function openLedger() {
  const A = answersToday(); const t0 = now();
  const resolved = A.filter(a => ['decide', 'approve', 'reject', 'file'].includes(a.action));
  const cashToday = resolved.concat(A.filter(a => ['ask', 'needs-work', 'comment'].includes(a.action))).reduce((n, a) => n + (byId[a.id] ? payFor(byId[a.id], a.action) : 0), 0);
  const waiting = ITEMS.filter(i => statusOf(i) === 'open').sort((a, b) => a.created - b.created);
  const cooking = FLEET.crew.filter(c => c.state === 'working'), finished = FLEET.crew.filter(c => c.state === 'done');
  const sec = (title, body) => h('section', { class: 'rp' }, h('h3', null, title), body);
  const content = h('div', { class: 'report' },
    h('div', { class: 'rp-head' }, h('span', null, `Day ${S.day} · ${fmtDate(t0)} ${fmtTime(t0)}`), h('span', null, `${resolved.length} cleared · ${money(cashToday)} earned · ${waiting.length} waiting`)),
    sec('Decided', resolved.length ? h('ul', null, resolved.map(a => { const it = byId[a.id]; const u = it ? unblocks(it) : []; return h('li', null, h('b', null, consequence(a)), u.length ? h('div', { class: 'sub-line' }, '↳ ', u.join('; ')) : h('div', { class: 'sub-line dim' }, '↳ nothing was waiting on it')); })) : h('p', { class: 'dim' }, 'Nothing cleared yet.')),
    A.filter(a => ['ask', 'needs-work', 'request'].includes(a.action)).length ? sec('Sent across the counter', h('ul', null, A.filter(a => ['ask', 'needs-work', 'request'].includes(a.action)).map(a => h('li', null, consequence(a))))) : null,
    sec('Still waiting on you', waiting.length ? h('ul', null, waiting.map(i => h('li', null, prioChip(i), ' ', i.title, h('span', { class: 'dim' }, ` · waiting ${age(t0 - i.created)}`), i.due ? [' · ', dueChip(i)] : null))) : h('p', { class: 'dim' }, 'Nothing. Clear pier.')),
    sec('Galley', h('ul', null, finished.map(c => h('li', null, `✓ ${crewName(c.id)} finished "${c.task_title || c.task}"`)), cooking.map(c => h('li', null, `… ${crewName(c.id)} still cooking "${c.task_title || c.task}"`)), h('li', null, `Cash earned today: ${money(cashToday)} (till: ${money(S.cash)})`), staminaViews().length ? h('li', null, 'Stamina left: ', staminaViews().map(v => `${v.label} ${v.left == null ? '?' : v.left + '%'}`).join(' · ')) : null)),
    sec("Tomorrow's top 3", h('ol', null, topItems(3).map(i => h('li', null, prioChip(i), ' ', i.title, i.due ? h('span', { class: 'dim' }, ` · due ${fmtDate(i.due)}`) : null)))));
  const doneToday = Object.entries(S.items).filter(([, s]) => s.status === 'resolved' && s.verdict && s.verdict.at >= S.dayStart).map(([id]) => byId[id] || { id, title: id, project: 'desk' });
  const recap = harborScene.recap({ day: S.day, cleared: G.boats(doneToday), earned: cashToday, waiting: waiting.length, tide: S.fun.tide, run: S.fun.bestRun || 0,
    badgesToday: Object.entries(S.fun.badges).filter(([, at]) => at >= S.dayStart).map(([k]) => G.BADGES.find(b => b.key === k)?.label).filter(Boolean), logbook: content });
  modal('ledger', 'Ships out', recap, [
    h('button', { class: 'pbtn ghost', title: 'Clears cash, day count, read marks and paper positions. answers.jsonl is never touched.', onclick: () => { if (confirm('Reset the desk? Clears cash, day count and paper positions. answers.jsonl is kept.')) { commitPending(); try { localStorage.removeItem(deskKey()); } catch (e) {} loadState(); closeModal(); renderAll(); openManifest(); } } }, 'Reset desk'),
    h('button', { class: 'pbtn ghost', onclick: () => navigator.clipboard?.writeText(content.textContent).then(() => toast('Report copied')) }, 'Copy'),
    h('button', { class: 'pbtn', onclick: () => { S.day++; S.streak = A.length ? S.streak + 1 : 0; S.dayOpen = false; S.dayStart = now(); S.fun.bestRun = 0; run = { n: 0, at: 0 }; S.closedSig = openSig(); save(); closeModal(); snd('ding'); renderAll(); openManifest(); } }, 'Close the day')]);
}
