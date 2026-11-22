import { darkness } from '../../engine/palette'
import { ParticlePool } from '../../engine/particles'
import type { BuildCtx, FrameCtx, LayerSpec, Mask, Palettes, SceneDef } from '../../engine/types'
import { cabinSprite, smokeSheet, spruceSmall, spruceTall, tromsoThemePalettes } from './tromso-sprites'

/**
 * Reference (§3.7, R5b, R7, R8): Tromsø Fjord & Aurora Borealis.
 * Night/dusk features continuous sinuous emerald-to-violet aurora curtains evaluated
 * on a coarse subgrid with dual-sine hem and smooth fbm1 ray modulation, moonlit
 * mountain relief, a warm Falun-red Rorbu cabin with elliptical snow spill and
 * broken fjord reflections, curling chimney smoke, twinkling stars, and multi-tier
 * snowfall. Day/dawn swaps cleanly to an Arctic winter sun with stepped radial glow,
 * wispy drifting polar cirrus clouds, and a tapered fjord sun-glint corridor.
 */
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

const STARS = [
  { u: 0.05, v: 0.07, bright: true },
  { u: 0.11, v: 0.19, bright: false },
  { u: 0.18, v: 0.05, bright: false },
  { u: 0.23, v: 0.14, bright: true },
  { u: 0.28, v: 0.08, bright: false },
  { u: 0.34, v: 0.13, bright: false },
  { u: 0.39, v: 0.04, bright: true },
  { u: 0.45, v: 0.17, bright: false },
  { u: 0.51, v: 0.06, bright: false },
  { u: 0.57, v: 0.15, bright: true },
  { u: 0.64, v: 0.05, bright: false },
  { u: 0.70, v: 0.11, bright: true },
  { u: 0.76, v: 0.07, bright: false },
  { u: 0.82, v: 0.14, bright: false },
  { u: 0.88, v: 0.08, bright: true },
  { u: 0.94, v: 0.17, bright: false },
  { u: 0.07, v: 0.26, bright: false },
  { u: 0.16, v: 0.29, bright: true },
  { u: 0.26, v: 0.25, bright: false },
  { u: 0.33, v: 0.22, bright: false },
  { u: 0.42, v: 0.26, bright: true },
  { u: 0.50, v: 0.21, bright: false },
  { u: 0.62, v: 0.24, bright: false },
  { u: 0.74, v: 0.23, bright: false },
  { u: 0.86, v: 0.25, bright: true },
  { u: 0.93, v: 0.28, bright: false },
  { u: 0.30, v: 0.32, bright: false },
  { u: 0.67, v: 0.31, bright: false },
] as const

const TWINKLE_STARS = [
  { idx: 0, period: 3.2, phase: 0.4 },
  { idx: 3, period: 4.7, phase: 1.9 },
  { idx: 6, period: 6.1, phase: 3.1 },
  { idx: 9, period: 3.7, phase: 4.5 },
  { idx: 14, period: 5.3, phase: 2.2 },
  { idx: 17, period: 4.3, phase: 0.9 },
  { idx: 20, period: 6.4, phase: 5.0 },
  { idx: 24, period: 3.9, phase: 2.8 },
] as const

interface SnowMeta {
  x0: number
  y0: number
  tier: 0 | 1 | 2
  vy: number
  swayAmp: number
  phase: number
}

interface TromsoCache {
  width: number
  height: number
  horizonY: number
  skyMask: Mask
  waterMask: Mask
  nearMask: Mask
  cabinGroundMask: Mask
  cabinX: number
  cabinY: number
  winX: number
  winY: number
  chimneyX: number
  chimneyY: number
  auroraCol: Uint8Array
  snowPool: ParticlePool
  snowMeta: SnowMeta[]
  smokePool: ParticlePool
}

