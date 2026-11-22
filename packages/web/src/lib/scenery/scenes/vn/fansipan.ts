/**
 * Phase 2 scene study: Fansipan ("Roof of Indochina") rises as a chiseled
 * granite arête capped by its stainless-steel pyramid monument and waving flag,
 * emerging from a two-tier billowing cumulus cloud sea.
 */
import { darkness, mixColor } from '../../engine/palette'
import { ParticlePool } from '../../engine/particles'
import { createSpriteSheet, parseSprite } from '../../engine/sprite'
import type { BuildCtx, FrameCtx, Mask, Palettes, SceneDef, Sprite, ThemePalettes } from '../../engine/types'

/**
 * Semantic 32-slot palette map shared across all themes and times of day:
 * 0..3   SkyTop, SkyUpper, SkyLower, SkyHorizon
 * 4..6   GlowOuter, GlowMid, Celestial
 * 7..8   StarDim, StarBright (blend with sky during day/dawn)
 * 9..10  FarDark, FarBody
 * 11..15 CloudAbyss, CloudShadow, CloudMid, CloudLight, CloudRim
 * 16..20 RockDeep, RockShadow, RockMid, RockLit, RockRim
 * 21..24 NearDark, NearBody, NearMoss, NearRim
 * 25..26 SteelDark, SteelLight
 * 27..30 FlagShadow, FlagBody, FlagHighlight, FlagStar
 * 31     BirdInk
 */
const Ink = {
  SkyTop: 0,
  SkyUpper: 1,
  SkyLower: 2,
  SkyHorizon: 3,
  GlowOuter: 4,
  GlowMid: 5,
  Celestial: 6,
  StarDim: 7,
  StarBright: 8,
  FarDark: 9,
  FarBody: 10,
  CloudAbyss: 11,
  CloudShadow: 12,
  CloudMid: 13,
  CloudLight: 14,
  CloudRim: 15,
  RockDeep: 16,
  RockShadow: 17,
  RockMid: 18,
  RockLit: 19,
  RockRim: 20,
  NearDark: 21,
  NearBody: 22,
  NearMoss: 23,
  NearRim: 24,
  SteelDark: 25,
  SteelLight: 26,
  FlagShadow: 27,
  FlagBody: 28,
  FlagHighlight: 29,
  FlagStar: 30,
  BirdInk: 31,
} as const

interface PaletteSpec {
  readonly sky: readonly [number, number, number, number]
  readonly glow: readonly [number, number, number]
  readonly stars: readonly [number, number]
  readonly far: readonly [number, number]
  readonly cloud: readonly [number, number, number, number, number]
  readonly rock: readonly [number, number, number, number, number]
  readonly near: readonly [number, number, number, number]
  readonly steel: readonly [number, number]
  readonly flag: readonly [number, number, number, number]
  readonly bird: number
}

const makePalette = (s: PaletteSpec): readonly number[] => [
  ...s.sky,
  ...s.glow,
  ...s.stars,
  ...s.far,
  ...s.cloud,
  ...s.rock,
  ...s.near,
  ...s.steel,
  ...s.flag,
  s.bird,
]

const light: Palettes = {
  dawn: makePalette({
    sky: [0x92b0cc, 0xb2c8de, 0xdec8bc, 0xf2c29d],
    glow: [0xe6d2c0, 0xf3dcc0, 0xffeacc],
    stars: [0x92b0cc, 0xb2c8de],
    far: [0x768fa4, 0x9ab0c0],
    cloud: [0x6b7e94, 0x899db1, 0xb9c8d4, 0xe4ecf0, 0xfde2c6],
    rock: [0x243240, 0x3b4e5e, 0x5c7280, 0x879aa4, 0xdccab6],
    near: [0x1d2d30, 0x324746, 0x516958, 0x9ca088],
    steel: [0x6d7f8d, 0xe0eaf2],
    flag: [0x8e241c, 0xc43428, 0xe85240, 0xf4d244],
    bird: 0x263544,
  }),
  day: makePalette({
    sky: [0x78aed2, 0x98c4de, 0xbad7e2, 0xdce6df],
    glow: [0xc4dce8, 0xdbeaf0, 0xfff5d8],
    stars: [0x78aed2, 0x98c4de],
    far: [0x6f93aa, 0x94b2c2],
    cloud: [0x728a9f, 0x94aab9, 0xc3d3dc, 0xeaf0f2, 0xffffff],
    rock: [0x283948, 0x415666, 0x647b89, 0x92a8b2, 0xdbe2de],
    near: [0x1e3332, 0x334d44, 0x537356, 0x97ad89],
    steel: [0x748896, 0xe8f0f5],
    flag: [0x94241e, 0xd03228, 0xf05242, 0xf8d846],
    bird: 0x233443,
  }),
  dusk: makePalette({
    sky: [0x46486e, 0x6d5876, 0xa86f74, 0xdf9e82],
    glow: [0xa67478, 0xc99082, 0xf7c598],
    stars: [0x6a6e94, 0xb8bdd6],
    far: [0x4c5870, 0x6a7288],
    cloud: [0x434d68, 0x616d88, 0x8d93aa, 0xc9b4b4, 0xf2c6aa],
    rock: [0x1d2838, 0x304054, 0x4e5c70, 0x867c82, 0xd9a892],
    near: [0x18262a, 0x293c3e, 0x445650, 0x8b7e76],
    steel: [0x596578, 0xcfd4de],
    flag: [0x7c2222, 0xb4322c, 0xda5244, 0xedc452],
    bird: 0x1b2334,
  }),
  night: makePalette({
    sky: [0x1b2944, 0x263a58, 0x364d6c, 0x4b6382],
    glow: [0x2d4262, 0x425b7e, 0xdce6f2],
    stars: [0x5e789e, 0xc2d8f0],
    far: [0x253952, 0x354b66],
    cloud: [0x21324a, 0x324662, 0x4c6380, 0x738ba6, 0xa5bcd0],
    rock: [0x142030, 0x213246, 0x364a62, 0x566c84, 0x94acc0],
    near: [0x111c24, 0x1d2e36, 0x2e4648, 0x5c747e],
    steel: [0x40546b, 0xaac2d6],
    flag: [0x5e2024, 0x862c30, 0xa84042, 0xd2b058],
    bird: 0x101928,
  }),
}

