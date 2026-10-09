/* Settings dialog: a paper sheet in four sections (General, Phone, Agent connection, Advanced). Folders are picked, not
   typed; web hosts are chips; the phone shortcut is recorded by pressing it. Built by desk-settings.js. */
'use strict';

// Pure: a keydown -> Electron accelerator, '' while only modifiers are down, null when the key cannot be a shortcut.
// Cmd on a Mac (Ctrl elsewhere) records as CommandOrControl, so the default round-trips. Unit-tested.
const HarborShortcutRecord = {
  accelerator(e, mac) {
    const key = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : /^Digit[0-9]$/.test(e.code) ? e.code.slice(5) : e.code === 'Space' ? 'Space' : /^F([1-9]|1[0-9]|2[0-4])$/.test(e.code) ? e.code : null;
    if (!key) return ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key) ? '' : null;
    const cmd = mac ? e.metaKey : e.ctrlKey;
    const mods = [cmd && 'CommandOrControl', mac && e.ctrlKey && 'Control', !mac && e.metaKey && 'Super', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean);
    if (!mods.length && !/^F/.test(key)) return null; // a bare letter would steal typing system-wide
    if (mods.length === 1 && mods[0] === 'Shift' && !/^F/.test(key)) return null;
    return [...mods, key].join('+');
  }
};

