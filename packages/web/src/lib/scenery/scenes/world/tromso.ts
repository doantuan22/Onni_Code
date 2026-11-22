import { createSpriteSheet, parseSprite } from '../../engine/sprite'
import type { BuildCtx, FrameCtx, LayerSpec, Palettes, SceneDef, ThemePalettes } from '../../engine/types'

/**
 * Reference (§3.7): winter night over Tromsø: morphing ribbons of emerald and
 * violet aurora hang above snow-dusted fjord peaks; below, a warm red rorbu
 * cabin on stilts perches at the water's edge, puffing chimney smoke into the still air.
 * The fjord mirrors the aurora and window light as broken jade and gold paths.
 * In the daytime polar theme, soft ice cirrus clouds drift through the crisp sky.
 *
 * 32 Palette Roles:
 * 0..3:   Sky (zenith to horizon gradient)
 * 4..6:   Stars, moon / winter sun
 * 7..9:   Aurora ribbons (outer glow, body emerald, core aqua) / daytime cirrus clouds
 * 10..12: Far mountain ridge (shadow, body, snow crest)
 * 13..15: Mid mountain headland (deep crag, snow slope, sunlit/rim snow)
 * 16..21: Fjord water (deep abyss, body water, wave surface, aurora sheen, bright reflection, glint/foam)
 * 22..24: Rorbu cabin (red timber wall, warm window light, snow-covered roof)
 * 25..27: Chimney smoke (soft puff, mid smoke, light smoke)
 * 28..29: Near shoreline & dock posts (dark rocky shore/posts, foreground snow rim)
 * 30..31: Snow particles (distant small flake, near bright flake)
 */

