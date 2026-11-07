/* Ticket rail: the asks and orders the captain sent, with their replies.
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

// ------------------------------------------------------------ ticket rail (derived from answers.jsonl + item threads)
let railFocus = 0, railSeen = null; // railSeen: the tickets on the last render (a ticket just sent scrolls into view)
function tickets() {
  const out = [];
  for (const a of S.answers) {
    if (!['ask', 'needs-work', 'request'].includes(a.action)) continue;
    const key = `${a.id}:${a.at}`; if (S.tickets.done[key]) continue;
    let title, reply = null, item = null;
    if (a.action === 'request') {
      // the reply is the item the agent wrote under the order's id: its summary, else its latest message (`hd reply`)
      title = `Order to ${mateLabel(a.to)}`; item = byId[a.id] || null;
      const last = item && (item.thread || []).filter(m => m.from !== 'captain').sort((x, y) => x.at - y.at).pop();
      reply = item ? { from: last?.from || mateFor(item).label, text: item.summary || last?.text || item.title, at: last?.at || item.created } : null;
    }
    else { item = byId[a.id]; title = item?.title || a.id; const th = item?.thread || []; reply = th.filter(m => m.at >= a.at && m.from !== 'captain').sort((x, y) => x.at - y.at)[0] || null; }
    out.push({ key, a, title, reply, item, seen: !!S.tickets.seen[key] });
  }
  for (const p of queuedRequests()) out.push({ key: `queued:${p.id}`, a: { id: p.request.id, action: 'request', note: p.request.note, to: p.request.to, at: p.queued_at }, title: `Order to ${mateLabel(p.request.to)}`, reply: null, item: null, queued: p, seen: true });
  // unread replies first, the newest of them first (T focuses it), then read replies, waiting, queued
  return out.sort((x, y) => ((y.reply && !y.seen) - (x.reply && !x.seen)) || (x.reply && !x.seen ? y.reply.at - x.reply.at : 0) || ((!!y.reply) - (!!x.reply)) || (!!x.queued - !!y.queued) || x.a.at - y.a.at);
}
function renderRail(ring) {
  const rail = $('#rail'); if (!rail) return; const list = tickets(); const t0 = now();
  rail.replaceChildren(h('span', { class: 'rail-label', title: 'Things you asked for (T)' }, 'Tickets'));
  const fresh = railSeen ? list.filter(t => !railSeen.has(t.key) && t0 - t.a.at < 30) : []; railSeen = new Set(list.map(t => t.key));
  if (!list.length) { rail.append(h('span', { class: 'rail-empty' }, 'Asks and orders you send clip here')); rail.dataset.count = 0; return; }
  list.forEach((t, i) => {
    const unread = t.reply && !t.seen;
    const mate = ticketMate(t), ms = !t.queued && !t.reply ? mateState(mate) : '';
    const state = t.queued ? queuedLabel(t.queued) : t.reply ? (unread ? 'new reply' : 'replied') : 'awaiting reply ' + age(t0 - t.a.at) + (ms ? `, ${mateLabel(mate)} ${ms}` : '');
    rail.append(h('button', { class: `ticket ${t.queued ? 'queued' : t.reply ? 'replied' : 'waiting'} ${unread ? 'new' : ''} ${t.a.action}`, dataset: { key: t.key, i }, tabindex: i === railFocus ? 0 : -1, 'aria-label': `${t.title}: ${t.a.note}. ${state}`, onclick: e => openTicket(t, e.currentTarget), onfocus: () => { railFocus = i; } },
      h('span', { class: 'tk-head' }, h('span', { class: `tk-kind ${t.a.action}` }, { ask: 'ask', 'needs-work': 'rework', request: 'order' }[t.a.action]), h('span', { class: 'tk-title' }, t.title), t.a.rule || t.queued?.request?.rule ? h('span', { class: 'tk-pin', title: Object.values(RULES).some(r => r.answer === t.a.id) ? 'Standing order: recorded' : 'Standing order: waiting for your first mate to record it', 'aria-label': 'standing order' }, '📌') : null, unread ? h('span', { class: 'tk-badge' }, '1') : null),
      h('span', { class: 'tk-note' }, t.a.note), attachView.badge(t.a.attachments),
      h('span', { class: 'tk-foot' }, t.queued ? `⏳ ${state}` : t.reply ? (unread ? '● new reply' : '✓ replied') : [h('span', { class: 'tk-dot' }), ` awaiting reply · ${age(t0 - t.a.at)}`, ms ? h('span', { class: `tk-mate ${FLEET.firstmates.find(f => f.id === mate)?.state}` }, ` · ${ms}`) : null], t.item && st(t.item.id).read && t.item.id !== S.current && changesOf(t.item) ? h('span', { class: 'upd' }, 'updated') : null)));
  });
  rail.dataset.count = list.filter(t => t.reply && !t.seen).length;
  if (ring) { const first = rail.querySelector('.ticket.new'); if (first) { first.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } }
  else if (fresh.length) rail.querySelector(`.ticket[data-key="${CSS.escape(fresh.at(-1).key)}"]`)?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  railCues();
}
// An overflowing rail shows how many tickets hide off each edge (click to scroll there); the wheel scrolls it sideways.
function railCues() {
  const rail = $('#rail'); if (!rail) return;
  // the gutters first (they narrow the rail), then count what still hides beyond each edge
  for (let i = 0; i < 2; i++) { const more = rail.scrollWidth - rail.clientWidth; rail.classList.toggle('cue-l', more > 4 && rail.scrollLeft > 4); rail.classList.toggle('cue-r', more > 4 && rail.scrollLeft < more - 4); }
  const r = rail.getBoundingClientRect(); let left = 0, right = 0;
  for (const t of rail.querySelectorAll('.ticket')) { const b = t.getBoundingClientRect(); if (b.right > r.right + 4) right++; else if (b.left < r.left - 4) left++; }
  for (const [id, n, dir] of [['#rail-left', left, -1], ['#rail-right', right, 1]]) {
    const c = $(id); c.hidden = !n || !rail.classList.contains(dir < 0 ? 'cue-l' : 'cue-r'); c.textContent = dir < 0 ? `‹ ${n}` : `${n} more ›`; c.title = `${n} ticket${n === 1 ? '' : 's'} ${dir < 0 ? 'before' : 'after'} these`;
    c.onclick = () => { // a page: the ticket cut at this edge moves to the opposite edge, whole
      const r = rail.getBoundingClientRect(), ts = [...rail.querySelectorAll('.ticket')], cut = dir > 0 ? ts.find(t => t.getBoundingClientRect().right > r.right + 4) : ts.filter(t => t.getBoundingClientRect().left < r.left - 4).pop();
      // 4: inside the 8px gap, so the neighbour stays fully off that edge; paging back from the end, the right cue's gutter
      // is about to take its room, so the ticket lands clear of it
      const gutter = dir < 0 && !rail.classList.contains('cue-r') ? parseFloat(getComputedStyle(rail).getPropertyValue('--cue-w')) || 78 : 0;
      const b = cut?.getBoundingClientRect(); if (b) rail.scrollBy({ left: dir > 0 ? b.left - r.left - 4 : b.right - r.right + gutter + 4, behavior: 'smooth' });
    };
  }
}
// the first mate a ticket waits on: the order's addressee, else whoever raised the item
const ticketMate = t => t.a.action === 'request' ? t.a.to : t.item ? mateFor(t.item).id : FLEET.firstmates[0]?.id;
function openTicket(t, el) {
  document.querySelector('.tk-pop')?.remove();
  S.tickets.seen[t.key] = true; save(); renderRail();
  // the rail re-renders (and may re-sort): anchor under the ticket as it stands now, not the replaced element
  const r = ($('#rail').querySelector(`.ticket[data-key="${CSS.escape(t.key)}"]`) || el).getBoundingClientRect();
  const pop = h('div', { class: 'tk-pop', role: 'dialog', 'aria-label': 'Ticket' },
    h('div', { class: 'tk-q' }, h('span', { class: 'who' }, `you · ${fmtDate(t.a.at)} ${fmtTime(t.a.at)}`), t.a.note, attachView.thumbs(t.a.attachments)),
    // what you added to it since (phone Add to…): your words stay on the ticket
    ...S.answers.filter(x => x.id === t.a.id && x.action === 'comment' && x.at >= t.a.at).map(x => h('div', { class: 'tk-q' }, h('span', { class: 'who' }, `you added · ${fmtDate(x.at)} ${fmtTime(x.at)}`), x.note, attachView.thumbs(x.attachments))),
    t.queued ? h('div', { class: 'tk-r dim', title: `Held in the scheduler; it goes to ${mateLabel(t.a.to)} by itself` }, `⏳ ${queuedLabel(t.queued)} · to ${mateLabel(t.a.to)}`)
      : t.reply ? h('div', { class: 'tk-r' }, h('span', { class: 'who' }, `${mateLabel(t.reply.from || 'first mate')} · ${fmtDate(t.reply.at)} ${fmtTime(t.reply.at)}`), t.reply.text) : h('div', { class: 'tk-r dim' }, `Still with ${t.a.action === 'request' ? mateLabel(t.a.to) : (t.item ? mateFor(t.item).label : 'the first mate')}${mateState(ticketMate(t)) ? ` (${mateState(ticketMate(t))})` : ''}. Waiting ${age(now() - t.a.at)}.`),
    t.queued ? h('div', { class: 'row' }, h('button', { class: 'pbtn ghost', onclick: async () => { pop.remove(); const r = await bridge.cancelScheduled(t.queued.id); if (r.snapshot) applySnapshot(r.snapshot); if (!r.ok) toast('Already sent', 'warn'); } }, 'Withdraw'), h('button', { class: 'pbtn ghost', onclick: () => pop.remove() }, 'Close')) :
    h('div', { class: 'row' }, t.item && statusOf(t.item) === 'open' ? h('button', { class: 'pbtn', onclick: () => { pop.remove(); if (S.prefs.plain) { S.prefs.plain = false; save(); } stepUp(t.item.id); } }, 'Open item') : null, h('button', { class: 'pbtn ghost', onclick: () => { S.tickets.done[t.key] = true; save(); pop.remove(); snd('flip'); renderRail(); } }, 'Done'), h('button', { class: 'pbtn ghost', onclick: () => pop.remove() }, 'Close')));
  document.body.append(pop);
  pop.style.left = `max(8px, min(${Math.round(r.left)}px, calc(100vw - 328px)))`; pop.style.top = (r.bottom + 6) + 'px'; // left stays in the window if it shrinks
  pop.querySelector('.pbtn')?.focus();
}
// Space on an item whose agent reply the captain has not opened yet: show that reply instead of deciding (once).
function openUnreadReply() {
  const it = byId[S.current]; if (!it || statusOf(it) !== 'open') return false;
  const t = tickets().find(x => x.a.action !== 'request' && x.item?.id === it.id && x.reply && !x.seen); if (!t) return false;
  const el = document.querySelector(`#rail .ticket[data-key="${CSS.escape(t.key)}"]`); el?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  openTicket(t, el || $('#rail')); toast('New reply: read it, then Space stamps.'); return true;
}
function railKeys(e) {
  const btns = [...document.querySelectorAll('#rail .ticket')]; if (!btns.length) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); railFocus = (railFocus + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length; btns.forEach((b, i) => b.tabIndex = i === railFocus ? 0 : -1); btns[railFocus].focus(); snd('tick'); }
}