const sceneCache = new WeakMap<Uint8Array, TromsoCache>()

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(1e-5, edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function drawSkyBands(ctx: BuildCtx, horizonY: number): void {
  const { width: w } = ctx
  const b1 = Math.floor(horizonY * 0.28)
  const b2 = Math.floor(horizonY * 0.58)
  const b3 = Math.floor(horizonY * 0.84)
  const halfSeam = 3 // 6px max transition seam, keeping the sky calm behind UI cards

  ctx.layer({ kind: 'sky', z: 0 }, () => {
    for (let y = 0; y < horizonY; y++) {
      if (y < b1 - halfSeam) {
        ctx.rect(0, y, w, 1, 0)
      } else if (y <= b1 + halfSeam) {
        const amt = (y - (b1 - halfSeam)) / (halfSeam * 2)
        for (let x = 0; x < w; x++) ctx.px(x, y, ctx.dither(x, y, amt, 0, 1, 4))
      } else if (y < b2 - halfSeam) {
        ctx.rect(0, y, w, 1, 1)
      } else if (y <= b2 + halfSeam) {
        const amt = (y - (b2 - halfSeam)) / (halfSeam * 2)
        for (let x = 0; x < w; x++) ctx.px(x, y, ctx.dither(x, y, amt, 1, 2, 4))
      } else if (y < b3 - halfSeam) {
        ctx.rect(0, y, w, 1, 2)
      } else if (y <= b3 + halfSeam) {
        const amt = (y - (b3 - halfSeam)) / (halfSeam * 2)
        for (let x = 0; x < w; x++) ctx.px(x, y, ctx.dither(x, y, amt, 2, 3, 4))
      } else {
        ctx.rect(0, y, w, 1, 3)
      }
    }
  })
}

function drawFarMountains(ctx: BuildCtx, skyMask: Mask, horizonY: number): void {
  const { width: w, height: h } = ctx

  // Asymmetric Nordic fjord peaks (Lyngen Alps style): sharp horns & glacial cirques
  const peaks = [
    { center: 0.14, height: 0.17, leftSlope: 0.95, rightSlope: 0.72 },
    { center: 0.34, height: 0.27, leftSlope: 1.10, rightSlope: 0.85 },
    { center: 0.48, height: 0.19, leftSlope: 1.05, rightSlope: 1.25 },
    { center: 0.63, height: 0.13, leftSlope: 0.85, rightSlope: 0.95 },
  ] as const

  ctx.layer({ kind: 'far', z: 2 }, () => {
    for (let x = 0; x < w; x++) {
      const u = x / w
      let peakH = 0
      let peakCenter = 0.34
      for (const pk of peaks) {
        const du = u - pk.center
        const slope = du < 0 ? pk.leftSlope : pk.rightSlope
        const val = Math.max(0, pk.height - Math.abs(du) * slope)
        if (val > peakH) {
          peakH = val
          peakCenter = pk.center
        }
      }
      const ridgeNoise = (ctx.fbm1(u * 42 + 12) - 0.5) * 0.020
      const top = Math.max(4, Math.floor((0.65 - peakH + ridgeNoise) * h))

      for (let y = 0; y < top; y++) {
        skyMask.set(x, y, 15)
      }

      // Organic tapered mist veil only in deep fjord saddle (u in 0.44..0.68)
      const mistSpan = u > 0.44 && u < 0.68 ? Math.sin(((u - 0.44) / 0.24) * Math.PI) : 0
      const mistH = mistSpan * h * 0.045

      for (let y = top; y < horizonY; y++) {
        const v = y / h
        const depth = (y - top) / Math.max(1, horizonY - top)
        const gully = ctx.fbm2(u * 28 + 7, v * 18 + 5)
        // Curved diagonal arête spine so sunlit/shaded faces never split along a vertical ruler
        const spineShift = depth * 0.035 + (gully - 0.5) * 0.028
        const isLit = (u - peakCenter) > spineShift || (gully > 0.60 && depth < 0.34)
        let ink = 11 // Hazy shadow flank
        if (y <= top + 1 || (depth < 0.14 && isLit)) {
          ink = 13 // Snow crest
        } else if ((depth < 0.44 && isLit) || (depth < 0.24 && gully > 0.48)) {
          ink = 12 // Hazy mid flank
        }
        if (mistH > 1 && y >= horizonY - mistH) {
          const mistAmt = (y - (horizonY - mistH)) / mistH
          if (ctx.dither(x, y, mistAmt * 0.52, 0, 1, 4) === 1) {
            ink = 12
          }
        }
        ctx.px(x, y, ink)
      }
    }
  })
}

function drawMidHeadland(
  ctx: BuildCtx,
  skyMask: Mask,
  cabinGroundMask: Mask,
): void {
  const { width: w, height: h } = ctx
  const waterLevel = Math.floor(h * 0.67)
  const ridgeTopByX = new Int16Array(w).fill(waterLevel)

  ctx.layer({ kind: 'mid', z: 3 }, () => {
    for (let x = Math.floor(w * 0.56); x < w; x++) {
      const u = x / w
      const ramp = (u - 0.56) / 0.44
      const cragShape = (ctx.fbm1(u * 26 + 80) - 0.5) * 0.032
      const shoulder = Math.max(0, 0.070 - Math.abs(u - 0.77) * 0.55)
      const shelf = u > 0.76 && u < 0.89 ? (0.04 * (1 - Math.abs(u - 0.825) / 0.065)) : 0
      const profile = 0.67 - (ramp ** 1.18) * 0.27 - shoulder + shelf + cragShape
      const top = Math.max(4, Math.floor(profile * h))
      ridgeTopByX[x] = top

      for (let y = top; y < waterLevel; y++) {
        skyMask.set(x, y, 0)
        const v = y / h
        const depth = (y - top) / Math.max(1, waterLevel - top)
        const strata = ctx.fbm2(u * 22 + 120, v * 20 + 50)
        const diagonal = Math.floor((y - top) - (u - 0.56) * h * 0.34)
        const isSnowLedge = diagonal % 18 < 4 && strata > 0.44 && depth > 0.08
        const isLitSnow = y <= top + 1 || (depth < 0.14 && strata > 0.42)

        let ink = 14 // Deep granite shadow
        if (isLitSnow) {
          ink = 16 // Crisp snow rim
          cabinGroundMask.set(x, y, 15)
        } else if (isSnowLedge || (strata > 0.60 && depth < 0.55)) {
          ink = 15 // Snow terrace / lit rock
          cabinGroundMask.set(x, y, 15)
        } else if (strata > 0.46) {
          ink = 15
        }
        ctx.px(x, y, ink)
      }
    }

    // Nordic spruce silhouettes anchored cleanly onto the snowy headland crest
    const treePlacements = [
      { u: 0.72, spr: spruceSmall },
      { u: 0.925, spr: spruceTall },
      { u: 0.962, spr: spruceSmall },
    ] as const
    for (const tp of treePlacements) {
      const cx = clamp(Math.round(w * tp.u), 0, w - 1)
      const groundY = ridgeTopByX[cx]!
      const tx = cx - Math.floor(tp.spr.width / 2)
      const ty = groundY - tp.spr.height + 2
      ctx.sprite(tp.spr, tx, ty, 1)
      for (let sy = 0; sy < tp.spr.height; sy++) {
        for (let sx = 0; sx < tp.spr.width; sx++) {
          if (tp.spr.pixels[sy * tp.spr.width + sx]! >= 0) {
            skyMask.set(tx + sx, ty + sy, 0)
          }
        }
      }
    }
  })
}

function drawRorbuCabin(
  ctx: BuildCtx,
  skyMask: Mask,
  waterMask: Mask,
  cabinGroundMask: Mask,
): { cabinX: number; cabinY: number; winX: number; winY: number; chimneyX: number; chimneyY: number } {
  const { width: w, height: h } = ctx
  const cabinX = Math.floor(w * 0.83 - cabinSprite.width / 2)
  const cabinY = Math.floor(h * 0.67 - cabinSprite.height + 5)

  ctx.layer({ kind: 'mid', z: 3 }, () => {
    ctx.sprite(cabinSprite, cabinX, cabinY, 1)
    for (let sy = 0; sy < cabinSprite.height; sy++) {
      for (let sx = 0; sx < cabinSprite.width; sx++) {
        const pix = cabinSprite.pixels[sy * cabinSprite.width + sx]!
        if (pix >= 0) {
          skyMask.set(cabinX + sx, cabinY + sy, 0)
          waterMask.set(cabinX + sx, cabinY + sy, 0)
          if (sy >= 17 && sy <= 19) cabinGroundMask.set(cabinX + sx, cabinY + sy, 15)
        }
      }
    }
  })

  return {
    cabinX,
    cabinY,
    winX: cabinX + 14,
    winY: cabinY + 14,
    chimneyX: cabinX + 26,
    chimneyY: cabinY - 1,
  }
}

function drawBaseFjordWater(ctx: BuildCtx, horizonY: number): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'water', z: 4 }, () => {
    for (let y = horizonY; y < h; y++) {
      const depth = (y - horizonY) / Math.max(1, h - horizonY)
      const baseWave = 17 + (Math.floor(y * 0.5 + depth * 2) % 2)
      ctx.rect(0, y, w, 1, baseWave)

      // Subtle perspective wave strokes driven by 6-phase palette cycle (17..22)
      const stride = Math.round(14 + depth * 12)
      const rowOffset = (y * 13) % stride
      const strokeLen = Math.round(3 + depth * 11)
      for (let x = rowOffset; x < w; x += stride) {
        const waveHash = ctx.fbm2(x * 0.04, y * 0.25)
        if (waveHash > 0.46) {
          const cyclePhase = Math.floor((x * 0.08 + y * 0.45) % 6)
          const idx = 17 + cyclePhase
          const endX = Math.min(w, x + strokeLen)
          for (let px = x; px < endX; px++) {
            ctx.px(px, y, idx)
          }
        }
      }
    }
  })
}

