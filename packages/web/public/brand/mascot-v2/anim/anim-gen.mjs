import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const finalDir = path.resolve(here, '..', 'final');
const framesDir = path.join(here, 'frames');
const effectsDir = path.join(here, 'effects');
const SIZE = 96;
const BG_LIGHT = [255, 255, 255, 255];
const BG_DARK = [8, 18, 45, 255];
const NAVY = [10, 26, 47, 255];
const AZURE = [11, 107, 255, 255];
const SKY = [92, 168, 255, 255];
const WHITE = [255, 255, 255, 255];
const AMBER = [255, 176, 32, 255];
const BASELINE = 91;
const states = ['idle', 'working', 'thinking', 'success', 'error', 'sleep', 'wake', 'loading', 'celebrate', 'idle-to-working', 'working-to-idle'];

// Based on the PNG codec in ../extract/extract.mjs, which also writes source assets.
function decode(file) {
  const b = fs.readFileSync(file);
  if (b.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw Error(`Not PNG: ${file}`);
  let w = 0, h = 0, depth = 0, type = 0, interlace = 0, data = Buffer.alloc(0), p = 8;
  while (p < b.length) {
    const n = b.readUInt32BE(p), t = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + n); p += 12 + n;
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; interlace = d[12]; }
    if (t === 'IDAT') data = Buffer.concat([data, d]);
    if (t === 'IEND') break;
  }
  if (depth !== 8 || interlace !== 0 || type !== 6) throw Error(`Expected 8-bit RGBA PNG: ${file}`);
  const raw = zlib.inflateSync(data), stride = w * 4, pixels = Buffer.alloc(h * stride); let q = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[q++], row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? pixels[row + x - 4] : 0, up = y ? pixels[row - stride + x] : 0, ul = y && x >= 4 ? pixels[row - stride + x - 4] : 0;
      const v = raw[q++]; let z = v;
      if (filter === 1) z += a;
      else if (filter === 2) z += up;
      else if (filter === 3) z += Math.floor((a + up) / 2);
      else if (filter === 4) { const t = a + up - ul, pa = Math.abs(t - a), pb = Math.abs(t - up), pc = Math.abs(t - ul); z += pa <= pb && pa <= pc ? a : pb <= pc ? up : ul; }
      else if (filter !== 0) throw Error(`Unknown PNG filter ${filter}`);
      pixels[row + x] = z & 255;
    }
  }
  return { w, h, pixels };
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc(data) { let c = 0xffffffff; for (const x of data) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function png(w, h, pix) {
  const rows = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) { rows[y * (1 + w * 4)] = 0; pix.copy(rows, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4); }
  const chunk = (type, data) => { const tb = Buffer.from(type), out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length); tb.copy(out, 4); data.copy(out, 8); out.writeUInt32BE(crc(Buffer.concat([tb, data])), 8 + data.length); return out; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function blank(w = SIZE, h = SIZE) { return Buffer.alloc(w * h * 4); }
const offset = (x, y) => (y * SIZE + x) * 4;
const sample = (pixels, x, y) => pixels.subarray(offset(x, y), offset(x, y) + 4);
const asPose = pixels => ({ w: SIZE, h: SIZE, pixels });
const falloff = (value, center, radius) => Math.max(0, 1 - Math.abs(value - center) / radius);

// Sample each destination pixel once; forward stretching would leave empty rows.
function transform(src, { dx = 0, dy = 0, sx = 1, sy = 1, local = () => [0, 0] } = {}) {
  const out = blank();
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const [lx, ly] = local(x, y);
    const u = Math.round((x - 48 - dx - lx) / sx + 48);
    const v = Math.round((y - BASELINE - dy - ly) / sy + BASELINE);
    if (u >= 0 && v >= 0 && u < SIZE && v < SIZE && src.pixels[offset(u, v) + 3]) {
      out.set(sample(src.pixels, u, v), offset(x, y));
    }
  }
  return out;
}
function eyes(src, expression) {
  const out = Buffer.from(src.pixels);
  // The sampled white is from between the sockets in the idle master.
  const cheek = sample(src.pixels, 48, 35);
  for (const [left, right, center] of [[32, 42, 37], [50, 59, 54]]) {
    for (let y = 30; y <= 39; y++) for (let x = left; x <= right; x++) {
      out.set(cheek, offset(x, y));
    }
    if (expression === 'closed') {
      for (let x = center - 3; x <= center + 3; x++) {
        out.set(NAVY, offset(x, Math.abs(x - center) >= 3 ? 36 : 37));
      }
    } else {
      for (let y = 30; y <= 39; y++) for (let x = left; x <= right; x++) {
        const ink = sample(src.pixels, x, y);
        if (ink[0] > 200 && ink[2] > 200) continue;
        // Keep the socket outline, and raise the colored iris and its highlights.
        const higher = y >= 32 ? sample(src.pixels, x, Math.min(39, y + 2)) : ink;
        const amber = higher[0] > 190 && higher[1] < 200 && higher[2] < 50;
        const wasAmber = ink[0] > 190 && ink[1] < 200 && ink[2] < 50;
        out.set(amber ? higher : wasAmber ? NAVY : ink, offset(x, y));
      }
    }
  }
  return asPose(out);
}
const idleMotion = (src, breathe, tail, ear) => transform(src, {
  local: (x, y) => [
    tail * Math.max(0, Math.min(1, (x - 62) / 12)) * falloff(y, 63, 23),
    -breathe * falloff(y, 27, 62) - ear * falloff(x, 61, 10) * falloff(y, 8, 14),
  ],
});
const typing = (src, phase) => transform(src, {
  local: (x, y) => [0, phase * (
    falloff(x, 49, 11) * falloff(y, 73, 8) -
    falloff(x, 58, 10) * falloff(y, 67, 9)
  )],
});
const jump = (src, dy, sy = 1, sx = 1) => transform(src, { dy, sy, sx });
const breathe = (src, amount) => transform(src, {
  local: (x, y) => [0, -amount * falloff(x, 64, 38) * falloff(y, 59, 29)],
});
function composite(a, b, x, y) {
  if (x < 0 || y < 0 || x + b.w > a.w || y + b.h > a.h) throw Error('Sprite exceeds its canvas');
  for (let yy = 0; yy < b.h; yy++) for (let xx = 0; xx < b.w; xx++) {
    const i = (yy * b.w + xx) * 4;
    if (b.pixels[i + 3]) a.pixels.set(b.pixels.subarray(i, i + 4), ((y + yy) * a.w + x + xx) * 4);
  }
}
function glyph(name, rows, scale = 1) {
  const colors = { n: NAVY, a: AMBER, s: SKY, b: AZURE, w: WHITE };
  const w = Math.max(...rows.map(row => row.length)) * scale, h = rows.length * scale;
  const p = blank(w, h);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">\n`;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      let end = x + 1;
      while (row[end] === row[x]) end++;
      const c = colors[row[x]];
      if (c) {
        for (let yy = y * scale; yy < (y + 1) * scale; yy++) for (let xx = x * scale; xx < end * scale; xx++) p.set(c, (yy * w + xx) * 4);
        svg += `  <rect x="${x * scale}" y="${y * scale}" width="${(end - x) * scale}" height="${scale}" fill="rgb(${c[0]},${c[1]},${c[2]})"/>\n`;
      }
      x = end;
    }
  });
  const src = `effects/${name}.png`;
  writePng(src, w, h, p);
  fs.writeFileSync(path.join(effectsDir, `${name}.svg`), `${svg}</svg>\n`);
  return { src, w, h, pixels: p };
}

