/**
 * Hand-drawn V2 reference: dawn and dusk over Ha Long Bay.
 * Faceted limestone karst spires with geological cliff planes, vertical rock
 * strata, geometric tidal undercuts, and clinging foliage; clean 4-band sky
 * with soft 3-stage solar glow; feathered valley sea mist; 6-phase shimmering
 * water with tapered sun-path glints; and a 42×32 fan-sail junk hero.
 */
import { createSpriteSheet, parseSprite } from '../../engine/sprite'
import type { BuildCtx, Mask, Palettes, SceneDef, Sprite } from '../../engine/types'

const enum Ink {
  SkyTop = 0,
  SkyUpper = 1,
  SkyLower = 2,
  SkyHorizon = 3,
  Sun = 4,
  GlowInner = 5,
  GlowOuter = 6,
  CloudShadow = 7,
  CloudBody = 8,
  CloudRim = 9,
  FarShadow = 10,
  FarBody = 11,
  MidShadow = 12,
  MidBody = 13,
  MidRim = 14,
  Foliage = 15,
  NearCrevice = 16,
  NearShadow = 17,
  NearBody = 18,
  NearRim = 19,
  WaterDeep = 20,
  WaterMid = 21,
  Wave0 = 22,
  Wave1 = 23,
  Wave2 = 24,
  Wave3 = 25,
  Wave4 = 26,
  Wave5 = 27,
  SailShadow = 28,
  Sail = 29,
  Hull = 30,
  Lantern = 31,
}

const makePalette = (
  sky: readonly [number, number, number, number],
  sun: readonly [number, number, number],
  cloud: readonly [number, number, number],
  far: readonly [number, number],
  mid: readonly [number, number, number, number],
  near: readonly [number, number, number, number],
  water: readonly [number, number],
  waves: readonly [number, number, number, number, number, number],
  junk: readonly [number, number, number, number],
): readonly number[] => [
  ...sky,
  ...sun,
  ...cloud,
  ...far,
  ...mid,
  ...near,
  ...water,
  ...waves,
  ...junk,
]

const light: Palettes = {
  dawn: makePalette(
    [0x96c5d5, 0xb2d5d6, 0xd4dfd0, 0xf2d7b0],
    [0xfcebb8, 0xdadbc0, 0xc2d6ce],
    [0xc0d4d8, 0xe4ece8, 0xf8f6ee],
    [0x86a3a4, 0xa8bfbc],
    [0x396062, 0x578078, 0xa2b486, 0x335b48],
    [0x173137, 0x264a4f, 0x457068, 0xb2bd84],
    [0x296572, 0x36737e],
    [0x3b7d88, 0x4f9198, 0x6ba5a3, 0x94bdb0, 0x6ba5a3, 0x4f9198],
    [0x6b382b, 0xa65a3d, 0x342421, 0xf0ad5e],
  ),
  day: makePalette(
    [0x75b4d3, 0x9bcce0, 0xc2dfe2, 0xe4ead2],
    [0xfbe8a4, 0xd0dfca, 0xadcedc],
    [0xb8ced8, 0xedf4f4, 0xffffff],
    [0x7ca2ae, 0xa0bcc0],
    [0x325e64, 0x4e7c78, 0xa6ba80, 0x2e5945],
    [0x152e36, 0x22464e, 0x406c66, 0xadc082],
    [0x24687d, 0x30798a],
    [0x368695, 0x4d9ca7, 0x6eb2b4, 0x9bcfc3, 0x6eb2b4, 0x4d9ca7],
    [0x723b2c, 0xb06043, 0x372621, 0xeaa960],
  ),
  dusk: makePalette(
    [0x5d7698, 0x88889d, 0xbe8a84, 0xe6ac86],
    [0xf4ba82, 0xc0918b, 0x9c8a98],
    [0x887f92, 0xc0a5a4, 0xecc4a8],
    [0x626b7c, 0x84828c],
    [0x2c4856, 0x446068, 0x9e8274, 0x294440],
    [0x172b36, 0x243f4a, 0x3a595e, 0xa98974],
    [0x1f495f, 0x285669],
    [0x2e6273, 0x437a86, 0x629294, 0x9ab09d, 0x629294, 0x437a86],
    [0x5c3634, 0x8f5044, 0x2c2024, 0xf2b562],
  ),
  night: makePalette(
    [0x1d2e48, 0x2c415e, 0x435874, 0x5e6f89],
    [0xe0e6e0, 0x6e859c, 0x405672],
    [0x364a62, 0x546880, 0x7c90a4],
    [0x3c4d62, 0x506176],
    [0x203546, 0x2d4856, 0x6a7d80, 0x1a3038],
    [0x11202c, 0x1a313e, 0x2a4652, 0x788a88],
    [0x163248, 0x1e4054],
    [0x244d63, 0x316074, 0x467685, 0x6e959c, 0x467685, 0x316074],
    [0x4b383c, 0x78524a, 0x1e1b22, 0xffbe52],
  ),
}

