import { deflateSync } from 'node:zlib'

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function chunk(type: string, data: Buffer): Buffer {
  const bytes = Buffer.allocUnsafe(12 + data.length)
  bytes.writeUInt32BE(data.length)
  bytes.write(type, 4, 4, 'ascii')
  data.copy(bytes, 8)
  let crc = 0xffffffff
  for (const byte of bytes.subarray(4, 8 + data.length)) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
  }
  bytes.writeUInt32BE(~crc >>> 0, 8 + data.length)
  return bytes
}

export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || rgba.length !== width * height * 4) {
    throw new RangeError('PNG dimensions must match the RGBA buffer')
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bits per channel
  header[9] = 6 // RGBA

  const stride = width * 4
  const scanlines = Buffer.alloc((stride + 1) * height)
  for (let row = 0; row < height; row++) {
    // A zero filter byte before each row allows the pixels to be copied verbatim.
    scanlines.set(rgba.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1)
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