export const tromsoThemePalettes: ThemePalettes = {
  light: {
    dawn: [
      0x3c4e68, 0x596d85, 0x8a7c93, 0xdfc5b2,
      0xb0c0d0, 0xd0e0ee, 0xffe4c8,
      0xc8d8e6, 0xb0c8dc, 0xa0bad2,
      0x324860, 0x5c7590, 0xc8dae5,
      0x273a50, 0x48627c, 0xdce8ef,
      0x28425b, 0x3b5874, 0x537590, 0x6e92ab, 0x8eb2c8, 0xb8d4e4,
      0x7c3830, 0xe8a860, 0xe2ecf2,
      0xb0c2d0, 0x98adc0, 0x8096aa,
      0x1e2e3f, 0xcce0ec,
      0xd0e2ee, 0xffffff,
    ],
    day: [
      0xafc8d7, 0xbfd5e2, 0xcedee8, 0xdde1dc,
      0xdde8f0, 0xe8f0f6, 0xfff0db,
      0xc8dce8, 0xb8d0e0, 0xa8c4d8,
      0x40586e, 0x627e95, 0xd5e2e6,
      0x334a5e, 0x4e677d, 0xe5edf2,
      0x395c73, 0x4c6f87, 0x557d96, 0x749cb3, 0x98bece, 0xb4ccd2,
      0x8c362a, 0xf0ba72, 0xeef4f7,
      0xc4d6e2, 0xacc2d0, 0x92aabe,
      0x253646, 0xdae7ed,
      0xe0ecf4, 0xffffff,
    ],
    dusk: [
      0x172342, 0x293b61, 0x405280, 0x59658d,
      0xa8b4cc, 0xc8d4ec, 0xfcd2a2,
      0x56a28e, 0x7cb8a4, 0x8ea2be,
      0x223348, 0x445970, 0x98aab8,
      0x1a283a, 0x364b60, 0xb2c2ce,
      0x1e324a, 0x2f4862, 0x44617c, 0x5f7f9b, 0x82a2bc, 0xafc6d8,
      0x722c26, 0xe69d50, 0xb8cad6,
      0x8a94a6, 0x727e92, 0x5c687c,
      0x14202e, 0xa8bac8,
      0xc0d2e4, 0xffffff,
    ],
    night: [
      0x111d36, 0x182846, 0x203454, 0x294460,
      0x7a94b8, 0xbcd4f4, 0xe8f2ff,
      0x48a882, 0x6ebe9c, 0x8e82ae,
      0x142234, 0x23394f, 0x668296,
      0x0f1b2b, 0x1a2c40, 0x829cad,
      0x122438, 0x1c344c, 0x2b4b6a, 0x3c6b75, 0x4c8b87, 0x7eb8aa,
      0x5e201c, 0xe3b576, 0x8aa2b4,
      0x485c70, 0x36485a, 0x273748,
      0x0c1522, 0x728c9e,
      0x94b2cc, 0xe4f0fc,
    ],
  },
  dark: {
    dawn: [
      0x202c46, 0x3b3a58, 0x6d546b, 0xaa7872,
      0x8296b4, 0xb4cce8, 0xf0be92,
      0x429a80, 0x5eb296, 0x7a7ca2,
      0x1a293c, 0x2e445b, 0x7d96a8,
      0x122030, 0x22354a, 0x9db4c4,
      0x16283d, 0x223c56, 0x325270, 0x46707c, 0x58928d, 0x84b8aa,
      0x5c2420, 0xe2a85e, 0x96adc0,
      0x44566a, 0x344456, 0x243444,
      0x0e1824, 0x829cb0,
      0x9eb6ce, 0xe2f0fc,
    ],
    day: [
      0x385268, 0x4c6b84, 0x6688a2, 0x88a8be,
      0xa6c4dc, 0xd0e4f4, 0xfff2dc,
      0x7698b0, 0x6688a0, 0x567890,
      0x273d52, 0x3e5a73, 0x8caabb,
      0x1c3042, 0x30485e, 0xa8c4d4,
      0x223b50, 0x304f6a, 0x426884, 0x5a859e, 0x7aa4ba, 0x9ec2d4,
      0x6c2a24, 0xe8b26c, 0xa8c4d4,
      0x5a7084, 0x465c6e, 0x34485a,
      0x142230, 0x90acbe,
      0xb2ccde, 0xf0f6fc,
    ],
    dusk: [
      0x101a35, 0x203454, 0x3b4b78, 0x4d5f87,
      0x7a8ca8, 0xa8bcd8, 0xf0a880,
      0x429e84, 0x62be9e, 0x7c729c,
      0x162436, 0x273c52, 0x6a8498,
      0x101b2a, 0x1d2f42, 0x849eb2,
      0x132438, 0x1e3650, 0x2d4c68, 0x416b75, 0x528a86, 0x7cb4a4,
      0x541e1a, 0xe2a056, 0x849eb2,
      0x405062, 0x303e4e, 0x222e3c,
      0x0a121c, 0x6c869a,
      0x8ea6be, 0xd8e8f8,
    ],
    night: [
      0x0d172e, 0x111d36, 0x1b2e4c, 0x294460,
      0x62789e, 0x9eb8dc, 0xd4e8ff,
      0x48a682, 0x6ebe9c, 0x8e82ae,
      0x101c2c, 0x23394f, 0x5c778c,
      0x0a1320, 0x18273a, 0x829cad,
      0x0e1c2e, 0x1c344c, 0x264664, 0x386872, 0x4c8b87, 0x76b4a4,
      0x4c1816, 0xe3b576, 0x768e9e,
      0x384656, 0x283644, 0x1a2430,
      0x080e18, 0x60788a,
      0x849eb6, 0xd0e4f4,
    ],
  },
}

export const tromsoPalettes: Palettes = tromsoThemePalettes.dark

const layers: readonly LayerSpec[] = [
  { kind: 'sky', z: 0 },
  { kind: 'fx', z: 1 },
  { kind: 'far', z: 2 },
  { kind: 'mid', z: 3 },
  { kind: 'water', z: 4 },
  { kind: 'near', z: 5 },
  { kind: 'fx', z: 6 },
]

