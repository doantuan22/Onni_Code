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

type Point = readonly [number, number]

function points(ctx: BuildCtx, shape: readonly Point[], drift = 0): { x: number; y: number }[] {
  return shape.map(([u, v]) => ({ x: ctx.width * u + drift, y: ctx.height * v }))
}

function cloudMass(ctx: BuildCtx, underside: readonly Point[], body: readonly Point[], rim: readonly Point[], drift: number, undersideInk: number, bodyInk: number, rimInk: number): void {
  ctx.polygon(points(ctx, underside, drift), undersideInk)
  ctx.polygon(points(ctx, body, drift), bodyInk)
  for (let i = 1; i < rim.length; i++) {
    const [ax, ay] = rim[i - 1]!
    const [bx, by] = rim[i]!
    ctx.line(ctx.width * ax + drift, ctx.height * ay, ctx.width * bx + drift, ctx.height * by, rimInk)
  }
}

// These overlapping contours are deliberately hand-drawn as banks rather than
// stamped puffs: their different heights leave occasional windows to the ridge.
const farCloudUnder: readonly Point[] = [[-.04, .68], [-.02, .60], [.06, .57], [.13, .59], [.19, .53], [.29, .55], [.37, .50], [.47, .55], [.55, .52], [.63, .57], [.70, .50], [.79, .54], [.87, .49], [.95, .55], [1.04, .53], [1.04, .72], [-.04, .72]]
const farCloudBody: readonly Point[] = [[-.04, .65], [.03, .60], [.10, .60], [.16, .55], [.25, .58], [.34, .52], [.42, .56], [.50, .54], [.58, .57], [.66, .52], [.74, .56], [.82, .51], [.90, .56], [.98, .54], [1.04, .58], [1.04, .67], [.82, .66], [.68, .64], [.52, .67], [.35, .64], [.18, .67], [-.04, .67]]
const farCloudRim: readonly Point[] = [[.03, .60], [.10, .60], [.16, .55], [.25, .58], [.34, .52], [.42, .56], [.50, .54], [.58, .57], [.66, .52], [.74, .56], [.82, .51], [.90, .56]]
const nearCloudUnder: readonly Point[] = [[-.05, 1.04], [-.05, .76], [.04, .70], [.14, .73], [.22, .66], [.34, .72], [.43, .63], [.54, .68], [.65, .61], [.76, .69], [.85, .64], [.95, .71], [1.05, .67], [1.05, 1.04]]
const nearCloudBody: readonly Point[] = [[-.05, .86], [.02, .76], [.10, .76], [.18, .70], [.28, .75], [.39, .67], [.48, .70], [.57, .65], [.68, .70], [.78, .66], [.88, .72], [.98, .70], [1.05, .73], [1.05, .87], [.84, .86], [.69, .83], [.50, .88], [.31, .84], [.12, .89], [-.05, .88]]
const nearCloudRim: readonly Point[] = [[.02, .76], [.10, .76], [.18, .70], [.28, .75], [.39, .67], [.48, .70], [.57, .65], [.68, .70], [.78, .66], [.88, .72]]

function cloudLobes(ctx: BuildCtx, lobes: readonly (readonly [number, number, number])[], underside: number, body: number, rim: number): void {
  for (const [u, v, radius] of lobes) {
    const x = ctx.width * u
    const y = ctx.height * v
    ctx.polygon([{ x: x - radius, y }, { x: x + radius, y }, { x: x + radius * .72, y: y + radius * .72 }, { x: x - radius * .72, y: y + radius * .72 }], underside)
    ctx.disc(x, y, radius, body)
    ctx.line(x + radius * .08, y - radius * .84, x + radius * .62, y - radius * .42, rim)
  }
}

