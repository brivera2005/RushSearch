'use strict';

const queryEl = document.getElementById('query');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const menuEl = document.getElementById('context-menu');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const fullIndexEl = document.getElementById('full-index');
const pinWindowEl = document.getElementById('pin-window');
const reindexBtn = document.getElementById('reindex-btn');
const modeBadge = document.getElementById('mode-badge');

let results = [];
let selected = 0;
let searchTimer = null;
let appSettings = { indexMode: 'fast', pinWindow: false };
const iconMap = new Map();

const MENU_ITEMS = [
  { action: 'open', label: 'Open' },
  { action: 'show', label: 'Open file location' },
  { sep: true },
  { action: 'copyPath', label: 'Copy path' },
  { action: 'copy', label: 'Copy' },
  { action: 'desktop', label: 'Send to Desktop (shortcut)' },
  { sep: true },
  { action: 'properties', label: 'Properties' },
  { action: 'trash', label: 'Delete' },
];

function applySettings(s) {
  appSettings = { ...appSettings, ...s };
  fullIndexEl.checked = appSettings.indexMode === 'full';
  pinWindowEl.checked = !!appSettings.pinWindow;
  modeBadge.textContent = appSettings.indexMode === 'full' ? 'Full' : 'Fast';
  modeBadge.classList.toggle('full', appSettings.indexMode === 'full');
}

function setStatus(data) {
  if (!data) return;
  const n = (data.count || 0).toLocaleString();
  const mode = data.mode === 'full' ? 'Full' : 'Fast';
  if (data.scanning) statusEl.textContent = `${mode}: ${n}…`;
  else statusEl.textContent = `${mode}: ${n}`;
  if (data.mode) applySettings({ indexMode: data.mode, pinWindow: data.pinWindow });
}

function iconHtml(item) {
  const cached = iconMap.get(item.path);
  if (cached) {
    return `<img class="file-icon" src="${cached}" alt="" />`;
  }
  if (item.isExe) return '<span class="file-icon-fallback exe">▶</span>';
  if (item.isDir) return '<span class="file-icon-fallback">📁</span>';
  return '<span class="file-icon-fallback">📄</span>';
}

function render() {
  resultsEl.innerHTML = '';
  if (!queryEl.value.trim()) {
    const hint = appSettings.indexMode === 'full'
      ? 'Full index active. Ctrl+Space anytime — type to search everything.'
      : 'Fast index active. Enable full scan in ⚙ for every file on disk.';
    resultsEl.innerHTML = `<div class="empty">${hint}</div>`;
    return;
  }
  if (!results.length) {
    resultsEl.innerHTML = '<div class="empty">No matches. Try different terms or enable full index in ⚙.</div>';
    return;
  }

  results.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = `result${i === selected ? ' active' : ''}`;
    li.innerHTML = `
      <div class="icon">${iconHtml(item)}</div>
      <div class="meta">
        <div class="name-row">
          <span class="name">${escapeHtml(item.name)}</span>
          ${item.isExe ? '<span class="app-tag">App</span>' : ''}
        </div>
        <div class="path">${escapeHtml(item.path)}</div>
      </div>
    `;
    li.addEventListener('click', () => {
      selected = i;
      render();
    });
    li.addEventListener('dblclick', () => {
      selected = i;
      openSelected();
    });
    li.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      selected = i;
      render();
      showMenu(e.clientX, e.clientY, item);
    });
    resultsEl.appendChild(li);
  });

  const active = resultsEl.querySelector('.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function scheduleSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const q = queryEl.value.trim();
    if (!q) {
      results = [];
      selected = 0;
      render();
      return;
    }
    results = await window.rushSearch.search(q);
    selected = 0;
    render();
    const paths = results.slice(0, 30).map((r) => r.path);
    const icons = await window.rushSearch.getIcons(paths);
    for (const [p, url] of Object.entries(icons)) {
      if (url) iconMap.set(p, url);
    }
    render();
  }, 30);
}

async function openSelected() {
  const item = results[selected];
  if (!item) return;
  await window.rushSearch.shellAction('open', item.path);
  await window.rushSearch.hide();
}

async function revealSelected() {
  const item = results[selected];
  if (!item) return;
  await window.rushSearch.shellAction('show', item.path);
  await window.rushSearch.hide();
}

async function copySelectedPath() {
  const item = results[selected];
  if (!item) return;
  await window.rushSearch.shellAction('copyPath', item.path);
}

function hideMenu() {
  menuEl.classList.add('hidden');
}

function showMenu(x, y, item) {
  menuEl.innerHTML = '';
  for (const entry of MENU_ITEMS) {
    if (entry.sep) {
      const sep = document.createElement('div');
      sep.className = 'sep';
      menuEl.appendChild(sep);
      continue;
    }
    const btn = document.createElement('button');
    btn.textContent = entry.label;
    btn.addEventListener('click', async () => {
      hideMenu();
      if (entry.action === 'trash') {
        if (!confirm(`Move to Recycle Bin?\n${item.path}`)) return;
      }
      await window.rushSearch.shellAction(entry.action, item.path);
      if (entry.action === 'open' || entry.action === 'show') {
        await window.rushSearch.hide();
      }
    });
    menuEl.appendChild(btn);
  }
  menuEl.style.left = `${x}px`;
  menuEl.style.top = `${y}px`;
  menuEl.classList.remove('hidden');
}

settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsPanel.classList.toggle('hidden');
});

fullIndexEl.addEventListener('change', async () => {
  const indexMode = fullIndexEl.checked ? 'full' : 'fast';
  await window.rushSearch.setSettings({ indexMode });
});

pinWindowEl.addEventListener('change', async () => {
  await window.rushSearch.setSettings({ pinWindow: pinWindowEl.checked });
});

reindexBtn.addEventListener('click', async () => {
  reindexBtn.textContent = 'Indexing…';
  reindexBtn.disabled = true;
  await window.rushSearch.reindex();
  reindexBtn.textContent = 'Re-index now';
  reindexBtn.disabled = false;
});

queryEl.addEventListener('input', scheduleSearch);

queryEl.addEventListener('keydown', async (e) => {
  if (e.key === 'Escape') {
    if (!settingsPanel.classList.contains('hidden')) {
      settingsPanel.classList.add('hidden');
      return;
    }
    if (!menuEl.classList.contains('hidden')) hideMenu();
    else await window.rushSearch.hide();
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (results.length) selected = Math.min(selected + 1, results.length - 1);
    render();
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (results.length) selected = Math.max(selected - 1, 0);
    render();
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    if (!results.length) return;
    selected = e.shiftKey
      ? Math.max(selected - 1, 0)
      : Math.min(selected + 1, results.length - 1);
    render();
    return;
  }
  if (e.key === 'c' && e.ctrlKey) {
    e.preventDefault();
    await copySelectedPath();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) await revealSelected();
    else await openSelected();
  }
});

document.addEventListener('click', (e) => {
  if (!menuEl.contains(e.target)) hideMenu();
  if (!settingsPanel.contains(e.target) && e.target !== settingsBtn) {
    settingsPanel.classList.add('hidden');
  }
});

window.rushSearch.onFocusInput(() => {
  queryEl.focus();
  queryEl.select();
});

window.rushSearch.onClear(() => {
  queryEl.value = '';
  results = [];
  selected = 0;
  hideMenu();
  settingsPanel.classList.add('hidden');
  render();
});

window.rushSearch.onIndexStatus(setStatus);
window.rushSearch.onSettingsChanged(applySettings);

(async () => {
  applySettings(await window.rushSearch.getSettings());
  setStatus(await window.rushSearch.indexStatus());
  render();
})();
