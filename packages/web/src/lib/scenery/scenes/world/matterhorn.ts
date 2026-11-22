/**
 * Matterhorn v2: keeps the iconic hooked Stellisee peak, sunlit/shadowed
 * split snow faces, and lake-forest silhouette while replacing random cracks
 * and solid-black pines with faceted alpine strata, 3 snow-dusted pine
 * variants, scale-anchor valley cabin + chimney smoke, drifting far clouds,
 * valley birds, and fast pre-baked horizontal Stellisee reflection/wave cycling.
 */
import type { Point } from '../../engine/geometry'
import type { BuildCtx, FrameCtx, Mask, SceneDef } from '../../engine/types'
import {
  MATTERHORN_LEGACY_PALETTES,
  MATTERHORN_THEME_PALETTES,
  alpineCabin,
  birdSheet,
  pineBroad,
  pineMedium,
  pineTall,
  smokeSheet,
} from './matterhorn-sprites'

const STAR_SEEDS = [
  [0.09, 0.05], [0.18, 0.09], [0.27, 0.04], [0.36, 0.08], [0.46, 0.05],
  [0.54, 0.09], [0.62, 0.05], [0.81, 0.06], [0.91, 0.10], [0.14, 0.12],
  [0.41, 0.12], [0.86, 0.13],
] as const

const MATTERHORN_OUTLINE: readonly (readonly [number, number])[] = [
  [-0.56, 0.65],
  [-0.41, 0.59],
  [-0.29, 0.505],
  [-0.20, 0.405],
  [-0.135, 0.31],
  [-0.075, 0.215],
  [-0.038, 0.16],
  [-0.018, 0.144],
  [0.0, 0.14],
  [0.022, 0.165],
  [0.055, 0.27],
  [0.105, 0.395],
  [0.17, 0.52],
  [0.26, 0.615],
  [0.34, 0.65],
]

interface LakeRowSpan {
  y: number
  xStart: number
  xEnd: number
  /** Pre-baked lake index per pixel along [xStart..xEnd], shifted by +/-1px warp in frame(). */
  colors: Uint8Array
  /** Static non-zero cycle index where a horizontal ripple glint lives. */
  rippleMask: Uint8Array
}

interface MatterhornCache {
  width: number
  height: number
  horizonY: number
  peakOcclusion: Mask
  lakeMask: Mask
  lakeRows: LakeRowSpan[]
  cabinX: number
  cabinY: number
  birdOcclusion: Mask
}

const sceneCache = new WeakMap<Uint8Array, MatterhornCache>()

function peakUFromX(x: number, w: number, h: number): number {
  const span = Math.max(w, Math.round(h * 1.15))
  const anchorX = w * 0.78
  return (x - anchorX) / span
}

function sampleOutline(relU: number): number | undefined {
  if (relU < MATTERHORN_OUTLINE[0]![0]! || relU > MATTERHORN_OUTLINE[MATTERHORN_OUTLINE.length - 1]![0]!) {
    return undefined
  }
  for (let i = 0; i < MATTERHORN_OUTLINE.length - 1; i++) {
    const a = MATTERHORN_OUTLINE[i]!
    const b = MATTERHORN_OUTLINE[i + 1]!
    if (relU <= b[0]!) {
      const s = (relU - a[0]!) / Math.max(1e-5, b[0]! - a[0]!)
      return a[1]! + (b[1]! - a[1]!) * s
    }
  }
  return undefined
}

function evalCatmull(knots: readonly Point[], u: number): number {
  const n = knots.length
  if (u <= knots[0]!.x) return knots[0]!.y
  if (u >= knots[n - 1]!.x) return knots[n - 1]!.y
  let i = 0
  while (i < n - 2 && u > knots[i + 1]!.x) i++
  const p0 = knots[Math.max(0, i - 1)]!
  const p1 = knots[i]!
  const p2 = knots[i + 1]!
  const p3 = knots[Math.min(n - 1, i + 2)]!
  const t = (u - p1.x) / Math.max(1e-5, p2.x - p1.x)
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (
    (2 * p1.y) +
    (-p0.y + p2.y) * t +
    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
  )
}

