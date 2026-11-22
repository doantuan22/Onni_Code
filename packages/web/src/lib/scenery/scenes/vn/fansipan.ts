/**
 * Original scene study: Fansipan's broken Hoàng Liên ridge rises from a sea
 * of hand-built cloud puffs. The small ridge flag supplies human scale.
 */
import { parseSprite } from '../../engine/sprite'
import type { BuildCtx, Palettes, SceneDef, ThemePalettes } from '../../engine/types'

const palette = (sky: number, horizon: number, far: number, rock: number, rockLight: number, cloud: number, cloudLight: number, near: number): readonly number[] => [
  sky, sky, horizon, 0xf0c9ad, far, 0x33495e, 0x71899a, 0x9cb3bf,
  rock, 0x4f6576, rockLight, 0xc4b6a5, cloud, 0x596c86, cloudLight, 0xf6dcc2,
  near, 0x314b48, 0x6e8273, 0x8c5754, 0xa36863, 0x7894a3, 0x41546b, 0x8193a5,
  0x27384b, 0x1b2c40, 0x94a6bc, 0xead1b4, 0x161f34, 0xd5a57c, 0x30415b, 0xffffff,
]

const light: Palettes = {
  dawn: palette(0xa9bed7, 0xf0c9ad, 0x647e91, 0x3f5365, 0xc4b6a5, 0x899db2, 0xf6dcc2, 0x2f4948),
  day: palette(0x92bdd3, 0xd6dfd4, 0x718da0, 0x4a6172, 0xc4d0ca, 0xa1b6c3, 0xe8ece1, 0x38554f),
  dusk: palette(0x4a496c, 0xcf8d82, 0x526474, 0x334758, 0xae8f88, 0x687b96, 0xe2b9a5, 0x263e42),
  night: palette(0x24334e, 0x536681, 0x3c526b, 0x26394f, 0x8193a5, 0x485b75, 0x94a6bc, 0x20363a),
}

const dark: Palettes = {
  dawn: palette(0x536b89, 0xbf9685, 0x4b657d, 0x30475a, 0xa8a19a, 0x697f99, 0xdfc4ad, 0x243d40),
  day: palette(0x587e95, 0xa9b8b4, 0x496779, 0x324d61, 0xa9b8b2, 0x748da2, 0xd0d9d0, 0x294741),
  dusk: palette(0x2b3452, 0x8f6870, 0x3b4f69, 0x253a4e, 0x718499, 0x41546e, 0x91a4bb, 0x1e363a),
  night: palette(0x14233d, 0x344a65, 0x30455f, 0x1b2c40, 0x8193a5, 0x30415b, 0x94a6bc, 0x172d34),
}

const themePalettes: ThemePalettes = { light, dark }

const flagFrames = [
  parseSprite(['..p.....', '.pppp...', '..ppp...', '...p....', '...p....', '...p....'], { p: 19 }),
  parseSprite(['..p.....', '.ppppp..', '..pp....', '...p....', '...p....', '...p....'], { p: 19 }),
  parseSprite(['..p.....', '.ppp....', '...pp...', '...p....', '...p....', '...p....'], { p: 19 }),
  parseSprite(['..p.....', '.pppp...', '...pp...', '...p....', '...p....', '...p....'], { p: 19 }),
] as const

const birdFrames = [
  parseSprite(['..b...b.', '.b.b.b..', 'b...b...', '........', '........'], { b: 25 }),
  parseSprite(['........', '.b....b.', '..b..b..', '...bb...', '........'], { b: 25 }),
  parseSprite(['...b.b..', '..b...b.', '.b.....b', '........', '........'], { b: 25 }),
  parseSprite(['........', '..b..b..', '.b....b.', '........', '........'], { b: 25 }),
] as const

function ridge(ctx: Parameters<SceneDef['build']>[0], baseline: number, amplitude: number, ink: number, seed: number): void {
  const { width: w, height: h } = ctx
  for (let x = 0; x < w; x++) {
    const top = Math.floor(h * (baseline - amplitude * (0.3 + ctx.fbm2(x * 0.017, seed) * 0.7) + Math.sin(x * 0.035 + seed) * 0.018))
    ctx.rect(x, top, 1, h - top, ink)
  }
}

function puff(ctx: BuildCtx, x: number, y: number, radius: number, shadow: number, light: number): void {
  ctx.disc(x, y + 2, radius, shadow)
  ctx.disc(x + radius * 0.55, y, radius * 0.76, shadow)
  ctx.disc(x - radius * 0.48, y + 1, radius * 0.68, shadow)
  ctx.disc(x + radius * 0.32, y - radius * 0.30, radius * 0.50, light)
}

