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
const { Settings } = require('./settings.cjs');
const { runShellAction } = require('./shell-actions.cjs');

let searchWindow = null;
let tray = null;
let indexer = null;
let settings = null;
const iconCache = new Map();
const ICON_CACHE_MAX = 600;

const WINDOW_W = 720;
const WINDOW_H = 520;

function assetPath(...parts) {
  return path.join(__dirname, '..', ...parts);
}

function clampWindowPosition(x, y) {
  const display = screen.getDisplayNearestPoint({ x, y });
  const { x: wx, y: wy, width, height } = display.workArea;
  const cx = Math.max(wx, Math.min(x, wx + width - WINDOW_W));
  const cy = Math.max(wy, Math.min(y, wy + height - 60));
  return { x: cx, y: cy };
}

function defaultWindowPosition() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  return { x: Math.round((width - WINDOW_W) / 2), y: 80 };
}

function getWindowPosition() {
  const saved = settings?.all;
  if (saved?.windowX != null && saved?.windowY != null) {
    return clampWindowPosition(saved.windowX, saved.windowY);
  }
  return defaultWindowPosition();
}

async function saveWindowPosition() {
  if (!searchWindow || !settings) return;
  const [x, y] = searchWindow.getPosition();
  await settings.update({ windowX: x, windowY: y });
}

function broadcastIndexStatus(extra = {}) {
  const payload = {
    count: indexer ? indexer.filesIndexed : 0,
    scanning: indexer ? indexer.scanning : false,
    mode: indexer ? indexer.mode : 'fast',
    pinWindow: settings ? settings.all.pinWindow : false,
    ...extra,
  };
  if (searchWindow) searchWindow.webContents.send('index-status', payload);
  updateTrayTooltip(payload);
}

function updateTrayTooltip({ count = 0, scanning = false, mode = 'fast' } = {}) {
  if (!tray) return;
  const label = mode === 'full' ? 'Full' : 'Fast';
  if (scanning) tray.setToolTip(`RushSearch (${label}) — indexing ${count.toLocaleString()}…`);
  else tray.setToolTip(`RushSearch (${label}) — ${count.toLocaleString()} files · Ctrl+Space`);
}

function createSearchWindow() {
  if (searchWindow) return searchWindow;

  const pos = getWindowPosition();

  searchWindow = new BrowserWindow({
    width: WINDOW_W,
    height: WINDOW_H,
    x: pos.x,
    y: pos.y,
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

  searchWindow.on('moved', () => {
    saveWindowPosition();
  });

  searchWindow.on('blur', () => {
    if (!searchWindow || searchWindow.webContents.isDevToolsOpened()) return;
    if (settings?.all?.pinWindow) return;
    hideSearch();
  });

  searchWindow.on('closed', () => {
    searchWindow = null;
  });

  return searchWindow;
}

function showSearch() {
  const win = createSearchWindow();
  const pos = getWindowPosition();
  win.setPosition(pos.x, pos.y);
  win.show();
  win.focus();
  win.webContents.send('focus-input');
  broadcastIndexStatus();
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

function buildTrayMenu() {
  const mode = indexer?.mode || settings?.all?.indexMode || 'fast';
  return Menu.buildFromTemplate([
    { label: 'Search (Ctrl+Space)', click: showSearch },
    { type: 'separator' },
    {
      label: 'Index mode',
      submenu: [
        {
          label: 'Fast (recommended)',
          type: 'radio',
          checked: mode === 'fast',
          click: () => switchIndexMode('fast'),
        },
        {
          label: 'Full (all drives)',
          type: 'radio',
          checked: mode === 'full',
          click: () => switchIndexMode('full'),
        },
      ],
    },
    {
      label: 'Re-index now',
      click: () => {
        if (indexer) indexer.startScan(indexer.mode);
      },
    },
    { type: 'separator' },
    { label: 'Quit RushSearch', click: () => app.quit() },
  ]);
}

function createTray() {
  const icon = nativeImage.createFromPath(assetPath('assets', 'icon.ico'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setContextMenu(buildTrayMenu());
  tray.on('double-click', showSearch);
  updateTrayTooltip();
}

async function switchIndexMode(mode) {
  if (!indexer || !settings) return;
  await settings.update({ indexMode: mode });
  indexer.stopScan();
  const loaded = await indexer.load(mode);
  broadcastIndexStatus({ fromCache: loaded.fromCache });
  if (loaded.count === 0) await indexer.startScan(mode);
  else await indexer.startScan(mode);
  if (tray) tray.setContextMenu(buildTrayMenu());
  if (searchWindow) searchWindow.webContents.send('settings-changed', settings.all);
}

function setupIndexer() {
  const indexDir = app.getPath('userData');
  indexer = new FileIndexer(indexDir);

  indexer.on('progress', () => broadcastIndexStatus());
  indexer.on('ready', (data) => {
    broadcastIndexStatus(data);
    if (tray) tray.setContextMenu(buildTrayMenu());
  });

  const mode = settings.all.indexMode || 'fast';
  indexer.load(mode).then((loaded) => {
    broadcastIndexStatus({ fromCache: loaded.fromCache });
    indexer.startScan(mode);
  });
}

async function getIconDataUrl(filePath) {
  if (iconCache.has(filePath)) return iconCache.get(filePath);
  try {
    const img = await app.getFileIcon(filePath, { size: 'small' });
    const url = img.isEmpty() ? null : img.toDataURL();
    iconCache.set(filePath, url);
    if (iconCache.size > ICON_CACHE_MAX) {
      iconCache.delete(iconCache.keys().next().value);
    }
    return url;
  } catch {
    iconCache.set(filePath, null);
    return null;
  }
}

function setupIpc() {
  ipcMain.handle('search', (_e, query) => {
    if (!indexer) return [];
    return indexer.search(query, 80);
  });

  ipcMain.handle('get-icons', async (_e, paths) => {
    const out = {};
    const unique = [...new Set((paths || []).slice(0, 40))];
    await Promise.all(
      unique.map(async (p) => {
        out[p] = await getIconDataUrl(p);
      })
    );
    return out;
  });

  ipcMain.handle('shell-action', async (_e, action, filePath, extra) => {
    await runShellAction(action, filePath, extra);
    return true;
  });

  ipcMain.handle('hide', () => {
    hideSearch();
    return true;
  });

  ipcMain.handle('get-settings', () => settings?.all || {});

  ipcMain.handle('set-settings', async (_e, partial) => {
    const prevMode = settings.all.indexMode;
    const next = await settings.update(partial);
    if (partial.indexMode && partial.indexMode !== prevMode) {
      await switchIndexMode(partial.indexMode);
    } else if (searchWindow) {
      searchWindow.webContents.send('settings-changed', next);
    }
    if (tray) tray.setContextMenu(buildTrayMenu());
    return next;
  });

  ipcMain.handle('reindex', async () => {
    if (!indexer) return false;
    indexer.stopScan();
    await indexer.startScan(indexer.mode);
    return true;
  });

  ipcMain.handle('index-status', () => ({
    count: indexer ? indexer.filesIndexed : 0,
    scanning: indexer ? indexer.scanning : false,
    mode: indexer ? indexer.mode : 'fast',
    pinWindow: settings ? settings.all.pinWindow : false,
  }));
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') app.setAppUserModelId('com.rushsearch.app');

  settings = new Settings(path.join(app.getPath('userData'), 'settings.json'));
  await settings.load();

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