function drawSky(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx
  const horizonY = Math.floor(h * 0.65)
  ctx.layer({ kind: 'sky', z: 0 }, () => {
    const seam = 5
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
    const sunR = Math.max(4, Math.round(Math.min(w, h) * 0.035))
    // Core sun disc (slot 4 matches sky[1] at night, rendering it 100% invisible at night)
    ctx.disc(sunX, sunY, sunR, 4)
    // Stepped radial glow: dither between local sky background and slot 4
    for (let dy = -sunR - 3; dy <= sunR + 3; dy++) {
      for (let dx = -sunR - 3; dx <= sunR + 3; dx++) {
        const d2 = dx * dx + dy * dy
        if (d2 > sunR * sunR && d2 <= (sunR + 3) * (sunR + 3)) {
          const px = sunX + dx
          const py = sunY + dy
          if (px >= 0 && px < w && py >= 0 && py < horizonY) {
            const bgSlot = py < first ? 0 : py < second ? 1 : 2
            ctx.px(px, py, ctx.dither(px, py, 0.45, bgSlot, 4))
          }
        }
      }
    }

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

function drawFarRidges(ctx: BuildCtx, peakOcclusion: Mask): void {
  const { width: w, height: h } = ctx
  const horizonY = Math.floor(h * 0.65)
  const knots0: readonly Point[] = [
    { x: -0.1, y: 0.49 }, { x: 0.0, y: 0.47 }, { x: 0.18, y: 0.44 },
    { x: 0.36, y: 0.49 }, { x: 0.56, y: 0.45 }, { x: 0.78, y: 0.43 },
    { x: 1.0, y: 0.47 }, { x: 1.1, y: 0.49 },
  ]
  const knots1: readonly Point[] = [
    { x: -0.1, y: 0.54 }, { x: 0.0, y: 0.53 }, { x: 0.14, y: 0.50 },
    { x: 0.29, y: 0.55 }, { x: 0.48, y: 0.50 }, { x: 0.85, y: 0.52 },
    { x: 1.0, y: 0.54 }, { x: 1.1, y: 0.56 },
  ]

  ctx.layer({ kind: 'far', z: 1 }, () => {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const top0 = Math.floor((evalCatmull(knots0, u) + (ctx.fbm1(u * 5) - 0.5) * 0.025) * h)
      const slope0 = evalCatmull(knots0, u + 0.004) - evalCatmull(knots0, u)
      const shade0 = Math.max(0, Math.min(1, slope0 * 800))
      for (let y = top0; y < horizonY; y++) {
        const d = (y - top0) / h
        const amt = shade0 * Math.min(1, d * 24)
        ctx.px(x, y, amt > 0.55 ? 9 : amt > 0.2 ? ctx.dither(x, y, (amt - 0.2) / 0.35, 8, 9) : 8)
      }

      const top1 = Math.floor((evalCatmull(knots1, u) + (ctx.fbm1(u * 7 + 19) - 0.5) * 0.025) * h)
      const slope1 = evalCatmull(knots1, u + 0.004) - evalCatmull(knots1, u)
      const shade1 = Math.max(0, Math.min(1, slope1 * 800))
      for (let y = top1; y < horizonY; y++) {
        const d = (y - top1) / h
        const amt = shade1 * Math.min(1, d * 24)
        ctx.px(x, y, amt > 0.55 ? 11 : amt > 0.2 ? ctx.dither(x, y, (amt - 0.2) / 0.35, 10, 11) : 10)
        peakOcclusion.set(x, y, 15)
      }
    }
  })
}

function drawMatterhornPeak(ctx: BuildCtx, peakOcclusion: Mask): void {
  const { width: w, height: h } = ctx
  const horizonY = Math.floor(h * 0.65)
  ctx.layer({ kind: 'mid', z: 3 }, () => {
    for (let x = 0; x < w; x++) {
      const relU = peakUFromX(x, w, h)
      const topV = sampleOutline(relU)
      if (topV === undefined) continue
      const topY = Math.max(0, Math.floor(topV * h))

      for (let y = topY; y < horizonY; y++) {
        peakOcclusion.set(x, y, 15)
        const v = y / h
        const spine = -0.01 - Math.max(0, v - 0.14) * 0.24 - Math.sin((v - 0.14) * 7.5) * 0.015
        const onSunFace = relU < spine
        const ridgeDist = Math.abs(relU - spine)

        // Multi-octave organic rock texture & strata grain
        const n1 = ctx.fbm2(x * 0.035, y * 0.045)
        const n2 = ctx.fbm2(x * 0.08, y * 0.09)
        const grain = ctx.fbm2(x * 0.16, y * 0.16)

        // Geological strata dipping ~35 degrees from Furggen to Zmutt
        const strata = Math.sin((relU - spine) * 26 - (v - 0.14) * 18 + n1 * 1.6)
        // Steep vertical rock fissures and couloir gullies
        const couloir = Math.sin((relU - spine) * 16 + (v - 0.14) * 26 + n2 * 1.7)

        // Elevation-based snowline (higher on steep rock, clinging to ledges)
        const snowLedge = strata > 0.25 || couloir > 0.40
        const snowLine = onSunFace ? (0.42 + strata * 0.04 + (n1 - 0.5) * 0.04) : (0.30 + (n1 - 0.5) * 0.04)
        const hasSnow = v < snowLine || (v < 0.52 && snowLedge && n2 > 0.42)

        let idx: number
        if (onSunFace) {
          // East face: sunlit alpenglow
          if (hasSnow) {
            // Crisp snow on upper summit & ledges
            if (ridgeDist < 0.018 || (v < 0.22 && strata > -0.2)) {
              idx = 12 // sunlit snow highlight
            } else if (strata > 0.15 || couloir > 0.35) {
              idx = 13 // sunlit snow midtone
            } else if (grain > 0.65) {
              idx = 23 // rock cleft peeking through snow
            } else {
              idx = 15 // granite ledge peeking through snow
            }
          } else {
            // Sunlit rock buttresses below snowline
            if (couloir > 0.68 && strata > 0.10) {
              idx = 13 // snow patch in lower couloir
            } else if (couloir < -0.35 || (strata < -0.30 && n2 < 0.40)) {
              idx = 23 // deep rock cleft shadow
            } else if (ridgeDist < 0.016) {
              idx = 13 // lit ridge crest
            } else if (grain > 0.72) {
              idx = 12 // sunlit quartzite sparkle
            } else {
              idx = 15 // sunlit warm granite face
            }
          }
        } else {
          // North face: steep, cold, shadowed abyss with narrow couloir snow ribbons
          if (hasSnow) {
            // Cold shadow snow in couloirs and upper ledges
            if (ridgeDist < 0.012) {
              idx = 13 // rim light catching the razor spine
            } else if (v < 0.22 && strata > 0.10) {
              idx = 14 // upper north face snow cap
            } else if (couloir > 0.48 && strata > -0.15) {
              idx = 14 // narrow diagonal snow ribbon down couloir
            } else if (grain > 0.65) {
              idx = 15 // cold slate ambient rock ledge
            } else {
              idx = 23 // deep shadow granite
            }
          } else {
            // Sheer lower north face
            if (couloir > 0.64 && n2 > 0.45) {
              idx = 14 // isolated snow pocket in couloir
            } else if (strata > 0.40 && grain > 0.45) {
              idx = 15 // ambient slate ledge
            } else {
              idx = 23 // deep shadow granite
            }
          }
        }
        ctx.px(x, y, idx)
      }

      // Crisp 1px alpenglow rim along the sunlit silhouette
      if (relU > -0.44 && relU <= -0.005 && (x % 3 !== 0)) {
        ctx.px(x, topY, 12)
      }
    }
  })
}

function drawValleyForestAndCabin(ctx: BuildCtx, peakOcclusion: Mask): { cabinX: number; cabinY: number } {
  const { width: w, height: h } = ctx
  const horizonY = Math.floor(h * 0.65)
  const cabinX = Math.round(w * 0.72)
  const cabinY = Math.round(h * 0.61)

  const benchKnots: readonly Point[] = [
    { x: 0.0, y: 0.615 },
    { x: 0.22, y: 0.625 },
    { x: 0.36, y: 0.620 },
    { x: 0.52, y: 0.635 },
    { x: 0.68, y: 0.625 },
    { x: 0.82, y: 0.618 },
    { x: 1.0, y: 0.612 },
  ]

  ctx.layer({ kind: 'mid', z: 4 }, () => {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const topY = Math.floor(evalCatmull(benchKnots, u) * h)
      for (let y = topY; y < horizonY; y++) {
        peakOcclusion.set(x, y, 15)
        ctx.px(x, y, y < topY + 2 ? 25 : 26)
      }
    }

    // 3 distinct pine models clustered naturally with breathing space
    const pines = [pineTall, pineMedium, pineBroad] as const
    const midTrees = [
      [0.04, 0.655, 0],
      [0.08, 0.660, 1],
      [0.12, 0.662, 2],
      [0.17, 0.658, 0],
      [0.21, 0.663, 1],
      [0.26, 0.660, 2],
      [0.42, 0.662, 0],
      [0.46, 0.665, 2],
      [0.65, 0.658, 1],
      [0.68, 0.662, 2],
      [0.82, 0.656, 0],
      [0.86, 0.660, 1],
      [0.91, 0.658, 0],
      [0.95, 0.662, 2],
      [0.98, 0.658, 1],
    ] as const
    for (const [tu, tv, variant] of midTrees) {
      const spr = pines[variant]!
      const sx = Math.round(tu * w - spr.width / 2)
      const sy = Math.round(tv * h - spr.height + 2)
      ctx.sprite(spr, sx, sy, 1)
      for (let py = 0; py < spr.height; py++) {
        for (let px = 0; px < spr.width; px++) {
          if (spr.pixels[py * spr.width + px]! >= 0) {
            peakOcclusion.set(sx + px, sy + py, 15)
          }
        }
      }
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

    // Warm amber window glow on doorstep/snow
    const winX = cx + 8
    for (let dy = 0; dy <= 3; dy++) {
      for (let dx = -3; dx <= 4; dx++) {
        const gx = winX + dx
        const gy = cy + alpineCabin.height + dy - 2
        if (gx >= 0 && gx < w && gy >= 0 && gy < h) {
          if ((dx * dx) / 9 + (dy * dy) / 4 <= 1.0) {
            ctx.px(gx, gy, dy === 0 ? 28 : 27)
          }
        }
      }
    }
  })

  return { cabinX, cabinY }
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
        let idx = d < 3 ? 31 : d < 8 ? 25 : 26
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
            ctx.px(rx + dx, ry + dy, dy < 0 && dx < 0 ? 31 : dy < 1 ? 15 : 23)
            lakeMask.set(rx + dx, ry + dy, 0)
          }
        }
      }
    }

    const pines = [pineTall, pineMedium, pineBroad] as const
    const nearTrees = [
      [0.04, 0.84, 0], [0.09, 0.88, 1], [0.15, 0.92, 2],
      [0.91, 0.87, 0], [0.96, 0.90, 1],
    ] as const
    for (const [tu, tv, variant] of nearTrees) {
      const spr = pines[variant]!
      const sx = Math.round(tu * w - spr.width / 2)
      const sy = Math.round(tv * h - spr.height + 2)
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

  // Pre-bake inverted mountain reflection & horizontal wavelet masks for <0.5ms frames.
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
      // Natural horizontal wind ripples (delicate wavelets)
      const wind = ctx.fbm2(x * 0.035, y * 0.18)
      const isRippleRow = (y % 4 === 1) || (y % 6 === 3 && depth > 0.3)
      const rippleStreak = ((x + y * 7) % 13) < 6
      if (isRippleRow && wind > 0.64 && rippleStreak) {
        rippleMask[i] = 16 + ((Math.floor(dist / 3) + Math.floor(x / 7)) % 6)
      }

      // Real inverted mountain reflection from landscape above horizon
      const srcIdx = ctx.base[srcRow + x]!
      if (srcIdx === 12) {
        colors[i] = 19 // sunlit alpenglow snow highlight reflection
      } else if (srcIdx === 13) {
        colors[i] = 18 // sunlit snow mid reflection
      } else if (srcIdx === 14) {
        colors[i] = 18 // shaded snow reflection
      } else if (srcIdx === 15) {
        colors[i] = 17 // sunlit rock reflection
      } else if (srcIdx === 23) {
        colors[i] = 22 // shadow rock / couloir reflection
      } else if (srcIdx === 25 || srcIdx === 26) {
        colors[i] = 22 // valley forest bench reflection
      } else if (srcIdx === 27 || srcIdx === 28) {
        colors[i] = 20 // chalet timber & window glow reflection
      } else if (srcIdx >= 8 && srcIdx <= 11) {
        colors[i] = 17 // far ridge reflection
      } else {
        // Sky reflection
        colors[i] = depth < 0.25 ? 17 : 16
      }
    }

    lakeRows.push({ y, xStart, xEnd, colors, rippleMask })
  }

  return lakeRows
}

