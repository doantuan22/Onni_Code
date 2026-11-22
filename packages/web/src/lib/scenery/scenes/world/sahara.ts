/**
 * Sahara v2 rewrite: Erg Chebbi sweeping S-curve slip-face dune, knife-edge
 * crest ridge, clean atmospheric far dunes (no checkerboard heat haze),
 * 3-scale animated camel caravan (32x22 lead camel with leader figure and
 * amber rim light, 24x16 mid camel, 18x12 small camel), depth-shaded footprint
 * trail, and dynamic crest sand plume.
 */
import type { Point } from '../../engine/geometry'
import type { BuildCtx, FrameCtx, Mask, SceneDef } from '../../engine/types'
import {
  SAHARA_LEGACY_PALETTES,
  SAHARA_THEME_PALETTES,
  camelLargeSheet,
  camelMidSheet,
  camelSmallSheet,
  dryGrassSheet,
} from './sahara-sprites'

const STAR_SEEDS = [
  [0.08, 0.05], [0.15, 0.09], [0.23, 0.04], [0.34, 0.08], [0.43, 0.05],
  [0.52, 0.09], [0.61, 0.04], [0.69, 0.08], [0.87, 0.06], [0.93, 0.10],
  [0.12, 0.11], [0.47, 0.11],
] as const

const PARTICLE_COUNT = 48

interface SaharaCache {
  width: number
  height: number
  ridgeY: Float32Array
  nearTopY: Float32Array
  caravanY: Float32Array
  nearMask: Mask
  // Precomputed particle parameters for fast frame evaluation
  pPeriod: Float32Array
  pLife: Float32Array
  pPhase: Float32Array
  pSpawnX: Float32Array
  pBaseY: Float32Array
  pVx: Float32Array
  pVy: Float32Array
  pIsNear: Uint8Array
}

const sceneCache = new WeakMap<Uint8Array, SaharaCache>()

function hashInt(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  return (x ^ (x >>> 16)) >>> 0
}

/** Shared wind gust signal: calm base with a 2.6s ease-in/out gust every 11s. */
function windGust(t: number): number {
  const cycle = ((t % 11) + 11) % 11
  if (cycle < 7.8 || cycle > 10.4) return 0
  return Math.sin(((cycle - 7.8) / 2.6) * Math.PI)
}

/** Smooth C1 Catmull-Rom interpolation through sorted x knots. */
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

/** Distant dune ridge 1 (v = 0.38..0.43): gentle atmospheric erg silhouette. */
function farDune1(u: number): number {
  return evalCatmull([
    { x: -0.15, y: 0.42 },
    { x: 0.0, y: 0.412 },
    { x: 0.16, y: 0.385 },
    { x: 0.36, y: 0.428 },
    { x: 0.56, y: 0.395 },
    { x: 0.76, y: 0.375 },
    { x: 0.96, y: 0.422 },
    { x: 1.15, y: 0.43 },
  ], u)
}

/** Distant dune ridge 2 (v = 0.44..0.50): asymmetric windward/leeward slopes. */
function farDune2(u: number): number {
  return evalCatmull([
    { x: -0.15, y: 0.485 },
    { x: 0.0, y: 0.472 },
    { x: 0.14, y: 0.446 },
    { x: 0.34, y: 0.496 },
    { x: 0.53, y: 0.455 },
    { x: 0.72, y: 0.435 },
    { x: 0.88, y: 0.478 },
    { x: 1.0, y: 0.468 },
    { x: 1.15, y: 0.475 },
  ], u)
}

/**
 * Main mid-ground dune crest silhouette:
 * Rises majestically to an iconic knife-edge apex at (0.59, 0.542) and slopes
 * down to (0.93, 0.655), framing the camel caravan in the right gutter.
 */