const dark: Palettes = {
  dawn: makePalette({
    sky: [0x1e2c46, 0x364662, 0x625a70, 0xa4746c],
    glow: [0x766270, 0x9e7774, 0xd8a688],
    stars: [0x4a5e80, 0x9cb0cc],
    far: [0x2c3c54, 0x445268],
    cloud: [0x233046, 0x384962, 0x5c6d84, 0x8c96a8, 0xc8a492],
    rock: [0x121c28, 0x202e3e, 0x374758, 0x5e6b78, 0xb09486],
    near: [0x0f1a1e, 0x1b2a2e, 0x2e403e, 0x6a6e6a],
    steel: [0x475666, 0xb0bac4],
    flag: [0x662020, 0x902c28, 0xb4443c, 0xd6b048],
    bird: 0x101824,
  }),
  day: makePalette({
    sky: [0x355068, 0x4a677d, 0x668092, 0x889ca8],
    glow: [0x627e90, 0x829ba8, 0xc6d4d8],
    stars: [0x355068, 0x4a677d],
    far: [0x344a5c, 0x4a6172],
    cloud: [0x2c3e50, 0x42576b, 0x63788b, 0x8b9ead, 0xb8c6ce],
    rock: [0x14212c, 0x223340, 0x384c5a, 0x5a6e7a, 0x9aa9b0],
    near: [0x101e20, 0x1e3032, 0x324844, 0x667c74],
    steel: [0x465866, 0xacbcca],
    flag: [0x682020, 0x962e28, 0xba463c, 0xdab648],
    bird: 0x121d28,
  }),
  dusk: makePalette({
    sky: [0x161d36, 0x2b2948, 0x52394e, 0x88525a],
    glow: [0x5e4054, 0x84525e, 0xc98b74],
    stars: [0x445278, 0x9fb0d4],
    far: [0x222c44, 0x373c54],
    cloud: [0x1a2238, 0x2a354e, 0x44506b, 0x6b7088, 0xaa837c],
    rock: [0x0f1624, 0x1b2638, 0x2f3b50, 0x52586c, 0x9e7c76],
    near: [0x0c141a, 0x17222a, 0x283438, 0x5e5e62],
    steel: [0x3c485a, 0xa2aebc],
    flag: [0x5a1c20, 0x84282c, 0xa83e3e, 0xd4a448],
    bird: 0x0b101c,
  }),
  night: makePalette({
    sky: [0x0a1322, 0x111f36, 0x1a2d47, 0x263d5a],
    glow: [0x182a44, 0x253d5e, 0xd0ddec],
    stars: [0x445e86, 0xc4d8f2],
    far: [0x142236, 0x20324a],
    cloud: [0x121c2c, 0x1c2b40, 0x2d4058, 0x49607a, 0x7e96ae],
    rock: [0x0b121c, 0x162230, 0x263748, 0x41566a, 0x7d94a8],
    near: [0x091116, 0x132026, 0x203034, 0x475c64],
    steel: [0x324456, 0x9eb4c8],
    flag: [0x4c181e, 0x702428, 0x923638, 0xd8ae4a],
    bird: 0x09101a,
  }),
}

const themePalettes: ThemePalettes = { light, dark }

// 18x15 stainless-steel summit pyramid monument on stepped granite plinth.
const monumentSprite = parseSprite([
  '........LD........',
  '.......LLD........',
  '.......LLDD.......',
  '......LLLDD.......',
  '......LLLDDD......',
  '.....LLLLDDD......',
  '.....LLLLDDDD.....',
  '....LLLLLDDDD.....',
  '....LLLLLDDDDD....',
  '...LLLLLLDDDDD....',
  '...LLLLLLDDDDDD...',
  '..GGGGGGGGGGGGGG..',
  '.SSGGGGGGGGGGGGGG.',
  'SSSSMMMMMMMMMMMMMM',
  'BBBBBBBBBBBBBBBBBB',
], {
  L: Ink.SteelLight,
  D: Ink.SteelDark,
  G: Ink.RockLit,
  M: Ink.RockMid,
  S: Ink.RockShadow,
  B: Ink.RockDeep,
})

// 4-pose waving national flag (10x6 per frame, 40x6 atlas) with coupled cloth shading & gold star.
const flagAtlas = parseSprite([
  'BBBBHSSSSSBBBBHHSSSSBBBHHHSSSSBBBBHHSSS.',
  'BBRYRHSSSSBBRYRRHSSSBBRRYRHSSSBBRYRRHSSS',
  'BYYYYHSSSSBYYYYRRSSSBYYYYRHSSSBYYYYRRSSS',
  'BBRYRHSSSSBBRYRRHSSSBBRRYRHSSSBBRYRRHSSS',
  'BBBBHSSSSSBBBBHHSSSSBBBHHHSSSSBBBBHHSSS.',
  '..........SS........SSS.......SS........',
], {
  B: Ink.FlagBody,
  H: Ink.FlagHighlight,
  S: Ink.FlagShadow,
  Y: Ink.FlagStar,
  R: Ink.FlagHighlight,
})

const flagSheet = createSpriteSheet(flagAtlas, [
  { x: 0, y: 0, width: 10, height: 6, pivot: { x: 0, y: 0 } },
  { x: 10, y: 0, width: 10, height: 6, pivot: { x: 0, y: 0 } },
  { x: 20, y: 0, width: 10, height: 6, pivot: { x: 0, y: 0 } },
  { x: 30, y: 0, width: 10, height: 6, pivot: { x: 0, y: 0 } },
])

// 8x5 4-pose flapping bird cycle (upstroke, level, downstroke, glide), 32x5 atlas.
const birdAtlas = parseSprite([
  '.k....k.........................',
  '..k..k...kk..kk...........kk..kk',
  '...kk......kk....kk..kk..k..kk..',
  '...................kk...........',
  '................................',
], { k: Ink.BirdInk })

