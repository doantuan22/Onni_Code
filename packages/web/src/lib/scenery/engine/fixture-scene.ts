import { parseSprite } from './sprite'
import { reflectWater } from './terrain'
import type { SceneDef } from './types'

/** Test-only landscape; intentionally absent from the production registry. */
const boat = parseSprite(['..a..', '.aa..', 'bbbbb', '.bbb.'], { a: 4, b: 5 })
const fixture: SceneDef = {
  id: 'engine-fixture',
  name: { en: 'Engine fixture', vi: 'Cảnh kiểm thử' },
  region: 'vn', tone: 'both', defaultTime: 'dawn', horizon: 0.6, focus: { x: 0.67, y: 0.6 },
  palettes: {
    dawn: [0x9d8ca3, 0xd5aba0, 0x747e95, 0x435770, 0xc8a17a, 0x35495c],
    day: [0x709fb1, 0xb3c6bd, 0x627e87, 0x3c6268, 0xd2b381, 0x344d55],
    dusk: [0x927e9c, 0xc79282, 0x6d6686, 0x494b68, 0xc7a078, 0x3f4158],
    night: [0x202c48, 0x38425c, 0x303c52, 0x263345, 0x9c9378, 0x202b3c],
  },
  build(ctx) {
    const { width: w, height: h } = ctx
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) ctx.px(x, y, ctx.dither(x, y, y / h, 0, 1))
    }
    ctx.disc(w * 0.67, h * 0.28, h * 0.065, 4)
    for (let layer = 0; layer < 2; layer++) {
      const heights = ctx.ridge({ height: 0.42 + layer * 0.12, amplitude: 0.22, frequency: 180 + ctx.rng() * 30 })
      for (let x = 0; x < w; x++) ctx.rect(x, heights[x]! * h, 1, h, 2 + layer)
    }
    ctx.line(0, h * 0.6, w - 1, h * 0.6, 5)
  },
  frame(ctx, t) {
    reflectWater(ctx.base, ctx.frame, ctx.width, ctx.height, ctx.height * 0.6, t)
    ctx.sprite(boat, ctx.width * 0.67 + Math.floor(Math.sin(t / 4)), ctx.height * 0.7)
  },
}
export default fixture