const dark: Palettes = {
  dawn: makePalette(
    [0x263650, 0x45536b, 0x826970, 0xc48d72],
    [0xebb882, 0x946e6f, 0x5c5b70],
    [0x52576c, 0x807c88, 0xc49a86],
    [0x4c5a6c, 0x6a717c],
    [0x243e4c, 0x36545c, 0x9c886e, 0x213a38],
    [0x13242e, 0x1d3640, 0x304e56, 0xa89272],
    [0x193a4e, 0x214a5c],
    [0x28586a, 0x376a78, 0x518187, 0x8aa292, 0x518187, 0x376a78],
    [0x543432, 0x885042, 0x241b1e, 0xffba54],
  ),
  day: makePalette(
    [0x274258, 0x3e5d70, 0x66828d, 0x94a9a4],
    [0xe4d498, 0x7a9597, 0x4f6d7b],
    [0x526a78, 0x7c949c, 0xb6c6c2],
    [0x48626c, 0x647f85],
    [0x203c44, 0x32565c, 0x8d9e76, 0x1e3c34],
    [0x11242c, 0x1b3740, 0x2d5054, 0x94a678],
    [0x184356, 0x205262],
    [0x266070, 0x34727e, 0x4b888d, 0x7aa49c, 0x4b888d, 0x34727e],
    [0x583630, 0x8c5640, 0x241b1d, 0xeaa85e],
  ),
  dusk: makePalette(
    [0x18223a, 0x303854, 0x68485c, 0xb06c67],
    [0xe8ad7a, 0x885a60, 0x4c4058],
    [0x3c364e, 0x625164, 0xb07870],
    [0x3a4458, 0x565c6d],
    [0x1e3240, 0x2f4854, 0x8c6c64, 0x1a3030],
    [0x0f1d26, 0x182e38, 0x2c474f, 0x9e7a6c],
    [0x153042, 0x1b3c50],
    [0x22485b, 0x305a6a, 0x47737c, 0x7c948e, 0x47737c, 0x305a6a],
    [0x4e2c2c, 0x8c4d42, 0x21181c, 0xffb648],
  ),
  night: makePalette(
    [0x0c1528, 0x17243d, 0x233450, 0x354764],
    [0xcfdadd, 0x4f647a, 0x263852],
    [0x212f46, 0x34465e, 0x566a80],
    [0x243448, 0x34465c],
    [0x142634, 0x1f3846, 0x54686e, 0x12242c],
    [0x0b161f, 0x12222c, 0x1e343e, 0x62787a],
    [0x0f2538, 0x152f44],
    [0x1a3b52, 0x244a60, 0x345c6e, 0x547c86, 0x345c6e, 0x244a60],
    [0x3e2a2e, 0x6a443e, 0x16141a, 0xffb84a],
  ),
}

// 42×32 traditional Ha Long triple-batten fan-sail junk (3 billowing frames stacked vertically).
// Fuller main & fore fan-sails, 5 bamboo battens, high stern poop cabin with glowing lantern.
const junkFrame0 = [
  '.....................H....................',
  '....................DHSEE.................',
  '...................DDHSSE.................',
  '..................SSSHSSSSE...............',
  '.................SSSSHDSSSSE..............',
  '................DDDDDDHDDDDDE.............',
  '...............SSSSSSSSSSSSSSE............',
  '..............SSSSSSSHSSSSSSSSSE..........',
  '.............DDSSSSSSHSSSSSDDDDSE.........',
  '............DDDDDDDDDHDDDDDDDDDEE.........',
  '...........SSSSSSSSSSHSSSSSSSSSSSE...H....',
  '..........SSSSSSSSSSSHSSSSSSSSSSSE...HSE..',
  '.........DDSSSSSSSSSSHSSSSSSSSDDDSE.DHSE..',
  '........DDDDDDDDDDDDDHDDDDDDDDDDDEESSHSSL.',
  '.......SSSSSSSSSSSSSSHSSSSSSSSSSSE.SSSHDSE',
  '......SSSSSSSSSSSSSSSHSSSSSSSSSSSEDDDSHDDE',
  '.....DDSSSSSSSSSSSSSSHSSSSSSSDDDSHSSSSHSSL',
  '....DDDDDDDDDDDDDDDDDHDDDDDDDDDDEHSSSDHDSE',
  '.....SSSSSSSSSSSSSSSSHSSSSSSSSSE.DDDDDHDDE',
  '.....SDDSSSSSSSSSSSSSHSSSSSSSSE..SSSSSHSSE',
  '......HCCCCCCCCCCH...H....H......DDSSSHDDE',
  '.....HCCSLLCCCCCCCH..H....H.......DDDDHDDE',
  '..HH.HCCCCCCCCCCCCHHHHHHHHHH..........H..H',
  '.HSSHSSSSSSSSSSSSSHHHHHHHHHHHHHHHHHHHSHHHH',
  '.HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH.',
  '..CHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHC..',
  '...CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC...',
  '..........................................',
  '..........................................',
  '..........................................',
  '..........................................',
  '..........................................',
]