const birdSheet = createSpriteSheet(birdAtlas, [
  { x: 0, y: 0, width: 8, height: 5, pivot: { x: 4, y: 2 } },
  { x: 8, y: 0, width: 8, height: 5, pivot: { x: 4, y: 2 } },
  { x: 16, y: 0, width: 8, height: 5, pivot: { x: 4, y: 2 } },
  { x: 24, y: 0, width: 8, height: 5, pivot: { x: 4, y: 2 } },
])

type Point = Readonly<{ x: number; y: number }>

interface CloudLobe {
  readonly cx: number
  readonly cy: number
  readonly rx: number
  readonly ry: number
}

interface CloudVariant {
  readonly sprite: Sprite
  readonly phase: number
}

interface Star {
  readonly x: number
  readonly y: number
  readonly hero: boolean
  readonly period: number
  readonly phase: number
}

interface FansipanCache {
  readonly skyMask: Mask
  readonly farCloudMask: Mask
  readonly nearSpurMask: Mask
  readonly farClouds: readonly CloudVariant[]
  readonly midClouds: readonly CloudVariant[]
  readonly nearBackClouds: readonly CloudVariant[]
  readonly nearFrontClouds: readonly CloudVariant[]
  readonly nearFloorClouds: readonly CloudVariant[]
  readonly mistPool: ParticlePool
  readonly stars: readonly Star[]
  readonly peakX: number
  readonly peakY: number
  readonly sunX: number
  readonly sunY: number
  readonly moonX: number
  readonly moonY: number
  readonly farCloudY: number
  readonly midCloudY: number
  readonly nearBackY: number
  readonly nearFrontY: number
  readonly nearFloorY: number
}

const cacheByBase = new WeakMap<Uint8Array, FansipanCache>()

function hash2d(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * Generates one volumetric cumulus puff bank sprite from overlapping rounded lobes
 * (wide curved belly + 5..6 asymmetric cumulus crowns), shaded for upper-right
 * sunlight with dark undersides, crisp stepped body, narrow seam dither, and top-only rim.
 */
function buildCloudBankSprite(
  width: number,
  height: number,
  rng: () => number,
  deepBellies: boolean,
  ditherFn: BuildCtx['dither'],
): Sprite {
  const pixels = new Int8Array(width * height).fill(-1)
  const peakShift = (rng() - 0.5) * 0.14
  const lobes: CloudLobe[] = [
    // Tall central cumulus dome rising above the flanking shoulders
    { cx: width * (0.50 + peakShift), cy: height * 0.40, rx: width * 0.25, ry: height * 0.37 },
    { cx: width * (0.31 + peakShift * 0.5), cy: height * (0.54 + (rng() - 0.5) * 0.06), rx: width * 0.19, ry: height * 0.28 },
    { cx: width * (0.69 + peakShift * 0.5), cy: height * (0.52 + (rng() - 0.5) * 0.06), rx: width * 0.19, ry: height * 0.28 },
    // Tapered outer puffs and curved lower belly
    { cx: width * 0.16, cy: height * 0.68, rx: width * 0.14, ry: height * 0.20 },
    { cx: width * 0.84, cy: height * 0.68, rx: width * 0.14, ry: height * 0.20 },
    { cx: width * 0.50, cy: height * 0.70, rx: width * 0.36, ry: height * 0.27 },
  ]
  // Add 3 small cauliflower sub-lobes along the upper crest
  for (let i = 0; i < 3; i++) {
    const cx = width * (0.28 + i * 0.22 + (rng() - 0.5) * 0.08)
    const cy = height * (0.26 + Math.abs(i - 1) * 0.10 + rng() * 0.08)
    lobes.push({ cx, cy, rx: width * (0.10 + rng() * 0.06), ry: height * (0.17 + rng() * 0.08) })
  }

  const solid = new Uint8Array(width * height)
  const lightField = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let bestScore = -1
      let bestLobe: CloudLobe | undefined
      for (const lobe of lobes) {
        const dx = (x - lobe.cx) / lobe.rx
        const dy = (y - lobe.cy) / lobe.ry
        const d2 = dx * dx + dy * dy
        if (d2 <= 1) {
          const score = 1 - d2
          if (score > bestScore) {
            bestScore = score
            bestLobe = lobe
          }
        }
      }
      if (bestLobe) {
        const idx = y * width + x
        solid[idx] = 1
        const nx = (x - bestLobe.cx) / bestLobe.rx
        const ny = (y - bestLobe.cy) / bestLobe.ry
        lightField[idx] = nx * 0.42 - ny * 0.90
      }
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (!solid[i]) continue

      const aboveEmpty = y === 0 || !solid[(y - 1) * width + x]
      const above2Empty = y <= 1 || !solid[(y - 2) * width + x]
      const bottomRatio = y / height
      const l = lightField[i]!

      // Top-facing crown rim only (side overlaps merge seamlessly into neighbors)
      if (aboveEmpty && l > -0.10 && bottomRatio < 0.60) {
        pixels[i] = Ink.CloudRim
        continue
      }
      if (above2Empty && l > 0.05 && bottomRatio < 0.56) {
        pixels[i] = Ink.CloudLight
        continue
      }

      // Belly underside shadow strictly in lower portion
      if (bottomRatio > 0.80 || (bottomRatio > 0.68 && l < -0.45)) {
        pixels[i] = deepBellies ? Ink.CloudAbyss : Ink.CloudShadow
        continue
      }
      if (bottomRatio > 0.68 || l < -0.25) {
        const seam = Math.max(0, Math.min(1, (l + 0.34) / 0.18))
        const darkIdx = deepBellies && bottomRatio > 0.74 ? Ink.CloudAbyss : Ink.CloudShadow
        pixels[i] = ditherFn(x, y, seam, darkIdx, deepBellies ? Ink.CloudShadow : Ink.CloudMid, 4)
        continue
      }

      // Upper lit dome vs mid cloud body (narrow 2px dithered seam only)
      if (l > 0.18) {
        pixels[i] = Ink.CloudLight
      } else if (l > 0.02) {
        const seam = (l - 0.02) / 0.16
        pixels[i] = ditherFn(x, y, seam, Ink.CloudMid, Ink.CloudLight, 4)
      } else {
        pixels[i] = Ink.CloudMid
      }
    }
  }

  return { width, height, pixels }
}

