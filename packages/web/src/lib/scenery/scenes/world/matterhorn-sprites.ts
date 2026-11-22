import { createSpriteSheet, parseSprite } from '../../engine/sprite'
import type { Palettes, ThemePalettes } from '../../engine/types'

/**
 * 32-role semantic palette layout for `world-matterhorn`:
 *  0–3   sky zenith -> horizon
 *  4     sun disc (matches sky[1] at night)
 *  5     moon & quiet alpine stars (matches sky[0] in daytime)
 *  6–7   high alpine clouds lit top / shaded belly
 *  8–9   far ridge 1 lit / shadow (atmospheric haze)
 * 10–11  far ridge 2 lit / shadow
 * 12–14  Matterhorn snow sunlit / midtone / shadow
 * 15     Matterhorn sunlit granite rock
 * 16–21  6-phase Stellisee lake water cycle
 * 22     calm lake deep base / subdued reflection shadow
 * 23     granite rock shadow / structural couloir seam
 * 24–26  pine tree bough snow-highlight / mid green-teal / deep shadow & trunk
 * 27–28  valley cabin timber & roof / warm window glow
 * 29     cabin chimney smoke wisp
 * 30     alpine bird silhouette
 * 31     foreground rocky shore highlight / alpine grass accent
 */
export const MATTERHORN_THEME_PALETTES: ThemePalettes = {
  light: {
    dawn: [
      0x688bb0, 0x93aec8, 0xc3c6cb, 0xe9cbb5,
      0xf8ddb5, 0x688bb0,
      0xf6e6d6, 0xc5bec8,
      0x8ba2ba, 0x768ca5,
      0x7488a0, 0x5c718c,
      0xf2dcc4, 0xc2d5df, 0x69819c,
      0x7f8896,
      0x4e7991, 0x537f96, 0x608a9f, 0x86a6b0, 0xb2c5be, 0xc9d5ca,
      0x3b627c,
      0x596474,
      0x9fb8c0, 0x3f5d5c, 0x263f43,
      0x6d574c, 0xefc07c,
      0xdce2e6,
      0x2f3b4d,
      0x848f7b,
    ],
    day: [
      0x5d90ba, 0x82b1cf, 0xb1cfdc, 0xd8e2d8,
      0xfff3cb, 0x5d90ba,
      0xfafaf5, 0xc5d5df,
      0x8ca9bf, 0x7695ad,
      0x728fa7, 0x597994,
      0xf7f2e6, 0xcfdce3, 0x6f8ca8,
      0x7b8896,
      0x447d96, 0x4c879f, 0x5d96aa, 0x83b0bc, 0xadc9ce, 0xc9dedb,
      0x336580,
      0x546474,
      0xb6cdd4, 0x3b635e, 0x224143,
      0x785c4b, 0x9bc0cf,
      0xe8eff2,
      0x28384a,
      0x7c926d,
    ],
    dusk: [
      0x4f567d, 0x867a9a, 0xbe9196, 0xe4b99d,
      0xf6c999, 0x4f567d,
      0xecd2c4, 0xa892a6,
      0x837f9e, 0x6d698b,
      0x686588, 0x515072,
      0xebd0bd, 0xb5afc2, 0x5d6889,
      0x747287,
      0x476885, 0x4e708c, 0x5d7c95, 0x8294a6, 0xa9aebb, 0xc7bab9,
      0x35506d,
      0x4d5066,
      0x99a2b4, 0x385056, 0x243440,
      0x5e4a49, 0xf2bf78,
      0xd2cad2,
      0x272d42,
      0x787670,
    ],
    night: [
      0x2d4163, 0x3d5478, 0x556c8e, 0x7185a3,
      0x3d5478, 0xe3ecf5,
      0x7b90ad, 0x586d8c,
      0x506484, 0x425675,
      0x435776, 0x354866,
      0xb8c8d8, 0x899fb8, 0x4b6182,
      0x566984,
      0x304e6b, 0x365774, 0x416480, 0x597c96, 0x7697ad, 0x94b1c2,
      0x243e58,
      0x374961,
      0x6f879e, 0x2f4b54, 0x1e333c,
      0x4a434c, 0xf2c278,
      0x8ea2ba,
      0x182338,
      0x5a6b73,
    ],
  },
  dark: {
    dawn: [
      0x243050, 0x484d72, 0x896c7e, 0xc99686,
      0xf4c490, 0x243050,
      0xdcc0b6, 0x86748c,
      0x585c7e, 0x474c6d,
      0x4a4e70, 0x393e5e,
      0xebc4ac, 0xa89db2, 0x4c5878,
      0x63637a,
      0x314a66, 0x385470, 0x45627c, 0x677c8f, 0x8c95a3, 0xb2a8a6,
      0x22364f,
      0x3e4259,
      0x808b9e, 0x2a4146, 0x1a2b34,
      0x4e3e3d, 0xf2be74,
      0xaeb2c2,
      0x161d2e,
      0x5e605f,
    ],
    day: [
      0x2b4b6e, 0x45698b, 0x6c8ca6, 0x99aeb8,
      0xf7e1ad, 0x2b4b6e,
      0xdce6eb, 0x8aa2b5,
      0x57738d, 0x455f78,
      0x476078, 0x364d65,
      0xe4e3dc, 0xa8bcc8, 0x4e6883,
      0x5c6a7a,
      0x2e5570, 0x365f7a, 0x446d86, 0x62899c, 0x84a5b2, 0xa5bebf,
      0x203f58,
      0x3c4b5c,
      0x8aa3b0, 0x284748, 0x182f34,
      0x56453c, 0x7599a8,
      0xbccbd2,
      0x182534,
      0x5a6e59,
    ],
    dusk: [
      0x1e2542, 0x3b3d61, 0x725972, 0xad7c77,
      0xf2b580, 0x1e2542,
      0xc7a39e, 0x6d607c,
      0x4a4d6d, 0x393d5c,
      0x3d405e, 0x2d314d,
      0xdfb39f, 0x948ca3, 0x3f4968,
      0x54546b,
      0x273e58, 0x2e4862, 0x3a546e, 0x576b80, 0x7a8394, 0x9f9698,
      0x1b2d44,
      0x33374d,
      0x6e788d, 0x22363e, 0x15242d,
      0x423438, 0xf2bc6e,
      0x9292a6,
      0x121828,
      0x4e4e57,
    ],
    night: [
      0x172742, 0x213552, 0x2e4564, 0x3e5873,
      0x213552, 0xdce6f2,
      0x526a88, 0x364c69,
      0x344a67, 0x283c57,
      0x2b3f5a, 0x20324b,
      0xb4c5d2, 0x7e98b4, 0x3f5475,
      0x43546c,
      0x203852, 0x253f59, 0x2e4b66, 0x41627c, 0x5b7e96, 0x799aae,
      0x172b42,
      0x29384f,
      0x5b738b, 0x263f47, 0x16272e,
      0x38343f, 0xf5c372,
      0x6b829c,
      0x0e1829,
      0x3e5058,
    ],
  },
}

