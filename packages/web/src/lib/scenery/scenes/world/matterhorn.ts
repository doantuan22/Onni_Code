/**
 * Matterhorn v3: the hooked horn silhouette (steep upper west ridge, a knife
 * summit, a concave east face that bends into the Hornli shoulder), three
 * faces (sunlit west, cold north-shadow centre, alpenglow east), explicit snow
 * couloirs, a foothill ladder, a 10–14 px conifer treeline, and a Riffelsee
 * reflection. Geometry is authored on a 480x270 reference grid and sampled
 * back onto the real buffer, so every size keeps the same composition.
 */
import type { BuildCtx, FrameCtx, Mask, SceneDef, Sprite } from '../../engine/types'
import {
  MATTERHORN_LEGACY_PALETTES,
  MATTERHORN_THEME_PALETTES,
  alpineCabin,
  birdSheet,
  smokeSheet,
  treeLarge,
  treeMedium,
  treeSmall,
} from './matterhorn-sprites'

type Knot = readonly [number, number]

const REF_W = 480
const REF_H = 270
const HORIZON_REF = 175
const TIP_Y = 26
const TIP_X = 418

const STAR_SEEDS = [
  [0.09, 0.05], [0.18, 0.09], [0.27, 0.04], [0.36, 0.08], [0.46, 0.05],
  [0.54, 0.09], [0.62, 0.05], [0.81, 0.06], [0.91, 0.10], [0.14, 0.12],
  [0.41, 0.12], [0.86, 0.13],
] as const

/** Silhouette (reference px). Each side is monotone in y, so a row has exactly one left and one right edge. */
/** Steep 55–60° upper west ridge, then a convex Zmutt-style shoulder that eases into the foothills. */
const PEAK_LEFT: readonly Knot[] = [
  [418, 26], [410, 34], [402, 46], [394, 62], [386, 78], [378, 94],
  [370, 108], [362, 120], [354, 130], [344, 138], [332, 146], [316, 152],
  [296, 160], [272, 168], [250, 174], [236, 176],
]
/** Knife summit overhangs a concave east face (the hook), then bulges out into the Hornli shoulder. */
const PEAK_RIGHT: readonly Knot[] = [
  [418, 26], [424, 32], [432, 42], [438, 56], [440, 70], [436, 80],
  [440, 88], [452, 94], [466, 106], [480, 120], [496, 138], [506, 156],
  [512, 176],
]
/** Arêtes from the summit: west splits the sunlit face from the shadow face, east splits shadow from alpenglow. */
const ARETE_WEST: readonly Knot[] = [[TIP_X, TIP_Y], [352, 176]]
const ARETE_EAST: readonly Knot[] = [[TIP_X, TIP_Y], [430, 176]]

/**
 * Snow couloirs, reference px. Each is walked row by row as a 2–3px streak with
 * noise-broken gaps, so it reads as snow packed into a gully, not a drawn wire.
 */
const COULOIRS: readonly { pts: readonly Knot[]; idx: number }[] = [
  // Sunlit face: two short snow-packed gullies, offset so they do not line up.
  { pts: [[376, 104], [370, 116], [366, 126]], idx: 12 },
  { pts: [[364, 134], [358, 146], [354, 156]], idx: 13 },
  // Shadow face: staggered snow streaks down the north face.
  { pts: [[414, 50], [412, 66], [410, 78]], idx: 13 },
  { pts: [[406, 96], [404, 112], [402, 124]], idx: 13 },
  { pts: [[400, 138], [397, 152], [395, 164]], idx: 13 },
  // Alpenglow face: a dark gully cut through the warm snow.
  { pts: [[432, 90], [440, 108]], idx: 25 },
  { pts: [[452, 118], [460, 134], [464, 146]], idx: 25 },
  // West buttress: a dark rock rib that breaks the sunlit ramp into two facets.
  { pts: [[368, 120], [352, 146], [330, 176]], idx: 25 },
]

const CABIN_REF: Knot = [346, 166]

interface LakeRowSpan {
  y: number
  xStart: number
  xEnd: number
  /** Pre-baked lake index per pixel along [xStart..xEnd], shifted by +/-1px warp in frame(). */
  colors: Uint8Array
  /** Static non-zero cycle index where a horizontal ripple glint lives. */
  rippleMask: Uint8Array
  /** Inclusive local [start, end] pairs of lake pixels only, so frame() never visits shore or tree pixels. */
  runs: Uint16Array
}