function midDuneCrest(u: number): number {
  return evalCatmull([
    { x: -0.18, y: 0.595 },
    { x: 0.0, y: 0.582 },
    { x: 0.20, y: 0.592 },
    { x: 0.39, y: 0.575 },
    { x: 0.59, y: 0.542 },
    { x: 0.77, y: 0.592 },
    { x: 0.93, y: 0.655 },
    { x: 1.0, y: 0.678 },
    { x: 1.18, y: 0.715 },
  ], u)
}

/**
 * Organic sweeping S-curve slip-face spine:
 * Curves naturally from the knife-edge apex at (0.59, 0.542) down-left to (0.19, 0.93),
 * with wind-sculpted concave/convex curvature dividing lit sand from plum shadow.
 */
function slipSpineU(v: number): number {
  const s = Math.max(0, Math.min(1, (v - 0.542) / (0.93 - 0.542)))
  return 0.59 - 0.40 * (s * s * (3 - 2 * s)) + Math.sin(s * Math.PI) * 0.065 - Math.sin(s * Math.PI * 2) * 0.012
}

/** Caravan travel path winding along the dune ridge at (.57,.595), (.63,.61), (.72,.64). */
function caravanV(u: number): number {
  return evalCatmull([
    { x: -0.18, y: 0.62 },
    { x: 0.10, y: 0.61 },
    { x: 0.36, y: 0.59 },
    { x: 0.57, y: 0.595 },
    { x: 0.63, y: 0.61 },
    { x: 0.72, y: 0.64 },
    { x: 0.93, y: 0.692 },
    { x: 1.18, y: 0.745 },
  ], u)
}

/** Near foreground diagonal dune cutting the lower-left (v = 0.75..1.0). */
function nearDuneTop(u: number): number {
  if (u > 0.57) return 1.06
  return evalCatmull([
    { x: -0.05, y: 0.74 },
    { x: 0.0, y: 0.752 },
    { x: 0.18, y: 0.806 },
    { x: 0.36, y: 0.884 },
    { x: 0.51, y: 0.968 },
    { x: 0.57, y: 1.05 },
  ], u)
}

