import { fillStats, isCloseToFill } from './allocate'
import { effectiveEndsAt, isInExtraSealed, listPath, migrateLotAuctionType } from './auctionLists'
import type { Bid, Invoice, Lot, MarketOffer } from '../types'

export type DeskPulseStat = {
  key: string
  label: string
  href: string
  urgent?: boolean
}

type Input = {
  accountId: string
  lots: Lot[]
  bids: Bid[]
  offers: MarketOffer[]
  invoices: Invoice[]
  now: number
  watchMatches: number
  watchHref: string | null
  endingSoonToday: number
}

function auctionHref(lot: Lot) {
  return listPath(migrateLotAuctionType(lot.auctionType))
}

/** Compact remaining time for Extra sealed overtime on Your desk. */
export function sealedCountdownLabel(endsAt: number, now: number): string {
  const ms = endsAt - now
  if (ms <= 0) return 'ending'
  const m = Math.max(1, Math.round(ms / 60_000))
  if (m < 60) return `~${m}m left`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem ? `~${h}h ${rem}m left` : `~${h}h left`
}

/** Actionable buyer pulse for the wholesale hub desk bar. */
export function buildDeskPulse(input: Input): DeskPulseStat[] {
  const { accountId, lots, bids, offers, invoices, now } = input
  const mineLotIds = new Set(
    bids.filter((b) => b.accountId === accountId).map((b) => b.lotId),
  )

  const outbidLots: Lot[] = []
  const closeLots: Lot[] = []
  const sealedLots: Lot[] = []
  const openBidLots: Lot[] = []
  for (const lot of lots) {
    if (lot.channel !== 'auction') continue
    if (effectiveEndsAt(lot) <= now) continue
    if (!mineLotIds.has(lot.id)) continue
    openBidLots.push(lot)
    if (isInExtraSealed(lot, now)) {
      sealedLots.push(lot)
      continue
    }
    const stats = fillStats(lot, bids, accountId)
    const last = bids
      .filter((b) => b.lotId === lot.id && b.accountId === accountId)
      .sort((a, b) => b.at - a.at)[0]
    if (last && stats.myPcs <= 0) {
      outbidLots.push(lot)
      if (isCloseToFill(lot, bids, accountId, 1)) closeLots.push(lot)
    }
  }

  const pendingOffers = offers.filter(
    (o) => o.accountId === accountId && o.status === 'pending',
  )
  const acceptedOffers = offers.filter(
    (o) => o.accountId === accountId && o.status === 'accepted',
  )
  const dueInvoices = invoices.filter(
    (inv) =>
      inv.accountId === accountId &&
      (inv.status === 'unpaid' || inv.status === 'pending_review'),
  )

  const stats: DeskPulseStat[] = []
  if (closeLots.length) {
    stats.push({
      key: 'outbid',
      label: `${closeLots.length} close to fill`,
      href: auctionHref(closeLots[0]),
      urgent: true,
    })
  } else if (outbidLots.length) {
    stats.push({
      key: 'outbid',
      label: `${outbidLots.length} outbid`,
      href: auctionHref(outbidLots[0]),
    })
  }
  if (acceptedOffers.length) {
    stats.push({
      key: 'offer',
      label: `${acceptedOffers.length} offer${acceptedOffers.length === 1 ? '' : 's'} to confirm`,
      href: '/account/marketplace-history#offers',
      urgent: true,
    })
  }
  if (dueInvoices.length) {
    stats.push({
      key: 'invoice',
      label: `${dueInvoices.length} invoice${dueInvoices.length === 1 ? '' : 's'} due`,
      href: '/account/invoices',
      urgent: true,
    })
  }
  if (sealedLots.length) {
    sealedLots.sort((a, b) => effectiveEndsAt(a) - effectiveEndsAt(b))
    const soonest = sealedLots[0]
    const left = sealedCountdownLabel(effectiveEndsAt(soonest), now)
    stats.push({
      key: 'sealed',
      label:
        sealedLots.length === 1
          ? `sealed · ${left}`
          : `${sealedLots.length} sealed · ${left}`,
      href: auctionHref(soonest),
      urgent: true,
    })
  }
  if (openBidLots.length) {
    stats.push({
      key: 'bids',
      label: `${openBidLots.length} open bid${openBidLots.length === 1 ? '' : 's'}`,
      href: auctionHref(openBidLots[0]),
    })
  }
  if (pendingOffers.length) {
    stats.push({
      key: 'pending',
      label: `${pendingOffers.length} pending offer${pendingOffers.length === 1 ? '' : 's'}`,
      href: '/account/marketplace-history#offers',
    })
  }
  if (input.watchMatches > 0) {
    stats.push({
      key: 'watch',
      label: `${input.watchMatches} watch hit${input.watchMatches === 1 ? '' : 's'}`,
      href: input.watchHref || '/account/favourites',
    })
  }

  if (!stats.length && input.endingSoonToday > 0) {
    stats.push({
      key: 'soon',
      label: `${input.endingSoonToday} desk${input.endingSoonToday === 1 ? '' : 's'} close today`,
      href: '#wholesale-ending-soon',
    })
  }

  return stats
}
