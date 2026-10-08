import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/harbordeck.js', import.meta.url));
const SAMPLE = fileURLToPath(new URL('../../docs/sample-data', import.meta.url));

function setup() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-test-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-cwd-'));
  const hd = (args, input) => {
    const r = spawnSync(process.execPath, [BIN, ...args], {
      cwd, input, encoding: 'utf8',
      env: { ...process.env, HARBORDECK_HOME: home, HARBORDECK_FROM: 'agent-a', HARBORDECK_PROJECT: 'demo' },
    });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };
  const item = (id) => JSON.parse(fs.readFileSync(path.join(home, 'items', `${id}.json`), 'utf8'));
  const append = (...lines) => fs.appendFileSync(path.join(home, 'answers.jsonl'), lines.map((l) => `${JSON.stringify(l)}\n`).join(''));
  return { home, cwd, hd, item, append };
}

test('decision: options, artifacts, checks, priority, due', () => {
  const { cwd, hd, item } = setup();
  fs.writeFileSync(path.join(cwd, 'clip.mp4'), '');
  const r = hd(['decision', 'pr24', 'Merge PR 24?', '-s', 'Bundles four PRs.', '--opt', 'merge+', '--opt', 'hold=Hold for now',
    '-a', 'https://github.com/o/r/pull/24', '-a', 'clip.mp4', '-a', 'report:notes.txt', '-p', '1', '-d', '+2d',
    '--ok', 'no-merge-without-word:held', '--flag', 'cutout-width:measured 27%', '-r', 'budget']);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out, 'ok decision pr24\n');
  assert.match(r.err, /artifact not found: .*notes\.txt/);
  const it = item('pr24');
  assert.deepEqual(it.options, [{ key: 'merge', label: 'Merge', recommended: true }, { key: 'hold', label: 'Hold for now' }]);
  assert.deepEqual(it.artifacts, [
    { type: 'pr', url: 'https://github.com/o/r/pull/24' },
    { type: 'video', path: path.join(fs.realpathSync(cwd), 'clip.mp4') },
    { type: 'report', path: path.join(fs.realpathSync(cwd), 'notes.txt') },
  ]);
  assert.deepEqual(it.rules, ['budget', 'no-merge-without-word', 'cutout-width']);
  assert.deepEqual(it.checks, [
    { rule: 'no-merge-without-word', ok: true, note: 'held' },
    { rule: 'cutout-width', ok: false, note: 'measured 27%' },
  ]);
  assert.equal(it.priority, 1);
  assert.ok(it.due > it.created + 86400);
  assert.equal(it.from, 'agent-a');
  assert.equal(it.project, 'demo');
  assert.equal(it.status, 'open');
});

test('item rules: decision needs options, others refuse them, bad input writes nothing', () => {
  const { home, hd } = setup();
  assert.match(hd(['decision', 'd', 'D?']).err, /needs at least one --opt/);
  assert.match(hd(['answer', 'a', 'A', '--opt', 'x']).err, /decisions only/);
  assert.match(hd(['todo', 'bad id', 'T']).err, /bad id/);
  assert.match(hd(['todo', 't', 'T', '-p', '7']).err, /--pri must be/);
  assert.match(hd(['todo', 't', 'T', 'stray']).err, /unexpected "stray"/);
  assert.match(hd(['todo', 't', 'T', '--nope', 'x']).err, /unknown flag --nope/);
  assert.equal(fs.existsSync(path.join(home, 'items')), false);
});

test('rewrite keeps created and thread; reply appends; resolve closes', () => {
  const { hd, item } = setup();
  hd(['review', 'cut7', 'Cut 7', '-a', 'video:https://example.com/c.mp4']);
  const created = item('cut7').created;
  assert.equal(hd(['reply', 'cut7', 'Re-rendered at 1080p.']).code, 0);
  hd(['review', 'cut7', 'Cut 7 v2', '-s', 'New render.']);
  const it = item('cut7');
  assert.equal(it.title, 'Cut 7 v2');
  assert.equal(it.created, created);
  assert.deepEqual(it.thread.map((t) => [t.from, t.text]), [['agent-a', 'Re-rendered at 1080p.']]);
  assert.equal(it.artifacts, undefined);
  assert.equal(hd(['resolve', 'cut7']).out, 'ok resolve cut7\n');
  assert.equal(item('cut7').status, 'resolved');
  assert.match(hd(['reply', 'ghost', 'hi']).err, /no such item or request/);
});

test('reply to a request id creates an answer item', () => {
  const { hd, item, append } = setup();
  append({ id: 'req-1', action: 'request', note: 'Add a weekly digest', to: 'mate-ops', at: 5 });
  assert.equal(hd(['reply', 'req-1', 'Drafted; see the plan.']).code, 0);
  const it = item('req-1');
  assert.equal(it.kind, 'answer');
  assert.equal(it.title, 'Add a weekly digest');
  assert.equal(it.from, 'mate-ops');
  assert.equal(it.thread.length, 1);
});

