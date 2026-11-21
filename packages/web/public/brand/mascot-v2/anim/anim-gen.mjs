import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import assert from 'node:assert/strict';
import { validateManifest, playbackOrder, chooseVariation, resolveChange } from './player-contract.mjs';
import { buildTimeline, createMascotPlayer } from './player-runtime.mjs';

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
    if (expression === 'closed' || expression === 'half') {
      // Compress the actual socket/iris; retain the curved outer corners and cheek.
      const height = expression === 'half' ? 5 : 2;
      for (let x = left; x <= right; x++) for (let yy = 0; yy < height; yy++) {
        const y = 35 + yy + (x === left || x === right ? -1 : 0);
        const ink = sample(src.pixels, x, 30 + Math.round(yy * 9 / (height - 1)));
        out.set(ink, offset(x, y));
      }
      for (let x = center - 3; x <= center + 3; x++) {
        const y = 35 + (Math.abs(x - center) < 3 ? 1 : 0) + (center === 54 ? 1 : 0);
        out.set(NAVY, offset(x, y));
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
  // Flat-topped envelopes move each paw a full two pixels, leaving feet/laptop fixed.
  local: (x, y) => [0, phase * 2 * (
    Math.min(1, falloff(x, 41, 8) * 2) * Math.min(1, falloff(y, 68, 7) * 2) -
    Math.min(1, falloff(x, 55, 6) * 2) * Math.min(1, falloff(y, 67, 7) * 2)
  )],
});

// Row registration moves the existing art, including ears/tail, along a continuous
// silhouette path. Semantic height landmarks stop the face sliding into the torso.
function bridge(a, b, t, aY, bY, handover = 0.5) {
  const out = blank(), mid = aY.map((y, i) => y + (bY[i] - y) * t);
  function rowBounds(src, y) {
    let lo = SIZE, hi = -1;
    for (let x = 0; x < SIZE; x++) if (src.pixels[offset(x, y) + 3]) { lo = Math.min(lo, x); hi = x; }
    return hi < lo ? null : [lo, hi];
  }
  for (let y = Math.ceil(mid[0]); y <= Math.floor(mid.at(-1)); y++) {
    let k = 0;
    while (k < mid.length - 2 && y > mid[k + 1]) k++;
    const f = (y - mid[k]) / (mid[k + 1] - mid[k]);
    const ay = Math.round(aY[k] + f * (aY[k + 1] - aY[k]));
    const by = Math.round(bY[k] + f * (bY[k + 1] - bY[k]));
    const ab = rowBounds(a, ay), bb = rowBounds(b, by);
    if (!ab && !bb) continue;
    const aa = ab ?? bb, ba = bb ?? ab;
    const lo = Math.round(aa[0] + (ba[0] - aa[0]) * t), hi = Math.round(aa[1] + (ba[1] - aa[1]) * t);
    for (let x = lo; x <= hi; x++) {
      const u = (x - lo) / Math.max(1, hi - lo);
      const ca = ab ? sample(a.pixels, Math.round(aa[0] + u * (aa[1] - aa[0])), ay) : [0, 0, 0, 0];
      const cb = bb ? sample(b.pixels, Math.round(ba[0] + u * (ba[1] - ba[0])), by) : [0, 0, 0, 0];
      // Switch a whole registered part together; a row wipe would bisect the eyes.
      const c = t >= handover ? cb : ca;
      out.set(c, offset(x, y));
    }
  }
  return out;
}

function wakingHead(src) {
  const out = Buffer.from(src.pixels);
  // Open the two existing sleeping sockets in place before any stand-up motion.
  for (const [cx, cy] of [[29, 67], [48, 65]]) {
    for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) {
      const edge = Math.abs(y) === 2 || Math.abs(x) === 3;
      out.set(edge ? NAVY : x === -1 && y === -1 ? WHITE : AMBER, offset(cx + x, cy + y));
    }
  }
  return asPose(transform(asPose(out), { local: (x, y) => [0, -2 * falloff(x, 35, 31) * falloff(y, 57, 32)] }));
}

