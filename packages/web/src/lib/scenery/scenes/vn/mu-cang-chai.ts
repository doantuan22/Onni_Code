/**
 * Original scene study: three hand-shaped terrace basins step down into a
 * misty Mù Cang Chải valley. The stilt house and winding irrigation channel
 * are deliberate scale anchors; no external pixel assets are used.
 */
import { parseSprite } from '../../engine/sprite'
import type { Palettes, SceneDef, ThemePalettes } from '../../engine/types'

const palette = (sky: number, horizon: number, far: number, haze: number, shadow: number, rice: number, gold: number, soil: number, water: number, wood: number, leaf: number, cloud: number): readonly number[] => [
  sky, sky, horizon, 0xf0d29b, far, shadow, haze, cloud,
  shadow, rice, gold, 0xe4cc78, soil, 0x8d7653, water, 0xb4d3c1,
  0x342d2d, wood, 0xd8ae70, 0x273e35, leaf, 0x9bae64, haze, cloud,
  0xf2dfbd, 0x5f4f40, 0x253045, 0xc8a56d, 0x6c5b48, 0x405b50, 0x1c2a30, 0xf6e1a8,
]

const light: Palettes = {
  dawn: palette(0x8cadbf, 0xf0c9a5, 0x607c79, 0xa9bdb1, 0x435b50, 0x8b9850, 0xd5b965, 0x765d45, 0x719fa0, 0x735649, 0x4d744f, 0xbdc7bb),
  day: palette(0xa7cbd7, 0xcfdbba, 0x647c73, 0xa6c8b4, 0x455b43, 0xb6ae51, 0xe4cc78, 0x7d684d, 0x6fabb0, 0x675345, 0x435e49, 0xcbd8cc),
  dusk: palette(0x55627f, 0xac8074, 0x4c625c, 0x8a9a92, 0x3f4a3e, 0x82764a, 0xc6a96a, 0x53433f, 0x638d92, 0x58413e, 0x405649, 0xb7a39a),
  night: palette(0x202b48, 0x46556a, 0x344d4e, 0x657778, 0x293c3c, 0x586343, 0x9c9160, 0x393840, 0x496d76, 0x413b42, 0x314a43, 0x73818a),
}

const dark: Palettes = {
  dawn: palette(0x52677d, 0xba947e, 0x405c5a, 0x718f88, 0x2f463e, 0x737b43, 0xb9a563, 0x55473f, 0x527d83, 0x493b3d, 0x365846, 0x91a39a),
  day: palette(0x62899a, 0xaebc9e, 0x46635e, 0x76968a, 0x33493c, 0x8b8548, 0xc5b568, 0x604f42, 0x56868d, 0x51423d, 0x385641, 0x9caf9f),
  dusk: palette(0x293450, 0xac8074, 0x3c5655, 0x71827f, 0x263936, 0x706644, 0xc6a96a, 0x453b3c, 0x52747a, 0x342f36, 0x344d43, 0x8d888a),
  night: palette(0x14233d, 0x344a65, 0x273e45, 0x536878, 0x1c3031, 0x46513f, 0x7e815e, 0x2c3038, 0x385b68, 0x292d38, 0x29413d, 0x667489),
}

const themePalettes: ThemePalettes = { light, dark }

const grassFrames = [
  parseSprite(['..l.....', '.lll....', '..l..l..', 'l.l..ll.', '.l....l.', '........', '........', '........'], { l: 21 }),
  parseSprite(['...l....', '..ll.l..', '.l..l...', 'l.l..ll.', '..l...l.', '........', '........', '........'], { l: 21 }),
  parseSprite(['....l...', '..l.ll..', '.l...l..', '.ll..l.l', 'l....l..', '........', '........', '........'], { l: 21 }),
] as const

const birdFrames = [
  parseSprite(['..b...b.', '.b.b.b..', 'b...b...', '........', '........'], { b: 26 }),
  parseSprite(['........', '.b....b.', '..b..b..', '...bb...', '........'], { b: 26 }),
  parseSprite(['...b.b..', '..b...b.', '.b.....b', '........', '........'], { b: 26 }),
  parseSprite(['........', '..b..b..', '.b....b.', '........', '........'], { b: 26 }),
] as const

function ridge(ctx: Parameters<SceneDef['build']>[0], y: number, color: number, seed: number): void {
  const { width: w, height: h } = ctx
  for (let x = 0; x < w; x++) {
    const top = Math.floor(h * (y + (ctx.fbm2(x * 0.018, seed) - 0.5) * 0.10 + Math.sin(x * 0.035 + seed) * 0.024))
    ctx.rect(x, top, 1, h - top, color)
  }
}

function terraces(ctx: Parameters<SceneDef['build']>[0], x0: number, x1: number, top: number, base: number, bend: number): void {
  const { width: w, height: h } = ctx
  const start = Math.floor(x0 * w)
  const end = Math.floor(x1 * w)
  for (let x = start; x < end; x++) {
    const u = (x - start) / Math.max(1, end - start)
    const slope = top + (base - top) * (0.26 + u * 0.62) + Math.sin(u * Math.PI) * bend
    for (let y = Math.floor(slope * h); y < h; y++) {
      const d = (y / h - slope) / Math.max(0.08, base - top)
      const step = Math.max(0, Math.floor(d * 7 + u * 1.7))
      const lip = (d * 7 + u * 1.7) - step
      let ink = step % 3 === 0 ? 9 : step % 3 === 1 ? 10 : 8
      if (lip < 0.105) ink = 11
      if (lip > 0.77) ink = 12
      if (ctx.fbm2(x * 0.09, y * 0.09) > 0.77 && lip > 0.25) ink = 20
      ctx.px(x, y, ink)
    }
  }
}

