import { Hono } from 'hono'
import { z } from 'zod'
import { requireStaff, requireUser, type AuthedEnv } from '../auth'
import { computeExtraSealedEndsAt } from '../auctionPhase'
import { prisma } from '../db'
import { mapLot, mapSku } from '../map'
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

/** Staff publish: create/update lots so the API desk matches Super confirm. */
catalogRoutes.post('/lots/batch', requireUser, requireStaff, async (c) => {
  const body = z
    .object({ lots: z.array(lotUpsertSchema).min(1).max(500) })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid lot batch.' }, 400)

  const saved = []
  const rawLots = []
  for (const row of body.data.lots) {
    const data = {
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
        row.extraSealedEndsAt != null && row.extraSealedEndsAt > 0
          ? BigInt(row.extraSealedEndsAt)
          : null,
      description: row.description,
      accent: row.accent || '#2a6f7c',
      operator: row.operator ?? null,
      simLocked: row.simLocked ?? null,
      activationLocked: row.activationLocked ?? null,
      origin: row.origin ?? null,
    }
    const lot = await prisma.lot.upsert({
      where: { id: row.id },
      create: { id: row.id, bidCount: 0, ...data },
      update: data,
    })
    rawLots.push(lot)
    saved.push(mapLot(lot))
  }
  void notifyWatchersForLots(rawLots).catch(() => undefined)
  return c.json({ ok: true, lots: saved, count: saved.length })
})

catalogRoutes.get('/lots/:id', requireUser, async (c) => {
  const lot = await prisma.lot.findUnique({ where: { id: c.req.param('id') } })
  if (!lot) return c.json({ error: 'Lot not found.' }, 404)
  return c.json({ lot: mapLot(lot) })
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
      origin: body.data.origin,
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
      origin: body.data.origin,
      description: body.data.description,
      operator: body.data.operator,
      defaultMoq: body.data.defaultMoq,
      lastPrice: body.data.lastPrice,
      onHand,
    },
  })
  return c.json({ sku: mapSku(sku) })
})