const junkFrame1 = [
  '.....................H....................',
  '....................DHSEE.................',
  '...................DDHSSE.................',
  '..................SSSHSSSSE...............',
  '.................SSSSHDSSSSE..............',
  '................DDDDDDHDDDDDE.............',
  '...............SSSSSSSSSSSSSSE............',
  '..............SSSSSSSHSSSSSSSSSE..........',
  '.............DSSSSSSSHSSSSSDDDDSE.........',
  '............DDDDDDDDDHDDDDDDDDDEE.........',
  '...........SSSSSSSSSSHSSSSSSSSSSSE...H....',
  '..........SSSSSSSSSSSHSSSSSSSSSSSE...HSE..',
  '.........DSSSSSSSSSSSHSSSSSSSSDDDSE.DHSE..',
  '........DDDDDDDDDDDDDHDDDDDDDDDDDEESSHSSL.',
  '.......SSSSSSSSSSSSSSHSSSSSSSSSSSE.SSSHDSE',
  '......SSSSSSSSSSSSSSSHSSSSSSSSSSSEDDDSHDDE',
  '.....DSSSSSSSSSSSSSSSHSSSSSSSDDDSHSSSSHSSL',
  '....DDDDDDDDDDDDDDDDDHDDDDDDDDDDEHSSSDHDSE',
  '....SSSSSSSSSSSSSSSSSHSSSSSSSSSE.DDDDDHDDE',
  '.....DDSSSSSSSSSSSSSSHSSSSSSSSE..SSSSSHSSE',
  '.....HHCCCCCCCCCCH...H....H......DDSSSHDDE',
  '.....HCCSLLCCCCCCCH..H....H.......DDDDHDDE',
  '..HH.HCCCCCCCCCCCCHHHHHHHHHH..........H..H',
  '.HSSHSSSSSSSSSSSSSHHHHHHHHHHHHHHHHHHHSHHHH',
  '.HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH.',
  '..CHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHC..',
  '...CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC...',
  '..........................................',
  '..........................................',
  '..........................................',
  '..........................................',
  '..........................................',
]

const junkFrame2 = [
  '.....................H....................',
  '....................DHSES.................',
  '...................DDHSSE.................',
  '..................SSSHSSSSE...............',
  '.................SSSSHDSSSSE..............',
  '................DDDDDDHDDDDDE.............',
  '...............SSSSSSSSSSSSSSE............',
  '...............SSSSSSHSSSSSSSSSE..........',
  '..............DSSSSSSHSSSSSDDDDSE.........',
  '.............DDDDDDDDHDDDDDDDDDEE.........',
  '............SSSSSSSSSHSSSSSSSSSSSE...H....',
  '...........SSSSSSSSSSHSSSSSSSSSSSE...HS...',
  '..........DSSSSSSSSSSHSSSSSSSSDDDSE.DHSE..',
  '.........DDDDDDDDDDDDHDDDDDDDDDDDEESSHSSL.',
  '........SSSSSSSSSSSSSHSSSSSSSSSSSE.SSSHDSE',
  '.......SSSSSSSSSSSSSSHSSSSSSSSSSSEDDDSHDDE',
  '......DSSSSSSSSSSSSSSHSSSSSSSDDDSHSSSSHSSL',
  '.....DDDDDDDDDDDDDDDDHDDDDDDDDDDEHSSSDHDSE',
  '.....SSSSSSSSSSSSSSSSSSSSSSSSSSE.DDDDDHDDE',
  '......DDSSSSSSSSSSSSSHSSSSSSSSE..SSSSSHSSE',
  '......HCCCCCCCCCCH...H....H......DDSSSHDDE',
  '.....HCCSLLCCCCCCCH..H....H.......DDDDHDDE',
  '..HH.HCCCCCCCCCCCCHHHHHHHHHH..........H..H',
  '.HSSHSSSSSSSSSSSSSHHHHHHHHHHHHHHHHHHHSHHHH',
  '.HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH.',
  '..CHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHC..',
  '...CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC...',
  '..........................................',
  '..........................................',
  '..........................................',
  '..........................................',
  '..........................................',
]

const junkSheet = createSpriteSheet(
  parseSprite([...junkFrame0, ...junkFrame1, ...junkFrame2], {
    H: Ink.Hull,
    C: Ink.NearCrevice,
    S: Ink.Sail,
    D: Ink.SailShadow,
    E: Ink.MidRim,
    L: Ink.Lantern,
  }),
  [
    { x: 0, y: 0, width: 42, height: 32, pivot: { x: 21, y: 26 } },
    { x: 0, y: 32, width: 42, height: 32, pivot: { x: 21, y: 26 } },
    { x: 0, y: 64, width: 42, height: 32, pivot: { x: 21, y: 26 } },
  ],
)

// 8×5 × 4-pose coastal gull/egret flapping cycle (upstroke, level, downstroke, glide).
const birdSheet = createSpriteSheet(
  parseSprite([
    '.b....b.',
    '..b..b..',
    '...aa...',
    '........',
    '........',
    '........',
    '.bb..bb.',
    '..aaaa..',
    '........',
    '........',
    '........',
    '...aa...',
    '..b..b..',
    '.b....b.',
    '........',
    '........',
    '..b..b..',
    '.b.aa.b.',
    '........',
    '........',
  ], { a: Ink.NearCrevice, b: Ink.MidShadow }),
  [
    { x: 0, y: 0, width: 8, height: 5, pivot: { x: 4, y: 2 } },
    { x: 0, y: 5, width: 8, height: 5, pivot: { x: 4, y: 2 } },
    { x: 0, y: 10, width: 8, height: 5, pivot: { x: 4, y: 2 } },
    { x: 0, y: 15, width: 8, height: 5, pivot: { x: 4, y: 2 } },
  ],
)