interface CloudStencil {
  baseU: number
  baseV: number
  speed: number
  stencil: Int16Array
}

interface MatterhornCache {
  width: number
  height: number
  horizonY: number
  peakOcclusion: Mask
  clouds: CloudStencil[]
  lakeRows: LakeRowSpan[]
  cabinX: number
  cabinY: number
  birdOcclusion: Mask
}

/**
 * Drifting cloud layout as fractions of the frame, so a frame reads constants and
 * allocates nothing. Puff tuple: [offsetU, offsetPx, radiusU, radiusV].
 */
const CLOUDS: readonly {
  baseU: number
  baseV: number
  speed: number
  puffs: readonly (readonly [number, number, number, number])[]
}[] = [
  {
    baseU: 0.14, baseV: 0.34, speed: 0.15,
    puffs: [[0, 0, 0.042, 0.025], [-0.032, 2, 0.028, 0.017], [0.028, 1, 0.034, 0.021], [0.056, 3, 0.020, 0.014]],
  },
  {
    baseU: 0.42, baseV: 0.41, speed: 0.12,
    puffs: [[0, 0, 0.034, 0.020], [-0.026, 2, 0.024, 0.015], [0.028, 2, 0.022, 0.014]],
  },
  {
    baseU: 0.89, baseV: 0.38, speed: 0.15,
    puffs: [[0, 0, 0.035, 0.021], [-0.028, 2, 0.022, 0.014], [0.026, 1, 0.025, 0.016]],
  },
]

const sceneCache = new WeakMap<Uint8Array, MatterhornCache>()

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Linear interpolation of a y-monotone polyline at height y, returning x. */
function xAtY(knots: readonly Knot[], y: number): number {
  if (y <= knots[0]![1]) return knots[0]![0]
  for (let i = 0; i < knots.length - 1; i++) {
    const [x0, y0] = knots[i]!
    const [x1, y1] = knots[i + 1]!
    if (y <= y1) return x0 + (x1 - x0) * ((y - y0) / Math.max(1e-6, y1 - y0))
  }
  return knots[knots.length - 1]![0]
}

/** Linear interpolation of an x-monotone polyline at x, returning y. */
function yAtX(knots: readonly Knot[], x: number): number {
  if (x <= knots[0]![0]) return knots[0]![1]
  for (let i = 0; i < knots.length - 1; i++) {
    const [x0, y0] = knots[i]!
    const [x1, y1] = knots[i + 1]!
    if (x <= x1) return y0 + (y1 - y0) * ((x - x0) / Math.max(1e-6, x1 - x0))
  }
  return knots[knots.length - 1]![1]
}

function drawSky(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx
  const horizonY = Math.floor(h * 0.65)
  ctx.layer({ kind: 'sky', z: 0 }, () => {
    // Four clean bands; the dithered seam is 2px either side of each step.
    const seam = 2
    const first = Math.floor(horizonY * 0.28)
    const second = Math.floor(horizonY * 0.58)
    const third = Math.floor(horizonY * 0.85)
    for (let y = 0; y < horizonY; y++) {
      for (let x = 0; x < w; x++) {
        let idx: number
        if (y < first - seam) idx = 0
        else if (y <= first + seam) idx = ctx.dither(x, y, (y - first + seam) / (seam * 2 + 1), 0, 1)
        else if (y < second - seam) idx = 1
        else if (y <= second + seam) idx = ctx.dither(x, y, (y - second + seam) / (seam * 2 + 1), 1, 2)
        else if (y < third - seam) idx = 2
        else if (y <= third + seam) idx = ctx.dither(x, y, (y - third + seam) / (seam * 2 + 1), 2, 3)
        else idx = 3
        ctx.px(x, y, idx)
      }
    }

    const sunX = Math.round(w * 0.24)
    const sunY = Math.round(h * 0.20)
    const sunR = Math.max(4, Math.round(Math.min(w, h) * 0.032))
    // Sun disc uses slot 4; a single flat halo ring (no checkerboard) sits one px outside it.
    // Slot 4 matches sky[1] at night, so the sun vanishes after dark. A ring in another slot would show as a hoop at night.
    ctx.disc(sunX, sunY, sunR + 2, 4)
    ctx.disc(sunX, sunY, sunR, 4)

    for (const [su, sv] of STAR_SEEDS) {
      ctx.px(Math.round(su * w), Math.round(sv * h), 5)
    }
    const moonX = Math.round(w * 0.14)
    const moonY = Math.round(h * 0.10)
    const moonR = Math.max(3, Math.round(Math.min(w, h) * 0.022))
    for (let dy = -moonR; dy <= moonR; dy++) {
      for (let dx = -moonR; dx <= moonR; dx++) {
        if (dx * dx + dy * dy <= moonR * moonR) {
          const cutX = dx - Math.max(1, Math.round(moonR * 0.45))
          const cutY = dy + Math.round(moonR * 0.22)
          if (cutX * cutX + cutY * cutY > moonR * moonR * 0.78) {
            ctx.px(moonX + dx, moonY + dy, 5)
          }
        }
      }
    }
  })
}

