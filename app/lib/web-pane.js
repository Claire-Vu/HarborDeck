'use strict';
// In-desk browser pane: one WebContentsView laid over the renderer's mount box. The page gets its own
// session partition, no preload (so no window.harbor), no node, and every permission denied. Main-frame
// navigations and popups that leave the allow-list (web-allow.js) are cancelled and opened in the system browser.
const { WebContentsView, session } = require('electron');
const { isAllowedWebUrl } = require('./web-allow');

const PARTITION = 'persist:harbor-web';
let hardened = false;

function hardenSession() {
  if (hardened) return;
  hardened = true;
  const ses = session.fromPartition(PARTITION);
  ses.setPermissionRequestHandler((wc, permission, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
  ses.on('will-download', (e, item) => item.cancel());
}

// getWin(): the host BrowserWindow; getHosts(): extra allowed hosts; openExternal(url); log(msg).
function createWebPane({ getWin, getHosts, openExternal, log }) {
  let view = null;
  const allowed = url => isAllowedWebUrl(url, getHosts());
  const send = (extra = {}) => {
    const win = getWin();
    if (!view || !win || win.isDestroyed()) return;
    const wc = view.webContents;
    win.webContents.send('harbor:web-state', { url: wc.getURL(), title: wc.getTitle(), loading: wc.isLoading(), canGoBack: wc.navigationHistory.canGoBack(), ...extra });
  };
  const leave = url => { log(`web pane: opened outside ${url}`); openExternal(url); send({ notice: `Opened in your browser: ${url}` }); };

  function ensure() {
    if (view) return view;
    hardenSession();
    view = new WebContentsView({ webPreferences: { partition: PARTITION, nodeIntegration: false, contextIsolation: true, sandbox: true, webviewTag: false, navigateOnDragDrop: false, safeDialogs: true, spellcheck: false } });
    const wc = view.webContents;
    wc.setWindowOpenHandler(({ url }) => { if (allowed(url)) wc.loadURL(url); else leave(url); return { action: 'deny' }; });
    const guard = (e, url) => { const to = e.url || url; if (e.isMainFrame !== false && !allowed(to)) { e.preventDefault(); leave(to); } };
    wc.on('will-navigate', guard);
    wc.on('will-redirect', guard);
    for (const ev of ['did-start-loading', 'did-stop-loading', 'did-navigate', 'did-navigate-in-page', 'page-title-updated']) wc.on(ev, () => send());
    wc.on('did-fail-load', (e, code, desc, url, isMainFrame) => { if (isMainFrame && code !== -3) send({ error: `${desc} (${code})` }); });
    getWin().contentView.addChildView(view);
    return view;
  }

  function setBounds(rect) {
    const win = getWin();
    if (!view || !win || !rect) return;
    const z = win.webContents.getZoomFactor();
    const r = k => Math.max(0, Math.round((Number(rect[k]) || 0) * z));
    view.setBounds({ x: r('x'), y: r('y'), width: r('width'), height: r('height') });
  }

  return {
    open(url, rect) {
      url = String(url || '');
      if (!allowed(url)) return { ok: false, error: 'This address is not on this machine. Add its host in Settings to view it here.' };
      const v = ensure();
      setBounds(rect);
      v.webContents.loadURL(url).catch(err => send({ error: err.message }));
      v.webContents.focus();
      return { ok: true };
    },
    setBounds,
    go(cmd) {
      if (!view) return;
      const wc = view.webContents;
      if (cmd === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
      else if (cmd === 'reload') wc.reload();
      else if (cmd === 'external') { const u = wc.getURL(); if (/^https?:/i.test(u)) openExternal(u); }
    },
    close() {
      if (!view) return;
      const win = getWin();
      if (win && !win.isDestroyed()) win.contentView.removeChildView(view);
      view.webContents.close();
      view = null;
    }
  };
}

module.exports = { createWebPane, PARTITION };