/** Builds a volumetric multi-lobe cloud stamp with sunlit top-right rim and shaded belly. */
function makeCloudSprite(width: number, height: number, lobes: readonly { cx: number; cy: number; rx: number; ry: number }[]): Sprite {
  const filled = new Uint8Array(width * height)
  const baseY = Math.floor(height * 0.72)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const baseDx = (x - width * 0.5) / (width * 0.48)
      const baseDy = (y - baseY) / (height * 0.28)
      let inside = y <= Math.floor(height * 0.88) && baseDx * baseDx + baseDy * baseDy <= 1
      if (!inside) {
        for (const lobe of lobes) {
          const dx = (x - lobe.cx * width) / (lobe.rx * width)
          const dy = (y - lobe.cy * height) / (lobe.ry * height)
          if (dx * dx + dy * dy <= 1) {
            inside = true
            break
          }
        }
      }
      if (inside) filled[y * width + x] = 1
    }
  }
  const pixels = new Int8Array(width * height).fill(-1)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!filled[y * width + x]) continue
      const topAir = y === 0 || !filled[(y - 1) * width + x]
      const rightAir = x === width - 1 || !filled[y * width + (x + 1)]
      const botAir = y === height - 1 || !filled[(y + 1) * width + x]
      const bot2Air = y >= height - 2 || !filled[(y + 2) * width + x]
      if (topAir || (rightAir && y < baseY)) {
        pixels[y * width + x] = Ink.CloudRim
      } else if (botAir || (bot2Air && y >= baseY - 1)) {
        pixels[y * width + x] = Ink.CloudShadow
      } else {
        pixels[y * width + x] = Ink.CloudBody
      }
    }
  }
  return { width, height, pixels }
}

const cloudSmall = makeCloudSprite(28, 10, [
  { cx: 0.34, cy: 0.56, rx: 0.22, ry: 0.38 },
  { cx: 0.58, cy: 0.46, rx: 0.24, ry: 0.44 },
])

const cloudMedium = makeCloudSprite(44, 13, [
  { cx: 0.30, cy: 0.54, rx: 0.20, ry: 0.38 },
  { cx: 0.54, cy: 0.42, rx: 0.23, ry: 0.44 },
  { cx: 0.76, cy: 0.56, rx: 0.17, ry: 0.34 },
])

const cloudLarge = makeCloudSprite(58, 16, [
  { cx: 0.26, cy: 0.56, rx: 0.18, ry: 0.36 },
  { cx: 0.48, cy: 0.38, rx: 0.22, ry: 0.46 },
  { cx: 0.72, cy: 0.50, rx: 0.19, ry: 0.40 },
])

interface SceneCache {
  readonly waterline: number
  readonly sunX: number
  readonly skyOpenMask: Mask
  readonly mistMask: Mask
  readonly waterMask: Mask
}

const cacheByBase = new WeakMap<Uint8Array, SceneCache>()

function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(seed, 83492791)) >>> 0
  h ^= h >>> 13
  h = Math.imul(h, 1274126177) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

function drawSky(ctx: BuildCtx, waterline: number): number {
  const { width: w, height: h } = ctx
  // 4 clean sky bands with narrow 6px 4×4 Bayer seam transitions (no full-sky checker dither)
  const bands = [
    Math.round(waterline * 0.24),
    Math.round(waterline * 0.52),
    Math.round(waterline * 0.80),
  ]
  const seamHalf = 3
  for (let y = 0; y < waterline; y++) {
    const idx = bands.findIndex((b) => y >= b - seamHalf && y <= b + seamHalf - 1)
    if (idx >= 0) {
      const amount = (y - (bands[idx]! - seamHalf) + 0.5) / (seamHalf * 2)
      for (let x = 0; x < w; x++) ctx.px(x, y, ctx.dither(x, y, amount, idx, idx + 1, 4))
    } else {
      const band = y < bands[0]! ? Ink.SkyTop : y < bands[1]! ? Ink.SkyUpper : y < bands[2]! ? Ink.SkyLower : Ink.SkyHorizon
      ctx.rect(0, y, w, 1, band)
    }
  }
  // Sun / moon seated inside SkyUpper band with 2 stepped concentric glow rings (no checkerboard)
  const sx = Math.round(w * 0.78)
  const sy = Math.round(h * 0.23)
  const sr = Math.max(5, Math.round(Math.min(w, h) * 0.036))
  ctx.disc(sx, sy, Math.round(sr * 2.0), Ink.GlowOuter)
  ctx.disc(sx, sy, Math.round(sr * 1.42), Ink.GlowInner)
  ctx.disc(sx, sy, sr, Ink.Sun)
  return sx
}

interface KarstSpec {
  readonly left: number
  readonly right: number
  readonly peakV: number
  readonly baseV: number
  /** Faceted polygonal ridge control points: u in [0, 1], h in [0, 1] */
  readonly ridge: readonly (readonly [number, number])[]
  readonly shadow: Ink
  readonly body: Ink
  readonly rim: Ink
  readonly crevice?: Ink
  readonly foliage?: Ink
  readonly undercut?: boolean
  readonly detailed: boolean
  readonly occluder?: Mask
}

function evalPolyline(pts: readonly (readonly [number, number])[], u: number): number {
  if (u <= pts[0]![0]) return pts[0]![1]
  for (let i = 0; i < pts.length - 1; i++) {
    const [u0, h0] = pts[i]!
    const [u1, h1] = pts[i + 1]!
    if (u <= u1) {
      const t = (u - u0) / Math.max(1e-5, u1 - u0)
      return h0 + (h1 - h0) * t
    }
  }
  return pts[pts.length - 1]![1]
}

