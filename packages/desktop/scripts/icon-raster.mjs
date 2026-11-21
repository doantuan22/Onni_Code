#!/usr/bin/env node
// Windows fallback for icon.mjs: rasterize the rect-only mark without librsvg.
import { deflateSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../', import.meta.url)
const svg = readFileSync(new URL('../../web/public/icon.svg', import.meta.url), 'utf8')
const inner = svg.replace(/^.*?<svg[^>]*>/s, '').replace(/<\/svg>\s*$/, '')
writeFileSync(new URL('../src-tauri/icons/source.svg', import.meta.url), `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">\n<rect width="1024" height="1024" fill="#ffffff"/>\n<g transform="scale(64)">${inner}</g>\n</svg>\n`)
const rects = [...svg.matchAll(/<rect\s+([^>]+)>/g)].map((match) => {
  const attrs = Object.fromEntries([...match[1].matchAll(/(x|y|width|height|fill)="([^"]+)"/g)].map((m) => [m[1], m[2]]))
  return { x: Number(attrs.x), y: Number(attrs.y), w: Number(attrs.width), h: Number(attrs.height), color: attrs.fill.slice(1) }
})

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const name = Buffer.from(type)
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, checksum])
}

function png(size) {
  const pixels = Buffer.alloc(size * size * 4, 255)
  for (const rect of rects) {
    const rgb = Buffer.from(rect.color, 'hex')
    const x0 = Math.round(rect.x * size / 16), y0 = Math.round(rect.y * size / 16)
    const x1 = Math.round((rect.x + rect.w) * size / 16), y1 = Math.round((rect.y + rect.h) * size / 16)
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) rgb.copy(pixels, (y * size + x) * 4)
  }
  const rows = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))])
}

const dir = new URL('../src-tauri/icons/', import.meta.url)
const outputs = new Map([
  ['icon.png', 1024], ['32x32.png', 32], ['64x64.png', 64], ['128x128.png', 128], ['128x128@2x.png', 256],
  ['Square30x30Logo.png', 30], ['Square44x44Logo.png', 44], ['Square71x71Logo.png', 71], ['Square89x89Logo.png', 89],
  ['Square107x107Logo.png', 107], ['Square142x142Logo.png', 142], ['Square150x150Logo.png', 150], ['Square284x284Logo.png', 284],
  ['Square310x310Logo.png', 310], ['StoreLogo.png', 50],
])
const rendered = new Map()
for (const [name, size] of outputs) { const data = png(size); rendered.set(size, data); writeFileSync(new URL(name, dir), data) }

// ICO supports PNG payloads and keeps the icon multi-size on Windows.
const sizes = [16, 32, 48, 64, 128, 256]
const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4)
const entries = []; let offset = 6 + sizes.length * 16
for (const size of sizes) { const data = rendered.get(size) ?? png(size); const e = Buffer.alloc(16); e[0] = size === 256 ? 0 : size; e[1] = e[0]; e[2] = 0; e[3] = 0; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12); entries.push(e); offset += data.length; rendered.set(size, data) }
writeFileSync(new URL('icon.ico', dir), Buffer.concat([header, ...entries, ...sizes.map((size) => rendered.get(size))]))
console.log(`icon-raster: wrote ${outputs.size} PNGs and icon.ico (left icon.icns unchanged)`)
