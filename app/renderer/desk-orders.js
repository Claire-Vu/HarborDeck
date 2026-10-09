/* Orders to first mates (sent now or queued in the scheduler), the stamina panel and the top-bar usage chips.
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

// ------------------------------------------------------------ requests (orders to firstmates), crew flavour, stamina
// One order line, from the ship phone or plain mode. false when answers.jsonl could not be written.
// onto: an addition to running work ("Add to…" on the phone): a comment on that id instead of a new order.
// rule: "Remember this", a standing order (see standing orders).
function sendOrder(note, to, attachments, onto, rule) {
  const n = S.answers.length;
  emit({ ...(onto ? { id: onto, action: 'comment' } : { id: `req-${now()}-${hash(note) % 1000}`, action: 'request', to }), note, attachments, ...(rule ? { rule: true } : {}) }); if (S.answers.length === n) return false;
  S.prefs.lastMate = to; save(); snd('ding');
  if (S.prefs.plain) renderPlain(); else renderRail();
  return true;
}
// A queued order waits in the scheduler and goes out by itself (harbordeck tick), no prompt needed.
// when: 'reset' (after the next usage-limit reset) or an epoch. false when the scheduler refused it.
async function queueOrder(note, to, when, attachments, rule) {
  const r = await bridge.schedule({ when, request: { id: `req-${now()}-${hash(note) % 1000}`, note, to, attachments, ...(rule ? { rule: true } : {}) } });
  if (!r.ok) { toast(`Could not queue: ${r.error}`, 'warn'); return false; }
  S.prefs.lastMate = to; save(); snd('slide');
  // the scheduler keeps the Mac awake only in the last hour before a clock time (cli/src/keep-awake.js AWAKE_LEAD)
  if (typeof when === 'number' && when - now() > 3600) toast(`Queued for ${fmtTime(when)}. The Mac is kept awake from ${fmtTime(when - 3600)}; if it sleeps through, the order goes out when it wakes.`);
  applySnapshot(r.snapshot); return true;
}
function staminaPanel() {
  const box = h('div', { class: 'stamina' }, h('h3', { class: 'oh' }, 'Stamina'));
  const views = staminaViews();
  if (!views.length) { box.append(h('p', { class: 'legend' }, 'No usage readings yet (quota.json or the Claude Code status line).')); return box; }
  for (const v of views) {
    const left = v.left == null ? '?' : `${v.left}% left`;
    const when = `${fmtTime(v.resets)}${v.in > 20 * 3600 ? ' ' + fmtDate(v.resets) : ''}`;
    box.append(h('div', { class: `sub ${v.level}${v.model ? ' model' : ''}${v.stale ? ' stale' : ''}`, title: staminaTitle(v) }, h('div', { class: 'sub-head' }, h('span', null, v.label), h('span', { class: 'left' }, left)),
      h('div', { class: 'meter' }, h('span', { style: `width:${v.left || 0}%` })),
      h('div', { class: 'sub-foot' }, v.reset ? `reset at ${when}, no reading since` : `resets in ${ST.dur(v.in)} (${when})`,
        v.runsOut ? h('span', { class: 'warn' }, ` · runs out ~${staminaWhen(v.runsOut)} at this pace`) : null,
        ` · ${v.source === 'statusline' ? 'status line' : 'quota.json'}, ${v.age == null ? 'time unknown' : ST.ago(v.age)}`, v.stale ? h('span', { class: 'warn' }, ' (stale)') : null,
        v.left != null && v.left < 10 ? ' · nearly empty, crew will stall' : v.left != null && v.left < 25 ? ' · running low, crew yawning' : '')));
  }
  return box;
}
function renderSchedChip() {
  const c = $('#sched-chip'); const v = window.HarborSchedule.chip(SCHED, queuedRequests().length, now(), { fmtTime, fmtDate });
  c.hidden = !v; if (!v) return;
  c.classList.toggle('off', v.off); c.replaceChildren(h('span', null, v.text)); c.title = v.title;
}
// top bar, readable on its own: per provider ("Claude") one chip per window ("5h", "week", per-model windows such
// as "Fable · week" set apart), each with a bar and % LEFT, countdown to reset, a run-out warning when the pace would
// empty it first, and "stale" for an old reading; the hover spells out every number. The most urgent window comes
// first (its provider leads); when the bar is short of room the least urgent chips fold into one "+N" (fitStamina).
function renderStaminaMini() {
  renderSchedChip();
  const views = ST.byUrgency(staminaViews()); const m = ST.lowest(views); const box = $('#stamina-cluster'); box.replaceChildren();
  if (!views.length) { box.append(h('span', { class: 'dim' }, 'no usage data')); box.className = 'stamina-cluster'; document.body.classList.remove('tired'); return; }
  const groups = new Map(); for (const v of views) { if (!groups.has(v.name)) groups.set(v.name, []); groups.get(v.name).push(v); }
  for (const [name, vs] of groups) box.append(h('span', { class: 'ms-group' }, h('span', { class: 'ms-prov' }, name),
    vs.map(v => h('span', { class: `mini-sub ${v.level}${v.model ? ' model' : ''}${v.secs >= 86400 ? ' long' : ''}${v.stale ? ' stale' : ''}`, dataset: { rank: views.indexOf(v) }, title: staminaTitle(v), 'aria-label': `${v.label}: ${v.left == null ? 'unknown' : v.left + '% left'}` },
      h('span', { class: 'ms-name' }, v.model ? `${v.model} · ${v.win}` : v.win),
      h('span', { class: 'ms-bar', 'aria-hidden': 'true' }, h('i', { style: `width:${v.left || 0}%` })),
      h('span', { class: 'ms-pct' }, v.left == null ? '?' : `${v.left}%`),
      h('span', { class: 'ms-time' }, v.reset ? 'reset' : `↻ ${ST.dur(v.in)}`),
      v.runsOut ? h('span', { class: 'ms-warn' }, `⚠ out ~${staminaWhen(v.runsOut)}`) : null,
      v.stale ? h('span', { class: 'ms-stale' }, 'stale') : null))));
  box.className = `stamina-cluster ${m != null && m < 10 ? 'empty' : m != null && m < 25 ? 'low' : ''}${S.prefs.staminaOpen ? ' expanded' : ''}`;
  document.body.classList.toggle('tired', m != null && m < 20);
  fitStamina(box);
}
// Never clip a chip: while the cluster is wider than its room, fold the least urgent chip into a "+N" chip that names
// what it holds (the most urgent one always stays). An expanded cluster (narrow window, clicked open) wraps instead.
function fitStamina(box) {
  if (box.classList.contains('expanded')) return;
  const subs = [...box.querySelectorAll('.mini-sub')].sort((a, b) => b.dataset.rank - a.dataset.rank); const folded = [];
  const more = h('span', { class: 'ms-more' }); box.append(more);
  const over = () => box.scrollWidth > box.clientWidth + 1;
  more.hidden = true;
  while (over() && subs.length > 1) {
    const sub = subs.shift(); sub.classList.add('folded'); folded.unshift(sub.getAttribute('aria-label'));
    const g = sub.closest('.ms-group'); g.classList.toggle('folded', !g.querySelector('.mini-sub:not(.folded)'));
    more.hidden = false; more.textContent = `+${folded.length}`; more.title = folded.join('\n'); more.setAttribute('aria-label', `${folded.length} more: ${folded.join('; ')}`);
  }
  if (!folded.length) more.remove();
}
