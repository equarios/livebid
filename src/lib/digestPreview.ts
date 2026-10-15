import { fillStats } from './allocate'
import { effectiveEndsAt, isInExtraSealed } from './auctionLists'
import { countWatchFilterMatches } from './watchFilters'
import type { Bid, Invoice, Lot } from '../types'

/** Client-side preview of what the daily digest email would cover right now. */
export function buildDigestPreviewLines(input: {
  accountId: string
  lots: Lot[]
  bids: Bid[]
  invoices: Invoice[]
  now: number
}): string[] {
  const { accountId, lots, bids, invoices, now } = input
  const mineLotIds = new Set(
    bids.filter((b) => b.accountId === accountId).map((b) => b.lotId),
  )
  let outbid = 0
  for (const lot of lots) {
    if (lot.channel !== 'auction') continue
    if (effectiveEndsAt(lot) <= now) continue
    if (!mineLotIds.has(lot.id)) continue
    if (isInExtraSealed(lot, now)) continue
    const stats = fillStats(lot, bids, accountId)
    if (stats.myPcs <= 0) outbid += 1
  }

  const invoicesDue = invoices.filter(
    (inv) =>
      inv.accountId === accountId &&
      (inv.status === 'unpaid' || inv.status === 'pending_review'),
  ).length

  const watch = countWatchFilterMatches(accountId, lots, now).lots

  const lines: string[] = []
  if (outbid) lines.push(`${outbid} outbid lot${outbid === 1 ? '' : 's'}`)
  if (invoicesDue) {
    lines.push(`${invoicesDue} invoice${invoicesDue === 1 ? '' : 's'} due`)
  }
  if (watch) lines.push(`${watch} watch hit${watch === 1 ? '' : 's'} (batched)`)
  return lines
}
