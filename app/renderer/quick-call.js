/* Quick calls: the pieces that make clearing the desk one keystroke per answer. Letter keys on decision options
   (A-E) with an optional grey "why" line, the question sheet (a bundle of papers as one stacked sheet: letter keys
   per row, one stamp), weight icons and project lanes for the queue, the speech bubble's ask, the Later stamp's
   return time, and "take all recommended" (Shift+A). Loaded before app.js; holds no desk state: app.js passes its
   helpers and live accessors in. */
'use strict';
window.HarborQuickCall = deps => {
  const { h, icon, KIND } = deps;
  const LETTERS = 'ABCDE';
  const human = slug => { const s = String(slug || '').replace(/[-_.]+/g, ' ').trim(); return s.charAt(0).toUpperCase() + s.slice(1); };

  // A sample of an option, small, in its row: an image thumbnail, a play button (audio, video: inline, one at a time),
  // or an open link (web page, anything else). A click on the thumbnail or the enlarge button opens the viewer.
  // A local file that is gone leaves a quiet placeholder. Clicks here never pick the option.
  let playing = null;
  const stop = el => { if (playing && playing !== el) { playing.pause(); playing.dispatchEvent(new Event('hd-stop')); } playing = el; };
  function preview(a) {
    if (!a || !(a.path || a.url)) return null;
    const type = deps.artType(a), label = a.label || deps.base(a.path || a.url), src = deps.srcFor(a);
    const quiet = e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.blur(); };
    const view = h('button', { type: 'button', class: 'op-open', title: `Enlarge ${label}`, 'aria-label': `Enlarge ${label}`, onclick: e => { quiet(e); deps.openArtifact(a); } }, '⤢');
    const wrap = (kind, ...kids) => h('span', { class: `op-art ${kind}`, dataset: { art: type } }, ...kids);
    if (type === 'image') return !src ? wrap('gone', 'not available') : wrap('img', h('button', { type: 'button', class: 'op-thumb', title: `Enlarge ${label}`, 'aria-label': `Enlarge ${label}`, onclick: e => { quiet(e); deps.openArtifact(a); } }, h('img', { src, alt: '' })));
    if (type === 'audio' || type === 'video') {
      if (!src) return wrap('gone', 'not available');
      const m = h(type, { src, preload: 'metadata', class: 'op-media' });
      const play = h('button', { type: 'button', class: 'op-play', title: `Play ${label}`, 'aria-label': `Play ${label}`, onclick: e => { quiet(e); if (m.paused) { stop(m); m.play().catch(() => {}); } else m.pause(); } }, '▶');
      const sync = () => { play.textContent = m.paused ? '▶' : '❚❚'; play.classList.toggle('on', !m.paused); };
      for (const ev of ['play', 'pause', 'ended', 'hd-stop']) m.addEventListener(ev, sync);
      return wrap(type, m, play, view);
    }
    return wrap('link', h('button', { type: 'button', class: 'op-link', title: label, onclick: e => { quiet(e); deps.openArtifact(a); } }, type === 'web' ? 'Open page ↗' : 'Open ↗'));
  }

  // One option on a slip or a sheet row: [A] Label rec. / why. `name` groups the radios of one decision.
  function option(it, o, i, chosen, onPick, name) {
    const k = i < LETTERS.length ? LETTERS[i] : null;
    return h('label', { class: `opt${chosen ? ' on' : ''}`, dataset: { key: o.key }, title: k ? `${o.label} (${k})` : o.label },
      h('input', { type: 'radio', name, value: o.key, checked: chosen, onchange: () => onPick(o.key) }),
      k ? h('span', { class: 'k', 'aria-hidden': 'true' }, k) : null,
      h('span', { class: 'o-text fact', onclick: e => deps.inspectOption(e, it, o) }, o.label, o.recommended ? h('span', { class: 'rec' }, 'rec.') : null,
        o.why ? h('span', { class: 'why' }, o.why) : null),
      preview(o.artifact));
  }
  // Re-mark the chosen option in place (no re-render, so nothing jumps under the captain's eyes).
  function mark(root, key) { root?.querySelectorAll('label.opt').forEach(l => { const on = l.dataset.key === key; l.classList.toggle('on', on); const r = l.querySelector('input'); if (r) r.checked = on; }); }

  // How heavy a paper is before you open it: video, PR, report, or a quick call (nothing to read).
  const WEIGHTS = { video: ['video', 'video to watch'], pr: ['pr', 'pull request'], report: ['report', 'report to read'], quick: ['bolt', 'quick call: nothing to open'] };
  function weightsOf(items) {
    const out = new Set();
    for (const it of items) {
      const types = (it.artifacts || []).map(deps.artType).concat(it.body ? [deps.artType(deps.bodyArtifact(it.body))] : []);
      if (types.includes('video')) out.add('video');
      if (types.includes('pr')) out.add('pr');
      if (types.some(t => ['report', 'pdf', 'web', 'diff', 'link', 'file', 'image', 'audio'].includes(t))) out.add('report');
    }
    if (!out.size) out.add('quick');
    return [...out];
  }
  function weightIcons(items) {
    const w = weightsOf(items);
    return h('span', { class: 'wt', title: w.map(k => WEIGHTS[k][1]).join(' · '), dataset: { weight: w.join(' ') } }, w.map(k => { const s = icon(WEIGHTS[k][0]); s.classList.add(`w-${k}`); return s; }));
  }

  // Queue order: lanes by project, the lane holding the most urgent visitor first; inside a lane the given order.
  function laneSort(list) {
    const lanes = new Map();
    for (const it of list) { const p = it.project || 'general'; if (!lanes.has(p)) lanes.set(p, []); lanes.get(p).push(it); }
    return [...lanes.values()].flat();
  }

  // What the visitor at the window says: the question itself, or how many calls they bring.
  function ask(it, group) {
    if (group.length < 2) return it.title;
    const subject = human(it.topic || it.project);
    const all = group.every(m => m.kind === 'decision');
    return `${group.length} ${all ? 'quick calls' : 'papers'} on ${subject}`;
  }

  // Later: tomorrow 9:00 local, or (toReset) just after the next known usage reset.
  function laterUntil(toReset, { now, resets }) {
    if (toReset) { const r = resets.filter(x => x > now).sort((a, b) => a - b)[0]; return r ? r + 60 : null; }
    const d = new Date(now * 1000); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return Math.floor(d / 1000);
  }

  // The question sheet: every paper of a bundle as a row. The row in focus is the item at the desk (its artifacts
  // fill the reading paper); letters pick on it and move to the next row; one stamp settles every ticked row.
  function sheet(it, group, { awaiting }) {
    const VERB = { review: 'approve', answer: 'file', todo: 'file (done)' };
    const rows = group.map((m, n) => {
      const s = deps.st(m.id); const cur = m.id === it.id; const choice = deps.choiceOf(m);
      const take = h('input', { type: 'checkbox', checked: !s.skipBundle, 'aria-label': `Include ${m.title}`, onclick: e => e.stopPropagation(), onchange: e => { s.skipBundle = !e.target.checked; deps.save(); row.classList.toggle('skip', s.skipBundle); deps.sheetCount(); } });
      const body = m.kind === 'decision' && m.options
        ? h('div', { class: 'opts' }, m.options.map((o, i) => option(m, o, i, choice === o.key, key => { s.choice = key; deps.save(); deps.pick(m.id); }, `sheet-${m.id}`)))
        : h('div', { class: 'b-verb' }, `${KIND[m.kind]}: ${VERB[m.kind]} on stamp`);
      const row = h('div', { class: `b-row${cur ? ' cur' : ''}${s.skipBundle ? ' skip' : ''}`, dataset: { id: m.id }, onclick: e => { if (!cur && !e.target.closest('input,label,button')) deps.focusRow(m.id); } },
        take, h('span', { class: 'qnum' }, n + 1),
        h('div', { class: 'b-what' }, h('button', { class: 'tp-link b-title', onclick: () => deps.focusRow(m.id) }, m.title), body));
      return row;
    });
    const zone = h('div', { class: 'stamp-zone', id: 'stamp-zone' }, awaiting ? 'sent back; awaiting reply' : h('span', null, 'Space stamps ', h('b', { class: 'sheet-n' }, ''), ''));
    const p = deps.paper('ask qsheet', `Question sheet · ${group.length}`, [
      h('p', { class: 'meta' }, 'A–E pick on the row in focus and move on · J/K row · Space stamps every ticked row'), ...rows, zone,
      h('div', { class: 'b-foot' }, h('button', { class: 'pbtn', onclick: () => deps.stampSheet() }, 'Stamp the sheet'))], 'ask');
    return p;
  }

  // Shift+A: every recommended answer on low-stakes (P3-P4) decisions, listed first; untick, then one stamp.
  function sweepCandidates(items) { return items.filter(it => it.kind === 'decision' && (it.priority || 3) >= 3 && it.options?.some(o => o.recommended)); }
  function openSweep(items, onStamp) {
    const list = sweepCandidates(items);
    if (!list.length) { deps.toast('No low-stakes recommendations waiting (P3-P4 decisions with a rec.).'); return; }
    const ticked = new Set(list.map(it => it.id));
    const go = h('button', { class: 'pbtn' }, '');
    const label = () => { go.textContent = `Stamp ${ticked.size} recommended`; go.disabled = !ticked.size; };
    go.onclick = () => { const pick = list.filter(it => ticked.has(it.id)); if (!pick.length) return; deps.closeModal(); onStamp(pick); };
    const rows = list.map(it => { const rec = it.options.find(o => o.recommended);
      return h('label', { class: 'sw-row' }, h('input', { type: 'checkbox', checked: true, onchange: e => { e.target.checked ? ticked.add(it.id) : ticked.delete(it.id); label(); } }),
        h('span', null, deps.prioChip(it), ' ', it.title, ' → ', h('b', null, rec.label), rec.why ? h('span', { class: 'why' }, rec.why) : null)); });
    label();
    deps.modal('sweep', 'Take all recommended', h('div', null, h('p', { class: 'legend' }, 'Only P3-P4 decisions with a recommendation. Untick anything you want to read first. One stamp, undo still works.'), ...rows),
      [h('span', { class: 'legend' }, 'Shift+A again stamps'), h('button', { class: 'pbtn ghost', onclick: deps.closeModal }, 'Cancel'), go]);
  }

  return { LETTERS, option, preview, mark, weightIcons, weightsOf, laneSort, ask, laterUntil, sheet, sweepCandidates, openSweep, human };
};
