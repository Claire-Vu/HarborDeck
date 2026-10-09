/* Inspect mode: pair a claim with a point of evidence and write a match or mismatch comment.
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

// ------------------------------------------------------------ inspect mode
function setInspect(on) {
  document.body.classList.toggle('inspect', on); $('#btn-inspect').setAttribute('aria-pressed', String(on));
  const b = $('#inspect-banner'); b.hidden = !on; b.textContent = 'Inspect: click a claim on the manifest, then a point of evidence (a moment, a spot on a photo, a heading, a standing order).';
  if (!on) clearPick();
}
function clearPick() { inspectPick = null; document.querySelectorAll('.fact.picked').forEach(e => e.classList.remove('picked')); document.querySelector('.popover')?.remove(); }
function pickFact(f, el) {
  if (!document.body.classList.contains('inspect')) return;
  if (!inspectPick || inspectPick.type === f.type) { clearPick(); inspectPick = f; el?.classList.add('picked'); $('#inspect-banner').textContent = `Picked ${f.type}: "${f.label}". Now click the other side.`; snd('tick'); return; }
  const claim = inspectPick.type === 'claim' ? inspectPick : f, point = inspectPick.type === 'point' ? inspectPick : f;
  showPairPopover(claim, point, el);
}
function showPairPopover(claim, point, nearEl) {
  document.querySelector('.popover')?.remove();
  const it = byId[S.current]; const anchor = Object.assign({}, claim.anchor, point.anchor);
  const pop = h('div', { class: 'popover' }, h('div', null, 'Cross-check'), h('div', { class: 'pair' }, 'Claim: ', claim.label), h('div', { class: 'pair' }, 'Evidence: ', point.label),
    h('div', { class: 'row' },
      h('button', { class: 'pbtn', onclick: () => { holdComment(it, { id: it.id, action: 'comment', note: `match: ${claim.label}`, anchor }, claim.idx, 'match'); snd('tick'); } }, 'Match'),
      h('button', { class: 'pbtn danger', onclick: () => { pop.remove(); attachView.slip({ title: 'Mismatch: what is off?', to: `comment on ${it.title}`, prefill: `mismatch: "${claim.label}" vs ${point.label}: `, attach: true, rule: true }, (note, attachments, rule) => { holdComment(it, { id: it.id, action: 'comment', note, anchor, attachments, ...(rule ? { rule: true } : {}) }, claim.idx, 'flag'); snd('thud'); }); } }, 'Mismatch'),
      h('button', { class: 'pbtn ghost', onclick: clearPick }, 'Cancel')));
  document.body.append(pop);
  const r = nearEl?.getBoundingClientRect(); const x = r ? Math.min(window.innerWidth - 320, r.left) : window.innerWidth / 2 - 150, y = r ? Math.min(window.innerHeight - 180, r.bottom + 8) : 120;
  pop.style.left = Math.max(8, x) + 'px'; pop.style.top = Math.max(8, y) + 'px';
}
// A match or mismatch is held for undo like a stamp (the undo chip, U); the item stays at the desk.
function holdComment(it, line, idx, flag) {
  commitPending();
  const snap = { item: JSON.parse(JSON.stringify(st(it.id))), cash: S.cash, current: S.current, extra: [] };
  line.note ??= ''; line.at = now(); if (idx != null) st(it.id).flags[idx] = flag; save(); earn(it, 'comment');
  pending = { line, extra: [], itemId: it.id, snap, stays: true, comment: true, timer: setTimeout(commitPending, UNDO_MS), toastEl: undoChip() };
  if ($('#agentlog').classList.contains('open')) renderLog();
  clearPick(); renderDesk();
}