fs.mkdirSync(framesDir, { recursive: true }); fs.mkdirSync(effectsDir, { recursive: true });
const assets = {};
function writePng(src, w, h, pixels) {
  const bytes = png(w, h, pixels);
  fs.writeFileSync(path.join(here, src), bytes);
  assets[src] = `data:image/png;base64,${bytes.toString('base64')}`;
}
const pose = name => {
  const im = decode(path.join(finalDir, `onni-${name}.png`));
  if (im.w !== SIZE || im.h !== SIZE) throw Error(`Unexpected dimensions: ${name}`);
  return im;
};
const idle = pose('idle'), working = pose('working'), success = pose('success'), error = pose('error'), sleep = pose('sleep');
const blink = eyes(idle, 'closed'), up = eyes(idle, 'up');
const frameMap = new Map();

const allowed = new Set(['10,26,47', '5,16,31', '23,43,68', '11,107,255', '92,168,255', '255,255,255', '220,239,255', '255,176,32', '220,132,24']);
let margin = SIZE;
function checkFrame(file, pixels) {
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const c = sample(pixels, x, y);
    if (!c[3]) continue;
    if (c[3] !== 255 || !allowed.has(c.subarray(0, 3).join(','))) throw Error(`Fringe or off-palette pixel: ${file} ${x},${y}`);
    margin = Math.min(margin, x, y, SIZE - 1 - x, SIZE - 1 - y);
    if (!x || !y || x === SIZE - 1 || y === SIZE - 1) throw Error(`Sprite touches canvas edge: ${file}`);
  }
}

