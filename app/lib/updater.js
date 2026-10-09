'use strict';
// Update check against GitHub Releases (electron-updater reads latest-mac.yml from the newest release).
// A Developer ID-signed build downloads the update and installs it on restart. An unsigned or ad-hoc build cannot:
// Squirrel.Mac only applies an update whose signature matches the running app's. Such a build, and any failed
// download, falls back to "version X is out" with a link to the release page.
// state.status: idle | checking | none | available (manual download: url) | downloading | ready (restart) | error
function createUpdater({ autoUpdater, signed, releasesUrl, onState, log = () => {} }) {
  let state = { status: 'idle' };
  const set = next => { state = { ...next, signed }; onState(state); };
  // electron-updater's messages are for developers; the two a user meets get a plain line
  const readable = err => { const m = String((err && err.message) || err);
    return /latest-mac\.yml|404/.test(m) ? 'no release is published yet' : /ERR_INTERNET|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/.test(m) ? 'no connection to GitHub' : m.split('\n')[0]; };
  const manual = version => set({ status: 'available', version, url: `${releasesUrl}/tag/v${version}` });

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = signed;
  autoUpdater.logger = null;
  autoUpdater.on('update-available', info => {
    if (!signed) return manual(info.version);
    set({ status: 'downloading', version: info.version });
    autoUpdater.downloadUpdate().catch(() => { /* reported by the 'error' event */ });
  });
  autoUpdater.on('update-not-available', () => set({ status: 'none' }));
  autoUpdater.on('update-downloaded', info => set({ status: 'ready', version: info.version }));
  autoUpdater.on('error', err => {
    log(`update: ${err && err.message}`);
    if (state.version) manual(state.version); // found one but could not fetch or apply it: hand over the download link
    else set({ status: 'error', error: readable(err), url: releasesUrl });
  });

  return {
    state: () => state,
    async check() {
      if (state.status === 'checking' || state.status === 'downloading' || state.status === 'ready') return state;
      set({ status: 'checking' });
      try { await autoUpdater.checkForUpdates(); } catch (e) { /* the 'error' event already reported it */ }
      return state;
    },
    install() { if (state.status === 'ready') autoUpdater.quitAndInstall(); }
  };
}

// Developer ID-signed: the only kind Squirrel.Mac will update in place.
function isDeveloperIdSigned(appBundle, spawnSync = require('child_process').spawnSync) {
  const r = spawnSync('codesign', ['-dv', '--verbose=2', appBundle], { encoding: 'utf8' }); // prints to stderr
  return r.status === 0 && /Authority=Developer ID Application/.test(`${r.stderr}${r.stdout}`);
}

module.exports = { createUpdater, isDeveloperIdSigned };
