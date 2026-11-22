/**
 * Hand-drawn V2 reference: dawn and dusk over Ha Long Bay. The composition
 * uses receding karst ranks, broken valley fog, and a warm junk as the scale cue.
 */
import { createSpriteSheet, parseSprite } from '../../engine/sprite'
import type { BuildCtx, Palettes, SceneDef } from '../../engine/types'

const enum Ink {
  SkyTop, SkyMid, SkyLow, Cloud, Sun, Halo,
  FarMist, FarRock, FarRim, MidRock, MidFace, MidRim,
  NearRock, NearFace, NearRim, WaterDeep, WaterMid, WaterLight,
  Wave0, Wave1, Wave2, Wave3, Wave4, Wave5,
  SailShadow, Sail, Hull, Wake, Fog, Bird, Accent, Cave,
}

const ramp = (sky: readonly number[], rock: readonly number[], water: readonly number[], sail: readonly number[]): readonly number[] => [
  ...sky, ...rock, ...water, 0x3a6670, 0x578992, 0x75a3a4, 0x9bc0b4, 0xc7d3b4, 0xe2ce97,
  sail[0]!, sail[1]!, 0x382d31, 0xd4c08c, 0xb4c1af, 0x273b45, 0xe3d8ad, 0x1c3038,
]

const light: Palettes = {
  dawn: ramp([0xa9cddb, 0xc0d4d1, 0xf3d9b0, 0xd9d9ca, 0xf4dbac, 0xf8e8c8], [0x8ba8a5, 0x557b74, 0xb7b685, 0x426660, 0x294c52, 0xc4c493, 0x1d4549, 0x37645e, 0xa4ae83], [0x285c6c, 0x42858d, 0x75a3a0], [0x6c4238, 0x965b40]),
  day: ramp([0x87bdd0, 0xb9d5d7, 0xdde3c8, 0xd1ded6, 0xf0d58e, 0xf7e6b2], [0x83a49e, 0x4b726e, 0xb2bd82, 0x3e615e, 0x24494e, 0xc6cc95, 0x1c4048, 0x345e5a, 0xa5b47c], [0x236274, 0x3f8f99, 0x77b5ae], [0x674237, 0x9b6445]),
  dusk: ramp([0x526787, 0x8d8490, 0xb67a77, 0x9d8b90, 0xe1ab7e, 0xe9c494], [0x536a72, 0x37525c, 0xa08074, 0x294651, 0x172a35, 0xae8d77, 0x1b3542, 0x304b56, 0x866f66], [0x18394c, 0x203f53, 0x4d7180], [0x563d3f, 0x784e48]),
  night: ramp([0x152844, 0x263953, 0x40516a, 0x33465d, 0xb5c5c9, 0xd5d8c1], [0x354958, 0x2e4752, 0x77867d, 0x233b4a, 0x152a39, 0x89958c, 0x172a39, 0x2a404b, 0x65766e], [0x142e43, 0x24536b, 0x4f7d85], [0x4d4144, 0x82624e]),
}
const dark: Palettes = {
  dawn: ramp([0x42556e, 0x71808b, 0xb8927d, 0x829099, 0xdfb786, 0xf0d39c], [0x526a6d, 0x385861, 0x9a9270, 0x294956, 0x19333f, 0xb5a57c, 0x1b3643, 0x31505a, 0x7b7c66], [0x1b4052, 0x2e6874, 0x669498], [0x613f3d, 0x895848]),
  day: ramp([0x304d67, 0x638899, 0xaec6bd, 0x93afb1, 0xd8c78b, 0xe7d7a9], [0x486b6d, 0x31545a, 0x8e986d, 0x254752, 0x162e39, 0xaab782, 0x18323d, 0x2d4b51, 0x73866e], [0x1a4c61, 0x2d7480, 0x609aa0], [0x593d39, 0x865c42]),
  dusk: ramp([0x202e4d, 0x604d62, 0xb67a77, 0x856573, 0xdb9a75, 0xe2b189], [0x29424d, 0x37525c, 0xa08074, 0x263e4b, 0x172a35, 0xb08b79, 0x152c39, 0x29434d, 0x806963], [0x153149, 0x203f53, 0x54747d], [0x593c41, 0x784e48]),
  night: ramp([0x101c34, 0x1c2d47, 0x34455f, 0x2d3c55, 0x91a9b1, 0xbac3bc], [0x263b4b, 0x29424e, 0x75827d, 0x1c3342, 0x102331, 0x778a82, 0x122634, 0x223943, 0x5b6e68], [0x10273d, 0x1c455b, 0x416d77], [0x493d43, 0x765848]),
}

