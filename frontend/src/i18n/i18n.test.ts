import { describe, expect, it } from 'vitest'
import i18n, { defaultLanguage, supportedLanguages } from './index'

describe('i18n setup', () => {
  it('boots in the default language with matching fallback', () => {
    expect(defaultLanguage).toBe('en')
    expect(i18n.language).toBe('en')
    // i18next normalizes the string option into an array of fallbacks.
    expect(i18n.options.fallbackLng).toEqual(['en'])
  })

  it('ships empty en/es translation namespaces', () => {
    for (const language of supportedLanguages) {
      expect(i18n.getResourceBundle(language, 'translation')).toEqual({})
    }
  })
})
