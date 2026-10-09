'use strict';
// Electron main process: owns the data directory (read, watch, append answers), the harbor:// file protocol,
// settings, the optional on-answer hook, the in-desk browser pane and demo mode. The renderer only talks through preload.js.
const { app, BrowserWindow, ipcMain, protocol, shell, dialog, Menu, nativeTheme, globalShortcut } = require('electron');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const store = require('./lib/store');
const attach = require('./lib/attach');
const { watchHome } = require('./lib/watch');
const { runOnAnswer } = require('./lib/hook');
const { loadSettings, saveSettings, effectiveHome } = require('./lib/settings');
const { seedDemo } = require('./demo/seed');
const { startDemoAgent } = require('./demo/agent');
const { startStaticSite } = require('./demo/static-site');
const { createWebPane } = require('./lib/web-pane');

// Isolated profile (settings, desk state, demo dir) for tests and side-by-side runs.
if (process.env.HARBORDECK_USER_DATA) app.setPath('userData', path.resolve(process.env.HARBORDECK_USER_DATA));
// Headless (tests, verification): the window is never shown, focused or in the Dock, yet keeps painting
// so CDP/Playwright screenshots and UI driving work.
const headless = process.env.HARBORDECK_HEADLESS === '1';
if (headless && process.platform === 'darwin') app.setActivationPolicy('prohibited');
protocol.registerSchemesAsPrivileged([{ scheme: 'harbor', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');
const DEMO_HOME = () => path.join(app.getPath('userData'), 'demo');
// The limit-reset scheduler is the CLI's own module (ESM), so the app and `harbordeck tick` share one queue format.
let sched = null;
const schedReady = import('../cli/src/scheduler.js').then(m => { sched = m; }, e => log(`scheduler unavailable: ${e.message}`));
let topicsMod = null; // topic derivation shared with `harbordeck topic`
const topicsReady = import('../cli/src/topics.js').then(m => { topicsMod = m; }, e => log(`topics unavailable: ${e.message}`));
let settings, home, demo = false, demoSeed = 0, watcher = null, demoAgent = null, demoSite = null, win = null, allowed = new Set(), pageDirs = [], logLines = [];

function log(msg) { logLines.push(`${new Date().toISOString()} ${msg}`); if (logLines.length > 200) logLines.shift(); if (!app.isPackaged) console.log('[harbordeck]', msg); }

function snapshot() {
  const snap = store.snapshot(home, { artifactRoot: settings.artifactRoot });
  allowed = new Set(Object.values(snap.files).filter(f => f && f.exists).map(f => f.abs));
  pageDirs = store.pageDirs(snap.files);
  let scheduler = null;
  try { scheduler = sched ? sched.statusData(home) : null; } catch (e) { log(`scheduler status: ${e.message}`); }
  const topics = topicsMod ? topicsMod.buildTopics(snap) : {};
  return Object.assign(snap, { scheduler, topics, demo, demoSeed: demo ? demoSeed : 0, settings: publicSettings() });
}
const publicSettings = () => ({ ...settings, home, demo, envHome: process.env.HARBORDECK_HOME || '', phoneKey: phoneKey.state });

function useHome(next, isDemo) {
  watcher?.close(); demoAgent?.stop(); demoAgent = null;
  demo = !!isDemo; home = next; store.ensureHome(home);
  watcher = watchHome(home, () => { if (win && !win.isDestroyed()) win.webContents.send('harbor:update', snapshot()); });
  if (demo) demoAgent = startDemoAgent(home);
  log(`data directory: ${home}${demo ? ' (demo)' : ''}`);
}
async function startDemo() {
  try { demoSite ??= await startStaticSite(path.join(__dirname, 'demo', 'assets', 'web')); } catch (e) { log(`demo web page unavailable: ${e.message}`); }
  seedDemo(DEMO_HOME(), undefined, { webUrl: demoSite?.url }); demoSeed = Date.now(); useHome(DEMO_HOME(), true);
}
function reload() { if (win && !win.isDestroyed()) win.webContents.send('harbor:update', snapshot()); }

// harbor://file/<encoded absolute path>: only files referenced by current items, with Range support for video.
function serveFile(request) {
  const abs = store.pathFromUrl(request.url);
  if (!abs || !allowed.has(abs)) return new Response('not found', { status: 404 });
  return sendFile(request, abs, false);
}
// harbor://page/<path> in the browser pane's session only: a referenced local .html file and anything in its folder.
// Hidden files and folders (.ssh, .env, ...) are never served, even inside such a folder.
const localPage = abs => !!abs && pageDirs.some(d => abs.startsWith(d + path.sep) && !abs.slice(d.length + 1).split(path.sep).some(s => s.startsWith('.')));
function servePage(request) {
  const abs = store.pathFromPageUrl(request.url);
  if (!localPage(abs)) return new Response('not found', { status: 404 });
  return sendFile(request, abs, true);
}
function sendFile(request, abs, page) {
  let stat; try { stat = fs.statSync(abs); } catch (e) { return new Response('not found', { status: 404 }); }
  const type = store.mimeFor(abs) || (page && { '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript' }[path.extname(abs).toLowerCase()]) || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' };
  // SVG and text are inert documents here: no script even if one is ever framed directly.
  if (!page && /svg|text|json/.test(type)) headers['Content-Security-Policy'] = "default-src 'none'; img-src harbor: data:; style-src 'unsafe-inline'";
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
    show: !headless, paintWhenInitiallyHidden: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false, plugins: true, backgroundThrottling: !headless }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); openExternal(url); } });
  win.webContents.on('did-start-navigation', e => { if (e.isMainFrame && !e.isSameDocument) webPane.close(); }); // a renderer reload drops the pane's frame
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}
// Ship phone: settings.phoneShortcut is a system-wide hotkey that brings the desk forward with the phone open. It is
// the only thing that ever raises the window. Headless runs never register it (it would grab the key system-wide).
let phoneKey = { accelerator: '', state: 'off' }; // state: ok | taken (another app holds it) | invalid | off
function registerPhoneKey() {
  if (phoneKey.state === 'ok') globalShortcut.unregister(phoneKey.accelerator);
  phoneKey = { accelerator: settings.phoneShortcut, state: 'off' };
  if (!phoneKey.accelerator || headless) return;
  try { phoneKey.state = globalShortcut.register(phoneKey.accelerator, phoneHotkey) ? 'ok' : 'taken'; } catch (e) { phoneKey.state = 'invalid'; }
  log(`phone shortcut ${phoneKey.accelerator}: ${phoneKey.state}`);
}
function phoneHotkey() {
  if (!win || win.isDestroyed()) return;
  const front = win.isFocused();
  if (!headless) { if (win.isMinimized()) win.restore(); win.show(); app.focus({ steal: true }); win.focus(); }
  win.webContents.send('harbor:phone', front ? 'toggle' : 'open');
}
app.on('harbor:phone-hotkey', phoneHotkey); // test seam: smoke tests fire the hotkey without a system-wide registration
function openExternal(url) { if (/^https?:\/\//i.test(url)) shell.openExternal(url); }
const webPane = createWebPane({ getWin: () => win, getHosts: () => settings.webHosts, isLocalPage: url => localPage(store.pathFromPageUrl(url)), servePage, openExternal, log });

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
// Queue a request for after the usage-limit reset (when: 'reset') or a time (epoch); `harbordeck tick` delivers it.
ipcMain.handle('harbor:schedule', (e, req) => {
  try {
    if (!sched) throw new Error('scheduler unavailable');
    const r = req && req.request;
    if (!r || typeof r.note !== 'string') throw new Error('invalid request');
    const when = req.when === 'reset' ? 'reset' : Math.floor(+req.when);
    const attachments = attach.clean(home, r.attachments) || undefined; // written with the request line at delivery
    const out = sched.enqueue(home, { when, request: { id: String(r.id), note: r.note, to: r.to ? String(r.to) : undefined, rule: r.rule === true, attachments } });
    log(`queued ${out.id}`);
    return { ok: true, id: out.id, snapshot: snapshot() };
  } catch (err) { log(`schedule rejected: ${err.message}`); return { ok: false, error: err.message }; }
});
ipcMain.handle('harbor:schedule-cancel', (e, id) => {
  try { const hits = sched ? sched.cancel(home, String(id)) : []; return { ok: hits.length > 0, snapshot: snapshot() }; } catch (err) { return { ok: false, error: err.message }; }
});
// An image the user pasted, dropped or snapped: copied into <home>/attachments at once (lib/attach.js validates
// type and size). The renderer keeps its own bytes for previews; answers name the returned path.
ipcMain.handle('harbor:attach', (e, bytes) => {
  try { const r = attach.save(home, bytes); log(`attached ${path.basename(r.path)}`); return { ok: true, path: r.path }; }
  catch (err) { log(`attach refused: ${err.message}`); return { ok: false, error: err.message }; }
});
// Snap: this window only (no Screen Recording permission). The renderer hides its own overlays first.
ipcMain.handle('harbor:snap', async () => {
  try {
    if (!win || win.isDestroyed()) throw new Error('no window');
    // capturePage can hand back the last composited frame: force a fresh paint of the overlay-free page first
    win.webContents.invalidate(); await new Promise(r => setTimeout(r, 120));
    const png = (await win.webContents.capturePage()).toPNG();
    const r = attach.save(home, png); log(`snapped ${path.basename(r.path)}`);
    return { ok: true, path: r.path, bytes: png };
  } catch (err) { log(`snap failed: ${err.message}`); return { ok: false, error: err.message }; }
});
ipcMain.handle('harbor:open-external', (e, url) => openExternal(String(url)));
ipcMain.handle('harbor:open-path', (e, url) => { const abs = store.pathFromUrl(url); if (abs && allowed.has(abs)) return shell.openPath(abs); return 'not allowed'; });
ipcMain.handle('harbor:get-settings', () => publicSettings());
ipcMain.handle('harbor:set-settings', (e, next) => {
  settings = saveSettings(SETTINGS_FILE(), next);
  registerPhoneKey();
  if (!demo) useHome(effectiveHome(settings), false);
  return snapshot();
});
// Settings records a new phone shortcut by key press: the system-wide hotkey is let go meanwhile so it reaches the page.
ipcMain.on('harbor:phone-key-hold', (e, on) => { if (!on) registerPhoneKey(); else if (phoneKey.state === 'ok') globalShortcut.unregister(phoneKey.accelerator); });
ipcMain.handle('harbor:choose-dir', async (e, title) => {
  const r = await dialog.showOpenDialog(win, { title: String(title || 'Choose a folder'), properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('harbor:demo', async (e, on) => { if (on) await startDemo(); else useHome(effectiveHome(settings), false); return snapshot(); });
ipcMain.handle('harbor:diagnostics', () => logLines.slice(-50));
ipcMain.handle('harbor:web-open', (e, url, rect) => webPane.open(url, rect));
ipcMain.on('harbor:web-bounds', (e, rect) => webPane.setBounds(rect));
ipcMain.handle('harbor:web-go', (e, cmd) => webPane.go(String(cmd)));
ipcMain.handle('harbor:web-close', () => webPane.close());

app.whenReady().then(async () => {
  await schedReady; await topicsReady;
  settings = loadSettings(SETTINGS_FILE());
  const wantDemo = process.argv.includes('--demo') || process.env.HARBORDECK_DEMO === '1';
  if (wantDemo) await startDemo(); else useHome(effectiveHome(settings), false);
  protocol.handle('harbor', serveFile);
  buildMenu(); createWindow(); registerPhoneKey();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); watcher?.close(); demoAgent?.stop(); demoSite?.close(); });
