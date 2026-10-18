import { prisma } from './db'

const HK = 8 * 60 * 60 * 1000

export type ResultPreset = 'today' | 'days7' | 'month' | 'quarter' | 'year' | 'lastyear' | 'all' | 'custom'

export type CompanyResult = {
  from: number
  to: number
  collectedGoods: number
  collectedFees: number
  owedGoods: number
  owedFees: number
  costOfGoods: number
  writtenOff: number
  grossProfit: number
  missingSales: number
  missingPcs: number
  missingWriteoffPcs: number
  stockValue: number
  stockUncostedPcs: number
  missing: MissingGap[]
}

export type MissingGap = {
  key: string
  skuId: string | null
  label: string
  /** sale = warehouse device with no cost. unlinked = no warehouse device. writeoff = left out of the warehouse. */
  kind: 'sale' | 'unlinked' | 'writeoff'
  pcs: number
  amount: number
}

type Line = { lotId: string; qty: number; unitPrice: number }

function money(n: number) {
  return Math.round(n * 100) / 100
}

function hkParts(stamp: number) {
  const d = new Date(stamp + HK)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate() }
}

function hkDayStart(y: number, m: number, day: number) {
  return Date.UTC(y, m, day) - HK
}

export function resultWindow(preset: ResultPreset, now: number, fromDay?: string, toDay?: string) {
  const p = hkParts(now)
  const todayStart = hkDayStart(p.y, p.m, p.day)
  if (preset === 'today') return { from: todayStart, to: now }
  if (preset === 'days7') return { from: now - 7 * 86_400_000, to: now }
  if (preset === 'month') return { from: hkDayStart(p.y, p.m, 1), to: now }
  if (preset === 'quarter') return { from: hkDayStart(p.y, Math.floor(p.m / 3) * 3, 1), to: now }
  if (preset === 'year') return { from: hkDayStart(p.y, 0, 1), to: now }
  if (preset === 'lastyear') return { from: hkDayStart(p.y - 1, 0, 1), to: hkDayStart(p.y, 0, 1) - 1 }
  if (preset === 'all') return { from: 0, to: now }
  const from = parseDay(fromDay)
  const to = parseDay(toDay)
  if (from == null || to == null || to < from) return null
  return { from: hkDayStart(from.y, from.m, from.day), to: hkDayStart(to.y, to.m, to.day) + 86_400_000 - 1 }
}

function parseDay(value: string | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2]) - 1
  const day = Number(match[3])
  if (m < 0 || m > 11 || day < 1 || day > 31) return null
  return { y, m, day }
}

function inRange(stamp: number, from: number, to: number) {
  return stamp >= from && stamp <= to
}

function linesOf(dataJson: string, lotId: string, qty: number, unitPrice: number): Line[] {
  let extra: { lines?: Line[] } = {}
  try {
    extra = JSON.parse(dataJson || '{}') as { lines?: Line[] }
  } catch {
    extra = {}
  }
  if (extra.lines?.length) {
    return extra.lines.map((line) => ({
      lotId: String(line.lotId || lotId),
      qty: Math.max(0, Math.round(Number(line.qty) || 0)),
      unitPrice: Number(line.unitPrice) || 0,
    }))
  }
  return [{ lotId, qty: Math.max(0, Math.round(qty)), unitPrice: Number(unitPrice) || 0 }]
}

function feeOf(dataJson: string, goods: number) {
  let feePct = 0
  try {
    const extra = JSON.parse(dataJson || '{}') as { feePct?: number }
    if (Number.isFinite(extra.feePct) && (extra.feePct as number) > 0) feePct = extra.feePct as number
  } catch {
    feePct = 0
  }
  return feePct > 0 ? money(goods * (feePct / 100)) : 0
}

function wonQty(lotQty: number, bids: { accountId: string; amount: number; qty: number; at: bigint }[]) {
  const latest = new Map<string, (typeof bids)[number]>()
  for (const bid of bids) {
    const prev = latest.get(bid.accountId)
    if (!prev || bid.at > prev.at) latest.set(bid.accountId, bid)
  }
  const ranked = [...latest.values()].sort((a, b) => b.amount - a.amount || Number(a.at - b.at))
  let left = lotQty
  let won = 0
  for (const bid of ranked) {
    if (left <= 0) break
    const take = Math.min(bid.qty, left)
    won += take
    left -= take
  }
  return won
}