test('answers: offsets, partial lines, cursors, json', () => {
  const { home, hd, append } = setup();
  assert.equal(hd(['answers']).out, 'next=0\n');
  append({ id: 'a', action: 'decide', key: 'merge', at: 1 }, { id: 'b', action: 'ask', note: 'why?', at: 2 });
  const file = path.join(home, 'answers.jsonl');
  const firstEnd = fs.readFileSync(file, 'utf8').indexOf('\n') + 1;
  fs.appendFileSync(file, '{"id":"c","act'); // writer mid-line
  const all = hd(['answers']).out.trim().split('\n');
  assert.equal(all.length, 3);
  const next = Number(all[2].slice(5));
  assert.equal(next, fs.statSync(file).size - '{"id":"c","act'.length);
  assert.equal(hd(['answers', '--since-offset', String(firstEnd)]).out.split('\n')[0], '{"id":"b","action":"ask","note":"why?","at":2}');
  assert.equal(hd(['answers', '--since-offset', String(next)]).out, `next=${next}\n`);

  const j = JSON.parse(hd(['answers', '--json']).out);
  assert.equal(j.next, next);
  assert.deepEqual(j.lines.map((l) => [l.end, l.answer.id]), [[firstEnd, 'a'], [next, 'b']]);

  assert.equal(hd(['answers', '-c', 'me', '--peek']).out.split('\n').length, 3);
  assert.equal(hd(['answers', '-c', 'me']).out.split('\n').length, 3);
  assert.equal(hd(['answers', '-c', 'me']).out, '');
  fs.appendFileSync(file, 'ion":"file","at":3}\n');
  assert.equal(hd(['answers', '-c', 'me']).out, '{"id":"c","action":"file","at":3}\n');

  fs.writeFileSync(file, ''); // truncated/rotated
  const r = hd(['answers', '--since-offset', '999']);
  assert.match(r.err, /shorter than the offset/);
  assert.equal(r.out, 'next=0\n');
});

test('batch: all lines checked first, then written in order', () => {
  const { home, hd, item } = setup();
  const bad = hd(['batch'], 'decision a "A?" --opt x --opt y\nfrobnicate z\nanswer b\n');
  assert.equal(bad.code, 1);
  assert.match(bad.err, /line 2: unknown verb "frobnicate"/);
  assert.match(bad.err, /line 3: answer b: missing "<title>"/);
  assert.equal(fs.existsSync(path.join(home, 'items')), false);

  const ok = hd(['batch'], [
    '# a whole reply in one call',
    'hd decision hook "Which hook?" --opt imagine --opt rating* -s "Three openings cut."',
    "answer survey 'Tools survey' -s \"Two of five are free.\" -p 4",
    'todo renew "Renew the domain" -d 2030-01-01',
    'reply hook "Rating-first tested best."',
    'gap "A 12-question form does not fit one decision" --item hook',
    '',
  ].join('\n'));
  assert.equal(ok.code, 0, ok.err);
  assert.equal(ok.out, 'ok decision hook\nok answer survey\nok todo renew\nok reply hook\nok gap\n');
  assert.equal(item('hook').options[1].recommended, true);
  assert.equal(item('hook').thread[0].text, 'Rating-first tested best.');
  assert.equal(item('survey').summary, 'Two of five are free.');
  assert.equal(item('renew').due, Date.parse('2030-01-01') / 1000);
  assert.equal(hd(['batch'], '\n# nothing\n').code, 1);
});

test('gap appends a line to gaps.jsonl', () => {
  const { home, hd } = setup();
  assert.equal(hd(['gap', 'Live progress bar for a 2h render has no item kind', '--sample', 'https://example.com/log']).out, 'ok gap\n');
  hd(['gap', 'Second']);
  const lines = fs.readFileSync(path.join(home, 'gaps.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 2);
  assert.equal(lines[0].sample, 'https://example.com/log');
  assert.equal(lines[0].from, 'agent-a');
  assert.ok(Number.isInteger(lines[1].at));
  assert.equal(hd(['gap']).code, 1);
});

test('snapshots: validated before install, from file or stdin', () => {
  const { home, cwd, hd } = setup();
  assert.match(hd(['quota', '-'], '[{"name":"X","window":"5h","used_pct":120,"resets_at":1}]').err, /above 100/);
  assert.match(hd(['quota', '-'], 'nope').err, /not JSON/);
  assert.equal(fs.existsSync(path.join(home, 'quota.json')), false);
  assert.equal(hd(['quota', '-'], '[{"name":"X","window":"7d","used_pct":12,"resets_at":1}]').code, 0);
  fs.writeFileSync(path.join(cwd, 'rules.json'), '{"budget":{"text":"Keep tooling under $50/mo."}}');
  assert.equal(hd(['rules', 'rules.json']).out, 'ok rules\n');
  assert.match(hd(['fleet', '-'], '{"crew":[{"id":"c1","state":"asleep"}]}').err, /must be one of/);
  assert.match(hd(['fleet', 'missing.json']).err, /file not found/);
});

test('validate: shipped sample data is valid; broken files are reported', () => {
  const { home, hd } = setup();
  fs.cpSync(SAMPLE, home, { recursive: true });
  const ok = hd(['validate']);
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /^ok: /m);
  fs.writeFileSync(path.join(home, 'items', 'x.json'), '{"id":"y","kind":"todo","title":"T","created":1,"status":"done"}');
  fs.appendFileSync(path.join(home, 'answers.jsonl'), '{"id":"x","action":"shrug","at":1}\n');
  const bad = JSON.parse(hd(['validate', '--json']).out);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => /x\.json: \$\.status/.test(e)));
  assert.ok(bad.errors.some((e) => /does not match file name/.test(e)));
  assert.ok(bad.errors.some((e) => /answers\.jsonl:\d+: \$\.action/.test(e)));
});

