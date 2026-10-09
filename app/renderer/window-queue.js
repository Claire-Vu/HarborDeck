/* The window: the queue of visitors, the scenes, the yard, and who steps up to the desk next.
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

// ------------------------------------------------------------ queue + visitors
function queueItems(f = S.prefs.filter) {
  return quick.laneSort(ITEMS.filter(i => statusOf(i) === 'open' && (f === 'all' || i.kind === f))
    .sort((a, b) => (st(a.id).awaiting - st(b.id).awaiting) || urgency(a, b) || a.id.localeCompare(b.id, undefined, { numeric: true })));
}
function spriteSVG(id, kind, opts = {}) {
  const { cap, coat } = opts.reg || crewColors(id); const mate = opts.mate; const zz = opts.tired || opts.nap; const skin = opts.reg?.skin || '#f0c9a0';
  const cargo = {
    decision: `<rect x="17" y="13" width="9" height="8" fill="#b07a3a"/><rect x="17" y="16" width="9" height="1" fill="#7a4e1e"/><rect x="20" y="14" width="3" height="3" fill="#a3302c"/>`,
    review: `<rect x="17" y="12" width="9" height="9" fill="#333"/><circle cx="21.5" cy="16.5" r="3" fill="#777"/><circle cx="21.5" cy="16.5" r="1" fill="#333"/>`,
    answer: `<rect x="18" y="8" width="4" height="14" fill="#c9a66b"/><rect x="18" y="8" width="4" height="2" fill="#8a3a3a"/><rect x="18" y="20" width="4" height="2" fill="#8a3a3a"/>`,
    todo: `<rect x="17" y="11" width="8" height="10" fill="#e9e2cf"/><rect x="19" y="10" width="4" height="2" fill="#555"/><rect x="18" y="14" width="6" height="1" fill="#888"/><rect x="18" y="16" width="6" height="1" fill="#888"/>`,
    reply: `<rect x="17" y="13" width="9" height="6" fill="#f4efe0"/><path d="M17 13 L21.5 17 L26 13" stroke="#888" fill="none"/>`,
    slip: `<rect x="17" y="12" width="8" height="10" fill="#f1d9d6"/><rect x="18" y="14" width="6" height="1" fill="#a66"/><rect x="18" y="16" width="6" height="1" fill="#a66"/>`,
    pot: `<rect x="15" y="13" width="1" height="6" fill="#ccc"/><rect x="16" y="19" width="11" height="7" fill="#333"/><rect x="15" y="18" width="13" height="2" fill="#555"/><g class="steam"><rect x="19" y="14" width="1" height="2" fill="#ddd" opacity=".8"/><rect x="23" y="12" width="1" height="2" fill="#ddd" opacity=".6"/><rect x="21" y="10" width="1" height="2" fill="#ddd" opacity=".4"/></g>`,
    tray: `<rect x="15" y="15" width="11" height="2" fill="#ddd"/><rect x="18" y="12" width="5" height="3" fill="#e9c46a"/><rect x="19" y="11" width="3" height="1" fill="#c0392b"/>`,
    mug: `<rect x="15" y="14" width="4" height="4" fill="#e9e2cf"/><rect x="19" y="15" width="1" height="2" fill="#e9e2cf"/><rect x="16" y="12" width="1" height="1" fill="#ddd" opacity=".7"/>`
  }[kind] || '';
  const hats = [`<rect x="5" y="2" width="8" height="3" fill="${cap}"/><rect x="4" y="4" width="10" height="1" fill="${cap}"/>`, `<rect x="4" y="3" width="10" height="2" fill="${cap}"/><rect x="6" y="2" width="6" height="1" fill="${cap}"/><rect x="9" y="1" width="1" height="1" fill="${cap}"/>`,
    `<rect x="5" y="3" width="8" height="2" fill="${cap}"/><rect x="13" y="4" width="2" height="1" fill="${cap}"/><rect x="14" y="5" width="1" height="2" fill="${cap}"/>`, `<rect x="6" y="0" width="6" height="4" fill="#2b2318"/><rect x="6" y="3" width="6" height="1" fill="${cap}"/><rect x="4" y="4" width="10" height="1" fill="#2b2318"/>`];
  const hat = mate ? `<rect x="4" y="1" width="10" height="4" fill="#1d2a38"/><rect x="3" y="5" width="12" height="1" fill="#0e151e"/><rect x="8" y="2" width="2" height="2" fill="#f2b544"/>` : hats[opts.reg?.hat || 0];
  const eyes = zz ? `<rect x="7" y="8" width="2" height="1" fill="#222"/><rect x="10" y="8" width="2" height="1" fill="#222"/><text x="14" y="6" font-size="4" fill="#fff" font-family="monospace" class="zz">z z</text>`
    : opts.sad ? `<rect x="7" y="7" width="1" height="1" fill="#222"/><rect x="10" y="7" width="1" height="1" fill="#222"/><rect x="6" y="6" width="2" height="1" fill="#222" opacity=".6"/><rect x="10" y="6" width="2" height="1" fill="#222" opacity=".6"/>`
    : `<rect x="7" y="7" width="1" height="1" fill="#222"/><rect x="10" y="7" width="1" height="1" fill="#222"/>`;
  const mouth = opts.happy ? `<rect x="7" y="9" width="1" height="1" fill="#a66"/><rect x="8" y="10" width="2" height="1" fill="#a66"/><rect x="10" y="9" width="1" height="1" fill="#a66"/>` : opts.sad ? `<rect x="8" y="10" width="2" height="1" fill="#a66"/><rect x="7" y="11" width="1" height="1" fill="#a66"/><rect x="10" y="11" width="1" height="1" fill="#a66"/>` : `<rect x="8" y="9" width="2" height="1" fill="#a66"/>`;
  const body = mate ? '#1d2a38' : coat;
  const sweat = opts.sweat ? `<g class="drop"><rect x="14" y="5" width="1" height="1" fill="#5bc0ff"/><rect x="13" y="6" width="2" height="2" fill="#5bc0ff"/></g>` : '';
  const leftArm = opts.watch ? `<rect x="2" y="10" width="2" height="4" fill="${body}"/><rect x="1" y="8" width="3" height="2" fill="#333"/><rect x="2" y="8" width="1" height="1" fill="#ddd"/>` : `<rect x="2" y="12" width="2" height="6" fill="${body}"/>`;
  const legs = opts.sit ? `<rect x="5" y="20" width="3" height="3" fill="#2a2a3a"/><rect x="10" y="20" width="3" height="3" fill="#2a2a3a"/><rect x="2" y="23" width="14" height="5" fill="#b07a3a"/><rect x="2" y="25" width="14" height="1" fill="#7a4e1e"/>`
    : `<rect x="5" y="20" width="3" height="6" fill="#2a2a3a"/><rect x="10" y="20" width="3" height="6" fill="#2a2a3a"/><rect x="4" y="26" width="5" height="2" fill="#111"/><rect x="9" y="26" width="5" height="2" fill="#111"/>`;
  return `<svg viewBox="0 0 28 28" class="visitor${mate ? ' mate' : ''}" shape-rendering="crispEdges" aria-hidden="true">
    ${hat}<rect x="5" y="5" width="8" height="6" fill="${skin}"/>${eyes}${mouth}${sweat}
    <rect x="4" y="11" width="10" height="9" fill="${body}"/><rect x="8" y="12" width="2" height="7" fill="rgba(255,255,255,.25)"/>${mate ? '<rect x="5" y="12" width="2" height="2" fill="#f2b544"/>' : ''}
    ${leftArm}<rect x="14" y="12" width="2" height="5" fill="${body}"/><rect x="14" y="17" width="3" height="2" fill="${skin}"/>
    ${legs}${cargo}</svg>`;
}
const prioChip = it => h('span', { class: `prio p${prio(it)}`, title: `priority ${prio(it)}: ${PRIO_LABEL[prio(it)]}` }, `P${prio(it)}`);
const dueChip = it => { if (!it.due) return null; const d = it.due - now(); return h('span', { class: `due ${d < 0 ? 'over' : d < 86400 ? 'soon' : ''}`, title: `due ${fmtDate(it.due)} ${fmtTime(it.due)}` }, d < 0 ? `overdue ${age(-d)}` : `due ${age(d)}`); };
const bundleOf = it => topicView.groups(queueItems().filter(i => !st(i.id).awaiting)).get(it.id) || [it];
const choiceOf = it => st(it.id).choice || it.options?.find(o => o.recommended)?.key || null;
const HS = HarborScenes;
const sceneKind = () => (HS.byKind[S.prefs.scene] ? S.prefs.scene : HS.byKind[S.prefs.filter] ? S.prefs.filter : HS.KINDS[0]);
// switching scenes calls the front of that scene's line to the desk; an empty scene leaves the desk empty (all clear)
function setScene(k) { S.prefs.scene = k; S.prefs.filter = k; const f = sceneLine(k).find(i => !st(i.id).awaiting); S.current = f ? f.id : null; if (f) st(f.id).read = true; save(); snd('flip'); renderAll(); }
// the line at a scene (HS.line); `back` is when the item was sent to the back of the line: view state, never written out
const sceneLine = k => HS.line(queueItems(k), it => ({ prio: prio(it), created: it.created, back: st(it.id).back, away: !!st(it.id).awaiting }));
// the top window: the current kind's scene over the harbor sky; the ship cat (F8) sits by its most urgent figure
// (highest priority, then the most impatient), and naps when the scene is clear
function renderScenes() {
  const open = queueItems('all'); const groups = Object.fromEntries(HS.KINDS.map(k => [k, sceneLine(k)])); const kind = sceneKind();
  const here = groups[kind].filter(i => !st(i.id).awaiting && i.id !== S.current);
  const urgent = here.reduce((a, b) => (!a || (prio(b) - prio(a) || impatience(a) - impatience(b)) < 0 ? b : a), null);
  scenes.render($('#scenes'), { kind, groups, counts: HS.tally(groups), cleared: clearedToday(), paused: new Set(open.flatMap(waitingOn)).size, urgent: urgent?.id, catBell: S.fun.owned.includes('bell') });
}
function openItem(id) { const it = byId[id]; if (!it) return; closeModal(); if (S.prefs.plain || statusOf(it) !== 'open' || st(id).awaiting) modal('viewer', it.title, plainCard(it, true)); else stepUp(id); }
function renderFilters() {
  const counts = { all: 0 }; for (const i of ITEMS) if (statusOf(i) === 'open') { counts.all++; counts[i.kind] = (counts[i.kind] || 0) + 1; }
  $('#filters').replaceChildren(...['all', 'decision', 'review', 'answer', 'todo'].filter(k => k === 'all' || counts[k] || S.prefs.filter === k).map(k =>
    h('button', { class: 'chip', 'aria-pressed': String(S.prefs.filter === k), onclick: () => { if (k !== 'all') return setScene(k); S.prefs.filter = k; save(); renderAll(); } }, k === 'all' ? 'All' : KINDS[k], ` ${counts[k] || 0}`)));
}
function renderQueue() {
  const kindShown = !!HS.byKind[S.prefs.filter]; const list = kindShown ? sceneLine(S.prefs.filter) : queueItems(); const ul = $('#queue'); ul.replaceChildren(); const groups = topicView.groups(list.filter(i => !st(i.id).awaiting));
  const heads = list.filter(it => (groups.get(it.id) || [it])[0] === it); const lanes = new Set(heads.map(it => it.project || 'general'));
  let lane = null;
  for (const it of list) {
    const s = st(it.id); const m = mateFor(it); const c = crewFor(it); const flagged = flaggedCount(it); const g = groups.get(it.id) || [it];
    if (g[0] !== it) continue; // bundle members ride with the first
    const p = it.project || 'general';
    if (!kindShown && lanes.size > 1 && p !== lane) { lane = p; ul.append(h('li', { class: 'q-lane', 'aria-hidden': 'true' }, h('span', null, p), h('span', null, heads.filter(x => (x.project || 'general') === p).length))); }
    ul.append(h('li', { 'aria-current': String(g.some(x => x.id === S.current)), tabindex: 0, class: `${s.awaiting ? 'away' : ''} p${prio(it)}`, onclick: () => stepUp(it.id), onkeydown: e => { if (e.key === 'Enter') stepUp(it.id); } },
      h('div', { html: (w => spriteSVG(w.id, it.kind, { mate: w.mate, reg: w.reg, ...face(w), tired: tired() }))(whoBrings(it)) }),
      h('div', null,
        h('div', { class: 'q-title' }, !s.read && h('span', { class: 'unread-dot', title: 'unread' }), h('span', null, it.title), it.id !== S.current && s.read ? updChip(it, changesOf(it)) : null, g.length > 1 ? h('span', { class: 'bundle-n', title: `bundle: ${g.map(x => x.title).join(' · ')}` }, `+${g.length - 1}`) : null, quick.weightIcons(g)),
        h('div', { class: 'q-meta' }, prioChip(it), waitChip(it), h('span', { class: `tag ${it.kind}` }, KIND[it.kind]), topicView.chip(it), dueChip(it), flagged ? h('span', { class: 'flag', title: `${flagged} standing order flagged` }, `⚠${flagged}`) : null, h('span', { class: 'via' }, c ? `via ${crewName(c.id)}` : m.label, s.awaiting ? ' · away' : '')))));
  }
  if (!list.length) ul.append(h('li', { class: 'q-empty' }, 'Nobody at the window.'));
  const later = ITEMS.filter(i => statusOf(i) === 'later').sort((a, b) => deferredUntil(a) - deferredUntil(b));
  if (later.length) {
    ul.append(h('li', { class: 'q-lane later' }, h('span', null, 'Later'), h('span', null, later.length)));
    for (const it of later) ul.append(h('li', { class: 'q-later', tabindex: 0, title: 'Parked with the Later stamp. Click to bring it back now.', onclick: () => unpark(it.id), onkeydown: e => { if (e.key === 'Enter') unpark(it.id); } },
      h('span', { class: 'q-title' }, it.title), h('span', { class: 'q-meta' }, `back ${fmtDate(deferredUntil(it))} ${fmtTime(deferredUntil(it))}`)));
  }
  $('#btn-next').disabled = !list.some(i => !st(i.id).awaiting);
}
function impatience(it) {
  const ageD = (now() - it.created) / 86400; const dueH = it.due ? (it.due - now()) / 3600 : null;
  if ((dueH != null && dueH < 12) || ageD > 14) return 2; if ((dueH != null && dueH < 48) || ageD > 1) return 1; return 0;
}
// Crew on the item bring it themselves; otherwise the project's regular does (F2), with a mood and a memory of your recent calls.
const callsOn = project => S.answers.filter(a => byId[a.id]?.project === project).map(a => ({ action: a.action, at: a.at }));
function whoBrings(it) {
  const c = crewFor(it); if (c) return { id: c.id, name: crewName(c.id), mate: false };
  const r = G.regular(it.project); const calls = callsOn(it.project);
  return { id: r.id, name: r.name, mate: false, reg: r, mood: G.mood(calls, now()), memory: G.memory(calls, now()) };
}
const face = who => (who.mood === 'cheerful' ? { happy: true } : who.mood === 'grumpy' ? { sad: true } : {});
const present = () => ITEMS.filter(i => statusOf(i) === 'open' && !st(i.id).awaiting);
const harborClear = () => ITEMS.length > 0 && !present().length;
const clearedToday = () => Object.values(S.items).filter(s => s.status === 'resolved' && s.verdict && s.verdict.at >= S.dayStart).length;
const tideNow = () => G.tide(staminaViews().filter(v => !v.reset));
function renderHarbor() {
  const t = now(); const goal = G.tideGoal(S.fun.tide, t, tideNow()); if (JSON.stringify(goal) !== JSON.stringify(S.fun.tide)) { S.fun.tide = goal; save(); }
  harborScene.render({ t, open: ITEMS.filter(i => statusOf(i) === 'open'), stamina: staminaMin(), tide: tideNow(), goal, owned: S.fun.owned, days: S.fun.dayCount });
  renderScenes();
}
// the visitor at the desk speaks in the top window, over the scene
function renderWindowScene() {
  const w = $('#at-window'); w.replaceChildren(); w.className = 'at-window';
  const it = byId[S.current];
  renderHarbor();
  if (!it || statusOf(it) !== 'open') return;
  const present = queueItems().filter(i => !st(i.id).awaiting); const mine = topicView.groups(present).get(S.current) || [];
  const m = mateFor(it); const who = whoBrings(it);
  w.append(h('div', { class: 'speech', title: `${m.label} · ${KIND[it.kind].toLowerCase()}` }, h('span', { class: 'say' }, quick.ask(it, mine.length > 1 ? mine : [it])), who.reg ? h('small', { class: 'memory', title: `${who.name}, ${who.mood}` }, `${who.name}: ${who.memory}`) : h('small', null, who.mate ? m.label : `from ${who.name}`)));
}
function renderYard() {
  const yard = $('#yard'); if (!yard) return; yard.replaceChildren(); const tz = tired();
  const galley = h('div', { class: 'zone galley', 'aria-label': 'Galley: crew cooking' }, h('span', { class: 'zone-l' }, 'galley'), h('div', { class: 'stove', html: '<svg viewBox="0 0 24 20" shape-rendering="crispEdges"><rect x="2" y="8" width="20" height="12" fill="#4a4f58"/><rect x="4" y="10" width="7" height="6" fill="#222"/><rect x="13" y="10" width="7" height="6" fill="#c0392b" class="fire"/><rect x="18" y="0" width="3" height="8" fill="#333"/><g class="smoke"><rect x="19" y="-3" width="1" height="2" fill="#aaa" opacity=".6"/></g></svg>' }));
  const pier = h('div', { class: 'zone pier', 'aria-label': 'Pier: idle crew' }, h('span', { class: 'zone-l' }, 'pier'));
  for (const c of FLEET.crew) {
    const name = crewName(c.id);
    if (c.state === 'working') galley.append(h('div', { class: `yc cook ${tz ? 'slow' : ''}`, title: `${name} cooking: ${c.task_title || c.task}`, 'aria-label': `${name} cooking ${c.task_title || c.task}`, html: spriteSVG(c.id, 'pot', { tired: tz }) }));
    else if (c.state === 'done') galley.append(h('div', { class: 'yc pass', title: `${name}: ready at the pass (${c.task_title || c.task})`, 'aria-label': `${name} ready at the pass`, html: spriteSVG(c.id, 'tray', { tired: tz, happy: true }) }));
    else if (c.state === 'idle') { const nap = hash(c.id) % 2 === 0; pier.append(h('div', { class: `yc idle ${nap ? 'nap' : 'lounge'}`, title: `${name}: ${nap ? 'napping' : 'lounging'} (idle)`, 'aria-label': `${name} idle`, html: spriteSVG(c.id, nap ? '' : 'mug', { sit: true, nap, tired: tz }) })); }
  }
  yard.append(galley, pier);
}
function stepUp(id) {
  const it = byId[id]; if (!it) return;
  if (st(id).awaiting) { toast(`${it.title}: away, waiting on ${mateFor(it).label}`); return; }
  S.current = id; st(id).read = true; save(); snd('slide'); renderAll();
}
// The sheet's row in focus is the item at the desk; moving rows keeps the papers still (renderDesk 'calm').
function focusRow(id) { const it = byId[id]; if (!it || st(id).awaiting) return; S.current = id; st(id).read = true; save(); renderAll(); }
function unpark(id) { const s = st(id); s.undeferAt = now(); save(); snd('slide'); stepUp(id); }
// A letter (or click) picked an option on `id`: on a sheet move to the next row, else just mark it on the slip.
function afterPick(id) {
  const it = byId[id]; snd('tick'); const group = bundleOf(it);
  if (group.length > 1) { const nx = group[group.indexOf(it) + 1]; if (nx && id === S.current) focusRow(nx.id); else if (id !== S.current) focusRow(id); else renderDesk(); }
  else quick.mark($('#desk-surface .paper.ask'), st(id).choice);
}
function sheetCount() { const it = byId[S.current]; const n = it ? bundleOf(it).filter(topicView.ticked).length : 0; const el = $('#desk-surface .sheet-n'); if (el) el.textContent = `${n} row${n === 1 ? '' : 's'}`; }
function pickLetter(i) {
  const it = byId[S.current]; if (!it || statusOf(it) !== 'open' || st(it.id).awaiting) return;
  const o = it.kind === 'decision' && it.options?.[i];
  if (!o) { toast(it.kind === 'decision' ? `No option ${quick.LETTERS[i]} here.` : 'Letters pick options on decisions; Space stamps this one.'); return; }
  st(it.id).choice = o.key; save(); afterPick(it.id);
}
function moveRow(d) { const it = byId[S.current]; if (!it) return; const g = bundleOf(it); const nx = g[g.indexOf(it) + d]; if (nx) focusRow(nx.id); }
// who is at the window, in order: the scene's line when a kind is shown, else the queue; nobody away on an ask
const walkOrder = () => (HS.byKind[S.prefs.filter] ? sceneLine(S.prefs.filter) : queueItems()).filter(i => !st(i.id).awaiting);
// after a stamp: the front of the line steps up (nobody when the scene is clear)
function next() { const f = walkOrder().find(i => i.id !== S.current); if (f) stepUp(f.id); else { S.current = null; save(); renderAll(); } }
// N: the one behind the visitor at the desk; past the end of the line, the next busy scene, else back to the front
function walk() {
  const ids = walkOrder().map(i => i.id); const nx = ids[ids.indexOf(S.current) + 1]; if (nx) return stepUp(nx);
  const k = HS.byKind[S.prefs.filter] && HS.nextBusy(S.prefs.filter, Object.fromEntries(HS.KINDS.map(x => [x, sceneLine(x).filter(i => !st(i.id).awaiting).length])));
  if (k && k !== S.prefs.filter) setScene(k); else if (ids.length && ids[0] !== S.current) stepUp(ids[0]);
}
// Back of the line (W): the visitor at the desk goes to the end of their scene's line and the next one steps up.
// Not a stamp: nothing is written to answers.jsonl; the order is desk state, cleared when the office opens a new day.
function backOfLine() {
  const it = byId[S.current]; if (!it || statusOf(it) !== 'open' || st(it.id).awaiting) { toast('Nobody at the desk.'); return; }
  st(it.id).back = Date.now(); const f = sceneLine(it.kind).find(i => !st(i.id).awaiting && i.id !== it.id);
  if (f) stepUp(f.id); else { save(); toast('Nobody else in line.'); renderAll(); }
}
