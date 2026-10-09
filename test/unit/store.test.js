'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../../app/lib/store');
const { runOnAnswer } = require('../../app/lib/hook');
const { watchHome } = require('../../app/lib/watch');
const { loadSettings, saveSettings, effectiveHome } = require('../../app/lib/settings');
const { seedDemo } = require('../../app/demo/seed');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-unit-'));
const write = (file, v) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof v === 'string' ? v : JSON.stringify(v)); };

test('loads items, normalizes, and reports bad files without crashing', () => {
  const home = tmp();
  write(path.join(home, 'items/a.json'), { id: 'a', kind: 'decision', title: 'A', created: 10 });
  write(path.join(home, 'items/b.json'), { id: 'b', kind: 'mystery', title: 'B' });
  write(path.join(home, 'items/bad.json'), '{ nope');
  write(path.join(home, 'items/notitle.json'), { id: 'x' });
  const { items, errors } = store.loadItems(home);
  assert.deepStrictEqual(items.map(i => i.id), ['a', 'b']);
  assert.strictEqual(items[0].status, 'open');
  assert.strictEqual(items[1].kind, 'answer');
  assert.strictEqual(items[1].kind_raw, 'mystery');
  assert.deepStrictEqual(errors.map(e => e.file).sort(), ['bad.json', 'notitle.json']);
});

test('appendAnswer writes exactly one JSON line and validates the action', () => {
  const home = tmp();
  const text = store.appendAnswer(home, { id: 'a', action: 'decide', key: 'merge', at: 123, junk: 'dropped' });
  assert.strictEqual(text, '{"id":"a","action":"decide","key":"merge","note":"","at":123}');
  store.appendAnswer(home, { id: 'r1', action: 'request', note: 'hi', to: 'mate' });
  const lines = fs.readFileSync(path.join(home, 'answers.jsonl'), 'utf8').split('\n');
  assert.strictEqual(lines.length, 3); assert.strictEqual(lines[2], '');
  assert.deepStrictEqual(store.readAnswers(home).map(a => a.action), ['decide', 'request']);
  assert.throws(() => store.appendAnswer(home, { id: 'a', action: 'delete-everything' }));
});

test('appendAnswer: rule (Remember this) is kept as true on request/comment/needs-work/ask only', () => {
  const home = tmp();
  const ok = a => JSON.parse(store.appendAnswer(home, { id: 'a', note: 'n', at: 1, ...a }));
  for (const action of ['request', 'comment', 'needs-work', 'ask']) assert.strictEqual(ok({ action, rule: true }).rule, true, action);
  assert.ok(!('rule' in ok({ action: 'request', rule: false })), 'false is never written');
  assert.ok(!('rule' in ok({ action: 'request', rule: 'yes' })));
  assert.ok(!('rule' in ok({ action: 'request' })));
  assert.ok(!('rule' in ok({ action: 'reject', rule: true })));
});

test('answer and rules schemas accept rule: true and an answer link, and reject rule: false', async () => {
  const { validate } = await import('../../cli/src/schema.js');
  const errs = (name, v) => validate(name, v);
  assert.deepStrictEqual(errs('answer', { id: 'req-1-2', action: 'request', note: 'x', rule: true, at: 1 }), []);
  assert.ok(errs('answer', { id: 'req-1-2', action: 'request', note: 'x', rule: false, at: 1 }).length);
  assert.deepStrictEqual(errs('rules', { r: { text: 't', answer: 'req-1-2' } }), []);
});

test('readAnswers skips a torn last line', () => {
  const home = tmp();
  write(path.join(home, 'answers.jsonl'), '{"id":"a","action":"file","at":1}\n{"id":"b","act');
  assert.deepStrictEqual(store.readAnswers(home).map(a => a.id), ['a']);
});

test('paths resolve against artifact_root, then the data dir; text is inlined, media gets harbor:// urls', () => {
  const home = tmp(), root = tmp();
  write(path.join(root, 'r/report.md'), '# hi');
  write(path.join(home, 'pic.png'), 'png');
  const items = [{ id: 'a', body: 'r/report.md', artifacts: [{ type: 'image', path: 'pic.png' }, { type: 'pr', url: 'https://x/pull/1' }, { type: 'video', path: '/nope/missing.mp4' }] }];
  const files = store.resolveFiles(items, { home, artifactRoot: root });
  assert.strictEqual(files['r/report.md'].text, '# hi');
  assert.strictEqual(files['pic.png'].abs, path.join(home, 'pic.png'));
  assert.strictEqual(store.pathFromUrl(files['pic.png'].url), path.join(home, 'pic.png'));
  assert.strictEqual(files['/nope/missing.mp4'].exists, false);
  assert.strictEqual(files['/nope/missing.mp4'].url, null);
});