function drawNearShore(ctx: BuildCtx, waterMask: Mask, nearMask: Mask): void {
  const { width: w, height: h } = ctx
  const horizonY = Math.floor(h * 0.65)

  for (let y = horizonY; y < h; y++) {
    waterMask.rect(0, y, w, 1, 15)
  }

  ctx.layer({ kind: 'near', z: 5 }, () => {
    const shoreTopByX = new Int16Array(w).fill(h)
    for (let x = 0; x < Math.floor(w * 0.37); x++) {
      const u = x / w
      const s = clamp(u / 0.37, 0, 1)
      // Smoothly tapers all the way down to y = h at u = 0.37 (zero cliff step at right edge)
      const bluff = 0.23 * Math.pow(1 - s, 1.35)
      const ledge = 0.028 * Math.exp(-(((u - 0.16) / 0.055) ** 2)) * (1 - s * 0.4)
      const crag = (ctx.fbm1(u * 26 + 105) - 0.5) * 0.016 * (1 - s)
      const shoreCurve = 1.0 - (bluff + ledge) + crag
      const top = Math.min(h, Math.floor(shoreCurve * h))
      shoreTopByX[x] = top

      for (let y = top; y < h; y++) {
        waterMask.set(x, y, 0)
        nearMask.set(x, y, 15)
        const v = y / h
        const dy = y - top
        const rockNoise = ctx.fbm2(u * 24 + 220, v * 20 + 120)
        const driftHollow = 0.5 + 0.5 * Math.sin(x * 0.06 + y * 0.12)
        const snowDepth = 4 + Math.floor((1 - s * 0.65) * 6 + rockNoise * 4)
        const isSnowCap = dy < snowDepth && (dy < 2 || rockNoise > 0.35)
        const isRim = dy <= 1

        let ink = 28 // Deep coastal granite shadow
        if (isRim) {
          ink = 31 // Crisp sunlit/moonlit snow rim
        } else if (isSnowCap) {
          ink = dy < 3 || driftHollow > 0.68 ? 31 : 30
        } else if (rockNoise > 0.52) {
          ink = 29 // Granite slate plane
        }
        ctx.px(x, y, ink)
      }
    }

    // Coastal spruces anchored solidly onto the left rocky bluff (below v=0.68)
    const leftTrees = [
      { u: 0.042, spr: spruceTall },
      { u: 0.095, spr: spruceSmall },
    ] as const
    for (const tp of leftTrees) {
      const cx = clamp(Math.round(w * tp.u), 0, w - 1)
      const groundY = shoreTopByX[cx]!
      const tx = cx - Math.floor(tp.spr.width / 2)
      const ty = groundY - tp.spr.height + 2
      ctx.sprite(tp.spr, tx, ty, 1)
      for (let sy = 0; sy < tp.spr.height; sy++) {
        for (let sx = 0; sx < tp.spr.width; sx++) {
          if (tp.spr.pixels[sy * tp.spr.width + sx]! >= 0) {
            waterMask.set(tx + sx, ty + sy, 0)
            nearMask.set(tx + sx, ty + sy, 15)
          }
        }
      }
    }

    // Sturdy weathered wooden wharf pilings + sagging mooring rope
    const posts = [
      { u: 0.145, v: 0.81, height: 0.056 },
      { u: 0.22, v: 0.85, height: 0.058 },
      { u: 0.30, v: 0.88, height: 0.048 },
    ] as const
    const postTops: { x: number; y: number }[] = []
    for (const post of posts) {
      const px = Math.floor(w * post.u)
      const basePy = Math.floor(h * post.v)
      const topPy = Math.floor(h * (post.v - post.height))
      postTops.push({ x: px + 1, y: topPy + 3 })
      for (let y = topPy; y < basePy; y++) {
        ctx.px(px, y, 28)
        ctx.px(px + 1, y, 29)
        ctx.px(px + 2, y, 28)
        waterMask.set(px, y, 0)
        waterMask.set(px + 1, y, 0)
        waterMask.set(px + 2, y, 0)
        nearMask.set(px, y, 15)
        nearMask.set(px + 1, y, 15)
        nearMask.set(px + 2, y, 15)
      }
      ctx.px(px, topPy - 1, 31)
      ctx.px(px + 1, topPy - 1, 31)
      ctx.px(px + 2, topPy - 1, 30)
      nearMask.set(px, topPy - 1, 15)
      nearMask.set(px + 1, topPy - 1, 15)
      nearMask.set(px + 2, topPy - 1, 15)
    }

    for (let i = 0; i < postTops.length - 1; i++) {
      const a = postTops[i]!
      const b = postTops[i + 1]!
      const midX = Math.round((a.x + b.x) / 2)
      const midY = Math.round((a.y + b.y) / 2) + 4
      ctx.curve([a, { x: midX, y: midY }, b], 29)
    }
  })
}

