import { describe, expect, it } from 'vitest'
import en from './en/translation.json'
import es from './es/translation.json'

/**
 * String-coverage contract (spec §Verification): the EN and ES bundles must carry the
 * exact same key tree with non-empty values in both languages. Partial i18n coverage is
 * a user-facing failure — the acceptance gate treats it like a broken build.
 */

type Json = Record<string, unknown>

function flattenLeaves(node: Json, prefix = ''): Map<string, string> {
  const leaves = new Map<string, string>()
  for (const [key, value] of Object.entries(node)) {
    const path = prefix === '' ? key : `${prefix}.${key}`
    if (value !== null && typeof value === 'object') {
      for (const [nestedPath, nestedValue] of flattenLeaves(value as Json, path)) {
        leaves.set(nestedPath, nestedValue)
      }
    } else {
      leaves.set(path, String(value))
    }
  }
  return leaves
}

/** {{placeholders}} used by a translation string, as a sorted list. */
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]).sort()
}

describe('i18n string coverage (spec §Verification)', () => {
  const enLeaves = flattenLeaves(en as Json)
  const esLeaves = flattenLeaves(es as Json)

  it('has identical key trees in EN and ES', () => {
    expect([...esLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort())
  })

  it('has no empty strings in either language', () => {
    for (const [language, leaves] of [
      ['en', enLeaves],
      ['es', esLeaves],
    ] as const) {
      const empty = [...leaves.entries()].filter(([, value]) => value.trim() === '')
      expect(
        empty.map(([key]) => key),
        `empty ${language} keys`,
      ).toEqual([])
    }
  })

  it('uses the same interpolation placeholders in both languages', () => {
    for (const [key, enValue] of enLeaves) {
      expect(placeholders(esLeaves.get(key) ?? ''), `placeholder mismatch at ${key}`).toEqual(
        placeholders(enValue),
      )
    }
  })

  it('carries the official Level 1/2/3 wording in both languages', () => {
    // art_HT20xbhl §2.4: exact official wording, EN from the state evacuations page,
    // ES from the state's official Spanish evacuation graphics.
    expect(enLeaves.get('evacuation.levels.1.name')).toBe('BE READY')
    expect(enLeaves.get('evacuation.levels.2.name')).toBe('BE SET')
    expect(enLeaves.get('evacuation.levels.3.name')).toBe('GO NOW!')
    expect(esLeaves.get('evacuation.levels.1.name')).toBe('ESTÉ PREPARADO')
    expect(esLeaves.get('evacuation.levels.2.name')).toBe('ESTÉ LISTO')
    expect(esLeaves.get('evacuation.levels.3.name')).toBe('¡VÁYASE AHORA!')
  })
})
