/** Reference: Erg Chebbi at last light: a small camel on the right-third crest,
 * copper slip faces, lavender distance and a low apricot sun lighting from the left. */
import { parseSprite } from '../../engine/sprite'
import type { SceneDef } from '../../engine/types'

const camel = parseSprite([
  '....................aa..',
  '...................aaaa.',
  '.......aa...aa.....aaa..',
  '......aaaa.aaaa....aa...',
  '.....aaaaaaaaaaa...aa...',
  '....aaaaaaaaaaaaaaaa....',
  '...aaaaaaaaaaaaaaaa.....',
  '..a.aaaaaaaaaaaaaa......',
  '..a..aa.aa....aa.aa.....',
  '.....aa.aa....aa.aa.....',
  '.....a...a....a...a.....',
  '....aa...a...aa...a.....',
], { a: 14 })

function crest(u: number, layer: number): number {
  return 0.52 + layer * 0.095 + Math.sin(u * 6.2 + layer * 1.9) * (0.045 + layer * 0.016) + Math.sin(u * 11 + layer) * 0.012
}

const scene: SceneDef = {
  id: 'world-sahara', name: { en: 'Sahara dunes', vi: 'Cồn cát Sahara' },
  region: 'world', tone: 'both', defaultTime: 'dusk', horizon: 0.53, focus: { x: 0.69, y: 0.7 },
  palettes: {
    dawn: [0x676284, 0xba879b, 0xe6b19c, 0xf2d0a0, 0xad8b9c, 0xbf9b9c, 0xd9a089, 0xe2af91, 0xc78d80, 0xac747b, 0xe9b694, 0xce947c, 0x966777, 0xb37b73, 0x493e58, 0xf0c49d],
    day: [0x648eae, 0x9cbbcb, 0xd8d8c4, 0xefe1b0, 0xb5b5b7, 0xc5b7aa, 0xdec091, 0xe7c99a, 0xc7a582, 0xb58e7e, 0xebce99, 0xd9b180, 0xaa8273, 0xc69b77, 0x544c56, 0xf1d5a2],
    dusk: [0x494666, 0xa36e84, 0xde987d, 0xf0c28c, 0x9b7b91, 0xb88a8e, 0xd99c7c, 0xe9ad7f, 0xc5806d, 0xa76670, 0xe8aa79, 0xcc8865, 0x8c5667, 0xb47762, 0x40374d, 0xf2bc88],
    night: [0x1d2945, 0x354361, 0x5c607c, 0xb1bcc9, 0x5b617b, 0x697087, 0x7c7f95, 0x9393a3, 0x63677f, 0x505772, 0x9294a5, 0x77798f, 0x434d68, 0x5b637e, 0x252e46, 0xa3aabc],
  },
  build(ctx) {
    const { width: w, height: h } = ctx
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ramp = Math.min(1.99, y / h * 4.1)
      ctx.px(x, y, ctx.dither(x, y, ramp % 1, Math.floor(ramp), Math.floor(ramp) + 1))
    }
    ctx.disc(w * 0.28, h * 0.36, Math.min(w, h) * 0.068, 3)
    // Successive dune ridges shade by slope: warm windward sand, cool steep lee faces.
    for (let layer = 0; layer < 4; layer++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, top = crest(u, layer)
        const slope = crest(u + 0.002, layer) - top
        for (let y = Math.floor(top * h); y < h; y++) {
          const depth = y / h - top
          let index = layer === 0 ? 4 : layer === 1 ? 5 : slope > 0 ? 7 : 9
          if (layer >= 2) {
            const slip = depth < (0.012 + Math.max(0, slope * 350) * 0.11)
            index = slip ? (layer === 3 ? 12 : 9) : (layer === 3 ? 11 : 6)
            if (!slip && depth > 0.025 && y % 3 === 0 && Math.sin(x * 0.11 + y * 0.65) > 0.95) index = 13
            if (depth < 0.006 && slope < 0) index = 15
          }
          ctx.px(x, y, index)
        }
      }
    }
    const scale = Math.max(1, Math.min(2, Math.round(h / 180)))
    const x = w * 0.69, y = crest(0.69, 3) * h
    ctx.line(x - 6 * scale, y + 2, x + 25 * scale, y + 5, 12)
    ctx.sprite(camel, x, y - 12 * scale, scale)
    // A faint track anchors the caravan to the dune without another focal object.
    for (let i = 0; i < 9; i++) ctx.line(x - 5 - i * 5, y + i * 1.3, x - 3 - i * 5, y + i * 1.3, 13)
  },
  frame(ctx, t) {
    const { width: w, height: h } = ctx
    for (let i = 0; i < 42; i++) {
      const phase = ((i * 0.61803398875 + ctx.seed * 0.013) % 1 + t * (0.008 + (i % 3) * 0.002)) % 1
      const x = phase * w
      const y = (crest(phase, 2) - 0.004 - (i % 7) * 0.002) * h + Math.sin(t * 0.35 + i) * 0.7
      ctx.line(x, y, x + (i % 3 === 0 ? 2 : 0), y, i % 4 === Math.floor(t / 8) % 4 ? 15 : 7)
    }
  },
}
export default scene
