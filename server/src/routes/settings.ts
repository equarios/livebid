import { Hono } from 'hono'
import { z } from 'zod'
import { requireSuper, requireUser, type AuthedEnv } from '../auth'
import { MAX_BRAND_LOGO_BYTES, processAndSaveBrandLogo } from '../brandImages'
import { readFees, writeFees } from '../feeConfig'
import { normalizeFulfillment } from '../fulfillment'
import { readStorePricing, writeStorePricing } from '../storePricing'

export const settingsRoutes = new Hono<AuthedEnv>()

settingsRoutes.use('*', requireUser, requireSuper)

settingsRoutes.get('/fees', (c) => c.json({ fees: readFees() }))

const fulfillmentSchema = z
  .object({
    storeModes: z.array(z.enum(['pickup', 'delivery', 'buyer_courier'])).optional(),
    wholesaleModes: z.array(z.enum(['pickup', 'delivery', 'buyer_courier'])).optional(),
    defaultStoreMode: z.enum(['pickup', 'delivery', 'buyer_courier']).optional(),
    defaultWholesaleMode: z.enum(['pickup', 'delivery', 'buyer_courier']).optional(),
    deliveryFeeFlat: z.number().min(0).optional(),
    freeDeliveryMin: z.number().min(0).optional(),
    deliveryPayer: z.enum(['buyer', 'seller', 'platform', 'admin_decide']).optional(),
    pickupLabel: z.string().max(120).optional(),
    pickupHours: z.string().max(120).optional(),
    courierHints: z.string().max(160).optional(),
    pickupSlots: z.array(z.string().max(40)).max(12).optional(),
    pickupLeadDays: z.number().int().min(0).max(14).optional(),
    pickupSlotCap: z.number().int().min(0).max(200).optional(),
  })
  .optional()

settingsRoutes.put('/fees', async (c) => {
  const body = z
    .object({
      marketplaceFeePct: z.number().min(0).optional(),
      invoiceFeePct: z.number().min(0).optional(),
      offerFloorPct: z.number().min(0).max(100).optional(),
      auctionTypeFees: z.record(z.string(), z.number().min(0)).optional(),
      fulfillment: fulfillmentSchema,
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid fee config.' }, 400)
  const cur = readFees()
  const next = writeFees({
    marketplaceFeePct: body.data.marketplaceFeePct ?? cur.marketplaceFeePct,
    invoiceFeePct: body.data.invoiceFeePct ?? cur.invoiceFeePct,
    offerFloorPct: body.data.offerFloorPct ?? cur.offerFloorPct,
    auctionTypeFees: body.data.auctionTypeFees ?? cur.auctionTypeFees,
    fulfillment: body.data.fulfillment
      ? normalizeFulfillment({ ...cur.fulfillment, ...body.data.fulfillment })
      : cur.fulfillment,
  })
  return c.json({ fees: next })
})

/** Store tax + promo codes (super admin). */
settingsRoutes.get('/store-pricing', (c) => c.json({ pricing: readStorePricing() }))

settingsRoutes.put('/store-pricing', async (c) => {
  const body = z
    .object({
      taxMode: z.enum(['none', 'inclusive', 'exclusive']).optional(),
      taxLabel: z.string().max(24).optional(),
      taxRatePct: z.number().min(0).max(100).optional(),
      promos: z
        .array(
          z.object({
            code: z.string().min(1).max(24),
            pctOff: z.number().min(0).max(100),
            minSubtotal: z.number().min(0).optional(),
            expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
            active: z.boolean().optional(),
          }),
        )
        .max(50)
        .optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid tax or promo config.' }, 400)
  const cur = readStorePricing()
  const next = writeStorePricing({
    taxMode: body.data.taxMode ?? cur.taxMode,
    taxLabel: body.data.taxLabel ?? cur.taxLabel,
    taxRatePct: body.data.taxRatePct ?? cur.taxRatePct,
    promos:
      body.data.promos !== undefined
        ? body.data.promos.map((p) => ({
            code: p.code,
            pctOff: p.pctOff,
            minSubtotal: p.minSubtotal ?? 0,
            expiresAt: p.expiresAt ?? null,
            active: p.active !== false,
          }))
        : cur.promos,
  })
  return c.json({ pricing: next })
})

/** Brand logo — strips flat white/black fills, keeps transparency. */settingsRoutes.post('/brand-logo', async (c) => {
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
