/**
 * vn-mu-cang-chai: Mù Cang Chải rice terraces (Yên Bái, Vietnam).
 *
 * Phase 2 fix round (R8):
 * - Terraces are flowing contour bands. Each band is a curved tread (lit top lip, paddy body)
 *   over a shadowed riser; widths grow toward the viewer and taper where the hill ends.
 * - Rice texture is short irregular horizontal tufts at roughly 12% coverage, never vertical stripes.
 * - Some paddies are flooded and reflect the sky with broken glints.
 * - The canal is a meandering ribbon that winds down the valley floor.
 * - Smooth layered ridges replace the column-striped backdrop.
 * - A hand-drawn H'Mong stilt house (36×26) stands on the right terrace.
 * - Light and dark are separate designs; dark uses a twilight dusk and a night ramp.
 */
import { darkness } from '../../engine/palette'
import { createSpriteSheet, parseSprite } from '../../engine/sprite'
import type { BuildCtx, FrameCtx, Palettes, SceneDef, ThemePalettes } from '../../engine/types'

export const enum Ink {
  // Sky & atmosphere (0..5)
  SkyZenith = 0,
  SkyMid = 1,
  SkyLow = 2,
  SkyHorizon = 3,
  SunMoon = 4,
  SunHalo = 5,

  // Distant mountain ridges (6..9)
  Ridge1Shadow = 6,
  Ridge1Lit = 7,
  Ridge2Shadow = 8,
  Ridge2Lit = 9,

  // Rice terrace paddies & dikes (10..16)
  DikeShadow = 10,     // 2-3px dark soil dike boundary & terrace drop shadows
  DikeSoilLit = 11,    // soil embankment lit rim
  RiceShadow = 12,     // deep green/olive shadow within paddy
  RiceMid = 13,        // unripe / green-gold paddy tone
  RiceRipeGold = 14,   // golden ripe harvest body
  RiceSunlitTip = 15,  // sunlit grain tip / rim light stippling
  TerraceWater = 16,   // flooded terrace sky reflection

  // Meandering mountain stream (17..19)
  StreamDeep = 17,     // flowing mountain stream water body
  StreamGlint = 18,    // broken shimmer glint
  StreamBank = 19,     // moist earth / pebble bank

  // H'Mong Gabled Stilt House (Nhà Sàn 36×26) (20..26)
  ThatchShadow = 20,   // thatch roof shade & eave underside
  ThatchLit = 21,      // warm straw/pơ mu thatch lit surface
  TimberDark = 22,     // aged timber wall & support stilts
  TimberLit = 23,      // porch deck, railing, ladder
  WindowGlow = 24,     // warm glowing lantern window (dusk/night), interior shadow (day)
  WindowHalo = 25,     // ambient light spill on porch/stilts
  HouseGround = 26,    // contact grounding shadow beneath stilts

  // Foreground rice & path (27..29)
  NearStalkShadow = 27,// foreground rice stalk base & shadows
  NearGrainGold = 28,  // foreground golden ripe rice grains
  NearPath = 29,       // foreground dirt path / embankment

  // Mist & flying wildlife / stars (30..31)
  ValleyMist = 30,     // low drifting valley mist ribbons
  Bird = 31,           // soaring mountain birds / twilight star accent
}

const ramp = (
  sky: readonly number[],
  sun: readonly number[],
  ridge: readonly number[],
  terrace: readonly number[],
  stream: readonly number[],
  house: readonly number[],
  near: readonly number[],
  fx: readonly number[],
): readonly number[] => [
  ...sky, ...sun, ...ridge, ...terrace, ...stream, ...house, ...near, ...fx,
]

