'use strict';
// Headless guard: tests must never pop a window on whoever is at the machine. Every test launches the app through
// test/smoke/launch.js (headless unless HARBORDECK_HEADLESS=0), and any script that starts the Electron binary sets
// HARBORDECK_HEADLESS on the same command. Adding a spec that bypasses the helper fails here.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : [p];
});
const rel = p => path.relative(ROOT, p);
const HELPER = path.join(ROOT, 'test', 'smoke', 'launch.js');
const scanned = [...walk(path.join(ROOT, 'test')), ...walk(path.join(ROOT, '.agents', 'skills', 'verify-harbordeck', 'scripts'))]
  .filter(p => p !== HELPER && p !== __filename);

test('no file launches Electron through Playwright except the shared helper', () => {
  const bad = scanned.filter(p => /_electron|electron\.launch|require\(['"]electron['"]\)|from ['"]electron['"]/.test(fs.readFileSync(p, 'utf8')));
  assert.deepStrictEqual(bad.map(rel), []);
});

test('every smoke spec starts the app with launchApp from ./launch', () => {
  const specs = fs.readdirSync(path.dirname(HELPER)).filter(f => f.endsWith('.spec.js'));
  assert.ok(specs.length > 0);
  const bad = specs.filter(f => {
    const src = fs.readFileSync(path.join(path.dirname(HELPER), f), 'utf8');
    return !/require\('\.\/launch'\)/.test(src) || !/launchApp\(/.test(src);
  });
  assert.deepStrictEqual(bad, []);
});

test('scripts that run the Electron binary set HARBORDECK_HEADLESS on that command', () => {
  const bad = [];
  for (const p of scanned) {
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    lines.forEach((l, i) => {
      if (/\.bin\/electron\b/.test(l) && !/^\s*#|\[ -x /.test(l) && !/HARBORDECK_HEADLESS=/.test(l + (lines[i - 1] || ''))) bad.push(`${rel(p)}:${i + 1}`);
    });
  }
  assert.deepStrictEqual(bad, []);
});

test('launchApp defaults to headless (unset or empty) and honours an explicit HARBORDECK_HEADLESS=0', () => {
  const { _electron } = require('@playwright/test');
  const real = _electron.launch;
  const saved = process.env.HARBORDECK_HEADLESS;
  const seen = [];
  _electron.launch = opts => { seen.push(opts.env.HARBORDECK_HEADLESS); return Promise.resolve(null); };
  try {
    const { launchApp } = require(HELPER);
    delete process.env.HARBORDECK_HEADLESS; launchApp({ home: 'h', profile: 'p' });
    process.env.HARBORDECK_HEADLESS = ''; launchApp({ home: 'h', profile: 'p' });
    process.env.HARBORDECK_HEADLESS = '0'; launchApp({ home: 'h', profile: 'p' });
  } finally {
    _electron.launch = real;
    if (saved === undefined) delete process.env.HARBORDECK_HEADLESS; else process.env.HARBORDECK_HEADLESS = saved;
  }
  assert.deepStrictEqual(seen, ['1', '1', '0']);
});
