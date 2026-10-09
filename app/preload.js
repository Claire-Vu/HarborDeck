'use strict';
// The renderer's only door to the system. Everything here is a narrow, validated IPC call.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('harbor', {
  snapshot: () => ipcRenderer.invoke('harbor:snapshot'),
  // Synchronous on purpose: a held stamp line is flushed from beforeunload and must land before the window goes.
  appendAnswer: line => ipcRenderer.sendSync('harbor:answer', line),
  onUpdate: fn => ipcRenderer.on('harbor:update', (e, snap) => fn(snap)),
  onMenu: fn => ipcRenderer.on('harbor:menu', (e, what) => fn(what)),
  onPhone: fn => ipcRenderer.on('harbor:phone', (e, how) => fn(how)),
  schedule: req => ipcRenderer.invoke('harbor:schedule', req),
  cancelScheduled: id => ipcRenderer.invoke('harbor:schedule-cancel', id),
  // Images for answers: bytes in, a path under <home>/attachments out (snap captures this window).
  attach: bytes => ipcRenderer.invoke('harbor:attach', bytes),
  snap: () => ipcRenderer.invoke('harbor:snap'),
  openExternal: url => ipcRenderer.invoke('harbor:open-external', url),
  openPath: url => ipcRenderer.invoke('harbor:open-path', url),
  getSettings: () => ipcRenderer.invoke('harbor:get-settings'),
  setSettings: s => ipcRenderer.invoke('harbor:set-settings', s),
  chooseDir: title => ipcRenderer.invoke('harbor:choose-dir', title),
  holdPhoneKey: on => ipcRenderer.send('harbor:phone-key-hold', !!on),
  demo: on => ipcRenderer.invoke('harbor:demo', on),
  diagnostics: () => ipcRenderer.invoke('harbor:diagnostics'),
  // In-desk browser pane (app/lib/web-pane.js): the page itself runs in a separate view without this bridge.
  web: {
    open: (url, rect) => ipcRenderer.invoke('harbor:web-open', url, rect),
    bounds: rect => ipcRenderer.send('harbor:web-bounds', rect),
    go: cmd => ipcRenderer.invoke('harbor:web-go', cmd),
    close: () => ipcRenderer.invoke('harbor:web-close'),
    onState: fn => ipcRenderer.on('harbor:web-state', (e, s) => fn(s))
  }
});
