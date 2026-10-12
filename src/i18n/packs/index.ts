import type { CopySettings } from '../../types'
import type { AppLocale } from '../locales'
import { ar } from './ar'
import { de } from './de'
import { es } from './es'
import { fr } from './fr'
import { he } from './he'
import { hi } from './hi'
import { id } from './id'
import { it } from './it'
import { ja } from './ja'
import { ko } from './ko'
import { nl } from './nl'
import { pl } from './pl'
import { pt } from './pt'
import { ru } from './ru'
import { sw } from './sw'
import { th } from './th'
import { tr } from './tr'
import { ur } from './ur'
import { vi } from './vi'
import { zhHans } from './zh-Hans'
import { zhHant } from './zh-Hant'

export const PACKS: Record<Exclude<AppLocale, 'en'>, CopySettings> = {
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  es,
  pt,
  fr,
  de,
  it,
  nl,
  pl,
  tr,
  ar,
  he,
  hi,
  ur,
  ja,
  ko,
  vi,
  th,
  id,
  ru,
  sw,
}
