'use strict';

const fsp = require('fs').promises;
const path = require('path');

const DEFAULTS = {
  windowX: null,
  windowY: null,
  indexMode: 'fast',
  pinWindow: false,
};

class Settings {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { ...DEFAULTS };
  }

  async load() {
    try {
      const raw = await fsp.readFile(this.filePath, 'utf8');
      this.data = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      this.data = { ...DEFAULTS };
    }
  }

  async save() {
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
    await fsp.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
  }

  get all() {
    return { ...this.data };
  }

  async update(partial) {
    Object.assign(this.data, partial);
    await this.save();
    return this.all;
  }
}

module.exports = { Settings, DEFAULTS };