function drawSkyLayer(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx
  const skyMask = ctx.mask()
  skyMask.rect(0, 0, w, Math.ceil(h * 0.56))

  ctx.layer({ kind: 'sky', z: 0, mask: skyMask }, () => {
    const horizonPx = Math.floor(h * 0.52)
    const seam = Math.max(2, Math.round(h * 0.015)) // narrow <=6px dithered seams
    const first = Math.floor(horizonPx * 0.28)
    const second = Math.floor(horizonPx * 0.56)
    const third = Math.floor(horizonPx * 0.84)

    for (let y = 0; y < horizonPx; y++) {
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

    // Desert sun at (0.24, 0.22) in upper sky: clean 3-stage stepped radial glow (no checkerboard)
    const sunX = Math.round(w * 0.24)
    const sunY = Math.round(h * 0.22)
    const sunR = Math.max(5, Math.round(Math.min(w, h) * 0.048))
    for (let dy = -sunR - 4; dy <= sunR + 4; dy++) {
      for (let dx = -sunR - 4; dx <= sunR + 4; dx++) {
        const dist = Math.hypot(dx, dy)
        if (dist <= sunR) {
          ctx.px(sunX + dx, sunY + dy, 4) // sun core
        } else if (dist <= sunR + 2.5) {
          ctx.px(sunX + dx, sunY + dy, 5) // sun inner halo
        } else if (dist <= sunR + 4 && ((dx + dy) & 1) === 0) {
          ctx.px(sunX + dx, sunY + dy, 5) // outer soft fringe
        }
      }
    }

    // Quiet night stars and small crescent moon strictly inside solid sky[0] (v <= 0.11)
    for (let i = 0; i < STAR_SEEDS.length; i++) {
      const [su, sv] = STAR_SEEDS[i]!
      ctx.px(Math.round(su * w), Math.round(sv * h), i % 3 === 0 ? 6 : 7)
    }
    const moonX = Math.round(w * 0.79)
    const moonY = Math.round(h * 0.085)
    const moonR = Math.max(3, Math.round(Math.min(w, h) * 0.022))
    for (let dy = -moonR; dy <= moonR; dy++) {
      for (let dx = -moonR; dx <= moonR; dx++) {
        if (dx * dx + dy * dy <= moonR * moonR) {
          const cutX = dx - Math.max(1, Math.round(moonR * 0.45))
          const cutY = dy + Math.round(moonR * 0.25)
          if (cutX * cutX + cutY * cutY > moonR * moonR * 0.78) {
            ctx.px(moonX + dx, moonY + dy, 6)
          }
        }
      }
    }
  })
}

/**
 * Clean atmospheric far dunes without checkerboard heat haze ribbons.
 * Layer 1 and 2 provide depth stratification with soft atmospheric valley haze
 * hugging each dune's natural base contours.
 */
function drawFarDunes(ctx: BuildCtx): void {
  const { width: w, height: h } = ctx

  ctx.layer({ kind: 'far', z: 1 }, () => {
    for (let x = 0; x < w; x++) {
      const u = x / w

      // Far dune 1: atmospheric silhouette (roles 8 & 9)
      const top1 = Math.floor(farDune1(u) * h)
      const slope1 = farDune1(u + 0.005) - farDune1(u)
      const isShade1 = slope1 > 0.0002
      for (let y = top1; y < Math.ceil(h * 0.76); y++) {
        const d1 = (y - top1) / h
        let idx = isShade1 && d1 > 0.015 ? 9 : 8
        // Gentle atmospheric dust wash at base of far dune 1 (role 12)
        if (d1 > 0.045 && (y % 2 === 0 || d1 > 0.07)) {
          idx = 12
        }
        ctx.px(x, y, idx)
      }

      // Far dune 2: asymmetric windward/leeward slopes (roles 10 & 11)
      const top2 = Math.floor(farDune2(u) * h)
      const slope2 = farDune2(u + 0.005) - farDune2(u)
      const isShade2 = slope2 > 0.0003
      for (let y = top2; y < Math.ceil(h * 0.78); y++) {
        const d2 = (y - top2) / h
        let idx = isShade2 && d2 > 0.018 ? 11 : 10
        // Gentle warm valley dust wash at base of far dune 2 (role 13)
        if (d2 > 0.050 && (y % 2 === 0 || d2 > 0.08)) {
          idx = 13
        }
        ctx.px(x, y, idx)
      }
    }
  })
}

/**
 * Sweeping wind-carved mid dune with organic S-curve slip face and knife-edge crest.
 */
function drawMidDune(ctx: BuildCtx, ridgeY: Float32Array): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'mid', z: 3 }, () => {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const crestV = midDuneCrest(u)
      const topY = Math.floor(crestV * h)
      ridgeY[x] = topY

      for (let y = topY; y < h; y++) {
        const v = y / h
        const depth = v - crestV
        const spine = slipSpineU(v)
        const dxSpine = u - spine

        let idx: number
        if (v >= 0.542 && dxSpine >= 0) {
          // Leeward slip face: deep plum/violet shadow (roles 19, 20, 21)
          const slipWidth = 0.16 + (v - 0.542) * 0.26
          const slipT = dxSpine / slipWidth
          if (dxSpine < 0.014) idx = 21 // deep shadow well along knife-edge spine
          else if (slipT < 0.42) idx = 20 // mid plum slip-face shadow
          else if (slipT < 0.80) idx = 19 // ambient plum shadow
          else if (slipT < 1.05) idx = 18 // soft basin transition
          else idx = depth < 0.05 ? 17 : 18
        } else if (v >= 0.542 && dxSpine < 0) {
          // Windward sunlit slope (roles 14, 15, 16, 17)
          const distLeft = -dxSpine
          const litBand = 0.08 + (v - 0.542) * 0.15
          const midBand = 0.22 + (v - 0.542) * 0.18
          if (distLeft < 0.012) idx = 14 // crisp sunlit rim
          else if (distLeft < litBand) idx = 15 // bright sunlit dune face
          else if (distLeft < midBand) idx = 16 // mid golden sand
          else idx = 17 // warm base sand
        } else {
          // Crest body
          idx = depth < 0.02 ? 15 : depth < 0.07 ? 16 : depth < 0.14 ? 17 : 18
        }

        // Delicate eolian sand micro-ripples across windward face (12-18% subtle stipple)
        if ((idx === 16 || idx === 17) && depth > 0.025) {
          if ((y + Math.floor(x * 0.16)) % 4 === 0 && ((x * 17 + y * 7) % 11 < 3)) {
            idx = idx === 16 ? 17 : 18
          }
        }
        ctx.px(x, y, idx)
      }

      // Continuous, razor-sharp 1px sunlit rim highlight along the knife-edge crest (role 14)
      if (u >= 0.18 && u <= 0.90) {
        ctx.px(x, topY, 14)
      }
    }

    // Crisp 1px spine edge dividing lit sand from leeward shadow
    for (let y = Math.floor(h * 0.542); y < Math.floor(h * 0.93); y++) {
      const sx = Math.round(slipSpineU(y / h) * w)
      if (sx >= 0 && sx < w) {
        ctx.px(sx, y, 14) // knife-edge rim highlight
        if (sx + 1 < w) ctx.px(sx + 1, y, 21) // immediate deep shadow contact
      }
    }
  })
}

