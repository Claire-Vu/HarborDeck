'use strict';
// The renderer's only door to the system. Everything here is a narrow, validated IPC call.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('harbor', {
  snapshot: () => ipcRenderer.invoke('harbor:snapshot'),
  // Synchronous on purpose: a held stamp line is flushed from beforeunload and must land before the window goes.
  appendAnswer: line => ipcRenderer.sendSync('harbor:answer', line),
  onUpdate: fn => ipcRenderer.on('harbor:update', (e, snap) => fn(snap)),
  onMenu: fn => ipcRenderer.on('harbor:menu', (e, what) => fn(what)),
  openExternal: url => ipcRenderer.invoke('harbor:open-external', url),
  openPath: url => ipcRenderer.invoke('harbor:open-path', url),
  getSettings: () => ipcRenderer.invoke('harbor:get-settings'),
  setSettings: s => ipcRenderer.invoke('harbor:set-settings', s),
  chooseDir: title => ipcRenderer.invoke('harbor:choose-dir', title),
  demo: on => ipcRenderer.invoke('harbor:demo', on),
  diagnostics: () => ipcRenderer.invoke('harbor:diagnostics')
});