const boatSheet = createSpriteSheet(parseSprite([
  '...........b............',
  '..........abb...........',
  '.........aabb...........',
  '........aaabb...........',
  '.......aaaabb...........',
  '......aaaaabb...........',
  '.......aaaabb...........',
  '.........a.bb...........',
  '...........b............',
  '.....cccccccccccccc.....',
  '....cccccccccccccccc....',
  '.....dddddddddddddd.....',
  '..........dddd..........',
  '........................',
  '........................',
  '........................',
  '...........b............',
  '..........aabb..........',
  '.........aaabb..........',
  '........aaaabb..........',
  '.......aaaaabb..........',
  '......aaaaaabb..........',
  '.......aaa..bb..........',
  '.........a...b..........',
  '.............b..........',
  '.....cccccccccccccc.....',
  '....cccccccccccccccc....',
  '.....dddddddddddddd.....',
  '..........dddd..........',
  '........................',
  '........................',
  '........................',
], { a: Ink.Sail, b: Ink.SailShadow, c: Ink.Hull, d: Ink.Wake }), [
  { x: 0, y: 0, width: 24, height: 16, pivot: { x: 12, y: 12 } },
  { x: 0, y: 16, width: 24, height: 16, pivot: { x: 12, y: 12 } },
])

function drawSky(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'sky', z: 0 }, () => {
    for (let y = 0; y < h * 0.64; y++) {
      const level = Math.min(2.95, y / h * 4.6)
      for (let x = 0; x < w; x++) ctx.px(x, y, ctx.dither(x, y, level % 1, Math.floor(level), Math.ceil(level)))
    }
    ctx.disc(w * 0.80, h * 0.27, Math.min(w, h) * 0.052, Ink.Sun)
    for (let i = 0; i < 5; i++) ctx.line(w * (0.08 + i * 0.19), h * (0.19 + (i & 1) * 0.035), w * (0.19 + i * 0.19), h * (0.19 + (i & 1) * 0.035), Ink.Cloud)
  })
}

function karst(
  ctx: BuildCtx, left: number, right: number, peak: number, base: number,
  shadow: Ink, face: Ink, rim: Ink, profile: readonly number[],
): void {
  const { width: w, height: h } = ctx
  for (let x = Math.floor(left * w); x < right * w; x++) {
    const u = (x / w - left) / (right - left)
    const clamped = Math.max(0, Math.min(1, u))
    const point = clamped * (profile.length - 1)
    const index = Math.min(profile.length - 2, Math.floor(point))
    const shape = profile[index]! + (profile[index + 1]! - profile[index]!) * (point - index)
    const notch = (ctx.fbm2(x * 0.11 + peak * 991, 14) - 0.5) * 0.055
    const top = base - (base - peak) * Math.max(0, Math.min(1, shape + notch))
    for (let y = Math.floor(top * h); y < base * h; y++) {
      const faceStart = 0.32 + shape * 0.12
      let ink = clamped > faceStart && clamped < 0.82 ? face : shadow
      if (clamped > 0.70 && y < (top + 0.035) * h) ink = rim
      if (ctx.fbm2(x * 0.13, y * 0.06) > 0.78) ink = clamped > faceStart ? face : shadow
      ctx.px(x, y, ink)
    }
  }
}

function drawWater(ctx: BuildCtx, waterline: number): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'water', z: 4 }, () => {
    for (let y = waterline; y < h; y++) {
      const depth = (y - waterline) / (h - waterline)
      ctx.rect(0, y, w, 1, ctx.dither(0, y, depth * 0.8 + 0.15, Ink.WaterDeep, Ink.WaterMid))
      for (let x = (y & 3) * 5; x < w; x += Math.max(13, Math.floor(25 - depth * 8))) {
        if (ctx.fbm2(x * 0.2, y * 0.3) > 0.57) ctx.line(x, y, x + 3 + depth * 8, y, Ink.Wave0 + ((x + y) % 6))
      }
      const row = Math.floor(depth * 11)
      if (row % 2 === 0) {
        const center = w * (0.79 + (row % 3 - 1) * 0.012)
        const spread = 5 + depth * 54
        for (let part = 0; part < 3; part++) {
          const offset = (part - 1) * spread * 0.42 + ((row + part) % 2) * 3
          const length = 3 + depth * 13 - part * 1.5
          if ((row + part) % 3 !== 1) ctx.line(center + offset, y, center + offset + length, y, Ink.WaterLight)
        }
      }
    }
  })
}

