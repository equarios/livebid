type Bid = { lotId: string; accountId: string; amount: number; qty: number; at: number }
type Lot = { id: string; qty: number }

export type FillSlice = {
  accountId: string
  qty: number
  unitPrice: number
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
    slices.push({ accountId: bid.accountId, qty, unitPrice: bid.amount })
    left -= qty
  }
  return slices
}

export function myPcs(lot: Lot, bids: Bid[], accountId: string) {
  return allocate(lot, bids)
    .filter((s) => s.accountId === accountId)
    .reduce((n, s) => n + s.qty, 0)
}
