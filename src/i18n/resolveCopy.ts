import type { CopySettings } from '../types'
import type { AppLocale } from './locales'
import { PACKS } from './packs'

/** English base (defaults + Super overrides) wins for `en`; other locales overlay packs. */
export function resolveCopy(locale: AppLocale, englishCopy: CopySettings): CopySettings {
  if (locale === 'en') return englishCopy
  const pack = PACKS[locale]
  return { ...englishCopy, ...pack }
}
