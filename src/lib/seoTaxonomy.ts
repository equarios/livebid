import type { Lot } from '../types'

/** Device family for SEO / filters. */
export const DEVICE_CLASSES = [
  'phones',
  'tablets',
  'pcs',
  'laptops',
  'chromebooks',
  'consoles',
  'other',
] as const

export type DeviceClass = (typeof DEVICE_CLASSES)[number]

/** Commercial condition (separate from cosmetic grade S/A/B/C). */
export const CONDITIONS = [
  'new',
  'used',
  'refurbished',
  'recycled',
  'scrap',
  'locked',
  'unlocked',
] as const

export type LotCondition = (typeof CONDITIONS)[number]

export const OS_FAMILIES = ['ios', 'android', 'other-os'] as const
export type OsFamily = (typeof OS_FAMILIES)[number]

/** Brands we publish dedicated SEO paths for. */
export const SEO_BRANDS = [
  'apple',
  'samsung',
  'google',
  'xiaomi',
  'huawei',
  'oppo',
  'vivo',
  'oneplus',
  'sony',
  'microsoft',
  'nintendo',
  'asus',
  'lenovo',
  'dell',
  'hp',
  'acer',
] as const

export type SeoBrand = (typeof SEO_BRANDS)[number]

export type SeoFacet = {
  deviceClass?: DeviceClass
  condition?: LotCondition
  brand?: SeoBrand
  os?: OsFamily
}

const DEVICE_LABELS: Record<DeviceClass, string> = {
  phones: 'Mobile phones',
  tablets: 'Tablets & iPads',
  pcs: 'PCs & desktops',
  laptops: 'Laptops',
  chromebooks: 'Chromebooks',
  consoles: 'Gaming consoles',
  other: 'Other devices',
}

const CONDITION_LABELS: Record<LotCondition, string> = {
  new: 'New',
  used: 'Used',
  refurbished: 'Refurbished',
  recycled: 'Recycled',
  scrap: 'Scrap',
  locked: 'Locked',
  unlocked: 'Unlocked',
}

const OS_LABELS: Record<OsFamily, string> = {
  ios: 'Apple iOS',
  android: 'Android',
  'other-os': 'Other OS',
}

const BRAND_LABELS: Record<SeoBrand, string> = {
  apple: 'Apple',
  samsung: 'Samsung',
  google: 'Google',
  xiaomi: 'Xiaomi',
  huawei: 'Huawei',
  oppo: 'OPPO',
  vivo: 'vivo',
  oneplus: 'OnePlus',
  sony: 'Sony',
  microsoft: 'Microsoft',
  nintendo: 'Nintendo',
  asus: 'ASUS',
  lenovo: 'Lenovo',
  dell: 'Dell',
  hp: 'HP',
  acer: 'Acer',
}

export function deviceClassLabel(id: DeviceClass) {
  return DEVICE_LABELS[id]
}

export function conditionLabel(id: LotCondition) {
  return CONDITION_LABELS[id]
}

export function osLabel(id: OsFamily) {
  return OS_LABELS[id]
}

export function brandLabel(id: SeoBrand) {
  return BRAND_LABELS[id]
}

export function isDeviceClass(v: string | undefined): v is DeviceClass {
  return Boolean(v && (DEVICE_CLASSES as readonly string[]).includes(v))
}

export function isCondition(v: string | undefined): v is LotCondition {
  return Boolean(v && (CONDITIONS as readonly string[]).includes(v))
}

export function isSeoBrand(v: string | undefined): v is SeoBrand {
  return Boolean(v && (SEO_BRANDS as readonly string[]).includes(v))
}

export function isOsFamily(v: string | undefined): v is OsFamily {
  return Boolean(v && (OS_FAMILIES as readonly string[]).includes(v))
}

export function slugBrand(manufacturer: string): SeoBrand | undefined {
  const raw = manufacturer.trim().toLowerCase().replace(/\s+/g, '')
  if (raw.includes('apple')) return 'apple'
  if (raw.includes('samsung')) return 'samsung'
  if (raw.includes('google') || raw.includes('pixel')) return 'google'
  if (raw.includes('xiaomi') || raw.includes('redmi') || raw.includes('poco')) return 'xiaomi'
  if (raw.includes('huawei') || raw.includes('honor')) return 'huawei'
  if (raw.includes('oppo')) return 'oppo'
  if (raw.includes('vivo')) return 'vivo'
  if (raw.includes('oneplus')) return 'oneplus'
  if (raw.includes('sony') || raw.includes('playstation') || raw === 'ps') return 'sony'
  if (raw.includes('microsoft') || raw.includes('xbox') || raw.includes('surface')) return 'microsoft'
  if (raw.includes('nintendo')) return 'nintendo'
  if (raw.includes('asus') || raw.includes('rog')) return 'asus'
  if (raw.includes('lenovo') || raw.includes('thinkpad')) return 'lenovo'
  if (raw.includes('dell')) return 'dell'
  if (raw === 'hp' || raw.includes('hewlett')) return 'hp'
  if (raw.includes('acer')) return 'acer'
  return undefined
}

