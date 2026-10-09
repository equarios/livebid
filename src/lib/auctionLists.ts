import { isEndingSoon } from './format'
import type { AuctionFillMode, AuctionTypeDef, Lot, SiteSettings } from '../types'

export type AuctionListKind = string

export const ORIGINS = ['JP', 'KR', 'EU', 'US', 'HK', 'AE', 'TW', 'INT'] as const

export const RESERVED_LIST_SLUGS = new Set([
  'all',
  'ongoing',
  'closed',
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
  if (slug === 'offline' || slug === 'sealed') return 'sealed'
  if (value === 'sealed' || value === 'hybrid' || value === 'live') return value
  if (slug === 'hybrid') return 'hybrid'
  return 'live'
}

export function migrateLotAuctionType(value?: string) {
  if (value === 'sealed' || value === 'hybrid') return 'offline'
  return value || 'live'
}

export function normalizeAuctionTypes(
  rows?: AuctionTypeDef[] | Array<{
    value: string
    label: string
    fillMode?: string
    intro?: string
    closesAt?: number
    closeMinutes?: number
    feePct?: number
  }>,
) {
  const seen = new Set<string>()
  const out: AuctionTypeDef[] = []
  for (const t of rows || []) {
    const value = slugAuctionType(t.value)
    if (!value || RESERVED_LIST_SLUGS.has(value) || seen.has(value)) continue
    seen.add(value)
    const feeRaw = Number(t.feePct)
    out.push({
      value,
      label: (t.label || value).trim(),
      fillMode: normalizeFillMode(t.fillMode, value),
      intro: t.intro?.trim() || undefined,
      closesAt: typeof t.closesAt === 'number' && t.closesAt > 0 ? t.closesAt : undefined,
      closeMinutes:
        typeof t.closeMinutes === 'number' && t.closeMinutes > 0 ? Math.floor(t.closeMinutes) : undefined,
      feePct: Number.isFinite(feeRaw) && feeRaw >= 0 ? feeRaw : undefined,
    })
  }
  return out
}

export function isAuctionListKind(value: string | undefined, settings?: SiteSettings): value is AuctionListKind {
  if (!value) return false
  if (value === 'all' || value === 'ongoing' || value === 'closed') return true
  return Boolean(settings?.auctionTypes.some((t) => t.value === value))
}

export function listPath(kind: AuctionListKind) {
  if (kind === 'all') return '/auctions'
  return `/auctions#${kind}`
}

export function listLabel(kind: AuctionListKind, settings?: SiteSettings) {
  if (kind === 'all') return 'All Auctions'
  if (kind === 'ongoing') return 'Ongoing Auctions'
  if (kind === 'closed') return 'Closed Auctions'
  return settings?.auctionTypes.find((t) => t.value === kind)?.label || kind
}

export function listIntro(kind: AuctionListKind, settings?: SiteSettings) {
  const def = settings?.auctionTypes.find((t) => t.value === kind)
  if (def?.intro) return def.intro
  const mode = def?.fillMode || normalizeFillMode(undefined, kind)
  if (kind === 'ongoing') {
    return 'Ongoing Auctions: only lots that are still open, across types.'
  }
  if (kind === 'closed') {
    return 'Closed Auctions: lots that have ended, across types. Review your bids; new bids are not accepted.'
  }
  if (kind === 'all') {
    return 'All Auctions: full catalog. Live Auctions and Offline Auctions lots sit on this page, grouped by type.'
  }
  if (mode === 'sealed') {
    return `${def?.label || kind}: other fills stay hidden until close.`
  }
  if (mode === 'hybrid') {
    return `${def?.label || kind}: live fill now, then a sealed stage.`
  }
  return `${def?.label || kind}: last bid per account fills this inventory. You only see your own fill.`
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

export function lotAuctionSlug(lot: Pick<Lot, 'auctionType'>) {
  return migrateLotAuctionType(lot.auctionType)
}

export function ensureAuctionClocks(
  settings: SiteSettings,
  lots: Lot[],
  now = Date.now(),
): { settings: SiteSettings; lots: Lot[] } {
  const auctionTypes = settings.auctionTypes.map((t) => {
    // Keep an open clock. Missing or expired clocks roll forward so lists stay usable.
    if (t.closesAt && t.closesAt > now) return t
    const mins = Math.max(1, t.closeMinutes || (t.value === 'live' ? 240 : 18 * 60))
    return { ...t, closeMinutes: mins, closesAt: now + mins * 60 * 1000 }
  })
  const byType = new Map(auctionTypes.map((t) => [t.value, t.closesAt || 0]))
  const nextLots = lots.map((lot) => {
    if (lot.channel !== 'auction') return lot
    const slug = lotAuctionSlug(lot)
    const closesAt = byType.get(slug)
    if (!closesAt) return { ...lot, auctionType: slug }
    return { ...lot, auctionType: slug, endsAt: closesAt }
  })
  return { settings: { ...settings, auctionTypes }, lots: nextLots }
}

/** When Super publishes a drop: join an open list clock, or start a new one from the drop duration. */
export function applyDropClocks(
  settings: SiteSettings,
  existingLots: Lot[],
  incoming: Lot[],
  dropItems: Array<{ channel: Lot['channel']; auctionType?: string; durationMins: number }>,
  now = Date.now(),
): { settings: SiteSettings; lots: Lot[] } {
  const durationByType = new Map<string, number>()
  for (const item of dropItems) {
    if (item.channel !== 'auction') continue
    const slug = item.auctionType || 'live'
    const mins = Math.max(1, item.durationMins || 1)
    durationByType.set(slug, Math.max(durationByType.get(slug) || 0, mins))
  }
  const auctionTypes = settings.auctionTypes.map((t) => {
    const mins = durationByType.get(t.value)
    if (mins == null) return t
    if (t.closesAt && t.closesAt > now) return t
    return { ...t, closeMinutes: mins, closesAt: now + mins * 60 * 1000 }
  })
  return ensureAuctionClocks({ ...settings, auctionTypes }, [...incoming, ...existingLots], now)
}

export function typeClockOpen(settings: SiteSettings, slug: string, now = Date.now()) {
  const t = settings.auctionTypes.find((row) => row.value === slug)
  return Boolean(t?.closesAt && t.closesAt > now)
}

export type AuctionClockRow = {
  value: string
  label: string
  endsAt: number
  count: number
  closing: boolean
  durationMs: number
}

export function auctionClockRows(
  lots: Lot[],
  settings: SiteSettings,
  now: number,
  minutes: number,
): AuctionClockRow[] {
  const rows: AuctionClockRow[] = []
  for (const t of settings.auctionTypes) {
    const group = lots.filter((l) => l.channel === 'auction' && lotAuctionSlug(l) === t.value)
    if (!group.length) continue
    const endsAt = t.closesAt || Math.max(...group.map((l) => l.endsAt))
    if (endsAt <= now) continue
    const durationMs = Math.max(
      1,
      (t.closeMinutes || minutes) * 60 * 1000,
      endsAt - now,
    )
    rows.push({
      value: t.value,
      label: t.label,
      endsAt,
      count: group.length,
      closing: isEndingSoon(endsAt, now, minutes),
      durationMs,
    })
  }
  return rows.sort((a, b) => a.endsAt - b.endsAt)
}

export function closingSoonAuctions(
  lots: Lot[],
  settings: SiteSettings,
  now: number,
  minutes: number,
) {
  return auctionClockRows(lots, settings, now, minutes).filter((row) => row.closing)
}

export function typePillClass(lot: Pick<Lot, 'auctionType' | 'channel'>, settings?: SiteSettings) {
  if (lot.channel === 'marketplace') return 'market'
  const slug = lot.auctionType || 'live'
  if (slug === 'offline') return 'offline'
  return lotFillMode(lot, settings)
}

export function inAuctionList(lot: Lot, kind: AuctionListKind, now = Date.now()) {
  if (lot.channel !== 'auction') return false
  if (kind === 'all') return true
  if (kind === 'ongoing') return lot.endsAt > now
  if (kind === 'closed') return lot.endsAt <= now
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
    closed: auction.filter((l) => l.endsAt <= now).length,
  }
  for (const t of settings?.auctionTypes || []) {
    counts[t.value] = auction.filter((l) => (l.auctionType || 'live') === t.value).length
  }
  return counts
}
