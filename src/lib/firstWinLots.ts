import { effectiveEndsAt, listPath, migrateLotAuctionType } from './auctionLists'
import type { Bid, Lot } from '../types'

export type FirstWinPick = {
  lot: Lot
  bidders: number
  href: string
  title: string
}

const WINDOW_MS = 48 * 60 * 60 * 1000

/** Low-competition lots ending within 48h — good first-win / next-desk targets. */
export function pickFirstWinLots(
  lots: Lot[],
  bids: Bid[],
  now: number,
  limit = 4,
  opts?: { excludeLotIds?: Set<string>; excludeAccountId?: string },
): FirstWinPick[] {
  const exclude = opts?.excludeLotIds
  const open = lots.filter((l) => {
    if (l.channel !== 'auction') return false
    if (effectiveEndsAt(l) <= now) return false
    if (effectiveEndsAt(l) - now > WINDOW_MS) return false
    if (exclude?.has(l.id)) return false
    if (
      opts?.excludeAccountId &&
      bids.some((b) => b.lotId === l.id && b.accountId === opts.excludeAccountId)
    ) {
      return false
    }
    return true
  })
  const scored = open.map((lot) => {
    const bidders = new Set(
      bids.filter((b) => b.lotId === lot.id).map((b) => b.accountId),
    ).size
    return {
      lot,
      bidders,
      end: effectiveEndsAt(lot),
      href: listPath(migrateLotAuctionType(lot.auctionType)),
      title: `${lot.manufacturer} ${lot.model}`.trim() || lot.id,
    }
  })
  scored.sort((a, b) => a.bidders - b.bidders || a.end - b.end)
  return scored.slice(0, limit).map(({ lot, bidders, href, title }) => ({
    lot,
    bidders,
    href,
    title,
  }))
}