test('settings: env wins over the field, defaults to ~/.harbordeck', () => {
  const dir = tmp(); const file = path.join(dir, 'settings.json');
  assert.strictEqual(loadSettings(file).onAnswer.enabled, false);
  saveSettings(file, { dataDir: path.join(dir, 'd'), onAnswer: { enabled: true, command: 'true' } });
  const s = loadSettings(file);
  assert.strictEqual(effectiveHome(s, {}), path.join(dir, 'd'));
  assert.strictEqual(effectiveHome(s, { HARBORDECK_HOME: path.join(dir, 'env') }), path.join(dir, 'env'));
  assert.strictEqual(effectiveHome({}, {}), path.join(os.homedir(), '.harbordeck'));
});

test('on-answer hook gets the line on stdin and in $HARBORDECK_LINE', async () => {
  const home = tmp(); const out = path.join(home, 'out.txt');
  const line = '{"id":"a","action":"file","note":"","at":1}';
  const child = runOnAnswer(`cat > "${out}"; printf '%s' "$HARBORDECK_LINE" >> "${out}"`, line, home);
  await new Promise(r => child.on('exit', r));
  assert.strictEqual(fs.readFileSync(out, 'utf8'), line + '\n' + line);
  assert.strictEqual(runOnAnswer('', line, home), null);
});

test('watcher fires once per burst of writes', async () => {
  const home = tmp(); fs.mkdirSync(path.join(home, 'items'));
  let n = 0; const w = watchHome(home, () => n++, { debounceMs: 80, pollMs: 1000 });
  for (let i = 0; i < 5; i++) write(path.join(home, 'items', `i${i}.json`), { id: `i${i}`, title: 't' });
  await new Promise(r => setTimeout(r, 1500));
  w.close();
  assert.strictEqual(n, 1);
});

test('demo seed is complete and refuses to wipe a real directory', () => {
  const dir = path.join(tmp(), 'demo');
  seedDemo(dir);
  const snap = store.snapshot(dir);
  assert.ok(snap.items.length >= 15);
  assert.deepStrictEqual(snap.errors, []);
  assert.deepStrictEqual(Object.entries(snap.files).filter(([, f]) => !f || !f.exists).map(([k]) => k), []);
  seedDemo(dir); // re-seeding its own directory is fine
  const real = tmp(); write(path.join(real, 'items/mine.json'), { id: 'm', title: 'm' });
  assert.throws(() => seedDemo(real), /refusing/);
  assert.ok(fs.existsSync(path.join(real, 'items/mine.json')));
});

test('reads the contract sample directory (docs/sample-data) cleanly', () => {
  const home = path.join(__dirname, '..', '..', 'docs', 'sample-data');
  const snap = store.snapshot(home);
  assert.ok(snap.items.length > 0);
  assert.deepStrictEqual(snap.errors, []);
  assert.ok(snap.gaps.length >= 1);
  for (const [p, f] of Object.entries(snap.files)) if (f) assert.ok(f.exists, `missing ${p}`);
});

test('snapshot serves the files of option artifacts', () => {
  const home = tmp();
  write(path.join(home, 'items/d.json'), { id: 'd', kind: 'decision', title: 'D', options: [{ key: 'a', label: 'A', artifact: { type: 'audio', path: 'a.wav' } }, { key: 'b', label: 'B', artifact: { type: 'image', path: 'gone.png' } }] });
  write(path.join(home, 'a.wav'), 'wav');
  const snap = store.snapshot(home);
  assert.ok(snap.files['a.wav'].exists);
  assert.strictEqual(snap.files['gone.png'].exists, false);
});

