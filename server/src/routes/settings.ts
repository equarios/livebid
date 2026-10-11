import { Hono } from 'hono'
import { z } from 'zod'
import { requireSuper, requireUser, type AuthedEnv } from '../auth'
import { MAX_BRAND_LOGO_BYTES, processAndSaveBrandLogo } from '../brandImages'
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

/** Brand logo — strips flat white/black fills, keeps transparency. */
settingsRoutes.post('/brand-logo', async (c) => {
  const body = await c.req.parseBody()
  const raw = body['file'] ?? body['logo']
  const file = typeof raw === 'object' && raw !== null && 'arrayBuffer' in raw ? (raw as File) : null
  if (!file) return c.json({ error: 'Choose a logo image file.' }, 400)
  if (file.size > MAX_BRAND_LOGO_BYTES) {
    return c.json({ error: 'Logo must be under 8 MB.' }, 400)
  }
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const url = await processAndSaveBrandLogo(buf, file.type || 'application/octet-stream')
    return c.json({ url })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Logo processing failed.' }, 400)
  }
})