/** Infer device class from maker + model text when not set on the lot. */
export function inferDeviceClass(lot: Pick<Lot, 'manufacturer' | 'model' | 'description' | 'deviceClass'>): DeviceClass {
  if (lot.deviceClass && isDeviceClass(lot.deviceClass)) return lot.deviceClass
  const hay = `${lot.manufacturer} ${lot.model} ${lot.description || ''}`.toLowerCase()
  if (/\b(playstation|xbox|nintendo|switch|psp|ps[345]|steam\s*deck|console)\b/.test(hay)) return 'consoles'
  if (/\bchromebook\b/.test(hay)) return 'chromebooks'
  if (/\b(macbook|laptop|notebook|thinkpad|zenbook|vivobook)\b/.test(hay)) return 'laptops'
  if (/\b(imac|mac\s*mini|desktop|pc\b|tower)\b/.test(hay)) return 'pcs'
  if (/\b(ipad|tablet|galaxy\s*tab|surface\s*go|tab\s*[as])\b/.test(hay)) return 'tablets'
  if (/\b(watch|airpods|buds|earphone|headphone)\b/.test(hay)) return 'other'
  if (/\b(iphone|galaxy\s*s|pixel|redmi|phone|smartphone)\b/.test(hay)) return 'phones'
  const brand = slugBrand(lot.manufacturer)
  if (brand === 'nintendo' || brand === 'sony' || brand === 'microsoft') {
    if (/\b(xbox|playstation|switch|psp|ps[345])\b/.test(hay)) return 'consoles'
  }
  if (brand === 'apple' && /ipad/.test(hay)) return 'tablets'
  if (brand === 'apple' || brand === 'samsung' || brand === 'google' || brand === 'xiaomi') return 'phones'
  return 'other'
}

export function inferOsFamily(lot: Pick<Lot, 'manufacturer' | 'model' | 'osFamily'>): OsFamily {
  if (lot.osFamily && isOsFamily(lot.osFamily)) return lot.osFamily
  const brand = slugBrand(lot.manufacturer)
  const hay = `${lot.manufacturer} ${lot.model}`.toLowerCase()
  if (brand === 'apple' || /\b(iphone|ipad|ios|macos)\b/.test(hay)) return 'ios'
  if (/\b(android|galaxy|pixel|xiaomi|redmi|oppo|vivo|oneplus|huawei)\b/.test(hay)) return 'android'
  if (brand && ['samsung', 'google', 'xiaomi', 'huawei', 'oppo', 'vivo', 'oneplus'].includes(brand)) {
    return 'android'
  }
  return 'other-os'
}

export function inferCondition(
  lot: Pick<Lot, 'condition' | 'grade' | 'description' | 'simLocked' | 'activationLocked'>,
  want?: LotCondition,
): LotCondition {
  if (lot.condition && isCondition(lot.condition)) return lot.condition
  const hay = `${lot.grade || ''} ${lot.description || ''}`.toLowerCase()
  if (/\bscrap\b/.test(hay)) return 'scrap'
  if (/\brecycl/.test(hay)) return 'recycled'
  if (/\brefurb|renewed|certified\s*pre/.test(hay)) return 'refurbished'
  if (/\b(brand\s*new|sealed|bnib|new\s*open)\b/.test(hay) || lot.grade === 'S') return 'new'
  if (want === 'locked' || want === 'unlocked') {
    const locked = Boolean(lot.simLocked || lot.activationLocked)
    return locked ? 'locked' : 'unlocked'
  }
  return 'used'
}

export function lotMatchesFacet(lot: Lot, facet: SeoFacet): boolean {
  if (facet.deviceClass && inferDeviceClass(lot) !== facet.deviceClass) return false
  if (facet.brand) {
    const b = slugBrand(lot.manufacturer)
    if (b !== facet.brand) return false
  }
  if (facet.os && inferOsFamily(lot) !== facet.os) return false
  if (facet.condition) {
    if (facet.condition === 'locked') return Boolean(lot.simLocked || lot.activationLocked)
    if (facet.condition === 'unlocked') return !lot.simLocked && !lot.activationLocked
    return inferCondition(lot) === facet.condition
  }
  return true
}