/** A jagged ridge line: knots give the broad shape, fbm adds the crags. */
function drawRange(
  ctx: BuildCtx,
  knots: readonly Knot[],
  noiseSeed: number,
  crag: number,
  topIdx: number,
  bodyIdx: number,
  occlusion: Mask | undefined,
): void {
  const { width: w, height: h } = ctx
  const horizonY = Math.floor(h * 0.65)
  const kx = REF_W / w
  const ky = REF_H / h
  for (let x = 0; x < w; x++) {
    const xc = (x + 0.5) * kx
    const top = Math.floor((yAtX(knots, xc) + (ctx.fbm1(xc * 0.05 + noiseSeed) - 0.5) * crag) / ky)
    for (let y = Math.max(0, top); y < horizonY; y++) {
      ctx.px(x, y, y < top + 2 ? topIdx : bodyIdx)
      occlusion?.set(x, y, 15)
    }
  }
}

function drawForeground(ctx: BuildCtx, peakOcclusion: Mask): void {
  // Far range: cool haze blue, lit crest over a shade body.
  ctx.layer({ kind: 'far', z: 1 }, () => {
    drawRange(
      ctx,
      [[0, 122], [40, 110], [70, 116], [100, 104], [135, 114], [170, 108], [200, 118], [240, 112],
        [270, 116], [300, 106], [330, 114], [360, 108], [390, 118], [430, 110], [470, 116], [480, 114]],
      3,
      4,
      8,
      9,
      peakOcclusion,
    )
  })
  // Foothills: a nearer, darker ladder step below the far range.
  ctx.layer({ kind: 'mid', z: 2 }, () => {
    drawRange(
      ctx,
      [[0, 152], [60, 144], [110, 152], [160, 146], [220, 158], [280, 150], [340, 158], [400, 152], [440, 156], [480, 150]],
      11,
      5,
      10,
      11,
      peakOcclusion,
    )
  })
}

