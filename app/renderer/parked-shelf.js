/* Later on the desk: the Later slip (pick when a parked item comes back) and the Parked shelf above the storage box
   (every parked item with its return time, and Bring back now). Parking itself is later() in desk-stamps.js.
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

// the usage resets Shift+S can wait for: the scheduler's, and every stamina window not yet refilled
const knownResets = () => [SCHED?.next_reset, SCHED?.reset_due, ...staminaViews().filter(v => !v.reset).map(v => v.resets)].filter(Boolean);
const backAt = t => `${fmtDate(t)} ${fmtTime(t)}`;

// The Later slip (a click on the Later stamp, or Alt+S): tomorrow 9:00, after the next reset, or a date and time.
function laterSlip(it) {
  const t = now(), nine = HarborLater.tomorrowNine(t), reset = HarborLater.afterReset(t, knownResets()), n = bundleOf(it).filter(m => m === it || topicView.ticked(m)).length;
  const at = h('input', { type: 'datetime-local', class: 'ls-at', 'aria-label': 'Back on the desk at', value: HarborLater.inputValue(nine + 86400), min: HarborLater.inputValue(t + 60) });
  const park = until => {
    const cur = byId[it.id]; closeModal();
    if (!cur || statusOf(cur) !== 'open' || S.current !== it.id) { toast('Nobody at the desk.'); return; }
    later(cur, until);
  };
  const parkPicked = () => { const u = HarborLater.picked(at.value, now()); if (!u) { toast('Pick a date and time ahead of now.', 'warn'); at.focus(); return; } park(u); };
  at.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); parkPicked(); } });
  const choice = (label, when, key, onclick, disabled) => h('button', { class: 'ls-opt', disabled, onclick }, h('b', null, label), h('span', { class: 'ls-when' }, when), h('span', { class: 'kbd' }, key));
  modal('laterslip', n > 1 ? `Park ${n} papers for later` : 'Park it for later', h('div', null,
    h('div', { class: 'to' }, `Back on the desk: ${it.title}`),
    choice('Tomorrow morning', backAt(nine), 'S', () => park(nine)),
    choice('After the next usage reset', reset ? backAt(reset) : 'no reset known', '⇧S', () => park(reset), !reset),
    h('div', { class: 'ls-pick' }, h('b', null, 'On a date'), at, h('button', { class: 'pbtn', onclick: parkPicked }, 'Park'))),
  [h('button', { class: 'pbtn ghost', onclick: closeModal }, 'Cancel')]);
  document.querySelector('.modal.laterslip .ls-opt')?.focus();
}

// The Parked shelf: a slot above the storage box with the count of parked items; it hides when nothing is parked.
function renderParked() {
  const list = parkedItems(), n = list.length;
  $('#parked-btn').hidden = !n; $('#parked-n').textContent = n; $('#parked-btn').setAttribute('aria-label', `Parked for later: ${n}`);
  if (!n) { closeParkedView(); return; }
  if (!$('#parked-view').hidden) fillParkedView(list);
}
function fillParkedView(list) {
  $('#parked-view').replaceChildren(
    h('header', null, h('span', null, `Parked · ${list.length}`), h('span', { class: 'spacer' }), h('button', { class: 'ibtn close', 'aria-label': 'Close', title: 'Close (Esc)', onclick: closeParkedView }, '×')),
    h('ul', { class: 'parked-list' }, list.map(it => h('li', { class: 'parked-row', dataset: { id: it.id } },
      h('span', { class: `tag ${it.kind}` }, KIND[it.kind]), h('span', { class: 'pk-title', title: it.title }, it.title),
      h('span', { class: 'pk-when' }, `back ${backAt(deferredUntil(it))}`),
      h('button', { class: 'ibtn pk-back', title: 'Back on the desk now; nothing is written', onclick: () => { closeParkedView(); unpark(it.id); } }, 'Bring back now')))));
}
const placeParkedView = () => placeStowView($('#parked-view'), $('#parked-btn'));
function openParkedView() { const list = parkedItems(); if (!list.length) return; closeStowView(); $('#parked-view').hidden = false; fillParkedView(list); placeParkedView(); $('#parked-btn').setAttribute('aria-expanded', 'true'); }
function closeParkedView() { $('#parked-view').hidden = true; $('#parked-btn').setAttribute('aria-expanded', 'false'); }