function stampMaskedSprite(
  buffer: Uint8Array,
  w: number,
  h: number,
  sprite: Sprite,
  dx: number,
  dy: number,
  occludeMask?: Mask,
): void {
  const ix = Math.round(dx)
  const iy = Math.round(dy)
  const x0 = Math.max(0, ix)
  const y0 = Math.max(0, iy)
  const x1 = Math.min(w, ix + sprite.width)
  const y1 = Math.min(h, iy + sprite.height)
  const cov = occludeMask?.coverage
  for (let y = y0; y < y1; y++) {
    const sy = y - iy
    const rowOff = y * w
    const sRowOff = sy * sprite.width
    for (let x = x0; x < x1; x++) {
      if (cov && cov[rowOff + x] !== 0) continue
      const idx = sprite.pixels[sRowOff + (x - ix)]!
      if (idx >= 0) buffer[rowOff + x] = idx
    }
  }
}

function paintSky(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx
  // 4 clean sky bands with <=6px 4x4 Bayer seams (no full-sky checkerboard).
  const stops = [
    Math.round(h * 0.18),
    Math.round(h * 0.32),
    Math.round(h * 0.46),
  ]
  const seamHalf = 2
  for (let y = 0; y < h; y++) {
    const seamIdx = stops.findIndex((sy) => Math.abs(y - sy) <= seamHalf)
    if (seamIdx >= 0) {
      const sy = stops[seamIdx]!
      const amt = (y - (sy - seamHalf)) / (seamHalf * 2 + 1)
      for (let x = 0; x < w; x++) {
        ctx.px(x, y, ctx.dither(x, y, amt, seamIdx, seamIdx + 1, 4))
      }
    } else {
      const band = y < stops[0]! ? 0 : y < stops[1]! ? 1 : y < stops[2]! ? 2 : 3
      ctx.rect(0, y, w, 1, band)
    }
  }
}

function paintFarRidges(ctx: BuildCtx, skyMask: Mask): void {
  const { width: w, height: h } = ctx
  const p = (u: number, v: number): Point => ({ x: Math.round(w * u), y: Math.round(h * v) })
  const far1: Point[] = [
    p(-0.02, 0.52), p(0.06, 0.44), p(0.14, 0.47), p(0.22, 0.39),
    p(0.32, 0.45), p(0.41, 0.38), p(0.50, 0.44), p(0.59, 0.41),
    p(0.68, 0.46), p(0.84, 0.43), p(0.95, 0.39), p(1.02, 0.45),
    p(1.02, 0.68), p(-0.02, 0.68),
  ]
  const far2: Point[] = [
    p(-0.02, 0.56), p(0.08, 0.50), p(0.18, 0.53), p(0.28, 0.46),
    p(0.37, 0.51), p(0.47, 0.45), p(0.56, 0.52), p(0.65, 0.48),
    p(0.88, 0.49), p(0.96, 0.46), p(1.02, 0.50), p(1.02, 0.72), p(-0.02, 0.72),
  ]

  ctx.layer({ kind: 'far', z: 1 }, (layer) => {
    layer.polygon(far1, Ink.FarBody)
    layer.polygon(far2, Ink.FarDark)
    // Solid misty cloud-basin floor beneath far ridges so no sky leaks between cloud puffs.
    layer.rect(0, Math.round(h * 0.56), w, Math.ceil(h * 0.44), Ink.CloudAbyss)
  })

  for (let y = 0; y < Math.round(h * 0.68); y++) {
    for (let x = 0; x < w; x++) {
      const v = ctx.base[y * w + x]!
      if (v === Ink.FarBody || v === Ink.FarDark || v === Ink.CloudAbyss) skyMask.set(x, y, 0)
    }
  }
}

