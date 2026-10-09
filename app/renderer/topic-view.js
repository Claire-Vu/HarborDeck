/* Topics on the desk: the topic chip on every item, the topic page (a ledger sheet: what is still open, then the
   timeline of items, stamps, replies and notes, oldest first), the topic list (plain mode), and bundles: open items that share
   a topic or a rel link arrive together as one visitor (quick-call.js draws their question sheet) and are stamped in one go. Topics arrive derived in every
   snapshot (cli/src/topics.js, the same code as `harbordeck topic`). Loaded before app.js; holds no desk state:
   app.js passes its helpers and live accessors in. */
'use strict';
window.HarborTopicView = deps => {
  const { h, modal, fmtDate, fmtTime, KIND, ACTION_LABEL } = deps;
  const base = p => String(p || '').split('/').pop();
  const when = at => `${fmtDate(at)} ${fmtTime(at)}`;
  const n = (k, w) => `${k} ${w}${k === 1 ? '' : 's'}`;
  const openItems = t => t.items.map(id => deps.data().byId[id]).filter(it => it && deps.statusOf(it) === 'open');
  let shown = null; // slug of the topic page on screen
  const choiceOf = m => deps.st(m.id).choice || m.options?.find(o => o.recommended)?.key || null;

  function chip(it) {
    if (!it.topic) return null;
    return h('button', { class: 'topic-chip', title: `Topic ${it.topic}: everything on it (O)`, onclick: e => { e.stopPropagation(); openTopic(it.topic); }, onkeydown: e => e.stopPropagation() }, `#${it.topic}`);
  }

  // Bundles: connected groups of the given items, linked by a shared topic or a rel either way.
  // Returns Map id -> members, in the order given (so the first member is the one the queue shows).
  function groups(items) {
    const parent = new Map(items.map(i => [i.id, i.id]));
    const find = x => { while (parent.get(x) !== x) x = parent.get(x); return x; };
    const join = (a, b) => { if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b)); };
    const byTopic = {};
    for (const it of items) {
      if (it.topic) { if (byTopic[it.topic]) join(it.id, byTopic[it.topic]); else byTopic[it.topic] = it.id; }
      for (const r of it.rel || []) join(it.id, r);
    }
    const out = new Map(), lists = {};
    for (const it of items) { const root = find(it.id); (lists[root] ||= []).push(it); out.set(it.id, lists[root]); }
    return out;
  }

  // One stamp for the bundle (the question sheet): every ticked paper gets its approve/file line, decisions their
  // picked (or recommended) option. The paper at the desk goes first, then the rest in queue order; all are held,
  // written and undone together (app.js finishStamp).
  function stampBundle(it, group) {
    if (deps.st(it.id).awaiting || deps.statusOf(it) !== 'open') return;
    const take = group.filter(m => !deps.st(m.id).skipBundle);
    const ordered = take.includes(it) ? [it, ...take.filter(m => m !== it)] : take;
    const lines = []; let skipped = 0;
    for (const m of ordered) {
      const key = choiceOf(m);
      if (m.kind === 'decision' && !key) { skipped++; continue; }
      lines.push({ it: m, line: m.kind === 'decision' ? { id: m.id, action: 'decide', key } : { id: m.id, action: m.kind === 'review' ? 'approve' : 'file' } });
    }
    if (!lines.length) { deps.toast(skipped ? 'Pick an option on the sheet first.' : 'Nothing ticked on the sheet.'); return; }
    if (skipped) deps.toast(`${skipped} decision${skipped > 1 ? 's' : ''} left out: no option picked`, 'warn');
    deps.focus(lines[0].it.id);
    const filed = lines.every(l => l.line.action === 'file');
    deps.finishStamp(lines[0].it, `${filed ? 'FILED' : 'APPROVED'} ×${lines.length}`, filed ? 'file' : 'approve', lines[0].line, false, lines.slice(1), true); // bulk: never a tidy run
  }

  function row(e, byId) {
    const it = e.item && byId[e.item];
    const link = it ? h('button', { class: 'tp-link', onclick: () => deps.openItem(it.id) }, it.title) : e.item || null;
    let what, body, arts = [];
    if (e.type === 'item') { what = `${KIND[e.kind] || e.kind} raised${e.from ? ' · ' + deps.mateLabel(e.from) : ''}`; body = link; arts = it?.artifacts || []; }
    else if (e.type === 'reply') { what = `reply · ${e.from === 'captain' ? 'you' : deps.mateLabel(e.from)}`; body = [e.text, link && h('span', { class: 'dim' }, ' · on ', link)]; }
    else if (e.type === 'answer') {
      const opt = it?.options?.find(o => o.key === e.key);
      what = `you ${ACTION_LABEL[e.action] || e.action}`; body = [link, opt ? `: ${opt.label}` : e.key ? `: ${e.key}` : '', e.text ? ` · "${e.text}"` : ''];
    } else if (e.type === 'note') { what = `note${e.from ? ' · ' + deps.mateLabel(e.from) : ''}`; body = [e.text, link && h('span', { class: 'dim' }, ' · on ', link)]; if (e.artifact) arts = [e.artifact]; }
    else { what = 'resolved'; body = link; }
    return h('li', { class: `tp-ev ${e.type}` }, h('span', { class: 'tp-when' }, when(e.at)), h('span', { class: 'tp-what' }, what),
      h('span', { class: 'tp-body' }, body, arts.length ? h('span', { class: 'tp-arts' }, arts.map(a => h('button', { class: 'ibtn', onclick: () => deps.openArtifact(a) }, a.label || base(a.path || a.url)))) : null));
  }

  function page(slug) {
    const { topics, byId } = deps.data(); const t = topics[slug];
    if (!t) return h('p', { class: 'dim' }, `Nothing on #${slug} yet.`);
    const open = openItems(t);
    const sec = (title, body) => h('section', { class: 'rp' }, h('h3', null, title), body);
    return h('div', { class: 'report topic-page', dataset: { topic: slug } },
      h('div', { class: 'rp-head' }, h('span', null, `#${slug}`), h('span', null, `${open.length} open · ${n(t.items.length, 'item')} · ${n(t.notes, 'note')}${t.last ? ` · last ${when(t.last)}` : ''}`)),
      t.related.length ? h('div', { class: 'tp-rel' }, 'Related topics: ', t.related.map(r => h('button', { class: 'topic-chip', onclick: () => openTopic(r) }, `#${r}`))) : null,
      sec('Still open', open.length ? h('ul', null, open.map(it => h('li', null, deps.prioChip(it), ' ', h('span', { class: `tag ${it.kind}` }, KIND[it.kind]), ' ', h('button', { class: 'tp-link', onclick: () => deps.openItem(it.id) }, it.title)))) : h('p', { class: 'dim' }, 'Nothing open. All settled.')),
      sec('Timeline', h('ol', { class: 'tp-timeline' }, t.events.map(e => row(e, byId)))));
  }

  function openTopic(slug) { shown = slug; modal('ledger topic', `Topic · ${slug}`, page(slug)); }

  // Live: re-draw an open topic page in place, and announce notes that just arrived.
  function update(prevNotes) {
    const box = document.querySelector('.modal.topic .content');
    if (shown && box) { const y = box.scrollTop; box.replaceChildren(page(shown)); box.scrollTop = y; } else shown = null;
    const notes = deps.data().notes; if (notes.length <= prevNotes.length) return;
    const fresh = notes.slice(prevNotes.length);
    for (const n of fresh.slice(-2)) {
      const slug = deps.data().byId[n.item]?.topic || n.topic;
      deps.toast(`Note${slug ? ` on #${slug}` : n.item ? ` on ${n.item}` : ''}: ${n.text.length > 80 ? n.text.slice(0, 79) + '…' : n.text}`);
    }
  }

  // The Topics list: open topics first, then latest activity.
  function list() {
    const all = Object.values(deps.data().topics).map(t => ({ t, open: openItems(t).length })).sort((a, b) => (!!b.open - !!a.open) || b.t.last - a.t.last);
    if (!all.length) return h('p', { class: 'legend' }, 'No topics yet. Agents tag items with -t <topic> and keep remarks with harbordeck note; each topic gets a page here.');
    return h('div', { class: 'topic-list' }, h('p', { class: 'legend' }, 'Every subject your agents raised, with everything said about it. Open ones first.'),
      all.map(({ t, open: k }) => h('button', { class: `tp-row${k ? '' : ' settled'}`, onclick: () => openTopic(t.slug) },
        h('span', { class: 'tp-slug' }, `#${t.slug}`), h('span', { class: 'tp-count' }, k ? `${k} open` : 'settled'),
        h('span', { class: 'si-meta' }, `${n(t.items.length, 'item')} · ${n(t.notes, 'note')}${t.last ? ` · ${when(t.last)}` : ''}${t.related.length ? ` · related ${t.related.map(r => '#' + r).join(' ')}` : ''}`))));
  }

  return { chip, groups, stampBundle, open: openTopic, update, list };
};
