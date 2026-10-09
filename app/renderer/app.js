/* Harbor Deck renderer: the Harbor Desk prototype, fed live from the data directory through window.harbor.
   Renders only from CONTRACT items (+ optional priority/due/from/checks/thread), rules.json, and the optional
   fleet.json / quota.json snapshots. Every captain action is one JSONL line appended to answers.jsonl; see emit().
   app.js boots the desk: the first snapshot, the views, buttons and keys. The desk scripts index.html loads before it
   (desk-*.js and the rest) share its script scope and hold everything else. */
'use strict';

// views built at boot; the desk scripts call them
let topicView, harborScene, quick, scenes, attachView, phone, search, connectView, updates;
function renderPhoneButton() {
  const set = SNAP.settings || {}, key = HarborPhoneKeys.label(set.phoneShortcut), b = $('#btn-phone');
  const note = { taken: ' The system-wide shortcut is taken by another app: it works inside Harbor Deck only. Pick another in Settings.', invalid: ' The shortcut in Settings is not valid.' }[set.phoneKey] || '';
  b.title = `Ship phone: a quick order to a first mate${key ? ` (${key})` : ''}.${note}`; b.classList.toggle('key-off', !!note);
  if (key) b.setAttribute('aria-keyshortcuts', set.phoneShortcut.replace(/CommandOrControl|CmdOrCtrl/i, /Mac/.test(navigator.platform) ? 'Meta' : 'Control')); else b.removeAttribute('aria-keyshortcuts');
}
// header menu: one popover for everything that is not at-a-glance status; toggles (sound, music, theme, volume) keep it open
const menuEl = $('#menu'), menuBtn = $('#btn-menu');
const menuOpen = () => !menuEl.hidden;
function setMenu(on) {
  menuEl.hidden = !on; menuBtn.setAttribute('aria-expanded', String(on));
  if (on) { const r = menuBtn.getBoundingClientRect(); menuEl.style.top = `${Math.round(r.bottom + 4)}px`; menuItems()[0]?.focus(); } else if (menuEl.contains(document.activeElement)) menuBtn.focus();
}
const menuItems = () => [...menuEl.querySelectorAll('button.mi:not(:disabled), input.vol')];