const light: Palettes = {
  dawn: ramp(
    [0x8cadbf, 0xa4c0cf, 0xc7d6ca, 0xf0c9a5],
    [0xfff0cc, 0xf8dfb0],
    [0x5a7674, 0x76928e, 0x486462, 0x62807b],
    [0x424e2c, 0x6e5c3e, 0x526032, 0x828a44, 0xd2b454, 0xf0d674, 0x92b6be],
    [0x68969e, 0xcbe4e8, 0x504238],
    [0x5a4634, 0x967856, 0x423226, 0x785a44, 0xf2a44e, 0x865c34, 0x2e241c],
    [0x424e2c, 0xd8b856, 0x745e46],
    [0xdde6de, 0x382c2a],
  ),
  day: ramp(
    [0x9ecad8, 0xb2d4cf, 0xc8debe, 0xd2e2be],
    [0xfff8d8, 0xf8ecc0],
    [0x506e68, 0x6e8e86, 0x3e5e58, 0x587870],
    [0x546332, 0x7e6a48, 0x607036, 0x9a9438, 0xd8ba4e, 0xf6e078, 0x9ac4ce],
    [0x88b2bc, 0xddf4f8, 0x5a483a],
    [0x584432, 0x8c6e4e, 0x4e3b2a, 0x7a5e46, 0x3a2c22, 0x4e3b2a, 0x261e18],
    [0x546332, 0xe0c052, 0x7e664e],
    [0xe6ede8, 0x3a302a],
  ),
  dusk: ramp(
    [0x4a5878, 0x7c6c7e, 0xb87b74, 0xdf9e78],
    [0xf6a86c, 0xe88a56],
    [0x384650, 0x56646c, 0x2a3640, 0x425058],
    [0x383c28, 0x5c4832, 0x46482e, 0x7e6e3c, 0xc4944c, 0xe4b46c, 0x8e828e],
    [0x5a667e, 0xc4b2c0, 0x483a34],
    [0x443228, 0x74543e, 0x36261e, 0x5e4230, 0xffa838, 0x8e4c1c, 0x1c1614],
    [0x383c28, 0xcaa050, 0x5c4636],
    [0xb8a6b2, 0x282024],
  ),
  night: ramp(
    [0x182238, 0x222e46, 0x2e3c54, 0x3e4e68],
    [0xe8f0f8, 0x7890b0],
    [0x1a2634, 0x263444, 0x121c28, 0x1e2a38],
    [0x1e241c, 0x362e24, 0x242c22, 0x3e4832, 0x6e7654, 0x909870, 0x2c3c50],
    [0x28384c, 0x6e8ca8, 0x22262a],
    [0x241c18, 0x44342a, 0x1c1612, 0x34261e, 0xffb848, 0x784418, 0x0c0a0a],
    [0x1e241c, 0x747a54, 0x322820],
    [0x3e4e64, 0xe0eaff],
  ),
}

const dark: Palettes = {
  dawn: ramp(
    [0x1e283e, 0x323854, 0x544864, 0x7a5b6e],
    [0xe8a48c, 0x9c5e6c],
    [0x18202c, 0x263040, 0x121822, 0x1c2432],
    [0x1e241c, 0x383024, 0x283222, 0x42482e, 0x787244, 0x9c9258, 0x3e485c],
    [0x344458, 0x787c94, 0x2a2222],
    [0x281e1a, 0x4c382a, 0x1c1410, 0x36241a, 0xf49c40, 0x743e18, 0x0e0a08],
    [0x1e241c, 0x787244, 0x382c20],
    [0x48465c, 0xe8d0b0],
  ),
  day: ramp(
    [0x2c4250, 0x3e5664, 0x566e78, 0x728888],
    [0xeae0be, 0xb0ae90],
    [0x203432, 0x344c48, 0x182a28, 0x283c38],
    [0x283420, 0x463c2a, 0x364426, 0x586030, 0x948842, 0xb8ae58, 0x4c6a74],
    [0x426470, 0x88b0b8, 0x343e34],
    [0x32241a, 0x58422e, 0x241812, 0x443020, 0x2c2016, 0x38281c, 0x14100c],
    [0x283420, 0x948842, 0x483a2a],
    [0x627478, 0x1e2224],
  ),
  dusk: ramp(
    [0x1e263c, 0x38304c, 0x644258, 0x8e5862],
    [0xb86c68, 0x8c4854],
    [0x161e2e, 0x242e40, 0x121824, 0x1e2636],
    [0x202820, 0x3c3424, 0x283224, 0x48422c, 0x766238, 0x967a42, 0x3d4c5e],
    [0x3d4c5e, 0x887a8e, 0x2c2628],
    [0x2c1e18, 0x543a28, 0x241c1a, 0x3a281e, 0xffb048, 0x884618, 0x0e0c0b],
    [0x202820, 0x967a42, 0x3e3226],
    [0x484458, 0xffd278],
  ),
  night: ramp(
    [0x0e1624, 0x141e30, 0x1a2840, 0x24344e],
    [0xd8e4f4, 0x48607e],
    [0x0e1620, 0x182230, 0x081018, 0x121c26],
    [0x141c14, 0x28221a, 0x1c241a, 0x2e3622, 0x4e563a, 0x6e7652, 0x1c2838],
    [0x1c2a3c, 0x486482, 0x181c20],
    [0x1c1410, 0x34241a, 0x140e0a, 0x281a12, 0xffae38, 0x703a12, 0x060606],
    [0x141c14, 0x4e563a, 0x261e16],
    [0x28364a, 0xe2ecfc],
  ),
}