/** Hooked silhouette with three faces, rock strata, snow fields and explicit couloirs. */
function drawMatterhorn(ctx: BuildCtx, peakOcclusion: Mask): void {
  const { width: w, height: h } = ctx
  const horizonY = Math.floor(h * 0.65)
  const kx = REF_W / w
  const ky = REF_H / h
  const topY = Math.max(0, Math.floor(TIP_Y / ky))

  ctx.layer({ kind: 'mid', z: 3 }, () => {
    for (let py = topY; py < horizonY; py++) {
      const yc = (py + 0.5) * ky
      const xl = xAtY(PEAK_LEFT, yc)
      const xr = xAtY(PEAK_RIGHT, yc)
      const t = clamp((yc - TIP_Y) / (HORIZON_REF - TIP_Y), 0, 1)
      const s1 = xAtY(ARETE_WEST, yc)
      const s2 = xAtY(ARETE_EAST, yc)
      const x0 = Math.max(0, Math.floor(xl / kx))
      const x1 = Math.min(w - 1, Math.ceil(xr / kx))
      for (let px = x0; px <= x1; px++) {
        const xc = (px + 0.5) * kx
        if (xc < xl || xc > xr) continue
        peakOcclusion.set(px, py, 15)
        const n = ctx.fbm2(xc * 0.07, yc * 0.07)
        // Rock texture is noise blobs, not parallel lines: parallel strata read as a grid on a big face.
        const blob = ctx.fbm2(xc * 0.2, yc * 0.2) > 0.6
        // Snow ledges follow the rock dip (diagonal, sparse), only where the noise lifts.
        const ledge = n > 0.6 && ((yc + xc * 0.5 + n * 12) % 13) < 1.2
        const dl = xc - xl
        const dr = xr - xc
        let idx: number
        if (xc < s1) {
          // West face, sunlit: warm granite with snow fields on the top third.
          const snowTop = 0.30 + (n - 0.5) * 0.12
          if (dl < 1.2 && t < 0.5) idx = 12
          else if (t < snowTop) idx = n > 0.55 ? 12 : 13
          else if (n < 0.30) idx = 25
          else idx = blob ? 24 : 23
        } else if (xc < s2) {
          // North-shadow centre: cold snow above the snowline, slate rock below.
          const snowLine = 0.52 + (n - 0.5) * 0.14
          if (t < snowLine) idx = n > 0.62 ? 13 : 14
          else if (ledge) idx = 13
          else idx = blob ? 24 : 25
        } else {
          // East face: alpenglow on the upper hook, then plain shadow rock.
          if (dr < 1.2) idx = 15
          else if (t < 0.22) idx = n > 0.45 ? 15 : 12
          else if (t < 0.45) idx = n > 0.5 ? 15 : 24
          else idx = blob ? 24 : 25
        }
        ctx.px(px, py, idx)
      }
    }

    for (const { pts, idx } of COULOIRS) {
      const yTop = pts[0]![1]
      const yBot = pts[pts.length - 1]![1]
      for (let py = Math.max(topY, Math.ceil(yTop / ky)); py <= Math.min(horizonY - 1, Math.floor(yBot / ky)); py++) {
        const yc = (py + 0.5) * ky
        const xc = xAtY(pts, yc)
        const g = ctx.fbm2(xc * 0.2, yc * 0.2)
        if (g < 0.36) continue // rock break in the gully
        const half = g > 0.62 ? 1 : 0
        const px = Math.round(xc / kx)
        ctx.rect(px - half, py, 2 + half, 1, idx)
      }
    }
  })
}

/** Forest mass and 10–14 px conifers along the foothill edge, plus the valley cabin. */
function drawValleyForestAndCabin(ctx: BuildCtx, peakOcclusion: Mask): { cabinX: number; cabinY: number } {
  const { width: w, height: h } = ctx
  const horizonY = Math.floor(h * 0.65)
  const kx = REF_W / w
  const ky = REF_H / h
  const cabinX = Math.round(CABIN_REF[0] / kx)
  const cabinY = Math.round(CABIN_REF[1] / ky)

  ctx.layer({ kind: 'mid', z: 4 }, () => {
    // Forest line: a thin dark floor under the trees, its top edge ragged with fbm.
    for (let x = 0; x < w; x++) {
      const xc = (x + 0.5) * kx
      const forestTop = (170 + (ctx.fbm1(xc * 0.2 + 7) - 0.5) * 5) / ky
      for (let y = Math.max(0, Math.floor(forestTop)); y < horizonY; y++) {
        peakOcclusion.set(x, y, 15)
        ctx.px(x, y, 28)
      }
    }

    // Treeline: three size classes (10, 12, 14 px), mixed by the seeded rng so
    // no two gaps repeat. Back row first (smaller, higher), then the front row.
    for (let x = -2; x < REF_W + 4; ) {
      const pick = ctx.rng()
      const pool = pick < 0.55 ? treeSmall : pick < 0.85 ? treeMedium : treeLarge
      const spr = pool[Math.floor(ctx.rng() * pool.length)]!
      drawTree(ctx, spr, (x + 0.5) / kx, (168 + ctx.rng() * 3) / ky, peakOcclusion)
      x += 7 + Math.round(ctx.rng() * 8)
    }
    for (let x = 0; x < REF_W + 6; ) {
      const pick = ctx.rng()
      const pool = pick < 0.25 ? treeSmall : pick < 0.6 ? treeMedium : treeLarge
      const spr = pool[Math.floor(ctx.rng() * pool.length)]!
      drawTree(ctx, spr, (x + 0.5) / kx, (176 + ctx.rng() * 2) / ky, peakOcclusion)
      x += 10 + Math.round(ctx.rng() * 12)
    }

    const cx = cabinX - Math.floor(alpineCabin.width / 2)
    const cy = cabinY - alpineCabin.height + 4
    ctx.sprite(alpineCabin, cx, cy, 1)
    for (let py = 0; py < alpineCabin.height; py++) {
      for (let px = 0; px < alpineCabin.width; px++) {
        if (alpineCabin.pixels[py * alpineCabin.width + px]! >= 0) {
          peakOcclusion.set(cx + px, cy + py, 15)
        }
      }
    }

    // Warm amber window glow on the doorstep.
    const winX = cx + 8
    for (let dy = 0; dy <= 3; dy++) {
      for (let dx = -3; dx <= 4; dx++) {
        const gx = winX + dx
        const gy = cy + alpineCabin.height + dy - 2
        if (gx >= 0 && gx < w && gy >= 0 && gy < h) {
          if ((dx * dx) / 9 + (dy * dy) / 4 <= 1.0) {
            ctx.px(gx, gy, dy === 0 ? 30 : 29)
          }
        }
      }
    }
  })

  return { cabinX, cabinY }
}