(async () => {
if (!bridge) { document.body.textContent = 'Harbor Deck must run inside the desktop app (preload bridge missing).'; return; }
SNAP = await bridge.snapshot();
setData(SNAP);
try { S.prefs = Object.assign(freshPrefs(), JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')); } catch (e) { /* defaults */ }
delete S.prefs.tab; // the left tabs are gone (window only); an old saved tab is dropped
loadState();
// topics, notes and bundles (topic-view.js)
topicView = window.HarborTopicView({ h, modal, toast, fmtDate, fmtTime, KIND, ACTION_LABEL, prioChip, mateLabel, st, save, paper, statusOf, openItem, finishStamp, focus: id => { S.current = id; st(id).read = true; },
  data: () => ({ topics: SNAP.topics || {}, byId, notes: SNAP.notes || [] }), openArtifact: a => ['pr', 'link'].includes(artType(a)) ? openUrl(a.url) : openViewer(a) });
// the living harbor, the ship cat, the chandlery and the ships-out recap (harbor-scene.js)
harborScene = window.HarborScene({ h, G, modal, fmtDate, fmtTime, money, fun: () => S.fun, cash: () => S.cash, buy, equip });
// quick calls: letter keys, question sheet, lanes, weights, Later, take-all-recommended (quick-call.js)
quick = window.HarborQuickCall({ h, icon, KIND, st, save, paper, toast, modal, closeModal, prioChip, choiceOf, artType: a => artType(a), bodyArtifact: b => bodyArtifact(b),
  inspectOption: (e, it, o) => { if (document.body.classList.contains('inspect')) { e.preventDefault(); pickFact({ type: 'claim', label: o.label, anchor: { claim: o.label, option: o.key } }, e.currentTarget); } },
  preview: window.HarborOptionPreview({ h, modal, base: p => base(p), artType: a => artType(a), srcFor: a => srcFor(a), openArtifact: a => ['pr', 'link'].includes(artType(a)) ? openUrl(a.url) : openViewer(a) }),
  focusRow: id => focusRow(id), pick: id => afterPick(id), stampSheet: () => stamp('approve'), sheetCount: () => sheetCount(), ticked: m => topicView.ticked(m) });
// scenes (scene-view.js): one per kind, a figure per open item; the filter chips are the scene index
scenes = HS.view({ h, sprite: it => (w => spriteSVG(w.id, it.kind, { mate: w.mate, reg: w.reg, ...face(w), tired: tired(), sweat: impatience(it) >= 1 }))(whoBrings(it)), who: it => whoBrings(it).name,
  age: it => age(now() - it.created), away: it => st(it.id).awaiting, impatience: it => impatience(it), flagged: it => flaggedCount(it), coat: it => G.regular(it.project).coat, now, current: () => S.current,
  open: id => stepUp(id), flip: d => setScene(HS.step(sceneKind(), d)), jump: k => setScene(k), cat: (bell, nap) => harborScene.cat(nap ? 'on-pier' : 'on-visitor', bell, nap) });
$('#stow-box').addEventListener('click', () => { if ($('#stow-view').hidden) openStowView(); else closeStowView(); });
$('#parked-btn').addEventListener('click', () => { if ($('#parked-view').hidden) openParkedView(); else closeParkedView(); });
document.addEventListener('pointerdown', e => {
  if (!$('#stow-view').hidden && !e.target.closest('#stow-view, #stow-box')) closeStowView();
  if (!$('#parked-view').hidden && !e.target.closest('#parked-view, #parked-btn')) closeParkedView();
});
window.addEventListener('resize', () => { if (!$('#stow-view').hidden) placeStowView(); if (!$('#parked-view').hidden) placeParkedView(); });
// Note slips (needs-work, ask, mismatch) with their image tray live in attach-view.js (attachView.slip).
attachView = window.HarborAttach({ h, bridge, toast, modal, closeModal, fileFor: p => fileFor(p), openViewer: a => openViewer(a), markup: window.HarborMarkup({ h, bridge, toast }) });
bridge.onUpdate(snap => { if (typing()) { deferred = snap; return; } applySnapshot(snap); });
document.addEventListener('focusout', () => setTimeout(() => { if (deferred && !typing()) { const s = deferred; deferred = null; applySnapshot(s); } }, 50));
syncItems(null);

// ------------------------------------------------------------ ship phone (phone-view.js): a quick order to a first mate from anywhere
let phoneDraft = '';
phone = window.HarborPhone({ h, snd, mates: () => FLEET.firstmates, settings: () => SNAP.settings || {}, lastMate: () => S.prefs.lastMate,
  sprite: id => spriteSVG(id, 'slip', { mate: true, tired: tired() }), draft: { get: () => phoneDraft, set: v => { phoneDraft = v; } }, send: sendOrder, queue: queueOrder, targets: () => HarborAddTo.targets(byId[S.current] && statusOf(byId[S.current]) === 'open' ? byId[S.current] : null, tickets()), tray: attachView.tray({ snap: true }), clockEpoch: nextClockEpoch,
  resetNote: () => SCHED ? [SCHED.next_reset ? `next reset ${fmtTime(SCHED.next_reset)} (${dur(SCHED.next_reset - now())})` : null, !SCHED.enabled ? 'scheduler is off' : null].filter(Boolean).join(' · ') : 'scheduler unavailable' });
$('#btn-phone').onclick = () => phone.toggle();
bridge.onPhone(how => how === 'toggle' ? phone.toggle() : phone.open());

bridge.onMenu(async what => {
  if (what === 'settings') openSettings();
  else if (what === 'demo-on' || what === 'demo-off') { commitPending(); closeModal(); applySnapshot(await bridge.demo(what === 'demo-on')); }
});

const tickClock = () => { $('#clock').textContent = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); };
tickClock(); setInterval(tickClock, 1000); let parkedSig = ITEMS.filter(i => statusOf(i) === 'later').length;
setInterval(() => { const n = ITEMS.filter(i => statusOf(i) === 'later').length; if (n !== parkedSig) { parkedSig = n; if (!typing()) renderAll(true); } renderStaminaMini(); if (!S.prefs.plain) { renderHarbor(); renderRail(); } }, 30000);
$('#btn-next').onclick = walk;
$('#btn-inspect').onclick = () => setInspect(!document.body.classList.contains('inspect'));
$('#btn-shop').onclick = () => harborScene.openChandlery();
$('#btn-orders').onclick = () => $('#orders').classList.contains('open') ? closeDrawers() : openDrawer('orders');
$('#btn-vault').onclick = () => $('#vault').classList.contains('open') ? closeDrawers() : openDrawer('vault');
$('#btn-log').onclick = () => $('#agentlog').classList.contains('open') ? closeDrawers() : openDrawer('agentlog');
// search (search-view.js): Cmd/Ctrl+K over every item, topic and note; open items first, in queue order
search = window.HarborSearchView({ h, mount: el => { closeModal(); $('#modal-root').append(el); }, open: e => {
  if (e.kind === 'item') openItem(e.id);
  else if (e.kind === 'topic') topicView.open(e.slug);
  else if (e.item && byId[e.item]) openItem(e.item); else if (e.slug) topicView.open(e.slug);
}, entries: () => {
  const order = { open: 0, later: 1, resolved: 2 };
  const items = ITEMS.slice().sort((a, b) => (order[statusOf(a)] ?? 3) - (order[statusOf(b)] ?? 3) || urgency(a, b)).map(it => {
    const status = statusOf(it);
    return { kind: 'item', id: it.id, label: status === 'open' ? KIND[it.kind] : status === 'later' ? 'Later' : 'Filed', title: it.title, boost: status === 'open' ? 6 : 0,
      sub: [it.topic && `#${it.topic}`, it.project, status === 'resolved' ? 'resolved' : status === 'later' ? 'parked' : null].filter(Boolean).join(' · '),
      keys: [it.id, it.topic, it.project, it.stream, ...(it.options || []).map(o => o.label)].filter(Boolean).join(' '), text: it.summary };
  });
  const topics = Object.values(SNAP.topics || {}).sort((a, b) => b.last - a.last).map(t => ({ kind: 'topic', slug: t.slug, label: 'Topic', title: `#${t.slug}`, boost: 3,
    sub: `${t.items.length} item${t.items.length === 1 ? '' : 's'} · ${t.notes} note${t.notes === 1 ? '' : 's'}`, keys: [t.slug, ...t.related].join(' ') }));
  const notes = (SNAP.notes || []).slice().reverse().map(n => { const slug = byId[n.item]?.topic || n.topic; return { kind: 'note', item: n.item, slug, label: 'Note',
    title: n.text.length > 140 ? n.text.slice(0, 139) + '…' : n.text, sub: [byId[n.item]?.title || n.item, slug && `#${slug}`, n.at && fmtDate(n.at)].filter(Boolean).join(' · '),
    keys: [n.item, slug].filter(Boolean).join(' '), text: n.text }; });
  return [...items, ...topics, ...notes];
} });
$('#btn-search').onclick = () => search.open();
$('#btn-ledger').onclick = openLedger;
$('#btn-settings').onclick = openSettings;
menuBtn.onclick = () => setMenu(!menuOpen());
menuEl.addEventListener('click', e => { const b = e.target.closest('button.mi'); if (b && !['btn-sound', 'btn-music', 'btn-theme'].includes(b.id)) setMenu(false); });
menuEl.addEventListener('keydown', e => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const its = menuItems(), i = its.indexOf(document.activeElement); if (e.target.matches('input')) return; e.preventDefault();
  its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length]?.focus();
});
document.addEventListener('pointerdown', e => { if (menuOpen() && !menuEl.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false); });
$('#sched-chip').onclick = () => phone.open();
$('#stamina-cluster').onclick = () => { if (window.innerWidth <= 860) { S.prefs.staminaOpen = !S.prefs.staminaOpen; save(); renderStaminaMini(); return; } modal('ledger stamina-modal', 'Stamina', staminaPanel()); };
$('#cash').onclick = () => harborScene.openChandlery();
$('#btn-plain').onclick = () => { S.prefs.plain = !S.prefs.plain; save(); setInspect(false); renderAll(); };
$('#btn-sound').onclick = () => { S.prefs.sound = !S.prefs.sound; save(); applyPrefs(); snd('ding'); };
$('#btn-music').onclick = () => { S.prefs.music = !S.prefs.music; save(); applyPrefs(); try { S.prefs.music ? musicStart() : musicStop(); } catch (e) { toast('Audio unavailable'); } };
$('#music-vol').oninput = e => { S.prefs.musicVol = +e.target.value; save(); musicVolume(); };
$('#btn-theme').onclick = () => { S.prefs.theme = { auto: 'light', light: 'dark', dark: 'auto' }[S.prefs.theme]; save(); applyPrefs(); };
$('#btn-log-copy').onclick = () => navigator.clipboard?.writeText(jsonl()).then(() => toast('answers.jsonl copied'));
$('#btn-log-export').onclick = () => { const a = h('a', { href: URL.createObjectURL(new Blob([jsonl()], { type: 'application/x-ndjson' })), download: 'answers.jsonl' }); a.click(); };
$('#tray-handle').onclick = () => toggleTray();
$('#rail').addEventListener('wheel', e => { const rail = e.currentTarget; if (rail.scrollWidth <= rail.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; e.preventDefault(); rail.scrollLeft += e.deltaY; }, { passive: false });
$('#rail').addEventListener('scroll', railCues);
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeDrawers);
document.querySelectorAll('#stamps .stamp').forEach(b => b.onclick = e => stamp(b.dataset.verdict, e.shiftKey, b.dataset.verdict === 'later' && !e.shiftKey)); // the Later stamp opens the Later slip
document.addEventListener('keydown', deskKeys);
window.addEventListener('beforeunload', commitPending);
window.addEventListener('resize', () => { renderStaminaMini(); if (!S.prefs.plain) { renderDesk(); railCues(); } });
// the stamp tray opening or closing resizes the desk: lay the papers out again once it settles
$('#stamps').addEventListener('transitionend', e => { if (e.target === e.currentTarget && e.propertyName === 'width' && !S.prefs.plain) { renderDesk(); railCues(); } });

renderAll();
const startDay = () => { if (!S.dayOpen) morning(); else { markDay(); if (!S.current) next(); } };
// first run (an empty desk, setup never finished): Connect an agent opens first, then the usual morning
connectView = window.HarborConnect({ h, modal, toast, bridge, firstRun: SNAP.firstRun, then: startDay }); updates = window.HarborUpdates({ h, toast, bridge });
if (S.prefs.music) { const once = () => { try { musicStart(); } catch (e) {} document.removeEventListener('pointerdown', once); }; document.addEventListener('pointerdown', once); }
})();
