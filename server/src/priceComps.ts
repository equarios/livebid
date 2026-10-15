/** Comparable past clearing prices for auction / marketplace lots. */

import { effectiveEndsAtMs } from './auctionPhase'
import { prisma } from './db'

export type PriceComp = {
  lotId: string
  unitPrice: number
  at: number
  /** Auction type slug or "marketplace". */
  type: string
  grade: string
  capacity: string
  qty: number
}

export type PriceCompsResult = {
  comps: PriceComp[]
  median: number | null
}

function medianOf(prices: number[]): number | null {
  if (prices.length < 2) return null
  const s = [...prices].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  if (s.length % 2) return Math.round(s[mid] * 100) / 100
  return Math.round(((s[mid - 1] + s[mid]) / 2) * 100) / 100
}

function scoreMatch(
  row: { capacity: string; grade: string },
  target: { capacity: string; grade: string },
) {
  let s = 0
  if (row.capacity && target.capacity && row.capacity === target.capacity) s += 2
  if (row.grade && target.grade && row.grade === target.grade) s += 1
  return s
}

async function auctionComps(lot: {
  id: string
  auctionType: string | null
  manufacturer: string
  model: string
  capacity: string
  grade: string
}): Promise<PriceComp[]> {
  const now = Date.now()
  const nowBig = BigInt(now)
  const type = lot.auctionType || 'live'
  const rows = await prisma.lot.findMany({
    where: {
      channel: 'auction',
      auctionType: type,
      manufacturer: lot.manufacturer,
      model: lot.model,
      id: { not: lot.id },
      bidCount: { gt: 0 },
      endsAt: { lte: nowBig },
    },
    orderBy: { endsAt: 'desc' },
    take: 60,
  })

  const closed = rows
    .filter((r) => effectiveEndsAtMs(r) <= now && r.currentPrice > 0)
    .map((r) => ({
      lotId: r.id,
      unitPrice: Math.round(r.currentPrice * 100) / 100,
      at: effectiveEndsAtMs(r),
      type,
      grade: r.grade,
      capacity: r.capacity,
      qty: r.qty,
      _score: scoreMatch(r, lot),
    }))
    .sort((a, b) => b._score - a._score || b.at - a.at)

  return closed.slice(0, 3).map(({ _score: _, ...rest }) => rest)
}

async function marketplaceComps(lot: {
  id: string
  manufacturer: string
  model: string
  capacity: string
  grade: string
}): Promise<PriceComp[]> {
  const similar = await prisma.lot.findMany({
    where: {
      channel: 'marketplace',
      manufacturer: lot.manufacturer,
      model: lot.model,
      id: { not: lot.id },
    },
    select: { id: true, capacity: true, grade: true, qty: true },
    take: 80,
  })
  if (!similar.length) return []
  const byId = new Map(similar.map((s) => [s.id, s]))
  const ids = similar.map((s) => s.id)

  const invoices = await prisma.invoice.findMany({
    where: {
      channel: 'marketplace',
      status: 'paid',
      lotId: { in: ids },
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  })

  const out: Array<PriceComp & { _score: number }> = []
  const seen = new Set<string>()
  for (const inv of invoices) {
    if (seen.has(inv.lotId)) continue
    const meta = byId.get(inv.lotId)
    if (!meta) continue
    const price = Math.round((inv.unitPrice || 0) * 100) / 100
    if (price <= 0) continue
    seen.add(inv.lotId)
    out.push({
      lotId: inv.lotId,
      unitPrice: price,
      at: Number(inv.createdAt),
      type: 'marketplace',
      grade: meta.grade,
      capacity: meta.capacity,
      qty: meta.qty,
      _score: scoreMatch(meta, lot),
    })
  }

  return out
    .sort((a, b) => b._score - a._score || b.at - a.at)
    .slice(0, 3)
    .map(({ _score: _, ...rest }) => rest)
}

export async function findPriceComps(lotId: string): Promise<PriceCompsResult | null> {
  const lot = await prisma.lot.findUnique({ where: { id: lotId } })
  if (!lot) return null

  const comps =
    lot.channel === 'marketplace'
      ? await marketplaceComps(lot)
      : await auctionComps(lot)

  return {
    comps,
    median: medianOf(comps.map((c) => c.unitPrice)),
  }
}
