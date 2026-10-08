// CLI verbs for topics and notes: note, topics, topic (see docs/CONTRACT.md#topics-and-notes).
import fs from 'node:fs';
import path from 'node:path';
import { parseFlags } from './args.js';
import { SLUG } from './store.js';
import { validate } from './schema.js';
import { parseArt } from './artifacts.js';
import { buildTopics, formatTopics, formatTopic, sortTopics } from './topics.js';

const fail = (msg) => { throw new Error(msg); };
const now = () => Math.floor(Date.now() / 1000);
function checkSlug(v, what) {
  if (!v) fail(`missing ${what}`);
  if (!SLUG.test(v)) fail(`bad ${what} "${v}" (letters, digits, . _ -; max 128)`);
  return v;
}

function loadDeck(store) {
  const items = [];
  for (const name of store.listItems()) {
    try { const it = JSON.parse(fs.readFileSync(path.join(store.items, name), 'utf8')); if (it?.id) items.push(it); } catch { /* validate reports it */ }
  }
  return { items, answers: store.readJsonl(store.answers), notes: store.readJsonl(store.notes) };
}

export const NOTE_FLAGS = { art: { alias: 'a' }, from: { alias: 'f' } };
// hd note <id|topic:slug> "<text>" [-a <artifact>]: one line in notes.jsonl, kept with the item or topic.
function cmdNote(argv, ctx) {
  const { pos, flags } = parseFlags(argv, NOTE_FLAGS);
  const [target, text, ...extra] = pos;
  if (!target) fail('note: missing <id|topic:slug>');
  if (!text) fail(`note ${target}: missing "<text>"`);
  if (extra.length) fail(`note ${target}: unexpected "${extra[0]}" (quote the text)`);
  const note = {};
  const m = /^topic:(.*)$/s.exec(target);
  if (m) note.topic = checkSlug(m[1], 'topic');
  else {
    const item = ctx.store.readItem(checkSlug(target, 'id'));
    if (!item) fail(`note ${target}: no such item (use topic:<slug>, or hd gap when it fits nowhere)`);
    note.item = target;
    if (item.topic) note.topic = item.topic;
  }
  note.text = text;
  if (flags.art) note.artifact = parseArt(flags.art, ctx);
  const from = flags.from || ctx.env.HARBORDECK_FROM;
  if (from) note.from = from;
  note.at = now();
  const errs = validate('note', note);
  if (errs.length) fail(`note ${target}: ${errs.join('; ')}`);
  const fresh = note.topic && !buildTopics(loadDeck(ctx.store))[note.topic];
  ctx.store.appendLine(ctx.store.notes, note);
  ctx.out(`ok note ${target}${fresh ? ' (new topic)' : ''}`);
}

function cmdTopics(argv, ctx) {
  const { pos, flags } = parseFlags(argv, { json: { bool: true } });
  if (pos.length) fail(`topics: unexpected "${pos[0]}" (hd topic <slug> shows one)`);
  const topics = buildTopics(loadDeck(ctx.store));
  if (flags.json) { ctx.out(JSON.stringify(sortTopics(topics).map(({ events, ...t }) => t))); return; }
  const lines = formatTopics(topics);
  ctx.out(lines.length ? lines.join('\n') : 'no topics yet (hd <kind> ... -t <topic>, or hd note topic:<slug> "...")');
}

function cmdTopic(argv, ctx) {
  const { pos, flags } = parseFlags(argv, { json: { bool: true } });
  const [slug, ...extra] = pos;
  checkSlug(slug, 'topic');
  if (extra.length) fail(`topic: unexpected "${extra[0]}"`);
  const deck = loadDeck(ctx.store);
  const t = buildTopics(deck)[slug];
  if (!t) fail(`topic ${slug}: no items or notes yet`);
  if (flags.json) ctx.out(JSON.stringify(t));
  else ctx.out(formatTopic(t, deck.items).join('\n'));
}

export const TOPIC_COMMANDS = { note: cmdNote, topics: cmdTopics, topic: cmdTopic };
