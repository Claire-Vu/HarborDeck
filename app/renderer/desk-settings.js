/* Settings: opens the dialog (settings-view.js) with what it needs from the desk.
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

// ------------------------------------------------------------ settings
let settingsView = null;
function openSettings() {
  settingsView ||= window.HarborSettings({ h, bridge, keys: HarborPhoneKeys, modal, closeModal, commitPending, apply: applySnapshot, errors: () => SNAP.errors,
    connectButtons: () => connectView.settingsButtons(), versionControls: cur => updates.settingsControls(cur),
    demo: async on => { commitPending(); closeModal(); applySnapshot(await bridge.demo(on)); } });
  return settingsView.open();
}
