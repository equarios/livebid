/** Shared lot JSON shape for commerce routes. */
export function mapLotRow(l: {
  id: string
  channel: string
  auctionType: string | null
  manufacturer: string
  model: string
  modelNumber: string
  capacity: string
  color: string
  grade: string
  battery: number
  qty: number
  moq: number | null
  startPrice: number
  currentPrice: number
  buyNowPrice: number | null
  bidCount: number
  endsAt: bigint
  description: string
  accent: string
  operator: string | null
  simLocked: boolean | null
  activationLocked: boolean | null
  origin: string | null
}) {
  return {
    id: l.id,
    channel: l.channel,
    auctionType: l.auctionType || undefined,
    manufacturer: l.manufacturer,
    model: l.model,
    modelNumber: l.modelNumber,
    capacity: l.capacity,
    color: l.color,
    grade: l.grade,
    battery: l.battery,
    qty: l.qty,
    moq: l.moq ?? undefined,
    startPrice: l.startPrice,
    currentPrice: l.currentPrice,
    buyNowPrice: l.buyNowPrice ?? undefined,
    bidCount: l.bidCount,
    endsAt: Number(l.endsAt),
    description: l.description,
    accent: l.accent,
    operator: l.operator ?? undefined,
    simLocked: l.simLocked ?? undefined,
    activationLocked: l.activationLocked ?? undefined,
    origin: l.origin ?? undefined,
  }
}