export const MATTERHORN_LEGACY_PALETTES: Palettes = MATTERHORN_THEME_PALETTES.light

const pineLegend = { s: 24, m: 25, d: 26 } as const

/** Three distinct snow-dusted alpine pine variants:
 * 1. pineTall: tall slender larch / spruce (12x28)
 * 2. pineMedium: bushy Swiss stone pine (Arve / Cembra pine) (16x20)
 * 3. pineBroad: compact young dwarf mountain pine (10x14)
 */
export const pineTall = parseSprite([
  '.....ss.....',
  '.....sm.....',
  '....ssmd....',
  '....smmd....',
  '.....mm.....',
  '....ssmm....',
  '....smmd....',
  '....mmmd....',
  '....smmd....',
  '..ssmmmdd...',
  '..smmmmdd...',
  '..smmmmddd..',
  '....mmmd....',
  '..ssmmmdd...',
  '..smmmmddd..',
  '.ssmmmmmddd.',
  '..smmmmmdd..',
  '....mmmdd...',
  '.ssmmmmmddd.',
  '.smmmmmmdddd',
  'ssmmmmmmdddd',
  '..mmmmmmddd.',
  '.smmmmmdddd.',
  'ssmmmmmdddd.',
  '.dmmmmmdddd.',
  '....dddd....',
  '.....dd.....',
  '.....dd.....',
], pineLegend)

