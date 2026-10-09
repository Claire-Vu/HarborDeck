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
      h('button', { class: 'pbtn', onclick: () => { emit({ id: it.id, action: 'comment', note: `match: ${claim.label}`, anchor }); if (claim.idx != null) st(it.id).flags[claim.idx] = 'match'; save(); snd('tick'); earn(it, 'comment'); clearPick(); renderDesk(); } }, 'Match'),
      h('button', { class: 'pbtn danger', onclick: () => { pop.remove(); attachView.slip({ title: 'Mismatch: what is off?', to: `comment on ${it.title}`, prefill: `mismatch: "${claim.label}" vs ${point.label}: `, attach: true, rule: true }, (note, attachments, rule) => { emit({ id: it.id, action: 'comment', note, anchor, attachments, ...(rule ? { rule: true } : {}) }); if (claim.idx != null) st(it.id).flags[claim.idx] = 'flag'; save(); snd('thud'); earn(it, 'comment'); clearPick(); renderDesk(); }); } }, 'Mismatch'),
      h('button', { class: 'pbtn ghost', onclick: clearPick }, 'Cancel')));
  document.body.append(pop);
  const r = nearEl?.getBoundingClientRect(); const x = r ? Math.min(window.innerWidth - 320, r.left) : window.innerWidth / 2 - 150, y = r ? Math.min(window.innerHeight - 180, r.bottom + 8) : 120;
  pop.style.left = Math.max(8, x) + 'px'; pop.style.top = Math.max(8, y) + 'px';
}