// Animated chimney smoke: 4 distinct 12×12 poses puffing upward at 2 fps.
const smokeSheetRaw = parseSprite([
  '....cc......' + '....cc......' + '...ccc......' + '...ccc......',
  '...cccc.....' + '..cccccc....' + '..ccccc.....' + '..cccccc....',
  '..cccccc....' + '..cccccca...' + '..cccccc....' + '.cccccccc...',
  '..cccccc....' + '.cccccccc...' + '.ccccccc....' + '.cccccccca..',
  '..baaccc....' + '.caaccccc...' + '.caaacccc...' + 'ccaacccccc..',
  '...bbbaa....' + '..baaaccc...' + '..bbaaccc...' + '.ccbaacccc..',
  '....bbb.....' + '...bbbaaa...' + '...bbbaaa...' + '..cbbaacca..',
  '.....b......' + '....bbbb....' + '....bbbb....' + '...cbbbba...',
  '............' + '.....b......' + '.....bb.....' + '....bbbb....',
  '............' + '............' + '............' + '.....bb.....',
  '............' + '............' + '............' + '............',
  '............' + '............' + '............' + '............',
], { a: 25, b: 26, c: 27 })

const smokeSheet = createSpriteSheet(smokeSheetRaw, [
  { x: 0, y: 0, width: 12, height: 12, pivot: { x: 5, y: 11 }, duration: 0.5 },
  { x: 12, y: 0, width: 12, height: 12, pivot: { x: 5, y: 11 }, duration: 0.5 },
  { x: 24, y: 0, width: 12, height: 12, pivot: { x: 5, y: 11 }, duration: 0.5 },
  { x: 36, y: 0, width: 12, height: 12, pivot: { x: 5, y: 11 }, duration: 0.5 },
])

// Cabin static art (24×18 pixels) with pitched snowy roof, red timber walls, warm lit window, and foundation stilts
const cabinSprite = parseSprite([
  '..........ssss..........',
  '........ssssssss........',
  '......ssssssssssss......',
  '....ssssssssssssssss....',
  '..ssssssssssssssssssss..',
  'ssssssssssssssssssssssss',
  '..wwwwwwwwwwwwwwwwwwww..',
  '..wwwwwwwwwwwwwwwwwwww..',
  '..wwwwwwyyywwwwwwwwwww..',
  '..wwwwwwyyywwwwwwwwwww..',
  '..wwwwwwyyywwwwwwwwwww..',
  '..wwwwwwwwwwwwwwwwwwww..',
  '..wwwwwwwwwwwwwwwwwwww..',
  '..wwwwwwwwwwwwwwwwwwww..',
  '..wwwwwwwwwwwwwwwwwwww..',
  '..b..b....b....b....b...',
  '..b..b....b....b....b...',
  '..b..b....b....b....b...',
], { w: 22, y: 23, s: 24, b: 28 })

const STARS = [
  { u: 0.05, v: 0.07, bright: true },
  { u: 0.12, v: 0.15, bright: false },
  { u: 0.18, v: 0.05, bright: false },
  { u: 0.22, v: 0.18, bright: true },
  { u: 0.28, v: 0.08, bright: false },
  { u: 0.35, v: 0.12, bright: false },
  { u: 0.39, v: 0.04, bright: true },
  { u: 0.46, v: 0.16, bright: false },
  { u: 0.52, v: 0.06, bright: false },
  { u: 0.58, v: 0.14, bright: true },
  { u: 0.65, v: 0.05, bright: false },
  { u: 0.71, v: 0.11, bright: true },
  { u: 0.77, v: 0.07, bright: false },
  { u: 0.83, v: 0.15, bright: false },
  { u: 0.89, v: 0.09, bright: true },
  { u: 0.94, v: 0.17, bright: false },
  { u: 0.08, v: 0.24, bright: false },
  { u: 0.15, v: 0.28, bright: true },
  { u: 0.25, v: 0.26, bright: false },
  { u: 0.33, v: 0.22, bright: false },
  { u: 0.42, v: 0.25, bright: true },
  { u: 0.50, v: 0.21, bright: false },
  { u: 0.62, v: 0.24, bright: false },
  { u: 0.75, v: 0.23, bright: false },
  { u: 0.86, v: 0.26, bright: true },
  { u: 0.92, v: 0.28, bright: false },
] as const

