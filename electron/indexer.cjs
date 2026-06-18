'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { EventEmitter } = require('events');

const SKIP_DIRS = new Set([
  '$recycle.bin',
  'system volume information',
  '$windows.~bt',
  '$windows.~ws',
]);

class FileIndexer extends EventEmitter {
  constructor(indexPath) {
    super();
    this.indexPath = indexPath;
    this.entries = [];
    this.scanning = false;
    this.filesIndexed = 0;
    this._stop = false;
  }

  async load() {
    try {
      const raw = await fsp.readFile(this.indexPath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.entries)) {
        this.entries = data.entries;
        this.filesIndexed = this.entries.length;
        this.emit('ready', { count: this.entries.length, fromCache: true });
        return;
      }
    } catch {
      // no cache yet
    }
    this.entries = [];
  }

  async save() {
    await fsp.mkdir(path.dirname(this.indexPath), { recursive: true });
    const payload = JSON.stringify({ version: 1, savedAt: Date.now(), entries: this.entries });
    await fsp.writeFile(this.indexPath, payload);
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

  makeEntry(fullPath, name, isDir) {
    const lname = name.toLowerCase();
    const lpath = fullPath.toLowerCase();
    return { path: fullPath, name, lname, lpath, isDir };
  }

  async walk(root) {
    const stack = [root];
    const batch = [];
    const BATCH = 4000;

    while (stack.length && !this._stop) {
      const current = stack.pop();
      let entries;
      try {
        entries = await fsp.readdir(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const dirent of entries) {
        if (this._stop) return;
        const name = dirent.name;
        const full = path.join(current, name);
        const isDir = dirent.isDirectory();

        this.entries.push(this.makeEntry(full, name, isDir));
        this.filesIndexed += 1;
        batch.push(full);

        if (isDir) {
          if (!SKIP_DIRS.has(name.toLowerCase())) stack.push(full);
        }

        if (batch.length >= BATCH) {
          this.emit('progress', { count: this.filesIndexed });
          batch.length = 0;
          await new Promise((r) => setImmediate(r));
        }
      }
    }
  }

  async startScan() {
    if (this.scanning) return;
    this.scanning = true;
    this._stop = false;
    this.filesIndexed = 0;
    this.entries = [];

    const drives = this.getDrives();
    this.emit('scan-start', { drives });

    for (const drive of drives) {
      if (this._stop) break;
      this.emit('drive', { drive });
      await this.walk(drive);
    }

    this.scanning = false;
    await this.save();
    this.emit('ready', { count: this.entries.length, fromCache: false });
  }

  stopScan() {
    this._stop = true;
  }

  search(query, limit) {
    const { searchIndex } = require('./search.cjs');
    return searchIndex(this.entries, query, limit);
  }
}

module.exports = { FileIndexer };
