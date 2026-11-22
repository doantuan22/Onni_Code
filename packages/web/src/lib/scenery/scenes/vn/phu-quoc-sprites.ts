import { createSpriteSheet, parseSprite } from '../../engine/sprite'
import type { Palettes, ThemePalettes } from '../../engine/types'

/**
 * 32-index palette map for vn-phu-quoc (the engine caps a scene at 32 indices, so every
 * slot is spent deliberately):
 * 0..9:   Sky ramp, zenith -> horizon (10 bands; the warm last three carry the sunset glow)
 * 10..11: Sun / moon core and its stepped halo
 * 12..13: Cloud underside shadow and cloud body
 * 14..16: Distant haze isle, mid rainforest isle, sunlit canopy rim
 * 17..20: Sea depth ramp, horizon-bright -> foreground-deep (4 stepped bands)
 * 21..23: Wavelet / glint cycle (Wave0..Wave2)
 * 24..25: Dry sand and wet tide line
 * 26..28: Palm trunk and sampan timber (bark shadow, body, warm rim)
 * 29..31: Coconut frond shadow, body, golden sunset rim
 * Aliases share a slot instead of spending one: cloud rim = halo colour, foam = cloud body,
 * sea glint = sun core, beach rock = trunk shadow. Sprites reference the names, not the numbers.
 */
export const enum Ink {
  Sky0, Sky1, Sky2, Sky3, Sky4, Sky5, Sky6, Sky7, Sky8, Sky9,
  SunCore, SunGlow,
  CloudShadow, CloudBody,
  IslandFar, IslandMid, IslandRim,
  SeaFar, SeaMid, SeaNear, SeaDeep,
  Wave0, Wave1, Wave2,
  SandDry, SandWet,
  TrunkDark, TrunkMid, TrunkRim,
  FrondShadow, FrondBody, FrondRim,
  CloudRim = SunGlow,
  ShoreFoam = CloudBody,
  SeaGlint = SunCore,
  BeachRock = TrunkDark,
}

/** Number of sky bands; the sky is a stepped ramp, not a dithered field (spec: 10-14 bands). */
export const SKY_BANDS = 10

interface PhuQuocPaletteSpec {
  /** 4 stops, zenith -> horizon; expanded into SKY_BANDS interpolated bands. */
  readonly sky: readonly [number, number, number, number]
  readonly sun: readonly [number, number]
  readonly cloud: readonly [number, number]
  readonly island: readonly [number, number, number]
  readonly sea: readonly [number, number, number, number]
  readonly wave: readonly [number, number, number]
  readonly sand: readonly [number, number]
  readonly trunk: readonly [number, number, number]
  readonly frond: readonly [number, number, number]
}

function mixRgb(a: number, b: number, t: number): number {
  const channel = (shift: number): number =>
    Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t)
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

function skyRamp(stops: readonly number[], bands: number): number[] {
  return Array.from({ length: bands }, (_, i) => {
    const u = (i / (bands - 1)) * (stops.length - 1)
    const s = Math.min(stops.length - 2, Math.floor(u))
    return mixRgb(stops[s]!, stops[s + 1]!, u - s)
  })
}

function buildPalette(spec: PhuQuocPaletteSpec): number[] {
  return [
    ...skyRamp(spec.sky, SKY_BANDS),
    ...spec.sun, ...spec.cloud, ...spec.island, ...spec.sea,
    ...spec.wave, ...spec.sand, ...spec.trunk, ...spec.frond,
  ]
}