function drawDriftingClouds(ctx: FrameCtx, t: number, w: number, h: number, peakOcclusion: Mask): void {
  const frame = ctx.frame
  const occ = peakOcclusion.coverage
  const clouds = [
    {
      baseU: 0.14,
      baseV: 0.34,
      speed: 0.15,
      puffs: [
        [0, 0, Math.round(w * 0.042), Math.round(h * 0.025)],
        [-Math.round(w * 0.032), 2, Math.round(w * 0.028), Math.round(h * 0.017)],
        [Math.round(w * 0.028), 1, Math.round(w * 0.034), Math.round(h * 0.021)],
        [Math.round(w * 0.056), 3, Math.round(w * 0.020), Math.round(h * 0.014)],
      ],
    },
    {
      baseU: 0.42,
      baseV: 0.41,
      speed: 0.12,
      puffs: [
        [0, 0, Math.round(w * 0.034), Math.round(h * 0.020)],
        [-Math.round(w * 0.026), 2, Math.round(w * 0.024), Math.round(h * 0.015)],
        [Math.round(w * 0.028), 2, Math.round(w * 0.022), Math.round(h * 0.014)],
      ],
    },
    {
      baseU: 0.89,
      baseV: 0.38,
      speed: 0.15,
      puffs: [
        [0, 0, Math.round(w * 0.035), Math.round(h * 0.021)],
        [-Math.round(w * 0.028), 2, Math.round(w * 0.022), Math.round(h * 0.014)],
        [Math.round(w * 0.026), 1, Math.round(w * 0.025), Math.round(h * 0.016)],
      ],
    },
  ] as const

  for (const c of clouds) {
    const cx = Math.round(((c.baseU * w + t * c.speed) % (w + 90)) - 45)
    const cy = Math.round(c.baseV * h)
    for (const [ox, oy, rx, ry] of c.puffs) {
      const rx2 = Math.max(1, rx * rx)
      const ry2 = Math.max(1, ry * ry)
      const maxDy = Math.floor(ry * 0.55)
      const litCut = Math.round(ry * 0.18)
      for (let dy = -ry; dy <= maxDy; dy++) {
        const py = cy + oy + dy
        if (py < 0 || py >= h) continue
        const rowOff = py * w
        const dyTerm = (dy * dy) / ry2
        const color = dy < litCut ? 6 : 7
        for (let dx = -rx; dx <= rx; dx++) {
          if ((dx * dx) / rx2 + dyTerm <= 1) {
            const px = cx + ox + dx
            if (px >= 0 && px < w && occ[rowOff + px] === 0) frame[rowOff + px] = color
          }
        }
      }
    }
  }
}