const sequences = {
  idle: [idle.pixels, idleMotion(idle, 1, 2, 0), idleMotion(blink, 1, 2, 0), idleMotion(idle, 0, -2, 2)],
  working: [working.pixels, typing(working, 3), typing(working, 0.6), typing(working, -3)],
  thinking: [idle.pixels, idleMotion(up, 1, 1, 1), idleMotion(up, 2, -1, 0), idleMotion(up, 1, 1, 0)],
  success: [jump(success, 0, 0.94, 1.04), jump(success, -4, 0.97, 0.98), jump(success, -2), success.pixels],
  error: [error.pixels, transform(error, { dx: -2 }), transform(error, { dx: 2 }), transform(error, { dx: -1 })],
  sleep: [sleep.pixels, breathe(sleep, 1), breathe(sleep, 2), breathe(sleep, 1)],
  wake: [sleep.pixels, breathe(sleep, 2), jump(blink, 0, 0.82, 1.03), idle.pixels],
  loading: [
    jump(idle, 0, 0.94, 1.04), jump(idle, -2, 0.97, 1), jump(idle, -5, 0.97, 0.98),
    jump(idle, -3, 0.97, 0.98), jump(idle, -1), idle.pixels,
  ],
  celebrate: [jump(success, 0, 0.92, 1.05), jump(success, -6, 0.98, 0.98), jump(success, -4), jump(success, 0, 0.95, 1.04), success.pixels],
  'idle-to-working': [idle.pixels, jump(blink, 0, 0.89, 1.01), jump(working, -1, 0.97), working.pixels],
  'working-to-idle': [working.pixels, typing(working, 2), jump(blink, 0, 0.89, 1.01), idle.pixels],
};

const effects = {
  sparkle: glyph('sparkle', ['..s..', '..b..', 'sbabs', '..b..', '..s..'], 2),
  heart: glyph('heart', ['.aa...aa.', 'aaaa.aaaa', 'aaaaaaaaa', '.aaaaaaa.', '..aaaaa..', '...aaa...', '....a....'], 2),
  sweat: glyph('sweat', ['..b...', '..sb..', '.swsb.', '.swsb.', '.sssb.', '..bb..'], 2),
  bang: glyph('bang', ['aa', 'aa', 'aa', 'aa', '..', 'aa'], 2),
  question: glyph('question', ['.bbb.', 'bb.bb', '...bb', '..bb.', '..b..', '.....', '..b..'], 2),
  zzz: glyph('zzz', ['...........bbbbb', '..............b.', '.....ssss....b..', '.......s....b...', '......s....bbbbb', 'sss..ssss.......', '.s..............', 'sss.............'], 1),
  'typing-dots': glyph('typing-dots', ['ss..bb..bb', 'ss..bb..bb']),
  'loading-dots': glyph('loading-dots', ['bb..bb..aa', 'bb..bb..aa']),
  confetti: glyph('confetti', ['.b....a....s.', '.bb..aa..ss..', '..b..a..s....', '....w.....w..', '..a....b.....', '.aa..bb..s...', '..a..b..ss..a'], 2)
};

for (const state of states) sequences[state].forEach((pixels, n) => {
  const file = `frames/${state}-${n}.png`;
  checkFrame(file, pixels);
  writePng(file, SIZE, SIZE, pixels);
  if (!frameMap.has(state)) frameMap.set(state, []);
  frameMap.get(state).push(file);
});