export const PHU_QUOC_THEME_PALETTES: ThemePalettes = {
  light: {
    dawn: buildPalette({
      sky: [0x6aa4c6, 0x9fcadb, 0xf0e0c8, 0xffd29c],
      sun: [0xfff6d8, 0xffe0a0],
      cloud: [0xb8c9d6, 0xfbf6ee],
      island: [0xa6c8c8, 0x5c8e8a, 0x92b88e],
      sea: [0xa8e4d8, 0x5cc2c4, 0x35a2b0, 0x227f94],
      wave: [0xd4f6ee, 0xf4fffa, 0xb0e6dc],
      sand: [0xf0d8a4, 0xb89a72],
      trunk: [0x42322a, 0x6c5444, 0xb48e6c],
      frond: [0x224036, 0x3e6852, 0xa4b478],
    }),
    day: buildPalette({
      sky: [0x4fa3d6, 0x8fcbe8, 0xc9ebec, 0xf4f4dc],
      sun: [0xfffbe6, 0xfff0c0],
      cloud: [0xb2d4e4, 0xffffff],
      island: [0xb2d6d8, 0x4f8a80, 0x88c08e],
      sea: [0xc0f2e6, 0x5ccfd0, 0x2aa6b6, 0x1c8498],
      wave: [0xe2fcf4, 0xffffff, 0xbcf0ea],
      sand: [0xf6e3b6, 0xc4a47c],
      trunk: [0x44342a, 0x705846, 0xba9472],
      frond: [0x24483a, 0x42765c, 0xaed078],
    }),
    dusk: buildPalette({
      sky: [0x6f8cc2, 0xc69cba, 0xf6a882, 0xffd58a],
      sun: [0xfff4c4, 0xffc87a],
      cloud: [0xa98aa6, 0xfbd8c6],
      island: [0xc49ca2, 0x6e5a74, 0xeaa48e],
      sea: [0xeab28e, 0x7ca6a8, 0x3c8192, 0x2a5c76],
      wave: [0xffe6a8, 0xfff4cc, 0xf6b48a],
      sand: [0xe8c896, 0x9c7660],
      trunk: [0x3c2c2e, 0x624844, 0xb07c62],
      frond: [0x1c3032, 0x2e4a46, 0xc8885c],
    }),
    night: buildPalette({
      sky: [0x1c2c4e, 0x2e4a72, 0x4c6e98, 0x7490b6],
      sun: [0xeef4dc, 0x7c98b6],
      cloud: [0x2b3d5c, 0x5b7698],
      island: [0x3c5878, 0x1c3046, 0x4c6e88],
      sea: [0x4f7aa0, 0x2f5a80, 0x233f63, 0x1a3050],
      wave: [0x9ec0e0, 0xc8dcf0, 0x7da4c8],
      sand: [0x7a7d90, 0x4a4c60],
      trunk: [0x24222a, 0x3c3844, 0x707282],
      frond: [0x142024, 0x1e3034, 0x668288],
    }),
  },
  dark: {
    dawn: buildPalette({
      sky: [0x34465e, 0x5a6d80, 0x8f8a8c, 0xd7a48a],
      sun: [0xfbe9c0, 0xd8a078],
      cloud: [0x4a4f62, 0xb6a6a0],
      island: [0x3a4c58, 0x22403e, 0x6d7a60],
      sea: [0x5a9aa2, 0x2f7480, 0x225a68, 0x18414f],
      wave: [0x9fd6d0, 0xc6ece4, 0x7fbcc0],
      sand: [0xc0a886, 0x7a6450],
      trunk: [0x2c221e, 0x4c3c32, 0x886a54],
      frond: [0x182c26, 0x2a4c3e, 0x7a8c58],
    }),
    day: buildPalette({
      sky: [0x2c5a80, 0x4f88aa, 0x84b4c4, 0xc4d2c0],
      sun: [0xfff4d0, 0xf0d090],
      cloud: [0x6f94a8, 0xc8d8e0],
      island: [0x4c7480, 0x2a5a58, 0x5c8a6a],
      sea: [0x6aaab4, 0x3c8c98, 0x2a7080, 0x1d5566],
      wave: [0xb6e6e0, 0xe2f6f0, 0x8ed2d0],
      sand: [0xc8b28e, 0x8a7456],
      trunk: [0x2e241e, 0x503e32, 0x8c7056],
      frond: [0x1a362c, 0x2e5a48, 0x7ea45c],
    }),
    dusk: buildPalette({
      sky: [0x261c3a, 0x4a2a54, 0x9a3e4e, 0xf0963e],
      sun: [0xffeaa0, 0xf08a4a],
      cloud: [0x4a2c4a, 0xe8806a],
      island: [0x3a2a4a, 0x1f2a3c, 0xe0704a],
      sea: [0x8a4a5a, 0x3a3c5e, 0x242c4a, 0x161e36],
      wave: [0xffa868, 0xffc890, 0xe0785a],
      sand: [0x8e6050, 0x4c3440],
      trunk: [0x181e20, 0x362828, 0x7c4436],
      frond: [0x141c1a, 0x22302a, 0xd46e3e],
    }),
    night: buildPalette({
      sky: [0x0b1426, 0x16243c, 0x22365a, 0x34496e],
      sun: [0xe4ecdc, 0x485e78],
      cloud: [0x101826, 0x2e3e58],
      island: [0x141e30, 0x0c141e, 0x3e5a72],
      sea: [0x2a4a6a, 0x1c3652, 0x142a42, 0x0e1e32],
      wave: [0x7698b0, 0x9ab8d0, 0x5a7c98],
      sand: [0x4a4454, 0x22202c],
      trunk: [0x14121a, 0x26222c, 0x484858],
      frond: [0x0e1618, 0x162224, 0x3e565c],
    }),
  },
}