function paintFansipanSummit(
  ctx: BuildCtx,
  peakX: number,
  peakY: number,
  skyMask: Mask,
  farCloudMask: Mask,
): void {
  const { width: w, height: h, seed } = ctx
  // Keep summit massif ~134x100 on 480x270, preserving proud pyramidal proportions on 240x300 too.
  const halfSpan = w < h ? Math.round(w * 0.34) : Math.round(w * 0.165)
  const heightSpan = Math.round(h * 0.55)

  const pt = (dxNorm: number, dyNorm: number): Point => ({
    x: Math.round(peakX + dxNorm * halfSpan),
    y: Math.round(peakY + dyNorm * heightSpan),
  })

  // Rugged granite arête silhouette with summit plinth, stepped west shoulder, and east crag spur.
  const outline: Point[] = [
    pt(-0.08, 0.00),
    pt(0.08, 0.00),
    pt(0.18, 0.08),
    pt(0.24, 0.16),
    pt(0.32, 0.14),
    pt(0.39, 0.19),
    pt(0.45, 0.27),
    pt(0.56, 0.32),
    pt(0.66, 0.44),
    pt(0.79, 0.53),
    pt(0.92, 0.70),
    pt(1.08, 0.96),
    pt(-1.18, 0.96),
    pt(-0.98, 0.73),
    pt(-0.80, 0.55),
    pt(-0.64, 0.38),
    pt(-0.52, 0.41),
    pt(-0.40, 0.24),
    pt(-0.29, 0.21),
    pt(-0.18, 0.09),
  ]

  // Crooked central arête ridge spine dividing sunlit east face from shaded west face.
  const ridgeSpine: Point[] = [
    pt(-0.02, 0.01),
    pt(-0.07, 0.14),
    pt(0.03, 0.27),
    pt(-0.05, 0.42),
    pt(0.05, 0.58),
    pt(-0.03, 0.76),
    pt(0.04, 0.96),
  ]

  const eastFace: Point[] = [
    ...ridgeSpine,
    pt(1.08, 0.96),
    pt(0.92, 0.70),
    pt(0.79, 0.53),
    pt(0.66, 0.44),
    pt(0.56, 0.32),
    pt(0.45, 0.27),
    pt(0.39, 0.19),
    pt(0.32, 0.14),
    pt(0.24, 0.16),
    pt(0.18, 0.08),
    pt(0.08, 0.00),
    pt(-0.02, 0.01),
  ]

  // Sculpted secondary granite facets & couloir clefts (volume without pen strokes).
  const westSpurLit: Point[] = [
    pt(-0.40, 0.24),
    pt(-0.29, 0.21),
    pt(-0.23, 0.38),
    pt(-0.33, 0.55),
    pt(-0.45, 0.49),
    pt(-0.52, 0.41),
  ]
  const westLowerLit: Point[] = [
    pt(-0.64, 0.38),
    pt(-0.55, 0.44),
    pt(-0.58, 0.62),
    pt(-0.74, 0.72),
    pt(-0.80, 0.55),
  ]
  const westCouloir: Point[] = [
    pt(-0.18, 0.09),
    pt(-0.07, 0.14),
    pt(-0.10, 0.36),
    pt(-0.23, 0.38),
    pt(-0.29, 0.21),
  ]
  const centralGully: Point[] = [
    pt(0.03, 0.27),
    pt(0.12, 0.42),
    pt(0.24, 0.62),
    pt(0.11, 0.72),
    pt(0.05, 0.58),
    pt(-0.05, 0.42),
  ]
  const eastCragShadow: Point[] = [
    pt(0.32, 0.14),
    pt(0.26, 0.31),
    pt(0.39, 0.44),
    pt(0.45, 0.27),
    pt(0.39, 0.19),
  ]
  const eastLowerRidge: Point[] = [
    pt(0.49, 0.48),
    pt(0.62, 0.42),
    pt(0.76, 0.62),
    pt(0.60, 0.72),
  ]

  const rockMask = ctx.mask()
  ctx.layer({ kind: 'mid', z: 3 }, (layer) => {
    layer.polygon(outline, Ink.RockShadow)
    layer.polygon(eastFace, Ink.RockLit)
    layer.polygon(westSpurLit, Ink.RockMid)
    layer.polygon(westLowerLit, Ink.RockMid)
    layer.polygon(westCouloir, Ink.RockDeep)
    layer.polygon(centralGully, Ink.RockMid)
    layer.polygon(eastCragShadow, Ink.RockShadow)
    layer.polygon(eastLowerRidge, Ink.RockMid)
  })

  const yStart = Math.max(0, peakY - 2)
  const yEnd = Math.min(h, peakY + heightSpan + 2)
  for (let y = yStart; y < yEnd; y++) {
    for (let x = 0; x < w; x++) {
      const idx = ctx.base[y * w + x]!
      if (idx >= Ink.RockDeep && idx <= Ink.RockRim) {
        rockMask.set(x, y, 15)
        skyMask.set(x, y, 0)
        farCloudMask.set(x, y, 15)
      }
    }
  }

  // Cohesive 1-step granite strata texture across all mountain facets (no noisy dark speckle patch).
  ctx.layer({ kind: 'mid', z: 3, mask: rockMask }, (layer) => {
    for (let y = yStart; y < yEnd; y++) {
      for (let x = 0; x < w; x++) {
        if (!rockMask.contains(x, y)) continue
        const cur = ctx.base[y * w + x]!
        const strata = ctx.fbm2(x * 0.14 + y * 0.06, y * 0.24)
        const hVal = hash2d(x, y, seed)
        if (cur === Ink.RockLit && strata < 0.40 && hVal < 0.28) {
          layer.px(x, y, Ink.RockMid)
        } else if (cur === Ink.RockShadow && strata > 0.60 && hVal < 0.30) {
          layer.px(x, y, Ink.RockDeep)
        } else if (cur === Ink.RockMid && strata < 0.40 && hVal < 0.20) {
          layer.px(x, y, Ink.RockShadow)
        }
      }
    }

    // Broken 1px alpenglow / frost rim along sun-facing crests & upper arête facets
    for (let y = yStart; y < yEnd; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (!rockMask.contains(x, y)) continue
        const cur = ctx.base[y * w + x]!
        if (cur !== Ink.RockLit) continue
        const skyAbove = !rockMask.contains(x, y - 1) || !rockMask.contains(x + 1, y - 1)
        const arêteEdge = ctx.base[y * w + x - 1] === Ink.RockShadow || ctx.base[y * w + x - 1] === Ink.RockDeep
        const rimGate = hash2d(x >> 1, y >> 1, seed + 31) > 0.22
        if ((skyAbove || (arêteEdge && y < peakY + heightSpan * 0.64)) && rimGate) {
          layer.px(x, y, Ink.RockRim)
        }
      }
    }
  })

  // Anchor the 18x15 stainless-steel summit pyramid monument onto the rocky summit plinth.
  const monX = Math.round(peakX - 9)
  const monY = Math.round(peakY - 12)
  ctx.sprite(monumentSprite, monX, monY)
  for (let sy = 0; sy < monumentSprite.height; sy++) {
    for (let sx = 0; sx < monumentSprite.width; sx++) {
      if (monumentSprite.pixels[sy * monumentSprite.width + sx]! >= 0) {
        skyMask.set(monX + sx, monY + sy, 0)
        farCloudMask.set(monX + sx, monY + sy, 15)
      }
    }
  }

  // Static flagpole right beside the pyramid monument (animated flag attaches to pole top in frame()).
  const poleX = monX + 16
  const poleTopY = monY - 3
  const poleBotY = monY + 11
  ctx.line(poleX, poleTopY, poleX, poleBotY, Ink.SteelDark)
  ctx.px(poleX, poleTopY - 1, Ink.FlagStar)
  skyMask.set(poleX, poleTopY - 1, 0)
  farCloudMask.set(poleX, poleTopY - 1, 15)
  for (let py = poleTopY; py <= poleBotY; py++) {
    skyMask.set(poleX, py, 0)
    farCloudMask.set(poleX, py, 15)
  }
}