export function categoryPath(facet: SeoFacet): string {
  const parts = ['/wholesale/c']
  if (facet.deviceClass) parts.push(facet.deviceClass)
  if (facet.condition) parts.push(facet.condition)
  if (facet.brand) parts.push(facet.brand)
  else if (facet.os) parts.push(facet.os)
  return parts.join('/')
}

export function parseCategoryParams(parts: string[]): SeoFacet | null {
  const [a, b, c] = parts.map((p) => p?.toLowerCase()).filter(Boolean)
  if (!a) return {}
  if (!isDeviceClass(a)) return null
  const facet: SeoFacet = { deviceClass: a }
  if (!b) return facet
  if (isCondition(b)) {
    facet.condition = b
    if (c) {
      if (isSeoBrand(c)) facet.brand = c
      else if (isOsFamily(c)) facet.os = c
      else return null
    }
    return facet
  }
  if (isSeoBrand(b)) {
    facet.brand = b
    return facet
  }
  if (isOsFamily(b)) {
    facet.os = b
    return facet
  }
  return null
}

export function facetTitle(facet: SeoFacet): string {
  const bits: string[] = []
  if (facet.condition) bits.push(conditionLabel(facet.condition))
  if (facet.brand) bits.push(brandLabel(facet.brand))
  else if (facet.os) bits.push(osLabel(facet.os))
  if (facet.deviceClass) bits.push(deviceClassLabel(facet.deviceClass))
  if (!bits.length) return 'Wholesale devices worldwide'
  return bits.join(' ')
}

export function facetDescription(facet: SeoFacet, brandName = 'Equarios'): string {
  const topic = facetTitle(facet)
  return `${brandName} B2B wholesale: buy and sell ${topic.toLowerCase()} — new, used, locked, unlocked, refurbished, recycled, and scrap lots. Global auctions and marketplace for phones, tablets, PCs, laptops, Chromebooks, and gaming consoles.`
}

/**
 * Crawlable category paths for sitemap.
 * Depth: device → condition|brand|os → condition+brand|condition+os
 */
export function allSeoPaths(): string[] {
  const paths = new Set<string>(['/wholesale/c'])
  for (const dc of DEVICE_CLASSES) {
    paths.add(categoryPath({ deviceClass: dc }))
    for (const cond of CONDITIONS) {
      paths.add(categoryPath({ deviceClass: dc, condition: cond }))
      for (const brand of SEO_BRANDS) {
        paths.add(categoryPath({ deviceClass: dc, condition: cond, brand }))
      }
      for (const os of OS_FAMILIES) {
        paths.add(categoryPath({ deviceClass: dc, condition: cond, os }))
      }
    }
    for (const brand of SEO_BRANDS) {
      paths.add(categoryPath({ deviceClass: dc, brand }))
    }
    for (const os of OS_FAMILIES) {
      paths.add(categoryPath({ deviceClass: dc, os }))
    }
  }
  return [...paths].sort()
}

/** Subset prerendered into static HTML at build (fast crawl of top funnels). */
export function prerenderSeoPaths(): string[] {
  const paths = new Set<string>(['/wholesale/c', '/buyers', '/sellers', '/support', '/wholesale'])
  for (const dc of DEVICE_CLASSES) {
    paths.add(categoryPath({ deviceClass: dc }))
    for (const cond of CONDITIONS) {
      paths.add(categoryPath({ deviceClass: dc, condition: cond }))
    }
    for (const brand of ['apple', 'samsung', 'google', 'sony', 'microsoft', 'nintendo'] as SeoBrand[]) {
      paths.add(categoryPath({ deviceClass: dc, brand }))
    }
  }
  return [...paths].sort()
}

/** Hub cards for the index page — keep list scannable. */
export function hubDeviceLinks() {
  return DEVICE_CLASSES.map((id) => ({
    id,
    label: deviceClassLabel(id),
    to: categoryPath({ deviceClass: id }),
  }))
}

/** Short chip labels for the wholesale hub filter-style bar. */
const DEVICE_CHIP_LABELS: Record<DeviceClass, string> = {
  phones: 'Phones',
  tablets: 'Tablets',
  pcs: 'PCs',
  laptops: 'Laptops',
  chromebooks: 'Chromebooks',
  consoles: 'Consoles',
  other: 'Other',
}

export function hubDeviceChipLinks() {
  return DEVICE_CLASSES.map((id) => ({
    id,
    label: DEVICE_CHIP_LABELS[id],
    to: categoryPath({ deviceClass: id }),
  }))
}

export function hubConditionLinks(deviceClass?: DeviceClass) {
  return CONDITIONS.map((id) => ({
    id,
    label: conditionLabel(id),
    to: categoryPath({ deviceClass: deviceClass || 'phones', condition: id }),
  }))
}