const themePalettes: ThemePalettes = { light, dark }

/**
 * Hand-drawn H'Mong stilt house (nhà sàn), 36×26 art px at (356, 143).
 * Steep gable thatch (lit left slope, shaded right slope), a plank wall with a glowing window,
 * a porch deck, stilts with floor joists, a ladder and a contact shadow on the terrace.
 */
const houseSprite = parseSprite([
  '...............RRRrrr...............',
  '..............RRRRrrrr..............',
  '.............RRRRRrrrrr.............',
  '............RrRRrRrrrrrr............',
  '...........RRRRRRRrrrrrrr...........',
  '..........RRRRRRRRrrrrrrrr..........',
  '.........RrRRrRRrRrrrrrrrrr.........',
  '........RRRRRRRRRRrrrrrrrrrr........',
  '.......RRRRRRRRRRRrrrrrrrrrrr.......',
  '.rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr.',
  '..WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW..',
  '...WwwwWwwwWwwwWwwwWwwwWwwwWwwwWw...',
  '...WwwwwwwwWwwwWwwwWwGGWGGGWwwwWw...',
  '...WwwwWWWWWwwwWwwwWwGGWGGGWwwwWw...',
  '...WwwwWWwWWwwwWwwwWwGGWGGGWwwwWw...',
  '...WwwwWWWWWwwwWwwwWWWWWWWWWwwwWw...',
  '...WwwwWWWWWwwwWwwwWwggggggWwwwWw...',
  '.wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww.',
  '.WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW.',
  '...WW..w..w.WW........WW.......WW...',
  '...WW..wwww.WW........WW.......WW...',
  '...WW..w..w.WW........WW.......WW...',
  '...WWWWwwwwWWWWWWWWWWWWWWWWWWWWWW...',
  '...WW..w..w.WW........WW.......WW...',
  '...WW..wwww.WW........WW.......WW...',
  '...SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS..',
], {
  R: Ink.ThatchLit,
  r: Ink.ThatchShadow,
  W: Ink.TimberDark,
  w: Ink.TimberLit,
  G: Ink.WindowGlow,
  g: Ink.WindowHalo,
  S: Ink.HouseGround,
})

/**
 * Foreground swaying rice tufts (10×10, 3 poses).
 * Captures golden drooping seed heads swaying in the mountain breeze.
 */
const riceSheet = createSpriteSheet(parseSprite([
  '....gg....',
  '...gggg...',
  '..gggggg..',
  '.g.ggggg..',
  '...s.g....',
  '...s......',
  '...s..s...',
  '..ss..s...',
  '..ss.ss...',
  '.ssssss...',

  '.....gg...',
  '....gggg..',
  '...gggggg.',
  '..g.ggggg.',
  '....s.g...',
  '....s.....',
  '....s..s..',
  '...ss..s..',
  '..ss.ss...',
  '..ssssss..',

  '...gg.....',
  '..gggg....',
  '.gggggg...',
  'g.ggggg...',
  '..s.g.....',
  '..s.......',
  '..s..s....',
  '.ss..s....',
  '.ss.ss....',
  '.ssssss...',
], { g: Ink.NearGrainGold, s: Ink.NearStalkShadow }), [
  { x: 0, y: 0, width: 10, height: 10, pivot: { x: 5, y: 10 } },
  { x: 0, y: 10, width: 10, height: 10, pivot: { x: 5, y: 10 } },
  { x: 0, y: 20, width: 10, height: 10, pivot: { x: 5, y: 10 } },
])