function drawLakeReflection(ctx: FrameCtx, t: number, cache: MatterhornCache): void {
  const { width: w, frame } = ctx
  const { lakeMask, lakeRows } = cache
  const warpTick = Math.floor(t * 3)
  const cov = lakeMask.coverage

  for (let r = 0; r < lakeRows.length; r++) {
    const row = lakeRows[r]!
    const y = row.y
    const dstRow = y * w
    const rowWarp = Math.round(Math.sin(y * 0.42 + warpTick * 0.85))
    const { xStart, xEnd, colors, rippleMask } = row
    const maxLocal = xEnd - xStart

    for (let x = xStart; x <= xEnd; x++) {
      const dst = dstRow + x
      if (cov[dst] === 0) continue
      const local = x - xStart
      const rip = rippleMask[local]!
      if (rip !== 0) {
        frame[dst] = rip
      } else {
        const srcLocal = local + rowWarp
        const clamped = srcLocal < 0 ? 0 : srcLocal > maxLocal ? maxLocal : srcLocal
        frame[dst] = colors[clamped]!
      }
    }
  }
}

function drawBirdsAndSmoke(ctx: FrameCtx, t: number, cache: MatterhornCache): void {
  const { width: w, height: h } = ctx

  const smokePose = Math.floor(t * 2) % 4
  ctx.spriteFrame(smokeSheet, smokePose, cache.cabinX + 5, cache.cabinY - 10, 1)

  const birds = [
    { startU: 0.28, baseV: 0.39, phase: 0, speed: 2.0 },
    { startU: 0.35, baseV: 0.42, phase: 2, speed: 1.85 },
  ] as const

  for (const b of birds) {
    const bx = Math.round(((b.startU * w + t * b.speed) % (w + 24)) - 12)
    const by = Math.round(b.baseV * h + Math.sin(t * 0.45 + b.phase) * 4)
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
    drawFarRidges(ctx, peakOcclusion)
    drawMatterhornPeak(ctx, peakOcclusion)
    const { cabinX, cabinY } = drawValleyForestAndCabin(ctx, peakOcclusion)
    const lakeRows = buildLakeAndShore(ctx, lakeMask, birdOcclusion)

    sceneCache.set(ctx.base, {
      width: w,
      height: h,
      horizonY: Math.floor(h * 0.65),
      peakOcclusion,
      lakeMask,
      lakeRows,
      cabinX,
      cabinY,
      birdOcclusion,
    })
  },
  frame(ctx, t) {
    const cache = sceneCache.get(ctx.base)
    if (!cache) return
    drawDriftingClouds(ctx, t, cache.width, cache.height, cache.peakOcclusion)
    drawLakeReflection(ctx, t, cache)
    drawBirdsAndSmoke(ctx, t, cache)
  },
}

export default scene
