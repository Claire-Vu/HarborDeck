/* Storage box at the foot of the stamp tray: stow papers off the desk and bring them back.
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

// Storage box: stowed papers leave the desk (per item, persisted) and wait in the box at the foot of the stamp tray.
// A stowed paper keeps its dragged position, so it comes back where it was (clamped by layoutPapers).
// The box shows its papers as a stack of sheets; clicking it opens a view of mini copies of each stowed paper.
let stowLabels = {}, stowEls = {};
// the decision slip (the stamp lands on it) and the manifest (the title of what is at the desk) always stay out
const canStow = pid => pid !== 'ask' && pid !== 'm';
const STOW_KINDS = ['manifest', 'report', 'photo', 'monitor', 'prcard', 'thread'];
const kindOf = p => STOW_KINDS.find(c => p?.classList.contains(c)) || 'report';
const stowedOf = id => S.stowed[id] || {};
const overStow = e => { const r = $('#stow-box').getBoundingClientRect(); return r.width > 0 && e.clientX >= r.left - 10 && e.clientX <= r.right + 10 && e.clientY >= r.top - 10 && e.clientY <= r.bottom + 10; };
function addStowBtn(p, id) { if (!canStow(p.dataset.pid)) return; p.querySelector('.grip .spacer')?.after(h('button', { class: 'ibtn stow-btn', title: 'Stow away (X)', 'aria-label': 'Stow this paper', onclick: () => stow(id, p.dataset.pid) })); }
function stow(id, pid) {
  const p = document.querySelector(`#desk-surface .paper[data-pid="${pid}"]`); if (!p || !canStow(pid) || id !== S.current || stowedOf(id)[pid]) return;
  (S.stowed[id] ||= {})[pid] = stowLabels[pid] || 'Paper'; stowEls[pid] = p; save(); snd('flip');
  const b = $('#stow-box').getBoundingClientRect(), r = p.getBoundingClientRect(); p.style.pointerEvents = 'none';
  if (b.width) { p.style.animation = 'none'; p.style.transformOrigin = '0 0'; p.style.transition = 'transform .35s ease-in, opacity .35s'; void p.offsetWidth; p.style.transform = `translate(${b.left + b.width / 2 - r.left}px, ${b.top + b.height / 2 - r.top}px) scale(.05)`; p.style.opacity = '0'; }
  setTimeout(() => { if (S.current === id) renderDesk(); }, b.width ? 360 : 0); renderStow();
}
function unstow(id, pid) { const m = S.stowed[id]; if (!m?.[pid]) return; delete m[pid]; if (!Object.keys(m).length) delete S.stowed[id]; save(); snd('flip'); if (S.current === id) renderDesk(); }
function unstowAll(id) { if (!S.stowed[id]) return; delete S.stowed[id]; save(); snd('flip'); if (S.current === id) renderDesk(); }
function stowKey() { // X: the paper last raised, else the reading paper, else any but the ask
  const ps = [...document.querySelectorAll('#desk-surface .paper')].filter(p => canStow(p.dataset.pid)); if (!ps.length) { toast('No papers on the desk.'); return; }
  const p = ps.find(q => q.style.zIndex === '89') || ps.find(q => q.classList.contains('reading')) || ps[ps.length - 1];
  stow(S.current, p.dataset.pid);
}
function renderStow() {
  const m = S.current ? stowedOf(S.current) : {}, keys = Object.keys(m), n = keys.length;
  $('#stow').dataset.n = n; $('#stow-n').textContent = n || ''; $('#stow-box').setAttribute('aria-label', `Storage box: ${n} stowed`);
  // up to 6 sheets show; each one more lifts the pile out of the tray
  $('#stow-stack').replaceChildren(...keys.slice(-6).map((pid, i) => h('span', { class: `leaf ${kindOf(stowEls[pid])}`, style: `--i:${i};--r:${(hash(pid) % 7) - 3}deg;--x:${(hash(pid + 'x') % 5) - 2}px` })));
  if (!n) { closeStowView(); return; }
  if (!$('#stow-view').hidden) fillStowView(m, keys);
}
function fillStowView(m, keys) {
  const n = keys.length;
  $('#stow-view').replaceChildren(
    h('header', null, h('span', null, `Storage box · ${n} paper${n > 1 ? 's' : ''}`), h('span', { class: 'spacer' }), n > 1 ? h('button', { class: 'ibtn all', title: 'Bring all back (Shift+X)', onclick: () => unstowAll(S.current) }, 'Bring all back') : null, h('button', { class: 'ibtn close', 'aria-label': 'Close', title: 'Close (Esc)', onclick: closeStowView }, '×')),
    h('div', { class: 'stow-cards' }, keys.map(pid => h('button', { class: `stow-card ${kindOf(stowEls[pid])}`, dataset: { pid }, title: 'Bring back to the desk', onclick: () => unstow(S.current, pid) },
      h('span', { class: 'thumb', 'aria-hidden': 'true' }, stowEls[pid] ? miniPaper(stowEls[pid]) : null), h('span', { class: 'cap' }, m[pid])))));
}
// A copy of the paper, scaled down: its kind's look, title and the top of its content. Nothing in it plays or loads.
function miniPaper(src) {
  const c = src.cloneNode(true); c.removeAttribute('style'); delete c.dataset.pid; c.className = `paper mini ${kindOf(src)}`; c.inert = true;
  c.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
  c.querySelectorAll('button, .drag-only, .upd').forEach(e => e.remove());
  c.querySelectorAll('video, iframe, audio').forEach(e => e.replaceWith(h('div', { class: `mini-media ${e.tagName.toLowerCase()}` })));
  return c;
}
// beside the tray (or above it when narrow); the Parked shelf's view sits the same way by its own button
function placeStowView(v = $('#stow-view'), anchor = $('#stow-box')) {
  const b = anchor.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
  const w = Math.min(424, W - 32); v.style.width = w + 'px'; v.style.maxHeight = Math.max(160, (b.left - w - 12 >= 16 ? b.bottom : b.top - 8) - 16) + 'px';
  if (b.left - w - 12 >= 16) { v.style.left = (b.left - w - 12) + 'px'; v.style.top = ''; v.style.bottom = Math.max(16, H - b.bottom) + 'px'; } // beside the tray
  else { v.style.left = Math.max(16, Math.min(b.left + b.width / 2 - w / 2, W - w - 16)) + 'px'; v.style.top = ''; v.style.bottom = (H - b.top + 8) + 'px'; } // above it (narrow: tray at the bottom)
}
function openStowView() { const m = stowedOf(S.current), keys = Object.keys(m); if (!keys.length) { toast('Nothing stowed. Drag a paper here, or press X.'); return; } closeParkedView(); $('#stow-view').hidden = false; fillStowView(m, keys); placeStowView(); $('#stow-box').setAttribute('aria-expanded', 'true'); }
function closeStowView() { $('#stow-view').hidden = true; $('#stow-box').setAttribute('aria-expanded', 'false'); }