/**
 * Soaring mountain birds (8×5, 4 wing-flap poses).
 */
const birdSheet = createSpriteSheet(parseSprite([
  'b......b',
  '.b....b.',
  '..b..b..',
  '...bb...',
  '...bb...',

  '........',
  'bb....bb',
  '.bb..bb.',
  '..bbbb..',
  '...bb...',

  '........',
  '...bb...',
  '..bbbb..',
  '.b.bb.b.',
  'b......b',

  '........',
  '.b....b.',
  '..bbbb..',
  '...bb...',
  '....b...',
], { b: Ink.Bird }), [
  { x: 0, y: 0, width: 8, height: 5, pivot: { x: 4, y: 2 } },
  { x: 0, y: 5, width: 8, height: 5, pivot: { x: 4, y: 2 } },
  { x: 0, y: 10, width: 8, height: 5, pivot: { x: 4, y: 2 } },
  { x: 0, y: 15, width: 8, height: 5, pivot: { x: 4, y: 2 } },
])

function drawSky(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'sky', z: 0 }, () => {
    const skyHeight = Math.floor(h * 0.38)
    const boundaries = [
      Math.floor(skyHeight * 0.28),
      Math.floor(skyHeight * 0.58),
      Math.floor(skyHeight * 0.84),
    ]

    for (let y = 0; y < skyHeight; y++) {
      let band = 3
      if (y < boundaries[0]!) band = 0
      else if (y < boundaries[1]!) band = 1
      else if (y < boundaries[2]!) band = 2

      // Keep dither seams narrow (<= 4px total) so sky remains clean and legible
      let seam = -1
      for (let b = 0; b < boundaries.length; b++) {
        const edge = boundaries[b]!
        if (Math.abs(y - edge) <= 2) {
          seam = b
          break
        }
      }

      if (seam >= 0) {
        const edge = boundaries[seam]!
        const t = (y - (edge - 2)) / 4
        for (let x = 0; x < w; x++) {
          ctx.px(x, y, ctx.dither(x, y, t, seam, seam + 1, 4))
        }
      } else {
        ctx.rect(0, y, w, 1, band)
      }
    }

    // Celestial body: sun/moon in upper-left sky
    const cx = Math.floor(w * 0.20)
    const cy = Math.floor(h * 0.18)
    const radius = Math.max(4, Math.floor(h * 0.038))
    ctx.disc(cx, cy, radius + 2, Ink.SunHalo)
    ctx.disc(cx, cy, radius, Ink.SunMoon)
  })
}

type Pt = { x: number; y: number }

/** Share of interior paddy pixels that start a rice tuft (average tuft ~3px gives ~12% coverage). */
const TUFT_START = 0.04
/** Each terrace step is taller than the one above it: perspective from far to near. */
const TREAD_GROWTH = 1.22
/** Riser (shadowed soil face) height relative to its tread. */
const RISER_RATIO = 0.22

interface TierSpec {
  readonly x0: number
  readonly x1: number
  /** Crest y before the bow and tilt are applied. */
  readonly yTop: number
  /** Approximate toe y; tread heights are scaled to fit between crest and toe. */
  readonly yBot: number
  readonly steps: number
  /** px the contour bows down at the centre (positive = convex hill, negative = valley floor). */
  readonly bow: number
  /** px drop from left to right; a positive value cascades down toward the valley. */
  readonly tilt: number
  /** Band indexes that are flooded paddies. */
  readonly water: readonly number[]
  readonly seed: number
}

