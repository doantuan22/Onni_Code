import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// Onni is authored on this exact 32 × 32 character grid. Each character is one pixel.
const palette = { '.': null, I: '#06101F', N: '#0A1A2F', A: '#0B6BFF', S: '#5CA8FF', W: '#FFFFFF', O: '#FFB020' };
const size = 32;
const make = (rects) => {
  const pixels = Array.from({ length: size }, () => Array(size).fill('.'));
  for (const [x, y, w, h, c] of rects) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) pixels[yy][xx] = c;
  return pixels.map((row) => row.join(''));
};
const R = (...items) => items;

// Shared fox-bot silhouette: antenna ears, monitor-like face, compact wheeled body.
const base = R(
  [7, 2, 5, 1, 'I'], [20, 2, 5, 1, 'I'], [8, 3, 4, 1, 'I'], [20, 3, 4, 1, 'I'],
  [9, 4, 3, 3, 'N'], [20, 4, 3, 3, 'N'], [10, 5, 2, 2, 'A'], [20, 5, 2, 2, 'A'],
  [6, 7, 20, 1, 'I'], [5, 8, 22, 12, 'I'], [6, 9, 20, 10, 'N'],
  [7, 9, 18, 2, 'A'], [7, 11, 2, 5, 'A'], [23, 11, 2, 5, 'A'],
  [9, 12, 5, 4, 'S'], [18, 12, 5, 4, 'S'], [10, 13, 3, 2, 'I'], [19, 13, 3, 2, 'I'],
  [11, 13, 1, 1, 'W'], [20, 13, 1, 1, 'W'], [13, 16, 6, 1, 'W'], [14, 17, 4, 1, 'W'],
  [15, 10, 1, 1, 'O'], [17, 10, 1, 1, 'O'], // tiny < motif with navy between
  [9, 20, 14, 1, 'I'], [10, 21, 12, 5, 'N'], [11, 22, 10, 3, 'A'], [13, 22, 6, 1, 'S'],
  [8, 25, 3, 3, 'I'], [21, 25, 3, 3, 'I'], [9, 25, 2, 2, 'N'], [21, 25, 2, 2, 'N'],
  [12, 26, 8, 1, 'I'], [13, 27, 6, 1, 'N']
);
const idle = make(base);
const blink = make([...base, [10, 13, 3, 2, 'N'], [19, 13, 3, 2, 'N'], [12, 15, 1, 1, 'I'], [19, 15, 1, 1, 'I']]);
const working = make([...base,
  [4, 21, 5, 1, 'I'], [3, 22, 7, 5, 'I'], [4, 23, 5, 3, 'N'], [5, 24, 3, 1, 'S'],
  [23, 21, 5, 1, 'I'], [22, 22, 7, 5, 'I'], [23, 23, 5, 3, 'N'], [24, 24, 3, 1, 'S'],
  [12, 28, 8, 1, 'I'], [13, 29, 6, 1, 'N'], [14, 22, 1, 1, 'O'], [17, 22, 1, 1, 'O']
]);
const success = make([...base,
  [24, 18, 2, 1, 'I'], [25, 16, 2, 3, 'I'], [26, 15, 2, 2, 'I'], [27, 14, 2, 2, 'I'],
  [25, 17, 1, 1, 'A'], [27, 15, 1, 1, 'A'], [28, 13, 2, 1, 'O'], [29, 12, 1, 2, 'O'],
  [12, 16, 2, 1, 'W'], [18, 16, 2, 1, 'W']
]);
const error = make([...base,
  [3, 12, 1, 5, 'O'], [4, 11, 1, 1, 'O'], [4, 17, 1, 1, 'O'], [27, 12, 1, 5, 'O'], [27, 11, 1, 1, 'O'], [27, 17, 1, 1, 'O'],
  [15, 16, 2, 1, 'I'], [15, 18, 2, 1, 'O']
]);
const sleep = make([...base,
  [10, 13, 3, 2, 'N'], [19, 13, 3, 2, 'N'], [12, 15, 1, 1, 'I'], [19, 15, 1, 1, 'I'],
  [24, 6, 4, 1, 'S'], [27, 7, 1, 2, 'S'], [24, 9, 4, 1, 'S'], [27, 11, 3, 1, 'A'], [29, 12, 1, 2, 'A'], [27, 14, 3, 1, 'A']
]);
const head16 = make(R(...base.filter(([, y]) => y < 20)));
const poses = { idle: [idle, blink], working: [working], success: [success], error: [error], sleep: [sleep] };

function rectSvg(name, frame) {
  const rects = [];
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      const c = frame[y][x]; let end = x + 1;
      while (end < size && frame[y][end] === c) end++;
      if (c !== '.') rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${palette[c]}"/>`);
      x = end;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges"><title>${name}</title><g>${rects.join('')}</g></svg>\n`;
}
function crc32(buf) { let c = 0xffffffff; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); }
function png(width, height, pixels) {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) { const i = y * (width * 4 + 1); raw[i] = 0; pixels.copy(raw, i + 1, y * width * 4, (y + 1) * width * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'binary'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function makeSheet() {
  const frames = [idle, working, success, error, sleep]; const width = 1280, height = 576; const out = Buffer.alloc(width * height * 4);
  const fill = (x, y, color) => { const h = color.slice(1); const o = (y * width + x) * 4; out[o] = parseInt(h.slice(0, 2), 16); out[o + 1] = parseInt(h.slice(2, 4), 16); out[o + 2] = parseInt(h.slice(4, 6), 16); out[o + 3] = 255; };
  const draw = (frame, ox, oy, scale, bg) => {
    for (let y = 0; y < 32 * scale; y++) for (let x = 0; x < 32 * scale; x++) fill(ox + x, oy + y, bg);
    for (let gy = 0; gy < 32; gy++) for (let gx = 0; gx < 32; gx++) { const c = frame[gy][gx]; if (c !== '.') for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) fill(ox + gx * scale + xx, oy + gy * scale + yy, palette[c]); }
  };
  frames.forEach((frame, i) => { draw(frame, i * 32, 0, 1, '#FFFFFF'); draw(frame, i * 32, 32, 1, '#06101F'); draw(frame, i * 256, 64, 8, '#FFFFFF'); draw(frame, i * 256, 320, 8, '#06101F'); });
  return png(width, height, out);
}

const out = dirname(fileURLToPath(import.meta.url));
await mkdir(out, { recursive: true });
const files = [
  ['onni-mascot.svg', rectSvg('Onni mascot — idle', idle)], ['onni-idle.svg', rectSvg('Onni — idle', idle)],
  ['onni-working.svg', rectSvg('Onni — working', working)], ['onni-success.svg', rectSvg('Onni — success', success)],
  ['onni-error.svg', rectSvg('Onni — error', error)], ['onni-sleep.svg', rectSvg('Onni — asleep', sleep)],
  ['onni-mascot-16.svg', rectSvg('Onni mascot head', head16)],
  ['sprite-frames.json', JSON.stringify({ version: 1, grid: '32x32', palette, poses }, null, 2) + '\n'],
  ['mascot-sheet.png', makeSheet()],
];
for (const [file, content] of files) { await writeFile(join(out, file), content); console.log(file); }
