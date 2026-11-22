/**
 * Hand-drawn V2 reference: a west-facing Phú Quốc beach at sunset.
 * Twin leaning coconut palms with lush drooping frond crowns frame a quiet sea,
 * a traditional fishing sampan with glowing lantern and water reflection,
 * a tapered sparkling wave glint path, and an S-curve shore with animated foam wash
 * and dark wet tide lines.
 */
import type { BuildCtx, SceneDef } from '../../engine/types'
import {
  heroPalmCrownSheet,
  Ink,
  PHU_QUOC_LEGACY_PALETTES,
  PHU_QUOC_THEME_PALETTES,
  sampanSheet,
  seabirdSheet,
  secPalmCrownSheet,
} from './phu-quoc-sprites'

function drawSky(ctx: BuildCtx, line: number): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'sky', z: 0 }, () => {
    // 4 clean bands with narrow 4px dither seams (no full-sky checkerboard)
    const b0 = Math.floor(line * 0.28)
    const b1 = Math.floor(line * 0.58)
    const b2 = Math.floor(line * 0.84)
    const boundaries = [b0, b1, b2]

    for (let y = 0; y < line; y++) {
      const bIdx = boundaries.findIndex((b) => Math.abs(y - b) <= 2)
      if (bIdx >= 0) {
        const center = boundaries[bIdx]!
        const amount = Math.max(0, Math.min(1, (y - (center - 2)) / 4))
        for (let x = 0; x < w; x++) {
          ctx.px(x, y, ctx.dither(x, y, amount, bIdx, bIdx + 1, 4))
        }
      } else {
        const slot = y < b0 ? Ink.Sky0 : y < b1 ? Ink.Sky1 : y < b2 ? Ink.Sky2 : Ink.Sky3
        ctx.rect(0, y, w, 1, slot)
      }
    }

    const sunX = Math.floor(w * 0.76)
    const sunY = Math.floor(h * 0.36)

    // Stepped radial celestial glow (3-stage stepped concentric rings)
    for (let y = sunY - 25; y <= sunY + 25; y++) {
      for (let x = sunX - 25; x <= sunX + 25; x++) {
        const d = Math.hypot(x - sunX, y - sunY)
        if (d > 16 && d <= 25 && y < line) {
          const frac = ((25 - d) / 9) * 0.35
          if (ctx.dither(x, y, frac, Ink.Sky2, Ink.SunGlow, 4) === Ink.SunGlow) {
            ctx.px(x, y, Ink.SunGlow)
          }
        }
      }
    }
    ctx.disc(sunX, sunY, 16, Ink.SunGlow)
    ctx.disc(sunX, sunY, 11, Ink.SunCore)
  })
}

function drawIsland(ctx: BuildCtx, line: number): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'far', z: 1 }, () => {
    // Rank 1: Distant atmospheric haze ridge (u = 0.04..0.44)
    const xStart1 = Math.floor(w * 0.04)
    const xEnd1 = Math.floor(w * 0.44)
    for (let x = xStart1; x < xEnd1; x++) {
      const u = (x - xStart1) / (xEnd1 - xStart1)
      const arch = Math.sin(u * Math.PI)
      const topY = line - Math.floor(arch * (h * 0.042) + (ctx.fbm2(x * 0.05, 12) - 0.5) * 3)
      if (topY < line) {
        ctx.rect(x, topY, 1, line - topY, Ink.IslandFar)
      }
    }

    // Rank 2: Mid tropical ridge with lush rainforest canopy bumps (u = 0.08..0.46)
    const xStart2 = Math.floor(w * 0.08)
    const xEnd2 = Math.floor(w * 0.46)
    for (let x = xStart2; x < xEnd2; x++) {
      const u = (x - xStart2) / (xEnd2 - xStart2)
      const arch = Math.sin(u * Math.PI)
      const canopy = (Math.sin(x * 0.45) * 0.5 + 0.5) * 2
      const topY = line - Math.floor(arch * (h * 0.058) + canopy)
      if (topY < line) {
        ctx.rect(x, topY, 1, line - topY, Ink.IslandMid)
        if (u > 0.45 && (x & 1) === 0) {
          ctx.px(x, topY, Ink.IslandRim)
        }
      }
    }
  })
}

