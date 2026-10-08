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

export function liveLotFromDrop(item: ListingDropItem, now: number): Lot {
  const { durationMins: _mins, ...lot } = item
  return {
    ...lot,
    endsAt:
      item.channel === 'marketplace'
        ? now + 365 * 24 * 60 * 60 * 1000
        : now + Math.max(1, item.durationMins) * 60 * 1000,
  }
}

export function dropClockHint(
  settings: SiteSettings,
  listKey: string,
  durationMins: number,
  now = Date.now(),
) {
  if (listKey === 'marketplace') return 'Marketplace has no auction clock.'
  const t = settings.auctionTypes.find((row) => row.value === listKey)
  const label = t?.label || listKey
  if (t?.closesAt && t.closesAt > now) return `Joins the current ${label} close.`
  const mins = Math.max(1, durationMins)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const span = h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
  return `${label} is closed. Confirm starts a ${span} clock.`
}