function drawTree(ctx: BuildCtx, spr: Sprite, baseX: number, baseY: number, occlusion: Mask): void {
  const sx = Math.round(baseX - spr.width / 2)
  const sy = Math.round(baseY - spr.height + 1)
  ctx.sprite(spr, sx, sy, 1)
  for (let py = 0; py < spr.height; py++) {
    for (let px = 0; px < spr.width; px++) {
      if (spr.pixels[py * spr.width + px]! >= 0) occlusion.set(sx + px, sy + py, 15)
    }
  }
}

function buildLakeAndShore(ctx: BuildCtx, lakeMask: Mask, birdOcclusion: Mask): LakeRowSpan[] {
  const { width: w, height: h } = ctx
  const horizonY = Math.floor(h * 0.65)
  const lakeMaxY = Math.floor(h * 0.94)

  const shoreY = new Int16Array(w)
  for (let x = 0; x < w; x++) {
    const u = x / w
    const curve = 0.90 + Math.sin(u * 6.5) * 0.022 - Math.pow(Math.abs(u - 0.5) * 2, 3.6) * 0.21
    shoreY[x] = Math.min(h, Math.max(horizonY + 2, Math.floor(curve * h)))
  }

  ctx.layer({ kind: 'water', z: 5 }, () => {
    for (let y = horizonY; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (y < shoreY[x]!) {
          lakeMask.set(x, y, 15)
          ctx.px(x, y, 22)
        }
      }
    }
  })

  ctx.layer({ kind: 'near', z: 6 }, () => {
    for (let x = 0; x < w; x++) {
      const sy = shoreY[x]!
      for (let y = sy; y < h; y++) {
        const d = y - sy
        let idx = d < 3 ? 31 : d < 10 ? 24 : 28
        if (d >= 3 && ctx.fbm2(x * 0.09, y * 0.11) > 0.67) idx = 23
        ctx.px(x, y, idx)
      }
      if (sy < h && (x % 4 !== 0)) ctx.px(x, sy, 31)
    }

    const rocks = [
      [0.10, 0.84, 5, 3], [0.20, 0.88, 4, 2], [0.92, 0.85, 5, 3],
    ] as const
    for (const [ru, rv, rw, rh] of rocks) {
      const rx = Math.round(ru * w)
      const ry = Math.round(rv * h)
      for (let dy = -rh; dy <= rh; dy++) {
        for (let dx = -rw; dx <= rw; dx++) {
          if ((dx * dx) / (rw * rw) + (dy * dy) / (rh * rh) <= 1) {
            ctx.px(rx + dx, ry + dy, dy < 0 && dx < 0 ? 23 : dy < 1 ? 24 : 25)
            lakeMask.set(rx + dx, ry + dy, 0)
          }
        }
      }
    }

    // Foreground conifers: the largest 14 px class, shore-side.
    const nearTrees = [
      [0.04, 0.86, 0], [0.09, 0.90, 1], [0.15, 0.93, 2],
      [0.91, 0.88, 0], [0.96, 0.91, 1],
    ] as const
    const nearPool = [treeLarge[0]!, treeLarge[1]!, treeLarge[2]!]
    for (const [tu, tv, variant] of nearTrees) {
      const spr = nearPool[variant]!
      const sx = Math.round(tu * w - spr.width / 2)
      const sy = Math.round(tv * h - spr.height + 1)
      ctx.sprite(spr, sx, sy, 1)
      for (let py = 0; py < spr.height; py++) {
        for (let px = 0; px < spr.width; px++) {
          if (spr.pixels[py * spr.width + px]! >= 0) {
            lakeMask.set(sx + px, sy + py, 0)
            birdOcclusion.set(sx + px, sy + py, 15)
          }
        }
      }
    }
  })

  // Pre-bake the inverted mountain reflection and horizontal wavelets for cheap frames.
  const lakeRows: LakeRowSpan[] = []
  for (let y = horizonY; y < lakeMaxY; y++) {
    let xStart = w
    let xEnd = -1
    for (let x = 0; x < w; x++) {
      if (lakeMask.contains(x, y)) {
        if (x < xStart) xStart = x
        if (x > xEnd) xEnd = x
      }
    }
    if (xEnd < xStart) continue
    const len = xEnd - xStart + 1
    const dist = y - horizonY
    const depth = dist / Math.max(1, lakeMaxY - horizonY)
    const srcY = Math.max(0, horizonY - 1 - Math.floor(dist * 2.05))
    const srcRow = srcY * w
    const rippleMask = new Uint8Array(len)
    const colors = new Uint8Array(len)

    for (let i = 0; i < len; i++) {
      const x = xStart + i
      // Wind ripples: short streaks on a few rows only, never a full-width barcode.
      const wind = ctx.fbm2(x * 0.035, y * 0.18)
      const isRippleRow = (y % 4 === 1) || (y % 6 === 3 && depth > 0.3)
      const rippleStreak = ((x + y * 7) % 13) < 6
      if (isRippleRow && wind > 0.64 && rippleStreak) {
        rippleMask[i] = 16 + ((Math.floor(dist / 3) + Math.floor(x / 7)) % 6)
      }

      const srcIdx = ctx.base[srcRow + x]!
      if (srcIdx === 12 || srcIdx === 15) {
        colors[i] = 19 // sunlit snow and alpenglow highlight
      } else if (srcIdx === 13 || srcIdx === 14) {
        colors[i] = 18 // snow midtone and shadow
      } else if (srcIdx === 23) {
        colors[i] = 17 // sunlit granite
      } else if (srcIdx === 24 || srcIdx === 25 || srcIdx === 22 || srcIdx === 31) {
        colors[i] = 22 // shadow rock and forest/shore base
      } else if (srcIdx >= 26 && srcIdx <= 28) {
        colors[i] = 22 // conifer shadow
      } else if (srcIdx === 29 || srcIdx === 30) {
        colors[i] = 20 // cabin timber and window glow
      } else if (srcIdx >= 8 && srcIdx <= 11) {
        colors[i] = 17 // far and foothill ridges
      } else {
        colors[i] = depth < 0.25 ? 17 : 16 // sky reflection
      }
    }

    const runList: number[] = []
    let runStart = -1
    for (let i = 0; i < len; i++) {
      const inLake = lakeMask.contains(xStart + i, y)
      if (inLake && runStart < 0) runStart = i
      else if (!inLake && runStart >= 0) {
        runList.push(runStart, i - 1)
        runStart = -1
      }
    }
    if (runStart >= 0) runList.push(runStart, len - 1)
    lakeRows.push({ y, xStart, xEnd, colors, rippleMask, runs: Uint16Array.from(runList) })
  }

  return lakeRows
}

