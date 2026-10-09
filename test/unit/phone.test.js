'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const keys = require('../../app/renderer/phone-view');
const { loadSettings, saveSettings } = require('../../app/lib/settings');

const ev = (code, mods = {}) => ({ code, key: code === 'Space' ? ' ' : code.replace(/^Key|^Digit/, '').toLowerCase(), metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods });

test('phone shortcut matches the accelerator exactly, CommandOrControl per platform', () => {
  const acc = 'CommandOrControl+Shift+Space';
  assert.ok(keys.matches(acc, ev('Space', { metaKey: true, shiftKey: true }), true));
  assert.ok(!keys.matches(acc, ev('Space', { ctrlKey: true, shiftKey: true }), true));
  assert.ok(keys.matches(acc, ev('Space', { ctrlKey: true, shiftKey: true }), false));
  assert.ok(!keys.matches(acc, ev('Space', { metaKey: true }), true), 'missing Shift');
  assert.ok(!keys.matches(acc, ev('Space', { metaKey: true, shiftKey: true, altKey: true }), true), 'extra Option');
  assert.ok(keys.matches('Alt+Shift+K', ev('KeyK', { altKey: true, shiftKey: true, key: '˚' }), true), 'by physical key');
  assert.ok(!keys.matches('', ev('Space'), true));
  assert.strictEqual(keys.parse('Hyper+P'), null);
});

test('phone shortcut label', () => {
  assert.strictEqual(keys.label('CommandOrControl+Shift+Space', true), '⇧⌘Space');
  assert.strictEqual(keys.label('CommandOrControl+Shift+Space', false), 'Ctrl+Shift+Space');
  assert.strictEqual(keys.label('', true), '');
});

test('settings: phone shortcut defaults on, can be changed or turned off', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'harbordeck-unit-')), 'settings.json');
  assert.strictEqual(loadSettings(file).phoneShortcut, 'CommandOrControl+Shift+Space');
  assert.strictEqual(saveSettings(file, { phoneShortcut: ' Alt+Shift+P ' }).phoneShortcut, 'Alt+Shift+P');
  assert.strictEqual(loadSettings(file).phoneShortcut, 'Alt+Shift+P');
  assert.strictEqual(saveSettings(file, { phoneShortcut: '' }).phoneShortcut, '');
  assert.strictEqual(saveSettings(file, {}).phoneShortcut, 'CommandOrControl+Shift+Space');
});

test('add-to targets: the open item at the desk first, then running rail tickets, one per id, never queued ones', () => {
  const { HarborAddTo } = keys;
  const tickets = [
    { a: { id: 'req-1-2', action: 'request', note: 'Add a dark theme' }, title: 'Order to First Mate' },
    { a: { id: 'logo', action: 'ask', note: 'why teal?' }, title: 'Pick a logo' },
    { a: { id: 'logo', action: 'needs-work', note: 'bigger' }, title: 'Pick a logo' },
    { a: { id: 'req-3-4', action: 'request', note: 'Later thing' }, title: 'Order', queued: { id: 'reset-req-3-4' } }
  ];
  assert.deepStrictEqual(HarborAddTo.targets({ id: 'logo', title: 'Pick a logo' }, tickets), [
    { id: 'logo', kind: 'at the desk', label: 'Pick a logo' },
    { id: 'req-1-2', kind: 'order', label: 'Add a dark theme' }
  ]);
  assert.deepStrictEqual(HarborAddTo.targets(null, []), []);
});
