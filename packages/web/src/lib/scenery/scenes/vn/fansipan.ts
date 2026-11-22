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

function cloudPuff(ctx: BuildCtx, x: number, y: number, width: number, height: number, underside: number, body: number, rim: number): void {
  const lobe = (points: readonly [number, number][]) => points.map(([u, v]) => ({ x: x + u * width, y: y + v * height }))
  // Hand-shaped lobes deliberately avoid circular highlights: the upper contour
  // faces the dawn while a compressed, cool underside gives the cloud its weight.
  ctx.polygon(lobe([[-.58, .22], [-.52, -.08], [-.38, -.34], [-.18, -.28], [-.10, -.58], [.12, -.62], [.27, -.38], [.48, -.30], [.62, -.02], [.55, .28], [.35, .42], [.08, .36], [-.18, .48], [-.44, .40]]), underside)
  ctx.polygon(lobe([[-.50, .12], [-.42, -.18], [-.25, -.34], [-.08, -.22], [.02, -.50], [.20, -.46], [.31, -.22], [.51, -.14], [.55, .08], [.37, .22], [.10, .16], [-.12, .30], [-.37, .24]]), body)
  ctx.line(x - width * .34, y - height * .20, x - width * .08, y - height * .38, rim)
  ctx.line(x - width * .08, y - height * .38, x + width * .15, y - height * .31, rim)
  ctx.line(x + width * .15, y - height * .31, x + width * .34, y - height * .12, rim)
}

function cloudBank(ctx: BuildCtx, offset: number, y: number, scale: number, underside: number, body: number, rim: number, near = false): void {
  const { width: w, height: h } = ctx
  const spacing = near ? 86 : 68
  const start = -spacing + offset
  for (let i = 0, x = start; x < w + spacing; i++, x += spacing) {
    const width = (near ? 52 : 38) * scale * (1 + (i % 3) * .08)
    const height = (near ? 25 : 17) * scale * (i % 2 ? 1.08 : .92)
    cloudPuff(ctx, x, h * y + (i % 3 - 1) * (near ? 5 : 3), width, height, underside, body, rim)
  }
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
    // 3: Fansipan is a broken ridge, not a symmetric pyramid: three planes,
    // a left shoulder, and a right spur retain their silhouette above the cloud sea.
    ctx.polygon([{ x: w * .46, y: h * .66 }, { x: w * .53, y: h * .48 }, { x: w * .59, y: h * .40 }, { x: w * .67, y: h * .23 }, { x: w * .73, y: h * .34 }, { x: w * .77, y: h * .30 }, { x: w * .83, y: h * .50 }, { x: w * .91, y: h * .64 }], 8)
    ctx.polygon([{ x: w * .53, y: h * .48 }, { x: w * .67, y: h * .23 }, { x: w * .70, y: h * .52 }, { x: w * .60, y: h * .63 }], 10)
    ctx.polygon([{ x: w * .70, y: h * .52 }, { x: w * .67, y: h * .23 }, { x: w * .77, y: h * .30 }, { x: w * .83, y: h * .50 }, { x: w * .91, y: h * .64 }], 9)
    ctx.polygon([{ x: w * .46, y: h * .66 }, { x: w * .53, y: h * .48 }, { x: w * .60, y: h * .63 }, { x: w * .56, y: h * .68 }], 7)
    ctx.line(w * .69, h * .25, w * .70, h * .52, 11)
    ctx.line(w * .77, h * .31, w * .78, h * .47, 11)
    ctx.line(w * .59, h * .42, w * .63, h * .57, 9)
    // 4-5: separated far and near banks leave visible gaps and occlude the peak
    // at different heights, creating a proper sea rather than two horizontal strips.
    cloudBank(ctx, 12, .58, 1, 12, 14, 15)
    cloudBank(ctx, 0, .77, 1.34, 13, 14, 15, true)
    // 6: a near spur cuts the lower left, with trail and shrubs for scale.
    ctx.polygon([{ x: 0, y: h }, { x: 0, y: h * 0.69 }, { x: w * 0.14, y: h * 0.76 }, { x: w * 0.32, y: h },], 16)
    ctx.curve([{ x: 0, y: h * 0.89 }, { x: w * 0.10, y: h * 0.83 }, { x: w * 0.18, y: h * 0.90 }], 18)
    for (let x = 0; x < w * 0.23; x += 6) ctx.disc(x, h * (0.72 + ctx.fbm1(x) * 0.12), 3, 17)
  },
  frame(ctx, t) {
    const { width: w, height: h } = ctx
    // Separate overscanned banks move at visibly different speeds.
    const farOffset = (t * 0.15) % 68
    cloudBank(ctx, farOffset, .575, .42, 12, 14, 15)
    const nearOffset = (t * 0.4) % 86
    cloudBank(ctx, nearOffset, .79 + Math.sin(t * .8) * .006, .56, 13, 14, 15, true)
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
