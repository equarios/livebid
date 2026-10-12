export const APP_LOCALES = [
  'en',
  'zh-Hans',
  'zh-Hant',
  'es',
  'pt',
  'fr',
  'de',
  'it',
  'nl',
  'pl',
  'tr',
  'ar',
  'he',
  'hi',
  'ur',
  'ja',
  'ko',
  'vi',
  'th',
  'id',
  'ru',
  'sw',
] as const

export type AppLocale = (typeof APP_LOCALES)[number]

export type LocaleMeta = {
  id: AppLocale
  /** Native language name for the switcher. */
  label: string
  dir: 'ltr' | 'rtl'
}

export const LOCALE_META: Record<AppLocale, LocaleMeta> = {
  en: { id: 'en', label: 'English', dir: 'ltr' },
  'zh-Hans': { id: 'zh-Hans', label: '简体中文', dir: 'ltr' },
  'zh-Hant': { id: 'zh-Hant', label: '繁體中文', dir: 'ltr' },
  es: { id: 'es', label: 'Español', dir: 'ltr' },
  pt: { id: 'pt', label: 'Português', dir: 'ltr' },
  fr: { id: 'fr', label: 'Français', dir: 'ltr' },
  de: { id: 'de', label: 'Deutsch', dir: 'ltr' },
  it: { id: 'it', label: 'Italiano', dir: 'ltr' },
  nl: { id: 'nl', label: 'Nederlands', dir: 'ltr' },
  pl: { id: 'pl', label: 'Polski', dir: 'ltr' },
  tr: { id: 'tr', label: 'Türkçe', dir: 'ltr' },
  ar: { id: 'ar', label: 'العربية', dir: 'rtl' },
  he: { id: 'he', label: 'עברית', dir: 'rtl' },
  hi: { id: 'hi', label: 'हिन्दी', dir: 'ltr' },
  ur: { id: 'ur', label: 'اردو', dir: 'rtl' },
  ja: { id: 'ja', label: '日本語', dir: 'ltr' },
  ko: { id: 'ko', label: '한국어', dir: 'ltr' },
  vi: { id: 'vi', label: 'Tiếng Việt', dir: 'ltr' },
  th: { id: 'th', label: 'ไทย', dir: 'ltr' },
  id: { id: 'id', label: 'Bahasa Indonesia', dir: 'ltr' },
  ru: { id: 'ru', label: 'Русский', dir: 'ltr' },
  sw: { id: 'sw', label: 'Kiswahili', dir: 'ltr' },
}

export const LOCALE_STORAGE_KEY = 'livebid-locale'

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return Boolean(value && (APP_LOCALES as readonly string[]).includes(value))
}

/** Map browser / BCP-47 tags onto our pack ids. */
export function detectBrowserLocale(tag = typeof navigator !== 'undefined' ? navigator.language : 'en'): AppLocale {
  const raw = (tag || 'en').trim().toLowerCase()
  if (raw.startsWith('zh')) {
    if (raw.includes('tw') || raw.includes('hk') || raw.includes('mo') || raw.includes('hant')) return 'zh-Hant'
    return 'zh-Hans'
  }
  if (raw.startsWith('es')) return 'es'
  if (raw.startsWith('pt')) return 'pt'
  if (raw.startsWith('fr')) return 'fr'
  if (raw.startsWith('de')) return 'de'
  if (raw.startsWith('it')) return 'it'
  if (raw.startsWith('nl')) return 'nl'
  if (raw.startsWith('pl')) return 'pl'
  if (raw.startsWith('tr')) return 'tr'
  if (raw.startsWith('ar')) return 'ar'
  if (raw.startsWith('he') || raw.startsWith('iw')) return 'he'
  if (raw.startsWith('hi')) return 'hi'
  if (raw.startsWith('ur')) return 'ur'
  if (raw.startsWith('ja')) return 'ja'
  if (raw.startsWith('ko')) return 'ko'
  if (raw.startsWith('vi')) return 'vi'
  if (raw.startsWith('th')) return 'th'
  if (raw.startsWith('id') || raw.startsWith('in')) return 'id'
  if (raw.startsWith('ru')) return 'ru'
  if (raw.startsWith('sw')) return 'sw'
  if (raw.startsWith('en')) return 'en'
  return 'en'
}

export function readStoredLocale(): AppLocale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isAppLocale(raw)) return raw
  } catch {
    /* ignore */
  }
  return detectBrowserLocale()
}

export function writeStoredLocale(locale: AppLocale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
}

export function applyDocumentLocale(locale: AppLocale) {
  if (typeof document === 'undefined') return
  const meta = LOCALE_META[locale]
  document.documentElement.lang =
    locale === 'zh-Hans' ? 'zh-CN' : locale === 'zh-Hant' ? 'zh-TW' : locale
  document.documentElement.dir = meta.dir
}
