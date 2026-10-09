// Public repo: committed text must never carry a real username, home path or private name.
// Images are covered by scripts/ocr-check.swift (CI, macOS). Extra names: HD_PRIVATE_NAMES=a,b
const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const PLACEHOLDER_USERS = new Set(['me', 'you', 'name', 'user', 'example', 'shared']);

function privateNames(env = process.env) {
  const own = [os.userInfo().username, path.basename(os.homedir())];
  const extra = (env.HD_PRIVATE_NAMES || '').split(',');
  return [...own, ...extra].map((n) => n.trim().toLowerCase()).filter((n) => n.length >= 4);
}

function leaks(text, names) {
  const out = [];
  const low = text.toLowerCase();
  for (const n of names) if (low.includes(n)) out.push(n);
  if (low.includes('.treehouse')) out.push('.treehouse');
  for (const m of low.matchAll(/(?<![\w.-])\/(?:users|home)\/([a-z0-9._-]+)/g)) {
    if (!PLACEHOLDER_USERS.has(m[1])) out.push(m[0]);
  }
  return out;
}

function committedText() {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  return files.flatMap((f) => {
    const full = path.join(ROOT, f);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return [];
    const buf = fs.readFileSync(full);
    return buf.includes(0) ? [] : [[f, buf.toString('utf8')]];
  });
}

test('detector flags real-looking paths, allows placeholders', () => {
  const names = ['someuser'];
  assert.deepStrictEqual(leaks('/Users/someuser/proj', names).length > 0, true);
  assert.deepStrictEqual(leaks('/Users/jane/x', []), ['/users/jane']);
  assert.deepStrictEqual(leaks('/home/jane/x', []), ['/home/jane']);
  assert.deepStrictEqual(leaks('/Users/me/.harbordeck', []), []);
  assert.deepStrictEqual(leaks('/tmp/hdv-1/home/answers.jsonl', []), []);
  assert.ok(leaks('x/.treehouse/y', []).includes('.treehouse'));
});

test('no committed text file carries a username, home path or private name', () => {
  const names = privateNames();
  const bad = committedText().flatMap(([f, t]) => leaks(t, names).map((l) => `${f}: ${l}`));
  assert.deepStrictEqual(bad, []);
});