const durations = { idle: [900, 900, 135, 420], working: [120, 100, 100, 100], thinking: [260, 340, 420, 520], success: [120, 135, 160, 420], error: [480, 75, 75, 75], sleep: [650, 650, 650, 650], wake: [220, 175, 125, 420], loading: [120, 90, 100, 90, 80, 140], celebrate: [110, 170, 160, 100, 460], 'idle-to-working': [140, 110, 150, 260], 'working-to-idle': [140, 110, 130, 260] };
const playback = { idle: 'loop', working: 'loop', thinking: 'loop', success: 'once', error: 'pingpong', sleep: 'loop', wake: 'once', loading: 'loop', celebrate: 'once', 'idle-to-working': 'once', 'working-to-idle': 'once' };
const manifest = { version: 1, canvas: { width: SIZE, height: SIZE }, anchor: { x: 48, y: BASELINE, baseline: BASELINE }, palette: { navy: '#0a1a2f', azure: '#0b6bff', sky: '#5ca8ff', white: '#ffffff', amber: '#ffb020' }, states: {} };
const track = (name, ...positions) => ({
  name, src: effects[name].src,
  ...(name === 'confetti' && { behind: true }),
  cues: positions.map(([frame, x, y]) => ({ frame, attach: { x, y } })),
});
const tracks = {
  working: [track('typing-dots', [1, 13, 55], [2, 15, 53], [3, 17, 55])],
  thinking: [
    track('question', [1, 70, 16], [2, 71, 12], [3, 71, 11]),
    track('typing-dots', [0, 67, 36], [2, 69, 31], [3, 69, 30]),
  ],
  success: [track('sparkle', [1, 7, 14], [2, 6, 11]), track('heart', [2, 65, 6], [3, 67, 3])],
  error: [track('bang', [1, 14, 18], [2, 13, 16], [3, 14, 17]), track('sweat', [2, 72, 19], [3, 72, 23])],
  sleep: [track('zzz', [0, 55, 29], [1, 57, 24], [2, 59, 19], [3, 61, 14])],
  wake: [track('zzz', [0, 59, 19], [1, 61, 14])],
  loading: [track('loading-dots', [0, 72, 43], [1, 73, 40], [2, 74, 35], [3, 75, 38], [4, 76, 41], [5, 77, 43])],
  celebrate: [
    track('confetti', [1, 1, 8], [2, 1, 14], [3, 1, 23], [1, 69, 5], [2, 69, 11], [3, 69, 20]),
    track('sparkle', [1, 9, 39], [2, 7, 44], [3, 5, 48]),
    track('heart', [2, 68, 35], [3, 69, 32], [4, 70, 28]),
  ],
};
for (const state of states) {
  const files = frameMap.get(state);
  if (!files.length || files.length > 8 || files.length !== durations[state].length) throw Error(`Invalid frame budget or timing: ${state}`);
  manifest.states[state] = {
    frames: files.map((src, i) => ({ src, durationMs: durations[state][i] })),
    playback: playback[state],
    staticFrame: { thinking: 2, success: 3, wake: 3, celebrate: 4, 'idle-to-working': 3, 'working-to-idle': 3 }[state] ?? 0,
    effects: tracks[state] ?? [],
  };
}
manifest.states.idle.sequence = [0, 1, 3];
manifest.states.idle.idleVariations = { intervalMs: [3000, 5000], choices: [{ frame: 2, weight: 1 }] };
manifest.transitions = { 'idle->working': 'idle-to-working', 'working->idle': 'working-to-idle', 'sleep->idle': 'wake' };
fs.writeFileSync(path.join(here, 'animations.json'), `${JSON.stringify(manifest, null, 2)}\n`);

// Show the same effect placements as the player, while keeping the frame PNGs reusable.
const stripW = SIZE * Math.max(...Object.values(sequences).map(frames => frames.length));
const rowH = 100, stripH = states.length * rowH * 2, strip = blank(stripW, stripH);
function fillRect(x, y, w, h, c) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) strip.set(c, (yy * stripW + xx) * 4); }
for (const [si, state] of states.entries()) for (const [theme, bg] of [BG_LIGHT, BG_DARK].entries()) {
  const y = (si * 2 + theme) * rowH;
  fillRect(0, y, stripW, rowH, bg);
  sequences[state].forEach((pixels, fi) => {
    const card = asPose(blank());
    for (const behind of [true, false]) {
      for (const { name, cues, behind: back } of manifest.states[state].effects) for (const { frame, attach } of cues) {
        if (frame === fi && Boolean(back) === behind) composite(card, effects[name], attach.x, attach.y);
      }
      if (behind) composite(card, asPose(pixels), 0, 0);
    }
    composite({ w: stripW, h: stripH, pixels: strip }, card, fi * SIZE, y + 2);
  });
}
fs.writeFileSync(path.join(here, 'strips.png'), png(stripW, stripH, strip));