function drawNearDune(ctx: BuildCtx, nearTopY: Float32Array, nearMask: Mask): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'near', z: 5 }, () => {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const topV = nearDuneTop(u)
      const topY = Math.floor(topV * h)
      nearTopY[x] = topY
      if (topY >= h) continue
      for (let y = Math.max(0, topY); y < h; y++) {
        nearMask.set(x, y, 15)
        const depth = (y - topY) / Math.max(1, h - topY)
        let idx = depth < 0.08 ? 22 : depth < 0.45 ? 23 : 24
        if (depth > 0.12 && depth < 0.38 && ((x * 17 + y * 31) % 13 === 0)) {
          idx = 24
        }
        ctx.px(x, y, idx)
      }
      if (topY >= 0 && topY < h && (x % 4 !== 0)) ctx.px(x, topY, 22)
    }

    // Desert stones with contact shadow (roles 28 & 29)
    const stones = [
      [0.14, 0.87, 3],
      [0.29, 0.93, 2],
      [0.08, 0.94, 2],
    ] as const
    for (const [su, sv, r] of stones) {
      const sx = Math.round(su * w)
      const sy = Math.round(sv * h)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= r) {
            ctx.px(sx + dx, sy + dy, dy < 0 ? 29 : 28)
          }
        }
      }
      ctx.line(sx + 1, sy + 1, sx + r + 2, sy + 1, 24)
    }
  })
}

/**
 * 3-scale camel caravan with leader figure, amber rim light, and depth-shaded footprint trail.
 * Uses ctx.spriteFrame for efficient, high-performance rendering.
 */
