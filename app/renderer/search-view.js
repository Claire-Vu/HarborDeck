/* Search (Cmd/Ctrl+K, or Search in the menu): one quick palette over every item (open and resolved), topic and
   note. Fuzzy on titles, ids and topics, plain substring on summaries and note text; keyboard only: type, arrows
   move, Enter opens, Esc closes. Ranking is a pure function (unit-tested in node) fast enough for a few thousand
   entries per keystroke. Loaded before app.js; holds no desk state: app.js passes the entries and what opening does. */
'use strict';
const HarborSearch = (() => {
  const BOUNDARY = /[\s\-_./#:,()'"]/;
  // How well query q (lower case, one word) matches text t (lower case): null when q's characters do not all
  // appear in t in order. A substring beats a scatter; word starts, runs and an early hit score higher.
  function score(q, t) {
    if (!q) return 0;
    if (!t) return null;
    const i = t.indexOf(q);
    if (i >= 0) return 100 + q.length * 4 - Math.min(i, 40) / 4 + (i === 0 || BOUNDARY.test(t[i - 1]) ? 25 : 0);
    let s = 0, from = 0, run = 0, first = -1;
    for (const c of q) {
      const k = t.indexOf(c, from); if (k < 0) return null;
      if (first < 0) first = k;
      run = k === from && k > 0 ? run + 1 : 1;
      s += run * 3 + (k === 0 || BOUNDARY.test(t[k - 1]) ? 8 : 0);
      from = k + 1;
    }
    return s - Math.min(first, 20) / 2 - (from - first - q.length) / 3;
  }

  // entries: [{ title, keys?, text? }], already lower-cased in `_t`, `_k`, `_x` by index(); every word of the query
  // must match the title or keys (fuzzy) or the text (substring). Returns the best `limit` entries, best first;
  // an empty query keeps the given order.
  function index(entries) {
    for (const e of entries) { e._t = (e.title || '').toLowerCase(); e._k = (e.keys || '').toLowerCase(); e._x = (e.text || '').toLowerCase(); }
    return entries;
  }
  function rank(entries, query, limit = 50) {
    const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return entries.slice(0, limit);
    const hits = [];
    for (const e of entries) {
      let total = 0;
      for (const w of words) {
        const a = score(w, e._t), b = score(w, e._k), c = e._x.includes(w) ? 40 : null;
        const best = Math.max(a ?? -1e9, b == null ? -1e9 : b * .8, c ?? -1e9);
        if (best === -1e9) { total = null; break; }
        total += best;
      }
      if (total != null) hits.push([total + (e.boost || 0), e]);
    }
    return hits.sort((x, y) => y[0] - x[0]).slice(0, limit).map(x => x[1]);
  }
  return { score, index, rank };
})();
if (typeof module === 'object') module.exports = HarborSearch;
else window.HarborSearchView = deps => {
  const { h } = deps;
  let el = null, input = null, list = null, shown = [], sel = 0, all = [];
  const isOpen = () => !!el && el.isConnected;

  function draw() {
    shown = HarborSearch.rank(all, input.value);
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.replaceChildren(...shown.map((e, i) => h('li', { id: `sr-${i}`, role: 'option', class: `sr-row ${e.kind}`, 'aria-selected': String(i === sel),
      onmousemove: () => { if (sel !== i) { sel = i; mark(); } }, onclick: () => pick(i) },
      h('span', { class: `sr-kind ${e.kind}` }, e.label), h('span', { class: 'sr-main' }, h('span', { class: 'sr-title' }, e.title), e.sub ? h('span', { class: 'sr-sub' }, e.sub) : null))));
    if (!shown.length) list.append(h('li', { class: 'sr-empty' }, input.value.trim() ? 'Nothing matches.' : 'Nothing on the desk yet.'));
    mark();
  }
  function mark() {
    list.querySelectorAll('.sr-row').forEach((r, i) => r.setAttribute('aria-selected', String(i === sel)));
    const cur = list.querySelector(`#sr-${sel}`);
    if (cur) { input.setAttribute('aria-activedescendant', cur.id); cur.scrollIntoView({ block: 'nearest' }); } else input.removeAttribute('aria-activedescendant');
  }
  function pick(i) { const e = shown[i]; if (!e) return; close(); deps.open(e); }

  function open() {
    if (isOpen()) { input.focus(); input.select(); return; }
    all = HarborSearch.index(deps.entries());
    input = h('input', { class: 'sr-in', type: 'search', placeholder: 'Find an item, topic or note…', spellcheck: false, role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'sr-list', 'aria-autocomplete': 'list', 'aria-label': 'Search items, topics and notes' });
    list = h('ul', { class: 'sr-list', id: 'sr-list', role: 'listbox', 'aria-label': 'Results' });
    el = h('div', { class: 'modal search', onclick: e => { if (e.target === el) close(); } },
      h('div', { class: 'box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Search' }, input, list,
        h('div', { class: 'sr-foot', 'aria-hidden': 'true' }, h('span', null, h('b', null, '↑↓'), ' move'), h('span', null, h('b', null, '⏎'), ' open'), h('span', null, h('b', null, 'Esc'), ' close'), h('span', { class: 'sr-count' }, `${all.length} on file`))));
    input.addEventListener('input', () => { sel = 0; draw(); });
    input.addEventListener('keydown', e => {
      if (e.isComposing) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (shown.length) { sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length; mark(); } }
      else if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    });
    deps.mount(el); sel = 0; draw(); input.focus();
  }
  function close() { if (el) { el.remove(); el = null; } }
  return { open, close, isOpen, toggle: () => (isOpen() ? close() : open()) };
};