function drawMoonAndStars(ctx: FrameCtx, t: number, cache: TromsoCache, nightAmt: number): void {
  const { width: w, height: h, frame } = ctx
  const { skyMask, horizonY } = cache

  ctx.layer({ kind: 'sky', z: 0, mask: skyMask }, () => {
    // Base starfield (static dim/mid stars)
    for (const star of STARS) {
      const sx = Math.floor(star.u * w)
      const sy = Math.floor(star.v * h)
      if (sy < horizonY - 4 && skyMask.contains(sx, sy)) {
        ctx.px(sx, sy, star.bright ? 5 : 4)
      }
    }

    // Selective staggered star twinkles (6-8 hero stars with subtle cross flare at peak)
    for (const tw of TWINKLE_STARS) {
      const star = STARS[tw.idx]!
      const sx = Math.floor(star.u * w)
      const sy = Math.floor(star.v * h)
      if (!skyMask.contains(sx, sy)) continue
      const wave = Math.sin((t * Math.PI * 2) / tw.period + tw.phase)
      if (wave > 0.84) {
        ctx.px(sx, sy, 6)
        ctx.px(sx - 1, sy, 5)
        ctx.px(sx + 1, sy, 5)
        ctx.px(sx, sy - 1, 5)
        ctx.px(sx, sy + 1, 5)
      }
    }

    // Crescent / lit moon in upper-left gutter (clear of centered /new card)
    if (nightAmt >= 0.6) {
      const mx = Math.round(w * 0.11)
      const my = Math.round(h * 0.12)
      const mr = Math.max(4, Math.round(Math.min(w, h) * 0.030))
      const haloR = mr + 5
      for (let dy = -haloR; dy <= haloR; dy++) {
        for (let dx = -haloR; dx <= haloR; dx++) {
          const px = mx + dx
          const py = my + dy
          if (px < 0 || py < 0 || px >= w || py >= horizonY || !skyMask.contains(px, py)) continue
          const d = Math.hypot(dx, dy)
          if (d <= mr) {
            const cutX = dx - Math.max(1, Math.round(mr * 0.44))
            const cutY = dy + Math.round(mr * 0.18)
            if (cutX * cutX + cutY * cutY > mr * mr * 0.72) {
              const shade = dx * 0.55 + dy * 0.75
              frame[py * w + px] = shade > mr * 0.3 ? 5 : 6
            }
          } else if (d <= haloR) {
            const falloff = 1 - (d - mr) / (haloR - mr)
            if (ctx.dither(px, py, falloff * 0.42, 0, 1, 4) === 1) {
              frame[py * w + px] = Math.max(frame[py * w + px]!, 4)
            }
          }
        }
      }
    }
  })
}