function drawCaravanAndTrail(ctx: FrameCtx, t: number, w: number, cache: SaharaCache): void {
  const span = 1.26
  const speedU = 0.45 / Math.max(320, w)
  const travel = t * speedU

  const members = [
    { baseU: 0.72, sheet: camelLargeSheet, phase: 0, shadowOffsets: [-11, -2, 12], shadowWidths: [5, 5, 4], bobAmp: 1 },
    { baseU: 0.63, sheet: camelMidSheet, phase: 1.7, shadowOffsets: [-8, -2], shadowWidths: [4, 4], bobAmp: 1 },
    { baseU: 0.57, sheet: camelSmallSheet, phase: 3.1, shadowOffsets: [-6, -1], shadowWidths: [3, 3], bobAmp: 0 },
  ] as const

  const wrapU = (u: number): number => ((((u + 0.14) % span) + span) % span) - 0.14

  // Winding caravan trail with paired depth-shaded footprints along the crest
  const leadRawU = members[0].baseU + travel
  const stepU = 0.012
  const trailLen = 0.22
  const maxKnot = Math.floor(leadRawU / stepU)
  const minKnot = Math.floor((leadRawU - trailLen) / stepU)
  for (let k = minKnot; k <= maxKnot; k++) {
    const ku = wrapU(k * stepU)
    if (ku < -0.02 || ku > 1.02) continue
    const kx = Math.round(ku * w)
    if (kx < 0 || kx >= w) continue
    const ky = Math.round(cache.caravanY[kx]!)

    // Paired footprints: shadow depression (21) + sunlit sand rim (15)
    const stagger = (k % 2 === 0 ? 0 : 1)
    ctx.px(kx, ky + stagger, 21)
    if (leadRawU - k * stepU < 0.14) {
      ctx.px(kx + 1, ky + stagger, 15)
    }
  }

  // Draw caravan members (far to near order: small -> mid -> lead)
  for (let i = members.length - 1; i >= 0; i--) {
    const m = members[i]!
    const cu = wrapU(m.baseU + travel)
    if (cu < -0.10 || cu > 1.10) continue
    const cx = Math.round(cu * w)
    if (cx < 0 || cx >= w) continue
    const cy = Math.round(cache.caravanY[cx]!)
    const pose = Math.floor(t * 4 + m.phase) % 4
    const bob = m.bobAmp && (pose === 1 || pose === 3) ? -1 : 0

    // Ground contact shadows clustered under feet (role 21)
    for (let s = 0; s < m.shadowOffsets.length; s++) {
      ctx.rect(cx + m.shadowOffsets[s]!, cy + 1, m.shadowWidths[s]!, 1, 21)
    }

    // Render animated sprite frame via engine's fast rect-fill
    ctx.spriteFrame(m.sheet, pose, cx, cy + bob, 1)
  }
}

/**
 * Localized windblown sand drift particle system:
 * 48 precomputed particles streaming off the sharp crest knife-edge at 3.6–6.8 px/s.
 */
function drawCrestSandParticles(ctx: FrameCtx, t: number, cache: SaharaCache, gust: number): void {
  const { width: w, height: h } = ctx
  const windMul = 1.0 + gust * 0.85

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const period = cache.pPeriod[i]!
    const total = t + cache.pPhase[i]!
    const age = total % period
    if (age > cache.pLife[i]!) continue
    if (i >= 30 && gust < 0.20) continue

    const spawnX = cache.pSpawnX[i]!
    const baseY = cache.pBaseY[i]!
    const vx = cache.pVx[i]! * windMul
    const vy = cache.pVy[i]!

    const px = Math.round(spawnX + vx * age)
    const py = Math.round(baseY + vy * age)
    if (px < 0 || px >= w || py < 0 || py >= h) continue

    // Fresh particles are bright glints (30), trailing particles warm dust (31)
    const color = age < cache.pLife[i]! * 0.45 ? 30 : 31
    ctx.px(px, py, color)
    if (cache.pIsNear[i] && gust > 0.35) {
      ctx.px(px + 1, py, color)
    } else if (gust > 0.40 && age < cache.pLife[i]! * 0.30) {
      ctx.px(px - 1, py, color) // subtle dynamic wisp during strong gusts
    }
  }
}