test('web pane allow-list: loopback http(s) only, plus hosts from settings', () => {
  const { isAllowedWebUrl } = require('../../app/lib/web-allow');
  for (const u of ['http://localhost:5173/', 'https://127.0.0.1:4387/session/x', 'http://[::1]:8080/', 'http://LOCALHOST/']) assert.ok(isAllowedWebUrl(u), u);
  for (const u of ['https://example.com/', 'http://127.0.0.2/', 'http://localhost.evil.test/', 'http://user:pw@localhost/', 'file:///etc/hosts', 'javascript:alert(1)', 'harbor://file/x', 'not a url', '']) assert.ok(!isAllowedWebUrl(u), u);
  assert.ok(isAllowedWebUrl('http://devbox.lan:8080/', ['devbox.lan:8080']));
  assert.ok(!isAllowedWebUrl('http://devbox.lan:9090/', ['devbox.lan:8080']));
  assert.ok(isAllowedWebUrl('https://devbox.lan/', 'other.lan, DevBox.lan'));
});

test('settings keep a clean webHosts list', () => {
  const file = path.join(tmp(), 'settings.json');
  assert.deepStrictEqual(loadSettings(file).webHosts, []);
  assert.deepStrictEqual(saveSettings(file, { webHosts: ' a.lan, B.lan:8080  a.lan ' }).webHosts, ['a.lan', 'b.lan:8080']);
  assert.deepStrictEqual(loadSettings(file).webHosts, ['a.lan', 'b.lan:8080']);
});

test('demo seed adds the browser-pane item only when given a local site URL', () => {
  assert.ok(!fs.existsSync(path.join(seedDemo(path.join(tmp(), 'd')), 'items', 'plan-offline.json')));
  const home = seedDemo(path.join(tmp(), 'd'), undefined, { webUrl: 'http://127.0.0.1:1234/' });
  const it = JSON.parse(fs.readFileSync(path.join(home, 'items', 'plan-offline.json'), 'utf8'));
  assert.deepStrictEqual(it.artifacts, [{ type: 'web', url: 'http://127.0.0.1:1234/plan.html', label: 'Plan page' }]);
});

test('snapshot carries notes.jsonl (complete, placeable lines) and serves note artifacts', () => {
  const home = tmp();
  write(path.join(home, 'items/a.json'), { id: 'a', kind: 'todo', title: 'A', topic: 'x', rel: ['b'] });
  write(path.join(home, 'shot.png'), 'png');
  write(path.join(home, 'notes.jsonl'), '{"item":"a","text":"on a","at":1}\n{"topic":"x","text":"on x","artifact":{"type":"image","path":"shot.png"},"at":2}\n{"text":"nowhere","at":3}\n{"topic":"x","te');
  const snap = store.snapshot(home);
  assert.deepStrictEqual(snap.notes.map(n => n.text), ['on a', 'on x']);
  assert.strictEqual(snap.files['shot.png'].exists, true);
  assert.strictEqual(snap.items[0].topic, 'x');
});

test('appendAnswer: a defer (Later stamp) keeps its until and is refused without one', () => {
  const home = tmp();
  const line = JSON.parse(store.appendAnswer(home, { id: 'a', action: 'defer', until: 1791540000, at: 1791500000 }));
  assert.deepStrictEqual(line, { id: 'a', action: 'defer', note: '', until: 1791540000, at: 1791500000 });
  assert.throws(() => store.appendAnswer(home, { id: 'a', action: 'defer' }), /defer needs until/);
});

test('local .html artifacts get a harbor://page URL whose folder (minus hidden files) is servable', () => {
  const home = tmp();
  write(path.join(home, 'r/report.html'), '<h1>r</h1>');
  write(path.join(home, 'items/a.json'), { id: 'a', kind: 'answer', title: 'A', created: 1, artifacts: [{ type: 'report', path: 'r/report.html' }] });
  const snap = store.snapshot(home);
  const f = snap.files['r/report.html'];
  assert.strictEqual(f.page, 'harbor://page' + path.join(home, 'r/report.html').split(path.sep).map(encodeURIComponent).join('/'));
  assert.strictEqual(store.pathFromPageUrl(f.page), path.join(home, 'r/report.html'));
  assert.deepStrictEqual(store.pageDirs(snap.files), [path.join(home, 'r')]);
  // dot segments never climb out of the folder
  assert.strictEqual(store.pathFromPageUrl(f.page.replace('report.html', '../../etc/passwd')), path.resolve(home, '../etc/passwd'));
  assert.strictEqual(store.pathFromPageUrl('harbor://file/x'), null);
});