function paintNearLeftSpur(ctx: BuildCtx, nearSpurMask: Mask, skyMask: Mask, farCloudMask: Mask): void {
  const { width: w, height: h, seed } = ctx
  const p = (u: number, v: number): Point => ({ x: Math.round(w * u), y: Math.round(h * v) })

  // Craggy stepped granite ridge outcrop framing the lower-left foreground.
  const spurOutline: Point[] = [
    p(-0.02, 0.56),
    p(0.03, 0.59),
    p(0.05, 0.64),
    p(0.09, 0.65),
    p(0.12, 0.72),
    p(0.16, 0.74),
    p(0.18, 0.82),
    p(0.22, 0.86),
    p(0.25, 0.94),
    p(0.29, 1.02),
    p(-0.02, 1.02),
  ]
  const litRidge: Point[] = [
    p(0.02, 0.59),
    p(0.05, 0.64),
    p(0.09, 0.65),
    p(0.12, 0.72),
    p(0.16, 0.74),
    p(0.18, 0.82),
    p(0.22, 0.86),
    p(0.25, 0.94),
    p(0.29, 1.02),
    p(0.17, 1.02),
    p(0.12, 0.88),
    p(0.06, 0.77),
    p(0.01, 0.68),
  ]

  ctx.layer({ kind: 'near', z: 5 }, (layer) => {
    layer.polygon(spurOutline, Ink.NearBody)
    layer.polygon(litRidge, Ink.NearMoss)

    // Three asymmetric multi-lobe alpine shrub clusters nested into ridge ledges.
    const clusters: readonly (readonly [number, number, number, number])[] = [
      [0.015, 0.57, 9, 6],
      [0.032, 0.59, 6, 4],
      [0.095, 0.67, 10, 7],
      [0.118, 0.70, 7, 5],
      [0.195, 0.85, 11, 7],
      [0.220, 0.89, 8, 5],
    ]
    for (const [su, sv, rx, ry] of clusters) {
      const cx = Math.round(w * su)
      const cy = Math.round(h * sv)
      for (let dy = -ry; dy <= ry; dy++) {
        for (let dx = -rx; dx <= rx; dx++) {
          const jitter = hash2d(cx + dx, cy + dy, seed + 13) * 0.42
          if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 0.72 + jitter) {
            const ink = dy > 2 ? Ink.NearDark : dx - dy > rx * 0.35 ? Ink.NearRim : Ink.NearMoss
            layer.px(cx + dx, cy + dy, ink)
          }
        }
      }
    }
  })

  for (let y = Math.round(h * 0.50); y < h; y++) {
    for (let x = 0; x < Math.round(w * 0.33); x++) {
      const idx = ctx.base[y * w + x]!
      if (idx >= Ink.NearDark && idx <= Ink.NearRim) {
        nearSpurMask.set(x, y, 15)
        skyMask.set(x, y, 0)
        farCloudMask.set(x, y, 15)
      }
    }
  }

  ctx.layer({ kind: 'near', z: 5, mask: nearSpurMask }, (layer) => {
    // Granite & moss cluster texture inside the foreground outcrop
    for (let y = Math.round(h * 0.54); y < h; y++) {
      for (let x = 0; x < Math.round(w * 0.32); x++) {
        if (!nearSpurMask.contains(x, y)) continue
        const cur = ctx.base[y * w + x]!
        const n = ctx.fbm2(x * 0.22, y * 0.18)
        const hVal = hash2d(x, y, seed + 7)
        if (cur === Ink.NearBody && n < 0.44 && hVal < 0.36) {
          layer.px(x, y, Ink.NearDark)
        } else if (cur === Ink.NearMoss && n > 0.62 && hVal < 0.28) {
          layer.px(x, y, Ink.NearBody)
        }
      }
    }

    // Broken 1px sunlit right rim along rock steps & shrubs
    for (let y = Math.round(h * 0.52); y < h; y++) {
      for (let x = 1; x < Math.round(w * 0.32); x++) {
        if (nearSpurMask.contains(x, y) && !nearSpurMask.contains(x + 1, y) && hash2d(x, y, seed + 23) > 0.25) {
          layer.px(x, y, Ink.NearRim)
        }
      }
    }
  })
}

function drawSteppedCelestial(
  ctx: FrameCtx,
  skyMask: Mask,
  cx: number,
  cy: number,
  r: number,
  isNight: boolean,
): void {
  const { width: w, height: h, frame } = ctx
  const cov = skyMask.coverage
  const rOuter = Math.round(r * (isNight ? 2.1 : 2.5))
  const rMid = Math.round(r * (isNight ? 1.5 : 1.7))

  const drawMaskedDisc = (x0: number, y0: number, rad: number, ink: number): void => {
    const r2 = rad * rad
    const minY = Math.max(0, Math.floor(y0 - rad))
    const maxY = Math.min(h - 1, Math.ceil(y0 + rad))
    const minX = Math.max(0, Math.floor(x0 - rad))
    const maxX = Math.min(w - 1, Math.ceil(x0 + rad))
    for (let y = minY; y <= maxY; y++) {
      const dy = y - y0
      const rowOff = y * w
      for (let x = minX; x <= maxX; x++) {
        const dx = x - x0
        if (dx * dx + dy * dy <= r2 && cov[rowOff + x] !== 0) {
          frame[rowOff + x] = ink
        }
      }
    }
  }

  drawMaskedDisc(cx, cy, rOuter, Ink.GlowOuter)
  drawMaskedDisc(cx, cy, rMid, Ink.GlowMid)
  drawMaskedDisc(cx, cy, r, Ink.Celestial)

  if (isNight) {
    const biteX = cx - Math.round(r * 0.45)
    const biteY = cy - Math.round(r * 0.22)
    const biteR2 = (r * 0.85) ** 2
    for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) {
        const rowOff = y * w
        if (cov[rowOff + x] === 0) continue
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && (x - biteX) ** 2 + (y - biteY) ** 2 <= biteR2) {
          frame[rowOff + x] = Ink.GlowMid
        }
      }
    }
  }
}

