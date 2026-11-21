// Reference (§3): west-facing beach on Phú Quốc, with coconut palms leaning over
// an indigo sea, a small fishing boat, and a path of copper below a coral sunset.
import { parseSprite } from '../../engine/sprite'
import type { BuildCtx, Palettes, SceneDef } from '../../engine/types'

const enum Ink {
  Zenith, Sky, Haze, Halo, Sun, Island,
  DeepSea, Sea, Ripple, GlintLow, GlintMiddle, GlintHigh,
  Sand, Foam, Silhouette, PalmLight,
}

const palettes = {
  dawn: [0x535c8d, 0x9a83a5, 0xd69b9f, 0xf4bfab, 0xffe2ab, 0x887795, 0x4d5c80, 0x68718d, 0x86859f, 0xae90a0, 0xcc9fa3, 0xeab5a8, 0x746475, 0xc0a8ac, 0x32324d, 0x54475f],
  day: [0x4a83a6, 0x80b4c8, 0xb4d5d5, 0xd5e2cc, 0xffecc0, 0x71949e, 0x32677a, 0x4f8e99, 0x78adb2, 0x96beba, 0xb9d2c5, 0xdee4c9, 0xa29484, 0xcdd7c8, 0x284a4e, 0x496761],
  dusk: [0x3d3e71, 0x86537e, 0xc36982, 0xf3a084, 0xffd49a, 0x825572, 0x3d456b, 0x625075, 0x885d7b, 0xb37588, 0xd88c8b, 0xfab096, 0x624b63, 0xb58694, 0x272641, 0x4b3955],
  night: [0x171f39, 0x243252, 0x384567, 0x536283, 0xb8cad8, 0x364460, 0x1c2a45, 0x2b3a57, 0x414f6d, 0x516281, 0x687d9b, 0x839cb3, 0x333d54, 0x5a6c81, 0x151d31, 0x2d3951],
} satisfies Palettes

const horizon = 0.53
const sunX = 0.64
const boatX = 0.79
const boat = parseSprite([
  '...........m..........',
  '...........m..........',
  '.......mmmmm..........',
  '.......mffsm..........',
  '.....mmmsfsmmmm.......',
  '.mssssssssssssssssssm.',
  '..ssssssssssssssssss..',
  '...rrrrrrrrrrrrrrrr...',
], { m: Ink.Silhouette, s: Ink.PalmLight, r: Ink.Silhouette, f: Ink.Ripple })

function drawSky(ctx: BuildCtx, waterline: number) {
  const { width: w, height: h } = ctx
  const sunY = waterline - h * 0.038
  const radius = Math.min(w, h) * 0.082
  for (let y = 0; y < waterline; y++) {
    const v = y / waterline
    for (let x = 0; x < w; x++) {
      const u = x / w
      const glow = Math.max(0, 1 - Math.hypot((x - w * sunX) / radius * 0.20, (y - sunY) / radius * 0.30))
      const step = Math.min(Ink.Halo, v * 2.65 + glow * 0.9)
      const low = Math.floor(step)
      ctx.px(x, y, ctx.dither(x, y, step - low, low, Math.min(Ink.Halo, low + 1), 8))
      const cloud = ctx.fbm2(u * 150 + v * 9, v * 374)
      const cloudOpacity = Math.min(1, (v - 0.27) * 11, (0.78 - v) * 10)
      if (cloudOpacity > 0 && cloud > 0.64 && low >= Ink.Sky) {
        ctx.px(x, y, ctx.dither(x, y, cloudOpacity * (cloud - 0.64) * 6, low, low - 1))
      }
    }
  }
  ctx.disc(w * sunX, sunY, radius, Ink.Sun)
  for (let i = 0; i < 2; i++) {
    const y = Math.floor(sunY + radius * (0.26 + i * 0.36))
    const half = Math.sqrt(Math.max(0, radius ** 2 - (y - sunY) ** 2))
    ctx.rect(Math.ceil(w * sunX - half), y, Math.floor(w * sunX + half) - Math.ceil(w * sunX - half) + 1, 1, Ink.Halo)
  }
}

// Fixed glint pixels share three neighboring palette slots; only their color changes.
const glintsByBase = new WeakMap<Uint8Array, Uint32Array>()
const glintRamp = [Ink.GlintLow, Ink.GlintMiddle, Ink.GlintHigh, Ink.GlintMiddle] as const

function drawSea(ctx: BuildCtx, waterline: number) {
  const { width: w, height: h } = ctx
  const depth = h - waterline
  for (let y = waterline; y < h; y++) {
    const v = (y - waterline) / depth
    ctx.rect(0, y, w, 1, ctx.dither(0, y, Math.sin(v * 11) * 0.24 + 0.52, Ink.DeepSea, Ink.Sea))
    const spacing = Math.max(1, Math.round(1 + v * h / 89))
    const waveWidth = Math.min(w, h) * (0.018 + v * 0.086)
    const pathWidth = Math.min(w, h) * (0.08 + v * 0.31)
    if (y % spacing !== 0) continue
    const waveCount = Math.ceil(w / (9 + waveWidth * 1.6))
    for (let n = 0; n < waveCount; n++) {
      const x = ctx.rng() * w
      const length = 1 + ctx.rng() * waveWidth
      ctx.rect(x, y, length, 1, ctx.rng() > 0.44 ? Ink.Ripple : Ink.DeepSea)
    }
    const shift = Math.sin(y * 0.44) * waveWidth * 0.36
    for (let n = 0; n < 3 + v * 3; n++) {
      const offset = ctx.rng() + ctx.rng() - 1
      const length = 1 + ctx.rng() * waveWidth * (1 - Math.abs(offset) * 0.65)
      const x = w * sunX + offset * pathWidth + shift
      const ink = Math.abs(offset) > 0.54 ? Ink.Ripple : Ink.GlintLow + Math.floor(ctx.rng() * 3)
      ctx.rect(x - length / 2, y, length, 1, ink)
    }
  }
}

