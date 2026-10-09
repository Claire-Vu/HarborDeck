/* Scenes: one place per item kind, flipped with the arrow keys or the on-screen arrows. Every open item of the kind
   is one figure in the scene (the count is literal); a settled one leaves. Each scene has one quirk:
   Signpost Square (decisions) callers hold up their option letters, the Customs Shed (reviews) flies a red pennant
   over papers that break a standing order, Bottle Cove (dispatches) bottles sink lower the longer they wait, and the
   Notice Board (to-dos) flutters notices due within a day and pins overdue ones red. The goal is zero everywhere.
   The pure part (SCENES, group, tally, step, nextBusy, progress, leavers) is unit-tested in node; the factory draws
   into #scenes, the top window over the harbor sky, with helpers app.js passes in. Every name here is original. Loaded before app.js. */
'use strict';
const HarborScenes = (() => {
  const SCENES = [
    { kind: 'decision', name: 'Signpost Square', one: 'decision', many: 'decisions', quirk: 'Each caller holds up the letters of their choices; ★ marks the mate\'s pick.', clear: 'The square is empty: every road chosen.' },
    { kind: 'review', name: 'Customs Shed', one: 'review', many: 'reviews', quirk: 'Papers that break a standing order fly a red pennant.', clear: 'Nothing left on the inspection bench.' },
    { kind: 'answer', name: 'Bottle Cove', one: 'dispatch', many: 'dispatches', quirk: 'Each dispatch is a bottle; the longer it waits, the lower it sinks.', clear: 'The cove is calm: no bottles bobbing.' },
    { kind: 'todo', name: 'Notice Board', one: 'notice', many: 'notices', quirk: 'Notices due within a day flutter; overdue ones are pinned red.', clear: 'The board is bare.' }
  ];
  const KINDS = SCENES.map(s => s.kind);
  const byKind = Object.fromEntries(SCENES.map(s => [s.kind, s]));

  // open items per kind, in the order given (the queue order)
  function group(items, isOpen) {
    const g = Object.fromEntries(KINDS.map(k => [k, []]));
    for (const it of items) if (g[it.kind] && isOpen(it)) g[it.kind].push(it);
    return g;
  }
  const tally = g => { const c = Object.fromEntries(KINDS.map(k => [k, g[k].length])); c.total = KINDS.reduce((n, k) => n + c[k], 0); return c; };
  const step = (kind, dir) => { const i = KINDS.indexOf(kind); return KINDS[i < 0 ? (dir > 0 ? 0 : KINDS.length - 1) : (i + dir + KINDS.length) % KINDS.length]; };
  // the next scene after `kind` with anyone waiting, or null when every scene is clear
  function nextBusy(kind, counts) { for (let d = 1; d <= KINDS.length; d++) { const k = step(kind, d); if (counts[k]) return k; } return null; }
  const progress = (left, cleared) => ({ left, cleared, pct: left + cleared ? Math.round(cleared * 100 / (left + cleared)) : 100, zero: left === 0 });
  const leavers = (before, after) => before.filter(id => !after.includes(id));

  function view(deps) {
    const { h } = deps;
    const LETTERS = 'ABCDE';
    const BOTTLE = '<svg viewBox="0 0 12 22" shape-rendering="crispEdges" aria-hidden="true"><rect x="4" y="0" width="4" height="3" fill="#8a5a2b"/><rect x="4" y="3" width="4" height="3" fill="#7fb3a0"/><rect x="2" y="6" width="8" height="13" fill="#7fb3a0"/><rect x="3" y="8" width="6" height="8" fill="#f1e4c0"/><rect x="4" y="10" width="4" height="1" fill="#a66"/><rect x="4" y="12" width="4" height="1" fill="#a66"/><rect x="3" y="6" width="1" height="11" fill="#fff" opacity=".35"/><rect x="2" y="19" width="8" height="1" fill="#4f7f70"/></svg>';
    const slip = (pin, lines) => `<svg viewBox="0 0 16 20" shape-rendering="crispEdges" aria-hidden="true"><rect x="1" y="2" width="14" height="17" fill="#f4ecd6"/><rect x="1" y="18" width="14" height="1" fill="#cfc2a0"/>${Array.from({ length: lines }, (_, i) => `<rect x="3" y="${6 + i * 3}" width="${i % 2 ? 7 : 10}" height="1" fill="#8a7a5a"/>`).join('')}<rect x="7" y="0" width="3" height="3" fill="${pin}"/></svg>`;
    let last = { kind: null, sig: '' };

    // one figure: who, the quirk, and the label read out for it
    function figure(it, kind, urgent) {
      const who = deps.who(it), wait = deps.age(it), away = deps.away(it), lvl = deps.impatience(it);
      let label = `${who} · ${it.title} · waiting ${wait}`, cls = `sc-fig ${kind}`, html = '', extra = null;
      if (kind === 'decision') {
        const rec = (it.options || []).findIndex(o => o.recommended);
        extra = h('span', { class: 'placard', 'aria-hidden': 'true' }, (it.options || []).slice(0, 5).map((o, i) => h('b', { class: i === rec ? 'rec' : null }, i === rec ? `★${LETTERS[i]}` : LETTERS[i])));
        html = deps.sprite(it); label += ` · ${(it.options || []).length} choices${rec >= 0 ? `, recommended ${LETTERS[rec]}` : ''}`;
      } else if (kind === 'review') {
        const f = deps.flagged(it); html = deps.sprite(it);
        if (f) { cls += ' flagged'; extra = h('span', { class: 'pennant', 'aria-hidden': 'true' }); label += ` · ${f} standing order${f > 1 ? 's' : ''} flagged`; }
      } else if (kind === 'answer') {
        html = BOTTLE; cls += ` sink${lvl}`; label += lvl ? ` · ${lvl === 2 ? 'sinking fast' : 'sinking'}` : '';
      } else {
        const d = it.due ? it.due - deps.now() : null; const over = d != null && d < 0, soon = d != null && !over && d < 86400;
        html = slip(over ? '#c0392b' : deps.coat(it), 3); if (over) { cls += ' overdue'; label += ' · overdue'; } else if (soon) { cls += ' soon'; label += ' · due within a day'; }
      }
      if (lvl && (kind === 'decision' || kind === 'review')) cls += lvl === 2 ? ' tap fast' : ' tap';
      if (away) { cls += ' away'; label += ' · away, waiting on a reply'; }
      if (it.id === deps.current()) cls += ' at-desk';
      if (it.id === urgent) { cls += ' urgent'; label += ' · the cat says: this one first'; }
      return { id: it.id, cls, label, html, extra };
    }

    function render(root, v) {
      if (!root) return;
      const sc = byKind[v.kind], list = v.groups[v.kind], n = list.length, figs = list.map(it => figure(it, v.kind, v.urgent));
      const prog = progress(v.counts.total, v.cleared);
      const sig = JSON.stringify([v.kind, figs.map(f => [f.id, f.cls, f.label]), v.counts, v.cleared, v.paused, v.catBell]);
      if (sig === last.sig) return;
      // a figure that was here last time and is gone now leaves the scene (after its stamp; nothing waits on it)
      const ghosts = [];
      if (last.kind === v.kind) {
        const gone = leavers([...root.querySelectorAll('.sc-fig:not(.leaving)')].map(e => e.dataset.id), figs.map(f => f.id));
        for (const id of gone) { const el = root.querySelector(`.sc-fig[data-id="${CSS.escape(id)}"]:not(.leaving)`); if (el) ghosts.push({ el: el.cloneNode(true), x: el.offsetLeft, y: el.offsetTop }); }
      }
      last = { kind: v.kind, sig };
      root.dataset.scene = v.kind; root.dataset.count = String(n); root.setAttribute('aria-label', `Scene: ${sc.name}, ${n} ${n === 1 ? sc.one : sc.many} waiting`);
      const arrow = dir => h('button', { class: `sc-arrow ${dir < 0 ? 'prev' : 'next'}`, 'aria-label': `${dir < 0 ? 'Previous' : 'Next'} scene: ${byKind[step(v.kind, dir)].name} (${dir < 0 ? '←' : '→'})`, title: `${byKind[step(v.kind, dir)].name} (${dir < 0 ? '←' : '→'})`, onclick: () => deps.flip(dir) }, dir < 0 ? '‹' : '›');
      const crowd = h('div', { class: `sc-crowd n${Math.min(n, 3)}${n > 8 ? ' packed' : ''}`, role: 'list', 'aria-label': `${n} waiting in ${sc.name}` },
        figs.map((f, i) => h('button', { class: f.cls, role: 'listitem', dataset: { id: f.id }, title: f.label, 'aria-label': f.label, style: `animation-delay:${(i * 137) % 900}ms`, onclick: () => deps.open(f.id) }, f.extra, h('span', { class: 'sc-body', html: f.html }), f.id === v.urgent ? deps.cat(v.catBell) : null)));
      const busy = nextBusy(v.kind, v.counts);
      const stage = h('div', { class: 'sc-stage', 'data-kind': v.kind, title: sc.quirk }, h('div', { class: 'sc-set', 'aria-hidden': 'true' }), crowd,
        n ? null : h('div', { class: 'sc-clear' }, deps.cat(v.catBell, true), h('b', null, 'All clear'), h('span', null, sc.clear),
          busy ? h('button', { class: 'sc-go', onclick: () => deps.jump(busy) }, `${byKind[busy].name}: ${v.counts[busy]} waiting ›`) : h('span', { class: 'sc-zero' }, '⚑ Zero waiting anywhere')));
      const pips = h('div', { class: 'sc-pips', role: 'group', 'aria-label': 'Scenes' }, SCENES.map(s => h('button', { class: `sc-pip${v.counts[s.kind] ? '' : ' clear'}`, 'aria-current': String(s.kind === v.kind), title: `${s.name}: ${v.counts[s.kind]} waiting`, 'aria-label': `${s.name}: ${v.counts[s.kind]} waiting`, onclick: () => deps.jump(s.kind) }, v.counts[s.kind] ? String(v.counts[s.kind]) : '✓')));
      root.replaceChildren(
        stage,
        h('header', { class: 'sc-head' }, arrow(-1), h('div', { class: 'sc-title', title: sc.quirk }, h('b', { class: 'sc-name' }, sc.name), h('span', { class: 'sc-count', title: `${n} ${n === 1 ? sc.one : sc.many} waiting` }, String(n))), arrow(1)),
        h('div', { class: `sc-progress${prog.zero ? ' zero' : ''}`, title: `${prog.cleared} cleared today, ${prog.left} still open` },
          h('div', { class: 'meter' }, h('span', { style: `width:${prog.pct}%` })),
          h('span', { class: 'sc-left' }, prog.zero ? 'Zero waiting' : `${prog.left} to zero`, v.paused ? ` · ${v.paused} crew paused` : ''), pips));
      for (const g of ghosts) { g.el.classList.add('leaving'); g.el.removeAttribute('role'); g.el.tabIndex = -1; g.el.style.left = `${g.x}px`; g.el.style.top = `${g.y}px`; crowd.append(g.el); setTimeout(() => g.el.remove(), 1200); }
    }
    return { render, reset: () => { last = { kind: null, sig: '' }; } };
  }

  return { SCENES, KINDS, byKind, group, tally, step, nextBusy, progress, leavers, view };
})();
if (typeof module === 'object') module.exports = HarborScenes;