const scene: SceneDef = {
  id: 'world-sahara',
  name: { en: 'Sahara dunes', vi: 'Cồn cát Sahara' },
  region: 'world',
  tone: 'both',
  palettes: SAHARA_LEGACY_PALETTES,
  themePalettes: SAHARA_THEME_PALETTES,
  defaultTime: 'dusk',
  themeDefaultTime: { light: 'day', dark: 'dusk' },
  horizon: 0.42,
  focus: { x: 0.73, y: 0.64 },
  build(ctx) {
    const { width: w, height: h } = ctx
    const ridgeY = new Float32Array(w)
    const nearTopY = new Float32Array(w)
    const caravanY = new Float32Array(w)
    const nearMask = ctx.mask()

    drawSkyLayer(ctx)
    drawFarDunes(ctx)
    drawMidDune(ctx, ridgeY)
    drawNearDune(ctx, nearTopY, nearMask)

    // Precompute caravan Y coordinates across all X
    for (let x = 0; x < w; x++) {
      caravanY[x] = caravanV(x / w) * h
    }

    // Precompute particle parameters for fast frame() evaluation
    const pPeriod = new Float32Array(PARTICLE_COUNT)
    const pLife = new Float32Array(PARTICLE_COUNT)
    const pPhase = new Float32Array(PARTICLE_COUNT)
    const pSpawnX = new Float32Array(PARTICLE_COUNT)
    const pBaseY = new Float32Array(PARTICLE_COUNT)
    const pVx = new Float32Array(PARTICLE_COUNT)
    const pVy = new Float32Array(PARTICLE_COUNT)
    const pIsNear = new Uint8Array(PARTICLE_COUNT)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const h1 = hashInt(ctx.seed * 73 + i * 31 + 1)
      const h2 = hashInt(ctx.seed * 97 + i * 53 + 2)
      const eh = hashInt(ctx.seed * 131 + i * 17 + 409)
      const isNear = i < 4

      pPeriod[i] = 2.8 + (h1 % 180) / 100
      pLife[i] = 2.2 + (h2 % 120) / 100
      pPhase[i] = (((h1 >>> 8) % 1000) / 1000) * pPeriod[i]!
      pIsNear[i] = isNear ? 1 : 0

      const spawnU = isNear ? 0.05 + ((eh % 400) / 1000) : 0.52 + ((eh % 420) / 1000)
      const sx = spawnU * w
      pSpawnX[i] = sx
      const sxClamped = Math.max(0, Math.min(w - 1, Math.round(sx)))
      const by = isNear ? nearTopY[sxClamped]! : ridgeY[sxClamped]!
      const yJitter = ((eh >>> 10) % 3) - 1
      pBaseY[i] = by + yJitter
      pVx[i] = 3.6 * (0.90 + ((eh >>> 14) % 30) / 100)
      pVy[i] = -0.35 + ((eh >>> 18) % 20) / 100
    }

    sceneCache.set(ctx.base, {
      width: w,
      height: h,
      ridgeY,
      nearTopY,
      caravanY,
      nearMask,
      pPeriod,
      pLife,
      pPhase,
      pSpawnX,
      pBaseY,
      pVx,
      pVy,
      pIsNear,
    })
  },
  frame(ctx, t) {
    const cache = sceneCache.get(ctx.base)
    if (!cache) return
    const { width: w, height: h } = ctx
    const gust = windGust(t)

    // 1. Animated 3-camel caravan + depth-shaded footprint trail along ridge
    drawCaravanAndTrail(ctx, t, w, cache)

    // 2. Dry desert grass tufts swaying with shared wind gust (3 poses, 2fps)
    const grassPose = gust > 0.55 ? 2 : gust > 0.15 ? 1 : (Math.floor(t * 2) % 2)
    ctx.spriteFrame(dryGrassSheet, grassPose, Math.round(w * 0.19), Math.round(h * 0.81), 1)
    ctx.spriteFrame(dryGrassSheet, (grassPose + 1) % 3, Math.round(w * 0.34), Math.round(h * 0.89), 1)

    // 3. 48-particle knife-edge crest sand plume + wind gust burst
    drawCrestSandParticles(ctx, t, cache, gust)
  },
}

export default scene