function drawWater(ctx: BuildCtx, line: number): void {
  const { width: w, height: h } = ctx
  const sunX = Math.floor(w * 0.76)
  ctx.layer({ kind: 'water', z: 2 }, () => {
    for (let y = line; y < h; y++) {
      const d = (y - line) / (h - line)
      const isDeep = y < line + Math.floor((h - line) * 0.35)
      ctx.rect(0, y, w, 1, isDeep ? Ink.SeaDeep : Ink.SeaMid)

      // Perspective light corridor (tapered glint path expanding 8px -> ~64px)
      const halfSpread = Math.floor(4 + d * 30)
      const leftGlint = Math.max(0, sunX - halfSpread)
      const rightGlint = Math.min(w, sunX + halfSpread)

      const rowStep = Math.max(1, Math.floor(3 - d * 1.5))
      if (y % rowStep === 0) {
        for (let x = leftGlint; x < rightGlint; x += Math.max(4, Math.floor(10 - d * 4))) {
          if (((x * 5 + y * 7) % 11) < 5) {
            const waveletLen = Math.min(rightGlint - x, Math.floor(3 + d * 10))
            const waveInk = Ink.Wave0 + ((x + y * 2) % 6)
            ctx.line(x, y, x + waveletLen, y, waveInk)

            // Sparkling specular core in center of glint path
            if (Math.abs(x - sunX) < halfSpread * 0.38 && ((x + y) & 1) === 0) {
              ctx.px(x + Math.floor(waveletLen / 2), y, Ink.SeaGlint)
            }
          }
        }
      }

      // Sparse calm ocean wavelets outside glint corridor
      if (y % 3 === 0) {
        for (let x = (y * 7) % 23; x < w; x += 28) {
          if (x < leftGlint - 6 || x > rightGlint + 6) {
            if (ctx.fbm2(x * 0.08, y * 0.12) > 0.62) {
              const len = Math.floor(2 + d * 4)
              ctx.line(x, y, x + len, y, Ink.Wave0 + ((x + y) % 6))
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

        // Subtle sand grain texture and gentle horizontal ripples
        for (let y = shoreY + wetDepth; y < h; y += 3) {
          if (((x * 13 + y * 19) % 29) < 4) {
            ctx.px(x, y, Ink.SandMid)
          }
          if (y % 12 === 0 && ((x + (y >> 2)) % 17 < 5)) {
            ctx.px(x, y, Ink.SandMid)
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

const scene: SceneDef = {
  id: 'vn-phu-quoc',
  name: { vi: 'Phú Quốc hoàng hôn', en: 'Phú Quốc Sunset' },
  region: 'vn',
  tone: 'both',
  defaultTime: 'dusk',
  themePalettes: PHU_QUOC_THEME_PALETTES,
  themeDefaultTime: { light: 'dawn', dark: 'dusk' },
  palettes: PHU_QUOC_LEGACY_PALETTES,
  cycles: [{ indices: [Ink.Wave0, Ink.Wave1, Ink.Wave2, Ink.Wave3, Ink.Wave4, Ink.Wave5], rate: 6 }],
  horizon: 0.57,
  focus: { x: 0.72, y: 0.65 },
  build(ctx) {
    const { width: w, height: h } = ctx
    const line = Math.floor(h * 0.57)

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
  frame(ctx, t) {
    const { width: w, height: h } = ctx
    const scale = Math.max(1, Math.floor(w / 480))
    const sunX = Math.floor(w * 0.76)
    const sunY = Math.floor(h * 0.36)

    // 1. Drifting sunset clouds, moon crescent, & seabirds (z: 1)
    ctx.layer({ kind: 'sky', z: 1 }, () => {
      if (ctx.time === 'night') {
        // Moon crescent cutout
        ctx.disc(sunX - 3, sunY - 2, 7, Ink.Sky1)
      }

      const drift = Math.floor(t * 0.18 * 40) % (w + 120) - 60
      const clouds: readonly [number, number, number][] = [
        [w * 0.55, h * 0.20, 80],
        [w * 0.68, h * 0.27, 95],
        [w * 0.42, h * 0.34, 65],
      ]
      for (const [cx, cy, len] of clouds) {
        const cxDrift = ((cx + drift) % (w + len * 2)) - len
        ctx.line(cxDrift, cy, cxDrift + len, cy, Ink.CloudBody)
        ctx.line(cxDrift + 4, cy + 1, cxDrift + len - 4, cy + 1, Ink.CloudShadow)
        ctx.line(cxDrift + 8, cy - 1, cxDrift + len - 8, cy - 1, Ink.CloudRim)
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
      ctx.line(boatX - 8 + rippleJitter, boatY + 6, boatX + 3 + rippleJitter, boatY + 6, Ink.SeaMid)
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
