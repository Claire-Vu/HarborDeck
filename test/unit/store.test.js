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