function drawDaySunAndCirrus(ctx: FrameCtx, t: number, cache: TromsoCache, isDawn: boolean): void {
  const { width: w, height: h, frame } = ctx
  const { skyMask, horizonY } = cache

  ctx.layer({ kind: 'sky', z: 0, mask: skyMask }, () => {
    // Low-angle Arctic winter sun at u=0.77 (right gutter, clearly separated from cabin at 0.83)
    const sx = Math.round(w * 0.77)
    const sy = Math.round(h * (isDawn ? 0.33 : 0.23))
    const sr = Math.max(4, Math.round(Math.min(w, h) * 0.033))
    const rInner = sr + 4
    const rOuter = sr + 11

    for (let dy = -rOuter; dy <= rOuter; dy++) {
      for (let dx = -rOuter; dx <= rOuter; dx++) {
        const px = sx + dx
        const py = sy + dy
        if (px < 0 || py < 0 || px >= w || py >= horizonY || !skyMask.contains(px, py)) continue
        const d = Math.hypot(dx, dy)
        if (d <= sr) {
          frame[py * w + px] = 6
        } else if (d <= rInner) {
          const frac = 1 - (d - sr) / (rInner - sr)
          frame[py * w + px] = ctx.dither(px, py, frac * 0.65 + 0.25, 4, 5, 4)
        } else if (d <= rOuter) {
          const frac = 1 - (d - rInner) / (rOuter - rInner)
          if (ctx.dither(px, py, frac * 0.55, 0, 1, 4) === 1) {
            frame[py * w + px] = 4
          }
        }
      }
    }

    // Feathery tilted polar cirrus wisps drifting gently at 0.18-0.28 px/s
    const cirrusStreaks = [
      { baseU: 0.10, baseV: 0.13, lenU: 0.18, tiltV: -0.028, speed: 0.22, seed: 11 },
      { baseU: 0.17, baseV: 0.25, lenU: 0.13, tiltV: -0.018, speed: 0.18, seed: 23 },
      { baseU: 0.44, baseV: 0.08, lenU: 0.21, tiltV: -0.022, speed: 0.20, seed: 37 },
      { baseU: 0.70, baseV: 0.14, lenU: 0.18, tiltV: -0.032, speed: 0.26, seed: 53 },
      { baseU: 0.78, baseV: 0.33, lenU: 0.13, tiltV: -0.016, speed: 0.24, seed: 71 },
    ] as const

    for (const c of cirrusStreaks) {
      const lenPx = Math.max(24, Math.round(w * c.lenU))
      const xStart = Math.round(((c.baseU * w + t * c.speed) % (w + lenPx * 1.6)) - lenPx * 0.8)
      const yBase = Math.round(h * c.baseV)
      const tiltPx = Math.round(h * c.tiltV)

      for (let dx = 0; dx < lenPx; dx++) {
        const px = xStart + dx
        if (px < 0 || px >= w) continue
        const s = dx / lenPx
        const env = smoothstep(0, 0.35, s) * smoothstep(0, 0.25, 1 - s)
        // Mare's-tail upward hook near trailing right tip
        const hook = s * s * tiltPx
        const spineY = yBase + Math.round(hook + (ctx.fbm1(s * 7 + c.seed) - 0.5) * 3)
        const halfThick = Math.max(1, Math.round(env * 3.2))

        for (let dy = -halfThick; dy <= halfThick; dy++) {
          const py = spineY + dy
          if (py < 0 || py >= horizonY || !skyMask.contains(px, py)) continue
          const fiber = ctx.fbm2(px * 0.07 + c.seed, py * 0.42 + c.seed)
          const core = env * (1 - Math.abs(dy) / (halfThick + 0.6)) * (0.55 + 0.70 * fiber)
          if (core > 0.54) {
            frame[py * w + px] = dy <= 0 && core > 0.76 ? 5 : 4
          } else if (core > 0.35 && ctx.dither(px, py, (core - 0.35) / 0.19, 0, 1, 4) === 1) {
            frame[py * w + px] = 4
          }
        }
      }
    }
  })
}

