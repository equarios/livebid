import { isEndingSoon } from './format'
import type { AuctionFillMode, AuctionTypeDef, Lot, SiteSettings } from '../types'

export type AuctionListKind = string

/** Market / ship-from region — 3-letter so buyers can read at a glance. */
export const ORIGINS = ['JPN', 'KOR', 'EUR', 'USA', 'HKG', 'ARE', 'TWN', 'INT'] as const

/** Legacy 2-letter → 3-letter (and pass-through for already-3). */
const ORIGIN_ALIASES: Record<string, (typeof ORIGINS)[number]> = {
  JP: 'JPN',
  JPN: 'JPN',
  KR: 'KOR',
  KOR: 'KOR',
  EU: 'EUR',
  EUR: 'EUR',
  US: 'USA',
  USA: 'USA',
  HK: 'HKG',
  HKG: 'HKG',
  AE: 'ARE',
  ARE: 'ARE',
  TW: 'TWN',
  TWN: 'TWN',
  INT: 'INT',
}

export function normalizeOrigin(raw?: string | null): (typeof ORIGINS)[number] {
  const key = String(raw || 'INT').trim().toUpperCase()
  return ORIGIN_ALIASES[key] || 'INT'
}

/** Buyer-facing origin code (always 3-letter). */
export function originLabel(raw?: string | null) {
  return normalizeOrigin(raw)
}

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
    extraSealedMinutes?: number
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
    const extraRaw = Number(t.extraSealedMinutes)
    out.push({
      value,
      label: (t.label || value).trim(),
      fillMode: normalizeFillMode(t.fillMode, value),
      intro: t.intro?.trim() || undefined,
      closesAt: typeof t.closesAt === 'number' && t.closesAt > 0 ? t.closesAt : undefined,
      closeMinutes:
        typeof t.closeMinutes === 'number' && t.closeMinutes > 0 ? Math.floor(t.closeMinutes) : undefined,
      extraSealedMinutes:
        Number.isFinite(extraRaw) && extraRaw > 0 ? Math.floor(extraRaw) : undefined,
      feePct: Number.isFinite(feeRaw) && feeRaw >= 0 ? feeRaw : undefined,
    })
  }
  return out
}

export function effectiveEndsAt(lot: Pick<Lot, 'endsAt' | 'extraSealedEndsAt'>): number {
  return lot.extraSealedEndsAt && lot.extraSealedEndsAt > 0 ? lot.extraSealedEndsAt : lot.endsAt
}

export function isInExtraSealed(
  lot: Pick<Lot, 'endsAt' | 'extraSealedEndsAt' | 'channel'>,
  now = Date.now(),
): boolean {
  if (lot.channel === 'marketplace') return false
  const extra = lot.extraSealedEndsAt
  if (!extra || extra <= 0) return false
  return now > lot.endsAt && now <= extra
}

export function isAuctionOpen(
  lot: Pick<Lot, 'endsAt' | 'extraSealedEndsAt' | 'channel'>,
  now = Date.now(),
): boolean {
  if (lot.channel === 'marketplace') return true
  return effectiveEndsAt(lot) > now
}

export function computeExtraSealedEndsAt(closesAt: number, extraSealedMinutes?: number): number | undefined {
  const mins = Math.floor(Number(extraSealedMinutes) || 0)
  if (mins <= 0 || !closesAt) return undefined
  return closesAt + mins * 60 * 1000
}

