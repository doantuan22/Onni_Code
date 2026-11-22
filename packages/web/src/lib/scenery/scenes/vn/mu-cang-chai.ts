/**
 * vn-mu-cang-chai: Mù Cang Chải Rice Terraces (Yên Bái, Vietnam).
 *
 * Phase 2 Rewrite (Iteration 3):
 * - Curvilinear S-curve terrace cascade with non-linear perspective (3px far to 14px near).
 * - Multi-tiered 3D soil retaining dikes with 2-3px vertical drop shadows.
 * - Leveled mountain terrace knoll anchoring the 36×26 authentic H'Mong gabled stilt house.
 * - Natural meandering mountain stream with broken water shimmer (no ladder canal).
 * - Distinct Light (Golden Harvest Day) & Dark (Mountain Twilight Dusk) palettes.
 * - 32 dedicated palette roles for atmospheric depth and time-of-day progression.
 * - Multi-frame animated sprites: swaying foreground rice (3 poses), soaring birds (4 poses),
 *   drifting two-tier valley mist (0.2 px/s), and localized stream glints.
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
 * 36×26 Authentic H'Mong Gabled Stilt House (Nhà Sàn).
 * Features steep gabled thatch roof with deep overhanging eaves, exposed timber porch,
 * living floor beam, raised stilts with grounding contact shadow, and illuminated lantern window.
 */
const houseSprite = parseSprite([
  '.........RRRRRRRRRRRRRRRRRR.........',
  '.......RRRRRRRRRRRRRRRRRRRRRR.......',
  '......RRRRRRRRRRRRRRRRRRRRRRRR......',
  '.....RRRRRRRRRRRRRRRRRRRRRRRRRR.....',
  '....rrrrRRRRRRRRRRRRRRRRRRRRrrrr....',
  '...RRRRRRRRRRRRRRRRRRRRRRRRRRRRRR...',
  '..RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR..',
  '.RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR.',
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
  '.rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr.',
  '..rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..',
  '.....WWWWWWWWWWWWWWWWWWWWWWWWWW.....',
  '.....Ww..wWWWWWWWWWWWWWWWWWWWWW.....',
  '.....Ww..wWWggggWWWWWWDDDDWWWWW.....',
  '.....Ww..wWWgGGgWWWWWWDDDDWWWWW.....',
  '.....WwwwwWWgGGgWWWWWWDDDDWWWWW.....',
  '.....Ww..wWWggggWWWWWWDDDDWWWWW.....',
  '.....Ww..wWWWWWWWWWWWWDDDDWWWWW.....',
  '....wwwwwwwwwwwwwwwwwwwwwwwwwwww....',
  '.....WW....WW......WW....WW..ww.....',
  '.....WW....WW......WW....WW...ww....',
  '.....WW....WW..ww..WW....WW....ww...',
  '.....WW....WW......WW....WW.....ww..',
  '.....WW....WW......WW....WW......ww.',
  '.....WW....WW......WW....WW.......ww',
  '....SSSS..SSSS....SSSS..SSSS....SSSS',
], {
  R: Ink.ThatchLit,
  r: Ink.ThatchShadow,
  W: Ink.TimberDark,
  w: Ink.TimberLit,
  G: Ink.WindowGlow,
  g: Ink.WindowHalo,
  D: Ink.TimberDark,
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

function drawRidges(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'far', z: 1 }, () => {
    // Ridge 1: Far hazy mountain crest
    for (let x = 0; x < w; x++) {
      const ny = ctx.fbm2(x * 0.015, 23)
      const top = Math.floor(h * (0.28 + (ny - 0.5) * 0.08 + Math.sin(x * 0.024 + 1.2) * 0.028))
      const isLit = (x % 7 > 2) && (ny > 0.48)
      ctx.rect(x, top, 1, h - top, isLit ? Ink.Ridge1Lit : Ink.Ridge1Shadow)
    }

    // Ridge 2: Mid-distance mountain silhouette
    for (let x = 0; x < w; x++) {
      const ny = ctx.fbm2(x * 0.022, 57)
      const top = Math.floor(h * (0.35 + (ny - 0.5) * 0.09 + Math.cos(x * 0.028) * 0.024))
      const isLit = (x % 5 > 1) && (ny > 0.46)
      ctx.rect(x, top, 1, h - top, isLit ? Ink.Ridge2Lit : Ink.Ridge2Shadow)
    }
  })
}