test('ls and path', () => {
  const { home, hd } = setup();
  hd(['todo', 't1', 'First', '-p', '2']);
  hd(['todo', 't2', 'Second']);
  hd(['resolve', 't2']);
  assert.equal(hd(['ls']).out, 't1 todo p2 open First\n');
  assert.equal(hd(['ls', '--all']).out.split('\n').length, 3);
  assert.equal(hd(['path']).out.trim(), home);
});

test('mcp: initialize, list, call', () => {
  const { hd, item } = setup();
  const req = (id, method, params) => JSON.stringify({ jsonrpc: '2.0', id, method, params });
  const r = hd(['mcp'], [
    req(1, 'initialize', { protocolVersion: '2025-06-18' }),
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    req(2, 'tools/list'),
    req(3, 'tools/call', { name: 'harbordeck_batch', arguments: { lines: 'todo t "Do it"' } }),
    req(4, 'tools/call', { name: 'harbordeck_gap', arguments: { text: 'did not fit' } }),
    '',
  ].join('\n'));
  const res = r.out.trim().split('\n').map((l) => JSON.parse(l));
  const byId = Object.fromEntries(res.map((m) => [m.id, m]));
  assert.equal(byId[1].result.serverInfo.name, 'harbordeck');
  assert.deepEqual(byId[2].result.tools.map((t) => t.name), ['harbordeck_batch', 'harbordeck_answers', 'harbordeck_gap', 'harbordeck_topic']);
  assert.equal(byId[3].result.content[0].text, 'ok todo t');
  assert.equal(byId[4].result.isError, false);
  assert.equal(item('t').title, 'Do it');
});

test('answers --wait returns as soon as the app appends a line', async () => {
  const { home } = setup();
  const { spawn } = await import('node:child_process');
  const child = spawn(process.execPath, [BIN, 'answers', '-c', 'live', '--wait', '--timeout', '20'], {
    env: { ...process.env, HARBORDECK_HOME: home },
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  const started = Date.now();
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(out, '');
  fs.appendFileSync(path.join(home, 'answers.jsonl'), '{"id":"a","action":"approve","at":1}\n');
  const code = await new Promise((r) => child.on('exit', r));
  assert.equal(code, 0);
  assert.equal(out, '{"id":"a","action":"approve","at":1}\n');
  assert.ok(Date.now() - started < 5000);
});

test('answers --wait --timeout returns empty when nothing lands', () => {
  const { hd } = setup();
  assert.equal(hd(['answers', '--since-offset', '0', '--wait', '--timeout', '1']).out, 'next=0\n');
});

test('web and lavish artifacts: URLs kept, lavish html path resolved to its session URL', () => {
  const { home, cwd, item } = setup();
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-bin-'));
  // stand-in for lavish-axi: prints a session block like the real one, and records its argv
  fs.writeFileSync(path.join(bin, 'lavish-axi'), `#!/bin/sh\necho "$@" > "${bin}/argv"\necho 'session:'\necho '  url: "http://127.0.0.1:4387/session/abc123"'\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(cwd, 'plan.html'), '<h1>plan</h1>');
  const run = (args, extra = {}) => spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', env: { ...process.env, HARBORDECK_HOME: home, HARBORDECK_PROJECT: 'demo', PATH: `${bin}:${process.env.PATH}`, ...extra } });
  let r = run(['review', 'plan', 'Review the plan', '-a', 'web:http://localhost:5173/', '-a', 'lavish:http://127.0.0.1:4387/session/x', '-a', 'lavish:plan.html']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(item('plan').artifacts, [
    { type: 'web', url: 'http://localhost:5173/' },
    { type: 'lavish', url: 'http://127.0.0.1:4387/session/x' },
    { type: 'lavish', url: 'http://127.0.0.1:4387/session/abc123' },
  ]);
  assert.equal(fs.readFileSync(path.join(bin, 'argv'), 'utf8').trim(), `${path.join(fs.realpathSync(cwd), 'plan.html')} --no-open`);
  // no lavish (disabled here): the path is kept, with a warning
  r = run(['review', 'plan2', 'Plan', '-a', 'lavish:plan.html'], { HARBORDECK_LAVISH: '0' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /no Lavish session URL/);
  assert.deepEqual(item('plan2').artifacts, [{ type: 'lavish', path: path.join(fs.realpathSync(cwd), 'plan.html') }]);
  // web needs a URL
  r = run(['review', 'plan3', 'Plan', '-a', 'web:plan.html']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /web needs a URL/);
});