const previewManifest = JSON.stringify({ manifest, assets });
const preview = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Onni mascot motion studies</title>
<style>
  :root{color-scheme:dark;background:#08122d;color:#dcefff;font:16px system-ui,sans-serif}
  body{margin:clamp(16px,5vw,48px) auto;padding:0 16px;max-width:740px}
  h1{font-size:clamp(24px,5vw,36px);margin:.15em 0 .45em}
  p,output{color:#afceed}
  .eyebrow{font:600 .72rem ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:#80b9ff}
  #controls,.tools{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
  button{font:inherit;color:inherit;background:#122951;border:1px solid #46658c;border-radius:6px;padding:.4em .7em;cursor:pointer}
  button[aria-pressed=true]{background:#2054a6;border-color:#80b9ff}
  button:focus-visible{outline:2px solid #ffb020;outline-offset:3px}
  canvas{width:288px;height:288px;max-width:100%;aspect-ratio:1;height:auto;image-rendering:pixelated;background:#fff;border:1px solid #46658c;border-radius:8px;display:block}
  canvas.dark{background:#08122d}
</style>
<body>
  <span class="eyebrow">Onni Studio · Motion Library</span>
  <h1>Onni mascot motion studies</h1>
  <p>Choose a pose or transition to see the body frames and pixel effects together.</p>
  <div id="controls" role="group" aria-label="Animation states"></div>
  <canvas id="stage" width="96" height="96" role="img" aria-label="Onni mascot sprite"></canvas>
  <div class="tools"><button id="theme" aria-pressed="false" type="button">Dark backdrop</button></div>
  <output id="status"></output>
<script>
const { manifest, assets } = ${previewManifest};
const controls = document.querySelector('#controls');
const stage = document.querySelector('#stage');
const caption = document.querySelector('#status');
const ctx = stage.getContext('2d');
ctx.imageSmoothingEnabled = false;
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const images = new Map();
let timer, generation = 0, current = 'idle';

function load(src) {
  if (!images.has(src)) {
    const im = new Image();
    im.src = assets[src];
    images.set(src, im.decode().then(() => im));
  }
  return images.get(src);
}

async function select(name) {
  current = name;
  const id = ++generation;
  clearTimeout(timer);
  for (const button of controls.children) button.setAttribute('aria-pressed', button.dataset.state === name);
  const state = manifest.states[name];
  const frames = await Promise.all(state.frames.map(({src}) => load(src)));
  const tracks = await Promise.all(state.effects.map(async ({src,cues,behind}) => ({ image: await load(src), cues, behind })));
  if (generation !== id) return;

  const sequence = state.sequence ?? state.frames.map((_, i) => i);
  const order = state.playback === 'pingpong' ? sequence.concat(sequence.slice(1, -1).reverse()) : sequence;
  const variation = state.idleVariations;
  let cursor = 0;
  function nextVariation() {
    const [lo, hi] = variation.intervalMs;
    return performance.now() + lo + Math.random() * (hi - lo);
  }
  let due = variation ? nextVariation() : Infinity;

  function paint(index) {
    ctx.clearRect(0, 0, stage.width, stage.height);
    for (const behind of [true, false]) {
      for (const {image,cues,behind:back} of tracks) for (const {frame,attach} of cues) {
        if (frame === index && Boolean(back) === behind) ctx.drawImage(image, attach.x, attach.y);
      }
      if (behind) ctx.drawImage(frames[index], 0, 0);
    }
  }

  caption.textContent = name + ' · ' + state.frames.length + ' frames · ' +
    (motion.matches ? 'static (reduced motion)' : state.playback);
  if (motion.matches) return paint(state.staticFrame);

  function tick() {
    if (generation !== id) return;
    let index;
    if (performance.now() >= due) {
      const total = variation.choices.reduce((sum, choice) => sum + choice.weight, 0);
      let pick = Math.random() * total;
      index = variation.choices.find(choice => (pick -= choice.weight) < 0).frame;
      due = nextVariation();
    } else {
      index = order[cursor++];
    }
    paint(index);
    if (cursor === order.length) {
      if (state.playback === 'once') return;
      cursor = 0;
    }
    timer = setTimeout(tick, state.frames[index].durationMs);
  }
  tick();
}

function show(name) {
  select(name).catch(() => { caption.textContent = 'Could not load the embedded sprites.'; });
}
for (const name of Object.keys(manifest.states)) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = name.replaceAll('-', ' ');
  button.dataset.state = name;
  button.addEventListener('click', () => show(name));
  controls.append(button);
}
document.querySelector('#theme').addEventListener('click', event => {
  event.currentTarget.setAttribute('aria-pressed', stage.classList.toggle('dark'));
});
motion.addEventListener('change', () => show(current));
show(current);
</script>
</body>
</html>
`;
new Script(preview.slice(preview.indexOf('<script>') + 8, preview.indexOf('</script>')));
fs.writeFileSync(path.join(here, 'anim-preview.html'), preview);
console.log(`Generated ${states.length} states, ${[...frameMap.values()].reduce((n, xs) => n + xs.length, 0)} frames, ${Object.keys(effects).length} effect PNG/SVG pairs`);
console.log(`Verified binary alpha, source palette, and canvas margin (minimum ${margin}px) on all body frames`);
console.log(`Wrote animations.json, anim-preview.html, strips.png (${stripW}x${stripH}; light and dark rows)`);
