/**
 * Hand-drawn V2 reference: a west-facing Phú Quốc beach at sunset.
 * Twin leaning coconut palms with lush drooping frond crowns frame a quiet sea,
 * a traditional fishing sampan with glowing lantern and water reflection,
 * a tapered sparkling wave glint path, and an S-curve shore with animated foam wash
 * and dark wet tide lines. Sky is a 10-band stepped ramp with dithered seams, the sea is a
 * 4-band depth ramp, and two islands sit on a feathered horizon haze.
 */
import type { BuildCtx, FrameCtx, SceneDef } from '../../engine/types'
import {
  heroPalmCrownSheet,
  Ink,
  PHU_QUOC_LEGACY_PALETTES,
  PHU_QUOC_THEME_PALETTES,
  SKY_BANDS,
  sampanSheet,
  seabirdSheet,
  secPalmCrownSheet,
} from './phu-quoc-sprites'

const HORIZON = 0.57
const SUN_U = 0.76
const SUN_V = 0.36
/** Dithered rows on each sky band boundary (spec: 2–3px seams). */
const SEAM_ROWS = 3

/** First row of sky band k. Bands split [0, line) evenly; skyBandAt is its exact inverse. */
function bandTop(k: number, line: number): number {
  return Math.ceil((line * k) / SKY_BANDS)
}

function skyBandAt(y: number, line: number): number {
  return Math.min(SKY_BANDS - 1, Math.max(0, Math.floor((y * SKY_BANDS) / line)))
}

function drawSky(ctx: BuildCtx, line: number): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'sky', z: 0 }, () => {
    for (let k = 0; k < SKY_BANDS; k++) {
      const top = bandTop(k, line)
      const bottom = k === SKY_BANDS - 1 ? line : bandTop(k + 1, line)
      ctx.rect(0, top, w, bottom - top, Ink.Sky0 + k)
    }

    // Seams ramp 25% -> 50% -> 75% toward the lower band over SEAM_ROWS rows, so the steps read as a gradient
    const reach = (SEAM_ROWS - 1) / 2
    for (let k = 1; k < SKY_BANDS; k++) {
      const edge = bandTop(k, line)
      for (let row = -reach; row <= reach; row++) {
        const y = edge + row
        if (y < 0 || y >= line) continue
        const amount = (row + reach + 1) / (SEAM_ROWS + 1)
        for (let x = 0; x < w; x++) {
          ctx.px(x, y, ctx.dither(x, y, amount, Ink.Sky0 + k - 1, Ink.Sky0 + k, 4))
        }
      }
    }

    // Three-stage stepped sun halo: solid inner ring, dithered outer fade, bright core
    const sunX = Math.floor(w * SUN_U)
    const sunY = Math.floor(h * SUN_V)
    for (let y = sunY - 24; y <= sunY + 24; y++) {
      if (y < 0 || y >= line) continue
      for (let x = sunX - 24; x <= sunX + 24; x++) {
        if (x < 0 || x >= w) continue
        const d = Math.hypot(x - sunX, y - sunY)
        if (d > 9 && d <= 14) {
          ctx.px(x, y, Ink.SunGlow)
        } else if (d > 14 && d <= 24) {
          const amount = (0.5 * (24 - d)) / 10
          ctx.px(x, y, ctx.dither(x, y, amount, Ink.Sky0 + skyBandAt(y, line), Ink.SunGlow, 4))
        }
      }
    }
    ctx.disc(sunX, sunY, 9, Ink.SunCore)
  })
}

interface IsleSpec {
  readonly u0: number
  readonly u1: number
  readonly peak: number
  readonly body: number
  readonly bumps: number
  readonly rim?: number
}

/** Feathered isle: the crest row dithers into the sky band behind it, so the edge reads as haze. */
function drawIsle(ctx: BuildCtx, line: number, isle: IsleSpec): void {
  const { width: w } = ctx
  const x0 = Math.floor(w * isle.u0)
  const x1 = Math.floor(w * isle.u1)
  for (let x = x0; x < x1; x++) {
    const u = (x - x0) / (x1 - x0)
    const arch = Math.sin(u * Math.PI) ** 0.7
    const canopy = isle.bumps * (Math.sin(x * 0.45) * 0.5 + 0.5)
    const top = Math.floor(line - arch * isle.peak - canopy)
    if (top >= line) continue
    ctx.rect(x, top + 1, 1, line - top - 1, isle.body)
    const behind = Ink.Sky0 + skyBandAt(top, line)
    ctx.px(x, top, ctx.dither(x, top, 0.5, behind, isle.body, 4))
    if (isle.rim !== undefined && u > 0.45 && (x & 1) === 0) {
      ctx.px(x, top + 1, isle.rim)
    }
  }
}

