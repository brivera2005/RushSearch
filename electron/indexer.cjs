'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

const SKIP_DIRS = new Set([
  '$recycle.bin',
  'system volume information',
  '$windows.~bt',
  '$windows.~ws',
]);

const SKIP_DIRS_FAST = new Set([
  ...SKIP_DIRS,
  'node_modules',
  '.git',
  'cache',
  'caches',
  'temp',
  'tmp',
  'windows',
  'program files',
  'program files (x86)',
  'programdata',
]);

class FileIndexer extends EventEmitter {
  constructor(indexDir) {
    super();
    this.indexDir = indexDir;
    this.mode = 'fast';
    this.entries = [];
    this.scanning = false;
    this.filesIndexed = 0;
    this._stop = false;
    this._searchHelper = null;
  }

  indexPathFor(mode) {
    return path.join(this.indexDir, `file-index-${mode}.json`);
  }

  async load(mode = 'fast') {
    this.mode = mode;
    this._invalidateSearch();
    const indexPath = this.indexPathFor(mode);
    try {
      const raw = await fsp.readFile(indexPath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.entries)) {
        this.entries = data.entries;
        this.filesIndexed = this.entries.length;
        this._buildSearchHelper();
        return { count: this.entries.length, fromCache: true };
      }
    } catch {
      // no cache
    }
    this.entries = [];
    this.filesIndexed = 0;
    return { count: 0, fromCache: false };
  }

  async save() {
    const indexPath = this.indexPathFor(this.mode);
    await fsp.mkdir(path.dirname(indexPath), { recursive: true });
    const payload = JSON.stringify({
      version: 2,
      mode: this.mode,
      savedAt: Date.now(),
      entries: this.entries,
    });
    await fsp.writeFile(indexPath, payload);
    this._buildSearchHelper();
  }

  getDrives() {
    const drives = [];
    for (let code = 65; code <= 90; code += 1) {
      const letter = String.fromCharCode(code);
      const root = `${letter}:\\`;
      try {
        if (fs.existsSync(root)) drives.push(root);
      } catch {
        // ignore
      }
    }
    return drives;
  }

  getFastRoots() {
    const home = os.homedir();
    const deep = [
      path.join(home, 'Desktop'),
      path.join(home, 'Documents'),
      path.join(home, 'Downloads'),
      path.join(home, 'Pictures'),
      path.join(home, 'Videos'),
      path.join(home, 'Music'),
      path.join(home, 'OneDrive'),
      path.join(home, 'Projects'),
      home,
    ].filter((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });

    const shallow = this.getDrives().map((d) => ({ root: d, maxDepth: 1 }));
    return { deep, shallow };
  }

  makeEntry(fullPath, name, isDir) {
    const lname = name.toLowerCase();
    const lpath = fullPath.toLowerCase();
    return { path: fullPath, name, lname, lpath, isDir };
  }

  shouldSkipDir(name, fast) {
    const lower = name.toLowerCase();
    if (fast && SKIP_DIRS_FAST.has(lower)) return true;
    if (SKIP_DIRS.has(lower)) return true;
    return false;
  }

  async walk(root, maxDepth = null, fast = false) {
    const stack = [{ dir: root, depth: 0 }];
    let batch = 0;
    const BATCH = 3000;

    while (stack.length && !this._stop) {
      const { dir, depth } = stack.pop();
      let entries;
      try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const dirent of entries) {
        if (this._stop) return;
        const name = dirent.name;
        const full = path.join(dir, name);
        const isDir = dirent.isDirectory();

        this.entries.push(this.makeEntry(full, name, isDir));
        this.filesIndexed += 1;
        batch += 1;

        if (isDir && (maxDepth === null || depth < maxDepth)) {
          if (!this.shouldSkipDir(name, fast)) {
            stack.push({ dir: full, depth: depth + 1 });
          }
        }

        if (batch >= BATCH) {
          this.emit('progress', { count: this.filesIndexed, mode: this.mode });
          batch = 0;
          await new Promise((r) => setImmediate(r));
        }
      }
    }
  }

  async startScan(mode = this.mode) {
    if (this.scanning) return;
    this.mode = mode;
    this.scanning = true;
    this._stop = false;
    this.filesIndexed = 0;
    this.entries = [];
    this._invalidateSearch();

    this.emit('scan-start', { mode });

    if (mode === 'full') {
      for (const drive of this.getDrives()) {
        if (this._stop) break;
        this.emit('drive', { drive, mode });
        await this.walk(drive, null, false);
      }
    } else {
      const { deep, shallow } = this.getFastRoots();
      for (const root of deep) {
        if (this._stop) break;
        this.emit('drive', { drive: root, mode });
        await this.walk(root, null, true);
      }
      for (const { root, maxDepth } of shallow) {
        if (this._stop) break;
        this.emit('drive', { drive: root, mode });
        await this.walk(root, maxDepth, true);
      }
    }

    this.scanning = false;
    await this.save();
    this.emit('ready', { count: this.entries.length, fromCache: false, mode: this.mode });
  }

  stopScan() {
    this._stop = true;
  }

  _invalidateSearch() {
    this._searchHelper = null;
  }

  _buildSearchHelper() {
    const buckets = new Map();
    for (let i = 0; i < this.entries.length; i += 1) {
      const c = this.entries[i].lname[0];
      if (!c) continue;
      if (!buckets.has(c)) buckets.set(c, []);
      buckets.get(c).push(i);
    }
    this._searchHelper = { buckets, length: this.entries.length };
  }

  search(query, limit) {
    const { searchIndex } = require('./search.cjs');
    return searchIndex(this.entries, query, limit, this._searchHelper);
  }
}

module.exports = { FileIndexer };
