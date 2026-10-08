import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTopics, formatTopic } from '../src/topics.js';

const BIN = fileURLToPath(new URL('../bin/harbordeck.js', import.meta.url));

function setup() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-topics-'));
  const hd = (args, input) => {
    const r = spawnSync(process.execPath, [BIN, ...args], {
      cwd: home, input, encoding: 'utf8',
      env: { ...process.env, HARBORDECK_HOME: home, HARBORDECK_FROM: 'mate-a', HARBORDECK_PROJECT: 'demo', TZ: 'UTC' },
    });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };
  const item = (id) => JSON.parse(fs.readFileSync(path.join(home, 'items', `${id}.json`), 'utf8'));
  const notes = () => fs.readFileSync(path.join(home, 'notes.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  return { home, hd, item, notes };
}

test('-t and --rel on item verbs; kept on rewrite; bad slugs refused', () => {
  const { hd, item } = setup();
  assert.equal(hd(['decision', 'pr-1', 'Merge PR 1?', '--opt', 'merge+', '-t', 'checkout', '--rel', 'ci-1,ci-2', '--rel', 'ci-1']).code, 0);
  assert.equal(item('pr-1').topic, 'checkout');
  assert.deepEqual(item('pr-1').rel, ['ci-1', 'ci-2']);
  hd(['decision', 'pr-1', 'Merge PR 1 (v2)?', '--opt', 'merge+']);
  assert.equal(item('pr-1').topic, 'checkout');
  assert.deepEqual(item('pr-1').rel, ['ci-1', 'ci-2']);
  hd(['decision', 'pr-1', 'Merge PR 1 (v3)?', '--opt', 'merge+', '--topic', 'release']);
  assert.equal(item('pr-1').topic, 'release');
  assert.match(hd(['todo', 't', 'T', '-t', 'bad topic']).err, /bad topic/);
  assert.match(hd(['todo', 't', 'T', '--rel', 'ok,bad id']).err, /bad rel id/);
});

test('note: on an item (carries its topic), on a topic (first note creates it), refused when unplaceable', () => {
  const { hd, notes } = setup();
  hd(['todo', 'renew', 'Renew the key', '-t', 'keys']);
  assert.equal(hd(['note', 'renew', 'Vendor confirmed the new key works.']).out, 'ok note renew\n');
  assert.equal(hd(['note', 'topic:launch', 'Launch slips a week.', '-a', 'https://example.com/plan']).out, 'ok note topic:launch (new topic)\n');
  assert.equal(hd(['note', 'topic:launch', 'Second word on it.']).out, 'ok note topic:launch\n');
  const [a, b] = notes();
  assert.deepEqual({ ...a, at: 0 }, { item: 'renew', topic: 'keys', text: 'Vendor confirmed the new key works.', from: 'mate-a', at: 0 });
  assert.deepEqual(b.artifact, { type: 'link', url: 'https://example.com/plan' });
  assert.match(hd(['note', 'ghost', 'x']).err, /no such item .*hd gap/);
  assert.match(hd(['note', 'topic:', 'x']).err, /missing topic/);
  assert.match(hd(['note', 'renew']).err, /missing "<text>"/);
  assert.equal(notes().length, 3);
});

test('topics and topic: compact text for agents, json on request', () => {
  const { hd, home } = setup();
  hd(['decision', 'price', 'Pricing?', '--opt', 'a+', '--opt', 'b', '-t', 'launch', '-p', '2']);
  hd(['review', 'copy', 'Copy v2', '-t', 'launch']);
  hd(['answer', 'scan', 'Competitor scan', '-t', 'research', '--rel', 'price']);
  hd(['note', 'price', 'Hosting cost rechecked.']);
  fs.appendFileSync(path.join(home, 'answers.jsonl'), `${JSON.stringify({ id: 'copy', action: 'approve', note: '', at: 1791450000 })}\n`);
  hd(['resolve', 'copy']);
  const list = hd(['topics']).out.trim().split('\n');
  assert.equal(list.length, 2);
  assert.match(list.find((l) => l.startsWith('launch')), /^launch 1\/2 open, 1 note, last \d\d-\d\d \d\d:\d\d, rel research$/);
  const t = hd(['topic', 'launch']).out.trim().split('\n');
  assert.equal(t[0], 'topic launch: 1/2 open, 1 note; related: research');
  assert.equal(t[1], 'open price decision p2 "Pricing?"');
  assert.ok(t.some((l) => /^\d\d-\d\d \d\d:\d\d \+ review copy "Copy v2" by mate-a$/.test(l)));
  assert.ok(t.includes('10-08 09:00 you approve copy'));
  assert.ok(t.some((l) => /note price mate-a: Hosting cost rechecked\.$/.test(l)));
  assert.ok(t.some((l) => /resolved copy$/.test(l)));
  const j = JSON.parse(hd(['topic', 'launch', '--json']).out);
  assert.deepEqual(j.items, ['copy', 'price']);
  assert.equal(JSON.parse(hd(['topics', '--json']).out)[0].events, undefined);
  assert.match(hd(['topic', 'nope']).err, /no items or notes/);
  assert.match(hd(['ls']).out, /price decision p2 open #launch Pricing\?/);
});

test('batch takes -t, --rel and note lines; validate checks notes and rel', () => {
  const { hd, home, item } = setup();
  const r = hd(['batch'], ['answer r "Report" -t infra --rel gone', 'note r "First remark."', 'note topic:infra "Topic remark."'].join('\n'));
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out, 'ok answer r\nok note r\nok note topic:infra\n');
  assert.equal(item('r').topic, 'infra');
  assert.match(hd(['batch'], 'note r "x" --nope 1\n').err, /line 1: unknown flag --nope/);
  const v = hd(['validate']);
  assert.equal(v.code, 0);
  assert.match(v.out, /warn items\/r\.json: rel "gone" is not an item/);
  assert.match(v.out, /2 notes/);
  fs.appendFileSync(path.join(home, 'notes.jsonl'), '{"text":"orphan","at":1}\n');
  assert.match(hd(['validate']).out, /error notes\.jsonl:3: \$: matches none of anyOf/);
});

test('buildTopics: notes follow their item, rel links relate topics, events oldest first', () => {
  const items = [
    { id: 'a', kind: 'todo', title: 'A', topic: 'x', created: 30, status: 'open', rel: ['b'], thread: [{ from: 'm', text: 'r', at: 35 }] },
    { id: 'b', kind: 'answer', title: 'B', topic: 'y', created: 10, status: 'resolved', updated: 50 },
  ];
  const t = buildTopics({ items, answers: [{ id: 'b', action: 'file', at: 40 }], notes: [{ item: 'a', topic: 'old', text: 'n', at: 20 }, { topic: 'z', text: 'only', at: 5 }] });
  assert.deepEqual(Object.keys(t).sort(), ['x', 'y', 'z']);
  assert.deepEqual(t.x.related, ['y']);
  assert.deepEqual(t.x.events.map((e) => e.type), ['note', 'item', 'reply']);
  assert.deepEqual(t.y.events.map((e) => [e.type, e.at]), [['item', 10], ['answer', 40], ['resolved', 50]]);
  assert.equal(t.y.open, 0);
  assert.equal(t.z.notes, 1);
  assert.equal(formatTopic(t.z, items)[0], 'topic z: 0/0 open, 1 note');
});