/** Hide Extra sealed lots from buyers who never bid (staff see all). */
export function filterExtraSealedLots<T extends Pick<Lot, 'id' | 'channel' | 'endsAt' | 'extraSealedEndsAt'>>(
  lots: T[],
  bids: Array<{ lotId: string; accountId: string }>,
  accountId: string | undefined,
  staff: boolean,
  now = Date.now(),
): T[] {
  if (staff || !accountId) return lots
  const mine = new Set(
    bids.filter((b) => b.accountId === accountId).map((b) => b.lotId),
  )
  return lots.filter((l) => l.channel !== 'auction' || !isInExtraSealed(l, now) || mine.has(l.id))
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
  if ((def?.extraSealedMinutes || 0) > 0) {
    return `${def?.label || kind}: open live fill first; then Extra sealed overtime for accounts that already bid (others cannot see those lots).`
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

export function isSealedLot(
  lot: Pick<Lot, 'auctionType' | 'channel' | 'endsAt' | 'extraSealedEndsAt'>,
  settings?: SiteSettings,
  now = Date.now(),
) {
  if (isInExtraSealed(lot, now)) return true
  return lotFillMode(lot, settings) === 'sealed'
}

/**
 * Offline sealed hides the high. Extra sealed shows last high to prior bidders
 * (they are the only ones who can see the lot).
 */
export function hideAuctionHigh(
  lot: Pick<Lot, 'auctionType' | 'channel' | 'endsAt' | 'extraSealedEndsAt'>,
  settings?: SiteSettings,
  now = Date.now(),
) {
  if (lot.channel !== 'auction') return false
  if (isInExtraSealed(lot, now)) return false
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
  const byType = new Map(auctionTypes.map((t) => [t.value, t]))
  const nextLots = lots.map((lot) => {
    if (lot.channel !== 'auction') return lot
    const slug = lotAuctionSlug(lot)
    const def = byType.get(slug)
    if (!def?.closesAt) return { ...lot, auctionType: slug }
    const extraSealedEndsAt = computeExtraSealedEndsAt(def.closesAt, def.extraSealedMinutes)
    return {
      ...lot,
      auctionType: slug,
      endsAt: def.closesAt,
      extraSealedEndsAt,
    }
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

export type LaunchClockPlan = {
  listKey: string
  mode: 'join' | 'new' | 'marketplace'
  durationMins: number
  extraMins: number
  liveEndsAt: number
}

/**
 * Publish from Super Launch Preview: one clock plan per list.
 * Join keeps the open closesAt; new sets absolute liveEndsAt. Extra sealed comes only from the plan.
 */
export function applyLaunchClocks(
  settings: SiteSettings,
  existingLots: Lot[],
  incoming: Lot[],
  plans: LaunchClockPlan[],
  now = Date.now(),
): { settings: SiteSettings; lots: Lot[] } {
  const byKey = new Map(plans.filter((p) => p.mode !== 'marketplace').map((p) => [p.listKey, p]))
  const auctionTypes = settings.auctionTypes.map((t) => {
    const plan = byKey.get(t.value)
    if (!plan) return t
    if (plan.mode === 'join' && t.closesAt && t.closesAt > now) {
      return { ...t, extraSealedMinutes: plan.extraMins }
    }
    const mins = Math.max(1, plan.durationMins || 1)
    const closesAt = plan.liveEndsAt > now ? plan.liveEndsAt : now + mins * 60 * 1000
    return {
      ...t,
      closeMinutes: mins,
      closesAt,
      extraSealedMinutes: plan.extraMins,
    }
  })
  const byType = new Map(auctionTypes.map((t) => [t.value, t]))
  const nextLots = [...incoming, ...existingLots].map((lot) => {
    if (lot.channel !== 'auction') return lot
    const slug = lotAuctionSlug(lot)
    const def = byType.get(slug)
    if (!def?.closesAt) return { ...lot, auctionType: slug }
    const plan = byKey.get(slug)
    const extra = plan ? plan.extraMins : def.extraSealedMinutes || 0
    return {
      ...lot,
      auctionType: slug,
      endsAt: def.closesAt,
      extraSealedEndsAt: computeExtraSealedEndsAt(def.closesAt, extra),
    }
  })
  return { settings: { ...settings, auctionTypes }, lots: nextLots }
}

export function typeClockOpen(settings: SiteSettings, slug: string, now = Date.now()) {
  const t = settings.auctionTypes.find((row) => row.value === slug)
  return Boolean(t?.closesAt && t.closesAt > now)
}

export type AuctionClockRow = {
  value: string
  label: string
  /** Phase countdown target (live close or Extra sealed end). */
  endsAt: number
  liveEndsAt: number
  extraEndsAt?: number
  phase: 'live' | 'extra'
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
    const liveEndsAt = t.closesAt || Math.max(...group.map((l) => l.endsAt))
    const fromLots = Math.max(...group.map((l) => effectiveEndsAt(l)))
    const typeExtra = computeExtraSealedEndsAt(liveEndsAt, t.extraSealedMinutes)
    const extraEndsAt =
      fromLots > liveEndsAt ? fromLots : typeExtra && typeExtra > liveEndsAt ? typeExtra : undefined
    const finalEnd = extraEndsAt && extraEndsAt > liveEndsAt ? extraEndsAt : liveEndsAt
    if (finalEnd <= now) continue
    const phase: 'live' | 'extra' =
      extraEndsAt && now > liveEndsAt && now <= extraEndsAt ? 'extra' : 'live'
    const endsAt = phase === 'extra' && extraEndsAt ? extraEndsAt : liveEndsAt
    if (endsAt <= now) continue
    const liveDurationMs = Math.max(1, (t.closeMinutes || minutes) * 60 * 1000, liveEndsAt - now)
    const extraDurationMs =
      extraEndsAt && extraEndsAt > liveEndsAt ? Math.max(1, extraEndsAt - liveEndsAt) : 0
    const durationMs = phase === 'extra' ? extraDurationMs : liveDurationMs
    rows.push({
      value: t.value,
      label: t.label,
      endsAt,
      liveEndsAt,
      extraEndsAt,
      phase,
      count: group.filter((l) => isAuctionOpen(l, now)).length || group.length,
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
  if (kind === 'ongoing') return isAuctionOpen(lot, now)
  if (kind === 'closed') return !isAuctionOpen(lot, now)
  return (lot.auctionType || 'live') === kind
}

export function originOptions(lots: Lot[]) {
  return [...new Set(lots.map((l) => originLabel(l.origin)))].sort()
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
    const chunk = sorted.filter((l) => lotAuctionSlug(l) === t.value)
    if (chunk.length) groups.push({ value: t.value, label: t.label, lots: chunk })
  }
  const known = new Set(order)
  const leftover = sorted.filter((l) => !known.has(lotAuctionSlug(l)))
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
    counts[t.value] = auction.filter((l) => lotAuctionSlug(l) === t.value).length
  }
  return counts
}
