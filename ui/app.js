'use strict';

const queryEl = document.getElementById('query');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const menuEl = document.getElementById('context-menu');

let results = [];
let selected = 0;
let searchTimer = null;
let menuTarget = null;

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

function setStatus(data) {
  if (!data) return;
  const n = (data.count || 0).toLocaleString();
  statusEl.textContent = data.scanning ? `Indexing ${n}…` : `${n} files`;
}

function iconFor(item) {
  return item.isDir ? '📁' : '📄';
}

function render() {
  resultsEl.innerHTML = '';
  if (!queryEl.value.trim()) {
    resultsEl.innerHTML = '<div class="empty">Press Ctrl+Space anytime. Start typing to search.</div>';
    return;
  }
  if (!results.length) {
    resultsEl.innerHTML = '<div class="empty">No matches. Try fewer or different terms.</div>';
    return;
  }

  results.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = `result${i === selected ? ' active' : ''}`;
    li.dataset.index = String(i);
    li.innerHTML = `
      <div class="icon">${iconFor(item)}</div>
      <div>
        <div class="name">${escapeHtml(item.name)}</div>
        <div class="path">${escapeHtml(item.path)}</div>
      </div>
    `;
    li.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        selected = i;
        openSelected();
      }
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
  }, 35);
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

function hideMenu() {
  menuEl.classList.add('hidden');
  menuTarget = null;
}

function showMenu(x, y, item) {
  menuTarget = item;
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
      if (entry.action === 'rename') {
        const name = prompt('New name:', item.name);
        if (name && name !== item.name) {
          await window.rushSearch.shellAction('rename', item.path, name);
          scheduleSearch();
        }
        return;
      }
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

queryEl.addEventListener('input', scheduleSearch);

queryEl.addEventListener('keydown', async (e) => {
  if (e.key === 'Escape') {
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
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) await revealSelected();
    else await openSelected();
  }
});

document.addEventListener('click', (e) => {
  if (!menuEl.contains(e.target)) hideMenu();
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
  render();
});

window.rushSearch.onIndexStatus(setStatus);

(async () => {
  setStatus(await window.rushSearch.indexStatus());
  render();
})();