function driftingCloud(ctx: BuildCtx, u: number, v: number, size: number, drift: number, underside: number, body: number, rim: number, variant: 0 | 1 | 2): void {
  const profiles: readonly (readonly Point[])[] = [
    [[-.18, .08], [-.15, -.08], [-.08, -.16], [.00, -.10], [.05, -.25], [.15, -.22], [.22, -.08], [.19, .10], [.08, .14], [-.06, .17]],
    [[-.23, .09], [-.18, -.04], [-.10, -.13], [-.01, -.08], [.07, -.22], [.17, -.16], [.26, -.02], [.21, .11], [.08, .13], [-.08, .18]],
    [[-.20, .10], [-.16, -.10], [-.05, -.17], [.04, -.11], [.10, -.26], [.21, -.18], [.29, .01], [.19, .14], [.02, .12], [-.10, .18]],
  ]
  const contour = profiles[variant]!
  const scale = (shape: readonly Point[], yOffset: number) => shape.map(([x, y]) => ({ x: ctx.width * u + x * size + drift, y: ctx.height * v + y * size + yOffset }))
  ctx.polygon(scale(contour, size * .14), underside)
  ctx.polygon(scale(contour.map(([x, y]) => [x * .84, y * .74 - .035] as const), 0), body)
  const rimLine = scale(contour.slice(1, 6), -size * .035)
  for (let i = 1; i < rimLine.length; i++) ctx.line(rimLine[i - 1]!.x, rimLine[i - 1]!.y, rimLine[i]!.x, rimLine[i]!.y, rim)
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
    for (let y = 0; y < h; y++) {
      const boundaries = [h * .23, h * .46, h * .69]
      const boundary = boundaries.findIndex((value) => Math.abs(y - value) <= 10)
      if (boundary >= 0) {
        const center = boundaries[boundary]!
        const amount = Math.max(0, Math.min(1, (y - (center - 10)) / 20))
        for (let x = 0; x < w; x++) ctx.px(x, y, ctx.dither(x, y, amount, boundary, boundary + 1))
      } else {
        ctx.rect(0, y, w, 1, y < boundaries[0]! ? 0 : y < boundaries[1]! ? 1 : y < boundaries[2]! ? 2 : 3)
      }
    }
    ctx.disc(w * 0.88, h * 0.34, Math.max(3, h * 0.027), 3)
    // 2: cool, low shoulders give the main ridge a distant basin to rise from.
    ctx.polygon(points(ctx, [[0, .60], [.10, .53], [.20, .57], [.31, .48], [.42, .55], [.50, .51], [.58, .59], [.68, .54], [.78, .60], [1, .52], [1, .70], [0, .70]]), 4)
    ctx.polygon(points(ctx, [[0, .65], [.12, .59], [.25, .63], [.38, .56], [.49, .64], [.60, .58], [.73, .65], [.86, .57], [1, .62], [1, .73], [0, .73]]), 5)
    // 3: Fansipan's silhouette has a broken left shoulder, a sharp high point,
    // and an uneven right spur. Faces meet on a crooked ridge, never a box edge.
    ctx.polygon(points(ctx, [[.43, .68], [.48, .57], [.53, .50], [.58, .42], [.63, .45], [.68, .28], [.70, .23], [.73, .31], [.77, .29], [.80, .37], [.85, .43], [.89, .56], [.95, .66]]), 8)
    ctx.polygon(points(ctx, [[.43, .68], [.48, .57], [.53, .50], [.58, .42], [.63, .45], [.68, .28], [.70, .23], [.69, .39], [.72, .46], [.68, .57], [.61, .63], [.54, .68]]), 10)
    ctx.polygon(points(ctx, [[.70, .23], [.73, .31], [.77, .29], [.80, .37], [.85, .43], [.89, .56], [.95, .66], [.78, .65], [.72, .57], [.68, .57], [.72, .46], [.69, .39]]), 9)
    ctx.polygon(points(ctx, [[.48, .57], [.53, .50], [.58, .42], [.63, .45], [.61, .55], [.54, .63], [.47, .67]]), 7)
    // Crooked couloirs and short strata follow each face instead of forming a
    // single hard shadow wedge.
    ctx.line(w * .70, h * .24, w * .69, h * .39, 11)
    ctx.line(w * .69, h * .39, w * .72, h * .46, 11)
    ctx.line(w * .72, h * .46, w * .68, h * .57, 11)
    ctx.line(w * .67, h * .32, w * .61, h * .46, 9)
    ctx.line(w * .62, h * .47, w * .57, h * .57, 9)
    ctx.line(w * .75, h * .34, w * .80, h * .43, 11)
    ctx.line(w * .80, h * .43, w * .84, h * .54, 11)
    ctx.line(w * .54, h * .53, w * .64, h * .51, 11)
    ctx.line(w * .57, h * .58, w * .67, h * .55, 9)
    ctx.line(w * .74, h * .49, w * .84, h * .52, 10)
    ctx.line(w * .77, h * .57, w * .89, h * .61, 10)
    // 4-5: broad, overlapping banks form one sea. Their unequal crests bury
    // the mountain base at changing heights while preserving a few deep gaps.
    cloudMass(ctx, farCloudUnder, farCloudBody, farCloudRim, 0, 12, 14, 15)
    cloudMass(ctx, nearCloudUnder, nearCloudBody, nearCloudRim, 0, 13, 14, 15)
    cloudLobes(ctx, [[.07, .59, h * .025], [.16, .56, h * .034], [.28, .58, h * .027], [.37, .53, h * .040], [.50, .55, h * .031], [.65, .53, h * .038], [.82, .53, h * .034], [.93, .56, h * .025]], 12, 14, 15)
    cloudLobes(ctx, [[.03, .76, h * .055], [.17, .71, h * .072], [.32, .74, h * .051], [.42, .68, h * .076], [.58, .67, h * .062], [.70, .69, h * .087], [.86, .68, h * .068], [.97, .72, h * .054]], 13, 14, 15)
    // 6: a near spur cuts the lower left, with trail and shrubs for scale.
    ctx.polygon([{ x: 0, y: h }, { x: 0, y: h * 0.69 }, { x: w * 0.14, y: h * 0.76 }, { x: w * 0.32, y: h },], 16)
    ctx.curve([{ x: 0, y: h * 0.89 }, { x: w * 0.10, y: h * 0.83 }, { x: w * 0.18, y: h * 0.90 }], 18)
    for (let x = 0; x < w * 0.23; x += 6) ctx.disc(x, h * (0.72 + ctx.fbm1(x) * 0.12), 3, 17)
  },
  frame(ctx, t) {
    const { width: w, height: h } = ctx
    // A few differently sized curls slide over the static banks; their distinct
    // speeds make depth readable without restamping an identical tile row.
    driftingCloud(ctx, .12, .61, h * .64, (t * .15) % (w + 80) - 40, 12, 14, 15, 0)
    driftingCloud(ctx, .50, .64, h * .82, (t * .15) % (w + 100) - 50, 12, 14, 15, 1)
    driftingCloud(ctx, .24, .78, h * 1.12, (t * .4) % (w + 150) - 75, 13, 14, 15, 2)
    driftingCloud(ctx, .73, .81, h * 1.38, (t * .4) % (w + 180) - 90, 13, 14, 15, 1)
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
