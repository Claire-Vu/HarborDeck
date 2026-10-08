'use strict';
// Electron main process: owns the data directory (read, watch, append answers), the harbor:// file protocol,
// settings, the optional on-answer hook and demo mode. The renderer only talks through preload.js.
const { app, BrowserWindow, ipcMain, protocol, shell, dialog, Menu, nativeTheme } = require('electron');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const store = require('./lib/store');
const { watchHome } = require('./lib/watch');
const { runOnAnswer } = require('./lib/hook');
const { loadSettings, saveSettings, effectiveHome } = require('./lib/settings');
const { seedDemo } = require('./demo/seed');
const { startDemoAgent } = require('./demo/agent');

// Isolated profile (settings, desk state, demo dir) for tests and side-by-side runs.
if (process.env.HARBORDECK_USER_DATA) app.setPath('userData', path.resolve(process.env.HARBORDECK_USER_DATA));
protocol.registerSchemesAsPrivileged([{ scheme: 'harbor', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');
const DEMO_HOME = () => path.join(app.getPath('userData'), 'demo');
let settings, home, demo = false, demoSeed = 0, watcher = null, demoAgent = null, win = null, allowed = new Set(), logLines = [];

function log(msg) { logLines.push(`${new Date().toISOString()} ${msg}`); if (logLines.length > 200) logLines.shift(); if (!app.isPackaged) console.log('[harbordeck]', msg); }

function snapshot() {
  const snap = store.snapshot(home, { artifactRoot: settings.artifactRoot });
  allowed = new Set(Object.values(snap.files).filter(f => f && f.exists).map(f => f.abs));
  return Object.assign(snap, { demo, demoSeed: demo ? demoSeed : 0, settings: publicSettings() });
}
const publicSettings = () => ({ ...settings, home, demo, envHome: process.env.HARBORDECK_HOME || '' });

function useHome(next, isDemo) {
  watcher?.close(); demoAgent?.stop(); demoAgent = null;
  demo = !!isDemo; home = next; store.ensureHome(home);
  watcher = watchHome(home, () => { if (win && !win.isDestroyed()) win.webContents.send('harbor:update', snapshot()); });
  if (demo) demoAgent = startDemoAgent(home);
  log(`data directory: ${home}${demo ? ' (demo)' : ''}`);
}
function startDemo() { seedDemo(DEMO_HOME()); demoSeed = Date.now(); useHome(DEMO_HOME(), true); }
function reload() { if (win && !win.isDestroyed()) win.webContents.send('harbor:update', snapshot()); }

// harbor://file/<encoded absolute path>: only files referenced by current items, with Range support for video.
function serveFile(request) {
  const abs = store.pathFromUrl(request.url);
  if (!abs || !allowed.has(abs)) return new Response('not found', { status: 404 });
  let stat; try { stat = fs.statSync(abs); } catch (e) { return new Response('not found', { status: 404 }); }
  const type = store.mimeFor(abs) || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' };
  // SVG and text are inert documents here: no script even if one is ever framed directly.
  if (/svg|text|json/.test(type)) headers['Content-Security-Policy'] = "default-src 'none'; img-src harbor: data:; style-src 'unsafe-inline'";
  const range = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') || '');
  if (range && stat.size) {
    const start = range[1] ? +range[1] : Math.max(0, stat.size - +range[2]);
    const end = range[1] && range[2] ? Math.min(+range[2], stat.size - 1) : stat.size - 1;
    if (start > end || start >= stat.size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
    return new Response(Readable.toWeb(fs.createReadStream(abs, { start, end })), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': String(end - start + 1) } });
  }
  return new Response(Readable.toWeb(fs.createReadStream(abs)), { status: 200, headers: { ...headers, 'Content-Length': String(stat.size) } });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600, title: 'Harbor Deck', backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1923' : '#dde8ef',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false, plugins: true }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); openExternal(url); } });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}
function openExternal(url) { if (/^https?:\/\//i.test(url)) shell.openExternal(url); }

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const send = what => () => win?.webContents.send('harbor:menu', what);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu', submenu: [{ role: 'about' }, { type: 'separator' }, { label: 'Settings…', accelerator: 'Cmd+,', click: send('settings') }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: 'File', submenu: [
      ...(isMac ? [] : [{ label: 'Settings…', accelerator: 'Ctrl+,', click: send('settings') }]),
      { label: 'Open Data Folder', click: () => shell.openPath(home) },
      { label: 'Reload Data', accelerator: 'CmdOrCtrl+Shift+R', click: reload },
      { type: 'separator' },
      { label: 'Load Demo Data', click: send('demo-on') },
      { label: 'Back to My Data', click: send('demo-off') },
      { type: 'separator' }, isMac ? { role: 'close' } : { role: 'quit' }] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' }
  ]));
}

ipcMain.handle('harbor:snapshot', () => snapshot());
ipcMain.on('harbor:answer', (e, line) => {
  try {
    const text = store.appendAnswer(home, line);
    if (settings.onAnswer.enabled) runOnAnswer(settings.onAnswer.command, text, home, { log });
    e.returnValue = { ok: true, line: text };
  } catch (err) { log(`answer rejected: ${err.message}`); e.returnValue = { ok: false, error: err.message }; }
});
ipcMain.handle('harbor:open-external', (e, url) => openExternal(String(url)));
ipcMain.handle('harbor:open-path', (e, url) => { const abs = store.pathFromUrl(url); if (abs && allowed.has(abs)) return shell.openPath(abs); return 'not allowed'; });
ipcMain.handle('harbor:get-settings', () => publicSettings());
ipcMain.handle('harbor:set-settings', (e, next) => {
  settings = saveSettings(SETTINGS_FILE(), next);
  if (!demo) useHome(effectiveHome(settings), false);
  return snapshot();
});
ipcMain.handle('harbor:choose-dir', async (e, title) => {
  const r = await dialog.showOpenDialog(win, { title: String(title || 'Choose a folder'), properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('harbor:demo', (e, on) => { if (on) startDemo(); else useHome(effectiveHome(settings), false); return snapshot(); });
ipcMain.handle('harbor:diagnostics', () => logLines.slice(-50));

app.whenReady().then(() => {
  settings = loadSettings(SETTINGS_FILE());
  const wantDemo = process.argv.includes('--demo') || process.env.HARBORDECK_DEMO === '1';
  if (wantDemo) startDemo(); else useHome(effectiveHome(settings), false);
  protocol.handle('harbor', serveFile);
  buildMenu(); createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => { watcher?.close(); demoAgent?.stop(); });