export const PHU_QUOC_LEGACY_PALETTES: Palettes = PHU_QUOC_THEME_PALETTES.light

// 52x40 Hero Coconut Palm Crown (3 poses: neutral, wind gust, wind ease)
const heroCrownRaw = [
  '....................................................',
  '....................................................',
  '....................................................',
  '.........................ccc........................',
  '........................ccbccc......ccc.............',
  '.......................ccbbabcc...cccbbc............',
  '.......................ccbbaaaa..ccbbbbbc...........',
  '.............bbbb.....bccbbaa...ccbbbbbaac..........',
  '............bbbbbbbbb.bccbb....ccbbbbbaacccc........',
  '............bbbbbbb.bbbccbb....cbb..ccccacbbc.......',
  '..........bbbbbbbbbbbbbccb....ccbaabcabbbbbbbc......',
  '.........bbbb.bbbbbbbbbcccb..bbcaabaabbbbbb.bcc.....',
  '........bbb.bbbbbbbbbbbbcc...bcbabbb.bbbbbbbbbc.....',
  '........bbbbbbbbbbbbbbbbbcc..bcabcbaa..abbbbbbbc....',
  '.......bbbbbbbbbbbbbbbbbbc..bca.baaa.cccaaaaa.abc...',
  '......bbbbbbbbbbbbbbbbbbb...b..bcaa.ccbcccaaa.aacb..',
  '......bbbbbbbbbbbbbbbbbaab.bbbbaa.bbbbabbccc...aac..',
  '.....baabbbbbabbbbbbbbbb.b.b.b.abbabcccabbbccc..aca.',
  '......bbbbbbbbbabbbbbbbbb...b.bbcbbcaabcccbbbcc..cc.',
  '.....bbbbbbaaaabaaaabbbbb...bb.bbbaaa.bbbcccbbcc..ca',
  '....bbabbaaabbbabbaababbbb.bbbbaabbbbbbbbbaaccbc..ca',
  '....babbabbbbbbbbbbbbbbded.ded..aaaaabbbbbbaaccac.cc',
  '...baabbbbbbbbbbbbbbbbbede.edeba.aaaaaaaabbbbbcacc.c',
  '..bbabbbaaabbbbbbbbbbaabbdedbbbbbbba.aaaaabbbbbc.c..',
  '..babba.aaabbbbbbbbaaabba..bcccaabccc....aaabaac.ac.',
  '.ba.baaaaa.bbbbbbb..bbbba..bbaccaabbbcc...aaaaaac.cc',
  '...bbaaa..bbbbbbbaaaabbaa...bcac..aabbcc....aaaaca.c',
  '..bba....bbbbbbbaaa..bbaa....baccaaaaabbcc.......c..',
  '..ba....bbbbbbbaa....bba.......ac...aaabbcc......cc.',
  '........bbaabaaaa...bbaa........ca...aaabbbc......c.',
  '.......bbbaaaaa.....baaa.........c.....aabbcc.......',
  '......bbaaaaa......bbaa..........ca.....aaabc.......',
  '.....bbaaaa........baa...........cc......aaacc......',
  '....bbaaa.........................c........aac......',
  '....ba......................................acc.....',
  '..............................................c.....',
  '..............................................cc....',
  '...............................................c....',
  '....................................................',
  '....................................................',
  '....................................................',
  '....................................................',
  '....................................................',
  '..........................ccccc.....................',
  '........................ccbbbbccc...ccccc...........',
  '........................ccbbaaaaa.ccbbbbbcc.........',
  '.......................bccbaaaaa.ccbb.bbbacc........',
  '..............bbbbb....bccba..a..cbbbbbaaaacc.......',
  '.............bbbbbbb.bbccbba....cbbbbbbccccccc......',
  '.............bbbbbbbbbbccbb....cbbbabccabbbbbcc.....',
  '...........bbbbbbbbbbbbcccb...bcbbabaaaab.bbbbc.....',
  '..........bbbbb.bbbbbbbbccb...bbbacbabbbbb.bb.bc....',
  '.........bbbbb.bbbbbbbbbbc...bcaabbbabbbbbbb..bbc...',
  '.........bbbbbbbbbbbbbbbbcc..bcabcba..aaabbbbbbbbc..',
  '........bbbbbbbbbbbbbbbbbc..bccab.aaabccaaaaaaaaabc.',
  '........bbbbbbbbbbbbbbbbbb..b..bcaa.ccbbcccaaa.aaacb',
  '.......bbbbbbbbbbbbbbbbaab.bbbbaaabbcb.abbccc...aaac',
  '........bbbbbbbbbbbbbbbb.b.b.b.abb.accccabbbbcc..aac',
  '......bbbbbbbbbaaabbbbbbb...b.bbcbbbcaaacccbbbcc..aa',
  '......bbbbaaaaaaaaabbbbbb...bb.bbbaaabbbbaaccccbc...',
  '.....bbabaaabbbbbbaabbbbbb.bbbbaabbbb.bbbbaaaacccc..',
  '....bbababbbbbbbbbbbbbbded.ded..aaaaaa.bbbbbaaacac..',
  '....baabbbbbbbbbbbbbbbbede.edeba.aaaaaa.aabbbbbacac.',
  '...baabbbaaabbbbbbbbbaabbdedbbbbbbba.a.aaabbbbbbbcac',
  '..bbaabaaaaabbbbbbbaaaabaa..cccaabbccc....aaaaaaacac',
  '..b..baaaa..bbbbbba.bbbba...baccaabbbccc...aaaaaaaca',
  '....bbaa..bbbbbbbaaaabbaa....bacc.aabbbcc....aa..aac',
  '....baa...bbbbbbbaa...bba....bbacaaaaaabbcc.......ac',
  '....b....bbbbbbaaa...bba.......acc..aaabbbccc.......',
  '........bbbaaaaaa....baaa.......ac...aaaabbbc.......',
  '........baaaaaaa.....baa.........ac.....aabbbc......',
  '.......baaaaaa......baaa..........cc....aaaabcc.....',
  '......bbaaaa........ba............ac......aaaac.....',
  '......baaa.........................c.......aaaac....',
  '.....ba......................................a.cc...',
  '...............................................ac...',
  '................................................cc..',
  '....................................................',
  '....................................................',
  '....................................................',
  '....................................................',
  '....................................................',
  '....................................................',
  '....................................................',
  '........................ccc.........................',
  '......................cccbccc....ccccc..............',
  '......................cccbaac...ccbbbbc.............',
  '............bbb......bcccbaaa...cbbbbbcc............',
  '............bbbbbbb.bbbccb.a...ccbb.baacccc.........',
  '...........bbbbbbbbb.bbccbb...ccbbbbcccccccc........',
  '.........bbbbbbbbbbbbbbccb....ccbaababbbbbbcc.......',
  '........bb.bbbbbbbbbbbbcccb..bcbaabaabbbbbbbc.......',
  '........bbbbbbbbbbbbbbbbcc...bcb.bcb..bbbbbbbc......',
  '.......bbbbbbbbbbbbbbbbbbc..bbcabcbabbb.bbbbbc......',
  '......bbbbbbbbbbbbbbbbbbbc..bcabcbaa.ccab.aa.ac.....',
  '.....bbbbbbbbbbbbbbbbbbbb...b..bca..ccbcca...aac....',
  '.....babbbbbbbbbbbbbbbbbab.bbbbaabbbbbabbcc.a.ac....',
  '....baabbbbbbabbbbbbbbab.b.b.ba.bbcbcc.abbccc..ca...',
  '...babbbbbbbbbbaabbbbbb.b...b.bbcbbccacccabbcc.cc...',
  '.....bbbbbbaaaa.aababbbbb...bb.bbbbaabbbccabbbc.ca..',
  '....bbabaaaabbbabbaababbbb.bbbbaabbbbbbbbacccbc.ca..',
  '...bbabaabbbbbbbbbbbbbbded.ded..aaaaabbbbbbacaacca..',
  '..bbabab.bbbbbbbbbbbbbbede.edeba.aaaa.aabbbbccacac..',
  '.bbaabbbbaabbbbbbbbbbaabbdedbbbbbbaaa.aaabbbbc..cc..',
  '.baababaa.abbbbbbbbaaabba..bccaaabccc...aaabacc.cc..',
  'baabbaaaaa.bbbbbbb.bbbbba..bcacaaabbbc....aaaac..c..',
  '..baaaa..bb.bbbbbaaaabbaa...bccc.aabbcc...aaaaca.cc.',
  '.bbaaa..bbbbbbbb.aa..bbaa...bcac.aaaabbcc......c....',
  '.baa....bbbbbbaaa...bbaa.......ca...aaabcc.....ca...',
  '.b.....bbbab.aaaa..bbaaa.......cc...aaabbcc....cc...',
  '......bbbaaaaaa....bbaaa........ca.....aabcc....c...',
  '.....bbbaaaaa.....bbaa..........ca.....aaabc........',
  '....bbaaaa........baaa..........cc.......aacb.......',
  '....baaa...........a.............c.......aacc.......',
  '...baa...........................a.........aca......',
  '............................................cc......',
  '.............................................c......',
  '.............................................c......',
  '.............................................c......',
  '....................................................',
]

