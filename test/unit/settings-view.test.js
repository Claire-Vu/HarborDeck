'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { HarborShortcutRecord: rec } = require('../../app/renderer/settings-view');
const keys = require('../../app/renderer/phone-view');

const ev = (code, mods = {}, key = code.replace(/^Key|^Digit/, '').toLowerCase()) => ({ code, key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods });

test('a recorded key press becomes the accelerator; Cmd on a Mac and Ctrl elsewhere are CommandOrControl', () => {
  assert.strictEqual(rec.accelerator(ev('Space', { metaKey: true, shiftKey: true }, ' '), true), 'CommandOrControl+Shift+Space');
  assert.strictEqual(rec.accelerator(ev('Space', { ctrlKey: true, shiftKey: true }, ' '), false), 'CommandOrControl+Shift+Space');
  assert.strictEqual(rec.accelerator(ev('KeyP', { ctrlKey: true, altKey: true }), true), 'Control+Alt+P');
  assert.strictEqual(rec.accelerator(ev('Digit2', { metaKey: true }), false), 'Super+2');
  assert.strictEqual(rec.accelerator(ev('KeyK', { altKey: true, shiftKey: true }, 'Ò'), true), 'Alt+Shift+K'); // by physical key
  assert.strictEqual(rec.accelerator(ev('F5'), true), 'F5');
});

test('modifiers alone wait; a bare or Shift-only key and keys outside letters, digits, Space and F-keys are refused', () => {
  assert.strictEqual(rec.accelerator(ev('ShiftLeft', { shiftKey: true }, 'Shift'), true), '');
  assert.strictEqual(rec.accelerator(ev('MetaLeft', { metaKey: true }, 'Meta'), true), '');
  assert.strictEqual(rec.accelerator(ev('KeyK'), true), null);
  assert.strictEqual(rec.accelerator(ev('KeyK', { shiftKey: true }), true), null);
  assert.strictEqual(rec.accelerator(ev('Enter', { metaKey: true }, 'Enter'), true), null);
});

test('what is recorded matches the same press again and reads back as glyphs', () => {
  for (const [e, mac] of [[ev('Space', { metaKey: true, shiftKey: true }, ' '), true], [ev('KeyJ', { ctrlKey: true, altKey: true }), false], [ev('F8', { altKey: true }), true]]) {
    assert.ok(keys.matches(rec.accelerator(e, mac), e, mac));
  }
  assert.strictEqual(keys.label(rec.accelerator(ev('Space', { metaKey: true, shiftKey: true }, ' '), true), true), '⇧⌘Space');
});
