'use strict';

const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  screen,
} = require('electron');
const path = require('path');
const { FileIndexer } = require('./indexer.cjs');
const { runShellAction } = require('./shell-actions.cjs');

const isDev = !app.isPackaged;
let searchWindow = null;
let tray = null;
let indexer = null;

const INDEX_PATH = path.join(app.getPath('userData'), 'file-index.json');

function assetPath(...parts) {
  return path.join(__dirname, '..', ...parts);
}

function createSearchWindow() {
  if (searchWindow) return searchWindow;

  const { width } = screen.getPrimaryDisplay().workAreaSize;

  searchWindow = new BrowserWindow({
    width: 720,
    height: 520,
    x: Math.round((width - 720) / 2),
    y: 80,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    focusable: true,
    hasShadow: true,
    icon: assetPath('assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  searchWindow.loadFile(assetPath('ui', 'index.html'));

  searchWindow.on('blur', () => {
    if (searchWindow && !searchWindow.webContents.isDevToolsOpened()) hideSearch();
  });

  searchWindow.on('closed', () => {
    searchWindow = null;
  });

  return searchWindow;
}

function showSearch() {
  const win = createSearchWindow();
  win.show();
  win.focus();
  win.webContents.send('focus-input');
  if (indexer) {
    win.webContents.send('index-status', {
      count: indexer.filesIndexed,
      scanning: indexer.scanning,
    });
  }
}

function hideSearch() {
  if (searchWindow) {
    searchWindow.hide();
    searchWindow.webContents.send('clear');
  }
}

function toggleSearch() {
  if (searchWindow && searchWindow.isVisible()) hideSearch();
  else showSearch();
}

function registerHotkey() {
  globalShortcut.unregisterAll();
  const ok = globalShortcut.register('Control+Space', toggleSearch);
  if (!ok) console.error('Failed to register Ctrl+Space hotkey');
}

function createTray() {
  const icon = nativeImage.createFromPath(assetPath('assets', 'icon.ico'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('RushSearch — Ctrl+Space');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Search (Ctrl+Space)', click: showSearch },
    { type: 'separator' },
    {
      label: 'Re-index all drives',
      click: () => {
        if (indexer) indexer.startScan();
      },
    },
    { type: 'separator' },
    { label: 'Quit RushSearch', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', showSearch);
}

function setupIndexer() {
  indexer = new FileIndexer(INDEX_PATH);

  indexer.on('progress', ({ count }) => {
    if (searchWindow) searchWindow.webContents.send('index-status', { count, scanning: true });
    if (tray) tray.setToolTip(`RushSearch — indexing ${count.toLocaleString()} files`);
  });

  indexer.on('ready', ({ count, fromCache }) => {
    if (searchWindow) {
      searchWindow.webContents.send('index-status', { count, scanning: false, fromCache });
    }
    if (tray) tray.setToolTip(`RushSearch — ${count.toLocaleString()} files indexed`);
  });

  indexer.load().then(() => {
    if (indexer.entries.length === 0) indexer.startScan();
    else {
      indexer.emit('ready', { count: indexer.entries.length, fromCache: true });
      indexer.startScan();
    }
  });
}

function setupIpc() {
  ipcMain.handle('search', (_e, query) => {
    if (!indexer) return [];
    return indexer.search(query, 80);
  });

  ipcMain.handle('shell-action', async (_e, action, filePath, extra) => {
    await runShellAction(action, filePath, extra);
    return true;
  });

  ipcMain.handle('hide', () => {
    hideSearch();
    return true;
  });

  ipcMain.handle('index-status', () => ({
    count: indexer ? indexer.filesIndexed : 0,
    scanning: indexer ? indexer.scanning : false,
  }));
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.rushsearch.app');

  app.setLoginItemSettings({ openAtLogin: true, name: 'RushSearch' });

  createTray();
  setupIndexer();
  setupIpc();
  registerHotkey();
  createSearchWindow();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});