export const heroPalmCrownSheet = createSpriteSheet(
  parseSprite(heroCrownRaw, {
    a: Ink.FrondShadow,
    b: Ink.FrondBody,
    c: Ink.FrondRim,
    d: Ink.TrunkDark,
    e: Ink.TrunkMid,
  }),
  [
    { x: 0, y: 0, width: 52, height: 40, pivot: { x: 26, y: 20 } },
    { x: 0, y: 40, width: 52, height: 40, pivot: { x: 26, y: 20 } },
    { x: 0, y: 80, width: 52, height: 40, pivot: { x: 26, y: 20 } },
  ],
)

// 38x30 Secondary Palm Crown (3 poses)
const secCrownRaw = [
  '......................................',
  '......................................',
  '......................................',
  '..................cccb................',
  '..................ccccc...............',
  '.................bccbba...............',
  '........bbbb.....bccbb................',
  '........bbbbbbb.abccb........cccc.....',
  '........bbbbbbb.abccb.....cccccbbc....',
  '......bbbbbbbbbbaaccb....ccbbbb.bcc...',
  '.....bbbbbbbbbbbbabc....bbbbbbbbbac...',
  '.....bb.bbbbbbbbbabc...bcbaabbbba.cc..',
  '....bbbbbbbbbbbbbbbc..bcaa.a.aaaa.ac..',
  '....baabbbbabbbbbbb..baaaaaaa.aaa..ac.',
  '...babbbbbabbaabbbb.b.aaa.bccca.......',
  '...bbbaaaaaaaaaaabbb...bbbbcbccc......',
  '..ba.aaaaaaabaaa.a...bbcaabb.bbccc....',
  '.......bbbbbabbbbdeded.a.aaaabbbbcc...',
  '.......bbbbbbbbbbededebba.aaaaaabbcc..',
  '.......bbbbbbaaabba.cbcbbcc..aaaaabc..',
  '.......bbbbbaaaabaa.bcccabbcc...aaaca.',
  '......bbbbbba..bba...cacaaaaccc...aac.',
  '.....bbbbbaaaa.bba....cccaaabbcc....ca',
  '....bbabaaaa...baa......c..aaabbc...cc',
  '....bbaaaaa...bbaa......ca...aabcc...c',
  '...bbaaaa.....baa.......cc...aaaac....',
  '...baaa..................c.....aaac...',
  '..baa............................acc..',
  '...................................c..',
  '......................................',
  '......................................',
  '......................................',
  '......................................',
  '...................ccccc..............',
  '..................bccba.c.............',
  '..................bccbaa..............',
  '.........bbbb.....bcbba...............',
  '.........bbbbbb..accba.......cccccc...',
  '........bbbbbbbb.accc.....ccccbbbbc...',
  '......bbbbbbbbbb.accc....ccbbbbbbbbc..',
  '......bbbbbbbbbbbabcc...bbbbbbbb.aaac.',
  '......bbbbbbbbbbbabc...bcbbaabbbb..acc',
  '.....baabbbbbbbbbbbc..bbaaa.aaaaaa..ac',
  '....bbabbbbbbbbbbbb..baaaaaaaaaaa....a',
  '....babbababbaabbbb.b.aa.abcccc.......',
  '....bbaaaaaaaaaaabbb...bbbbbbbccc.....',
  '...ba.aaaaaaaaaa.a...bbcaabbabbbccc...',
  '.......bbbbbbbbbbdeded.a.aaaaabbbbcc..',
  '.......bbbbbbbbbbededebba.aaa.aaabbcc.',
  '.......bbbbbbbaabba.cbcbbccc.aaaaaabc.',
  '.......bbbbbaaaabba.bcccabbbcc..aaaaac',
  '......bbbbbba...baa..baccaaaacc....aac',
  '......bbbbaaaa..baa...cac.aabbbcc....a',
  '.....bbbaaaa...bba......cc..aabbcc....',
  '.....baaaaa....baa......ac...aaabcc...',
  '....baaaa......ba........cc...aaaacc..',
  '...bba....................c....aaaac..',
  '...ba............................aaac.',
  '....................................c.',
  '......................................',
  '......................................',
  '......................................',
  '......................................',
  '.................cccb.................',
  '.................cccc.................',
  '................acccbc................',
  '........bbb.....bcccbb................',
  '........bbbbbbb.bbccb.........cc......',
  '.......bbbbbbbbaabccb.....ccccccc.....',
  '.....bbbbbbbbbbbabccb....cbbbbbbc.....',
  '.....b..bbbbbbbbabbc...bbbbbbbbbcc....',
  '....bbbbbbbbbbbbbabc...bcb..bbbbac....',
  '....bbbbbbbbbbbbbbbc..bcaaaabaaaacc...',
  '...bbaabbbbbbbbbbbb..baaaaaaaa.a..c...',
  '..bbabbbbbbbbabbbbb.baaaa.cccaaa..ca..',
  '.bbbbbaaaaaaaaaaabbb...bbbbcccc.......',
  '.baaaaaaaaaaaaaa.a...bbcaabbbbccc.....',
  '.......aabbbabbbbdeded.aaaaaabbbcc....',
  '......bbbbbbbbbbbededebba.aaaaaabcc...',
  '......bbbbbbbaaabba.cccbbcc..aaaabc...',
  '.......bbbbbaaabbaa.cccaabbcc..aaaca..',
  '.....bbbbbba...bba..bcccaaaacc...aca..',
  '.....bbbbbaaa..baa...bcc.aaabcc....c..',
  '....bbbbaaaa..bbaa.....ca.aaabbc...ca.',
  '...bbaaaaaa...baa......cc...aaabc..ca.',
  '...baaaaa....bbaa.......ca...aaac...c.',
  '..baaa........a.........ca....aaac....',
  '.bbaa...................a.......ac....',
  '..a...............................c...',
  '..................................a...',
]