/** Build-time stencil per cloud: triplets [dx, dy, colour] relative to the cloud anchor, in puff order. */
function buildClouds(w: number, h: number): CloudStencil[] {
  return CLOUDS.map((cloud) => {
    const out: number[] = []
    for (const puff of cloud.puffs) {
      const ox = Math.round(puff[0] * w)
      const oy = puff[1]
      const rx = Math.round(puff[2] * w)
      const ry = Math.round(puff[3] * h)
      const rx2 = Math.max(1, rx * rx)
      const ry2 = Math.max(1, ry * ry)
      const maxDy = Math.floor(ry * 0.55)
      const litCut = Math.round(ry * 0.18)
      for (let dy = -ry; dy <= maxDy; dy++) {
        const dyTerm = (dy * dy) / ry2
        const color = dy < litCut ? 6 : 7
        for (let dx = -rx; dx <= rx; dx++) {
          if ((dx * dx) / rx2 + dyTerm <= 1) out.push(ox + dx, oy + dy, color)
        }
      }
    }
    return { baseU: cloud.baseU, baseV: cloud.baseV, speed: cloud.speed, stencil: Int16Array.from(out) }
  })
}

function drawDriftingClouds(ctx: FrameCtx, t: number, cache: MatterhornCache): void {
  const { width: w, height: h, frame } = ctx
  const occ = cache.peakOcclusion.coverage
  for (const cloud of cache.clouds) {
    const cx = Math.round(((cloud.baseU * w + t * cloud.speed) % (w + 90)) - 45)
    const cy = Math.round(cloud.baseV * h)
    const s = cloud.stencil
    for (let k = 0; k < s.length; k += 3) {
      const py = cy + s[k + 1]!
      const px = cx + s[k]!
      if (py < 0 || py >= h || px < 0 || px >= w) continue
      const i = py * w + px
      if (occ[i] === 0) frame[i] = s[k + 2]!
    }
  }
}

