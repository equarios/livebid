import type { Bid, Lot, SiteSettings } from '../types'
import { isAuctionOpen, isInExtraSealed, isSealedLot } from './auctionLists'

export type BidOutcome = 'won' | 'partial' | 'lost'

export function bidOutcome(
  _lot: Lot,
  myPcs: number,
  desired: number | undefined,
  _now: number,
): BidOutcome | null {
  if (desired == null) return null
  if (myPcs <= 0) return 'lost'
  if (myPcs < desired) return 'partial'
  return 'won'
}

export function bidStatus(lot: Lot, myPcs: number, desired: number | undefined, now: number, settings?: SiteSettings) {
  if (!isAuctionOpen(lot, now)) return { label: 'Closed', className: 'muted' }
  if (isInExtraSealed(lot, now)) {
    return { label: 'Sealed', className: 'status sealed' }
  }
  if (isSealedLot(lot, settings, now)) {
    return desired != null ? { label: 'Bid in', className: 'status sealed' } : { label: '—', className: 'muted' }
  }
  if (desired == null) return { label: '—', className: 'muted' }
  if (myPcs <= 0) return { label: 'Outbid', className: 'status lose' }
  if (myPcs < desired) return { label: `Partial ${myPcs}/${desired}`, className: 'status lose' }
  return { label: 'Winning', className: 'status win' }
}

export type FillSlice = {
  accountId: string
  qty: number
  unitPrice: number
  takeAll: boolean
}

export function lastBidsForLot(bids: Bid[], lotId: string): Bid[] {
  const map = new Map<string, Bid>()
  for (const bid of bids) {
    if (bid.lotId !== lotId) continue
    const id = bid.accountId || 'UNKNOWN'
    const prev = map.get(id)
    if (!prev || bid.at > prev.at) map.set(id, { ...bid, accountId: id })
  }
  return [...map.values()]
}

export function allocate(lot: Lot, bids: Bid[]): FillSlice[] {
  const ranked = lastBidsForLot(bids, lot.id).sort((a, b) => {
    if (b.amount !== a.amount) return b.amount - a.amount
    return a.at - b.at
  })
  let left = lot.qty
  const slices: FillSlice[] = []
  for (const bid of ranked) {
    if (left <= 0) break
    const qty = Math.min(bid.qty, left)
    slices.push({
      accountId: bid.accountId,
      qty,
      unitPrice: bid.amount,
      takeAll: bid.qty >= lot.qty,
    })
    left -= qty
  }
  return slices
}

export function fillStats(lot: Lot, bids: Bid[], me?: string) {
  const slices = allocate(lot, bids)
  const takeAllPcs = slices.filter((s) => s.takeAll).reduce((n, s) => n + s.qty, 0)
  const smallPcs = slices.filter((s) => !s.takeAll).reduce((n, s) => n + s.qty, 0)
  const openPcs = Math.max(0, lot.qty - takeAllPcs - smallPcs)
  const mine = me ? slices.filter((s) => s.accountId === me) : []
  const myPcs = mine.reduce((n, s) => n + s.qty, 0)
  const myTakeAll = mine.some((s) => s.takeAll)
  const smallHigh = slices.filter((s) => !s.takeAll)
  const smallHighPrice = smallHigh.length ? Math.max(...smallHigh.map((s) => s.unitPrice)) : 0
  const takeAllPrice = slices.find((s) => s.takeAll)?.unitPrice ?? 0
  return {
    slices,
    takeAllPcs,
    smallPcs,
    openPcs,
    myPcs,
    myTakeAll,
    smallHighPrice,
    takeAllPrice,
  }
}

/** True when buyer has 0 fill but +$1 on their last bid would get ≥1 pc. */
export function isCloseToFill(lot: Lot, bids: Bid[], accountId: string, increment = 1): boolean {
  const stats = fillStats(lot, bids, accountId)
  if (stats.myPcs > 0) return false
  const last = lastBidsForLot(bids, lot.id).find((b) => b.accountId === accountId)
  if (!last) return false
  const others = bids.filter((b) => b.accountId !== accountId)
  const trial: Bid[] = [
    ...others,
    {
      ...last,
      amount: last.amount + increment,
      at: last.at + 1,
    },
  ]
  return fillStats(lot, trial, accountId).myPcs > 0
}

export type FillStats = ReturnType<typeof fillStats>
