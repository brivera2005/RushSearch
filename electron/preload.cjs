'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rushSearch', {
  search: (query) => ipcRenderer.invoke('search', query),
  shellAction: (action, filePath, extra) => ipcRenderer.invoke('shell-action', action, filePath, extra),
  hide: () => ipcRenderer.invoke('hide'),
  indexStatus: () => ipcRenderer.invoke('index-status'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (partial) => ipcRenderer.invoke('set-settings', partial),
  reindex: () => ipcRenderer.invoke('reindex'),
  onFocusInput: (cb) => ipcRenderer.on('focus-input', cb),
  onClear: (cb) => ipcRenderer.on('clear', () => cb()),
  onIndexStatus: (cb) => ipcRenderer.on('index-status', (_e, data) => cb(data)),
  onSettingsChanged: (cb) => ipcRenderer.on('settings-changed', (_e, data) => cb(data)),
});
