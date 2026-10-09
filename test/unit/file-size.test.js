'use strict';
// Repo-local stand-in for the garden file-growth rule, so CI enforces it without the private garden library:
// no source or stylesheet file over 400 non-blank lines, and the grandfathered files below may not grow. Shrink a ceiling
// when you split a file; add features as new modules instead of raising one.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const LIMIT = 400;
const GRANDFATHERED = { 'cli/src/main.js': 458, 'cli/src/scheduler.js': 423 };
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(p)) : [p];
});
const codeLines = p => fs.readFileSync(p, 'utf8').split('\n').filter(l => l.trim()).length;

test('source files stay under the line limit; grandfathered files do not grow', () => {
  const files = ['app', 'cli/src', 'adapters'].flatMap(d => walk(path.join(ROOT, d))).filter(p => /\.(js|mjs|css)$/.test(p));
  const bad = files.map(p => [path.relative(ROOT, p).split(path.sep).join('/'), codeLines(p)])
    .filter(([rel, n]) => n > (GRANDFATHERED[rel] ?? LIMIT));
  assert.deepStrictEqual(bad, []);
});