/** Left hill cascade, central valley terraces, right hill carrying the stilt house. */
const TIERS: readonly TierSpec[] = [
  { x0: 0, x1: 222, yTop: 104, yBot: 226, steps: 8, bow: 14, tilt: 16, water: [], seed: 1.3 },
  { x0: 116, x1: 344, yTop: 124, yBot: 262, steps: 9, bow: -8, tilt: 6, water: [4, 7], seed: 4.1 },
  { x0: 226, x1: 480, yTop: 116, yBot: 236, steps: 7, bow: 16, tilt: -10, water: [1], seed: 7.7 },
]

/** Canal centreline knots, from the top of the valley down to the bottom edge. */
const STREAM_KNOTS: readonly Pt[] = [
  { x: 256, y: 116 }, { x: 254, y: 124 }, { x: 268, y: 134 }, { x: 286, y: 150 },
  { x: 272, y: 168 }, { x: 252, y: 186 }, { x: 262, y: 204 }, { x: 250, y: 222 },
  { x: 236, y: 242 }, { x: 238, y: 262 }, { x: 246, y: 276 },
]

/** Footpath knots in the lower-right foreground. */
const PATH_KNOTS: readonly Pt[] = [
  { x: 392, y: 276 }, { x: 410, y: 246 }, { x: 436, y: 226 }, { x: 478, y: 214 },
]

/** Catmull-Rom samples through the knots, `perSegment` samples per knot pair. */
function splineSamples(knots: readonly Pt[], perSegment: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < knots.length - 1; i++) {
    const p0 = knots[Math.max(0, i - 1)]!
    const p1 = knots[i]!
    const p2 = knots[i + 1]!
    const p3 = knots[Math.min(knots.length - 1, i + 2)]!
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment
      const t2 = t * t
      const t3 = t2 * t
      const at = (a: number, b: number, c: number, d: number): number =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push({ x: at(p0.x, p1.x, p2.x, p3.x), y: at(p0.y, p1.y, p2.y, p3.y) })
    }
  }
  out.push(knots[knots.length - 1]!)
  return out
}

/** Fills a tapered ribbon along a centreline; halfWidth receives 0..1 along the line. */
function drawRibbon(ctx: BuildCtx, centre: readonly Pt[], halfWidth: (t: number) => number, index: number): void {
  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i < centre.length; i++) {
    const a = centre[Math.max(0, i - 1)]!
    const b = centre[Math.min(centre.length - 1, i + 1)]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const hw = halfWidth(i / (centre.length - 1))
    const c = centre[i]!
    left.push({ x: Math.round(c.x + nx * hw), y: Math.round(c.y + ny * hw) })
    right.push({ x: Math.round(c.x - nx * hw), y: Math.round(c.y - ny * hw) })
  }
  ctx.polygon([...left, ...right.reverse()], index)
}

/** Smooth ridge crest: two low-frequency sines plus baked noise, never per-column stripes. */
function ridgeCrest(ctx: BuildCtx, base: number, amp: number, phase: number, seed: number): Pt[] {
  const { width: w, height: h } = ctx
  const crest: Pt[] = []
  for (let x = 0; x <= w; x += 2) {
    const wobble = ctx.fbm2(x * 0.011, seed) - 0.5
    const y = h * base + amp * (Math.sin(x * 0.019 + phase) * 0.7 + Math.sin(x * 0.047 + phase * 1.7) * 0.3) + wobble * amp * 1.6
    crest.push({ x, y: Math.round(y) })
  }
  return crest
}

/** A ridge is a flat body plus a 2px lit rim under its crest. */
function fillRidge(ctx: BuildCtx, crest: readonly Pt[], body: number, rim: number): void {
  const { width: w, height: h } = ctx
  ctx.polygon([...crest, { x: w, y: h }, { x: 0, y: h }], body)
  ctx.polygon([...crest, ...crest.slice().reverse().map((p) => ({ x: p.x, y: p.y + 2 }))], rim)
}