function drawKarstCluster(ctx: BuildCtx, spec: KarstSpec, waterline: number): Float32Array {
  const { width: w, height: h, seed } = ctx
  const x0 = Math.max(0, Math.floor(spec.left * w))
  const x1 = Math.min(w - 1, Math.ceil(spec.right * w))
  const spanW = Math.max(1, (spec.right - spec.left) * w)
  const baseY = Math.min(h, Math.round(spec.baseV * h))
  const peakY = Math.round(spec.peakV * h)
  const maxH = Math.max(4, baseY - peakY)
  const topMap = new Float32Array(w).fill(h)

  // Compute jagged faceted limestone silhouette from polygonal ridge + stepped rock ledges
  for (let x = x0; x <= x1; x++) {
    const u = Math.max(0, Math.min(1, (x - spec.left * w) / spanW))
    const polyH = evalPolyline(spec.ridge, u)
    const stepX = Math.floor(x / 2) * 2
    const crag = (ctx.fbm2(stepX * 0.16 + spec.peakV * 197, 23) - 0.5) * 0.22
    const finalH = polyH > 0.04 ? Math.max(0.02, Math.min(1, polyH + crag)) : 0
    topMap[x] = finalH > 0.02 ? Math.round(baseY - finalH * maxH) : baseY
  }

  for (let x = x0; x <= x1; x++) {
    const topY = topMap[x]!
    if (topY >= baseY) continue
    const u = (x - spec.left * w) / spanW
    const leftTop = x > 0 ? topMap[x - 1]! : baseY
    const rightTop = x < w - 1 ? topMap[x + 1]! : baseY

    const undercutLeft = spec.undercut && u > 0.01 && u < 0.07
    const undercutRight = spec.undercut && u > 0.93 && u < 0.99

    for (let y = topY; y < baseY; y++) {
      // Geometric tidal notch: skip outer 1-2px right above waterline for natural limestone overhang
      if (spec.undercut && y >= waterline - 3 && y <= waterline - 1) {
        if ((undercutLeft && u < 0.035) || (undercutRight && u > 0.965)) continue
      }

      // Break vertical ridge seams using high-frequency geological plane shift across NoiseAtlas octaves
      const seamWarp = Math.round((ctx.fbm2(x * 1.4 + spec.left * 97, y * 1.6 + 19) - 0.5) * 14)
      const sx = Math.max(0, Math.min(w - 1, x + seamWarp))
      const sLookL = sx > 3 ? topMap[sx - 4]! : baseY
      const sLookR = sx < w - 4 ? topMap[sx + 4]! : baseY
      const warpedSlope = sLookR - sLookL

      // Faceted limestone cliff planes (sampled across wide NoiseAtlas span so no single octave dominates)
      const planeNoise = ctx.fbm2(
        Math.floor(x / 5) * 3.1 + spec.left * 73,
        Math.floor(y / 6) * 2.7 + 41,
      )
      const litBias = warpedSlope > 2 ? 0.36 : warpedSlope < -2 ? 0.64 : 0.48
      const isLitFace = planeNoise > litBias
      let ink = isLitFace ? spec.body : spec.shadow

      // Crisp 1px sunlit limestone rim along east-facing shoulders & upper crests
      const isEastSlope = rightTop > leftTop || (topY < rightTop && topY <= leftTop)
      if ((y === topY && isEastSlope) || (topY < rightTop - 1 && y <= topY + 2)) {
        ink = spec.rim
      }

      if (spec.detailed) {
        // Steep limestone rock strata texture (~16% interior texture, never whole-cliff wash)
        const strata = ctx.fbm2((x + Math.floor(y * 0.16)) * 2.4 + spec.left * 61, y * 1.1 + 17)
        if (isLitFace && strata < 0.43 && (hash2(x >> 1, y >> 2, seed) & 7) < 3) {
          ink = spec.shadow
        } else if (!isLitFace && strata > 0.57 && (hash2(x >> 1, y >> 2, seed) & 7) < 3) {
          ink = spec.body
        }

        // Subtle rock cleft accents anchored to facet seams (never isolated floating parentheses)
        if (spec.crevice !== undefined && y > topY + 2 && (y < topY + 12 || !isLitFace)) {
          const colShift = Math.floor(y * 0.14)
          const fissureCell = hash2(Math.floor((x + colShift) / 11), Math.floor(y / 9), seed + 59)
          const localX = ((x + colShift) % 11 + 11) % 11
          if ((fissureCell & 15) === 0 && localX === 5 && (y % 9) >= 2 && (y % 9) <= 6) {
            ink = spec.crevice
          }
        }
      }

      ctx.px(x, y, ink)
      spec.occluder?.set(x, y, 15)
    }

    // Lush clinging tropical shrubbery along limestone ledges and summit crowns
    if (spec.detailed && spec.foliage !== undefined && topY < waterline - 6) {
      const ledgeSlope = Math.abs(rightTop - leftTop)
      if (ledgeSlope <= 2 && (hash2(x, topY, seed + 17) % 5) < 2) {
        const bushR = 2 + (hash2(x, topY, seed + 29) & 1)
        for (let dy = -bushR; dy <= 1; dy++) {
          for (let dx = -bushR; dx <= bushR; dx++) {
            if (dx * dx + dy * dy <= bushR * bushR) {
              const bx = x + dx
              const by = topY + dy
              if (bx >= 0 && bx < w && by >= 0 && by < h) {
                const bushInk = dy < 0 && dx >= 0 ? spec.rim : spec.foliage
                ctx.px(bx, by, bushInk)
                spec.occluder?.set(bx, by, 15)
              }
            }
          }
        }
      }
    }
  }
  return topMap
}

