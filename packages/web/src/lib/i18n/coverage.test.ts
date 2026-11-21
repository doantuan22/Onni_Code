import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { viMessages } from './vi-messages'

const here = dirname(fileURLToPath(import.meta.url))

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '__tests__' || entry.name === '__fixtures__') return []
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) ? [path] : []
  })
}

function translationKeys(source: string): string[] {
  // Survey Part C §3: ignore comments and other strings when tracking untranslated source keys.
  const calls = /\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|(?<![\w$.])t\s*\(\s*(?<literal>"(?:\\[\s\S]|[^"\\\r\n])*"|'(?:\\[\s\S]|[^'\\\r\n])*')\s*(?=[,)])|"(?:\\[\s\S]|[^"\\\r\n])*"|'(?:\\[\s\S]|[^'\\\r\n])*'|`(?:\\[\s\S]|[^`\\])*`/g
  return [...source.matchAll(calls)].flatMap((match) => {
    const literal = match.groups?.literal
    if (!literal) return []
    const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' }
    return [literal.slice(1, -1).replace(/\\(u\{[\da-f]+\}|u[\da-f]{4}|x[\da-f]{2}|\r?\n|[\s\S])/gi, (_, escape: string) => {
      if (/^[ux]/i.test(escape) && escape.length > 1) {
        return String.fromCodePoint(parseInt(escape.slice(1).replace(/[{}]/g, ''), 16))
      }
      return /\r?\n/.test(escape) ? '' : (escapes[escape] ?? escape)
    })]
  })
}

const usedKeys = new Set(sourceFiles(resolve(here, '../..')).flatMap((path) =>
  translationKeys(readFileSync(path, 'utf8')),
))
const allowlist = JSON.parse(readFileSync(join(here, 'untranslated-keys.json'), 'utf8')) as string[]
const missingKeys = [...usedKeys].filter((key) => !Object.hasOwn(viMessages, key)).sort()

describe('Vietnamese source-key coverage', () => {
  it('collects literal translation calls without counting comments or other methods', () => {
    expect(translationKeys(String.raw`
      // t('Comment')
      /* t('Another comment') */
      const example = "t('Example text')"
      t('It\'s ready')
      t("Line\n{count}", { count: 2 })
      t('Unicode\u2019s')
      t(dynamicKey)
      t('Prefix' + suffix)
      object.t('Method')
      split('Unrelated')
      const view = <span>{t('JSX label')}</span>
    `)).toEqual(["It's ready", 'Line\n{count}', 'Unicode’s', 'JSX label'])
  })

  it('translates every used source key except the checked-in baseline', () => {
    expect(usedKeys.size).toBeGreaterThan(0)
    expect(missingKeys.filter((key) => !allowlist.includes(key)), 'New untranslated keys: add Vietnamese entries').toEqual([])
  })

  it('keeps the baseline unique and removes translated or unused keys', () => {
    expect(allowlist).toEqual([...new Set(allowlist)].sort())
    expect(allowlist.filter((key) => !missingKeys.includes(key)), 'Stale allowlist keys: remove these entries').toEqual([])
  })
})
