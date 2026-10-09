/* Drawers (standing orders, archive, agent log), modals, the reader and the note slip.
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

// ------------------------------------------------------------ drawers, modals, reader
function openDrawer(id) { document.querySelectorAll('.drawer').forEach(d => d.classList.toggle('open', d.id === id)); if (id === 'orders') renderOrders(); if (id === 'vault') renderVault(); if (id === 'agentlog') renderLog(); }
function closeDrawers() { document.querySelectorAll('.drawer.open').forEach(d => d.classList.remove('open')); }
function renderOrders() {
  const it = byId[S.current]; const checks = it ? checksFor(it) : []; const tagged = new Set(checks.map(c => c.rule));
  $('#orders-legend').textContent = it ? `${checks.filter(c => c.check?.ok === false).length} flagged on this item` : '';
  const content = $('#orders-content'); content.replaceChildren(h('p', { class: 'legend' }, 'Your saved preferences, which firstmate already follows. It auto-checks the tagged ones on each item; only look when one is flagged.'));
  if (checks.length) content.append(h('h3', { class: 'oh' }, 'On this item'), ...checks.map(({ rule, check }) => ruleRow(rule, check)));
  content.append(h('h3', { class: 'oh' }, 'All standing orders'), ...Object.keys(RULES).filter(k => !tagged.has(k)).map(k => ruleRow(k, null)));
  function ruleRow(k, check) {
    const r = RULES[k] || { text: k, source: '' };
    return h('div', { class: `rule ${check ? (check.ok ? 'ok' : 'flag') : ''}${r.answer ? ' sent' : ''}`, dataset: { rule: k } },
      h('span', { class: 'mark', title: r.answer ? 'Sent by you with Remember this' : '' }, check ? (check.ok ? '✓' : '⚠') : r.answer ? '📌' : '§'),
      h('div', null, h('span', { class: 'fact', onclick: e => pickFact({ type: 'point', label: `order ${k}`, anchor: { rule: k } }, e.currentTarget) }, r.text), check && h('div', { class: `note ${check.ok ? '' : 'warn'}` }, check.note), h('span', { class: 'src' }, `${k} · ${r.answer ? 'sent by you · ' : ''}${r.source || ''}`)));
  }
}
function renderVault() {
  const done = ITEMS.filter(i => statusOf(i) === 'resolved').map(i => ({ i, v: st(i.id).verdict })).sort((a, b) => (b.v?.at || 0) - (a.v?.at || 0));
  $('#vault-content').replaceChildren(done.length ? h('div', null, ...done.map(({ i, v }) => h('div', { class: 'entry', onclick: () => modal('viewer', i.title, plainCard(i, true)) },
    h('div', { class: `v ink-${v?.action === 'reject' ? 'reject' : v?.action === 'file' ? 'file' : 'approve'}` }, v ? ACTION_LABEL[v.action] : 'resolved', v?.key ? `: ${v.key}` : ''), h('div', null, i.title), h('div', { class: 'c' }, `${KIND[i.kind]} · ${i.stream || i.project} · ${v ? fmtDate(v.at) + ' ' + fmtTime(v.at) : ''}`)))) :
    h('p', { class: 'legend' }, 'Nothing filed yet.'));
}
// gaps.jsonl: responses an agent could not fit into an item kind. Listed so HarborDeck can grow new shapes.
function renderGaps() {
  const gaps = (SNAP.gaps || []).slice().reverse();
  $('#gaps').replaceChildren(h('h3', { class: 'oh' }, `Gaps (${gaps.length})`), h('p', { class: 'legend' }, 'Responses an agent could not fit into a decision, review, research note or notice. Each one is a case for a new desk item.'),
    ...(gaps.length ? gaps.map(g => h('div', { class: 'gap' }, h('div', null, g.text), h('div', { class: 'si-meta' }, [g.from && mateLabel(g.from), g.item && `squeezed into ${g.item}`, g.at && `${fmtDate(g.at)} ${fmtTime(g.at)}`].filter(Boolean).join(' · ')), g.sample ? h('div', { class: 'si-meta' }, 'sample: ', g.sample) : null)) : [h('p', { class: 'legend' }, 'None yet.')]));
}
function renderLog() { renderGaps(); $('#answers-path').textContent = `${SNAP.home}/answers.jsonl`; $('#log-lines').textContent = (jsonl() || '(no actions yet)\n') + (pending ? `\n# held ${UNDO_MS / 1000}s for undo, not yet written:\n${[pending.line, ...(pending.extra || []).map(e => e.line)].map(l => JSON.stringify(l)).join('\n')}` : ''); $('#log-count').textContent = S.answers.length; }
function modal(cls, titleText, content, footer, headerExtra) {
  closeModal();
  const m = h('div', { class: `modal ${cls}`, onclick: e => { if (e.target === m) closeModal(); } },
    h('div', { class: 'box', role: 'dialog', 'aria-modal': 'true', 'aria-label': titleText }, h('header', null, h('h2', null, titleText), headerExtra || null, h('button', { class: 'ibtn-top', 'aria-label': 'Close', onclick: closeModal }, icon('close'))), h('div', { class: 'content' }, content), footer && h('footer', null, footer)));
  $('#modal-root').append(m); return m;
}
function closeModal() { $('#modal-root').replaceChildren(); }
function openViewer(a) {
  const f = fileFor(a.path); let body, cls = 'dossier'; const type = artType(a);
  if (type === 'web') { const url = a.url || f?.page; if (!url) { toast(`Not available locally: ${base(a.path)}`, 'warn'); return; } return window.harborWebPane.open({ url, title: a.label || (a.type === 'lavish' ? 'Lavish plan' : a.path ? base(a.path) : 'Web page'), modal, h, toast }); }
  if (type === 'pdf') body = h('div', { class: 'mount' }, f ? h('iframe', { class: 'pdf-full', src: f.url, title: base(a.path) }) : missing(a.path));
  else if (type === 'image') body = h('div', { class: 'mount' }, srcFor(a) ? h('img', { src: srcFor(a), alt: base(a.path || a.url) }) : missing(a.path));
  else if (type === 'diff' && f?.text != null) body = h('article', { class: 'sheet' }, diffView(f.text));
  else if (type === 'video') body = h('div', { class: 'mount' }, srcFor(a) ? h('video', { src: srcFor(a), controls: true, autoplay: true }) : missing(a.path));
  else { const lit = a.isBody && S.current ? S.items[S.current]?.shown?.lines : null; body = h('article', { class: 'sheet md', html: f?.text ? mdToHtml(f.text, lit && new Set(lit)) : `<p>not available locally: ${esc(base(a.path))}</p>` }); }
  let zoom = 1; const apply = () => { body.style.setProperty('--zoom', zoom); };
  const zoomer = h('div', { class: 'zoomer' }, h('button', { class: 'tbtn', 'aria-label': 'Smaller', onclick: () => { zoom = Math.max(.7, zoom - .1); apply(); } }, 'A−'), h('button', { class: 'tbtn', 'aria-label': 'Larger', onclick: () => { zoom = Math.min(1.8, zoom + .1); apply(); } }, 'A+'));
  const ext = f ? h('button', { class: 'tbtn', title: 'Open with the default app', onclick: () => bridge.openPath(f.url) }, 'Open') : null;
  modal(cls, base(a.path || a.url), body, null, h('div', { class: 'zoomer' }, zoomer, ext));
}