function drawRidges(ctx: BuildCtx): void {
  ctx.layer({ kind: 'far', z: 1 }, () => {
    // Far ridge: pale and low contrast, sits in the atmospheric haze.
    fillRidge(ctx, ridgeCrest(ctx, 0.255, 7, 0.6, 3), Ink.Ridge1Shadow, Ink.Ridge1Lit)
    // Mid ridge: darker, overlaps the far crest and anchors the valley.
    fillRidge(ctx, ridgeCrest(ctx, 0.315, 6, 2.4, 57), Ink.Ridge2Shadow, Ink.Ridge2Lit)
  })
}

function drawHillBase(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'mid', z: 3 }, () => {
    ctx.polygon([
      { x: 0, y: Math.floor(h * 0.40) },
      { x: w, y: Math.floor(h * 0.42) },
      { x: w, y: h },
      { x: 0, y: h },
    ], Ink.RiceShadow)
  })
}

/**
 * One contour family: the top edge comes from a smile-shaped hill contour, the tread height grows
 * with perspective, and both edges taper where the hill ends. Each band is integer-stepped from the
 * one above it, so bands cannot cross.
 */
function drawTerraceTier(ctx: BuildCtx, spec: TierSpec): void {
  const span = spec.x1 - spec.x0
  const weights = Array.from({ length: spec.steps }, (_, k) => TREAD_GROWTH ** k)
  const total = weights.reduce((sum, wgt) => sum + wgt * (1 + RISER_RATIO), 0)
  const scale = (spec.yBot - spec.yTop) / total

  let top: number[] = []
  for (let x = spec.x0; x <= spec.x1; x++) {
    const u = (x - spec.x0) / span
    const smile = 1 - (2 * u - 1) ** 2
    top.push(Math.round(spec.yTop + spec.bow * smile + spec.tilt * u))
  }

  for (let k = 0; k < spec.steps; k++) {
    const bottom: number[] = []
    const next: number[] = []
    const weight = weights[k]!
    for (let i = 0; i < top.length; i++) {
      const u = i / (top.length - 1)
      const taper = Math.min(1, 0.35 + 1.3 * Math.sin(Math.PI * u))
      const wobble = 0.72 + 0.56 * ctx.fbm2(u * 1.6 + spec.seed, k * 1.9)
      const tread = Math.max(1, Math.round(scale * weight * taper * wobble))
      const riser = Math.max(1, Math.round(scale * weight * RISER_RATIO * taper))
      bottom.push(top[i]! + tread)
      next.push(top[i]! + tread + riser)
    }
    // Upper contours are shorter and lower ones wider, so each band ends where the hill curves away.
    const f = spec.steps > 1 ? k / (spec.steps - 1) : 0
    const insetL = Math.round(span * 0.14 * (1 - f) + (ctx.fbm2(spec.seed + k * 0.8, 9) - 0.5) * 8)
    const insetR = Math.round(span * 0.10 * (1 - f) + (ctx.fbm2(spec.seed + k * 0.8, 21) - 0.5) * 8)
    const lo = Math.max(0, insetL)
    const hi = Math.min(top.length - 1, top.length - 1 - Math.max(0, insetR))
    if (hi - lo >= 6) drawBand(ctx, spec, k, lo, hi, top, bottom, next)
    top = next
  }
}

