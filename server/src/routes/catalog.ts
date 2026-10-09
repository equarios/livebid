import { Hono } from 'hono'
import { z } from 'zod'
import { requireStaff, requireUser, type AuthedEnv } from '../auth'
import { prisma } from '../db'
import { mapLot, mapSku } from '../map'

export const catalogRoutes = new Hono<AuthedEnv>()

catalogRoutes.get('/lots', requireUser, async (c) => {
  const channel = c.req.query('channel')
  const lots = await prisma.lot.findMany({
    where: channel ? { channel } : undefined,
    orderBy: { id: 'asc' },
  })
  return c.json({ lots: lots.map(mapLot) })
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
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid SKU.' }, 400)

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
    },
  })
  return c.json({ sku: mapSku(sku) })
})