function drawIsland(ctx: BuildCtx, line: number): void {
  const { height: h } = ctx
  ctx.layer({ kind: 'far', z: 1 }, () => {
    // Distant haze isle: pale and low, so it sits back in the horizon glow
    drawIsle(ctx, line, { u0: 0.04, u1: 0.44, peak: h * 0.040, body: Ink.IslandFar, bumps: 1 })
    // Mid rainforest ridge: taller, lit canopy on its sunward slope
    drawIsle(ctx, line, { u0: 0.08, u1: 0.46, peak: h * 0.054, body: Ink.IslandMid, bumps: 2, rim: Ink.IslandRim })
    // Second, far smaller isle on the right, a faint speck near the horizon
    drawIsle(ctx, line, { u0: 0.86, u1: 0.97, peak: h * 0.020, body: Ink.IslandFar, bumps: 1 })
  })
}

function drawWater(ctx: BuildCtx, line: number): void {
  const { width: w, height: h } = ctx
  const sunX = Math.floor(w * SUN_U)
  const seaH = h - line
  // Depth ramp: four bands, bright at the horizon, deepest in the foreground (fractions of sea height)
  const bandStarts = [0, 0.16, 0.42, 0.72].map((f) => line + Math.round(seaH * f))
  const bandEnd = (k: number): number => (k === bandStarts.length - 1 ? h : bandStarts[k + 1]!)

  ctx.layer({ kind: 'water', z: 2 }, () => {
    for (let k = 0; k < bandStarts.length; k++) {
      ctx.rect(0, bandStarts[k]!, w, bandEnd(k) - bandStarts[k]!, Ink.SeaFar + k)
    }
    // Horizon haze: 4 dithered rows fade the sky's warm last band into the bright far sea
    for (let row = -2; row <= 1; row++) {
      const y = line + row
      const amount = (row + 3) / 5
      for (let x = 0; x < w; x++) {
        ctx.px(x, y, ctx.dither(x, y, amount, Ink.Sky0 + SKY_BANDS - 1, Ink.SeaFar, 4))
      }
    }
    // 4px dithered seams (ramp 20% -> 80%) between depth bands, so each step melts into the next
    for (let k = 1; k < bandStarts.length; k++) {
      const edge = bandStarts[k]!
      for (let row = -2; row <= 1; row++) {
        const y = edge + row
        const amount = (row + 3) / 5
        for (let x = 0; x < w; x++) {
          ctx.px(x, y, ctx.dither(x, y, amount, Ink.SeaFar + k - 1, Ink.SeaFar + k, 4))
        }
      }
    }

    for (let y = line; y < h; y++) {
      const d = (y - line) / seaH

      // Perspective light corridor (tapered glint path expanding 8px -> ~64px)
      const halfSpread = Math.floor(4 + d * 30)
      const leftGlint = Math.max(0, sunX - halfSpread)
      const rightGlint = Math.min(w, sunX + halfSpread)

      const rowStep = Math.max(1, Math.floor(3 - d * 1.5))
      if (y % rowStep === 0) {
        for (let x = leftGlint; x < rightGlint; x += Math.max(4, Math.floor(10 - d * 4))) {
          if (((x * 5 + y * 7) % 11) < 5) {
            const waveletLen = Math.min(rightGlint - x, Math.floor(3 + d * 10))
            ctx.line(x, y, x + waveletLen, y, Ink.Wave0 + ((x + y * 2) % 3))

            // Sparkling specular core in centre of glint path
            if (Math.abs(x - sunX) < halfSpread * 0.38 && ((x + y) & 1) === 0) {
              ctx.px(x + Math.floor(waveletLen / 2), y, Ink.SeaGlint)
            }
          }
        }
      }

      // Sparse calm wavelets outside the glint corridor
      if (y % 3 === 0) {
        for (let x = (y * 7) % 23; x < w; x += 28) {
          if (x < leftGlint - 6 || x > rightGlint + 6) {
            if (ctx.fbm2(x * 0.08, y * 0.12) > 0.62) {
              const len = Math.floor(2 + d * 4)
              ctx.line(x, y, x + len, y, Ink.Wave0 + ((x + y) % 3))
            }
          }
        }
      }
    }
  })
}

