// Topics: what ties items, stamps, replies and notes on one subject together. Pure (no fs), shared by the CLI
// (`hd topics`, `hd topic`) and the app, whose main process adds buildTopics() to every snapshot.

// items: item objects; answers: answers.jsonl lines; notes: notes.jsonl lines.
// Returns { <slug>: { slug, items: [id], open, notes, last, related: [slug], events: [...] } }, events oldest first:
//   { at, type: 'item', item, kind, text, from, artifacts }   item created (text = title)
//   { at, type: 'reply', item, from, text }                  agent follow-up in the item's thread
//   { at, type: 'answer', item, action, key?, text }          the user's stamp, ask or comment
//   { at, type: 'note', item?, from?, text, artifact? }       an agent note on the item or topic
//   { at, type: 'resolved', item }                            item resolved
export function buildTopics({ items = [], answers = [], notes = [] }) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const topics = {};
  const get = (slug) => (topics[slug] ||= { slug, items: [], open: 0, notes: 0, last: 0, related: new Set(), events: [] });
  const add = (t, ev) => { t.events.push(ev); if (ev.at > t.last) t.last = ev.at; };
  for (const it of items) {
    if (!it.topic) continue;
    const t = get(it.topic);
    t.items.push(it.id);
    if (it.status !== 'resolved') t.open++;
    add(t, { at: it.created || 0, type: 'item', item: it.id, kind: it.kind, text: it.title, from: it.from, artifacts: (it.artifacts || []).length });
    for (const m of it.thread || []) add(t, { at: m.at, type: 'reply', item: it.id, from: m.from, text: m.text });
    if (it.status === 'resolved' && it.updated) add(t, { at: it.updated, type: 'resolved', item: it.id });
  }
  for (const a of answers) {
    const slug = byId.get(a.id)?.topic;
    if (slug) add(topics[slug], { at: a.at, type: 'answer', item: a.id, action: a.action, key: a.key, text: a.note || '' });
  }
  for (const n of notes) {
    // an item note follows the item if it moved topic since
    const slug = byId.get(n.item)?.topic || n.topic;
    if (!slug) continue;
    const t = get(slug);
    t.notes++;
    add(t, { at: n.at, type: 'note', item: n.item, from: n.from, text: n.text, artifact: n.artifact });
  }
  for (const it of items) {
    for (const r of it.rel || []) {
      const o = byId.get(r);
      if (it.topic && o?.topic && o.topic !== it.topic) { topics[it.topic].related.add(o.topic); topics[o.topic].related.add(it.topic); }
    }
  }
  for (const t of Object.values(topics)) { t.events.sort((a, b) => a.at - b.at); t.related = [...t.related].sort(); }
  return topics;
}

// Open topics first, then most recent activity.
export const sortTopics = (topics) => Object.values(topics).sort((a, b) => (!!b.open - !!a.open) || b.last - a.last || a.slug.localeCompare(b.slug));

const pad = (n) => String(n).padStart(2, '0');
export const stamp = (at) => { const d = new Date(at * 1000); return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const clip = (s, n = 160) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

// One line per topic, for agents: "<slug> <open>/<items> open, <n> notes, last <time>[, rel a b]".
export function formatTopics(topics) {
  return sortTopics(topics).map((t) => `${t.slug} ${t.open}/${t.items.length} open, ${t.notes} note${t.notes === 1 ? '' : 's'}, last ${t.last ? stamp(t.last) : '-'}${t.related.length ? `, rel ${t.related.join(' ')}` : ''}`);
}

// A compact timeline for agents: header, the open items, then every event oldest first.
export function formatTopic(t, items) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out = [`topic ${t.slug}: ${t.open}/${t.items.length} open, ${t.notes} note${t.notes === 1 ? '' : 's'}${t.related.length ? `; related: ${t.related.join(', ')}` : ''}`];
  const open = t.items.map((id) => byId.get(id)).filter((i) => i && i.status !== 'resolved')
    .sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3) || (a.created || 0) - (b.created || 0));
  for (const i of open) out.push(`open ${i.id} ${i.kind} p${i.priority ?? 3} "${clip(i.title, 100)}"`);
  for (const e of t.events) {
    const at = stamp(e.at);
    if (e.type === 'item') out.push(`${at} + ${e.kind} ${e.item} "${clip(e.text, 100)}"${e.from ? ` by ${e.from}` : ''}${e.artifacts ? ` (${e.artifacts} art)` : ''}`);
    else if (e.type === 'reply') out.push(`${at} reply ${e.item} ${e.from}: ${clip(e.text)}`);
    else if (e.type === 'answer') out.push(`${at} you ${e.action}${e.key ? ` ${e.key}` : ''} ${e.item}${e.text ? `: ${clip(e.text)}` : ''}`);
    else if (e.type === 'note') out.push(`${at} note${e.item ? ` ${e.item}` : ''}${e.from ? ` ${e.from}` : ''}: ${clip(e.text)}${e.artifact ? ` [${e.artifact.url || e.artifact.path}]` : ''}`);
    else if (e.type === 'resolved') out.push(`${at} resolved ${e.item}`);
  }
  return out;
}
