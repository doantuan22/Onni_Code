import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import kyoto from './kyoto'
import { contactSheet, goldenHashes, rawFrame, snapshotMetadata, snapshotSizes, snapshotThemes, snapshotTimes, staticFrame, thumbnailFrame } from '../../dev/snapshots'
import { encodePng } from '../../dev/png'

async function run() {
  const out = '.tmp/scene-snap'
  await mkdir(join(out, 'sheets'), { recursive: true })
  await mkdir(join(out, 'static'), { recursive: true })
  await mkdir(join(out, 'metadata'), { recursive: true })

  for (const theme of snapshotThemes) {
    const sheet = contactSheet(kyoto, theme)
    await writeFile(join(out, 'sheets', `world-kyoto-${theme}.png`), encodePng(sheet.width, sheet.height, sheet.rgba))

    const stat = staticFrame(kyoto, theme)
    await writeFile(join(out, 'static', `world-kyoto-${theme}.png`), encodePng(stat.width, stat.height, stat.rgba))

    await writeFile(join(out, 'metadata', `world-kyoto-${theme}.json`), JSON.stringify(snapshotMetadata(kyoto, theme), null, 2))

    for (const time of snapshotTimes) {
      for (const [width, height] of snapshotSizes) {
        await mkdir(join(out, 'raw', 'world-kyoto', theme, time), { recursive: true })
        const raw = rawFrame(kyoto, theme, time, width, height)
        await writeFile(join(out, 'raw', 'world-kyoto', theme, time, `${width}x${height}.png`), encodePng(raw.width, raw.height, raw.rgba))
      }
    }
  }
  console.log('world-kyoto', JSON.stringify(goldenHashes(kyoto)), join(out, 'sheets', 'world-kyoto-{light,dark}.png'))
}

run().catch(console.error)
