import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const palette = { '.': null, I: '#06101F', N: '#0A1A2F', A: '#0B6BFF', S: '#5CA8FF', W: '#FFFFFF', O: '#FFB020' };
const canvas = (n = 32) => Array.from({ length: n }, () => Array(n).fill('.'));
const rows = (p) => p.map((row) => row.join(''));
const rect = (p, x, y, w, h, c) => {
  if (x < 0 || y < 0 || x + w > p.length || y + h > p.length) throw new Error('Pixel outside grid');
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) p[yy][xx] = c;
};
const stamp = (p, grid, x, y) => grid.forEach((line, yy) => [...line].forEach((c, xx) => {
  if (c !== '.') rect(p, x + xx, y + yy, 1, 1, c);
}));

// Author one string grid, then compose poses from it. Sky edges enclose the recessed navy face.
function headGrid() {
  const p = canvas();
  for (let y = 7; y <= 20; y++) {
    const inset = y < 10 ? 10 - y : y > 15 ? y - 15 : 0;
    rect(p, 4 + inset, y, 23 - inset * 2, 1, 'S');
    rect(p, 5 + inset, y, 21 - inset * 2, 1, 'A');
    if (y >= 9 && y <= 18) rect(p, 6 + inset, y, 19 - inset * 2, 1, 'N');
  }
  for (let y = 2; y <= 8; y++) {
    const w = Math.min(y - 1, 7);
    rect(p, 6, y, w, 1, 'S'); rect(p, 25 - w, y, w, 1, 'S');
    if (w > 2) { rect(p, 7, y, w - 2, 1, 'A'); rect(p, 26 - w, y, w - 2, 1, 'A'); }
    if (w > 4) { rect(p, 8, y, w - 4, 1, 'N'); rect(p, 27 - w, y, w - 4, 1, 'N'); }
  }
  // Pale cheeks converge into a tapered muzzle; a dark nose separates it from the eyes.
  for (let y = 16; y <= 20; y++) rect(p, 8 + y - 16, y, 15 - (y - 16) * 2, 1, 'W');
  rect(p, 14, 16, 3, 1, 'I');
  return rows(p);
}
const head = headGrid();
// Independent sixteen-row master. No sampling, catchlights or forehead confetti at this size.
const head16 = [
  '................',
  '..S..........S..',
  '..SAS......SAS..',
  '..SAAS....SAAS..',
  '..SAAASSSSAAAS..',
  '.SAANNNNNNNNAAS.',
  '.SNNNNNNNNNNNNS.',
  '.SNNWWNNNNWWNNS.',
  '.SNNWINNNNWINNS.',
  '.SNNNNNNNNNNNNS.',
  '..SWWNNIINNWWS..',
  '...SWWWWWWWWS...',
  '....SWWNNWWS....',
  '.....SWWWWS.....',
  '......SSSS......',
  '................',
];