const scene: SceneDef = {
  id: 'vn-fansipan',
  name: { vi: 'Fansipan biển mây', en: 'Fansipan Cloud Sea' },
  region: 'vn',
  tone: 'both',
  palettes: light,
  themePalettes,
  defaultTime: 'dawn',
  themeDefaultTime: { light: 'dawn', dark: 'night' },
  horizon: 0.56,
  focus: { x: 0.70, y: 0.40 },
  build(ctx) {
    const { width: w, height: h } = ctx
    // 1: broad atmospheric sky, with dawn source to the right.
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) ctx.px(x, y, ctx.dither(x, y, y / h * 1.4, 0, 3, 8))
    ctx.disc(w * 0.88, h * 0.34, Math.max(3, h * 0.027), 3)
    // 2: far haze and low blue foothills.
    ridge(ctx, 0.54, 0.08, 4, 29)
    ridge(ctx, 0.61, 0.10, 5, 51)
    // 3: the asymmetrical, three-faced Fansipan summit.
    ctx.polygon([{ x: w * 0.48, y: h * 0.65 }, { x: w * 0.61, y: h * 0.36 }, { x: w * 0.70, y: h * 0.23 }, { x: w * 0.78, y: h * 0.42 }, { x: w * 0.88, y: h * 0.66 }], 8)
    ctx.polygon([{ x: w * 0.61, y: h * 0.36 }, { x: w * 0.70, y: h * 0.23 }, { x: w * 0.72, y: h * 0.54 }, { x: w * 0.62, y: h * 0.59 }], 10)
    ctx.polygon([{ x: w * 0.72, y: h * 0.54 }, { x: w * 0.70, y: h * 0.23 }, { x: w * 0.78, y: h * 0.42 }, { x: w * 0.88, y: h * 0.66 }], 9)
    for (let i = 0; i < 5; i++) ctx.line(w * (0.58 + i * 0.055), h * (0.45 + i * 0.035), w * (0.63 + i * 0.05), h * 0.63, i % 2 ? 9 : 8)
    // 4-5: cloud banks are static enough to read without motion, but do not seal the peak.
    for (const [x, y, r] of [[0.42, 0.61, 19], [0.53, 0.59, 23], [0.82, 0.60, 20], [0.32, 0.78, 30], [0.58, 0.76, 34], [0.84, 0.79, 31]] as const) {
      puff(ctx, w * x, h * y, Math.max(5, h * r / 270), y < 0.7 ? 12 : 13, y < 0.7 ? 14 : 15)
    }
    // 6: a near spur cuts the lower left, with trail and shrubs for scale.
    ctx.polygon([{ x: 0, y: h }, { x: 0, y: h * 0.69 }, { x: w * 0.14, y: h * 0.76 }, { x: w * 0.32, y: h },], 16)
    ctx.curve([{ x: 0, y: h * 0.89 }, { x: w * 0.10, y: h * 0.83 }, { x: w * 0.18, y: h * 0.90 }], 18)
    for (let x = 0; x < w * 0.23; x += 6) ctx.disc(x, h * (0.72 + ctx.fbm1(x) * 0.12), 3, 17)
  },
  frame(ctx, t) {
    const { width: w, height: h } = ctx
    // Separate far and near puffs drift at visibly different rates.
    const farOffset = (t * 0.15) % 18
    for (let i = 0; i < 5; i++) puff(ctx, w * (0.24 + i * 0.16) - farOffset, h * (0.57 + (i % 2) * 0.025), 7, 12, 14)
    const nearOffset = (t * 0.4) % 28
    for (let i = 0; i < 5; i++) puff(ctx, w * (0.16 + i * 0.21) - nearOffset, h * (0.80 + Math.sin(t * 1.2 + i) * 0.012), 14, 13, 15)
    // A sparse flag animates at the ridge rather than moving the mountain itself.
    ctx.sprite(flagFrames[Math.floor(t * 3) % flagFrames.length]!, w * 0.84, h * 0.58)
    if (Math.floor(t / 5) % 2 === 0) {
      const flight = (Math.floor(t * 12) % (w + 30)) - 15
      const pose = Math.floor(t * 6) % birdFrames.length
      ctx.sprite(birdFrames[pose]!, flight, h * 0.18 + Math.sin(t) * 2)
    }
  },
}

export default scene