/**
 * Builds a curvilinear terrace tier with 3D soil retaining dikes,
 * non-linear perspective step heights (3px far to 14px near), vertical drop shadows,
 * and delicate rice stalk stippling.
 */
function drawCurvilinearTerraceTier(
  ctx: BuildCtx,
  xLeft: number,
  xRight: number,
  yStart: number,
  yEnd: number,
  steps: number,
  curveAmp: number,
  seed: number,
  hasWater = false,
): void {
  const { width: w, height: h } = ctx
  const x0 = Math.floor(w * xLeft)
  const x1 = Math.floor(w * xRight)
  const spanX = Math.max(1, x1 - x0)

  for (let s = 0; s < steps; s++) {
    // Non-linear power curve for realistic perspective scale (narrower far, wider near)
    const t0 = Math.pow(s / steps, 1.45)
    const t1 = Math.pow((s + 1) / steps, 1.45)
    const stepY0 = h * (yStart + (yEnd - yStart) * t0)
    const stepY1 = h * (yStart + (yEnd - yStart) * t1)

    // Contour curve across the basin
    const curve: { x: number; y: number }[] = []
    const prevCurve: { x: number; y: number }[] = []
    const sampleCount = 28

    for (let i = 0; i <= sampleCount; i++) {
      const u = i / sampleCount
      const x = Math.floor(x0 + spanX * u)
      const bend = Math.sin(u * Math.PI) * (h * curveAmp) * (s % 2 === 0 ? 1 : 0.8)
      const noise = (ctx.fbm2(u * 3.8, seed + s * 1.6) - 0.5) * (h * 0.015)

      const yCur = Math.floor(stepY1 + bend + noise)
      const yPrev = Math.floor(stepY0 + bend * 0.82 + noise * 0.8)
      curve.push({ x, y: yCur })
      prevCurve.push({ x, y: yPrev })
    }

    // Fill terrace flat
    const polyPoints = [...prevCurve, ...curve.slice().reverse()]
    const isWaterStep = hasWater && (s % 3 === 1)
    const fillColor = isWaterStep ? Ink.TerraceWater : (s % 4 === 0 ? Ink.RiceMid : Ink.RiceRipeGold)
    ctx.polygon(polyPoints, fillColor)

    // Stipple rice texture (12-15% grain dots) on non-water flats
    if (!isWaterStep) {
      for (const pt of curve) {
        const x = pt.x
        const yTop = prevCurve.find((p) => p.x === x)?.y ?? (pt.y - 4)
        for (let y = yTop + 1; y < pt.y - 1; y++) {
          const stipple = ctx.fbm2(x * 0.18, y * 0.18)
          if (stipple > 0.44) ctx.px(x, y, Ink.RiceSunlitTip)
          else if (stipple < -0.42) ctx.px(x, y, Ink.RiceShadow)
        }
      }
    }

    // 2-3px Retaining Dike & Drop Shadow along the front edge (scaled with perspective)
    const shadowDepth = s >= 5 ? 2 : 1
    for (let i = 0; i < curve.length - 1; i++) {
      const p0 = curve[i]!
      const p1 = curve[i + 1]!
      ctx.line(p0.x, p0.y, p1.x, p1.y, Ink.DikeSoilLit)
      for (let d = 1; d <= shadowDepth; d++) {
        ctx.line(p0.x, p0.y + d, p1.x, p1.y + d, Ink.DikeShadow)
      }
    }
  }
}

