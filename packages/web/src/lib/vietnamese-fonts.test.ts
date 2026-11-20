import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(here, '../styles/index.css'), 'utf8')

describe('locally served Vietnamese fonts', () => {
  it.each([
    ['Inter Variable', 'inter-vietnamese-wght-normal.woff2'],
    ['JetBrains Mono Variable', 'jetbrains-mono-vietnamese-wght-normal.woff2'],
  ])('%s covers NFC Vietnamese letters without falling back mid-word', (family, file) => {
    const face = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)]
      .find((match) => match[1]?.includes(file))?.[1]
    expect(face).toBeDefined()
    expect(face).toContain(`font-family: '${family}'`)
    expect(face).toContain('font-display: swap')
    const ranges = [...(face ?? '').matchAll(/U\+([0-9A-F]+)(?:-([0-9A-F]+))?/g)]
      .map((match) => [Number.parseInt(match[1]!, 16), Number.parseInt(match[2] ?? match[1]!, 16)] as const)
    for (const letter of 'ắằẵẳặấầẫẩậếềễểệốồỗổộớờỡởợứừữửựỳỵỷỹĐđ₫') {
      const point = letter.codePointAt(0)!
      expect(ranges.some(([start, end]) => point >= start && point <= end), letter).toBe(true)
    }
    const bytes = readFileSync(join(here, '../assets/fonts', file))
    expect(bytes.subarray(0, 4).toString()).toBe('wOF2')
    expect(bytes.length).toBeGreaterThan(1000)
  })
})
