import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './en/translation.json'
import es from './es/translation.json'

export const supportedLanguages = ['en', 'es'] as const
export type SupportedLanguage = (typeof supportedLanguages)[number]

export const defaultLanguage: SupportedLanguage = 'en'

// Namespaces ship empty for the scaffold — each surface registers its strings in later PRs,
// keeping EN/ES parity reviewable per PR.
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: defaultLanguage,
  fallbackLng: defaultLanguage,
  interpolation: { escapeValue: false },
})

export default i18n
