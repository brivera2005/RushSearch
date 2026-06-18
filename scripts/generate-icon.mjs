import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pngToIco from 'png-to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '..', 'assets');

// Magnifying glass on dark bg with orange accent (RushSearch)
const COLORS = {
  '.': [0x12, 0x14, 0x1c, 0xff],
  B: [0xff, 0x6b, 0x35, 0xff],
  b: [0xff, 0x6b, 0x35, 0x99],
  L: [0xf4, 0xf6, 0xfb, 0xff],
  l: [0xf4, 0xf6, 0xfb, 0x88],
  G: [0xff, 0x6b, 0x35, 0x44],
};

const GRID = [
  '................................',
  '................................',
  '...............bbbbbb.............',
  '.............bbLLLLLLbb...........',
  '...........bbLLLLLLLLLLbb.........',
  '..........bLLLLLLLLLLLLLLb........',
  '.........bLLLLLLLLLLLLLLLLb.......',
  '........bLLLLLLLLLLLLLLLLLLb......',
  '.......bLLLLLLLLLLLLLLLLLLLLb.....',
  '......bLLLLLLLLLLLLLLLLLLLLLb.....',
  '.....bLLLLLLLLLLLLLLLLLLLLLLb.....',
  '.....bLLLLLLLLLLLLLLLLLLLLLLb.....',
  '.....bLLLLLLLLLLLLLLLLLLLLLLb.....',
  '.....bLLLLLLLLLLLLLLLLLLLLLLb.....',
  '......bLLLLLLLLLLLLLLLLLLLLb......',
  '.......bLLLLLLLLLLLLLLLLLLb.......',
  '........bLLLLLLLLLLLLLLLLb........',
  '.........bLLLLLLLLLLLLLLb.........',
  '..........bLLLLLLLLLLLb...........',
  '...........bbLLLLLLbb.............',
  '.............bbbbbb...............',
  '...................BBBB...........',
  '....................BB............',
  '....................BB............',
  '.....................BB...........',
  '......................BB..........',
  '.......................BB.........',
  '........................BB........',
  '.........................BB.......',
  '..........................BB......',
  '...........................BB.....',
  '................................',
];

function gridToRgba(size) {
  const src = 32;
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x / size) * src);
      const sy = Math.floor((y / size) * src);
      const ch = GRID[sy]?.[sx] ?? '.';
      const rgba = COLORS[ch] ?? COLORS['.'];
      const i = (y * size + x) * 4;
      data[i] = rgba[0];
      data[i + 1] = rgba[1];
      data[i + 2] = rgba[2];
      data[i + 3] = rgba[3];
    }
  }
  return data;
}

function renderPng(size) {
  const png = new PNG({ width: size, height: size });
  png.data = gridToRgba(size);
  return PNG.sync.write(png);
}

mkdirSync(assetsDir, { recursive: true });
writeFileSync(join(assetsDir, 'icon.png'), renderPng(256));
const sizes = [16, 32, 48, 256];
const ico = await pngToIco(sizes.map((s) => renderPng(s)));
writeFileSync(join(assetsDir, 'icon.ico'), ico);
console.log('Generated RushSearch icon');