export const secPalmCrownSheet = createSpriteSheet(
  parseSprite(secCrownRaw, {
    a: Ink.FrondShadow,
    b: Ink.FrondBody,
    c: Ink.FrondRim,
    d: Ink.TrunkDark,
    e: Ink.TrunkMid,
  }),
  [
    { x: 0, y: 0, width: 38, height: 30, pivot: { x: 19, y: 16 } },
    { x: 0, y: 30, width: 38, height: 30, pivot: { x: 19, y: 16 } },
    { x: 0, y: 60, width: 38, height: 30, pivot: { x: 19, y: 16 } },
  ],
)

// 30x18 Vietnamese Coastal Fishing Sampan (2 poses)
const sampanRaw = [
  '..............................',
  '..............................',
  '...................c..........',
  '..................ccc.........',
  '............cccc...a..........',
  '...........cccccc..aa.........',
  '..........ccccccc.aaa.........',
  '.........ccccccc.aaaa.........',
  '...d.....caaaaac.aaaa.........',
  '..ada....caaaaac..aa...b......',
  '..a.a....caaaaac..aa...b......',
  '.aaaaaabbbbbbbbbbbaaaa..b.....',
  '.aaaaaaaaaaaaaaaaaaaaa...b....',
  '..aaaaaaaaaaaaaaaaaaa....b....',
  '...eeeeeeeeeeeeeeeee.....bb...',
  '.....eeee......eeee...........',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '...................c..........',
  '..................ccc.........',
  '............cccc...a..........',
  '...........cccccc..aa.........',
  '..........ccccccc.aaa.........',
  '.........ccccccc.aaaa.........',
  '..dd.....caaaaac.aaaa.........',
  '..dda....caaaaac..aa...b......',
  '..a.a....caaaaac..aa...b......',
  '.aaaaaabbbbbbbbbbbaaaa..b.....',
  '.aaaaaaaaaaaaaaaaaaaaa...b....',
  '..aaaaaaaaaaaaaaaaaaa....b....',
  '..eeeeeeeeeeeeeeeeee.....bb...',
  '....eeee......eeeee...........',
  '..............................',
  '..............................',
]