export async function companyResult(from: number, to: number): Promise<CompanyResult> {
  const [invoices, orders, holds, moves, skus, lots, bids] = await Promise.all([
    prisma.invoice.findMany(),
    prisma.storeOrder.findMany({ include: { lines: true } }),
    prisma.stockHold.findMany(),
    prisma.stockMove.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.inventorySku.findMany(),
    prisma.lot.findMany({
      select: { id: true, qty: true, manufacturer: true, model: true, modelNumber: true },
    }),
    prisma.bid.findMany({ select: { lotId: true, accountId: true, amount: true, qty: true, at: true } }),
  ])

  const costBySku = new Map(skus.map((sku) => [sku.id, sku.unitCost]))
  const skuLabel = new Map(
    skus.map((sku) => [
      sku.id,
      [sku.manufacturer, sku.model, sku.capacity, sku.grade].filter(Boolean).join(' '),
    ]),
  )
  const lotLabel = new Map(
    lots.map((lot) => [
      lot.id,
      [lot.manufacturer, lot.model, lot.modelNumber].filter(Boolean).join(' ') || lot.id,
    ]),
  )
  const holdByLot = new Map(holds.map((hold) => [hold.lotId, hold]))
  const gaps = new Map<string, MissingGap>()
  function addGap(row: MissingGap) {
    const current = gaps.get(row.key)
    if (!current) {
      gaps.set(row.key, { ...row })
      return
    }
    current.pcs += row.pcs
    current.amount += row.amount
  }
  const lotQty = new Map(lots.map((lot) => [lot.id, lot.qty]))
  const bidsByLot = new Map<string, typeof bids>()
  for (const bid of bids) {
    const list = bidsByLot.get(bid.lotId) || []
    list.push(bid)
    bidsByLot.set(bid.lotId, list)
  }

  let collectedGoods = 0
  let collectedFees = 0
  let owedGoods = 0
  let owedFees = 0
  let costOfGoods = 0
  let missingSales = 0
  let missingPcs = 0

  for (const inv of invoices) {
    const lines = linesOf(inv.dataJson, inv.lotId, inv.qty, inv.unitPrice)
    const goods = lines.reduce((n, line) => n + line.qty * line.unitPrice, 0)
    const fee = feeOf(inv.dataJson, goods)
    if (inv.status === 'unpaid' || inv.status === 'pending_review') {
      owedGoods += goods
      owedFees += fee
      continue
    }
    if (inv.status !== 'paid') continue
    const stamp = inv.paidAt != null ? Number(inv.paidAt) : Number(inv.createdAt)
    if (!inRange(stamp, from, to)) continue
    for (const line of lines) {
      const lineGoods = line.qty * line.unitPrice
      const lineFee = goods > 0 ? fee * (lineGoods / goods) : 0
      const hold = holdByLot.get(line.lotId)
      const unit = hold ? costBySku.get(hold.skuId) : undefined
      if (hold && unit != null && Number.isFinite(unit)) {
        collectedGoods += lineGoods
        collectedFees += lineFee
        costOfGoods += line.qty * unit
      } else {
        missingSales += lineGoods + lineFee
        missingPcs += line.qty
        if (hold) {
          addGap({
            key: `sale:${hold.skuId}`,
            skuId: hold.skuId,
            label: skuLabel.get(hold.skuId) || hold.skuId,
            kind: 'sale',
            pcs: line.qty,
            amount: lineGoods + lineFee,
          })
        } else {
          addGap({
            key: `link:${line.lotId}`,
            skuId: null,
            label: lotLabel.get(line.lotId) || line.lotId,
            kind: 'unlinked',
            pcs: line.qty,
            amount: lineGoods + lineFee,
          })
        }
      }
    }
  }

  const pools = new Map<string, { skuId: string; left: number }[]>()
  for (const move of moves) {
    const pool = pools.get(move.productId) || []
    pool.push({ skuId: move.skuId, left: move.qty })
    pools.set(move.productId, pool)
  }

  const soldOrders = orders
    .filter((order) => order.status === 'paid' || order.status === 'shipped')
    .sort((a, b) => {
      const ta = (a.paidAt ?? a.shippedAt ?? a.createdAt).getTime()
      const tb = (b.paidAt ?? b.shippedAt ?? b.createdAt).getTime()
      return ta - tb
    })

  for (const order of soldOrders) {
    const stamp = (order.paidAt ?? order.shippedAt ?? order.createdAt).getTime()
    const countIt = inRange(stamp, from, to)
    for (const line of order.lines) {
      let left = line.qty
      const pool = line.productId ? pools.get(line.productId) || [] : []
      while (left > 0 && pool.length && pool[0].left > 0) {
        const bucket = pool[0]
        const take = Math.min(left, bucket.left)
        const unit = costBySku.get(bucket.skuId)
        if (countIt) {
          const lineGoods = take * line.unitPrice
          if (unit != null && Number.isFinite(unit)) {
            collectedGoods += lineGoods
            costOfGoods += take * unit
          } else {
            missingSales += lineGoods
            missingPcs += take
            addGap({
              key: `sale:${bucket.skuId}`,
              skuId: bucket.skuId,
              label: skuLabel.get(bucket.skuId) || line.title || bucket.skuId,
              kind: 'sale',
              pcs: take,
              amount: lineGoods,
            })
          }
        }
        bucket.left -= take
        left -= take
        if (bucket.left <= 0) pool.shift()
      }
      if (countIt && left > 0) {
        missingSales += left * line.unitPrice
        missingPcs += left
        const title = line.title.trim() || 'Store item'
        addGap({
          key: `link:store:${title}`,
          skuId: null,
          label: title,
          kind: 'unlinked',
          pcs: left,
          amount: left * line.unitPrice,
        })
      }
    }
  }

  for (const order of orders) {
    if (order.status !== 'pending_payment') continue
    owedGoods += order.subtotal
  }

  let writtenOff = 0
  let missingWriteoffPcs = 0
  for (const hold of holds) {
    if (hold.decision !== 'leave' || !hold.decidedAt) continue
    if (!inRange(hold.decidedAt.getTime(), from, to)) continue
    let qty = hold.writeoffQty ?? 0
    if (!qty) {
      const lot = lotQty.get(hold.lotId) ?? hold.qty
      qty = Math.max(0, lot - wonQty(lot, bidsByLot.get(hold.lotId) || []))
    }
    const unit = costBySku.get(hold.skuId)
    if (unit != null && Number.isFinite(unit)) writtenOff += qty * unit
    else {
      missingWriteoffPcs += qty
      addGap({
        key: `off:${hold.skuId}`,
        skuId: hold.skuId,
        label: skuLabel.get(hold.skuId) || hold.skuId,
        kind: 'writeoff',
        pcs: qty,
        amount: 0,
      })
    }
  }

  let stockValue = 0
  let stockUncostedPcs = 0
  for (const sku of skus) {
    if (sku.unitCost != null && Number.isFinite(sku.unitCost)) stockValue += sku.onHand * sku.unitCost
    else stockUncostedPcs += sku.onHand
  }

  const grossProfit = collectedGoods + collectedFees - costOfGoods - writtenOff

  return {
    from,
    to,
    collectedGoods: money(collectedGoods),
    collectedFees: money(collectedFees),
    owedGoods: money(owedGoods),
    owedFees: money(owedFees),
    costOfGoods: money(costOfGoods),
    writtenOff: money(writtenOff),
    grossProfit: money(grossProfit),
    missingSales: money(missingSales),
    missingPcs,
    missingWriteoffPcs,
    stockValue: money(stockValue),
    stockUncostedPcs,
    missing: [...gaps.values()]
      .map((row) => ({ ...row, amount: money(row.amount) }))
      .sort((a, b) => b.amount - a.amount || b.pcs - a.pcs),
  }
}