const scene: SceneDef = {
  id: 'vn-mu-cang-chai',
  name: { en: 'Mù Cang Chải Rice Terraces', vi: 'Ruộng bậc thang Mù Cang Chải' },
  region: 'vn',
  tone: 'both',
  palettes: light,
  themePalettes,
  defaultTime: 'day',
  themeDefaultTime: { light: 'day', dark: 'dusk' },
  horizon: 0.37,
  focus: { x: 0.69, y: 0.65 },
  build(ctx) {
    const { width: w, height: h } = ctx
    // 1: clean, layered sky and a restrained sun.
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) ctx.px(x, y, ctx.dither(x, y, y / h * 0.9, 0, 2, 8))
    ctx.disc(w * 0.22, h * 0.20, Math.max(4, h * 0.035), 3)
    // 2-3: two distant ridge planes, deliberately separate silhouettes.
    ridge(ctx, 0.39, 4, 17)
    ridge(ctx, 0.47, 5, 43)
    // 4: three independent, curving terrace basins.
    terraces(ctx, 0.06, 0.43, 0.47, 0.93, -0.055)
    terraces(ctx, 0.34, 0.73, 0.42, 0.95, 0.035)
    terraces(ctx, 0.64, 1.02, 0.49, 0.94, -0.045)
    // 5: watercourse is a leading line rather than another contour stripe.
    ctx.curve([{ x: w * 0.54, y: h }, { x: w * 0.51, y: h * 0.79 }, { x: w * 0.66, y: h * 0.60 }, { x: w * 0.63, y: h * 0.52 }], 14)
    ctx.curve([{ x: w * 0.56, y: h }, { x: w * 0.54, y: h * 0.80 }, { x: w * 0.68, y: h * 0.62 }, { x: w * 0.65, y: h * 0.54 }], 15)
    // Stilt house: roof, wall, posts, and a contact shadow.
    const hx = Math.floor(w * 0.77); const hy = Math.floor(h * 0.59)
    ctx.polygon([{ x: hx - 15, y: hy }, { x: hx + 15, y: hy }, { x: hx + 7, y: hy - 8 }, { x: hx - 9, y: hy - 8 }], 16)
    ctx.polygon([{ x: hx - 11, y: hy - 8 }, { x: hx + 7, y: hy - 8 }, { x: hx + 13, y: hy - 14 }, { x: hx - 6, y: hy - 14 }], 18)
    ctx.rect(hx - 9, hy, 17, 7, 17); ctx.rect(hx - 6, hy + 7, 2, 8, 16); ctx.rect(hx + 5, hy + 7, 2, 8, 16)
    ctx.rect(hx - 12, hy + 14, 25, 2, 25)
    // 6: near rice and a path occlude the lowest terrace corner.
    ctx.polygon([{ x: w * 0.84, y: h }, { x: w, y: h }, { x: w, y: h * 0.70 }, { x: w * 0.90, y: h * 0.76 }], 19)
    ctx.curve([{ x: w * 0.04, y: h }, { x: w * 0.17, y: h * 0.88 }, { x: w * 0.22, y: h * 0.83 }], 13)
  },
  frame(ctx, t) {
    const { width: w, height: h } = ctx
    // Valley mist: a clipped, broken band, shifting at a deliberately slow rate.
    const drift = Math.floor(t * 0.2) % 18
    for (let x = Math.floor(w * 0.42); x < Math.floor(w * 0.71); x += 3) {
      const y = Math.floor(h * (0.48 + Math.sin((x + drift) * 0.08) * 0.018))
      if (ctx.fbm2((x + drift) * 0.04, 91) > 0.38) ctx.rect(x, y, 7, 2, 23)
    }
    // Narrow water glints animate independently from the rice hues.
    const glint = Math.floor(t * 4) % 4
    for (let i = 0; i < 9; i++) {
      const y = Math.floor(h * (0.65 + i * 0.032))
      const x = Math.floor(w * (0.58 + i * 0.009 + Math.sin((i + glint) * 2) * 0.018))
      ctx.rect(x, y, 3 + ((i + glint) % 4), 1, 15)
    }
    // Wind ripples only the foreground rice clumps, in three nonmatching phases.
    for (let i = 0; i < 12; i++) {
      const phase = Math.floor(t * 2 + i * 0.7) % grassFrames.length
      ctx.sprite(grassFrames[phase]!, w * (0.85 + (i % 5) * 0.035), h * (0.73 + Math.floor(i / 5) * 0.075), 1)
    }
    const flight = (Math.floor(t * 12) % (w + 30)) - 16
    const pose = Math.floor(t * 6) % birdFrames.length
    ctx.sprite(birdFrames[pose]!, flight, h * 0.22 + Math.sin(t * 1.2) * 2)
    ctx.sprite(birdFrames[(pose + 2) % birdFrames.length]!, flight - 20, h * 0.27 - Math.sin(t) * 2)
  },
}

export default scene
