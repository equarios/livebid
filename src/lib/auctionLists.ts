import type { AuctionFillMode, AuctionTypeDef, Lot, SiteSettings } from '../types'

export type AuctionListKind = string

export const ORIGINS = ['JP', 'KR', 'EU', 'US', 'HK', 'AE', 'TW', 'INT'] as const

export const RESERVED_LIST_SLUGS = new Set([
  'all',
  'ongoing',
  'auction',
  'auctions',
  'marketplace',
  'admin',
  'super',
  'login',
  'register',
  'account',
  'info',
  'tutorial',
  'top',
  'buyers',
  'sellers',
  'support',
])

export function slugAuctionType(raw: string) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function normalizeFillMode(value?: string, slug?: string): AuctionFillMode {
  if (value === 'sealed' || value === 'hybrid' || value === 'live') return value
  if (slug === 'sealed' || slug === 'hybrid') return slug
  return 'live'
}

export function normalizeAuctionTypes(rows?: AuctionTypeDef[] | { value: string; label: string; fillMode?: string; intro?: string }[]) {
  const seen = new Set<string>()
  const out: AuctionTypeDef[] = []
  for (const t of rows || []) {
    const value = slugAuctionType(t.value)
    if (!value || RESERVED_LIST_SLUGS.has(value) || seen.has(value)) continue
    seen.add(value)
    out.push({
      value,
      label: (t.label || value).trim(),
      fillMode: normalizeFillMode(t.fillMode, value),
      intro: t.intro?.trim() || undefined,
    })
  }
  return out
}

export function isAuctionListKind(value: string | undefined, settings?: SiteSettings): value is AuctionListKind {
  if (!value) return false
  if (value === 'all' || value === 'ongoing') return true
  return Boolean(settings?.auctionTypes.some((t) => t.value === value))
}

export function listPath(kind: AuctionListKind) {
  return kind === 'all' ? '/auctions' : `/auctions/${kind}`
}

export function listLabel(kind: AuctionListKind, settings?: SiteSettings) {
  if (kind === 'all') return 'All auctions'
  if (kind === 'ongoing') return 'Ongoing'
  return settings?.auctionTypes.find((t) => t.value === kind)?.label || kind
}

export function listIntro(kind: AuctionListKind, settings?: SiteSettings) {
  const def = settings?.auctionTypes.find((t) => t.value === kind)
  if (def?.intro) return def.intro
  const mode = def?.fillMode || normalizeFillMode(undefined, kind)
  if (kind === 'ongoing') {
    return 'Only lots that are still open, across types. Closed lots stay on their type list.'
  }
  if (kind === 'all') {
    return 'Full auction catalog. Open a type list for one inventory when volumes are large.'
  }
  if (mode === 'sealed') {
    return `${def?.label || kind} list: other fills stay hidden until close. Separate catalog from other types.`
  }
  if (mode === 'hybrid') {
    return `${def?.label || kind} list: live fill now, then a sealed stage. Its own inventory.`
  }
  return `${def?.label || kind} list: last bid per account fills this inventory. You only see your own fill.`
}

export function typeDef(settings: SiteSettings | undefined, value?: string) {
  return settings?.auctionTypes.find((t) => t.value === (value || 'live'))
}

export function lotFillMode(lot: Pick<Lot, 'auctionType' | 'channel'>, settings?: SiteSettings): AuctionFillMode {
  if (lot.channel === 'marketplace') return 'live'
  const def = typeDef(settings, lot.auctionType)
  if (def) return def.fillMode
  return normalizeFillMode(undefined, lot.auctionType)
}

export function isSealedLot(lot: Pick<Lot, 'auctionType' | 'channel'>, settings?: SiteSettings) {
  return lotFillMode(lot, settings) === 'sealed'
}

export function typePillClass(lot: Pick<Lot, 'auctionType' | 'channel'>, settings?: SiteSettings) {
  if (lot.channel === 'marketplace') return 'market'
  return lotFillMode(lot, settings)
}

export function inAuctionList(lot: Lot, kind: AuctionListKind, now = Date.now()) {
  if (lot.channel !== 'auction') return false
  if (kind === 'all') return true
  if (kind === 'ongoing') return lot.endsAt > now
  return (lot.auctionType || 'live') === kind
}

export function originOptions(lots: Lot[]) {
  return [...new Set(lots.map((l) => l.origin || 'INT'))].sort()
}

export function localTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function typeRank(lot: Lot, order: string[]) {
  const slug = lot.auctionType || 'live'
  const i = order.indexOf(slug)
  return i < 0 ? order.length : i
}

export function sortLots(lots: Lot[], sort: string, typeOrder?: string[]) {
  const copy = [...lots]
  copy.sort((a, b) => {
    if (typeOrder?.length) {
      const byType = typeRank(a, typeOrder) - typeRank(b, typeOrder)
      if (byType) return byType
    }
    if (sort === 'price') return a.currentPrice - b.currentPrice
    if (sort === 'qty') return b.qty - a.qty
    if (sort === 'maker') {
      const n = a.manufacturer.localeCompare(b.manufacturer)
      return n || a.model.localeCompare(b.model)
    }
    if (sort === 'close-late') return b.endsAt - a.endsAt
    return a.endsAt - b.endsAt
  })
  return copy
}

export function groupLotsByType(lots: Lot[], settings?: SiteSettings, sort = 'close-soon') {
  const order = settings?.auctionTypes.map((t) => t.value) || []
  const sorted = sortLots(lots, sort, order)
  const groups: { value: string; label: string; lots: Lot[] }[] = []
  for (const t of settings?.auctionTypes || []) {
    const chunk = sorted.filter((l) => (l.auctionType || 'live') === t.value)
    if (chunk.length) groups.push({ value: t.value, label: t.label, lots: chunk })
  }
  const known = new Set(order)
  const leftover = sorted.filter((l) => !known.has(l.auctionType || 'live'))
  if (leftover.length) groups.push({ value: 'other', label: 'Other', lots: leftover })
  return groups
}

export function typeCounts(lots: Lot[], settings?: SiteSettings, now = Date.now()) {
  const auction = lots.filter((l) => l.channel === 'auction')
  const counts: Record<string, number> = {
    all: auction.length,
    ongoing: auction.filter((l) => l.endsAt > now).length,
  }
  for (const t of settings?.auctionTypes || []) {
    counts[t.value] = auction.filter((l) => (l.auctionType || 'live') === t.value).length
  }
  return counts
}