function drawFarRidge(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx
  const waterLevel = Math.floor(h * 0.65)

  for (let x = 0; x < w; x++) {
    const u = x / w
    const p1 = Math.max(0, 0.16 - Math.abs(u - 0.17) * 0.72)
    const p2 = Math.max(0, 0.22 - Math.abs(u - 0.39) * 1.04)
    const p3 = Math.max(0, 0.13 - Math.abs(u - 0.59) * 0.80)
    const ridgeNoise = (ctx.fbm1(u * 42 + 12) - 0.5) * 0.022
    const profile = 0.65 - (p1 + p2 + p3) + ridgeNoise
    const top = Math.floor(profile * h)

    for (let y = top; y < waterLevel; y++) {
      const v = y / h
      const depth = (y - top) / Math.max(1, waterLevel - top)
      const gully = ctx.fbm2(u * 30 + 7, v * 18 + 5)
      const isLitSide = Math.sin(u * 27) + (gully - 0.5) * 1.8 > 0.18
      let ink = 10 // Shadow rock
      if (y === top || (depth < 0.12 && isLitSide)) {
        ink = 12 // Snow crest
      } else if ((depth < 0.38 && isLitSide) || (depth < 0.20 && gully > 0.45)) {
        ink = 11 // Snow face
      } else if (gully > 0.72 && depth < 0.46) {
        ink = 11
      }
      ctx.px(x, y, ink)
    }
  }
}

function drawMidRidgeAndCabin(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx
  const waterLevel = Math.floor(h * 0.67)

  for (let x = Math.floor(w * 0.56); x < w; x++) {
    const u = x / w
    const ramp = (u - 0.56) / 0.44
    const cragShape = (ctx.fbm1(u * 28 + 80) - 0.5) * 0.035
    const shoulder = Math.max(0, 0.065 - Math.abs(u - 0.76) * 0.55)
    const profile = 0.67 - (ramp ** 1.18) * 0.25 - shoulder + cragShape
    const top = Math.floor(profile * h)

    for (let y = top; y < waterLevel; y++) {
      const v = y / h
      const depth = (y - top) / Math.max(1, waterLevel - top)
      const rockTexture = ctx.fbm2(u * 26 + 120, v * 24 + 50)
      const isRim = y <= top + 1
      const diagonal = Math.floor((y - top) - (u - 0.56) * h * 0.34)
      const isSnowLedge = diagonal % 18 < 3 && rockTexture > 0.46 && depth > 0.10

      let ink = 13 // Deep rock
      if (isRim) {
        ink = 15 // Sunlit rim
      } else if (isSnowLedge || (rockTexture > 0.66 && depth < 0.42)) {
        ink = 14 // Snow terrace
      } else if (rockTexture > 0.45) {
        ink = 14
      }
      ctx.px(x, y, ink)
    }
  }

  const scale = Math.max(1, Math.min(2, Math.floor(h / 150)))
  const cabinX = Math.floor(w * 0.83 - (cabinSprite.width * scale) / 2)
  const cabinY = Math.floor(h * 0.67 - cabinSprite.height * scale)
  ctx.sprite(cabinSprite, cabinX, cabinY, scale)
}