function layer(src, predicate) {
  const pixels = blank();
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (predicate(x, y)) pixels.set(sample(src.pixels, x, y), offset(x, y));
  return asPose(pixels);
}
function rig(src, sleeping = false, seated = false) {
  const head = sleeping ? (x, y) => y < 54 || (y < 77 && x < 60 && x > 12) : (x, y) => y < (seated ? 55 : 52);
  const tail = (x, y) => !head(x, y) && x >= (sleeping ? 57 : seated ? 62 : 60);
  return { head: layer(src, head), tail: layer(src, tail), body: layer(src, (x, y) => !head(x, y) && !tail(x, y)) };
}
function rigBridge(a, b, t, sleeping = false) {
  const left = rig(a, sleeping), right = rig(b, false, !sleeping);
  const out = asPose(blank());
  const mappings = sleeping ? {
    head: [[22, 40, 54, 66, 76], [8, 21, 28, 38, 51]],
    body: [[54, 77, 84, 90], [52, 70, 83, 90]],
    tail: [[54, 65, 78, 90], [54, 65, 78, 90]],
  } : {
    head: [[8, 21, 30, 40, 51], [9, 22, 31, 42, 54]],
    body: [[52, 65, 78, 90], [55, 66, 80, 90]],
    tail: [[54, 65, 78, 90], [56, 67, 80, 90]],
  };
  for (const name of ['tail', 'body', 'head']) {
    const [aY, bY] = mappings[name];
    // Change expression, paws and tail on different beats instead of one pose cut.
    composite(out, asPose(bridge(left[name], right[name], t, aY, bY, { head: 0.35, body: 0.55, tail: 0.75 }[name])), 0, 0);
  }
  return out.pixels;
}
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
const blink = eyes(idle, 'closed'), half = eyes(idle, 'half'), up = eyes(idle, 'up');
const awake = wakingHead(sleep);
const workBridge = [idle.pixels, ...[1, 2, 3, 4, 5, 6].map(n => rigBridge(idle, working, n / 7)), working.pixels];
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
  idle: [idle.pixels, idleMotion(idle, 1, 0, 0), idleMotion(half, 1, 0, 0), idleMotion(blink, 1, 0, 0), idleMotion(half, 1, 0, 0)],
  working: [working.pixels, typing(working, 1), working.pixels, typing(working, -1)],
  thinking: [idle.pixels, up.pixels, up.pixels, up.pixels],
  success: [jump(success, 0, 0.94, 1.04), jump(success, -4, 0.97, 0.98), jump(success, -2), success.pixels],
  error: [error.pixels, transform(error, { dx: -2 }), transform(error, { dx: 2 }), transform(error, { dx: -1 })],
  sleep: [sleep.pixels, breathe(sleep, 1), breathe(sleep, 2), breathe(sleep, 1)],
  wake: [sleep.pixels, breathe(sleep, 1), awake.pixels,
    ...[0.2, 0.4, 0.6, 0.8].map(t => rigBridge(awake, idle, t, true)), idle.pixels],
  loading: [
    jump(idle, 0, 0.94, 1.04), jump(idle, -2, 0.97, 1), jump(idle, -5, 0.97, 0.98),
    jump(idle, -3, 0.97, 0.98), jump(idle, -1), idle.pixels,
  ],
  celebrate: [jump(success, 0, 0.92, 1.05), jump(success, -6, 0.98, 0.98), jump(success, -4), jump(success, -2, 0.99, 1.01), jump(success, 0, 0.95, 1.04), success.pixels],
  'idle-to-working': workBridge,
  'working-to-idle': [...workBridge].reverse(),
};

const effects = {
  sparkle: glyph('sparkle', ['..s..', '..b..', 'sbabs', '..b..', '..s..'], 2),
  heart: glyph('heart', ['.aa...aa.', 'aaaa.aaaa', 'aaaaaaaaa', '.aaaaaaa.', '..aaaaa..', '...aaa...', '....a....'], 2),
  sweat: glyph('sweat', ['..b...', '..sb..', '.swsb.', '.swsb.', '.sssb.', '..bb..'], 2),
  bang: glyph('bang', ['aa', 'aa', 'aa', 'aa', '..', 'aa'], 2),
  question: glyph('question', ['.bbb.', 'bb.bb', '...bb', '..bb.', '..b..', '.....', '..b..'], 2),
  zzz: glyph('zzz', ['...........wwwww', '...........bbbbw', '.....wwww....bw.', '.....sssw...bw..', '......sw...wwwww', 'www..wwww.......', 'ssw.............', 'www.............'], 1),
  'typing-dots': glyph('typing-dots', ['ww..ww..ww', 'sb..sb..sb', 'ww..ww..ww']),
  'loading-dots': glyph('loading-dots', ['ww..ww..ww', 'bb..bb..aa', 'ww..ww..ww']),
  confetti: glyph('confetti', ['.b....a....s.', '.bb..aa..ss..', '..b..a..s....', '....w.....w..', '..a....b.....', '.aa..bb..s...', '..a..b..ss..a'], 2)
};