function drawWaterBase(ctx: BuildCtx, waterline: number, sunX: number): void {
  const { width: w, height: h, seed } = ctx
  const waterH = Math.max(1, h - waterline)
  // Lighter sky-reflecting WaterMid near the horizon transitioning smoothly into deeper WaterDeep foreground
  const ditherBandMid = Math.round(waterline + waterH * 0.42)

  for (let y = waterline; y < h; y++) {
    const depth = (y - waterline) / waterH
    // IMPORTANT: Use ctx.px (never ctx.rect) inside masked layers so near/mid karsts are never overwritten!
    if (Math.abs(y - ditherBandMid) <= 6) {
      const amount = (y - (ditherBandMid - 6) + 0.5) / 13
      for (let x = 0; x < w; x++) {
        ctx.px(x, y, ctx.dither(x, y, amount, Ink.WaterMid, Ink.WaterDeep, 4))
      }
    } else {
      const baseInk = y < ditherBandMid ? Ink.WaterMid : Ink.WaterDeep
      for (let x = 0; x < w; x++) {
        ctx.px(x, y, baseInk)
      }
    }

    // Subtle organic horizontal wavelets (seeded hash, zero periodic diagonal interference)
    const waveLen = Math.round(2 + depth * 8)
    const rowStep = y % 2 === 0 ? 11 : 13
    const rowJitter = hash2(0, y, seed + 3) % rowStep
    for (let x = rowJitter; x < w; x += rowStep) {
      const cellHash = hash2(x, y, seed + 7)
      if ((cellHash & 15) < 4) {
        const len = waveLen + (cellHash % 3)
        const phase = ((x >> 2) + y + (cellHash & 3)) % 6
        ctx.line(x, y, Math.min(w - 1, x + len), y, Ink.Wave0 + phase)
      }
    }

    // Tapered sun-path glint cone centered below sunX
    const coneHalf = 4 + depth * 28
    if (y % 2 === 0) {
      const glintCount = 1 + Math.floor(depth * 2.5)
      for (let g = 0; g < glintCount; g++) {
        const gh = hash2(g * 17, y, seed + 41)
        const gx = Math.round(sunX + ((gh % 200) / 100 - 1) * coneHalf)
        const glen = Math.round(2 + depth * 5 + (gh % 3))
        if (gx >= 0 && gx < w) {
          const glintInk = (gh & 7) === 0 ? Ink.Sun : Ink.Wave3 + (gh % 3)
          ctx.line(gx, y, Math.min(w - 1, gx + glen), y, glintInk)
        }
      }
    }
  }
}

function drawKarstReflections(
  ctx: BuildCtx,
  waterline: number,
  topMap: Float32Array,
  darkInk: Ink,
  midInk: Ink,
): void {
  const { width: w, height: h, seed } = ctx
  for (let x = 0; x < w; x++) {
    const topY = topMap[x]!
    if (topY >= waterline) continue
    const reflH = Math.min(h - waterline - 2, Math.round((waterline - topY) * 0.42))
    for (let dy = 2; dy < reflH; dy += 2) {
      const y = waterline + dy
      const fade = dy / Math.max(1, reflH)
      const hsh = hash2(x >> 2, y, seed + 97)
      if ((hsh & 7) < Math.round(5 - fade * 3)) {
        const ink = fade < 0.45 ? darkInk : midInk
        ctx.px(x, y, ink)
      }
    }
  }
}