function getShoreY(x: number, w: number, h: number, ctx: BuildCtx): number {
  const u = x / w
  // S-curve sweeping from (0, 0.73) through (0.35, 0.85) to (0.72, 1.00)
  const baseCurve = h * (0.73 + u * 0.46 - u * u * 0.26)
  const noise = (ctx.fbm2(x * 0.07, 24) - 0.5) * 3
  return Math.floor(baseCurve + noise)
}

function drawShore(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'near', z: 3 }, () => {
    for (let x = 0; x < w; x++) {
      const shoreY = getShoreY(x, w, h, ctx)
      if (shoreY < h) {
        ctx.rect(x, shoreY, 1, h - shoreY, Ink.SandDry)

        // Wet sand tide line (3-5px)
        const wetDepth = Math.min(5, h - shoreY)
        ctx.rect(x, shoreY, 1, wetDepth, Ink.SandWet)

        // Sparse sand grain texture
        for (let y = shoreY + wetDepth; y < h; y += 3) {
          if (((x * 13 + y * 19) % 29) < 2) {
            ctx.px(x, y, Ink.SandWet)
          }
        }
      }
    }

    // Coastal granite rocks along the shore
    const rocks: readonly [number, number, number][] = [
      [0.44, 0.87, 3],
      [0.51, 0.91, 2],
      [0.58, 0.94, 4],
      [0.64, 0.97, 2],
    ]
    for (const [rx, ry, radius] of rocks) {
      const rockX = Math.floor(w * rx)
      const rockY = Math.floor(h * ry)
      ctx.disc(rockX, rockY, radius, Ink.BeachRock)
      ctx.line(rockX, rockY - radius, rockX + radius, rockY, Ink.TrunkRim)
    }
  })
}

function drawPalmTrunk(
  ctx: BuildCtx,
  crownX: number, crownY: number,
  footX: number, footY: number,
  baseRadius: number,
  topRadius: number,
  leanFactor: number,
): void {
  const height = footY - (crownY + 2)
  for (let y = Math.floor(crownY + 2); y <= footY; y++) {
    const t = Math.max(0, Math.min(1, (y - (crownY + 2)) / height))
    // Organic leaning arc
    const arcX = crownX + (footX - crownX) * t - Math.sin(t * Math.PI) * (leanFactor * ctx.width)
    const radius = topRadius + t * (baseRadius - topRadius)
    const x0 = Math.floor(arcX - radius)
    const x1 = Math.floor(arcX + radius)
    const width = Math.max(1, x1 - x0 + 1)

    ctx.rect(x0, y, width, 1, Ink.TrunkMid)
    ctx.px(x0, y, Ink.TrunkDark)
    if (radius >= 2.5) {
      ctx.px(x0 + 1, y, Ink.TrunkDark)
    }
    ctx.px(x1, y, Ink.TrunkRim)

    // Annular bark rings
    if (y % 4 === 0) {
      ctx.line(x0, y, x1 - 1, y, Ink.TrunkDark)
      ctx.px(x1, y, Ink.TrunkRim)
    }
  }

  // Palm base flare and grass tufts
  ctx.disc(Math.floor(footX), Math.floor(footY), Math.floor(baseRadius + 2), Ink.TrunkDark)
  for (let i = -4; i <= 4; i++) {
    ctx.line(footX + i * 2, footY - 2, footX + i * 2 + (i < 0 ? -2 : 2), footY - 7, Ink.FrondBody)
  }
}

interface Puff {
  readonly dx: number
  readonly rx: number
  readonly ry: number
}

interface CloudSpec {
  readonly u: number
  readonly v: number
  /** Overlapping ellipses: a long low bank plus raised crowns, drawn as row spans. */
  readonly puffs: readonly Puff[]
}

