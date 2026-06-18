'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rushSearch', {
  search: (query) => ipcRenderer.invoke('search', query),
  shellAction: (action, filePath, extra) => ipcRenderer.invoke('shell-action', action, filePath, extra),
  hide: () => ipcRenderer.invoke('hide'),
  indexStatus: () => ipcRenderer.invoke('index-status'),
  onFocusInput: (cb) => ipcRenderer.on('focus-input', cb),
  onClear: (cb) => ipcRenderer.on('clear', () => cb()),
  onIndexStatus: (cb) => ipcRenderer.on('index-status', (_e, data) => cb(data)),
});