function drawAuroraCurtains(ctx: FrameCtx, t: number, cache: TromsoCache, auroraStrength: number): void {
  const { width: w, height: h, frame } = ctx
  const { skyMask, horizonY, auroraCol } = cache
  auroraCol.fill(0)

  // Evaluate curtain shape on a coarse horizontal subgrid (~120 columns) and
  // linearly interpolate across pixel columns for buttery-smooth draped curves.
  const gridCols = Math.min(w, 120)
  const stepX = w / gridCols
  const hemGrid = new Float32Array(gridCols + 1)
  const rayGrid = new Float32Array(gridCols + 1)

  const ribbons = [
    { left: 0.03, right: 0.97, baseV: 0.37, tiltV: -0.04, amp1: 0.052, amp2: 0.022, heightV: 0.24, phase: 0.4, speed: 0.14 },
    { left: 0.15, right: 0.91, baseV: 0.21, tiltV: 0.04, amp1: 0.038, amp2: 0.016, heightV: 0.17, phase: 2.7, speed: 0.18 },
  ] as const

  const skyCov = skyMask.coverage

  for (let k = 0; k < ribbons.length; k++) {
    const r = ribbons[k]!
    const curtainBaseH = Math.max(20, h * r.heightV)
    const breath = 0.88 + 0.12 * Math.sin(t * 0.34 + k * 1.5)

    for (let gx = 0; gx <= gridCols; gx++) {
      const u = gx / gridCols
      const hem = r.baseV + r.tiltV * (u - 0.5)
        + r.amp1 * Math.sin(u * 6.5 + t * r.speed + r.phase)
        + r.amp2 * Math.sin(u * 14.0 - t * (r.speed * 1.55) + r.phase * 1.7)
      hemGrid[gx] = Math.min(horizonY - 4, hem * h)
      // Continuous ray modulation in [0.46, 1.00] — soft vertical pleats without barcode gaps
      const noiseRay = ctx.fbm1(u * 22.0 + t * 0.08 + k * 7.3)
      const pleat = 0.5 + 0.5 * Math.sin(u * 26.0 + Math.sin(u * 8.0 + t * 0.12) * 1.8 + k * 2.1)
      rayGrid[gx] = 0.46 + 0.38 * noiseRay + 0.16 * pleat
    }

    const xStart = Math.max(0, Math.floor(w * r.left))
    const xEnd = Math.min(w, Math.ceil(w * r.right))

    for (let x = xStart; x < xEnd; x++) {
      const u = x / w
      const span = (u - r.left) / (r.right - r.left)
      const edge = smoothstep(0, 0.24, span) * smoothstep(0, 0.24, 1 - span)
      if (edge <= 0.03) continue

      const gPos = x / stepX
      const gIdx = Math.min(gridCols - 1, Math.floor(gPos))
      const gFrac = gPos - gIdx
      const hemY = hemGrid[gIdx]! + (hemGrid[gIdx + 1]! - hemGrid[gIdx]!) * gFrac
      const ray = rayGrid[gIdx]! + (rayGrid[gIdx + 1]! - rayGrid[gIdx]!) * gFrac

      // Modulate vertical ray reach by ray brightness so bright pleats shoot higher into violet tips
      const curtainH = curtainBaseH * (0.68 + 0.52 * ray)
      const yMin = Math.max(2, Math.floor(hemY - curtainH))
      const yMax = Math.min(horizonY - 2, Math.ceil(hemY + curtainH * 0.08))
      let colEnergy = 0

      for (let y = yMin; y <= yMax; y++) {
        const rowOff = y * w + x
        if (skyCov[rowOff] === 0) continue

        const rise = (hemY - y) / curtainH
        let profile = 0
        if (rise < 0) {
          if (rise <= -0.08) continue
          profile = 1 + rise / 0.08
        } else if (rise < 1) {
          profile = Math.pow(1 - rise, 1.48)
        } else {
          continue
        }

        const intensity = profile * ray * edge * breath * auroraStrength
        if (intensity < 0.08) continue

        // Altitude color shift: 10 (mint core) -> 9 (emerald) -> 8 (teal) -> 7 (violet corona)
        const alt = clamp(Math.max(0, rise) * 0.84 + (1 - ray) * 0.16, 0, 1)
        let ink: number
        if (alt < 0.16) {
          ink = ctx.dither(x, y, alt / 0.16, 10, 9, 4)
        } else if (alt < 0.44) {
          ink = ctx.dither(x, y, (alt - 0.16) / 0.28, 9, 8, 4)
        } else if (alt < 0.74) {
          ink = ctx.dither(x, y, (alt - 0.44) / 0.30, 8, 7, 4)
        } else {
          const fade = clamp((1 - alt) / 0.26 * intensity * 1.5, 0, 1)
          if (ctx.dither(x, y, fade, 0, 1, 4) === 0) continue
          ink = 7
        }

        if (alt < 0.74 && intensity < 0.36) {
          if (ctx.dither(x, y, intensity / 0.36, 0, 1, 4) === 0) continue
        }

        const cur = frame[rowOff]!
        if (cur < 7 || cur > 10 || ink > cur) {
          frame[rowOff] = ink
        }
        colEnergy = Math.max(colEnergy, Math.round(intensity * 255))
      }

      if (colEnergy > auroraCol[x]!) auroraCol[x] = colEnergy
    }
  }
}

function drawCabinSnowSpill(ctx: FrameCtx, t: number, cache: TromsoCache): void {
  const { width: w, height: h, frame } = ctx
  const { cabinGroundMask, winX, winY } = cache
  const cov = cabinGroundMask.coverage
  const rx = 20
  const ry = 9
  const pulse = 0.94 + 0.06 * Math.sin(t * 2.1)

  const x0 = Math.max(0, winX - rx)
  const x1 = Math.min(w - 1, winX + rx)
  const y0 = Math.max(0, winY - ry)
  const y1 = Math.min(h - 1, winY + ry)

  for (let y = y0; y <= y1; y++) {
    const rowOff = y * w
    for (let x = x0; x <= x1; x++) {
      if (cov[rowOff + x] === 0) continue
      const d = Math.hypot((x - winX) / rx, (y - winY) / ry)
      if (d >= 1) continue
      const energy = Math.pow(1 - d, 0.85) * pulse
      if (energy > 0.65) {
        frame[rowOff + x] = ctx.dither(x, y, (energy - 0.65) / 0.35, 26, 27, 4)
      } else if (energy > 0.25) {
        if (ctx.dither(x, y, (energy - 0.25) / 0.40, 0, 1, 4) === 1) {
          frame[rowOff + x] = 26
        }
      }
    }
  }
}