export const pineMedium = parseSprite([
  '.......ss.......',
  '......ssmd......',
  '.....ssmmdd.....',
  '.....smmmd......',
  '....ssmmmmdd....',
  '...ssmmmmmmdd...',
  '..ssmmmmmmmmdd..',
  '...smmd..smmdd..',
  '..ssmmd..smmmdd.',
  '.ssmmmd.ssmmmddd',
  '.smmmmd.smmmmddd',
  '..smmmd..mmmmmdd',
  '.ssmmmmddmmmmddd',
  'ssmmmmmmmmmmmddd',
  'ssmmmmmmmmmmmddd',
  '.dmmmmmmmmmmddd.',
  '..ddmmmmmmmddd..',
  '....dddddddd....',
  '.......dd.......',
  '.......dd.......',
], pineLegend)

export const pineBroad = parseSprite([
  '....ss....',
  '...ssmd...',
  '...smmd...',
  '..ssmmdd..',
  '..smmmdd..',
  '..smmmddd.',
  '.ssmmmmdd.',
  '.smmmmmddd',
  'ssmmmmmddd',
  '.smmmmmddd',
  '.dmmmmmddd',
  '..dddddd..',
  '....dd....',
  '....dd....',
], pineLegend)

/** Alpine cabin 18x14: scale anchor in the valley with snow roof & lit window. */
export const alpineCabin = parseSprite([
  '.............dd...',
  '.............dd...',
  '.......ssssssdd...',
  '.....ssssssssmm...',
  '...ssssssssmmmm...',
  '.ssssssssmmmmmm...',
  'ssssmmmmmmmmmmmm..',
  '..dddddddddddddd..',
  '..dbbbddwddbbbbd..',
  '..dbbbdwwwdbbbbd..',
  '..dbbbddwddbbbbd..',
  '..dbbbdddddbaabd..',
  '..dddddddddddddd..',
  '..................',
], { s: 12, m: 13, d: 26, b: 27, w: 28, a: 23 })

/** Chimney smoke 12x12: 4 curling rising puff poses. */
const smokeSprite = parseSprite([
  // Pose 0
  '............',
  '........aa..',
  '.......aaa..',
  '........a...',
  '......aa....',
  '.....aaa....',
  '......a.....',
  '....aa......',
  '...aa.......',
  '...a........',
  '..a.........',
  '............',
  // Pose 1
  '.........aa.',
  '........aa..',
  '.......aa...',
  '......aa....',
  '.....aaa....',
  '......a.....',
  '.....aa.....',
  '....aa......',
  '...aa.......',
  '..aa........',
  '..a.........',
  '............',
  // Pose 2
  '........aa..',
  '.......aaa..',
  '.......a....',
  '......aa....',
  '.....aaa....',
  '.....aa.....',
  '....aa......',
  '...aaa......',
  '...a........',
  '..aa........',
  '..a.........',
  '............',
  // Pose 3
  '.......aa...',
  '......aaa...',
  '......aa....',
  '.......a....',
  '.....aaa....',
  '....aaa.....',
  '....a.......',
  '...aa.......',
  '..aaa.......',
  '..a.........',
  '..a.........',
  '............',
], { a: 29 })

export const smokeSheet = createSpriteSheet(smokeSprite, [
  { x: 0, y: 0, width: 12, height: 12, pivot: { x: 2, y: 11 } },
  { x: 0, y: 12, width: 12, height: 12, pivot: { x: 2, y: 11 } },
  { x: 0, y: 24, width: 12, height: 12, pivot: { x: 2, y: 11 } },
  { x: 0, y: 36, width: 12, height: 12, pivot: { x: 2, y: 11 } },
])

/** Alpine bird 8x5: 4 wing-flap poses. */
const birdSprite = parseSprite([
  // Pose 0: wings up
  '.a....a.',
  '..a..a..',
  '...aa...',
  '........',
  '........',
  // Pose 1: wings glide level
  '........',
  'aa....aa',
  '..aaaa..',
  '........',
  '........',
  // Pose 2: wings down
  '........',
  '........',
  '..aaaa..',
  '.a....a.',
  'a......a',
  // Pose 3: wings recovering
  '........',
  '.a....a.',
  '..aaaa..',
  '........',
  '........',
], { a: 30 })

export const birdSheet = createSpriteSheet(birdSprite, [
  { x: 0, y: 0, width: 8, height: 5, pivot: { x: 4, y: 2 } },
  { x: 0, y: 5, width: 8, height: 5, pivot: { x: 4, y: 2 } },
  { x: 0, y: 10, width: 8, height: 5, pivot: { x: 4, y: 2 } },
  { x: 0, y: 15, width: 8, height: 5, pivot: { x: 4, y: 2 } },
])
