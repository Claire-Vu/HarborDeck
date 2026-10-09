/* Harbor Deck renderer: update notices (app/lib/updater.js). A new version stays in the corner until dismissed:
   "Restart to update" when it is downloaded, else a link to the release page (unsigned builds cannot update in place).
   A manual "Check for Updates…" (menu) also reports up to date, failures, and source checkouts. Loaded before app.js. */
'use strict';
window.HarborUpdates = ({ h, toast, bridge }) => {
  let shown = '';
  function show(s, manual) {
    if (s.status === 'available' || s.status === 'ready') {
      const key = `${s.status}:${s.version}`;
      if (key === shown && !manual) return;
      shown = key;
      document.querySelector('#toasts .toast.update')?.remove();
      const t = h('div', { class: 'toast warn update', role: 'alert' }, h('span', null, `Harbor Deck ${s.version} ${s.status === 'ready' ? 'is ready.' : 'is out.'}`),
        s.status === 'ready'
          ? h('button', { class: 'toast-act', type: 'button', onclick: () => bridge.updates.install() }, 'Restart to update')
          : h('button', { class: 'toast-act', type: 'button', onclick: () => bridge.openExternal(s.url) }, 'Download'),
        h('button', { class: 'toast-x', type: 'button', 'aria-label': 'Dismiss', onclick: () => t.remove() }, '×'));
      document.querySelector('#toasts').append(t);
    } else if (manual) {
      if (s.status === 'none') toast('Harbor Deck is up to date.');
      else if (s.status === 'downloading') toast(`Downloading Harbor Deck ${s.version}…`);
      else if (s.status === 'checking') toast('Already checking for updates…');
      else if (s.status === 'unsupported') toast('Updates come from git in a source checkout; the installed app checks GitHub Releases.');
      else if (s.status === 'error') toast(`Could not check for updates: ${s.error}`, 'warn');
    }
  }
  const check = async () => show(await bridge.updates.check(), true);
  bridge.updates.onState(s => show(s, false));
  bridge.onMenu(what => { if (what === 'check-updates') check(); });
  // Settings > General > Version: this version, and a check that reports its result like the menu item does.
  const settingsControls = cur => [h('span', { class: 'set-ver' }, `${cur.version}${cur.packaged ? '' : ' (source checkout)'}`), h('button', { class: 'set-btn', type: 'button', id: 'btn-update-check', onclick: check }, 'Check for updates')];
  return { check, settingsControls };
};
