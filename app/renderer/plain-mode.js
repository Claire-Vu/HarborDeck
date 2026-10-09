/* Plain mode: the desk as a list of cards.
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

// ------------------------------------------------------------ plain mode
function actionsFor(it) {
  const cfg = trayConfig(it); const s = st(it.id); const out = []; const run = (v, pick) => { S.current = it.id; s.read = true; save(); stamp(v, false, pick); };
  for (const v of [...VERDICTS, 'later']) if (cfg[v]?.show) out.push(h('button', { class: `abtn ${cfg[v].cls}`, disabled: s.awaiting, title: v === 'later' ? 'Park it: tomorrow 9:00, after the next usage reset, or a date you pick' : null, onclick: () => run(v, v === 'later') }, cfg[v].label));
  // the bundle stamp takes the ticked papers only: opening a card counts as opening it (topicView.ticked); any card
  // opening re-counts every bundle button (sync)
  const group = bundleOf(it); if (group.length > 1) {
    const b = h('button', { class: 'abtn approve bundle', disabled: s.awaiting, onclick: () => { s.read = true; save(); topicView.stampBundle(it, group); } });
    (b.sync = () => { const take = group.filter(m => m === it || topicView.ticked(m)); b.hidden = take.length < 2; b.title = take.map(m => m.title).join(' · '); b.textContent = `Approve bundle (${take.length})`; })();
    out.push(b);
  }
  return out;
}
function plainCard(it, openByDefault) {
  const s = st(it.id); const resolved = statusOf(it) === 'resolved';
  const arts = [...(it.artifacts || [])]; if (it.body && !arts.some(a => (a.path || a.url) === it.body)) arts.unshift(bodyArtifact(it.body));
  const thread = threadFor(it); const flagged = (it.checks || []).filter(x => x.ok === false);
  // what changed is lit on this card as drawn; opening it counts as a look, so the next draw is plain again
  const ch = s.read ? changesOf(it) : null; const fresh = new Set(ch?.claims || []); if (openByDefault) lookAt(it);
  const d = h('details', { class: 'pcard', open: openByDefault || false, ontoggle: () => { if (d.open) { s.read = true; lookAt(it); document.querySelectorAll('#plain-mode .abtn.bundle').forEach(b => b.sync()); } } },
    h('summary', null, prioChip(it), h('span', null, h('div', { class: 't' }, !s.read && h('span', { class: 'unread-dot', style: 'display:inline-block;margin-right:6px' }), h('span', { class: ch?.title != null ? 'chg' : null, title: ch?.title != null ? `was: ${ch.title}` : null }, it.title), ' ', waitChip(it), updChip(it, ch), flagged.length ? h('span', { class: 'flag' }, ` ⚠${flagged.length}`) : null), h('div', { class: 's' }, h('span', { class: `tag ${it.kind}` }, KIND[it.kind]), ' ', topicView.chip(it), ` ${it.stream || it.project} · ${fmtDate(it.created)}`, it.due ? [' · ', dueChip(it)] : null, s.awaiting ? ' · awaiting reply' : '')), h('span', { class: 's' }, resolved ? (s.verdict ? ACTION_LABEL[s.verdict.action] + (s.verdict.key ? `: ${s.verdict.key}` : '') : 'resolved') : money(payFor(it, 'decide')))),
    h('div', { class: 'body' },
      h('p', { class: 'summary-text' }, sentences(it.summary).map(x => h('span', { class: fresh.has(x) ? 'chg' : null }, x, ' '))),
      flagged.length ? h('div', { class: 'flag-note' }, flagged.map(x => h('div', null, `⚠ ${x.rule}: ${x.note}`))) : null,
      arts.length ? h('div', { class: 'ev-row' }, arts.map(a => { const f = fileFor(a.path); return h('button', { class: `ev-thumb${ch?.arts?.includes(a.path || a.url) ? ' chg' : ''}`, onclick: () => ['pr', 'link'].includes(artType(a)) ? openUrl(a.url) : openViewer(a) }, artType(a) === 'image' && srcFor(a) ? h('img', { src: srcFor(a), alt: '' }) : artType(a) === 'video' && srcFor(a) ? h('video', { src: srcFor(a), muted: true, preload: 'metadata' }) : h('div', { class: 'ph' }, artType(a) === 'pr' ? 'PR' : a.url ? '↗' : '¶'), h('span', null, a.url ? (a.url.match(/pull\/\d+/) || [a.url.replace(/^https?:\/\//, '')])[0] : base(a.path))); })) : null,
      it.kind === 'decision' && it.options && !resolved ? h('fieldset', null, h('legend', null, 'Your call'), it.options.map(o => h('label', { class: 'opt' }, h('input', { type: 'radio', name: `p-${it.id}`, value: o.key, checked: (s.choice ??= it.options.find(x => x.recommended)?.key) === o.key, onchange: () => { s.choice = o.key; save(); } }), h('span', { class: ch?.options?.includes(o.key) ? 'chg' : null }, o.label, o.recommended && h('span', { class: 'rec' }, 'rec.'), o.why && h('span', { class: 'why' }, o.why))))) : null,
      resolved ? h('div', { class: 'verdict' }, s.verdict ? consequence(s.verdict) : 'Resolved by the agent.') : h('div', { class: 'actions' }, actionsFor(it)),
      thread.length ? h('div', { class: 'thread' }, thread.map(x => h('div', { class: `msg ${x.me || x.from === 'captain' ? 'me' : ''}${isNewMsg(x, ch) ? ' chg' : ''}` }, h('div', { class: 'who' }, `${x.from} · ${fmtDate(x.at)} ${fmtTime(x.at)}`), x.text))) : null,
      !resolved && !s.awaiting ? (() => { const inp = h('input', { placeholder: 'Ask a follow-up…', onkeydown: e => { if (e.key === 'Enter') send(); } }); const send = () => { const v = inp.value.trim(); if (!v) return; const line = emit({ id: it.id, action: 'ask', note: v }); s.awaiting = true; save(); earn(it, 'ask'); renderPlain(); }; return h('div', { class: 'follow' }, inp, h('button', { class: 'abtn ask', onclick: send }, 'Ask')); })() : null));
  return d;
}
function renderPlain() {
  const root = $('#plain-mode'); root.replaceChildren();
  const open = ITEMS.filter(i => statusOf(i) === 'open'); const f = S.prefs.filter;
  root.append(h('div', { class: 'plain-filters' }, ...['all', 'decision', 'review', 'answer', 'todo'].map(k => h('button', { class: 'chip', 'aria-pressed': String(f === k), onclick: () => { S.prefs.filter = k; save(); renderPlain(); } }, k === 'all' ? 'All' : KINDS[k])), h('span', { class: 'count' }, `${open.length} open${parkedItems().length ? ` · ${parkedItems().length} parked` : ''} · ${money(S.cash)} · ${S.answers.length} actions`)));
  const groups = [['decision', 'Needs your word'], ['review', 'Review the work'], ['answer', 'Research to read and file'], ['todo', 'Notices: only you']];
  for (const [k, label] of groups) {
    if (f !== 'all' && f !== k) continue;
    const rows = open.filter(i => i.kind === k).sort((a, b) => st(a.id).awaiting - st(b.id).awaiting || urgency(a, b)); if (!rows.length) continue;
    root.append(h('section', { class: 'plain-group' }, h('h2', null, label, ` (${rows.length})`), rows.map(i => plainCard(i))));
  }
  if (f === 'all') {
    const ta = h('textarea', { rows: 2, placeholder: 'New order to the first mate…' }); let to = S.prefs.lastMate || FLEET.firstmates[0]?.id;
    const sel = h('select', { onchange: e => { to = e.target.value; } }, FLEET.firstmates.map(m => h('option', { value: m.id, selected: m.id === to }, m.label)));
    const send = () => { const v = ta.value.trim(); if (!v) return; const id = `req-${now()}-${hash(v) % 1000}`; emit({ id, action: 'request', note: v, to }); S.prefs.lastMate = to; save(); renderPlain(); };
    root.append(h('section', { class: 'plain-group' }, h('h2', null, 'New order'), h('div', { class: 'pcard order-plain' }, ta, h('div', { class: 'row' }, sel, h('button', { class: 'abtn file', onclick: send }, 'Hand it over')))));
    root.append(h('section', { class: 'plain-group' }, h('h2', null, 'Scene, in words'), h('div', { class: 'pcard scene-text' }, h('div', null, `${open.length} waiting outside the window${parkedItems().length ? ` (${parkedItems().length} more parked for later)` : ''}${open.filter(i => impatience(i) === 2).length ? `, ${open.filter(i => impatience(i) === 2).length} very impatient` : ''}.`), h('div', null, `${G.boats(open).length} boats moored in the harbor; ${G.town(S.fun.dayCount).length} buildings in town.`), ...FLEET.crew.map(c => h('div', null, `${crewName(c.id)}: ${{ working: 'cooking ' + (c.task_title || c.task), done: 'ready at the pass with ' + (c.task_title || c.task), waiting: 'waiting on you (' + (c.task_title || c.task) + ')', idle: hash(c.id) % 2 === 0 ? 'napping on the pier' : 'lounging on the pier' }[c.state] || c.state}${tired() ? ', yawning' : ''}`)))));
    root.append(h('section', { class: 'plain-group' }, h('h2', null, 'Topics'), h('div', { class: 'pcard topics-plain' }, topicView.list())));
    const parked = parkedItems();
    if (parked.length) root.append(h('section', { class: 'plain-group parked' }, h('h2', null, `Parked for later (${parked.length})`), h('div', { class: 'pcard' }, parked.map(i => h('div', { class: 'parked-row', dataset: { id: i.id } }, h('span', { class: `tag ${i.kind}` }, KIND[i.kind]), h('span', { class: 'pk-title' }, i.title), h('span', { class: 'pk-when' }, `back ${backAt(deferredUntil(i))}`), h('button', { class: 'abtn pk-back', onclick: () => unpark(i.id) }, 'Bring back now'))))));
    const done = ITEMS.filter(i => statusOf(i) === 'resolved');
    if (done.length) root.append(h('section', { class: 'plain-group' }, h('h2', null, `Resolved (${done.length})`), done.map(i => plainCard(i))));
  }
}