function drawTerraceCascade(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'mid', z: 3 }, () => {
    // Fill valley backdrop
    ctx.polygon([
      { x: 0, y: Math.floor(h * 0.40) },
      { x: w, y: Math.floor(h * 0.43) },
      { x: w, y: h },
      { x: 0, y: h },
    ], Ink.RiceShadow)

    // Basin 1: Upper-left mountain cascade flowing down towards center
    drawCurvilinearTerraceTier(ctx, -0.04, 0.48, 0.40, 0.74, 7, -0.044, 13, false)

    // Basin 2: Central cascading amphitheater sweeping diagonally to lower center
    drawCurvilinearTerraceTier(ctx, 0.14, 0.74, 0.48, 0.95, 8, 0.052, 31, true)

    // Basin 3: Right hillside terrace promontory (supporting the H'Mong Stilt House)
    drawCurvilinearTerraceTier(ctx, 0.52, 1.05, 0.45, 0.88, 6, -0.038, 77, false)

    // Level terrace plateau under the H'Mong Stilt House knoll
    const hx = Math.floor(w * 0.78 - 18)
    const hy = Math.floor(h * 0.58 - 13)
    ctx.rect(hx - 4, hy + 24, 46, 3, Ink.RiceRipeGold)
    ctx.line(hx - 4, hy + 27, hx + 42, hy + 27, Ink.DikeSoilLit)
    ctx.line(hx - 4, hy + 28, hx + 42, hy + 28, Ink.DikeShadow)
  })
}

function drawMeanderingStream(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'water', z: 4 }, () => {
    // Natural continuous bezier stream winding through the valley
    // Split into two 4-point cubic bezier segments for smooth curvature
    const p0 = { x: Math.floor(w * 0.65), y: Math.floor(h * 0.49) }
    const p1 = { x: Math.floor(w * 0.62), y: Math.floor(h * 0.58) }
    const p2 = { x: Math.floor(w * 0.57), y: Math.floor(h * 0.68) }
    const p3 = { x: Math.floor(w * 0.54), y: Math.floor(h * 0.76) }

    const p4 = { x: Math.floor(w * 0.50), y: Math.floor(h * 0.84) }
    const p5 = { x: Math.floor(w * 0.58), y: Math.floor(h * 0.92) }
    const p6 = { x: Math.floor(w * 0.52), y: h }

    const seg1 = [p0, p1, p2, p3]
    const seg2 = [p3, p4, p5, p6]

    // Draw moist earth bank line and water channel
    ctx.curve(seg1.map((p) => ({ x: p.x + 1, y: p.y })), Ink.StreamBank)
    ctx.curve(seg2.map((p) => ({ x: p.x + 1, y: p.y })), Ink.StreamBank)

    ctx.curve(seg1, Ink.StreamDeep)
    ctx.curve(seg2, Ink.StreamDeep)

    // Lower segment widens as stream gathers mountain runoff
    ctx.curve(seg2.map((p) => ({ x: p.x - 1, y: p.y })), Ink.StreamDeep)
    ctx.curve(seg2.map((p) => ({ x: p.x - 2, y: p.y })), Ink.StreamDeep)
  })
}

function drawStiltHouse(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'mid', z: 4 }, () => {
    // Positioned in visible right gutter at u=0.74..0.82, v=0.53..0.63
    const hx = Math.floor(w * 0.78 - 18)
    const hy = Math.floor(h * 0.58 - 13)
    ctx.sprite(houseSprite, hx, hy)
  })
}

