import type { Bid, Lot } from '../types'

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

export type FillStats = ReturnType<typeof fillStats>