/** Soft stratus banks kept out of the /new panel (u 0.27–0.73, v 0.07–0.47). */
const CLOUDS: readonly CloudSpec[] = [
  { u: 0.07, v: 0.13, puffs: [{ dx: 0, rx: 22, ry: 3 }, { dx: -8, rx: 9, ry: 5 }, { dx: 8, rx: 7, ry: 4 }] },
  { u: 0.20, v: 0.31, puffs: [{ dx: 0, rx: 30, ry: 3 }, { dx: -12, rx: 12, ry: 5 }, { dx: 10, rx: 10, ry: 4 }] },
  { u: 0.86, v: 0.17, puffs: [{ dx: 0, rx: 20, ry: 3 }, { dx: 6, rx: 9, ry: 5 }] },
]
const CLOUD_SPAN = 36
const CLOUD_SPEED = 0.3

/** Fills each ellipse row by row; the underside row is shadowed, the top row catches the warm rim. */
function drawCloud(ctx: BuildCtx, line: number, cx: number, cy: number, puffs: readonly Puff[]): void {
  const rows = new Map<number, { left: number; right: number }>()
  for (const p of puffs) {
    for (let dy = -p.ry; dy <= p.ry; dy++) {
      const half = p.rx * Math.sqrt(Math.max(0, 1 - (dy / p.ry) ** 2))
      const row = cy + dy
      const left = Math.round(cx + p.dx - half)
      const right = Math.round(cx + p.dx + half)
      const span = rows.get(row)
      if (span) {
        span.left = Math.min(span.left, left)
        span.right = Math.max(span.right, right)
      } else {
        rows.set(row, { left, right })
      }
    }
  }
  const ys = [...rows.keys()].sort((a, b) => a - b)
  const top = ys[0]!
  const bottom = ys[ys.length - 1]!
  for (const y of ys) {
    const { left, right } = rows.get(y)!
    const index = y === bottom ? Ink.CloudShadow : y === top ? Ink.CloudRim : Ink.CloudBody
    ctx.rect(left + 1, y, Math.max(1, right - left - 1), 1, index)
    // Feathered ends: the outermost pixel dithers into the sky band behind it
    const behind = Ink.Sky0 + skyBandAt(y, line)
    ctx.px(left, y, ctx.dither(left, y, 0.5, behind, index, 4))
    ctx.px(right, y, ctx.dither(right, y, 0.5, behind, index, 4))
  }
}