function drawNearShore(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx

  // Three overlapping granite boulders: cold shadow, slate midtone, and icy face
  // stay separate beneath their small snow caps.
  for (let x = 0; x < Math.floor(w * 0.34); x++) {
    const u = x / w
    const hump1 = Math.max(0, 0.17 - Math.abs(u - 0.09) * 1.35)
    const hump2 = Math.max(0, 0.12 - Math.abs(u - 0.21) * 1.62)
    const hump3 = Math.max(0, 0.075 - Math.abs(u - 0.31) * 1.9)
    const shoreCurve = 0.90 - (hump1 + hump2 + hump3) + (ctx.fbm1(u * 24 + 105) - 0.5) * 0.018
    const top = Math.floor(shoreCurve * h)

    for (let y = top; y < h; y++) {
      const v = y / h
      const boulderDist = Math.min(Math.abs(u - 0.09), Math.abs(u - 0.21), Math.abs(u - 0.31))
      const rockNoise = ctx.fbm2(u * 38 + 220, v * 30 + 120)
      const isSnowCap = (y - top) < 3 + Math.floor((1 - boulderDist * 8) * 4) && rockNoise > 0.31
      const isRim = y <= top + 1

      let ink = 28 // Deep coastal granite shadow
      if (isRim || isSnowCap) {
        ink = 29 // Snow cap on boulder
      } else if (rockNoise > 0.84 && (x + y) % 7 === 0) {
        ink = 29 // Sparse snow caught in granite seams
      } else if (rockNoise > 0.73) {
        ink = 26 // Icy lit granite plane
      } else if (rockNoise > 0.42) {
        ink = 27 // Blue-slate midtone
      }
      ctx.px(x, y, ink)
    }
  }

  // Wooden wharf pilings (cọc gỗ)
  const posts = [
    { u: 0.11, v: 0.75, height: 0.060 },
    { u: 0.20, v: 0.78, height: 0.065 },
    { u: 0.29, v: 0.81, height: 0.050 },
  ]
  for (const post of posts) {
    const px = Math.floor(w * post.u)
    const basePy = Math.floor(h * post.v)
    const topPy = Math.floor(h * (post.v - post.height))
    for (let y = topPy; y < basePy; y++) {
      ctx.px(px, y, 28)
      ctx.px(px + 1, y, 28)
    }
    ctx.px(px, topPy - 1, 29)
    ctx.px(px + 1, topPy - 1, 29)
  }
}

