// Run with node logo-gen.mjs. All geometry comes from the grids below.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const palette = {
  A: '#0B6BFF',
  N: '#0A1A2F',
  S: '#5CA8FF',
  W: '#FFFFFF',
  I: '#06101F',
}

// Blue body, a sky-blue bevel, and a left prompt with a block cursor.
const mark = [
  '................',
  '....AAAAASSS....',
  '...AAAAAAAASS...',
  '..AAA......ASS..',
  '.AAA........AAA.',
  '.AA..........AA.',
  '.AA....AA....AA.',
  '.AA...AA.....AA.',
  '.AA..AA......AA.',
  '.AA...AA.....AA.',
  '.AA....AA.AA.AA.',
  '.AAA........AAA.',
  '..AAA......AAA..',
  '...AAAAAAAAAA...',
  '....AAAAAAAA....',
  '................',
]

// The favicon uses two corner steps and solid blue at actual pixel size.
const mark16 = [
  '................',
  '...AAAAAAAAAA...',
  '..AAAAAAAAAAAA..',
  '.AAA........AAA.',
  '.AA..........AA.',
  '.AA..........AA.',
  '.AA....AA....AA.',
  '.AA...AA.....AA.',
  '.AA..AA......AA.',
  '.AA...AA.....AA.',
  '.AA....AA.AA.AA.',
  '.AA..........AA.',
  '.AAA........AAA.',
  '..AAAAAAAAAAAA..',
  '...AAAAAAAAAA...',
  '................',
]

// Hand-set pixel letters echo the mark's clipped corners.
const letters = {
  O: ['.####.', '##..##', '#....#', '#....#', '#....#', '##..##', '.####.'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['#', '.', '#', '#', '#', '#', '#'],
  C: ['.####.', '##..##', '#.....', '#.....', '#.....', '##..##', '.####.'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '####.', '#....', '.####'],
}

const captions = {
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.##', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  K: ['#.#', '##.', '#..', '##.', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '.#.'],
}

function typeset(text, glyphs, colorAt, gap = '.') {
  return glyphs[text[0]].map((_, y) =>
    Array.from(text, (letter, index) => glyphs[letter][y].replaceAll('#', colorAt(index))).join(gap),
  )
}

function rectangles(grid) {
  const width = grid[0].length
  const rects = []
  const rows = grid.map((row) => {
    if (row.length !== width || [...row].some((cell) => cell !== '.' && !palette[cell])) {
      throw new Error('Invalid grid row: ' + row)
    }
    return Array.from(row)
  })

  // Join equal cells into rectangles without changing their pixel coverage.
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < width; x++) {
      const color = rows[y][x]
      if (color === '.') continue
      let w = 1
      while (rows[y][x + w] === color) w++
      let h = 1
      while (rows[y + h]?.slice(x, x + w).every((cell) => cell === color)) h++
      rects.push({ x, y, w, h, color })
      for (let dy = 0; dy < h; dy++) rows[y + dy].fill('.', x, x + w)
    }
  }
  return rects
}

function save(name, content) {
  writeFileSync(new URL(name, import.meta.url), content)
  console.log('wrote ' + name)
}

function writeSvg(name, title, grid, extra = '', width = grid[0].length) {
  const lines = rectangles(grid).map(({ x, y, w, h, color }) =>
    '  <rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + palette[color] + '"/>',
  )
  save(name, [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + grid.length + '" shape-rendering="crispEdges" role="img">',
    '  <title>' + title + '</title>',
    ...lines,
    extra,
    '</svg>',
    '',
  ].filter((line, i, lines) => line !== '' || i === lines.length - 1).join('\n'))
}

const wordmark = typeset('OnniCode', letters, (i) => i < 4 ? 'A' : 'N')
const lockup = mark.map((row, y) =>
  row + '....' + (wordmark[y - 4] ?? '.'.repeat(wordmark[0].length)),
)
writeSvg('onni-mark.svg', 'OnniCode mark', mark)
writeSvg('onni-mark-mono.svg', 'OnniCode monochrome mark', mark.map((row) => row.replace(/[AS]/g, 'N')))
writeSvg('onni-lockup.svg', 'OnniCode', mark, [
  '  <g font-family="Chakra Petch, sans-serif" font-weight="600" font-size="12">',
  '    <text x="20" y="12" textLength="22" lengthAdjust="spacingAndGlyphs" fill="' + palette.A + '">Onni</text>',
  '    <text x="42" y="12" textLength="28" lengthAdjust="spacingAndGlyphs" fill="' + palette.N + '">Code</text>',
  '  </g>',
].join('\n'), 72)
writeSvg('onni-lockup-rects.svg', 'OnniCode pixel wordmark and mark', lockup)
writeSvg('onni-mark-16.svg', 'OnniCode 16 pixel mark', mark16)

const sheetWidth = 768
const sheetHeight = 576
const rgb = Buffer.alloc(sheetWidth * sheetHeight * 3)

function paint(x, y, w, h, color) {
  const pixel = Buffer.from(palette[color].slice(1), 'hex')
  for (let row = y; row < y + h; row++) {
    const start = (row * sheetWidth + x) * 3
    rgb.fill(pixel, start, start + w * 3)
  }
}

function stamp(grid, x, y, scale) {
  for (const rect of rectangles(grid)) {
    paint(x + rect.x * scale, y + rect.y * scale, rect.w * scale, rect.h * scale, rect.color)
  }
}

function caption(label, center, y, color) {
  const grid = typeset(label, captions, () => color)
  stamp(grid, center - grid[0].length, y, 2)
}

paint(0, 0, sheetWidth, sheetHeight, 'I')
for (const [x, surface, ink, label] of [[16, 'W', 'N', 'LIGHT'], [390, 'N', 'S', 'DARK']]) {
  paint(x, 16, 362, 418, surface)
  caption(label, x + 181, 32, ink)
  for (const [size, center] of [[16, 61], [32, 141], [64, 263]]) {
    stamp(size === 16 ? mark16 : mark, x + center - size / 2, 120 - size, size / 16)
    caption(String(size), x + center, 130, ink)
  }
  stamp(mark, x + 53, 152, 16)
  caption('256', x + 181, 414, ink)
}

paint(16, 446, 736, 114, 'W')
caption('LOCKUP', sheetWidth / 2, 458, 'N')
stamp(lockup, (sheetWidth - lockup[0].length * 4) / 2, 480, 4)

function pngCrc(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(name, payload) {
  const type = Buffer.from(name, 'ascii')
  const header = Buffer.alloc(4)
  header.writeUInt32BE(payload.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(pngCrc(Buffer.concat([type, payload])))
  return Buffer.concat([header, type, payload, crc])
}

const pngHeader = Buffer.alloc(13)
pngHeader.writeUInt32BE(sheetWidth, 0)
pngHeader.writeUInt32BE(sheetHeight, 4)
pngHeader[8] = 8
pngHeader[9] = 2 // RGB
const stride = sheetWidth * 3
const scanlines = Buffer.alloc((stride + 1) * sheetHeight)
for (let y = 0; y < sheetHeight; y++) {
  // The leading zero in each row selects the PNG None filter.
  rgb.copy(scanlines, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
}
save('logo-preview.png', Buffer.concat([
  Buffer.from('89504e470d0a1a0a', 'hex'),
  pngChunk('IHDR', pngHeader),
  pngChunk('IDAT', deflateSync(scanlines)),
  pngChunk('IEND', Buffer.alloc(0)),
]))