function drawBand(ctx: BuildCtx, spec: TierSpec, k: number, lo: number, hi: number, topAll: readonly number[], bottomAll: readonly number[], nextAll: readonly number[]): void {
  const top = topAll.slice(lo, hi + 1)
  const bottom = bottomAll.slice(lo, hi + 1)
  const next = nextAll.slice(lo, hi + 1)
  const xs = top.map((_, i) => spec.x0 + lo + i)
  const isWater = spec.water.includes(k)
  const body = isWater ? Ink.TerraceWater : k % 4 === 1 ? Ink.RiceMid : Ink.RiceRipeGold

  ctx.polygon([
    ...xs.map((x, i) => ({ x, y: top[i]! })),
    ...xs.map((x, i) => ({ x, y: bottom[i]! })).reverse(),
  ], body)
  ctx.polygon([
    ...xs.map((x, i) => ({ x, y: bottom[i]! })),
    ...xs.map((x, i) => ({ x, y: next[i]! })).reverse(),
  ], Ink.DikeShadow)

  // Lit top lip: sunlight catches the crest of each step; flooded paddies show a sky reflection.
  for (let i = 0; i < xs.length; i++) ctx.px(xs[i]!, top[i]!, isWater ? Ink.SkyMid : Ink.RiceSunlitTip)

  if (isWater) {
    // Broken highlights: short glints scattered over the water, never a continuous line.
    for (let i = 0; i < xs.length; i++) {
      for (let y = top[i]! + 2; y < bottom[i]!; y++) {
        if (ctx.rng() >= 0.05) continue
        const len = 2 + Math.floor(ctx.rng() * 4)
        for (let d = 0; d < len && i + d < xs.length; d++) {
          if (y >= bottom[i + d]! || y < top[i + d]! + 2) break
          ctx.px(xs[i + d]!, y, Ink.StreamGlint)
        }
      }
    }
    return
  }

  // Rice tufts: one-row horizontal strokes of 2–4px, about 12% of the paddy pixels.
  for (let i = 0; i < xs.length; i++) {
    for (let y = top[i]! + 1; y < bottom[i]!; y++) {
      if (ctx.rng() >= TUFT_START) continue
      const len = 2 + Math.floor(ctx.rng() * 3)
      const tuft = ctx.rng() < 0.55 ? Ink.RiceShadow : Ink.RiceSunlitTip
      for (let d = 0; d < len && i + d < xs.length; d++) {
        if (y < top[i + d]! + 1 || y >= bottom[i + d]!) break
        ctx.px(xs[i + d]!, y, tuft)
      }
    }
  }
}

function drawTerraceCascade(ctx: BuildCtx): void {
  ctx.layer({ kind: 'mid', z: 3 }, () => {
    for (const tier of TIERS) drawTerraceTier(ctx, tier)
  })
}

const STREAM = splineSamples(STREAM_KNOTS, 6)

function drawMeanderingStream(ctx: BuildCtx): void {
  ctx.layer({ kind: 'water', z: 4 }, () => {
    // Moist earth bank first, then the water ribbon narrowing toward the top of the valley.
    drawRibbon(ctx, STREAM, (t) => 1.6 + 1.2 * t, Ink.StreamBank)
    drawRibbon(ctx, STREAM, (t) => 0.7 + 1.1 * t, Ink.StreamDeep)
  })
}

function houseOriginX(w: number): number {
  return Math.floor(w * 0.78 - 18)
}

function houseOriginY(h: number): number {
  return Math.floor(h * 0.58 - 13)
}

function drawStiltHouse(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'mid', z: 4 }, () => {
    ctx.sprite(houseSprite, houseOriginX(w), houseOriginY(h))
  })
}

const PATH = splineSamples(PATH_KNOTS, 8)

function drawForeground(ctx: BuildCtx): void {
  ctx.layer({ kind: 'near', z: 5 }, () => {
    // Curving earthen footpath: a tapered ribbon, not a slab.
    drawRibbon(ctx, PATH, (t) => 4.2 - 2.2 * t, Ink.NearPath)
  })
}