function drawLakeReflection(ctx: FrameCtx, t: number, cache: MatterhornCache): void {
  const { width: w, frame } = ctx
  const warpTick = Math.floor(t * 3)

  for (const row of cache.lakeRows) {
    const { y, xStart, colors, rippleMask, runs } = row
    const dstRow = y * w + xStart
    const rowWarp = Math.round(Math.sin(y * 0.42 + warpTick * 0.85))
    const maxLocal = row.xEnd - xStart
    for (let k = 0; k < runs.length; k += 2) {
      const end = runs[k + 1]!
      for (let local = runs[k]!; local <= end; local++) {
        const rip = rippleMask[local]!
        if (rip !== 0) {
          frame[dstRow + local] = rip
        } else {
          const srcLocal = local + rowWarp
          frame[dstRow + local] = colors[srcLocal < 0 ? 0 : srcLocal > maxLocal ? maxLocal : srcLocal]!
        }
      }
    }
  }
}

function drawBirdsAndSmoke(ctx: FrameCtx, t: number, cache: MatterhornCache): void {
  const { width: w } = ctx

  const smokePose = Math.floor(t * 2) % 4
  ctx.spriteFrame(smokeSheet, smokePose, cache.cabinX + 5, cache.cabinY - 10, 1)

  const birds = [
    { startU: 0.28, baseV: 0.39, phase: 0, speed: 2.0 },
    { startU: 0.35, baseV: 0.42, phase: 2, speed: 1.85 },
  ] as const

  for (const b of birds) {
    const bx = Math.round(((b.startU * w + t * b.speed) % (w + 24)) - 12)
    const by = Math.round(b.baseV * ctx.height + Math.sin(t * 0.45 + b.phase) * 4)
    if (cache.birdOcclusion.contains(bx, by)) continue
    const pose = Math.floor(t * 6 + b.phase) % 4
    ctx.spriteFrame(birdSheet, pose, bx, by, 1)
  }
}

const scene: SceneDef = {
  id: 'world-matterhorn',
  name: { en: 'Matterhorn', vi: 'Đỉnh Matterhorn' },
  region: 'world',
  tone: 'both',
  palettes: MATTERHORN_LEGACY_PALETTES,
  themePalettes: MATTERHORN_THEME_PALETTES,
  defaultTime: 'dawn',
  themeDefaultTime: { light: 'dawn', dark: 'night' },
  cycles: [{ indices: [16, 17, 18, 19, 20, 21], rate: 4 }],
  horizon: 0.65,
  focus: { x: 0.78, y: 0.35 },
  build(ctx) {
    const { width: w, height: h } = ctx
    const peakOcclusion = ctx.mask()
    const lakeMask = ctx.mask()
    const birdOcclusion = ctx.mask()

    drawSky(ctx)
    drawForeground(ctx, peakOcclusion)
    drawMatterhorn(ctx, peakOcclusion)
    const { cabinX, cabinY } = drawValleyForestAndCabin(ctx, peakOcclusion)
    const lakeRows = buildLakeAndShore(ctx, lakeMask, birdOcclusion)

    sceneCache.set(ctx.base, {
      width: w,
      height: h,
      horizonY: Math.floor(h * 0.65),
      peakOcclusion,
      clouds: buildClouds(w, h),
      lakeRows,
      cabinX,
      cabinY,
      birdOcclusion,
    })
  },
  frame(ctx, t) {
    const cache = sceneCache.get(ctx.base)
    if (!cache) return
    drawDriftingClouds(ctx, t, cache)
    drawLakeReflection(ctx, t, cache)
    drawBirdsAndSmoke(ctx, t, cache)
  },
}

export default scene
