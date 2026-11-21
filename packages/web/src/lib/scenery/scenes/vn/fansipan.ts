// Reference (§3): looking across the Hoàng Liên Sơn range from a rocky spur.
// Apricot light rises to the left of a slate summit over a lavender sea of clouds.
import { BAYER_4 } from '../../engine/dither'
import type { BuildCtx, Palettes, SceneDef } from '../../engine/types'

const enum Ink {
  Zenith, Sky, Haze, Halo, Sun,
  FarRidge, MiddleRidge, BaseRidge, PeakShadow, PeakLight,
  FarCloud, FarCloudLight, NearCloud, NearCloudLight,
  RockShadow, RockLight,
}

const palettes = {
  dawn: [0x555988, 0xa383a5, 0xe3a49e, 0xf4c4a2, 0xffe3ab, 0xb38da6, 0x867a9c, 0x645f83, 0x3b3c62, 0x896c88, 0xa18daa, 0xc7a7bd, 0xb49bb8, 0xe4c5d2, 0x2a2c48, 0x494665],
  day: [0x5484a9, 0x87b4cb, 0xc3d7d6, 0xdbe2ce, 0xffedbc, 0x9bb8c7, 0x748fa8, 0x566f8a, 0x354e69, 0x788999, 0x9eb8ca, 0xc5d7dd, 0xb2c9d6, 0xe6e9e2, 0x293d53, 0x4b6476],
  dusk: [0x3c406e, 0x855b81, 0xc97680, 0xe7a08a, 0xffc58d, 0xa06b85, 0x795778, 0x574762, 0x332d51, 0x7e546b, 0x8b718f, 0xbc879f, 0xa3819c, 0xd4a0b2, 0x24233d, 0x41334f],
  night: [0x19243e, 0x2a3755, 0x40496a, 0x526283, 0xb8c5d8, 0x414e70, 0x343e5e, 0x2b3250, 0x1d2641, 0x46516f, 0x404966, 0x576485, 0x485474, 0x717d9d, 0x171e33, 0x2e3a53],
} satisfies Palettes

const summit = 0.64
const lightX = 0.30
const horizon = 0.52

// Hand-shaped shoulders keep the summit readable through the seeded rock texture.
const peak = [0.78, 0.68, 0.60, 0.60, 0.48, 0.44, 0.35, 0.33, 0.27, 0.31, 0.45, 0.49, 0.61, 0.71] as const

function drawRidge(ctx: BuildCtx, height: number, frequency: number, offset: number, ink: Ink) {
  const { width, height: h } = ctx
  for (let x = 0; x < width; x++) {
    const noiseX = x / width * frequency + offset
    const relief = (ctx.fbm2(noiseX, offset) - 0.5) * 0.27
      + (ctx.fbm2(noiseX * 2.4, offset + 58) - 0.5) * 0.09
    ctx.rect(x, (height + relief) * h, 1, h, ink)
  }
}

function drawPeak(ctx: BuildCtx) {
  const { width: w, height: h } = ctx
  for (let x = 0; x < w; x++) {
    const u = x / w
    const position = Math.min(peak.length - 1.001, u / summit * 8)
    const section = Math.floor(position)
    const slope = peak[section + 1]! - peak[section]!
    const relief = ctx.fbm2(u * 185, 83) - 0.5
    const top = Math.floor(h * (peak[section]! + slope * (position - section) + relief * 0.048))
    const crest = 2 + Math.floor((relief + 0.5) * h * 0.022)
    ctx.rect(x, top, 1, h, Ink.PeakShadow)
    if (slope < 0) ctx.rect(x, top, 1, crest, Ink.PeakLight)
    for (let y = top + crest; y < h * 0.65; y++) {
      const v = y / h
      const stratum = ctx.fbm2((u + v * 0.62) * 435, v * 67 + 90)
      const face = Math.max(0, Math.min(1, (summit - u + (0.27 - v) * 0.31 + relief * 0.034) * 30))
      ctx.px(x, y, ctx.dither(x, y, face * Math.max(0, (stratum - 0.34) * 1.4), Ink.PeakShadow, Ink.PeakLight))
    }
  }
}

