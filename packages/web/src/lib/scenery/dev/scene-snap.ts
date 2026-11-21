import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import { sceneRegistry } from '../engine/registry'
import { encodePng } from './png'
import { contactSheet, goldenHashes } from './snapshots'

const outputDir = '.tmp/scene-snap'
const usage = `Usage: node --import tsx packages/web/src/lib/scenery/dev/scene-snap.ts [--scene <id> | --fixture] [--out <dir>]

Renders every registered scene by default. Use --fixture for the P2 engine fixture.
Writes one PNG contact sheet per scene to ${outputDir} by default and prints the golden hashes.`

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      scene: { type: 'string' },
      fixture: { type: 'boolean' },
      out: { type: 'string', default: outputDir },
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
  if (ids.length === 0) throw new Error('No scenes registered. Pass --fixture to render the engine fixture')

  for (const id of ids) {
    const scene = fixture ?? await sceneRegistry.load(id)
    if (!scene) throw new Error(`Unknown scene: ${id}`)
    const { width, height, rgba } = contactSheet(scene)
    const path = join(values.out, `scene-${encodeURIComponent(id)}.png`)
    await mkdir(values.out, { recursive: true })
    await writeFile(path, encodePng(width, height, rgba))
    console.log(`${id} ${JSON.stringify(goldenHashes(scene))} ${path}`)
  }
}

main().catch((error: unknown) => {
  console.error(`scene-snap: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