function drawFjordReflections(ctx: FrameCtx, t: number, cache: TromsoCache, nightAmt: number): void {
  const { width: w, height: h, frame } = ctx
  const { horizonY, waterMask, auroraCol, winX } = cache
  const cov = waterMask.coverage
  const tick = Math.floor(t * 3.5)
  const waterH = Math.max(1, h - horizonY)
  const sunX = Math.round(w * 0.77)
  const hasAurora = nightAmt >= 0.6

  for (let y = horizonY; y < h; y++) {
    const v = (y - horizonY) / waterH
    const rowOff = y * w
    const dxRow = Math.round(Math.sin(y * 0.45 + t * 2.1) * (0.8 + 1.4 * v))
    const rowStep = (y + tick) % 2 === 0
    const waveRow = (y % 2 === 0) || (v < 0.35 && ((y + tick) % 3 === 0))

    for (let x = 0; x < w; x++) {
      const idxPos = rowOff + x
      if (cov[idxPos] === 0) continue

      const u = x / w

      if (hasAurora) {
        // 1. Live aurora reflection: smooth fading broken horizontal wavelets (zero linear modulo stripes!)
        if (waveRow) {
          const sx = clamp(x + dxRow, 0, w - 1)
          const aEnergy = auroraCol[sx]! / 255
          if (aEnergy > 0.14) {
            const rippleField = ctx.fbm2(x * 0.024 + t * 0.03, y * 0.36 - t * 0.14)
            // Non-linear spatial hash so wavelets never form diagonal bands
            const hash = (((Math.imul(x >> 2, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(tick, 83492791)) >>> 0) % 100) / 100
            const vertFade = Math.exp(-v * 2.2)
            const strength = aEnergy * vertFade * (0.5 + 0.85 * rippleField)
            if (strength > 0.34 && hash < strength * 0.62) {
              frame[idxPos] = strength > 0.62 && rippleField > 0.52 ? 24 : 23
            }
          }
        }

        // 2. Continuous broken cabin window reflection (starting cleanly beneath the wharf pilings)
        const jitter = Math.round(Math.sin(y * 0.7 + t * 3.0) * 1.2)
        const dist = Math.abs(x - (winX + jitter))
        const maxHalfW = 2.0 + v * 5.5
        if (y >= cache.cabinY + cabinSprite.height - 2 && dist < maxHalfW && v < 0.72 && rowStep) {
          const hash = (((Math.imul(x >> 1, 19349663) ^ Math.imul(y, 73856093) ^ Math.imul(tick, 2971215073)) >>> 0) % 10)
          const density = Math.round(7.5 - v * 5.2)
          if (hash < density) {
            const isCore = dist < maxHalfW * 0.45 && v < 0.36
            frame[idxPos] = isCore ? 27 : 26
          }
        }
      } else {
        // Daytime / dawn: tapered low-angle sun glint corridor centered cleanly beneath the sun at u=0.77
        const halfCone = 3.5 + v * 22
        const jitter = Math.round(Math.sin(y * 0.55 + t * 2.4) * 1.5)
        const distSun = Math.abs(x - (sunX + jitter))
        if (distSun < halfCone && (y % 2 === 0 || v < 0.25)) {
          const coneFrac = 1 - distSun / halfCone
          const rippleField = ctx.fbm2(x * 0.05 + t * 0.05, y * 0.28 - t * 0.16)
          const hash = (((Math.imul(x >> 1, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(tick, 83492791)) >>> 0) % 10)
          if (rippleField + coneFrac * 0.45 > 0.64 && hash < Math.round(3 + coneFrac * 5)) {
            frame[idxPos] = coneFrac > 0.52 && rippleField > 0.48 ? 24 : 23
          }
        }
      }

      // Subtle mountain reflection darkening right under shoreline
      if (v < 0.14 && u > 0.56 && frame[idxPos]! < 23 && ((x + y) % 3 === 0)) {
        frame[idxPos] = 17
      }
    }
  }
}

function drawSmokeAndSnowAndMeteor(ctx: FrameCtx, t: number, cache: TromsoCache, nightAmt: number): void {
  const { width: w, height: h } = ctx
  const { nearMask, skyMask, chimneyX, chimneyY, winX, winY, snowMeta } = cache

  // Wind gust envelope: calm 1.0 px/s, periodic soft arctic breeze every 14s
  const gustCycle = (t % 14) / 14
  const gust = gustCycle > 0.72 ? Math.sin(((gustCycle - 0.72) / 0.28) * Math.PI) ** 2 : 0
  const wind = 1.0 + 3.2 * gust
  // Analytical integral of wind over [0, t] for 100% deterministic repeatable positions at any t
  const avgWind = 1.0 + 3.2 * 0.28 * 0.5
  const windOffset = t * avgWind + gust * 4.5

  // 1. Chimney smoke plume (6 continuous puffs expanding across 4 poses)
  const puffCount = 6
  const smokeLife = 4.8
  for (let i = 0; i < puffCount; i++) {
    const age = (t + i * (smokeLife / puffCount)) % smokeLife
    const k = age / smokeLife
    const px = Math.round(chimneyX + age * (1.2 + wind * 0.35) + Math.sin(age * 1.4 + i) * (0.7 + age * 0.5))
    const py = Math.round(chimneyY - age * 3.6)
    const pose = k < 0.22 ? 0 : k < 0.50 ? 1 : k < 0.78 ? 2 : 3
    ctx.spriteFrame(smokeSheet, pose, px, py, 1)
  }

  // 2. Multi-tier snowfall (far/mid behind nearMask, near tier in front of nearMask)
  const nearCov = nearMask.coverage
  for (let i = 0; i < snowMeta.length; i++) {
    const m = snowMeta[i]!
    const xRaw = m.x0 + windOffset * (0.45 + m.tier * 0.38) + Math.sin(t * 0.85 + m.phase) * m.swayAmp
    const yRaw = m.y0 + t * m.vy
    const px = ((Math.floor(xRaw) % w) + w) % w
    const py = ((Math.floor(yRaw) % h) + h) % h

    if (m.tier < 2 && nearCov[py * w + px] !== 0) continue

    // Light-reactive snow: flakes drifting inside cabin window glow warm up at dusk/night
    const inWarmCone = nightAmt >= 0.6 && Math.abs(px - winX) < 17 && py >= winY - 5 && py <= winY + 13
    const ink = inWarmCone ? 27 : (m.tier === 0 ? 30 : 31)

    if (m.tier === 2) {
      ctx.px(px, py, ink)
      ctx.px(px - 1, py, inWarmCone ? 26 : 30)
      ctx.px(px + 1, py, inWarmCone ? 26 : 30)
      ctx.px(px, py - 1, inWarmCone ? 26 : 30)
      ctx.px(px, py + 1, inWarmCone ? 26 : 30)
    } else {
      ctx.px(px, py, ink)
    }
  }

  // 3. Rare causal night event: single Arctic meteor streaking every 22s (0.9s active)
  if (nightAmt >= 0.7) {
    const meteorPeriod = 22
    const phase = (t + 8.5 + (ctx.seed % 7) * 1.7) % meteorPeriod
    if (phase < 0.9) {
      const p = phase / 0.9
      const mx = w * (0.20 + p * 0.24)
      const my = h * (0.06 + p * 0.11)
      ctx.layer({ kind: 'fx', z: 6, mask: skyMask }, () => {
        for (let k = 0; k < 11; k++) {
          const tx = Math.round(mx - k * 1.9)
          const ty = Math.round(my - k * 0.9)
          if (k < 2) {
            ctx.px(tx, ty, 6)
          } else if (k < 6) {
            ctx.px(tx, ty, 5)
          } else if (ctx.dither(tx, ty, 1 - (k - 5) / 6, 0, 1, 4) === 1) {
            ctx.px(tx, ty, 4)
          }
        }
      })
    }
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
  cycles: [{ indices: [17, 18, 19, 20, 21, 22], rate: 4 }],

  build(ctx: BuildCtx): void {
    const { width: w, height: h } = ctx
    const horizonY = Math.floor(h * 0.65)
    const skyMask = ctx.mask()
    const waterMask = ctx.mask()
    const nearMask = ctx.mask()
    const cabinGroundMask = ctx.mask()

    drawSkyBands(ctx, horizonY)
    drawFarMountains(ctx, skyMask, horizonY)
    drawMidHeadland(ctx, skyMask, cabinGroundMask)
    drawBaseFjordWater(ctx, horizonY)
    drawNearShore(ctx, waterMask, nearMask)
    const { cabinX, cabinY, winX, winY, chimneyX, chimneyY } = drawRorbuCabin(ctx, skyMask, waterMask, cabinGroundMask)

    const snowCount = 64
    const snowPool = new ParticlePool(snowCount, ctx.seed)
    const smokePool = new ParticlePool(12, ctx.seed + 1)
    const snowMeta: SnowMeta[] = []
    for (let i = 0; i < snowCount; i++) {
      const tier: 0 | 1 | 2 = i < 36 ? 0 : i < 56 ? 1 : 2
      const x0 = ctx.rng() * w
      const y0 = ctx.rng() * h
      const vy = tier === 0 ? 3.0 + ctx.rng() * 1.4 : tier === 1 ? 5.2 + ctx.rng() * 1.8 : 8.2 + ctx.rng() * 2.2
      const swayAmp = tier === 0 ? 1.2 : tier === 1 ? 2.2 : 3.2
      const phase = ctx.rng() * Math.PI * 2
      snowPool.spawn({ x: x0, y: y0, vx: 1.0, vy, life: 100, index: tier === 0 ? 30 : 31 })
      snowMeta.push({ x0, y0, tier, vy, swayAmp, phase })
    }

    sceneCache.set(ctx.base, {
      width: w,
      height: h,
      horizonY,
      skyMask,
      waterMask,
      nearMask,
      cabinGroundMask,
      cabinX,
      cabinY,
      winX,
      winY,
      chimneyX,
      chimneyY,
      auroraCol: new Uint8Array(w),
      snowPool,
      snowMeta,
      smokePool,
    })
  },

  frame(ctx: FrameCtx, t: number): void {
    const cache = sceneCache.get(ctx.base)
    if (!cache) return

    const nightAmt = darkness(ctx.time)
    const isNightOrDusk = nightAmt >= 0.6

    if (isNightOrDusk) {
      drawMoonAndStars(ctx, t, cache, nightAmt)
      const auroraStrength = smoothstep(0.42, 0.86, nightAmt)
      drawAuroraCurtains(ctx, t, cache, auroraStrength)
      drawCabinSnowSpill(ctx, t, cache)
    } else {
      cache.auroraCol.fill(0)
      drawDaySunAndCirrus(ctx, t, cache, nightAmt >= 0.25)
    }

    drawFjordReflections(ctx, t, cache, nightAmt)
    drawSmokeAndSnowAndMeteor(ctx, t, cache, nightAmt)
  },
}

export default tromso
