import { Hono } from 'hono'
import { z } from 'zod'
import { requireSuper, requireUser, type AuthedEnv } from '../auth'
import { readFees, writeFees } from '../feeConfig'

export const settingsRoutes = new Hono<AuthedEnv>()

settingsRoutes.use('*', requireUser, requireSuper)

settingsRoutes.get('/fees', (c) => c.json({ fees: readFees() }))

settingsRoutes.put('/fees', async (c) => {
  const body = z
    .object({
      marketplaceFeePct: z.number().min(0).optional(),
      invoiceFeePct: z.number().min(0).optional(),
      auctionTypeFees: z.record(z.string(), z.number().min(0)).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid fee config.' }, 400)
  const cur = readFees()
  const next = writeFees({
    marketplaceFeePct: body.data.marketplaceFeePct ?? cur.marketplaceFeePct,
    invoiceFeePct: body.data.invoiceFeePct ?? cur.invoiceFeePct,
    auctionTypeFees: body.data.auctionTypeFees ?? cur.auctionTypeFees,
  })
  return c.json({ fees: next })
})