export const sampanSheet = createSpriteSheet(
  parseSprite(sampanRaw, {
    a: Ink.TrunkDark,
    b: Ink.TrunkMid,
    c: Ink.TrunkRim,
    d: Ink.SunCore,
    e: Ink.ShoreFoam,
  }),
  [
    { x: 0, y: 0, width: 30, height: 18, pivot: { x: 15, y: 14 } },
    { x: 0, y: 18, width: 30, height: 18, pivot: { x: 15, y: 14 } },
  ],
)

// 8x5 Seabird flap cycle (4 poses)
const seabirdRaw = [
  '..a...a.',
  '.a.a.a..',
  'a...a...',
  '........',
  '........',
  '........',
  '.a....a.',
  '..a..a..',
  '...aa...',
  '........',
  '...a.a..',
  '..a...a.',
  '.a.....a',
  '........',
  '........',
  '........',
  '..a..a..',
  '.a....a.',
  '........',
  '........',
]

export const seabirdSheet = createSpriteSheet(
  parseSprite(seabirdRaw, {
    a: Ink.TrunkDark,
  }),
  [
    { x: 0, y: 0, width: 8, height: 5, pivot: { x: 4, y: 2 } },
    { x: 0, y: 5, width: 8, height: 5, pivot: { x: 4, y: 2 } },
    { x: 0, y: 10, width: 8, height: 5, pivot: { x: 4, y: 2 } },
    { x: 0, y: 15, width: 8, height: 5, pivot: { x: 4, y: 2 } },
  ],
)