function pose(mode, frame) {
  const p = canvas();
  const r = (x, y, w, h, c) => rect(p, x, y, w, h, c);
  // A bent, pale-tipped tail behind the body gives the fox silhouette its third signature.
  stamp(p, mode === 'sleep' ? ['..SSSSS.', '.SAAAAAS', 'SAAWWWAS', 'SAWWWAAS', '.SSSSSS.'] : frame ?
    ['....SS..', '...SWWS.', '..SWWAS.', '.SAAAAS.', 'SAAAAS..', 'SAAAS...', '.SSS....'] :
    ['.....S..', '....SWS.', '...SWWAS', '..SAAAAS', '.SAAAAS.', 'SAAAAS..', '.SSSS...'], 23, mode === 'sleep' ? 25 : 21);
  const dx = mode === 'working' || (mode === 'error' && frame === 0) ? -1 : 0;
  const dy = mode === 'sleep' ? 2 : mode === 'working' ? 1 : 0;
  // The master grid has transparent margins; stamp only the visible head to allow pose offsets.
  head.forEach((line, y) => [...line].forEach((c, x) => { if (c !== '.') r(x + dx, y + dy, 1, 1, c); }));
  const face = (x, y, w, h, c) => r(x + dx, y + dy, w, h, c);
  face(8, 12, 15, 4, 'N');
  if ((mode === 'idle' && frame === 1) || mode === 'sleep') {
    face(9, 14, 4, 1, 'S'); face(18, 14, 4, 1, 'S');
  } else if (mode === 'success') {
    for (const x of [9, 18]) { face(x + 1, 12, 2, 1, 'W'); face(x, 13, 1, 2, 'W'); face(x + 3, 13, 1, 2, 'W'); }
  } else {
    for (const x of [9, 18]) { face(x, 12, 4, 3, 'W'); face(x + (mode === 'working' ? 2 : 1), 13, 2, 2, 'I'); }
    if (mode === 'error') {
      face(9, 11, 2, 1, 'S'); face(11, 10, 2, 1, 'S'); face(18, 10, 2, 1, 'S'); face(20, 11, 2, 1, 'S');
    }
  }
  // One real left-pointing brand chevron on a clear forehead patch, away from the eyes.
  face(14, 7, 3, 5, 'N'); stamp(p, ['..S', '.S.', 'S..', '.S.', '..S'], 14 + dx, 7 + dy);
  face(13, 18, 5, 2, 'W');
  if (mode === 'error') stamp(p, ['.NNN.', 'N...N'], 13 + dx, 18 + dy);
  else if (mode === 'success') stamp(p, ['N...N', '.NNN.'], 13 + dx, 18 + dy);
  else face(14, 19, 3, 1, 'N');

  const bodyY = mode === 'sleep' ? 24 : 22;
  r(13, bodyY - 1, 5, 1, 'S');
  r(11, bodyY, 9, 29 - bodyY, 'S'); r(12, bodyY + 1, 7, 28 - bodyY, 'A');
  r(14, bodyY + 1, 3, 1, 'N'); r(15, bodyY + 1, 1, 1, 'O');
  // Feet stay on one ground row across all gestures.
  r(10, 29, 5, 2, 'S'); r(17, 29, 5, 2, 'S'); r(11, 29, 3, 1, 'N'); r(18, 29, 3, 1, 'N');
  if (mode === 'success') {
    const y = frame ? 16 : 14;
    for (const x of [1, 29]) { r(x, y, 2, 7, 'S'); r(x, y, 2, 2, 'W'); r(x + (x === 1 ? 1 : -1), y + 7, 2, 2, 'S'); }
    r(4, 23, 7, 2, 'S'); r(20, 23, 8, 2, 'S');
  } else if (mode === 'working') {
    r(6, 25, 20, 3, 'S'); r(5, 28, 22, 1, 'S'); r(7, 26, 18, 2, 'N');
    for (const x of [8, 11, 14, 17, 20, 23]) r(x, 27, 1, 1, 'A');
    r(8, frame ? 25 : 24, 4, 2, 'W'); r(20, frame ? 24 : 25, 4, 2, 'W');
  } else if (mode === 'error') {
    r(7, 24, 2, 5, 'S'); r(23, 24, 2, 5, 'S'); r(7, 28, 2, 1, 'W'); r(23, 28, 2, 1, 'W');
  } else if (mode === 'sleep') {
    r(10, 27, 12, frame ? 2 : 1, 'W');
    stamp(p, ['SSSS', '..S.', '.S..', 'SSSS'], 27, 4 - frame);
  } else {
    r(8, 24, 2, 3, 'S'); r(21, 24, 2, 3, 'S'); r(8, 26, 2, 1, 'W'); r(21, 26, 2, 1, 'W');
  }
  return rows(p);
}
const poses = Object.fromEntries(['idle', 'working', 'success', 'error', 'sleep'].map((name) => [name, [pose(name, 0), pose(name, 1)]]));
const playback = {
  idle: { durationsMs: [1800, 100], policy: 'loop', order: [0, 1], reducedMotionFrame: 0 },
  working: { durationsMs: [240, 240], policy: 'loop', order: [0, 1], reducedMotionFrame: 0 },
  success: { durationsMs: [160, 900], policy: 'once-hold-last', order: [0, 1], reducedMotionFrame: 1 },
  error: { durationsMs: [100, 100], policy: 'once-hold-last', order: [0, 1, 0, 1], reducedMotionFrame: 1 },
  sleep: { durationsMs: [800, 800], policy: 'loop', order: [0, 1], reducedMotionFrame: 0 },
};
function rectSvg(name, frame) {
  const rects = [], size = frame.length;
  for (let y = 0; y < size; y++) for (let x = 0; x < size;) {
    const c = frame[y][x]; let end = x + 1;
    while (end < size && frame[y][end] === c) end++;
    if (c !== '.') rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${palette[c]}"/>`);
    x = end;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><title>${name}</title><g>${rects.join('')}</g></svg>\n`;
}
function crc32(buf) { let c = 0xffffffff; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const t = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4); len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); }
function png(width, height, pixels) {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'binary'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const grey = (hex) => { const [r, g, b] = rgb(hex); return `#${Math.round(.2126 * r + .7152 * g + .0722 * b).toString(16).padStart(2, '0').repeat(3)}`; };
const entries = Object.entries(poses).flatMap(([pose, frames]) => frames.map((grid, frame) => ({ pose, frame, grid })));
entries.push({ pose: 'head16', frame: 0, grid: head16 });
function makeSheet(selected = entries, diagnostic = false) {
  const width = selected.length * 272, bandHeight = 304;
  const bands = diagnostic ? ['#FFFFFF', '#06101F'] : ['#FFFFFF', '#06101F', '#0A1A2F', '#FFFFFF', '#06101F'];
  const height = bands.length * bandHeight, pixels = Buffer.alloc(width * height * 4);
  const fill = (x, y, color) => pixels.set([...rgb(color), 255], (y * width + x) * 4);
  const draw = (grid, ox, oy, target, bg, transform) => {
    for (let y = 0; y < target; y++) for (let x = 0; x < target; x++) {
      const c = grid[Math.floor(y * grid.length / target)][Math.floor(x * grid.length / target)];
      fill(ox + x, oy + y, c === '.' ? bg : transform(palette[c]));
    }
  };
  bands.forEach((bg, band) => {
    for (let y = band * bandHeight; y < (band + 1) * bandHeight; y++) for (let x = 0; x < width; x++) fill(x, y, bg);
    selected.forEach(({ grid }, col) => {
      const transform = !diagnostic && band === 3 ? grey : !diagnostic && band === 4 ? () => '#5CA8FF' : (c) => c;
      const ox = col * 272 + 8, oy = band * bandHeight;
      draw(grid, ox, oy + 4, 16, bg, transform); draw(grid, ox + 24, oy + 4, 32, bg, transform); draw(grid, ox, oy + 40, 256, bg, transform);
    });
  });
  return { width, height, pixels, bytes: png(width, height, pixels) };
}

const out = dirname(fileURLToPath(import.meta.url));
await mkdir(out, { recursive: true });
for (const { pose, grid } of entries) {
  if (![16, 32].includes(grid.length) || grid.some((line) => line.length !== grid.length || [...line].some((c) => !(c in palette)))) throw new Error(`Invalid square grid: ${pose}: ${grid.map((r) => r.length)}`);
}
const sheet = makeSheet();
const preview = {
  columnWidth: 272, columns: entries.map(({ pose, frame, grid }, i) => ({ pose, frame, sourceSize: grid.length, x: i * 272 + 8 })),
  bands: ['white', 'ink', 'navy', 'greyscale-white', 'filled-silhouette-ink'], bandHeight: 304,
  sizes: [{ pixels: 16, xOffset: 0, yOffset: 4 }, { pixels: 32, xOffset: 24, yOffset: 4 }, { pixels: 256, xOffset: 0, yOffset: 40 }],
  note: 'Columns follow poses/frame order; head16 last. 32px masters downsample at 16px; head16 is separately authored. sequence-STATE.png expands playback.order, light above ink.',
};
const data = { version: 2, grid: '32x32', palette, poses, playback, head16, preview };
const files = [
  ['onni-mascot.svg', rectSvg('Onni fox robot - idle', poses.idle[0])],
  ...Object.entries(poses).map(([name, frames]) => [`onni-${name}.svg`, rectSvg(`Onni fox robot - ${name}`, frames[0])]),
  ['onni-mascot-16.svg', rectSvg('Onni fox robot - small head', head16)],
  ['sprite-frames.json', JSON.stringify(data, null, 2) + '\n'], ['mascot-sheet.png', sheet.bytes],
];
for (const [name, spec] of Object.entries(playback)) files.push([`sequence-${name}.png`, makeSheet(spec.order.map((frame) => ({ pose: name, frame, grid: poses[name][frame] })), true).bytes]);
files.push(['playback-preview.html', `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Onni mascot playback review</title>
<style>body{margin:24px;font:14px system-ui;background:#fff;color:#0A1A2F}button{font:inherit;padding:8px;margin-right:12px}.states{display:flex;flex-wrap:wrap;gap:16px}.state{width:272px}canvas{image-rendering:pixelated;display:inline-block}h1{font-size:22px}h2{font-size:16px}.dark{background:#06101F}.surface{height:304px}p{max-width:75ch}</style>
<h1>Onni fox robot — motion review</h1><p>Each state: actual 16px / 32px above 256px (8×). White and ink surfaces. One-shot states hold their last frame. Small head: independent 16px master with 8× detail. No network or runtime dependency.</p>
<p><button id="restart">Restart all sequences</button><button id="pause">Pause motion</button><label><input id="still" type="checkbox"> Reduced-motion static frames</label></p><div class="states" id="states"></div>
<script>const data=${JSON.stringify(data)};
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;document.querySelector('#still').checked=reduced;
let start=performance.now(),paused=false,frozen=0;
document.querySelector('#restart').onclick=()=>{start=performance.now();frozen=0};
document.querySelector('#pause').onclick=()=>{paused=!paused;if(paused)frozen=performance.now()-start;else start=performance.now()-frozen;document.querySelector('#pause').textContent=paused?'Resume motion':'Pause motion'};
const widgets=Object.keys(data.poses).map(name=>{const el=document.createElement('section');el.className='state';el.innerHTML='<h2>'+name+' · '+data.playback[name].policy+'</h2>';document.querySelector('#states').append(el);const canvases=[];for(const dark of [false,true]){const surface=document.createElement('div');surface.className='surface'+(dark?' dark':'');el.append(surface);for(const size of [16,32,256]){const c=document.createElement('canvas');c.width=c.height=size;c.style.margin=size===256?'8px':'4px';surface.append(c);canvases.push(c)}}return{name,canvases}});
const headEl=document.createElement('section');headEl.className='state';headEl.innerHTML='<h2>Independent 16px head</h2>';document.querySelector('#states').append(headEl);
function draw(canvas,grid){const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);const s=canvas.width/grid.length;grid.forEach((line,y)=>[...line].forEach((v,x)=>{if(data.palette[v]){c.fillStyle=data.palette[v];c.fillRect(x*s,y*s,s,s)}}))}
for(const dark of [false,true]){const el=document.createElement('div');el.className='surface'+(dark?' dark':'');headEl.append(el);for(const size of [16,32,128]){const c=document.createElement('canvas');c.width=c.height=size;c.style.margin='8px';el.append(c);draw(c,data.head16)}}
function tick(now){const time=paused?frozen:now-start;for(const w of widgets){const p=data.playback[w.name],total=p.order.reduce((sum,f)=>sum+p.durationsMs[f],0);let elapsed=p.policy==='loop'?time%total:Math.min(time,total-1),frame=p.order.at(-1);for(const f of p.order){if(elapsed<p.durationsMs[f]){frame=f;break}elapsed-=p.durationsMs[f]}if(document.querySelector('#still').checked)frame=p.reducedMotionFrame;for(const c of w.canvases)draw(c,data.poses[w.name][frame])}requestAnimationFrame(tick)}requestAnimationFrame(tick);
</script></html>\n`]);
let unchanged = 0;
for (const [file, content] of files) {
  const previous = await readFile(join(out, file)).catch((error) => { if (error.code !== 'ENOENT') throw error; return null; });
  if (previous?.equals(Buffer.from(content))) unchanged++;
  await writeFile(join(out, file), content); console.log(file);
}

// Read saved vectors/JSON/PNG back and reconstruct pixels, keeping verification inside this generator.
for (const [file, expected] of files) {
  const actual = await readFile(join(out, file));
  if (!actual.equals(Buffer.from(expected))) throw new Error(`Save mismatch: ${file}`);
  if (file.endsWith('.svg')) {
    const svg = actual.toString();
    if ([...svg.matchAll(/<\/?([\w:-]+)/g)].some((m) => !['svg', 'title', 'g', 'rect'].includes(m[1]))) throw new Error('Forbidden SVG element');
    const grid = file === 'onni-mascot-16.svg' ? head16 : poses[file === 'onni-mascot.svg' ? 'idle' : file.slice(5, -4)][0];
    if (!svg.includes(`viewBox="0 0 ${grid.length} ${grid.length}"`) || !svg.includes('shape-rendering="crispEdges"')) throw new Error('Invalid SVG root');
    const decoded = canvas(grid.length), symbols = Object.fromEntries(Object.entries(palette).map(([key, value]) => [value, key]));
    for (const m of svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="(#[A-F0-9]{6})"\/>/g)) {
      if (!symbols[m[5]]) throw new Error('Unknown SVG colour');
      rect(decoded, +m[1], +m[2], +m[3], +m[4], symbols[m[5]]);
    }
    if (JSON.stringify(rows(decoded)) !== JSON.stringify(grid)) throw new Error(`SVG/grid mismatch: ${file}`);
  }
}
if (JSON.stringify(JSON.parse(await readFile(join(out, 'sprite-frames.json'), 'utf8'))) !== JSON.stringify(data)) throw new Error('JSON/grid mismatch');
const savedPng = await readFile(join(out, 'mascot-sheet.png')), idat = [];
for (let offset = 8; offset < savedPng.length;) {
  const length = savedPng.readUInt32BE(offset), type = savedPng.toString('ascii', offset + 4, offset + 8);
  if (type === 'IDAT') idat.push(savedPng.subarray(offset + 8, offset + 8 + length));
  offset += length + 12;
}
const scanlines = inflateSync(Buffer.concat(idat));
for (let y = 0; y < sheet.height; y++) {
  const start = y * (sheet.width * 4 + 1);
  if (scanlines[start] !== 0 || !scanlines.subarray(start + 1, start + 1 + sheet.width * 4).equals(sheet.pixels.subarray(y * sheet.width * 4, (y + 1) * sheet.width * 4))) throw new Error('PNG/grid mismatch');
}
console.log(`Validated 5 states / 10 frames + 16px head; SVG/JSON/PNG parity; sheet ${sheet.width}x${sheet.height}; 5 playback sequences.`);
console.log(`Unchanged generated outputs: ${unchanged}/${files.length} (all means deterministic regeneration).`);