const scene: SceneDef = {
  id: 'vn-mu-cang-chai',
  name: { en: 'Mù Cang Chải Rice Terraces', vi: 'Ruộng bậc thang Mù Cang Chải' },
  region: 'vn',
  tone: 'both',
  palettes: light,
  themePalettes,
  defaultTime: 'day',
  themeDefaultTime: { light: 'day', dark: 'dusk' },
  horizon: 0.37,
  focus: { x: 0.78, y: 0.58 },

  build(ctx) {
    drawSky(ctx)
    drawRidges(ctx)
    drawHillBase(ctx)
    drawTerraceCascade(ctx)
    drawMeanderingStream(ctx)
    drawStiltHouse(ctx)
    drawForeground(ctx)
  },

  frame(ctx: FrameCtx, t: number) {
    const { width: w, height: h } = ctx
    const night = darkness(ctx.time)

    // 1. Two-tier drifting valley mist ribbons (0.2 px/s and 0.15 px/s)
    ctx.layer({ kind: 'fog', z: 2 }, () => {
      const mistOffset1 = Math.floor(t * 0.20 * 12) % 36
      const mistOffset2 = Math.floor(t * 0.15 * 12) % 40
      const startX = Math.floor(w * 0.36)
      const endX = Math.floor(w * 0.72)

      // Haze patches sit on the ridge base in a ridge tone, so they blend rather than read as dashes.
      for (let x = startX; x < endX; x += 8) {
        const sampleX = (x + mistOffset1) * 0.05
        const y = Math.floor(h * (0.365 + Math.sin(sampleX) * 0.010))
        const n = ctx.fbm2(sampleX, 42)
        if (n > 0.5) ctx.rect(x, y, 10 + Math.floor((n - 0.5) * 60), 2, Ink.Ridge1Lit)
      }

      for (let x = startX + 12; x < endX - 8; x += 9) {
        const sampleX = (x + mistOffset2) * 0.04
        const y = Math.floor(h * (0.385 + Math.cos(sampleX) * 0.008))
        const n = ctx.fbm2(sampleX, 79)
        if (n > 0.52) ctx.rect(x, y, 10 + Math.floor((n - 0.52) * 60), 2, Ink.Ridge1Lit)
      }
    })

    // 2. Fx: canal glints drift downstream, stepping through 9 positions along the centreline.
    ctx.layer({ kind: 'fx', z: 5 }, () => {
      const phase = Math.floor(t * 6) % 9
      for (let i = 0; i < STREAM.length; i++) {
        if ((i + phase) % 9 !== 0) continue
        const c = STREAM[i]!
        const x = Math.round(c.x)
        const y = Math.round(c.y)
        ctx.line(x - 1, y, x + 1, y, Ink.StreamGlint)
      }

      // 3. Swaying foreground golden rice tufts (3 poses at 2fps, varied phase offsets)
      const riceClumps = 12
      for (let i = 0; i < riceClumps; i++) {
        const pose = Math.floor(t * 2 + i * 0.6) % 3
        const rx = Math.floor(w * (0.84 + (i % 4) * 0.035))
        const ry = Math.floor(h * (0.80 + Math.floor(i / 4) * 0.065))
        ctx.spriteFrame(riceSheet, pose, rx, ry, 1)
      }

      // 4. Soaring mountain birds across the sky (4 poses at 6fps, banking flight)
      const birdSpeed = (Math.floor(t * 13) % (w + 40)) - 20
      const birdPose = Math.floor(t * 6) % 4
      const birdY1 = Math.floor(h * 0.20 + Math.sin(t * 1.3) * 3)
      const birdY2 = Math.floor(h * 0.25 - Math.sin(t * 1.0) * 2)
      ctx.spriteFrame(birdSheet, birdPose, birdSpeed, birdY1, 1)
      ctx.spriteFrame(birdSheet, (birdPose + 2) % 4, birdSpeed - 26, birdY2, 1)

      // 5. Twilight / night: a few stars and a flickering lamp in the stilt-house window.
      if (night > 0.40) {
        const stars = [
          { u: 0.12, v: 0.08, phase: 0 },
          { u: 0.35, v: 0.12, phase: 1 },
          { u: 0.48, v: 0.06, phase: 2 },
          { u: 0.75, v: 0.10, phase: 0 },
          { u: 0.88, v: 0.14, phase: 1 },
        ]
        const twinkle = Math.floor(t * 2.5) % 3
        for (const star of stars) {
          if ((star.phase + twinkle) % 3 !== 0) {
            ctx.px(Math.floor(w * star.u), Math.floor(h * star.v), Ink.Bird)
          }
        }

        // The window glows amber; on the dim beat its interior drops to the halo ink.
        const hx = houseOriginX(w)
        const hy = houseOriginY(h)
        if (Math.sin(t * 3.5) <= 0.3) {
          for (let y = 12; y <= 14; y++) {
            for (const x of [21, 22, 24, 25, 26]) ctx.px(hx + x, hy + y, Ink.WindowHalo)
          }
        }
      }
    })
  },
}

export default scene