const scene: SceneDef = {
  id: 'vn-phu-quoc',
  name: { vi: 'Phú Quốc hoàng hôn', en: 'Phú Quốc Sunset' },
  region: 'vn',
  tone: 'both',
  defaultTime: 'dusk',
  themePalettes: PHU_QUOC_THEME_PALETTES,
  themeDefaultTime: { light: 'dawn', dark: 'dusk' },
  palettes: PHU_QUOC_LEGACY_PALETTES,
  cycles: [{ indices: [Ink.Wave0, Ink.Wave1, Ink.Wave2], rate: 6 }],
  horizon: HORIZON,
  focus: { x: 0.72, y: 0.65 },
  build(ctx) {
    const { width: w, height: h } = ctx
    const line = Math.floor(h * HORIZON)

    drawSky(ctx, line)
    drawIsland(ctx, line)
    drawWater(ctx, line)
    drawShore(ctx)

    // Draw palm trunks in near layer
    ctx.layer({ kind: 'near', z: 4 }, () => {
      // Hero palm trunk: foot at (0.12w, 1.0h), crown at (0.28w, 0.39h)
      drawPalmTrunk(ctx, w * 0.28, h * 0.39, w * 0.12, h * 1.00, 4.5, 2.5, 0.055)
      // Secondary palm trunk: foot at (0.04w, 1.0h), crown at (0.14w, 0.46h)
      drawPalmTrunk(ctx, w * 0.14, h * 0.46, w * 0.04, h * 1.00, 3.5, 2.0, 0.035)
    })
  },
  frame(ctx: FrameCtx, t) {
    const { width: w, height: h } = ctx
    const scale = Math.max(1, Math.floor(w / 480))
    const sunX = Math.floor(w * SUN_U)
    const sunY = Math.floor(h * SUN_V)
    const line = Math.floor(h * HORIZON)

    // 1. Drifting soft clouds, moon crescent, & seabirds (z: 1)
    ctx.layer({ kind: 'sky', z: 1 }, () => {
      if (ctx.time === 'night') {
        // Moon crescent cutout, painted in the sky band that sits behind the moon
        ctx.disc(sunX - 3, sunY - 2, 7, Ink.Sky0 + skyBandAt(sunY, line))
      }

      const period = w + CLOUD_SPAN * 2
      for (const cloud of CLOUDS) {
        const x0 = cloud.u * w
        const cx = ((x0 + t * CLOUD_SPEED) % period + period) % period - CLOUD_SPAN
        drawCloud(ctx, line, Math.round(cx), Math.round(cloud.v * h), cloud.puffs)
      }

      const birdDrift = ((t * 2.0 * 12) % (w + 60)) - 30
      const birdFrame = Math.floor(t * 6) % 4
      ctx.spriteFrame(seabirdSheet, birdFrame, Math.floor(w * 0.48 + birdDrift), Math.floor(h * 0.22 + Math.sin(t * 1.5) * 3), scale)
      ctx.spriteFrame(seabirdSheet, (birdFrame + 2) % 4, Math.floor(w * 0.54 + birdDrift), Math.floor(h * 0.25 + Math.cos(t * 1.5) * 3), scale)
    })

    // 2. Animated Shoreline Foam Wash (z: 3)
    ctx.layer({ kind: 'fx', z: 3 }, () => {
      // 8-second tide wash cycle advancing and receding 1-2px
      const washPhase = Math.sin((t * Math.PI * 2) / 8)
      const washAdvance = Math.round(washPhase * 2.5)

      for (let x = 0; x < w * 0.72; x++) {
        const shoreY = getShoreY(x, w, h, ctx)
        const waveLobe = Math.sin(x * 0.12 + t * 0.8) * 1.5
        const foamY = Math.floor(shoreY + washAdvance + waveLobe)

        if ((x + Math.floor(t * 3)) % 7 !== 2) {
          ctx.px(x, foamY, Ink.ShoreFoam)
        }
        if (washPhase > -0.2) {
          ctx.px(x, foamY - 1, Ink.ShoreFoam)
        }

        if (washAdvance < 0) {
          ctx.line(x, foamY + 1, x, shoreY + 3, Ink.SandWet)
        }
      }
    })

    // 3. Vietnamese Coastal Fishing Sampan with Water Reflection (z: 4)
    ctx.layer({ kind: 'fx', z: 4 }, () => {
      const boatY = Math.floor(h * 0.70 + Math.sin((t * Math.PI * 2) / 6.5))
      const boatX = Math.floor(w * 0.72)
      const boatFrame = Math.floor(t * 2) % 2
      ctx.spriteFrame(sampanSheet, boatFrame, boatX, boatY, scale)

      // Water reflection of wooden hull and warm lantern in water
      const rippleJitter = Math.sin(t * 3.5) > 0 ? 1 : 0
      ctx.line(boatX - 10, boatY + 5, boatX + 6, boatY + 5, Ink.TrunkDark)
      ctx.line(boatX - 8 + rippleJitter, boatY + 6, boatX + 3 + rippleJitter, boatY + 6, Ink.SeaNear)
      ctx.px(boatX - 12, boatY + 5, Ink.SunGlow)

      // Trailing wake lines behind sampan
      for (let i = 0; i < 3; i++) {
        ctx.line(boatX - 18 - i * 5, boatY + 3 + i, boatX - 10 - i * 4, boatY + 3 + i, Ink.ShoreFoam)
      }
    })

    // 4. Twin Leaning Coconut Palm Crowns (z: 5)
    // Anchored strictly to trunk crown pivots; NO floating stick!
    ctx.layer({ kind: 'near', z: 5 }, () => {
      const heroPose = Math.floor(t * 2) % 3
      const heroCrownX = Math.floor(w * 0.28)
      const heroCrownY = Math.floor(h * 0.39)
      ctx.spriteFrame(heroPalmCrownSheet, heroPose, heroCrownX, heroCrownY, scale)

      const secPose = (heroPose + 1) % 3
      const secCrownX = Math.floor(w * 0.14)
      const secCrownY = Math.floor(h * 0.46)
      ctx.spriteFrame(secPalmCrownSheet, secPose, secCrownX, secCrownY, scale)
    })
  },
}

export default scene