function renderCloudTier(
  ctx: FrameCtx,
  variants: readonly CloudVariant[],
  baseY: number,
  driftPx: number,
  stepX: number,
  occludeMask?: Mask,
): void {
  const { width: w, height: h, frame } = ctx
  const totalSpan = variants.length * stepX
  const wrapped = ((driftPx % totalSpan) + totalSpan) % totalSpan
  const startCount = Math.ceil(w / totalSpan) + 2

  for (let rep = -1; rep < startCount; rep++) {
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i]!
      const x = rep * totalSpan + i * stepX + wrapped - stepX * 0.65
      if (x + variant.sprite.width < 0 || x >= w) continue
      const y = baseY + variant.phase
      stampMaskedSprite(frame, w, h, variant.sprite, x, y, occludeMask)
    }
  }
}

const scene: SceneDef = {
  id: 'vn-fansipan',
  name: { vi: 'Fansipan biển mây', en: 'Fansipan Cloud Sea' },
  region: 'vn',
  tone: 'both',
  palettes: light,
  themePalettes,
  defaultTime: 'dawn',
  themeDefaultTime: { light: 'dawn', dark: 'night' },
  horizon: 0.56,
  focus: { x: 0.77, y: 0.34 },
  build(ctx) {
    const { width: w, height: h, rng } = ctx
    const skyMask = ctx.mask()
    skyMask.rect(0, 0, w, h)
    const farCloudMask = ctx.mask()
    const nearSpurMask = ctx.mask()

    paintSky(ctx)
    paintFarRidges(ctx, skyMask)

    const peakX = Math.round(w * (w < h ? 0.66 : 0.79))
    const peakY = Math.round(h * 0.175)
    paintFansipanSummit(ctx, peakX, peakY, skyMask, farCloudMask)
    paintNearLeftSpur(ctx, nearSpurMask, skyMask, farCloudMask)

    // Pre-bake 5-variant staggered cauliflower cumulus clusters across far, mid, and 3 near rows
    // with wider height/width variation so the cloud sea rolls organically down to the bottom edge.
    const farClouds: CloudVariant[] = [
      { sprite: buildCloudBankSprite(74, 30, rng, false, ctx.dither), phase: -5 },
      { sprite: buildCloudBankSprite(96, 36, rng, false, ctx.dither), phase: 2 },
      { sprite: buildCloudBankSprite(68, 28, rng, false, ctx.dither), phase: -7 },
      { sprite: buildCloudBankSprite(92, 34, rng, false, ctx.dither), phase: 4 },
      { sprite: buildCloudBankSprite(82, 32, rng, false, ctx.dither), phase: -3 },
    ]
    const midClouds: CloudVariant[] = [
      { sprite: buildCloudBankSprite(88, 38, rng, false, ctx.dither), phase: 4 },
      { sprite: buildCloudBankSprite(112, 44, rng, false, ctx.dither), phase: -7 },
      { sprite: buildCloudBankSprite(80, 35, rng, false, ctx.dither), phase: 6 },
      { sprite: buildCloudBankSprite(104, 42, rng, false, ctx.dither), phase: -4 },
      { sprite: buildCloudBankSprite(94, 38, rng, false, ctx.dither), phase: 1 },
    ]
    const nearBackClouds: CloudVariant[] = [
      { sprite: buildCloudBankSprite(98, 46, rng, true, ctx.dither), phase: -8 },
      { sprite: buildCloudBankSprite(126, 54, rng, true, ctx.dither), phase: 5 },
      { sprite: buildCloudBankSprite(92, 44, rng, true, ctx.dither), phase: -5 },
      { sprite: buildCloudBankSprite(118, 50, rng, true, ctx.dither), phase: 6 },
      { sprite: buildCloudBankSprite(108, 46, rng, true, ctx.dither), phase: -2 },
    ]
    const nearFrontClouds: CloudVariant[] = [
      { sprite: buildCloudBankSprite(114, 58, rng, true, ctx.dither), phase: -7 },
      { sprite: buildCloudBankSprite(142, 66, rng, true, ctx.dither), phase: 5 },
      { sprite: buildCloudBankSprite(106, 54, rng, true, ctx.dither), phase: -9 },
      { sprite: buildCloudBankSprite(134, 62, rng, true, ctx.dither), phase: 4 },
      { sprite: buildCloudBankSprite(122, 58, rng, true, ctx.dither), phase: -3 },
    ]
    const nearFloorClouds: CloudVariant[] = [
      { sprite: buildCloudBankSprite(130, 68, rng, true, ctx.dither), phase: -6 },
      { sprite: buildCloudBankSprite(152, 74, rng, true, ctx.dither), phase: 4 },
      { sprite: buildCloudBankSprite(120, 64, rng, true, ctx.dither), phase: -8 },
      { sprite: buildCloudBankSprite(144, 70, rng, true, ctx.dither), phase: 3 },
      { sprite: buildCloudBankSprite(132, 66, rng, true, ctx.dither), phase: -3 },
    ]

    const stars: Star[] = []
    for (let i = 0; i < 28; i++) {
      const sx = Math.floor(rng() * w)
      const sy = Math.floor(rng() * h * 0.38)
      if (!skyMask.contains(sx, sy)) continue
      stars.push({
        x: sx,
        y: sy,
        hero: i % 4 === 0,
        period: 3.2 + (i % 3) * 1.4,
        phase: rng() * Math.PI * 2,
      })
    }

    const mistPool = new ParticlePool(24, ctx.seed + 19)
    const spawnMist = (randomX: boolean): void => {
      mistPool.spawn({
        x: randomX ? rng() * w : -8,
        y: h * (0.59 + rng() * 0.25),
        vx: 0.9 + rng() * 1.1,
        vy: (rng() - 0.5) * 0.10,
        life: 8 + rng() * 6,
        index: rng() > 0.45 ? Ink.CloudLight : Ink.CloudRim,
      })
    }
    for (let i = 0; i < 14; i++) spawnMist(true)
    for (let step = 0; step < 60; step++) mistPool.advance(0.1)

    cacheByBase.set(ctx.base, {
      skyMask,
      farCloudMask,
      nearSpurMask,
      farClouds,
      midClouds,
      nearBackClouds,
      nearFrontClouds,
      nearFloorClouds,
      mistPool,
      stars,
      peakX,
      peakY,
      sunX: Math.round(w * (w < h ? 0.89 : 0.925)),
      sunY: Math.round(h * 0.27),
      moonX: Math.round(w * (w < h ? 0.87 : 0.91)),
      moonY: Math.round(h * 0.19),
      farCloudY: Math.round(h * 0.49),
      midCloudY: Math.round(h * 0.56),
      nearBackY: Math.round(h * 0.64),
      nearFrontY: Math.round(h * 0.74),
      nearFloorY: Math.round(h * 0.85),
    })
  },
  frame(ctx, t, dt) {
    const cache = cacheByBase.get(ctx.base)
    if (!cache) return
    const { width: w, height: h, frame, rng } = ctx
    const nightAmt = darkness(ctx.time)
    const isNight = nightAmt >= 0.68

    if (isNight) {
      for (const star of cache.stars) {
        if (!cache.skyMask.contains(star.x, star.y)) continue
        const tw = star.hero ? Math.sin((t * Math.PI * 2) / star.period + star.phase) : 0
        if (star.hero && tw > 0.78) {
          frame[star.y * w + star.x] = Ink.StarBright
          if (star.x > 0 && cache.skyMask.contains(star.x - 1, star.y)) frame[star.y * w + star.x - 1] = Ink.StarDim
          if (star.x + 1 < w && cache.skyMask.contains(star.x + 1, star.y)) frame[star.y * w + star.x + 1] = Ink.StarDim
          if (star.y > 0 && cache.skyMask.contains(star.x, star.y - 1)) frame[(star.y - 1) * w + star.x] = Ink.StarDim
          if (star.y + 1 < h && cache.skyMask.contains(star.x, star.y + 1)) frame[(star.y + 1) * w + star.x] = Ink.StarDim
        } else {
          frame[star.y * w + star.x] = tw > 0.2 ? Ink.StarBright : Ink.StarDim
        }
      }
      drawSteppedCelestial(ctx, cache.skyMask, cache.moonX, cache.moonY, Math.max(5, Math.round(Math.min(w, h) * 0.026)), true)
    } else {
      drawSteppedCelestial(ctx, cache.skyMask, cache.sunX, cache.sunY, Math.max(6, Math.round(Math.min(w, h) * 0.034)), false)
    }

    // Far-tier billowing cloud sea (behind Fansipan summit & behind near spur).
    renderCloudTier(ctx, cache.farClouds, cache.farCloudY, t * 0.16, 56, cache.farCloudMask)
    renderCloudTier(ctx, cache.midClouds, cache.midCloudY, t * 0.22 + 28, 66, cache.farCloudMask)

    // Animated 4-pose national flag on the summit flagpole (3 fps).
    const poleX = cache.peakX - 9 + 17
    const poleTopY = cache.peakY - 15
    ctx.spriteFrame(flagSheet, Math.floor(t * 3), poleX, poleTopY)

    // Near-tier 3-row overlapping cumulus billows reaching the bottom edge (occluded by near left spur).
    renderCloudTier(ctx, cache.nearBackClouds, cache.nearBackY, t * 0.26, 72, cache.nearSpurMask)
    renderCloudTier(ctx, cache.nearFrontClouds, cache.nearFrontY, t * 0.34 + 34, 80, cache.nearSpurMask)
    renderCloudTier(ctx, cache.nearFloorClouds, cache.nearFloorY, t * 0.40 + 16, 86, cache.nearSpurMask)

    // Soft 4px horizontal mist wisps drifting strictly across cloud surfaces.
    cache.mistPool.advance(dt)
    for (const p of cache.mistPool.particles) {
      if (!p.active) {
        if (cache.mistPool.chance(0.25)) {
          cache.mistPool.spawn({
            x: -8,
            y: h * (0.60 + rng() * 0.25),
            vx: 0.9 + rng() * 1.1,
            vy: (rng() - 0.5) * 0.10,
            life: 8 + rng() * 6,
            index: rng() > 0.45 ? Ink.CloudLight : Ink.CloudRim,
          })
        }
        continue
      }
      const px = Math.round(p.x)
      const py = Math.round(p.y)
      if (px >= 1 && px < w - 4 && py >= 0 && py < h && !cache.nearSpurMask.contains(px, py)) {
        const under = frame[py * w + px]!
        if (under >= Ink.CloudAbyss && under <= Ink.CloudRim) {
          frame[py * w + px] = Ink.CloudMid
          frame[py * w + px + 1] = p.index
          frame[py * w + px + 2] = p.index
          frame[py * w + px + 3] = Ink.CloudMid
        }
      }
    }

    // High-altitude flapping mountain birds in open sky gutters (clear of /new card & monument).
    if (!isNight) {
      const bird1X = Math.round(((t * 2.4 + w * 0.12) % (w + 40)) - 20)
      const bird1Y = Math.round(h * 0.28 + Math.sin(t * 0.9) * 3)
      if (bird1X < w * 0.26 || bird1X > w * 0.74) {
        ctx.spriteFrame(birdSheet, Math.floor(t * 6), bird1X, bird1Y)
      }
      const bird1bX = Math.round(((t * 2.4 + w * 0.085) % (w + 40)) - 20)
      const bird1bY = Math.round(h * 0.25 + Math.sin(t * 0.9 + 1.1) * 3)
      if (bird1bX < w * 0.26 || bird1bX > w * 0.74) {
        ctx.spriteFrame(birdSheet, Math.floor(t * 6 + 1), bird1bX, bird1bY)
      }
      const bird2X = Math.round(((t * 1.9 + w * 0.93) % (w + 60)) - 30)
      const bird2Y = Math.round(h * 0.11 + Math.cos(t * 0.7) * 2)
      if (bird2X < w * 0.25 || bird2X > w * 0.84) {
        ctx.spriteFrame(birdSheet, Math.floor(t * 6 + 2), bird2X, bird2Y)
      }
    }
  },
}

export default scene
