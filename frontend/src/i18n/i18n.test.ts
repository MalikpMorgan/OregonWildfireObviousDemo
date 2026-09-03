import { describe, expect, it } from 'vitest'
import i18n, { defaultLanguage, supportedLanguages } from './index'

describe('i18n setup', () => {
  it('boots in the default language with matching fallback', () => {
    expect(defaultLanguage).toBe('en')
    expect(i18n.language).toBe('en')
    // i18next normalizes the string option into an array of fallbacks.
    expect(i18n.options.fallbackLng).toEqual(['en'])
  })

  it('ships populated en/es translation namespaces with full map-surface parity', () => {
    const bundles = Object.fromEntries(
      supportedLanguages.map((language) => [
        language,
        i18n.getResourceBundle(language, 'translation'),
      ]),
    )
    const enMap = (bundles.en?.map ?? {}) as Record<string, unknown>
    for (const language of supportedLanguages) {
      const bundle = bundles[language] ?? {}
      // Every surface registers its strings here — namespaces start non-empty
      // from the map surface onward and never regress to empty.
      expect(Object.keys(bundle).length).toBeGreaterThan(0)
      expect(Object.keys(bundle)).toContain('map')
      // The map surface's key set must match across languages: a string present
      // in English but missing in Spanish (or vice versa) is a parity bug.
      const mapBundle = (bundle.map ?? {}) as Record<string, unknown>
      expect(Object.keys(mapBundle).length).toBeGreaterThan(0)
      expect(Object.keys(mapBundle).sort()).toEqual(Object.keys(enMap).sort())
    }
  })
})
