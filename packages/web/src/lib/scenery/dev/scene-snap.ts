import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'

import { sceneRegistry } from '../engine/registry'
import { encodePng } from './png'
import { contactSheet, goldenHashes, rawFrame, snapshotMetadata, snapshotSizes, snapshotThemes, snapshotTimes, staticFrame, thumbnailFrame } from './snapshots'

const outputDir = '.tmp/scene-snap'
const thumbnailDir = 'packages/web/public/scenery-thumbs'
const usage = `Usage: node --import tsx packages/web/src/lib/scenery/dev/scene-snap.ts [--scene <id> | --fixture] [--out <dir>] [--thumbnails [--thumb-out <dir>]]

Renders every registered scene by default. Use --fixture for the P2 engine fixture.
Writes raw frames, themed contact sheets, static frames, and metadata to ${outputDir} by default.
--thumbnails additionally writes static 320×180 <id>-<theme>.png files to ${thumbnailDir}.`

async function writePng(path: string, frame: { width: number; height: number; rgba: Uint8Array }): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, encodePng(frame.width, frame.height, frame.rgba))
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      scene: { type: 'string' },
      fixture: { type: 'boolean' },
      out: { type: 'string', default: outputDir },
      thumbnails: { type: 'boolean' },
      'thumb-out': { type: 'string', default: thumbnailDir },
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (values.help) {
    console.log(usage)
    return
  }
  if (values.fixture && values.scene !== undefined) throw new Error('Choose either --fixture or --scene')

  const fixture = values.fixture ? (await import('../engine/fixture-scene')).default : undefined
  const ids = fixture ? [fixture.id] : values.scene === undefined ? [...sceneRegistry.ids].sort() : [values.scene]
  const out = values.out ?? outputDir
  const thumbs = values['thumb-out'] ?? thumbnailDir
  if (ids.length === 0) throw new Error('No scenes registered. Pass --fixture to render the engine fixture')

  for (const id of ids) {
    const scene = fixture ?? await sceneRegistry.load(id)
    if (!scene) throw new Error(`Unknown scene: ${id}`)
    const name = encodeURIComponent(id)
    for (const theme of snapshotThemes) {
      const sheetPath = join(out, 'sheets', `${name}-${theme}.png`)
      await writePng(sheetPath, contactSheet(scene, theme))
      const staticPath = join(out, 'static', `${name}-${theme}.png`)
      await writePng(staticPath, staticFrame(scene, theme))
      await mkdir(join(out, 'metadata'), { recursive: true })
      await writeFile(join(out, 'metadata', `${name}-${theme}.json`), `${JSON.stringify(snapshotMetadata(scene, theme), null, 2)}\n`)
      for (const time of snapshotTimes) {
        for (const [width, height] of snapshotSizes) {
          await writePng(join(out, 'raw', name, theme, time, `${width}x${height}.png`), rawFrame(scene, theme, time, width, height))
        }
      }
      if (values.thumbnails) {
        await writePng(join(thumbs, `${name}-${theme}.png`), thumbnailFrame(scene, theme))
      }
    }
    console.log(`${id} ${JSON.stringify(goldenHashes(scene))} ${join(out, 'sheets', `${name}-{light,dark}.png`)}`)
  }
}

main().catch((error: unknown) => {
  console.error(`scene-snap: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