const scene: SceneDef = {
  id: 'vn-halong',
  name: { en: 'Ha Long Bay', vi: 'Vịnh Hạ Long' },
  region: 'vn',
  tone: 'both',
  defaultTime: 'dawn',
  themePalettes: { light, dark },
  themeDefaultTime: { light: 'dawn', dark: 'dusk' },
  palettes: light,
  cycles: [{ indices: [Ink.Wave0, Ink.Wave1, Ink.Wave2, Ink.Wave3, Ink.Wave4, Ink.Wave5], rate: 6 }],
  horizon: 0.62,
  focus: { x: 0.71, y: 0.73 },
  build(ctx) {
    const { width: w, height: h } = ctx
    const waterline = Math.floor(h * 0.62)
    const occluderMask = ctx.mask()
    const farOccluder = ctx.mask()
    const nearLeftMask = ctx.mask()

    let sunX = Math.round(w * 0.78)
    ctx.layer({ kind: 'sky', z: 0 }, () => {
      sunX = drawSky(ctx, waterline)
    })

    // Far limestone karst clusters with crisp angular spires and atmospheric mist contrast
    ctx.layer({ kind: 'far', z: 1 }, () => {
      drawKarstCluster(
        ctx,
        {
          left: 0.14,
          right: 0.42,
          peakV: 0.42,
          baseV: 0.62,
          shadow: Ink.FarShadow,
          body: Ink.FarBody,
          rim: Ink.FarBody,
          detailed: false,
          occluder: farOccluder,
          ridge: [
            [0.0, 0.0],
            [0.10, 0.48],
            [0.22, 0.62],
            [0.34, 0.36],
            [0.48, 0.96],
            [0.58, 0.88],
            [0.72, 0.56],
            [0.84, 0.44],
            [1.0, 0.0],
          ],
        },
        waterline,
      )
      drawKarstCluster(
        ctx,
        {
          left: 0.58,
          right: 0.88,
          peakV: 0.39,
          baseV: 0.62,
          shadow: Ink.FarShadow,
          body: Ink.FarBody,
          rim: Ink.FarBody,
          detailed: false,
          occluder: farOccluder,
          ridge: [
            [0.0, 0.0],
            [0.12, 0.55],
            [0.24, 0.48],
            [0.36, 0.82],
            [0.46, 1.0],
            [0.58, 0.66],
            [0.72, 0.74],
            [0.88, 0.46],
            [1.0, 0.0],
          ],
        },
        waterline,
      )
    })

    // Midground faceted limestone islands with steep crags, rock fissures & cliff foliage
    let midCenterTop: Float32Array<ArrayBufferLike> = new Float32Array(w).fill(h)
    let rightCragTop: Float32Array<ArrayBufferLike> = new Float32Array(w).fill(h)
    ctx.layer({ kind: 'mid', z: 3 }, () => {
      midCenterTop = drawKarstCluster(
        ctx,
        {
          left: 0.34,
          right: 0.64,
          peakV: 0.35,
          baseV: 0.65,
          shadow: Ink.MidShadow,
          body: Ink.MidBody,
          rim: Ink.MidRim,
          crevice: Ink.NearCrevice,
          foliage: Ink.Foliage,
          undercut: true,
          detailed: true,
          occluder: occluderMask,
          ridge: [
            [0.0, 0.0],
            [0.08, 0.48],
            [0.18, 0.68],
            [0.28, 0.54],
            [0.42, 0.84],
            [0.52, 1.0],
            [0.64, 0.74],
            [0.78, 0.58],
            [0.88, 0.48],
            [1.0, 0.0],
          ],
        },
        waterline,
      )
      rightCragTop = drawKarstCluster(
        ctx,
        {
          left: 0.82,
          right: 1.03,
          peakV: 0.25,
          baseV: 0.70,
          shadow: Ink.MidShadow,
          body: Ink.MidBody,
          rim: Ink.MidRim,
          crevice: Ink.NearCrevice,
          foliage: Ink.Foliage,
          undercut: true,
          detailed: true,
          occluder: occluderMask,
          ridge: [
            [0.0, 0.0],
            [0.09, 0.54],
            [0.20, 0.64],
            [0.32, 0.46],
            [0.46, 0.94],
            [0.56, 1.0],
            [0.70, 0.72],
            [0.84, 0.82],
            [1.0, 0.48],
          ],
        },
        waterline,
      )
    })

    // Near left framing cliff (foreground anchor extending cleanly to bottom edge)
    let nearLeftTop: Float32Array<ArrayBufferLike> = new Float32Array(w).fill(h)
    ctx.layer({ kind: 'near', z: 6 }, () => {
      nearLeftTop = drawKarstCluster(
        ctx,
        {
          left: -0.05,
          right: 0.21,
          peakV: 0.28,
          baseV: 1.0,
          shadow: Ink.NearShadow,
          body: Ink.NearBody,
          rim: Ink.NearRim,
          crevice: Ink.NearCrevice,
          foliage: Ink.Foliage,
          undercut: true,
          detailed: true,
          occluder: nearLeftMask,
          ridge: [
            [0.0, 0.84],
            [0.22, 1.0],
            [0.36, 0.90],
            [0.48, 0.62],
            [0.64, 0.74],
            [0.80, 0.52],
            [1.0, 0.0],
          ],
        },
        waterline,
      )
    })

    // Build reusable occlusion masks for frame() and water
    const waterMask = ctx.mask()
    const mistMask = ctx.mask()
    const skyOpenMask = ctx.mask()

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const occluded = occluderMask.contains(x, y) || nearLeftMask.contains(x, y)
        if (y >= waterline && !occluded) {
          waterMask.set(x, y, 15)
        }
        if (y >= waterline - 12 && y <= waterline && !occluded) {
          mistMask.set(x, y, 15)
        }
        if (y < waterline && !occluded && !farOccluder.contains(x, y)) {
          skyOpenMask.set(x, y, 15)
        }
      }
    }

    // Water + broken karst reflections strictly inside waterMask
    ctx.layer({ kind: 'water', z: 4, mask: waterMask }, () => {
      drawWaterBase(ctx, waterline, sunX)
      drawKarstReflections(ctx, waterline, midCenterTop, Ink.WaterDeep, Ink.MidShadow)
      drawKarstReflections(ctx, waterline, rightCragTop, Ink.NearCrevice, Ink.MidShadow)
      drawKarstReflections(ctx, waterline, nearLeftTop, Ink.NearCrevice, Ink.NearShadow)
    })

    cacheByBase.set(ctx.base, {
      waterline,
      sunX,
      skyOpenMask,
      mistMask,
      waterMask,
    })
  },
  frame(ctx, t) {
    const { width: w, height: h } = ctx
    const cache = cacheByBase.get(ctx.base)
    if (!cache) return
    const { waterline, sunX, skyOpenMask, mistMask, waterMask } = cache

    // 1. Slow volumetric multi-lobe clouds behind all karsts
    ctx.layer({ kind: 'sky', z: 0, mask: skyOpenMask }, () => {
      const span = w + 80
      const c1x = ((Math.floor(t * 0.16) + Math.round(w * 0.06)) % span) - 40
      const c2x = ((Math.floor(t * 0.24) + Math.round(w * 0.38)) % span) - 50
      const c3x = ((Math.floor(t * 0.34) + Math.round(w * 0.60)) % span) - 60
      ctx.sprite(cloudSmall, c1x, Math.round(h * 0.14), 1)
      ctx.sprite(cloudMedium, c2x, Math.round(h * 0.22), 1)
      ctx.sprite(cloudLarge, c3x, Math.round(h * 0.09), 1)
    })

    // 2. Feathered morning sea haze softening the far karst bases inside mistMask
    ctx.layer({ kind: 'fog', z: 2, mask: mistMask }, () => {
      const stepT = Math.floor(t * 3) / 3
      const shift = Math.floor(stepT * 0.22)
      for (let y = waterline - 8; y <= waterline; y++) {
        const density = 1 - Math.abs(y - (waterline - 3)) / 6
        for (let x = 0; x < w; x++) {
          const wave = 0.5 + 0.5 * Math.sin((x - shift) * 0.055 + y * 0.4)
          if (wave * density > 0.48 && ctx.dither(x, y, wave * density * 0.65, 0, 1, 4) === 1) {
            ctx.px(x, y, y < waterline - 3 ? Ink.FarBody : Ink.CloudShadow)
          }
        }
      }
    })

    // 3. Flapping 4-pose birds gliding along gentle curves behind karsts
    ctx.layer({ kind: 'fx', z: 5, mask: skyOpenMask }, () => {
      const birds = [
        { baseU: 0.10, baseV: 0.22, speed: 1.8, phase: 0.2 },
        { baseU: 0.19, baseV: 0.26, speed: 1.5, phase: 1.9 },
        { baseU: 0.72, baseV: 0.43, speed: 1.4, phase: 3.4 },
      ] as const
      for (const b of birds) {
        const bx = Math.round(((b.baseU * w + t * b.speed) % (w + 24)) - 12)
        const by = Math.round(b.baseV * h + Math.sin(t * 0.7 + b.phase) * 2.5)
        const pose = Math.floor(t * 6 + b.phase * 2) % 4
        ctx.spriteFrame(birdSheet, pose, bx, by, 1)
      }
    })

    // 4. Tapered water sparkle pulses + 42×32 Hero Fan-Sail Junk Boat + wake + reflection
    const boatX = Math.round(w * 0.71) + Math.round(Math.sin((t * Math.PI * 2) / 19) * 2)
    const boatY = waterline + Math.round(h * 0.145) + Math.round(Math.sin((t * Math.PI * 2) / 7))
    const sailPose = Math.floor(t * 2.5) % 3

    ctx.layer({ kind: 'water', z: 4, mask: waterMask }, () => {
      // Subtle animated sun-path sparkles (never thick slabs)
      const tick = Math.floor(t * 4)
      for (let row = 0; row < 10; row++) {
        const y = waterline + 4 + Math.round(((row * 0.095) + ((tick * 0.01) % 0.08)) * (h - waterline))
        if (y >= h) continue
        const depth = (y - waterline) / Math.max(1, h - waterline)
        const coneHalf = 4 + depth * 26
        const hsh = hash2(row, tick, 53)
        const sx = Math.round(sunX + ((hsh % 200) / 100 - 1) * coneHalf)
        const slen = Math.round(2 + depth * 4)
        ctx.line(sx, y, Math.min(w - 1, sx + slen), y, (row + tick) % 3 === 0 ? Ink.Sun : Ink.Wave4)
      }

      // Broken horizontal reflection of the 42×32 junk hull, sail & cabin lantern
      for (let dy = 2; dy <= 11; dy += 2) {
        const ry = boatY + dy
        if (ry >= h) break
        const ripple = Math.round(Math.sin(ry * 0.55 + t * 2.4) * 1.3)
        const span = Math.max(4, 15 - dy)
        ctx.line(boatX - span + ripple, ry, boatX + span + ripple, ry, dy <= 5 ? Ink.Hull : Ink.SailShadow)
        if (dy <= 6 && (dy + tick) % 4 === 0) {
          ctx.line(boatX - 11 + ripple, ry, boatX - 9 + ripple, ry, Ink.Lantern)
        }
      }

      // Trailing wake ripples astern (left of hull)
      for (let i = 0; i < 4; i++) {
        const wy = boatY + 1 + i
        const wx0 = boatX - 23 - i * 5
        const wx1 = boatX - 15 - i * 3
        ctx.line(wx0, wy, wx1, wy, i % 2 === 0 ? Ink.CloudBody : Ink.Wave4)
      }
    })

    // Draw the 42×32 hero junk sprite above the bay water
    ctx.layer({ kind: 'fx', z: 5 }, () => {
      ctx.spriteFrame(junkSheet, sailPose, boatX, boatY, 1)
    })
  },
}

export default scene