if (typeof module === 'object') module.exports = { HarborShortcutRecord };
else window.HarborSettings = deps => {
  const { h, bridge, keys, modal, closeModal } = deps;
  const mac = /Mac/.test(navigator.platform || '');

  const section = (title, sub, ...rows) => h('section', { class: 'set-sec', 'aria-label': title }, h('h3', { class: 'set-h' }, title, sub ? h('span', { class: 'set-sub' }, sub) : null), ...rows);
  const row = (label, hint, ...control) => h('div', { class: 'set-row' }, h('div', { class: 'set-l' }, h('span', { class: 'set-name' }, label), hint ? h('span', { class: 'set-hint' }, hint) : null), h('div', { class: 'set-in' }, ...control));

  // A folder shown as its name with the parent dimmed under it; Choose… opens the system picker, Reset falls back.
  function folder(label, value, fallback, fallbackWhere) {
    let cur = value || '';
    const name = h('span', { class: 'fp-name' }), where = h('span', { class: 'fp-where' }), reset = h('button', { class: 'set-btn ghost', type: 'button', onclick: () => { cur = ''; paint(); } }, 'Reset');
    const paint = () => {
      const parts = cur.replace(/\/+$/, '').split('/');
      name.textContent = cur ? parts.pop() || '/' : fallback;
      where.textContent = cur ? parts.join('/') || '/' : fallbackWhere;
      reset.hidden = !cur;
      box.title = cur || fallback;
    };
    const box = h('div', { class: 'fp' }, h('span', { class: 'fp-ic', 'aria-hidden': 'true' }), h('span', { class: 'fp-text' }, name, where));
    const el = h('div', { class: 'fp-wrap' }, box, h('button', { class: 'set-btn', type: 'button', 'aria-label': `Choose ${label.toLowerCase()}`, onclick: async () => { const d = await bridge.chooseDir(label); if (d) { cur = d; paint(); } } }, 'Choose…'), reset);
    paint();
    return { el, value: () => cur };
  }

  // Hosts as chips; type one and press Enter, comma or space to add it, Backspace on an empty field takes the last off.
  function chips(list) {
    const hosts = [...(list || [])];
    const wrap = h('div', { class: 'chips', onclick: e => { if (e.target === wrap) inp.focus(); } });
    const inp = h('input', { type: 'text', class: 'chip-in', placeholder: 'add a host, e.g. devbox.lan:8080', spellcheck: false, 'aria-label': 'Add a web host',
      onkeydown: e => {
        if (['Enter', ',', ' '].includes(e.key)) { e.preventDefault(); add(); }
        else if (e.key === 'Backspace' && !inp.value && hosts.length) { hosts.pop(); paint(); }
      }, onblur: () => add() });
    const add = () => { for (const v of inp.value.toLowerCase().split(/[\s,]+/).filter(Boolean)) if (!hosts.includes(v)) hosts.push(v); inp.value = ''; paint(); };
    const paint = () => wrap.replaceChildren(...hosts.map((x, i) => h('span', { class: 'chip-host' }, x, h('button', { type: 'button', class: 'chip-x', 'aria-label': `Remove ${x}`, onclick: () => { hosts.splice(i, 1); paint(); inp.focus(); } }, '×'))), inp);
    paint();
    return { el: wrap, value: () => { add(); return hosts; } };
  }

  // Click, then press the keys. Esc cancels, Off clears. The system-wide hotkey is held while recording so it can be re-pressed.
  function shortcut(value) {
    let cur = value || '', rec = false;
    const caps = h('span', { class: 'kc-caps' }), btn = h('button', { type: 'button', class: 'kc', 'aria-label': 'Phone shortcut: click, then press the keys', onclick: () => (rec ? stop() : start()), onblur: () => stop() }, caps);
    const off = h('button', { type: 'button', class: 'set-btn ghost', onclick: () => { stop(); cur = ''; paint(); } }, 'Off');
    const msg = h('span', { class: 'kc-msg', 'aria-live': 'polite' });
    const paint = (note = '') => {
      btn.classList.toggle('rec', rec); btn.dataset.accel = cur;
      const label = keys.label(cur);
      const m = mac && label.match(/^([⌃⌥⇧⌘]*)(.+)$/), parts = !label ? [] : m ? [...m[1], m[2]] : label.split('+');
      caps.replaceChildren(...(rec ? [h('span', { class: 'kc-wait' }, 'Press keys…')] : parts.length ? parts.map(k => h('kbd', null, k)) : [h('span', { class: 'kc-wait' }, 'None: top-bar icon only')]));
      off.hidden = !cur || rec; msg.textContent = note;
    };
    const onKey = e => {
      if (!rec) return;
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') { stop(); return; }
      const acc = HarborShortcutRecord.accelerator(e, mac);
      if (acc === '') return;
      if (acc === null) { paint(mac ? 'Hold ⌘, ⌃ or ⌥ with a letter, digit, Space or F-key.' : 'Hold Ctrl or Alt with a letter, digit, Space or F-key.'); return; }
      cur = acc; stop();
    };
    function start() { rec = true; bridge.holdPhoneKey(true); window.addEventListener('keydown', onKey, true); paint(); }
    function stop() { if (!rec) return; rec = false; bridge.holdPhoneKey(false); window.removeEventListener('keydown', onKey, true); paint(); }
    paint();
    return { el: h('div', { class: 'kc-wrap' }, btn, off, msg), value: () => cur, stop };
  }

  async function open() {
    const cur = await bridge.getSettings(), errors = deps.errors() || [];
    const dir = folder('Data folder', cur.dataDir, '.harbordeck', 'default, in your home folder'), root = folder('Artifact folder', cur.artifactRoot, 'Not set', 'paths resolve in the data folder only');
    const hosts = chips(cur.webHosts), key = shortcut(cur.phoneShortcut);
    const keyNote = { ok: 'Works from any app: brings the desk forward with the phone open.', taken: 'Taken by another app: works inside Harbor Deck only.', invalid: 'Not a valid shortcut.' }[cur.phoneKey] || '';
    const hookOn = h('input', { type: 'checkbox', class: 'set-switch', checked: !!cur.onAnswer.enabled, 'aria-label': 'Run a command on every answer' });
    const hookCmd = h('input', { type: 'text', class: 'set-cmd', value: cur.onAnswer.command || '', placeholder: '~/bin/wake-agent.sh', spellcheck: false, 'aria-label': 'On-answer command' });
    const demoBtn = (label, on) => h('button', { class: 'set-btn', type: 'button', onclick: () => deps.demo(on) }, label);
    const reading = h('p', { class: 'set-reading' }, h('span', { class: 'set-dot', 'aria-hidden': 'true' }), 'Reading ', h('code', null, cur.home), cur.demo ? ' (demo data)' : '', cur.envHome && !cur.demo ? h('span', { class: 'set-warn' }, 'Set by HARBORDECK_HOME, which wins over the folder below.') : null);
    const content = h('div', { class: 'settings' },
      errors.length ? h('div', { class: 'flag-note' }, h('div', null, `${errors.length} item file(s) skipped:`), errors.slice(0, 8).map(e => h('div', null, `${e.file}: ${e.error}`))) : null,
      section('General', null,
        row('Artifact folder', 'Relative paths not found in the data folder resolve here.', root.el),
        row('Web hosts', 'Besides localhost, sites the desk browser may show.', hosts.el),
        row('Demo data', 'A made-up harbor to try the desk.', demoBtn(cur.demo ? 'Restart demo' : 'Load demo data', true), cur.demo ? demoBtn('Back to my data', false) : null)),
      section('Phone', null,
        row('Shortcut', keyNote || 'Opens the ship phone.', key.el)),
      section('Agent connection', null, reading,
        row('Data folder', 'Agents leave items here and read your answers.', dir.el)),
      h('details', { class: 'set-sec set-adv', open: !!cur.onAnswer.enabled || null },
        h('summary', { class: 'set-h' }, 'Advanced', h('span', { class: 'set-sub' }, cur.onAnswer.enabled ? 'on answer: on' : '')),
        row('On answer', 'Runs after every answer line; it gets the line on stdin and in $HARBORDECK_LINE.', h('label', { class: 'set-check' }, hookOn, 'Run'), hookCmd)));
    const save = async () => {
      key.stop();
      deps.commitPending();
      const snap = await bridge.setSettings({ dataDir: dir.value(), artifactRoot: root.value(), webHosts: hosts.value(), phoneShortcut: key.value(), onAnswer: { enabled: hookOn.checked, command: hookCmd.value.trim() } });
      closeModal(); deps.apply(snap);
    };
    modal('settings-modal', 'Settings', content, [h('button', { class: 'pbtn ghost', onclick: () => { key.stop(); closeModal(); } }, 'Cancel'), h('button', { class: 'pbtn', onclick: save }, 'Save')]);
  }
  return { open };
};