const tromso: SceneDef = {
  id: 'world-tromso',
  name: { en: 'Tromsø Aurora', vi: 'Cực quang Tromsø' },
  region: 'world',
  tone: 'both',
  defaultTime: 'night',
  themeDefaultTime: { light: 'day', dark: 'night' },
  horizon: 0.65,
  focus: { x: 0.70, y: 0.34 },
  palettes: tromsoPalettes,
  themePalettes: tromsoThemePalettes,
  layers,

  build(ctx: BuildCtx): void {
    const { width: w, height: h } = ctx
    const horizonY = Math.floor(h * 0.65)

    // 1. Sky gradient (Zenith to Horizon)
    for (let y = 0; y < horizonY; y++) {
      const v = y / horizonY
      for (let x = 0; x < w; x++) {
        ctx.px(x, y, ctx.dither(x, y, v * 0.92, 0, 3, 8))
      }
    }

    // 2. Stars
    for (const star of STARS) {
      const sx = Math.floor(star.u * w)
      const sy = Math.floor(star.v * h)
      if (sy < horizonY - 4) {
        ctx.px(sx, sy, star.bright ? 5 : 4)
      }
    }

    // 3. Far Alpine Mountain Ridge
    drawFarRidge(ctx)

    // 4. Mid Mountain Ridge & Nordic Cabin
    drawMidRidgeAndCabin(ctx)

    // 5. Base Fjord Water
    for (let y = horizonY; y < h; y++) {
      const depth = (y - horizonY) / Math.max(1, h - horizonY)
      for (let x = 0; x < w; x++) {
        ctx.px(x, y, ctx.dither(x, y, depth * 0.7, 16, 17, 4))
      }
    }

    // 6. Near Shoreline and Pier Posts
    drawNearShore(ctx)
  },

  frame(ctx: FrameCtx, t: number): void {
    const { width: w, height: h } = ctx
    const horizonY = Math.floor(h * 0.65)

    // Effect 1: three separately phased hanging curtains. Their sparse, dithered
    // vertical rays deliberately leave sky between them; the bright wavy hems make
    // the form read as fabric rather than a filled scallop.
    const auroraIntensityByX = new Uint8Array(w)
    const drawCurtain = (
      left: number,
      right: number,
      phase: number,
      top: number,
      hemBase: number,
      outerInk: number,
      bodyInk: number,
    ): void => {
      for (let x = Math.floor(w * left); x < Math.floor(w * right); x++) {
        const u = x / w
        const span = (u - left) / (right - left)
        const edge = Math.min(1, Math.min(span, 1 - span) * 8)
        const drift = t * 0.075
        const hem = hemBase
          + Math.sin(u * 15 + drift + phase) * 0.022
          + Math.sin(u * 37 - drift * 0.7 + phase) * 0.010
        const hemY = Math.min(horizonY - 5, Math.floor(hem * h))
        const rayTop = Math.max(2, Math.floor((
          top
          + Math.sin(u * 7 - drift + phase) * 0.025
          + Math.sin(u * 19 + drift * 0.5 + phase) * 0.012
        ) * h))
        const rayWave = (Math.sin(u * 91 + phase + drift * 3) + 1) * 0.5
        const shimmer = (Math.sin(u * 41 - t * 0.25 + phase) + 1) * 0.5
        const rayWidth = rayWave > 0.80 ? 2 : 1
        const hasRay = edge > 0.22 && rayWave > 0.54

        // 1–2px rays rise from the hem in four increasingly sparse value steps.
        if (hasRay) {
          for (let y = rayTop; y < hemY - 2; y++) {
            if (ctx.base[y * w + x]! >= 10 && ctx.base[y * w + x]! <= 15) continue
            const rise = (hemY - y) / Math.max(1, hemY - rayTop)
            const dither = (x * 5 + y * 3 + Math.floor(t * 4)) & 3
            let ink: number | undefined
            if (rise < 0.24 || (rise < 0.45 && dither < 3)) {
              ink = bodyInk
            } else if (rise < 0.67 && dither < 2) {
              ink = outerInk
            } else if (rise < 0.86 && dither === 0) {
              ink = outerInk
            }
            if (ink !== undefined) {
              ctx.px(x, y, ink)
              if (rayWidth === 2 && x + 1 < w && ((y + x) & 1) === 0) ctx.px(x + 1, y, ink)
            }
          }
        }

        // The 2–4px brightest hem is continuous enough to bind the vertical rays.
        if (edge > 0.10) {
          const hemThickness = 2 + Math.floor(shimmer * 2)
          for (let y = hemY - hemThickness; y <= hemY; y++) {
            if (y >= 0 && y < horizonY - 3) ctx.px(x, y, bodyInk)
          }
          auroraIntensityByX[x] = Math.max(auroraIntensityByX[x]!, bodyInk)
        }
      }
    }
    drawCurtain(0.18, 0.94, 0.2, 0.09, 0.36, 7, 8)
    drawCurtain(0.25, 0.88, 2.1, 0.13, 0.31, 7, 9)
    drawCurtain(0.12, 0.72, 4.4, 0.18, 0.42, 7, 8)

    // Effect 2: Natural Fjord Water Waves and Dynamic Aurora & Cabin Reflections
    for (let y = horizonY; y < h; y++) {
      const v = (y - horizonY) / Math.max(1, h - horizonY)
        const wavePhase = t * 2.1 + y * 0.56

      for (let x = 0; x < w; x++) {
        if (ctx.base[y * w + x]! >= 28) continue

        const u = x / w
        const wave = Math.sin(x * 0.19 + wavePhase)
        const ripple = Math.sin(x * 0.11 - t * 1.2 + y * 0.24)

        // Cabin window reflection: a narrow, widening path made of short connected
        // streaks. The gaps preserve water movement without detaching orange blocks.
        const distToCabin = Math.abs(u - 0.83)
        const cabinHalfWidth = 0.010 + v * 0.026
        const streakPhase = Math.floor((y - horizonY) / 3) + Math.floor(t * 3)
        const cabinStreak = (streakPhase % 4) !== 3
        const inCabinPath = distToCabin < cabinHalfWidth && cabinStreak && wave + ripple > -0.35 && y < horizonY + h * 0.20

        // Aurora reflection: samples aurora intensity directly above this x column!
        const auroraSampleX = Math.max(0, Math.min(w - 1, Math.floor(x + Math.sin(y * 0.05 + t * 0.65) * (3 + 7 * v))))
        const auroraLight = auroraIntensityByX[auroraSampleX]!
        const brokenBand = Math.sin(x * 0.21 + y * 0.09 - t * 2.1) + ripple
        const inAuroraPath = auroraLight >= 8
          && brokenBand > 1.16 - v * 0.10
          && (y - horizonY) % 3 === 0

        if (inCabinPath) {
          ctx.px(x, y, 23) // Shimmering warm golden window glint
        } else if (inAuroraPath) {
          ctx.px(x, y, auroraLight === 9 ? 20 : 19) // Dim, broken teal/violet curtain streak
          if (x + 1 < w && ctx.base[y * w + x + 1]! < 28) {
            ctx.px(x + 1, y, auroraLight === 9 ? 20 : 19)
          }
        } else if (wave > 0.90 && (x + y) % 5 === 0) {
          ctx.px(x, y, 18) // Normal wave crest
        }
      }
    }

    // Effect 3: Animated Cabin Chimney Smoke (4 poses at 2 fps)
    const scale = Math.max(1, Math.min(2, Math.floor(h / 150)))
    const cabinX = Math.floor(w * 0.83 - (cabinSprite.width * scale) / 2)
    const cabinY = Math.floor(h * 0.67 - cabinSprite.height * scale)
    const chimneyX = cabinX + Math.floor(cabinSprite.width * scale * 0.75)
    const chimneyY = cabinY - 2 * scale
    const smokeFrame = Math.floor(t * 2) % 4
    ctx.spriteFrame(smokeSheet, smokeFrame, chimneyX, chimneyY - Math.floor((t * 2) % 6), scale)

    // Effect 4: 32 Falling Snow Particles across 2 Depth Planes
    for (let i = 0; i < 32; i++) {
      const isNear = i >= 16
      const speed = isNear ? 5.5 : 2.8
      const flakeSeed = (i * 17.31 + ctx.seed * 0.23) % 1
      const driftX = Math.sin(t * 0.8 + i) * (isNear ? 6 : 3)
      const flakeX = (flakeSeed * w + t * (isNear ? 3.5 : 1.8) + driftX) % w
      const flakeY = ((i * 0.61803398875 + t * speed * 0.06) % 1) * h
      const px = Math.floor((flakeX + w) % w)
      const py = Math.floor(flakeY)

      if (px >= 0 && px < w && py >= 0 && py < h) {
        ctx.px(px, py, isNear ? 31 : 30)
        if (isNear && py + 1 < h) {
          ctx.px(px, py + 1, 30)
        }
      }
    }

    // Effect 5: Twinkling Stars
    const twinkleIndices = [0, 3, 6, 9, 14, 20]
    const twinklePhase = Math.floor(t * 2)
    for (const [idx, starIdx] of twinkleIndices.entries()) {
      const star = STARS[starIdx]
      if (!star) continue
      const sx = Math.floor(star.u * w)
      const sy = Math.floor(star.v * h)
      if (sy < horizonY - 4) {
        const pulse = (twinklePhase + idx) % 4 === 0
        ctx.px(sx, sy, pulse ? 6 : (star.bright ? 5 : 4))
      }
    }
  },
}

export default tromso