type CloudBank = readonly [crest: number, bottom: number, speed: number, offset: number, shadow: Ink, light: Ink]
const cloudBanks: readonly CloudBank[] = [
  [0.49, 0.81, 1.6, 43, Ink.FarCloud, Ink.FarCloudLight],
  [0.68, 1, -2.7, 147, Ink.NearCloud, Ink.NearCloudLight],
]

function drawClouds(ctx: BuildCtx, t: number, bank: CloudBank) {
  const { width: w, height: h, base, buffer } = ctx
  const [crest, foot, speed, offset, shadow, light] = bank
  const stride = Math.max(1, Math.floor(h / 65))
  const bottom = Math.ceil(foot * h)
  for (let x = 0; x < w; x += stride) {
    const right = Math.min(x + stride, w)
    const noiseX = x / w * 174 + t * speed
    const billow = (ctx.fbm2(noiseX, offset) - 0.5) * 0.23
      + (ctx.fbm2(noiseX * 2, offset + 41) - 0.5) * 0.12
    const top = Math.floor(Math.min(0.81, crest - billow + 0.026 * Math.sin(x / w * 8 + offset)) * h)
    for (let y = top; y < bottom; y += stride) {
      const end = Math.min(y + stride, bottom)
      const v = y / h
      const height = (y - top) / h
      const folds = ctx.fbm2(noiseX + v * 35, offset + v * 835)
      const lit = (folds - 0.34) * 2.45 + Math.max(0, 0.32 - height * 8)
      const threshold = lit * 16 - 0.5
      for (let py = y; py < end; py++) {
        const row = py * w
        // Integer coordinates can index the shared Bayer matrix directly.
        const ditherRow = (py & 3) * 4
        for (let px = x; px < right; px++) {
          const i = row + px
          if (base[i]! < Ink.RockShadow) buffer[i] = threshold >= BAYER_4[ditherRow + (px & 3)]! ? light : shadow
        }
      }
    }
  }
}

const fansipan: SceneDef = {
  id: 'vn-fansipan',
  name: { vi: 'Fansipan biển mây', en: 'Fansipan Cloud Sea' },
  region: 'vn',
  tone: 'both',
  defaultTime: 'dawn',
  horizon,
  focus: { x: summit, y: 0.29 },
  palettes,
  build(ctx) {
    const { width: w, height: h } = ctx
    for (let y = 0; y < h * 0.64; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w
        const v = y / h
        const glow = Math.max(0, 1 - Math.hypot((u - lightX) * 2, (v - 0.32) * 4))
        const step = Math.min(3, v * 4.3 + glow * 1.40)
        const low = Math.floor(step)
        ctx.px(x, y, ctx.dither(x, y, step - low, low, Math.min(Ink.Halo, low + 1), 8))
      }
    }
    drawRidge(ctx, 0.38, 140, 12, Ink.FarRidge)
    drawRidge(ctx, 0.43, 160, 83, Ink.MiddleRidge)
    drawRidge(ctx, 0.49, 185, 146, Ink.BaseRidge)
    drawPeak(ctx)
    for (let x = 0; x < w; x++) {
      const u = x / w
      const spur = 1.025 - 0.23 * Math.max(0, 1 - u * 2.7) - 0.12 * Math.max(0, 1 - (1 - u) * 5.2)
      const noise = ctx.fbm2(u * 320 + 56, 191)
      const top = Math.floor(h * (spur + (noise - 0.5) * 0.15))
      ctx.rect(x, top, 1, h, Ink.RockShadow)
      if (noise > 0.44) ctx.rect(x, top, 1, h * (noise - 0.38) * 0.10, Ink.RockLight)
    }
  },
  frame(ctx, t) {
    const { width: w, height: h, base, buffer } = ctx
    const sunX = w * lightX
    const radius = Math.min(w, h) * 0.055
    const rise = h * 0.024 * (1 - Math.exp(-t / 18))
    const sunY = h * 0.29 - rise
    for (let y = Math.ceil(sunY - radius); y <= Math.floor(sunY + radius); y++) {
      const half = Math.sqrt(radius ** 2 - (y - sunY) ** 2)
      for (let x = Math.ceil(sunX - half); x <= Math.floor(sunX + half); x++) {
        const i = y * w + x
        if (base[i]! <= Ink.Halo) buffer[i] = Ink.Sun
      }
    }
    for (const bank of cloudBanks) drawClouds(ctx, t, bank)
  },
}

export default fansipan