for (const state of states) sequences[state].forEach((pixels, n) => {
  const file = `frames/${state}-${n}.png`;
  checkFrame(file, pixels);
  writePng(file, SIZE, SIZE, pixels);
  if (!frameMap.has(state)) frameMap.set(state, []);
  frameMap.get(state).push(file);
});

const durations = { idle: [900, 900, 55, 95, 65], working: [120, 100, 100, 100], thinking: [260, 340, 420, 520], success: [120, 135, 160, 420], error: [210, 100, 100, 100], sleep: [650, 650, 650, 650], wake: [180, 160, 160, 160, 160, 160, 160, 420], loading: [120, 90, 100, 90, 80, 140], celebrate: [110, 170, 160, 120, 100, 460], 'idle-to-working': [140, 100, 100, 100, 100, 100, 100, 260], 'working-to-idle': [140, 100, 100, 100, 100, 100, 100, 260] };
const playback = { idle: 'loop', working: 'loop', thinking: 'loop', success: 'once', error: 'pingpong', sleep: 'loop', wake: 'once', loading: 'loop', celebrate: 'once', 'idle-to-working': 'once', 'working-to-idle': 'once' };
const manifest = { version: 2, canvas: { width: SIZE, height: SIZE }, sizes: [24, 48, 96, 192, 288, 384], anchor: { x: 48, y: BASELINE, baseline: BASELINE }, fallbackState: 'idle', transitionPolicy: { unsupported: 'snap-to-static', reducedMotion: 'destination-static', interrupt: 'destination-static', sameState: 'continue' }, palette: { navy: '#0a1a2f', azure: '#0b6bff', sky: '#5ca8ff', white: '#ffffff', amber: '#ffb020' }, states: {} };
const track = (name, ...positions) => ({
  name, src: effects[name].src, width: effects[name].w, height: effects[name].h, origin: { x: 0, y: 0 },
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
    frames: files.map((src, i) => ({ src, durationMs: durations[state][i], anchor: { ...manifest.anchor } })),
    playback: playback[state],
    onComplete: 'hold-last',
    staticFrame: { thinking: 2, success: 3, wake: 7, celebrate: 5, 'idle-to-working': 7, 'working-to-idle': 7 }[state] ?? 0,
    effects: tracks[state] ?? [],
  };
}
manifest.states.idle.sequence = [0, 1];
manifest.states.idle.idleVariations = { intervalMs: [3000, 5000], choices: [{ frames: [2, 3, 4, 1], weight: 1 }] };
manifest.transitions = { 'idle->working': 'idle-to-working', 'working->idle': 'working-to-idle', 'sleep->idle': 'wake' };
validateManifest(manifest);
for (const state of Object.values(manifest.states)) {
  for (const f of state.frames) { const im = decode(path.join(here, f.src)); checkFrame(f.src, im.pixels); }
  for (const effect of state.effects) { const im = decode(path.join(here, effect.src)); if (im.w !== effect.width || im.h !== effect.height) throw Error('Effect size: ' + effect.src); }
}
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
const contractSource = fs.readFileSync(path.join(here, 'player-contract.mjs'), 'utf8').replace(/^export /gm, '');
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
  <div class="tools"><button id="theme" aria-pressed="false" type="button">Dark backdrop</button><button id="size" type="button">Size: 3×</button></div>
  <output id="status" role="status" aria-live="polite"></output>
<script>
const { manifest, assets } = ${previewManifest};
${contractSource}
const controls = document.querySelector('#controls');
const stage = document.querySelector('#stage');
const caption = document.querySelector('#status');
const ctx = stage.getContext('2d');
ctx.imageSmoothingEnabled = false;
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const images = new Map();
let timer, generation = 0, current = 'idle', requestedState = 'idle', bridgeActive = false;