function drawForeground(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'near', z: 5 }, () => {
    // Lower-right foreground embankment & footpath
    ctx.polygon([
      { x: Math.floor(w * 0.78), y: h },
      { x: w, y: h },
      { x: w, y: Math.floor(h * 0.72) },
      { x: Math.floor(w * 0.88), y: Math.floor(h * 0.78) },
    ], Ink.RiceShadow)

    // Curving earthen footpath (quadratic bezier: 3 points)
    ctx.curve([
      { x: Math.floor(w * 0.79), y: h },
      { x: Math.floor(w * 0.88), y: Math.floor(h * 0.86) },
      { x: Math.floor(w * 0.95), y: Math.floor(h * 0.76) },
    ], Ink.NearPath)
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

      // Upper mist ribbon
      for (let x = startX; x < endX; x += 4) {
        const sampleX = (x + mistOffset1) * 0.05
        const y = Math.floor(h * (0.46 + Math.sin(sampleX) * 0.015))
        if (ctx.fbm2(sampleX, 42) > 0.32) {
          ctx.rect(x, y, 7, 2, Ink.ValleyMist)
        }
      }

      // Lower valley mist ribbon
      for (let x = startX + 16; x < endX - 8; x += 5) {
        const sampleX = (x + mistOffset2) * 0.04
        const y = Math.floor(h * (0.55 + Math.cos(sampleX) * 0.018))
        if (ctx.fbm2(sampleX, 79) > 0.34) {
          ctx.rect(x, y, 8, 2, Ink.ValleyMist)
        }
      }
    })

    // 2. Localized stream glints (broken shimmer following bezier curve, 6 phases, no ladder)
    ctx.layer({ kind: 'fx', z: 5 }, () => {
      const glintCycle = Math.floor(t * 4) % 6
      const glintPoints = [
        { u: 0.64, v: 0.52, phase: 0 },
        { u: 0.61, v: 0.60, phase: 2 },
        { u: 0.57, v: 0.69, phase: 4 },
        { u: 0.54, v: 0.77, phase: 1 },
        { u: 0.52, v: 0.85, phase: 3 },
        { u: 0.56, v: 0.94, phase: 5 },
      ] as const

      for (const pt of glintPoints) {
        if ((pt.phase + glintCycle) % 3 !== 1) {
          const gx = Math.floor(w * pt.u)
          const gy = Math.floor(h * pt.v)
          ctx.line(gx, gy, gx + 2, gy, Ink.StreamGlint)
        }
      }

      // 3. Swaying foreground golden rice tufts (3 poses at 2fps, varied phase offsets)
      const riceClumps = 12
      for (let i = 0; i < riceClumps; i++) {
        const phase = Math.floor(t * 2 + i * 0.6) % 3
        const rx = Math.floor(w * (0.83 + (i % 4) * 0.042))
        const ry = Math.floor(h * (0.78 + Math.floor(i / 4) * 0.072))
        ctx.spriteFrame(riceSheet, phase, rx, ry, 1)
      }

      // 4. Soaring mountain birds across the sky (4 poses at 6fps, banking flight)
      const birdSpeed = (Math.floor(t * 13) % (w + 40)) - 20
      const birdPose = Math.floor(t * 6) % 4
      const birdY1 = Math.floor(h * 0.20 + Math.sin(t * 1.3) * 3)
      const birdY2 = Math.floor(h * 0.25 - Math.sin(t * 1.0) * 2)
      ctx.spriteFrame(birdSheet, birdPose, birdSpeed, birdY1, 1)
      ctx.spriteFrame(birdSheet, (birdPose + 2) % 4, birdSpeed - 26, birdY2, 1)

      // 5. Twilight / Night effects: warm lantern flicker & starry sky
      if (night > 0.40) {
        // Subtle stars in the upper sky
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

        // Stepped warm lantern pulse spill on stilt house porch
        const hx = Math.floor(w * 0.78 - 18)
        const hy = Math.floor(h * 0.58 - 13)
        const pulse = Math.sin(t * 3.5) > 0.3
        if (pulse) {
          ctx.px(hx + 17, hy + 14, Ink.WindowGlow)
          ctx.px(hx + 18, hy + 14, Ink.WindowGlow)
          ctx.px(hx + 17, hy + 15, Ink.WindowGlow)
          ctx.px(hx + 18, hy + 15, Ink.WindowGlow)
        }
      }
    })
  },
}

export default scene
