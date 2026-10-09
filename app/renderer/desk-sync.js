/* Rendering the whole desk, and applying the snapshots the main process pushes on every change.
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

// ------------------------------------------------------------ wiring
function setMi(sel, ic, label) { const b = $(sel); b.querySelector('use').setAttribute('href', `#i-${ic}`); b.querySelector('.mi-l').textContent = label; b.title = label; }
function applyPrefs() {
  if (S.prefs.theme === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = S.prefs.theme;
  setMi('#btn-theme', { auto: 'auto', light: 'sun', dark: 'moon' }[S.prefs.theme], `Theme: ${S.prefs.theme}`);
  $('#btn-sound').setAttribute('aria-pressed', String(S.prefs.sound)); $('#btn-music').setAttribute('aria-pressed', String(S.prefs.music)); $('#music-vol').value = S.prefs.musicVol;
  $('#btn-plain').setAttribute('aria-pressed', String(S.prefs.plain)); setMi('#btn-plain', S.prefs.plain ? 'desk' : 'plain', S.prefs.plain ? 'Back to the desk' : 'Plain mode');
  $('#desk-mode').hidden = S.prefs.plain; $('#plain-mode').hidden = !S.prefs.plain; $('#btn-inspect').disabled = S.prefs.plain;
  $('#cash-n').textContent = money(S.cash); document.body.dataset.ink = S.fun.ink || 'red'; renderStaminaMini(); renderPhoneButton();
  const flagged = ITEMS.filter(i => statusOf(i) === 'open').reduce((n, i) => n + flaggedCount(i), 0); for (const id of ['#orders-flag', '#orders-flag2']) { $(id).hidden = !flagged; $(id).textContent = flagged; }
}
function renderAll(keepDesk) {
  applyPrefs();
  $('#shift-label').textContent = `Day ${S.day}${S.streak ? ` · ${S.streak}-day streak` : ''}`;
  $('#vault-count').textContent = ITEMS.filter(i => statusOf(i) === 'resolved').length; $('#log-count').textContent = S.answers.length;
  if (S.prefs.plain) { renderPlain(); return; }
  renderFilters(); renderQueue(); renderWindowScene(); renderYard(); if (keepDesk) renderTray(byId[S.current]); else renderDesk(); renderRail();
  if ($('#orders').classList.contains('open')) renderOrders();
}
// ------------------------------------------------------------ live data: snapshots pushed by the main process on every change
// Waiting on a reply = the latest ask/needs-work for the item has no non-captain thread entry after it.
function computeAwaiting(it) {
  const asks = S.answers.filter(a => a.id === it.id && (a.action === 'ask' || a.action === 'needs-work'));
  if (pending && pending.stays && pending.itemId === it.id) asks.push(pending.line);
  const last = asks.sort((a, b) => a.at - b.at).pop(); if (!last) return false;
  return !(it.thread || []).some(m => m.at >= last.at && m.from !== 'captain');
}
function syncItems(prevById) {
  let replies = 0; const fresh = [];
  for (const it of ITEMS) {
    const s = st(it.id);
    // a verdict hides an item locally; per the contract, the agent rewriting it as open (newer `updated`) reopens it
    if (s.status === 'resolved' && it.status === 'open' && s.verdict && (it.updated || it.created) > s.verdict.at) { s.status = null; s.verdict = null; s.read = false; }
    const was = s.awaiting; s.awaiting = statusOf(it) === 'open' && computeAwaiting(it);
    if (was && !s.awaiting) replies++;
    if (prevById && !prevById[it.id] && it.status === 'open') fresh.push(it);
    if (s.read && !s.seen) s.seen = digestOf(it); // read before the desk kept versions: this one counts as seen
  }
  for (const a of S.answers) if (a.action === 'request' && prevById && byId[a.id] && !prevById[a.id]) replies++;
  return { replies, fresh: fresh.filter(it => !S.answers.some(a => a.action === 'request' && a.id === it.id)) };
}
let deferred = null;
// What the desk papers show: the current item, its notes and its bundle. Anything else changing keeps the papers still.
const deskSig = () => { const it = byId[S.current]; return JSON.stringify(it ? [it, (SNAP.notes || []).filter(n => n.item === it.id), bundleOf(it).map(m => m.id)] : null); };
function applySnapshot(snap) {
  deferred = null; // a snapshot held while typing is older than this one: never apply it after
  const prevHome = SNAP.home, prevById = byId, prevNotes = SNAP.notes || [], curBefore = deskSig();
  setData(snap);
  if (snap.home !== prevHome || (snap.demoSeed || 0) !== (S.demoSeed || 0)) { loadState(); syncItems(null); closeModal(); renderAll(); if (!S.dayOpen) morning(); else if (!S.current) next(); return; }
  S.answers = (snap.answers || []).slice();
  const { replies, fresh } = syncItems(prevById);
  save();
  if (S.current && !byId[S.current]) S.current = null;
  renderAll(deskSig() === curBefore); phone.refresh();
  if ($('#agentlog').classList.contains('open')) renderLog();
  topicView.update(prevNotes);
  if (replies) { snd('ding'); if (!S.prefs.plain) renderRail(true); }
  if (fresh.length) { snd('slide'); }
  if (snap.errors?.length) console.warn('harbor: unreadable items', snap.errors);
}
// Never re-render under the captain's typing: hold the snapshot until focus leaves the field.
const typing = () => { const a = document.activeElement; return a && a.matches('textarea, input:not([type=range]):not([type=radio]), select'); };