function load(src) {
  if (!images.has(src)) {
    const im = new Image();
    if (!assets[src]) return Promise.reject(new Error('Missing embedded sprite: ' + src));
    im.src = assets[src];
    images.set(src, im.decode().then(() => im, () => { images.delete(src); throw new Error('Image decode failed: ' + src); }));
  }
  return images.get(src);
}

async function select(name, initialFrame, thenState) {
  current = name;
  bridgeActive = Boolean(thenState);
  const id = ++generation;
  clearTimeout(timer);
  for (const button of controls.children) button.setAttribute('aria-pressed', button.dataset.state === name);
  const state = manifest.states[name];
  const frames = await Promise.all(state.frames.map(({src}) => load(src)));
  const tracks = await Promise.all(state.effects.map(async ({src,cues,behind,origin}) => ({ image: await load(src), cues, behind, origin })));
  if (generation !== id) return;

  const order = playbackOrder(state);
  const variation = state.idleVariations;
  let cursor = 0, variationFrames = [];
  function nextVariation() {
    const [lo, hi] = variation.intervalMs;
    return performance.now() + lo + Math.random() * (hi - lo);
  }
  let due = variation ? nextVariation() : Infinity;

  function paint(index) {
    ctx.clearRect(0, 0, stage.width, stage.height);
    for (const behind of [true, false]) {
      for (const {image,cues,behind:back,origin} of tracks) for (const {frame,attach} of cues) {
        if (frame === index && Boolean(back) === behind) ctx.drawImage(image, attach.x - origin.x, attach.y - origin.y);
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
    if (!variationFrames.length && performance.now() >= due) {
      variationFrames = [...chooseVariation(variation)];
      due = nextVariation();
    }
    const isVariation = variationFrames.length > 0;
    index = isVariation ? variationFrames.shift() : order[cursor++];
    paint(index);
    if (!isVariation && cursor === order.length) {
      if (state.playback === 'once') {
        if (thenState) timer = setTimeout(() => show(thenState, true), state.frames[index].durationMs);
        return;
      }
      cursor = 0;
    }
    timer = setTimeout(tick, state.frames[index].durationMs);
  }
  if (initialFrame !== undefined) {
    paint(initialFrame);
    if (initialFrame === order[0] && order.length > 1) cursor = 1;
    timer = setTimeout(tick, state.frames[initialFrame].durationMs);
  } else tick();
}

function show(name, force = false) {
  const before = generation;
  try {
    validateManifest(manifest);
    requestedState = name;
    const directBridge = Object.values(manifest.transitions).includes(name) && !motion.matches;
    const change = directBridge ? { state: name, initialFrame: 0 } : resolveChange(manifest, current, name, motion.matches, bridgeActive);
    if (change.continue && !force) return;
    select(change.state, change.initialFrame, change.thenState).catch(error => {
      if (generation === before + 1) { clearTimeout(timer); caption.textContent = error.message; caption.dataset.error = 'true'; }
    });
    delete caption.dataset.error;
  } catch (error) {
    ++generation;
    clearTimeout(timer);
    caption.textContent = error.message;
    caption.dataset.error = 'true';
  }
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
motion.addEventListener('change', () => show(requestedState, true));
let scale = 3;
document.querySelector('#size').addEventListener('click', event => {
  scale = scale === 3 ? 1 : scale + 1;
  stage.style.width = (manifest.canvas.width * scale) + 'px';
  event.currentTarget.textContent = 'Size: ' + scale + '×';
});
show(current, true);
</script>
</body>
</html>
`;
new Script(preview.slice(preview.indexOf('<script>') + 8, preview.indexOf('</script>')));
fs.writeFileSync(path.join(here, 'anim-preview.html'), preview);

// Asset-local checks run with the generator; no app, server or browser is started.
let rejected = 0;
for (const [field, mutate] of [
  ['version', m => m.version = 1], ['states', m => m.states.typo = m.states.idle],
  ['durationMs', m => m.states.idle.frames[0].durationMs = 0],
  ['staticFrame', m => m.states.idle.staticFrame = 99],
  ['sequence', m => m.states.idle.sequence = [-1]],
  ['intervalMs', m => m.states.idle.idleVariations.intervalMs = [5000, 3000]],
  ['intervalMs', m => m.states.idle.idleVariations.intervalMs = [1, Infinity]],
  ['choices', m => m.states.idle.idleVariations.choices = []],
  ['weight', m => m.states.idle.idleVariations.choices[0].weight = 0],
  ['weight', m => m.states.idle.idleVariations.choices[0].weight = NaN],
  ['frames index', m => m.states.idle.idleVariations.choices[0].frames = [99]],
  ['dimensions', m => m.states.sleep.effects[0].width = 0],
  ['origin', m => m.states.sleep.effects[0].origin.x = 99],
  ['bounds', m => m.states.sleep.effects[0].cues[0].attach.x = 95],
  ['frame', m => m.states.sleep.effects[0].cues[0].frame = 99],
  ['fallbackState', m => m.fallbackState = 'typo'],
  ['transitions', m => m.transitions['idle->typo'] = 'wake'],
]) {
  const bad = structuredClone(manifest); mutate(bad);
  assert.throws(() => validateManifest(bad), error => error.message.includes(field)); rejected++;
}
assert.deepEqual(playbackOrder(manifest.states.error), [0, 1, 2, 3, 2, 1]);
assert.deepEqual(chooseVariation(manifest.states.idle.idleVariations, 0.999999), [2, 3, 4, 1]);
for (const from of states) for (const to of states) {
  const result = resolveChange(manifest, from, to);
  assert.ok(manifest.states[result.state]);
  assert.equal(resolveChange(manifest, from, to, true).initialFrame, manifest.states[to].staticFrame);
}
assert.equal(resolveChange(manifest, 'idle', 'missing').state, 'idle');
for (const name of ['idle-to-working', 'working-to-idle']) {
  assert.deepEqual(sequences[name][0], name === 'idle-to-working' ? idle.pixels : working.pixels);
  assert.deepEqual(sequences[name].at(-1), name === 'idle-to-working' ? working.pixels : idle.pixels);
}
const changedPixels = (a, b) => {
  let count = 0;
  for (let i = 0; i < a.length; i += 4) if (!a.subarray(i, i + 4).equals(b.subarray(i, i + 4))) count++;
  return count;
};
const bridgeDeltas = Object.fromEntries(['wake', 'idle-to-working', 'working-to-idle'].map(name => [name,
  sequences[name].slice(1).map((frame, i) => changedPixels(sequences[name][i], frame)),
]));

const playerScript = preview.slice(preview.indexOf('<script>') + 8, preview.indexOf('</script>'));
async function playerFixture(failSrc) {
  const timers = new Map(), drawn = [], handlers = {};
  let now = 0, serial = 0;
  const caption = { textContent: '', dataset: {} };
  const controls = { children: [], append(b) { this.children.push(b); } };
  const button = () => ({ dataset: {}, setAttribute() {}, addEventListener() {} });
  const stage = { width: SIZE, height: SIZE, style: {}, classList: { toggle: () => true }, getContext: () => ({ clearRect() {}, drawImage(im) { drawn.push(im.src); } }) };
  const nodes = { '#controls': controls, '#stage': stage, '#status': caption, '#theme': button(), '#size': button() };
  const motion = { matches: false, addEventListener(event, fn) { handlers[event] = fn; } };
  const sandbox = {
    document: { querySelector: q => nodes[q], createElement: button },
    matchMedia: () => motion, performance: { now: () => now },
    Image: class { decode() { return this.src === assets[failSrc] ? Promise.reject(new Error('fixture decode')) : Promise.resolve(); } },
    setTimeout(fn, ms) { assert.ok(Number.isFinite(ms) && ms > 0); timers.set(++serial, { fn, ms }); return serial; },
    clearTimeout(id) { timers.delete(id); },
  };
  new Script(playerScript + ';globalThis.api = { show, manifest, load };').runInNewContext(sandbox, { timeout: 2000 });
  const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  await flush();
  return { api: sandbox.api, motion, handlers, caption, timers, drawn, flush, step() {
    const [id, job] = timers.entries().next().value ?? [];
    if (!job) return false;
    timers.delete(id); now += job.ms; job.fn(); return true;
  } };
}
const fixture = await playerFixture();
assert.equal(fixture.timers.size, 1);
for (let i = 0; i < 20; i++) fixture.step(); // includes the complete blink variation
fixture.api.show('success'); await fixture.flush();
for (let i = 0; i < 12 && fixture.step(); i++) {}
assert.equal(fixture.timers.size, 0, 'once holds its last frame');
fixture.api.show('idle'); fixture.api.show('working'); await fixture.flush();
assert.equal(fixture.timers.size, 1, 'rapid selections keep one timer');
fixture.motion.matches = true; fixture.handlers.change(); await fixture.flush();
assert.equal(fixture.timers.size, 0, 'reduced motion cancels playback');
assert.match(fixture.caption.textContent, /^working /, 'reduced motion during a bridge paints the destination');
fixture.motion.matches = false; fixture.handlers.change(); await fixture.flush();
assert.equal(fixture.timers.size, 1, 'motion preference change restarts the same loop');
fixture.api.manifest.states.idle.idleVariations.intervalMs = [10, 1]; fixture.api.show('idle');
assert.match(fixture.caption.textContent, /idleVariations.intervalMs/);
assert.equal(fixture.timers.size, 0);
const failed = await playerFixture('frames/idle-0.png');
assert.match(failed.caption.textContent, /Image decode failed: frames\/idle-0.png/);
failed.api.show('sleep'); await failed.flush();
assert.ok(!failed.caption.dataset.error, 'decode failure does not prevent selecting another state');
failed.api.show('idle'); failed.api.show('sleep'); await failed.flush();
assert.match(failed.caption.textContent, /^sleep /, 'stale decode failure cannot overwrite the newer state');

// The React adapter uses this actual DOM runtime; native animations are controlled
// here so boundary behavior is checked without starting an app/browser/test suite.
function runtimeFixture({ failedSrc, pendingDecode = false, nativeMotion = true } = {}) {
  const jobs = new Map(), native = [], errors = [], completed = [];
  let serial = 0;
  const doc = { createElement: () => {
    const node = { style: {}, children: [], ownerDocument: doc, setAttribute() {},
      append(child) { child.parent = this; this.children.push(child); },
      replaceChildren() { this.children = []; },
      remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); },
      animate(keyframes, options) {
        let resolve, reject;
        const animation = { keyframes, options, playState: 'running',
          finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
          finish() { if (this.playState !== 'idle') { this.playState = 'finished'; resolve(); } },
          cancel() { this.playState = 'idle'; reject(Error('cancelled')); },
          pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; },
        };
        native.push(animation); return animation;
      },
    };
    return node;
  } };
  const root = doc.createElement();
  if (!nativeMotion) root.animate = undefined;
  const player = createMascotPlayer(root, manifest, { baseUrl: 'https://mascot.invalid/anim/',
    onError: error => errors.push(error.message), onComplete: name => completed.push(name), random: () => 0,
    imageFactory: () => ({ src: '', decode() {
      return pendingDecode ? new Promise(() => {}) : this.src.endsWith(failedSrc ?? '<none>') ? Promise.reject(Error('decode fixture')) : Promise.resolve();
    } }),
    schedule(fn, ms) { jobs.set(++serial, { fn, ms }); return serial; }, unschedule(id) { jobs.delete(id); },
  });
  return { player, root, jobs, native, errors, completed,
    async flush() { for (let i = 0; i < 60; i++) await Promise.resolve(); },
    finish() { for (const animation of native.filter(a => a.playState === 'running' && a.options.iterations === 1)) animation.finish(); },
  };
}
const native = runtimeFixture();
native.player.setState({ state: 'idle', animated: true, loop: true, reducedMotion: false }); await native.flush();
assert.equal(native.jobs.size, 1, 'only a bounded idle-variation deadline remains');
const variationJob = [...native.jobs.entries()][0];
native.jobs.delete(variationJob[0]); variationJob[1].fn();
assert.equal(native.root.children.length, 2, 'variation overlays a paused normal timeline');
assert.ok(native.native.some(a => a.playState === 'paused'));
native.finish(); await native.flush();
assert.equal(native.root.children.length, 1);
assert.equal(native.jobs.size, 1, 'normal cursor resumes and next variation is bounded');
native.player.setState({ state: 'working', animated: true, loop: true, reducedMotion: false }); await native.flush();
assert.ok(native.root.children[0].children.some(im => im.src.endsWith('idle-to-working-0.png')));
native.finish(); await native.flush();
assert.ok(native.root.children[0].children.some(im => im.src.endsWith('working-0.png')), 'bridge hands off after final duration');
native.player.setState({ state: 'working', animated: true, loop: true, reducedMotion: true }); await native.flush();
assert.equal(native.root.children[0].children.length, 1);
assert.equal(native.native.filter(a => a.playState === 'running').length, 0, 'reduced motion creates no native animation');
native.player.setState({ state: 'unknown', animated: false, reducedMotion: false }); await native.flush();
assert.ok(native.root.children[0].children[0].src.endsWith('idle-0.png'));
native.player.setState({ state: 'success', animated: true, loop: false, reducedMotion: false }); await native.flush();
native.finish(); await native.flush(); // destination-static introduction
native.finish(); await native.flush(); // the once timeline
assert.deepEqual(native.completed, ['success']);
native.player.destroy(); await native.flush();
assert.equal(native.root.children.length, 0); assert.equal(native.jobs.size, 0);
assert.equal(native.native.filter(a => a.playState === 'running').length, 0);
const interrupted = runtimeFixture();
interrupted.player.setState({ state: 'idle', animated: true, loop: true, reducedMotion: false }); await interrupted.flush();
const previousAnimation = interrupted.native[0];
interrupted.player.setState({ state: 'idle', animated: true, loop: true, reducedMotion: false });
assert.equal(previousAnimation.playState, 'running', 'same-state requests retain the cursor');
interrupted.player.setState({ state: 'working', animated: true, loop: true, reducedMotion: false }); await interrupted.flush();
interrupted.player.setState({ state: 'working', animated: true, loop: true, reducedMotion: true }); await interrupted.flush();
assert.ok(interrupted.root.children[0].children[0].src.endsWith('working-0.png'), 'reduce during bridge selects destination staticFrame');
assert.equal(interrupted.native.filter(a => a.playState === 'running').length, 0);
interrupted.player.destroy();
const stale = runtimeFixture({ failedSrc: 'error-0.png' });
stale.player.setState({ state: 'error', animated: true, reducedMotion: false });
stale.player.setState({ state: 'sleep', animated: false, reducedMotion: false }); await stale.flush();
assert.deepEqual(stale.errors, [], 'superseded image failures are ignored');
assert.ok(stale.root.children[0].children[0].src.endsWith('sleep-0.png')); stale.player.destroy();
const pending = runtimeFixture({ pendingDecode: true });
pending.player.setState({ state: 'working', animated: true, reducedMotion: false });
pending.player.destroy(); await pending.flush();
assert.equal(pending.jobs.size, 0, 'unmount cancels outstanding decode deadlines');
assert.equal(pending.root.children.length, 0); assert.deepEqual(pending.errors, []);
const unsupported = runtimeFixture({ nativeMotion: false });
unsupported.player.setState({ state: 'success', animated: true, reducedMotion: false }); await unsupported.flush();
assert.ok(unsupported.root.children[0].children[0].src.endsWith('success-3.png'));
unsupported.player.destroy();
const timeline = buildTimeline(manifest, 'celebrate');
assert.equal(timeline.durationMs, durations.celebrate.reduce((a, b) => a + b));
assert.ok(timeline.layers[0].src.endsWith('confetti.png'), 'behind effects precede body');
assert.ok(timeline.layers.every(layer => layer.keyframes[0].offset === 0 && layer.keyframes.at(-1).offset === 1));
console.log('Validated native React-consumer runtime: stepped timing, effect layers, variations, bridge handoff, reduced motion, once completion, fallback, stale decode suppression, unmount cleanup and static degradation');
console.log(`Validated v2 contract, ${rejected} malformed-manifest cases, all ${states.length ** 2} state pairs, and preview playback/variation/cancellation/reduced-motion/decode fixtures`);
console.log('Adjacent changed pixels (pose diagnostics, not a motion-quality score): ' + JSON.stringify(bridgeDeltas));
console.log(`Generated ${states.length} states, ${[...frameMap.values()].reduce((n, xs) => n + xs.length, 0)} frames, ${Object.keys(effects).length} effect PNG/SVG pairs`);
console.log(`Verified binary alpha, source palette, and canvas margin (minimum ${margin}px) on all body frames`);
console.log(`Wrote animations.json, anim-preview.html, strips.png (${stripW}x${stripH}; light and dark rows)`);
