/* Settings modal.
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

// ------------------------------------------------------------ settings
async function openSettings() {
  const cur = await bridge.getSettings();
  const field = (label, value, hint, choose) => {
    const inp = h('input', { type: 'text', value: value || '', placeholder: hint, spellcheck: false });
    return { inp, row: h('label', { class: 'set-row' }, h('span', { class: 'set-l' }, label), h('span', { class: 'set-in' }, inp, choose ? h('button', { class: 'tbtn', type: 'button', onclick: async () => { const d = await bridge.chooseDir(label); if (d) inp.value = d; } }, 'Choose…') : null)) };
  };
  const dir = field('Data directory', cur.dataDir, '~/.harbordeck', true);
  const root = field('Artifact root', cur.artifactRoot, 'optional: relative paths not found in the data directory resolve here', true);
  const hosts = field('Web hosts', (cur.webHosts || []).join(', '), 'optional: hosts besides localhost the desk browser may show, e.g. devbox.lan:8080');
  const phoneKey = field('Phone shortcut', cur.phoneShortcut, 'empty: no shortcut, the top-bar icon only. e.g. CommandOrControl+Shift+Space');
  const phoneNote = { ok: 'Works from any app: brings the desk forward with the phone open.', taken: 'Taken by another app: works inside Harbor Deck only.', invalid: 'Not a valid shortcut.', off: '' }[cur.phoneKey] || '';
  const hookOn = h('input', { type: 'checkbox', checked: !!cur.onAnswer.enabled });
  const hookCmd = h('textarea', { rows: 2, placeholder: 'e.g. ~/bin/wake-agent.sh   (the JSON line arrives on stdin and in $HARBORDECK_LINE)', value: cur.onAnswer.command || '', spellcheck: false });
  const content = h('div', { class: 'settings' },
    h('p', { class: 'legend' }, 'Now reading ', h('code', null, cur.home), cur.demo ? ' (demo data)' : '', cur.envHome && !cur.demo ? ' · set by HARBORDECK_HOME, which wins over the field below' : ''),
    dir.row, root.row, hosts.row, phoneKey.row, phoneNote ? h('p', { class: 'legend set-hint' }, phoneNote) : null,
    h('div', { class: 'set-row' }, h('span', { class: 'set-l' }, 'On answer'), h('span', { class: 'set-in col' }, h('label', { class: 'set-check' }, hookOn, ' Run a command after every line written to answers.jsonl'), hookCmd)),
    h('div', { class: 'set-row' }, h('span', { class: 'set-l' }, 'Demo'), h('span', { class: 'set-in' },
      h('button', { class: 'tbtn', type: 'button', onclick: async () => { commitPending(); closeModal(); applySnapshot(await bridge.demo(true)); } }, cur.demo ? 'Restart demo' : 'Load demo data'),
      cur.demo ? h('button', { class: 'tbtn', type: 'button', onclick: async () => { commitPending(); closeModal(); applySnapshot(await bridge.demo(false)); } }, 'Back to my data') : null)),
    SNAP.errors?.length ? h('div', { class: 'flag-note' }, h('div', null, `${SNAP.errors.length} item file(s) skipped:`), SNAP.errors.slice(0, 8).map(e => h('div', null, `${e.file}: ${e.error}`))) : null);
  modal('settings-modal', 'Settings', content, [h('button', { class: 'pbtn ghost', onclick: closeModal }, 'Cancel'), h('button', { class: 'pbtn', onclick: async () => {
    commitPending();
    const snap = await bridge.setSettings({ dataDir: dir.inp.value.trim(), artifactRoot: root.inp.value.trim(), webHosts: hosts.inp.value, phoneShortcut: phoneKey.inp.value.trim(), onAnswer: { enabled: hookOn.checked, command: hookCmd.value.trim() } });
    closeModal(); applySnapshot(snap);
  } }, 'Save')]);
}