const scene: SceneDef = {
  id: 'vn-halong',
  name: { en: 'Ha Long Bay', vi: 'Vịnh Hạ Long' },
  region: 'vn', tone: 'both', defaultTime: 'dawn',
  themePalettes: { light, dark }, themeDefaultTime: { light: 'dawn', dark: 'dusk' }, palettes: light,
  cycles: [{ indices: [Ink.Wave0, Ink.Wave1, Ink.Wave2, Ink.Wave3, Ink.Wave4, Ink.Wave5], rate: 6 }],
  horizon: 0.63, focus: { x: 0.73, y: 0.70 },
  build(ctx) {
    const { width: w, height: h } = ctx
    drawSky(ctx)
    ctx.layer({ kind: 'far', z: 1 }, () => {
      karst(ctx, 0.08, 0.34, 0.47, 0.63, Ink.FarMist, Ink.FarRock, Ink.FarRim, [0, .35, .86, .62, .30, 0])
      karst(ctx, 0.29, 0.58, 0.43, 0.63, Ink.FarMist, Ink.FarRock, Ink.FarRim, [0, .20, .48, 1, .72, .40, 0])
      karst(ctx, 0.54, 0.92, 0.45, 0.63, Ink.FarMist, Ink.FarRock, Ink.FarRim, [0, .42, .70, .45, .90, .58, .16, 0])
    })
    ctx.layer({ kind: 'fog', z: 2 }, () => {
      for (let x = 0; x < w; x += 4) if (ctx.fbm2(x * 0.05, 66) > 0.31) ctx.rect(x, h * 0.59 + (x % 11 > 6 ? 1 : 0), 9, 3, Ink.Fog)
    })
    ctx.layer({ kind: 'mid', z: 3 }, () => {
      karst(ctx, 0.38, 0.77, 0.35, 0.66, Ink.MidRock, Ink.MidFace, Ink.MidRim, [0, .18, .66, 1, .88, .54, .22, 0])
      karst(ctx, 0.82, 1.03, 0.30, 0.72, Ink.NearRock, Ink.NearFace, Ink.NearRim, [0, .30, .86, 1, .72, .25, 0])
      for (let y = h * 0.48; y < h * 0.66; y += 7) ctx.line(w * 0.84, y, w * 0.96, y + 2, Ink.Cave)
    })
    drawWater(ctx, Math.floor(h * 0.63))
    ctx.layer({ kind: 'near', z: 6 }, () => karst(ctx, -0.06, 0.22, 0.38, 1, Ink.NearRock, Ink.NearFace, Ink.NearRim, [0, .30, .78, 1, .76, .38, 0]))
  },
  frame(ctx, t) {
    const { width: w, height: h } = ctx
    const waterline = Math.floor(h * 0.63)
    const fogShift = Math.floor(t * 0.6) % 15
    ctx.layer({ kind: 'fog', z: 2 }, () => {
      for (let x = -fogShift; x < w; x += 21) if ((x + fogShift) % 42 !== 0) ctx.rect(x, h * 0.605, 12, 1, Ink.Fog)
    })
    const boatX = Math.floor(w * 0.73)
    const boatY = waterline + Math.floor(h * 0.135) + Math.round(Math.sin(t * Math.PI * 2 / 7))
    ctx.layer({ kind: 'fx', z: 5 }, () => {
      ctx.spriteFrame(boatSheet, Math.floor(t * 2), boatX, boatY, Math.max(1, Math.floor(w / 480)))
      for (let i = 0; i < 3; i++) ctx.line(boatX - 16 - i * 5, boatY + 3 + i, boatX - 9 - i * 4, boatY + 3 + i, Ink.Wake)
      const birdX = w * (0.32 + ((t * 0.015) % 0.36))
      for (let i = 0; i < 2; i++) {
        const y = h * (0.34 + i * 0.025) + Math.sin(t * 4 + i) * 2
        ctx.line(birdX + i * 12, y, birdX + 3 + i * 12, y - 2, Ink.Bird)
        ctx.line(birdX + 3 + i * 12, y - 2, birdX + 6 + i * 12, y, Ink.Bird)
      }
    })
  },
}

export default scene
