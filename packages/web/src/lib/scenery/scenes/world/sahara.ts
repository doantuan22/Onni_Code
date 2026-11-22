/**
 * Sahara v2 redraw: Erg Chebbi sweeping S-curve slip-face dune, atmospheric
 * far dunes, masked desert heat haze, 3-scale animated camel caravan with
 * bounded footprint trail, and wind-gust crest sand + dry scrub.
 */
import type { BuildCtx, FrameCtx, Mask, Point, SceneDef } from '../../engine/types'
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

interface SaharaCache {
  width: number
  height: number
  ridgeY: Float32Array
  nearTopY: Float32Array
  hazeMask: Mask
  nearMask: Mask
  hazeBandTop: number
  hazeBandBottom: number
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

/** Smooth C1 Catmull-Rom interpolation through sorted x knots (no flat-slope seams). */
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

/** Distant dune ridge 1 (v = 0.38..0.46): gentle atmospheric erg silhouette. */
function farDune1(u: number): number {
  return evalCatmull([
    { x: -0.1, y: 0.42 },
    { x: 0.0, y: 0.415 },
    { x: 0.18, y: 0.39 },
    { x: 0.39, y: 0.435 },
    { x: 0.60, y: 0.405 },
    { x: 0.80, y: 0.385 },
    { x: 1.0, y: 0.42 },
    { x: 1.1, y: 0.43 },
  ], u)
}

/** Distant dune ridge 2 (v = 0.44..0.54): asymmetric windward/leeward shapes. */
function farDune2(u: number): number {
  return evalCatmull([
    { x: -0.1, y: 0.49 },
    { x: 0.0, y: 0.478 },
    { x: 0.15, y: 0.452 },
    { x: 0.33, y: 0.502 },
    { x: 0.52, y: 0.464 },
    { x: 0.70, y: 0.446 },
    { x: 0.87, y: 0.486 },
    { x: 1.0, y: 0.472 },
    { x: 1.1, y: 0.485 },
  ], u)
}

/** Main mid-ground dune crest silhouette rising to (0.62, 0.56) and sloping to (0.93, 0.66). */
function midDuneCrest(u: number): number {
  return evalCatmull([
    { x: -0.18, y: 0.59 },
    { x: 0.0, y: 0.568 },
    { x: 0.22, y: 0.582 },
    { x: 0.44, y: 0.568 },
    { x: 0.62, y: 0.56 },
    { x: 0.78, y: 0.602 },
    { x: 0.93, y: 0.66 },
    { x: 1.0, y: 0.682 },
    { x: 1.18, y: 0.72 },
  ], u)
}

/** Sweeping S-curve slip-face spine from (0.62, 0.56) down-left to (0.24, 0.89). */
function slipSpineU(v: number): number {
  const s = Math.max(0, Math.min(1, (v - 0.56) / (0.92 - 0.56)))
  return 0.62 - 0.38 * (s * s * (3 - 2 * s)) + Math.sin(s * Math.PI) * 0.055
}

/** Caravan travel path passing through (.59,.59), (.64,.61), (.72,.64). */
function caravanV(u: number): number {
  return evalCatmull([
    { x: -0.18, y: 0.615 },
    { x: 0.10, y: 0.605 },
    { x: 0.36, y: 0.585 },
    { x: 0.59, y: 0.59 },
    { x: 0.64, y: 0.61 },
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
    for (let y = 0; y < horizonPx; y++) {
      const t = y / Math.max(1, horizonPx)
      for (let x = 0; x < w; x++) {
        let idx: number
        if (t < 0.25) idx = 0
        else if (t < 0.33) idx = ctx.dither(x, y, (t - 0.25) / 0.08, 0, 1)
        else if (t < 0.55) idx = 1
        else if (t < 0.63) idx = ctx.dither(x, y, (t - 0.55) / 0.08, 1, 2)
        else if (t < 0.82) idx = 2
        else if (t < 0.90) idx = ctx.dither(x, y, (t - 0.82) / 0.08, 2, 3)
        else idx = 3
        ctx.px(x, y, idx)
      }
    }

    // Sun at (0.25, 0.23) in solid sky[1], clear of dune crests; equals sky[1] at night.
    const sunX = Math.round(w * 0.25)
    const sunY = Math.round(h * 0.23)
    const sunR = Math.max(5, Math.round(Math.min(w, h) * 0.050))
    for (let dy = -sunR - 3; dy <= sunR + 3; dy++) {
      for (let dx = -sunR - 3; dx <= sunR + 3; dx++) {
        const dist = Math.hypot(dx, dy)
        if (dist <= sunR) ctx.px(sunX + dx, sunY + dy, 4)
        else if (dist <= sunR + 2 && ((dx + dy) & 1) === 0) ctx.px(sunX + dx, sunY + dy, 5)
      }
    }

    // Quiet stars and small crescent moon strictly inside solid sky[0] (v <= 0.11).
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

function drawFarDunes(ctx: BuildCtx, hazeMask: Mask): { hazeTop: number; hazeBottom: number } {
  const { width: w, height: h } = ctx
  let hazeTop = h
  let hazeBottom = 0

  ctx.layer({ kind: 'far', z: 1 }, () => {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const top1 = Math.floor(farDune1(u) * h)
      const slope1 = farDune1(u + 0.004) - farDune1(u)
      // Smooth diagonal shadow slope along leeward sides (no abrupt vertical column jumps).
      const shade1 = Math.max(0, Math.min(1, slope1 * 900))
      for (let y = top1; y < Math.ceil(h * 0.76); y++) {
        const d1 = (y - top1) / h
        const amt = shade1 * Math.min(1, d1 * 28)
        ctx.px(x, y, amt > 0.55 ? 9 : amt > 0.2 ? ctx.dither(x, y, (amt - 0.2) / 0.35, 8, 9) : 8)
      }

      const top2 = Math.floor(farDune2(u) * h)
      const slope2 = farDune2(u + 0.004) - farDune2(u)
      const shade2 = Math.max(0, Math.min(1, slope2 * 900))
      for (let y = top2; y < Math.ceil(h * 0.78); y++) {
        const d2 = (y - top2) / h
        const amt = shade2 * Math.min(1, d2 * 24)
        ctx.px(x, y, amt > 0.5 ? 11 : amt > 0.15 ? ctx.dither(x, y, (amt - 0.15) / 0.35, 10, 11) : 10)
      }

      // Soft, organic desert heat haze wisps curving naturally into low valley saddles.
      const midTop = Math.floor(midDuneCrest(u) * h)
      const bandTop = Math.max(top2 + 4, Math.floor(h * 0.495 + Math.sin(u * 7.5) * h * 0.012))
      const bandBot = Math.min(midTop - 1, bandTop + Math.max(4, Math.round(h * 0.045)))
      if (bandTop < bandBot) {
        hazeTop = Math.min(hazeTop, bandTop)
        hazeBottom = Math.max(hazeBottom, bandBot)
        for (let y = bandTop; y < bandBot; y++) {
          const tBand = (y - bandTop) / Math.max(1, bandBot - bandTop)
          const envelope = Math.sin(tBand * Math.PI)
          const pocket = ctx.fbm2(x * 0.018, y * 0.06)
          if (pocket * envelope > 0.50) {
            hazeMask.set(x, y, 15)
            ctx.px(x, y, ctx.dither(x, y, envelope * 0.55, 13, 12))
          }
        }
      }
    }
  })

  return { hazeTop, hazeBottom }
}

function drawMidDune(ctx: BuildCtx, ridgeY: Float32Array): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'mid', z: 3 }, () => {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const crestV = midDuneCrest(u)
      const topY = Math.floor(crestV * h)
      ridgeY[x] = topY
      const slope = midDuneCrest(u + 0.004) - crestV

      for (let y = topY; y < h; y++) {
        const v = y / h
        const depth = v - crestV
        const spine = slipSpineU(v)
        const dxSpine = u - spine

        let idx: number
        if (v >= 0.56 && dxSpine >= 0) {
          const slipWidth = 0.14 + (v - 0.56) * 0.22
          const slipT = dxSpine / slipWidth
          if (dxSpine < 0.012) idx = 21
          else if (slipT < 0.36) idx = 20
          else if (slipT < 0.68) idx = 19
          else if (slipT < 0.92) idx = ctx.dither(x, y, (slipT - 0.68) / 0.24, 19, 18)
          else idx = depth < 0.06 ? 17 : 18
        } else if (v >= 0.56 && dxSpine < 0) {
          const distLeft = -dxSpine
          if (distLeft < 0.009 && (x + y) % 4 !== 0) idx = 14
          else if (distLeft < 0.055) idx = 15
          else if (distLeft < 0.17) idx = 16
          else idx = 17
        } else {
          idx = depth < 0.022 ? 15 : depth < 0.075 ? 16 : depth < 0.15 ? 17 : 18
        }

        if ((idx === 16 || idx === 17) && depth > 0.03) {
          const cluster = ctx.fbm2(x * 0.035, y * 0.09)
          if (cluster > 0.67 && (y + Math.floor(x * 0.14)) % 4 === 0 && (x % 7 < 4)) {
            idx = idx === 16 ? 17 : 18
          }
        }
        ctx.px(x, y, idx)
      }

      if (u >= 0.36 && u <= 0.64 && slope <= 0.0001 && (x % 4 !== 0)) {
        ctx.px(x, topY, 14)
      }
    }

    for (let y = Math.floor(h * 0.56); y < Math.floor(h * 0.90); y++) {
      const sx = Math.round(slipSpineU(y / h) * w)
      if ((y % 3) !== 0) ctx.px(sx - 1, y, 14)
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
        if (depth > 0.12 && depth < 0.38 && ctx.fbm2(x * 0.06, y * 0.1) > 0.68 && y % 3 === 0) {
          idx = 24
        }
        ctx.px(x, y, idx)
      }
      if (topY >= 0 && topY < h && x % 3 !== 0) ctx.px(x, topY, 22)
    }

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

function drawCaravanAndTrail(ctx: FrameCtx, t: number, w: number, h: number, nearMask: Mask): void {
  const span = 1.26
  const speedU = 0.45 / Math.max(320, w)
  const travel = t * speedU
  const scale = 1

  const members = [
    { baseU: 0.72, sheet: camelLargeSheet, phase: 0, shadowW: 11, bobAmp: 1 },
    { baseU: 0.64, sheet: camelMidSheet, phase: 1.7, shadowW: 8, bobAmp: 1 },
    { baseU: 0.59, sheet: camelSmallSheet, phase: 3.1, shadowW: 5, bobAmp: 0 },
  ] as const

  const wrapU = (u: number): number => ((((u + 0.14) % span) + span) % span) - 0.14

  const leadRawU = members[0].baseU + travel
  const stepU = 0.014
  const trailLen = 0.20
  const maxKnot = Math.floor(leadRawU / stepU)
  const minKnot = Math.floor((leadRawU - trailLen) / stepU)
  for (let k = minKnot; k <= maxKnot; k++) {
    const ku = wrapU(k * stepU)
    if (ku < -0.02 || ku > 1.02) continue
    const kx = Math.round(ku * w)
    const ky = Math.round(caravanV(ku) * h) + (k % 2 === 0 ? 0 : 1)
    if (nearMask.contains(kx, ky)) continue
    ctx.px(kx, ky, 21)
    if (leadRawU - k * stepU < 0.10) ctx.px(kx + 1, ky, 21)
  }

  for (const m of members) {
    const cu = wrapU(m.baseU + travel)
    if (cu < -0.08 || cu > 1.08) continue
    const cx = Math.round(cu * w)
    const cy = Math.round(caravanV(cu) * h)
    const pose = Math.floor(t * 4 + m.phase) % 4
    const bob = m.bobAmp && (pose === 1 || pose === 3) ? -1 : 0

    for (let sx = -Math.floor(m.shadowW * 0.4); sx <= Math.floor(m.shadowW * 0.65); sx++) {
      const px = cx + sx + 1
      const py = cy + 1
      if (!nearMask.contains(px, py)) ctx.px(px, py, 21)
    }

    const item = m.sheet.frames[((pose % m.sheet.frames.length) + m.sheet.frames.length) % m.sheet.frames.length]!
    const pivot = item.pivot ?? { x: 0, y: 0 }
    for (let sy = 0; sy < item.height; sy++) {
      for (let sx = 0; sx < item.width; sx++) {
        const idx = m.sheet.sprite.pixels[(item.y + sy) * m.sheet.sprite.width + item.x + sx]!
        if (idx >= 0) {
          const px = cx + (sx - pivot.x) * scale
          const py = cy + bob + (sy - pivot.y) * scale
          if (!nearMask.contains(px, py)) ctx.px(px, py, idx)
        }
      }
    }
  }
}

function drawCrestSandParticles(ctx: FrameCtx, t: number, cache: SaharaCache, gust: number): void {
  const { width: w, height: h } = ctx
  const count = 48
  const windSpeed = 2.6 + gust * 2.4

  for (let i = 0; i < count; i++) {
    const h1 = hashInt(ctx.seed * 73 + i * 31 + 1)
    const h2 = hashInt(ctx.seed * 97 + i * 53 + 2)
    const period = 3.0 + (h1 % 200) / 100
    const life = 2.6 + (h2 % 140) / 100
    const phase = ((h1 >>> 8) % 1000) / 1000 * period
    const total = t + phase
    const epoch = Math.floor(total / period)
    const age = total - epoch * period
    if (age > life) continue

    const eh = hashInt(ctx.seed * 131 + i * 17 + epoch * 409)
    const isNear = i < 4
    const spawnU = isNear
      ? 0.05 + ((eh % 420) / 1000)
      : 0.25 + ((eh % 680) / 1000)
    const spawnX = spawnU * w
    const sxClamped = Math.max(0, Math.min(w - 1, Math.round(spawnX)))
    const baseY = isNear ? cache.nearTopY[sxClamped]! : cache.ridgeY[sxClamped]!
    if (baseY >= h) continue

    if (i >= 32 && gust < 0.25) continue

    const yJitter = ((eh >>> 10) % 4) - 2
    const vx = windSpeed * (0.85 + ((eh >>> 14) % 35) / 100)
    const vy = -0.35 + ((eh >>> 18) % 25) / 100
    const px = Math.round(spawnX + vx * age)
    const py = Math.round(baseY + yJitter + vy * age + Math.sin(t * 1.4 + i) * 0.5)
    if (px < 0 || px >= w || py < 0 || py >= h) continue
    if (!isNear && cache.nearMask.contains(px, py)) continue

    const color = age < life * 0.55 ? 30 : 31
    ctx.px(px, py, color)
    if (isNear && gust > 0.35) ctx.px(px + 1, py, color)
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
    const hazeMask = ctx.mask()
    const nearMask = ctx.mask()

    drawSkyLayer(ctx)
    const { hazeTop, hazeBottom } = drawFarDunes(ctx, hazeMask)
    drawMidDune(ctx, ridgeY)
    drawNearDune(ctx, nearTopY, nearMask)

    sceneCache.set(ctx.base, {
      width: w,
      height: h,
      ridgeY,
      nearTopY,
      hazeMask,
      nearMask,
      hazeBandTop: hazeTop,
      hazeBandBottom: hazeBottom,
    })
  },
  frame(ctx, t) {
    const cache = sceneCache.get(ctx.base)
    if (!cache) return
    const { width: w, height: h } = ctx
    const gust = windGust(t)

    // 1. Soft desert haze drift inside masked valley pockets (3fps tick, 1px amplitude).
    const hazeTick = Math.floor(t * 3)
    const hazeShift = Math.round(t * 0.2) + (hazeTick & 1)
    for (let y = cache.hazeBandTop; y <= cache.hazeBandBottom; y += 2) {
      for (let x = 0; x < w; x += 5) {
        if (!cache.hazeMask.contains(x, y)) continue
        if (((x + hazeShift + y * 7) % 17) === 0) {
          ctx.px(x + ((hazeTick + y) & 1), y, 12)
        }
      }
    }

    // 2. Animated 3-camel caravan + bounded footprint trail along ridge.
    drawCaravanAndTrail(ctx, t, w, h, cache.nearMask)

    // 3. Dry desert grass tufts swaying with shared wind gust (3 poses, 2fps).
    const grassPose = gust > 0.55 ? 2 : gust > 0.15 ? 1 : (Math.floor(t * 2) % 2)
    ctx.spriteFrame(dryGrassSheet, grassPose, Math.round(w * 0.19), Math.round(h * 0.81), 1)
    ctx.spriteFrame(dryGrassSheet, (grassPose + 1) % 3, Math.round(w * 0.34), Math.round(h * 0.89), 1)

    // 4. 48-particle crest-band sand drift + wind-gust burst.
    drawCrestSandParticles(ctx, t, cache, gust)
  },
}

export default scene
