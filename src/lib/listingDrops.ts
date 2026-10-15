import { computeExtraSealedEndsAt } from './auctionLists'
import type { ListingDropItem, Lot, SiteSettings } from '../types'

export function dropListKey(item: Pick<Lot, 'channel' | 'auctionType'>) {
  return item.channel === 'marketplace' ? 'marketplace' : item.auctionType || 'live'
}

export function dropListLabel(item: Pick<Lot, 'channel' | 'auctionType'>, settings: SiteSettings) {
  if (item.channel === 'marketplace') return settings.marketplaceLabel
  return settings.auctionTypes.find((t) => t.value === item.auctionType)?.label || item.auctionType || 'Auction'
}

export function groupDropItems(items: ListingDropItem[], settings: SiteSettings) {
  const order: string[] = []
  const map = new Map<string, ListingDropItem[]>()
  for (const item of items) {
    const key = dropListKey(item)
    if (!map.has(key)) {
      order.push(key)
      map.set(key, [])
    }
    map.get(key)!.push(item)
  }
  return order.map((key) => {
    const rows = map.get(key) || []
    const sample = rows[0]
    return {
      key,
      label: sample ? dropListLabel(sample, settings) : key,
      items: rows,
    }
  })
}

/** Super Launch Preview: one clock decision per list. */
export type DropListClockPlan = {
  listKey: string
  label: string
  count: number
  /** marketplace has no auction clock */
  mode: 'join' | 'new' | 'marketplace'
  canJoin: boolean
  durationMins: number
  extraMins: number
  liveEndsAt: number
  extraSealedEndsAt?: number
}

export type DropClockOverrides = Record<
  string,
  { mode?: 'join' | 'new'; durationMins?: number; extraSealedMinutes?: number }
>

function itemExtraMins(items: ListingDropItem[], typeExtra?: number) {
  const first = items[0]?.extraSealedMinutes
  if (first === 0 || Number.isFinite(first)) return Number(first) || 0
  return typeExtra || 0
}

/** Absolute close times Super will publish — join open list or start a new clock. */
export function previewDropClocks(
  settings: SiteSettings,
  items: ListingDropItem[],
  now = Date.now(),
  overrides?: DropClockOverrides,
): DropListClockPlan[] {
  return groupDropItems(items, settings).map((g) => {
    if (g.key === 'marketplace') {
      return {
        listKey: 'marketplace',
        label: g.label,
        count: g.items.length,
        mode: 'marketplace' as const,
        canJoin: false,
        durationMins: 0,
        extraMins: 0,
        liveEndsAt: 0,
      }
    }
    const t = settings.auctionTypes.find((row) => row.value === g.key)
    const canJoin = Boolean(t?.closesAt && t.closesAt > now)
    const ov = overrides?.[g.key]
    const durationMins = Math.max(
      1,
      Math.floor(ov?.durationMins ?? g.items[0]?.durationMins ?? t?.closeMinutes ?? 240) || 1,
    )
    const extraMins =
      ov?.extraSealedMinutes === 0 || Number.isFinite(ov?.extraSealedMinutes)
        ? Math.max(0, Math.floor(Number(ov?.extraSealedMinutes) || 0))
        : itemExtraMins(g.items, t?.extraSealedMinutes)
    const wantJoin = (ov?.mode ?? (canJoin ? 'join' : 'new')) === 'join'
    const mode: 'join' | 'new' = wantJoin && canJoin ? 'join' : 'new'
    const liveEndsAt =
      mode === 'join' && t?.closesAt && t.closesAt > now
        ? t.closesAt
        : now + durationMins * 60 * 1000
    return {
      listKey: g.key,
      label: g.label,
      count: g.items.length,
      mode,
      canJoin,
      durationMins,
      extraMins,
      liveEndsAt,
      extraSealedEndsAt: computeExtraSealedEndsAt(liveEndsAt, extraMins),
    }
  })
}

export function liveLotFromDrop(item: ListingDropItem, now: number, settings?: SiteSettings): Lot {
  const { durationMins: _mins, extraSealedMinutes: itemExtra, ...lot } = item
  const endsAt =
    item.channel === 'marketplace'
      ? now + 365 * 24 * 60 * 60 * 1000
      : now + Math.max(1, item.durationMins) * 60 * 1000
  const typeExtra =
    settings?.auctionTypes.find((t) => t.value === (item.auctionType || 'live'))?.extraSealedMinutes
  const extraMins =
    item.channel === 'marketplace'
      ? 0
      : itemExtra === 0 || Number.isFinite(itemExtra)
        ? Number(itemExtra) || 0
        : typeExtra || 0
  return {
    ...lot,
    endsAt,
    extraSealedEndsAt: computeExtraSealedEndsAt(endsAt, extraMins),
  }
}

export function dropClockHint(
  settings: SiteSettings,
  listKey: string,
  durationMins: number,
  now = Date.now(),
  extraSealedMinutes?: number,
) {
  if (listKey === 'marketplace') return 'Marketplace has no auction clock.'
  const t = settings.auctionTypes.find((row) => row.value === listKey)
  const label = t?.label || listKey
  const extra =
    extraSealedMinutes === 0 || Number.isFinite(extraSealedMinutes)
      ? Number(extraSealedMinutes) || 0
      : t?.extraSealedMinutes || 0
  const extraNote = extra > 0 ? ` + ${extra}m Extra sealed` : ''
  if (t?.closesAt && t.closesAt > now) {
    return `Joins the current ${label} close${extraNote}.`
  }
  const mins = Math.max(1, durationMins)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const span = h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
  return `${label} is closed. Super Launch Preview starts a ${span} clock${extraNote}.`
}