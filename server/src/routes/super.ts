import { Hono } from 'hono'
import { z } from 'zod'
import { requireSuper, requireUser, type AuthedEnv } from '../auth'
import { companyResult, resultWindow, type ResultPreset } from '../companyResult'
import { prisma } from '../db'

export const superRoutes = new Hono<AuthedEnv>()

superRoutes.use('*', requireUser, requireSuper)

const PRESETS = new Set<ResultPreset>(['today', 'days7', 'month', 'quarter', 'year', 'lastyear', 'all', 'custom'])

superRoutes.get('/result', async (c) => {
  const preset = (c.req.query('preset') || 'month') as ResultPreset
  if (!PRESETS.has(preset)) return c.json({ error: 'Unknown range.' }, 400)
  const window = resultWindow(preset, Date.now(), c.req.query('from'), c.req.query('to'))
  if (!window) return c.json({ error: 'Choose a from and to date.' }, 400)
  return c.json(await companyResult(window.from, window.to))
})

superRoutes.get('/costs', async (c) => {
  const rows = await prisma.inventorySku.findMany({ orderBy: { id: 'asc' } })
  return c.json({
    skus: rows.map((sku) => ({
      id: sku.id,
      model: `${sku.manufacturer} ${sku.model}`.trim(),
      spec: [sku.capacity, sku.grade, sku.color].filter(Boolean).join(' · '),
      onHand: sku.onHand,
      unitCost: sku.unitCost,
    })),
  })
})

superRoutes.patch('/costs/:id', async (c) => {
  const id = c.req.param('id')
  const body = z
    .object({ unitCost: z.number().nonnegative().nullable() })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Enter a cost of zero or more, or clear it.' }, 400)
  const existing = await prisma.inventorySku.findUnique({ where: { id } })
  if (!existing) return c.json({ error: 'Device not found.' }, 404)
  const sku = await prisma.inventorySku.update({
    where: { id },
    data: { unitCost: body.data.unitCost },
  })
  return c.json({ id: sku.id, unitCost: sku.unitCost })
})