// Curved, drooping leaflets give the coconut fronds their jagged outer edges.
const fronds = [
  [-0.93, 0.22, 0.48], [-0.85, -0.16, 0.70], [-0.55, -0.55, 0.55],
  [0.01, -0.63, 0.62], [0.55, -0.49, 0.58], [1, -0.02, 0.70],
  [0.81, 0.34, 0.55], [0.39, 0.47, 0.36], [-0.49, 0.44, 0.34],
] as const

function drawPalm(ctx: BuildCtx, footX: number, footY: number, height: number, lean: number, crown: number) {
  const tipX = footX + lean
  const tipY = footY - height
  for (let y = Math.floor(tipY); y <= footY; y++) {
    const t = (footY - y) / height
    const x = footX + lean * t * t
    const width = Math.max(1, crown * (0.125 - t * 0.071))
    ctx.rect(x - width / 2, y, width, 1, Ink.Silhouette)
    if (width > 2 && y % 6 < 4) ctx.px(x + width / 2 - 1, y, Ink.PalmLight)
  }
  ctx.disc(tipX, tipY, crown * 0.08, Ink.Silhouette)
  for (const [dx, dy, arch] of fronds) {
    let lastX = tipX
    let lastY = tipY
    const steps = Math.max(5, Math.round(crown * 0.43))
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const x = tipX + dx * t * crown
      const y = tipY + (dy * t - arch * t * (1 - t)) * crown
      ctx.line(lastX, lastY, x, y, Ink.Silhouette)
      const leaflet = Math.sin(t * Math.PI) * crown * 0.25
      const bend = dx * leaflet * 0.55
      ctx.line(x, y, x + bend - (1 - Math.abs(dx)) * leaflet * 0.65, y + leaflet, Ink.Silhouette)
      ctx.line(x, y, x + bend + (1 - Math.abs(dx)) * leaflet * 0.49, y + leaflet * 0.46, Ink.Silhouette)
      lastX = x
      lastY = y
    }
  }
}

const phuQuoc: SceneDef = {
  id: 'vn-phu-quoc',
  name: { vi: 'Phú Quốc hoàng hôn', en: 'Phú Quốc Sunset' },
  region: 'vn',
  tone: 'both',
  defaultTime: 'dusk',
  horizon,
  focus: { x: sunX, y: horizon },
  palettes,
  build(ctx) {
    const { width: w, height: h } = ctx
    const waterline = Math.floor(h * horizon)
    const unit = Math.min(w, h)
    drawSky(ctx, waterline)
    drawSea(ctx, waterline)
    for (let x = 0; x < w * 0.41; x++) {
      const u = x / w
      const height = (1 - u / 0.41) ** 0.76 * (0.029 + ctx.fbm2(u * 265 + 14, 44) * 0.08)
      ctx.rect(x, waterline - height * h, 1, height * h + 1, Ink.Island)
    }
    for (let x = 0; x < w; x++) {
      const u = x / w
      const shore = h * (0.76 + u * 0.60 - u * u * 0.28) + (ctx.fbm2(u * 173, 154) - 0.5) * unit * 0.028
      const sand = h * (0.84 + u * 0.60 - u * u * 0.19) + (ctx.fbm2(u * 100, 99) - 0.5) * unit * 0.07
      ctx.rect(x, shore, 1, h, Ink.Sand)
      if (ctx.fbm2(u * 233, 27) > 0.33) ctx.px(x, shore, Ink.Foam)
      ctx.rect(x, sand, 1, h, Ink.Silhouette)
    }
    drawPalm(ctx, w * 0.24, h * 1.01, h * 0.40, unit * 0.058, unit * 0.155)
    drawPalm(ctx, w * 0.075, h * 0.90, h * 0.49, unit * 0.18, unit * 0.23)
    const glints: number[] = []
    for (let i = waterline * w; i < ctx.base.length; i++) {
      const ink = ctx.base[i]!
      if (ink >= Ink.GlintLow && ink <= Ink.GlintHigh) glints.push(i)
    }
    glintsByBase.set(ctx.base, Uint32Array.from(glints))
  },
  frame(ctx, t) {
    const { width: w, height: h, base, buffer } = ctx
    const phase = Math.floor(t * 2)
    const fraction = t * 2 - phase
    const glints = glintsByBase.get(base)
    if (glints) {
      for (const i of glints) {
        const x = i % w
        const y = Math.floor(i / w)
        const step = phase + ctx.dither(x, y, fraction, 0, 1)
        buffer[i] = glintRamp[(base[i]! - Ink.GlintLow + step) & 3]!
      }
    }
    const scale = Math.max(1, Math.floor(Math.min(w, h) / 120))
    const x = Math.round(w * boatX - boat.width * scale / 2)
    const y = Math.round(h * 0.625 - boat.height * scale / 2 + scale * Math.sin(t * 0.9))
    ctx.sprite(boat, x, y, scale)
    ctx.rect(x - scale * 3, y + boat.height * scale + 1, boat.width * scale * 0.7, 1, Ink.Ripple)
  },
}

export default phuQuoc
