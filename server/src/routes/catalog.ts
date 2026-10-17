import { Hono } from 'hono'
import { z } from 'zod'
import { optionalUser, requireStaff, requireUser, type AuthedEnv } from '../auth'
import { computeExtraSealedEndsAt, effectiveEndsAtMs } from '../auctionPhase'
import { prisma } from '../db'
import { mapLot, mapSku } from '../map'
import { normalizeOrigin } from '../origins'
import { findPriceComps } from '../priceComps'
import { notifyWatchersForLots } from '../watchFilters'

export const catalogRoutes = new Hono<AuthedEnv>()

/** Push shared list clock (+ optional Extra sealed) onto all lots of an auction type. */
catalogRoutes.post('/auction-clocks', requireUser, requireStaff, async (c) => {
  const body = z
    .object({
      auctionType: z.string().min(1),
      closesAt: z.number().positive(),
      extraSealedMinutes: z.number().int().nonnegative().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid auction clock.' }, 400)

  const slug = body.data.auctionType.trim()
  const closesAt = Math.floor(body.data.closesAt)
  const extra = computeExtraSealedEndsAt(closesAt, body.data.extraSealedMinutes)
  const result = await prisma.lot.updateMany({
    where: { channel: 'auction', auctionType: slug },
    data: {
      endsAt: BigInt(closesAt),
      extraSealedEndsAt: extra != null ? BigInt(extra) : null,
    },
  })
  return c.json({ ok: true, updated: result.count, closesAt, extraSealedEndsAt: extra })
})

catalogRoutes.get('/lots', requireUser, async (c) => {
  const channel = c.req.query('channel')
  const lots = await prisma.lot.findMany({
    where: channel ? { channel } : undefined,
    orderBy: { id: 'asc' },
  })
  return c.json({ lots: lots.map(mapLot) })
})

const lotUpsertSchema = z.object({
  id: z.string().min(1),
  channel: z.enum(['auction', 'marketplace']),
  auctionType: z.string().nullable().optional(),
  manufacturer: z.string(),
  model: z.string(),
  modelNumber: z.string(),
  capacity: z.string(),
  color: z.string(),
  grade: z.string(),
  battery: z.number().int(),
  qty: z.number().int().nonnegative(),
  moq: z.number().int().positive().nullable().optional(),
  startPrice: z.number().nonnegative(),
  currentPrice: z.number().nonnegative(),
  buyNowPrice: z.number().nonnegative().nullable().optional(),
  endsAt: z.number().positive(),
  extraSealedEndsAt: z.number().positive().nullable().optional(),
  description: z.string(),
  accent: z.string().optional(),
  operator: z.string().nullable().optional(),
  simLocked: z.boolean().nullable().optional(),
  activationLocked: z.boolean().nullable().optional(),
  origin: z.string().nullable().optional(),
})

type SkuMatch = {
  id: string
  manufacturer: string
  model: string
  modelNumber: string
  capacity: string
  color: string
  grade: string
  origin: string
  simLocked: boolean | null
  activationLocked: boolean | null
  onHand: number
}

function sameWarehouseItem(sku: SkuMatch, row: z.infer<typeof lotUpsertSchema>) {
  const text = (value: string) => value.trim().toLowerCase()
  return (
    text(sku.manufacturer) === text(row.manufacturer) &&
    text(sku.model) === text(row.model) &&
    text(sku.modelNumber) === text(row.modelNumber) &&
    text(sku.capacity) === text(row.capacity) &&
    text(sku.color) === text(row.color) &&
    text(sku.grade) === text(row.grade) &&
    normalizeOrigin(sku.origin) === normalizeOrigin(row.origin) &&
    Boolean(sku.simLocked) === Boolean(row.simLocked) &&
    Boolean(sku.activationLocked) === Boolean(row.activationLocked)
  )
}

function lotWrite(row: z.infer<typeof lotUpsertSchema>) {
  return {
    channel: row.channel,
    auctionType: row.channel === 'auction' ? row.auctionType || 'live' : null,
    manufacturer: row.manufacturer,
    model: row.model,
    modelNumber: row.modelNumber,
    capacity: row.capacity,
    color: row.color,
    grade: row.grade,
    battery: row.battery,
    qty: row.qty,
    moq: row.moq ?? null,
    startPrice: row.startPrice,
    currentPrice: row.currentPrice,
    buyNowPrice: row.buyNowPrice ?? null,
    endsAt: BigInt(row.endsAt),
    extraSealedEndsAt:
      row.extraSealedEndsAt != null && row.extraSealedEndsAt > 0 ? BigInt(row.extraSealedEndsAt) : null,
    description: row.description,
    accent: row.accent || '#2a6f7c',
    operator: row.operator ?? null,
    simLocked: row.simLocked ?? null,
    activationLocked: row.activationLocked ?? null,
    origin: row.origin != null ? normalizeOrigin(row.origin) : null,
  }
}

function wonQty(
  lotQty: number,
  bids: { accountId: string; amount: number; qty: number; at: bigint }[],
) {
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
    const qty = Math.min(bid.qty, left)
    won += qty
    left -= qty
  }
  return won
}

/** Staff publish: create/update lots so the API desk matches Super confirm. New lots take warehouse stock. */
catalogRoutes.post('/lots/batch', requireUser, requireStaff, async (c) => {
  const body = z
    .object({ lots: z.array(lotUpsertSchema).min(1).max(500) })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid lot batch.' }, 400)

  const ids = body.data.lots.map((row) => row.id)
  const existing = await prisma.lot.findMany({ where: { id: { in: ids } }, select: { id: true } })
  const existingIds = new Set(existing.map((row) => row.id))
  const fresh = body.data.lots.filter((row) => !existingIds.has(row.id) && row.qty > 0)
  const skus = fresh.length ? await prisma.inventorySku.findMany() : []
  const take = new Map<string, number>()
  for (const row of fresh) {
    const sku = skus.find((item) => sameWarehouseItem(item, row))
    const name = `${row.manufacturer} ${row.model}`.trim()
    if (!sku) return c.json({ error: `No warehouse item matches ${name}.` }, 400)
    take.set(sku.id, (take.get(sku.id) || 0) + row.qty)
  }
  for (const [skuId, qty] of take) {
    const sku = skus.find((item) => item.id === skuId)
    if (!sku || qty > sku.onHand) {
      const name = sku ? `${sku.manufacturer} ${sku.model}`.trim() : 'that item'
      return c.json({ error: `Only ${sku?.onHand ?? 0} on hand for ${name}. This list needs ${qty}.` }, 400)
    }
  }

  let saved: ReturnType<typeof mapLot>[] = []
  let rawLots: Awaited<ReturnType<typeof prisma.lot.findMany>> = []
  try {
    const published = await prisma.$transaction(async (tx) => {
      for (const [skuId, qty] of take) {
        const taken = await tx.inventorySku.updateMany({
          where: { id: skuId, onHand: { gte: qty } },
          data: { onHand: { decrement: qty } },
        })
        if (!taken.count) throw new Error('Those pieces are no longer on hand.')
      }
      const written = []
      for (const row of body.data.lots) {
        const data = lotWrite(row)
        const lot = await tx.lot.upsert({
          where: { id: row.id },
          create: { id: row.id, bidCount: 0, ...data },
          update: data,
        })
        if (!existingIds.has(row.id) && row.qty > 0) {
          const sku = skus.find((item) => sameWarehouseItem(item, row))
          if (!sku) throw new Error(`No warehouse item matches ${row.manufacturer} ${row.model}.`)
          await tx.stockHold.create({ data: { lotId: lot.id, skuId: sku.id, qty: row.qty } })
        }
        written.push(lot)
      }
      return written
    })
    rawLots = published
    saved = published.map(mapLot)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not take stock for this list.'
    return c.json({ error: message }, 400)
  }
  void notifyWatchersForLots(rawLots).catch(() => undefined)
  return c.json({ ok: true, lots: saved, count: saved.length })
})

catalogRoutes.get('/lots/:id', requireUser, async (c) => {
  const lot = await prisma.lot.findUnique({ where: { id: c.req.param('id') } })
  if (!lot) return c.json({ error: 'Lot not found.' }, 404)
  return c.json({ lot: mapLot(lot) })
})

/** Last comparable sold / clearing prices (same type + model). */
catalogRoutes.get('/lots/:id/comps', optionalUser, async (c) => {
  const id = (c.req.param('id') || '').trim()
  if (!id) return c.json({ error: 'Lot required.' }, 400)
  const result = await findPriceComps(id)
  if (!result) return c.json({ error: 'Lot not found.' }, 404)
  return c.json(result)
})

catalogRoutes.put('/lots/:id', requireUser, requireStaff, async (c) => {
  const body = z
    .object({
      qty: z.number().int().nonnegative().optional(),
      currentPrice: z.number().nonnegative().optional(),
      buyNowPrice: z.number().nonnegative().nullable().optional(),
      endsAt: z.number().optional(),
      moq: z.number().int().positive().nullable().optional(),
      description: z.string().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid lot update.' }, 400)

  const existing = await prisma.lot.findUnique({ where: { id: c.req.param('id') } })
  if (!existing) return c.json({ error: 'Lot not found.' }, 404)

  const lot = await prisma.lot.update({
    where: { id: existing.id },
    data: {
      qty: body.data.qty ?? undefined,
      currentPrice: body.data.currentPrice ?? undefined,
      buyNowPrice:
        body.data.buyNowPrice === undefined ? undefined : body.data.buyNowPrice,
      endsAt: body.data.endsAt != null ? BigInt(body.data.endsAt) : undefined,
      moq: body.data.moq === undefined ? undefined : body.data.moq,
      description: body.data.description ?? undefined,
    },
  })
  return c.json({ lot: mapLot(lot) })
})

catalogRoutes.post('/inventory/:id/to-store', requireUser, requireStaff, async (c) => {
  const body = z
    .object({
      qty: z.number().int().positive(),
      price: z.number().positive(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Enter a whole quantity and a store price.' }, 400)

  const sku = await prisma.inventorySku.findUnique({ where: { id: c.req.param('id') } })
  if (!sku) return c.json({ error: 'That warehouse item is not saved yet.' }, 404)
  if (body.data.qty > sku.onHand) {
    return c.json({ error: `Only ${sku.onHand} pcs are on hand.` }, 400)
  }
  const listed = await prisma.lot.findMany({
    where: {
      manufacturer: sku.manufacturer,
      model: sku.model,
      capacity: sku.capacity,
      grade: sku.grade,
      OR: [{ channel: 'marketplace' }, { channel: 'auction', endsAt: { gt: BigInt(Date.now()) } }],
    },
    select: { id: true, qty: true },
  })
  const held = new Set(
    (
      await prisma.stockHold.findMany({
        where: { lotId: { in: listed.map((lot) => lot.id) } },
        select: { lotId: true },
      })
    ).map((row) => row.lotId),
  )
  const listedQty = listed.filter((lot) => !held.has(lot.id)).reduce((sum, lot) => sum + lot.qty, 0)
  const free = Math.max(0, sku.onHand - listedQty)
  if (body.data.qty > free) {
    return c.json(
      { error: `Only ${free} pcs are free. ${listedQty} are still on a wholesale list.` },
      400,
    )
  }

  const products = await prisma.storeProduct.findMany()
  const match = products.find(
    (p) =>
      p.brand.trim().toLowerCase() === sku.manufacturer.trim().toLowerCase() &&
      p.modelNumber === sku.modelNumber &&
      p.capacity === sku.capacity &&
      p.grade === sku.grade,
  )

  const result = await prisma.$transaction(async (tx) => {
    const taken = await tx.inventorySku.updateMany({
      where: { id: sku.id, onHand: { gte: body.data.qty } },
      data: { onHand: { decrement: body.data.qty } },
    })
    if (!taken.count) throw new Error('Those pieces are no longer on hand.')
    const product = match
      ? await tx.storeProduct.update({
          where: { id: match.id },
          data: { stock: { increment: body.data.qty }, price: body.data.price, active: true },
        })
      : await tx.storeProduct.create({
          data: {
            title: `${sku.manufacturer} ${sku.model}`.trim(),
            slug: `${sku.manufacturer}-${sku.model}-${sku.modelNumber || sku.id}`
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')
              .slice(0, 80),
            description: sku.description || '',
            price: body.data.price,
            stock: body.data.qty,
            brand: sku.manufacturer,
            modelNumber: sku.modelNumber,
            capacity: sku.capacity,
            color: sku.color,
            grade: sku.grade,
            battery: sku.battery,
            origin: sku.origin || 'INT',
            simLocked: sku.simLocked ?? false,
            activationLocked: sku.activationLocked ?? false,
            active: true,
          },
        })
    await tx.stockMove.create({
      data: { skuId: sku.id, productId: product.id, qty: body.data.qty },
    })
    const next = await tx.inventorySku.findUnique({ where: { id: sku.id } })
    return { onHand: next?.onHand ?? 0, productId: product.id, stock: product.stock }
  })

  return c.json(result)
})

catalogRoutes.get('/returns', requireUser, requireStaff, async (c) => {
  const holds = await prisma.stockHold.findMany({ where: { decision: null } })
  if (!holds.length) return c.json({ returns: [] })
  const lots = await prisma.lot.findMany({ where: { id: { in: holds.map((row) => row.lotId) } } })
  const lotById = new Map(lots.map((lot) => [lot.id, lot]))
  const now = Date.now()
  const closed = lots.filter(
    (lot) => lot.channel === 'auction' && effectiveEndsAtMs(lot) <= now,
  )
  const bids = closed.length
    ? await prisma.bid.findMany({
        where: { lotId: { in: closed.map((lot) => lot.id) } },
        select: { lotId: true, accountId: true, amount: true, qty: true, at: true },
      })
    : []
  const returns = []
  for (const hold of holds) {
    const lot = lotById.get(hold.lotId)
    if (!lot || lot.channel !== 'auction' || effectiveEndsAtMs(lot) > now) continue
    const won = wonQty(
      lot.qty,
      bids.filter((bid) => bid.lotId === lot.id),
    )
    const leftover = Math.max(0, lot.qty - won)
    if (leftover < 1) continue
    returns.push({
      lotId: lot.id,
      skuId: hold.skuId,
      model: `${lot.manufacturer} ${lot.model}${lot.modelNumber ? ` ${lot.modelNumber}` : ''}`.trim(),
      leftover,
    })
  }
  return c.json({ returns })
})

catalogRoutes.post('/returns', requireUser, requireStaff, async (c) => {
  const body = z
    .object({
      lotId: z.string().min(1),
      decision: z.enum(['return', 'leave']),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Choose return or leave out.' }, 400)

  const hold = await prisma.stockHold.findUnique({ where: { lotId: body.data.lotId } })
  if (!hold) return c.json({ error: 'That lot never took warehouse stock.' }, 404)
  if (hold.decision) return c.json({ error: 'That leftover was already decided.' }, 400)
  const lot = await prisma.lot.findUnique({ where: { id: hold.lotId } })
  if (!lot || lot.channel !== 'auction') return c.json({ error: 'That lot is not a closed auction.' }, 400)
  if (effectiveEndsAtMs(lot) > Date.now()) return c.json({ error: 'That auction is still open.' }, 400)
  const bids = await prisma.bid.findMany({
    where: { lotId: lot.id },
    select: { accountId: true, amount: true, qty: true, at: true },
  })
  const leftover = Math.max(0, lot.qty - wonQty(lot.qty, bids))
  if (leftover < 1) return c.json({ error: 'That lot has no leftover pieces.' }, 400)

  const decision = body.data.decision
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.stockHold.updateMany({
      where: { lotId: hold.lotId, decision: null },
      data: { decision, decidedAt: new Date() },
    })
    if (!claimed.count) throw new Error('That leftover was already decided.')
    switch (decision) {
      case 'return': {
        await tx.inventorySku.update({
          where: { id: hold.skuId },
          data: { onHand: { increment: leftover } },
        })
        break
      }
      case 'leave':
        break
      default: {
        const unreachable: never = decision
        throw new Error(unreachable)
      }
    }
    const sku = await tx.inventorySku.findUnique({ where: { id: hold.skuId } })
    return { onHand: sku?.onHand ?? 0, leftover }
  })
  return c.json(result)
})

catalogRoutes.get('/inventory', requireUser, requireStaff, async (c) => {
  const rows = await prisma.inventorySku.findMany({ orderBy: { id: 'asc' } })
  return c.json({ inventory: rows.map(mapSku) })
})

catalogRoutes.post('/inventory', requireUser, requireStaff, async (c) => {
  const body = z
    .object({
      id: z.string().min(1),
      manufacturer: z.string(),
      model: z.string(),
      modelNumber: z.string(),
      capacity: z.string(),
      color: z.string(),
      grade: z.string(),
      battery: z.number().int(),
      origin: z.string().default(''),
      description: z.string(),
      operator: z.string().optional(),
      defaultMoq: z.number().int().optional(),
      lastPrice: z.number().optional(),
      onHand: z.number().int().nonnegative().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid SKU.' }, 400)

  const onHand = body.data.onHand ?? 0
  const origin = normalizeOrigin(body.data.origin)
  const sku = await prisma.inventorySku.upsert({
    where: { id: body.data.id },
    create: {
      id: body.data.id,
      manufacturer: body.data.manufacturer,
      model: body.data.model,
      modelNumber: body.data.modelNumber,
      capacity: body.data.capacity,
      color: body.data.color,
      grade: body.data.grade,
      battery: body.data.battery,
      origin,
      description: body.data.description,
      operator: body.data.operator,
      defaultMoq: body.data.defaultMoq,
      lastPrice: body.data.lastPrice,
      onHand,
    },
    update: {
      manufacturer: body.data.manufacturer,
      model: body.data.model,
      modelNumber: body.data.modelNumber,
      capacity: body.data.capacity,
      color: body.data.color,
      grade: body.data.grade,
      battery: body.data.battery,
      origin,
      description: body.data.description,
      operator: body.data.operator,
      defaultMoq: body.data.defaultMoq,
      lastPrice: body.data.lastPrice,
      onHand,
    },
  })
  return c.json({ sku: mapSku(sku) })
})
