import { Hono } from 'hono'
import { z } from 'zod'
import { requireStaff, requireUser, requireWholesale, type AuthedEnv } from '../auth'
import { feeForMarketplace, withFee } from '../feeConfig'
import { myPcs } from '../allocate'
import { prisma } from '../db'
import { mapLotRow } from '../lotDto'
import {
  mapBid,
  mapCartItem,
  mapCartOrder,
  mapInvoice,
  mapOffer,
  mapWatch,
  mapNotice,
} from '../map'
import { cacheSet } from '../cache'
import { getIdempotentJson, setIdempotentJson } from '../idempotency'
import { trackBid } from '../metrics'
import { notify, notifyStaff } from '../notify'
import { rateLimitOrRetryAfter } from '../rateLimit'
import { broadcastLotTick } from '../realtime'

export const commerceRoutes = new Hono<AuthedEnv>()

const BOOT_LOT_CAP = 800
const BOOT_BID_CAP = 4000
const PAGE_MAX = 200

function clampLimit(raw: string | undefined, fallback: number) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(PAGE_MAX, Math.floor(n))
}

/** Active desk lots: open auctions + marketplace listings. */
function activeLotWhere(now: bigint) {
  return {
    OR: [{ channel: 'marketplace' as const }, { channel: 'auction' as const, endsAt: { gt: now } }],
  }
}

commerceRoutes.get('/bootstrap', requireUser, async (c) => {
  const user = c.get('user')
  const staff = user.role === 'admin' || user.role === 'superadmin'
  const wholesaleOk = staff || user.wholesaleStatus === 'approved'
  const now = BigInt(Date.now())

  const [lots, lotsTotal, cartItems, cartOrders, offers, invoices, watch, notices, accounts, inventory] =
    await Promise.all([
      wholesaleOk
        ? prisma.lot.findMany({
            where: activeLotWhere(now),
            orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
            take: BOOT_LOT_CAP,
          })
        : Promise.resolve([]),
      wholesaleOk ? prisma.lot.count({ where: activeLotWhere(now) }) : Promise.resolve(0),
      prisma.cartItem.findMany({ where: { accountId: user.accountId } }),
      staff
        ? prisma.cartOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
        : prisma.cartOrder.findMany({
            where: { accountId: user.accountId },
            orderBy: { createdAt: 'desc' },
            take: 100,
          }),
      staff
        ? prisma.marketOffer.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
        : prisma.marketOffer.findMany({
            where: { accountId: user.accountId },
            orderBy: { createdAt: 'desc' },
            take: 100,
          }),
      staff
        ? prisma.invoice.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
        : prisma.invoice.findMany({
            where: { accountId: user.accountId },
            orderBy: { createdAt: 'desc' },
            take: 100,
          }),
      prisma.watchItem.findMany({ where: { accountId: user.accountId } }),
      prisma.notice.findMany({
        where: { accountId: user.accountId },
        orderBy: { at: 'desc' },
        take: 100,
      }),
      staff ? prisma.account.findMany({ orderBy: { accountId: 'asc' }, take: 500 }) : Promise.resolve([]),
      staff ? prisma.inventorySku.findMany({ orderBy: { id: 'asc' }, take: 2000 }) : Promise.resolve([]),
    ])

  const lotIds = lots.map((l) => l.id)
  const [bids, bidsTotal] = wholesaleOk
    ? await Promise.all([
        lotIds.length
          ? prisma.bid.findMany({
              where: { lotId: { in: lotIds } },
              orderBy: { at: 'desc' },
              take: BOOT_BID_CAP,
            })
          : Promise.resolve([]),
        lotIds.length
          ? prisma.bid.count({ where: { lotId: { in: lotIds } } })
          : Promise.resolve(0),
      ])
    : [[], 0]

  const lotsNextCursor =
    lots.length === BOOT_LOT_CAP && lotsTotal > lots.length ? lots[lots.length - 1]?.id : null

  return c.json({
    lots: lots.map(mapLotRow),
    bids: bids.map(mapBid),
    cart: cartItems.map(mapCartItem),
    cartOrders: cartOrders.map(mapCartOrder),
    offers: offers.map(mapOffer),
    invoices: invoices.map(mapInvoice),
    watchlist: watch.map(mapWatch),
    notices: notices.map(mapNotice),
    accounts: accounts.map((a) => ({
      accountId: a.accountId,
      company: a.company,
      email: a.email,
      firstName: a.firstName || undefined,
      lastName: a.lastName || undefined,
      address: a.address ?? undefined,
      phone: a.phone ?? undefined,
      buyerNumber: a.buyerNumber ?? undefined,
      role: a.role,
      status: a.status,
      emailVerified: a.emailVerified,
      wholesaleStatus: a.wholesaleStatus,
      password: '', // client shape compat; never real hash
    })),
    inventory: inventory.map((s) => ({
      id: s.id,
      manufacturer: s.manufacturer,
      model: s.model,
      modelNumber: s.modelNumber,
      capacity: s.capacity,
      color: s.color,
      grade: s.grade,
      battery: s.battery,
      origin: s.origin,
      operator: s.operator ?? undefined,
      simLocked: s.simLocked ?? undefined,
      activationLocked: s.activationLocked ?? undefined,
      description: s.description,
      defaultMoq: s.defaultMoq ?? undefined,
      lastPrice: s.lastPrice ?? undefined,
    })),
    meta: {
      lotsTotal,
      lotsReturned: lots.length,
      lotsHasMore: lotsTotal > lots.length,
      lotsNextCursor,
      bidsTotal,
      bidsReturned: bids.length,
      bidsHasMore: bidsTotal > bids.length,
    },
  })
})

/** Paginated active lots (cursor = last lot id). */
commerceRoutes.get('/lots', requireUser, requireWholesale, async (c) => {
  const limit = clampLimit(c.req.query('limit'), 100)
  const cursor = c.req.query('cursor')?.trim() || null
  const now = BigInt(Date.now())
  const rows = await prisma.lot.findMany({
    where: activeLotWhere(now),
    orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
  })
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  return c.json({
    lots: page.map(mapLotRow),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  })
})

/** Paginated bids for one lot or recent desk-wide. */
commerceRoutes.get('/bids', requireUser, requireWholesale, async (c) => {
  const limit = clampLimit(c.req.query('limit'), 100)
  const cursor = c.req.query('cursor')?.trim() || null
  const lotId = c.req.query('lotId')?.trim()
  const rows = await prisma.bid.findMany({
    where: lotId ? { lotId } : undefined,
    orderBy: [{ at: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
  })
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  return c.json({
    bids: page.map(mapBid),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  })
})

commerceRoutes.post('/bids', requireUser, requireWholesale, async (c) => {
  const user = c.get('user')
  const body = z
    .object({
      lotId: z.string(),
      amount: z.number().positive(),
      qty: z.number().int().positive(),
      idempotencyKey: z.string().min(8).max(80).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid bid.' }, 400)

  const idemKey =
    body.data.idempotencyKey?.trim() ||
    c.req.header('Idempotency-Key')?.trim() ||
    ''
  if (idemKey) {
    const cached = await getIdempotentJson<{ bid: unknown; lot?: unknown }>('bid', `${user.accountId}:${idemKey}`)
    if (cached) return c.json(cached)
  }

  const retryAfter = await rateLimitOrRetryAfter(`bid:${user.accountId}`, 40, 60)
  if (retryAfter != null) {
    trackBid(false)
    c.header('Retry-After', String(retryAfter))
    return c.json({ error: 'Too many bids. Slow down and try again.' }, 429)
  }

  type BidRow = {
    lotId: string
    accountId: string
    amount: number
    qty: number
    at: number
  }
  type LotMeta = {
    id: string
    qty: number
    manufacturer: string
    model: string
    auctionType: string | null
    currentPrice: number
    bidCount: number
  }

  let priorFill = new Map<string, number>()
  let priorRows: BidRow[] = []

  let result: { bid: Awaited<ReturnType<typeof prisma.bid.create>>; lotMeta: LotMeta }
  try {
    result = await prisma.$transaction(async (tx) => {
      const lot = await tx.lot.findUnique({ where: { id: body.data.lotId } })
      if (!lot || lot.channel !== 'auction') throw new Error('LOT_NOT_FOUND')
      if (Number(lot.endsAt) <= Date.now()) throw new Error('AUCTION_CLOSED')
      if (body.data.qty > lot.qty) throw new Error('QTY')
      if (lot.moq && body.data.qty < lot.moq) throw new Error(`MOQ:${lot.moq}`)
      if (body.data.amount < lot.currentPrice) throw new Error(`MIN:${lot.currentPrice}`)

      const priorBids = await tx.bid.findMany({ where: { lotId: lot.id } })
      priorRows = priorBids.map((b) => ({
        lotId: b.lotId,
        accountId: b.accountId,
        amount: b.amount,
        qty: b.qty,
        at: Number(b.at),
      }))
      priorFill = new Map<string, number>()
      for (const accountId of new Set(priorRows.map((b) => b.accountId))) {
        priorFill.set(accountId, myPcs({ id: lot.id, qty: lot.qty }, priorRows, accountId))
      }

      const at = BigInt(Date.now())
      const created = await tx.bid.create({
        data: {
          lotId: lot.id,
          accountId: user.accountId,
          amount: body.data.amount,
          qty: body.data.qty,
          at,
        },
      })
      const nextPrice = Math.max(lot.currentPrice, body.data.amount)
      const updated = await tx.lot.update({
        where: { id: lot.id },
        data: {
          currentPrice: nextPrice,
          bidCount: { increment: 1 },
        },
      })
      return {
        bid: created,
        lotMeta: {
          id: lot.id,
          qty: lot.qty,
          manufacturer: lot.manufacturer,
          model: lot.model,
          auctionType: lot.auctionType,
          currentPrice: updated.currentPrice,
          bidCount: updated.bidCount,
        },
      }
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (
      msg === 'LOT_NOT_FOUND' ||
      msg === 'AUCTION_CLOSED' ||
      msg === 'QTY' ||
      msg.startsWith('MOQ:') ||
      msg.startsWith('MIN:')
    ) {
      trackBid(false)
    }
    if (msg === 'LOT_NOT_FOUND') return c.json({ error: 'Lot not found.' }, 404)
    if (msg === 'AUCTION_CLOSED') return c.json({ error: 'Auction closed.' }, 400)
    if (msg === 'QTY') return c.json({ error: 'Qty exceeds available.' }, 400)
    if (msg.startsWith('MOQ:')) return c.json({ error: `MOQ is ${msg.slice(4)}.` }, 400)
    if (msg.startsWith('MIN:')) return c.json({ error: `Bid must be at least ${msg.slice(4)}.` }, 400)
    throw e
  }

  const { bid, lotMeta } = result
  const mappedBid = mapBid(bid)
  const at = Number(bid.at)
  const afterBids = [
    ...priorRows,
    {
      lotId: lotMeta.id,
      accountId: user.accountId,
      amount: body.data.amount,
      qty: body.data.qty,
      at,
    },
  ]
  for (const [accountId, before] of priorFill) {
    if (accountId === user.accountId) continue
    if (before <= 0) continue
    const after = myPcs({ id: lotMeta.id, qty: lotMeta.qty }, afterBids, accountId)
    if (after > 0) continue
    await notify({
      id: `N-OUTBID-${lotMeta.id}-${accountId}-${at}`,
      accountId,
      kind: 'outbid',
      title: 'You were outbid',
      body: `${lotMeta.manufacturer} ${lotMeta.model} — raise price or qty to get units`,
      href: `/auctions#${lotMeta.auctionType || 'live'}`,
    })
  }

  void cacheSet(
    `lot:hot:${lotMeta.id}`,
    JSON.stringify({
      currentPrice: lotMeta.currentPrice,
      bidCount: lotMeta.bidCount,
      at: Date.now(),
    }),
    120,
  )

  broadcastLotTick({
    type: 'lot.tick',
    lotId: lotMeta.id,
    currentPrice: lotMeta.currentPrice,
    bidCount: lotMeta.bidCount,
    bid: mappedBid,
  })

  const payload = {
    bid: mappedBid,
    lot: {
      id: lotMeta.id,
      currentPrice: lotMeta.currentPrice,
      bidCount: lotMeta.bidCount,
    },
  }
  if (idemKey) await setIdempotentJson('bid', `${user.accountId}:${idemKey}`, payload)
  trackBid(true)
  return c.json(payload)
})

commerceRoutes.post('/cart', requireUser, requireWholesale, async (c) => {
  const user = c.get('user')
  const body = z
    .object({ lotId: z.string(), qty: z.number().int().positive() })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid cart item.' }, 400)

  const lot = await prisma.lot.findUnique({ where: { id: body.data.lotId } })
  if (!lot || lot.channel !== 'marketplace' || !lot.buyNowPrice) {
    return c.json({ error: 'Listing not available.' }, 404)
  }
  if (body.data.qty > lot.qty) return c.json({ error: 'Qty exceeds stock.' }, 400)

  const item = await prisma.cartItem.upsert({
    where: { accountId_lotId: { accountId: user.accountId, lotId: lot.id } },
    create: { accountId: user.accountId, lotId: lot.id, qty: body.data.qty },
    update: { qty: body.data.qty },
  })
  return c.json({ item: mapCartItem(item) })
})

commerceRoutes.delete('/cart/:lotId', requireUser, requireWholesale, async (c) => {
  const user = c.get('user')
  await prisma.cartItem.deleteMany({
    where: { accountId: user.accountId, lotId: c.req.param('lotId') },
  })
  return c.json({ ok: true })
})

commerceRoutes.post('/cart/checkout', requireUser, requireWholesale, async (c) => {
  const user = c.get('user')
  const items = await prisma.cartItem.findMany({ where: { accountId: user.accountId } })
  if (!items.length) return c.json({ error: 'Cart is empty.' }, 400)

  const lines: Array<{ lotId: string; qty: number; unitPrice: number }> = []
  for (const item of items) {
    const lot = await prisma.lot.findUnique({ where: { id: item.lotId } })
    if (!lot || lot.channel !== 'marketplace' || !lot.buyNowPrice) {
      return c.json({ error: `Listing gone: ${item.lotId}` }, 400)
    }
    if (item.qty > lot.qty) return c.json({ error: `${lot.model}: not enough stock.` }, 400)
    lines.push({ lotId: lot.id, qty: item.qty, unitPrice: lot.buyNowPrice })
  }

  const id = `CART-${Date.now().toString().slice(-8)}`
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.cartOrder.create({
      data: {
        id,
        accountId: user.accountId,
        status: 'pending',
        createdAt: BigInt(Date.now()),
        linesJson: JSON.stringify(lines),
      },
    })
    await tx.cartItem.deleteMany({ where: { accountId: user.accountId } })
    return created
  })

  await notify({
    id: `N-CART-${order.id}`,
    accountId: user.accountId,
    kind: 'cart',
    title: 'Cart submitted for review',
    body: `${order.id} · ${lines.length} line(s). Staff will accept or decline.`,
    href: '/marketplace/history',
  })
  await notifyStaff(
    'cart',
    'Cart awaiting review',
    `${order.id} from ${user.accountId}`,
    '/admin',
    `N-CART-STAFF-${order.id}`,
  )

  return c.json({ order: mapCartOrder(order) })
})

commerceRoutes.post('/cart-orders/:id/review', requireUser, requireStaff, async (c) => {
  const user = c.get('user')
  const body = z
    .object({ decision: z.enum(['accepted', 'declined']) })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid decision.' }, 400)

  const order = await prisma.cartOrder.findUnique({ where: { id: c.req.param('id') } })
  if (!order || order.status !== 'pending') return c.json({ error: 'Not awaiting review.' }, 400)

  if (body.data.decision === 'accepted') {
    const lines = JSON.parse(order.linesJson) as Array<{ lotId: string; qty: number }>
    for (const line of lines) {
      const lot = await prisma.lot.findUnique({ where: { id: line.lotId } })
      if (!lot || line.qty > lot.qty) {
        return c.json({ error: `Insufficient stock for ${line.lotId}.` }, 400)
      }
    }
  }

  const updated = await prisma.cartOrder.update({
    where: { id: order.id },
    data: {
      status: body.data.decision,
      reviewedAt: BigInt(Date.now()),
      reviewedBy: user.accountId,
    },
  })

  const accepted = body.data.decision === 'accepted'
  await notify({
    id: `N-CART-${order.id}-${body.data.decision}`,
    accountId: order.accountId,
    kind: 'cart',
    title: accepted ? 'Cart accepted' : 'Cart declined',
    body: accepted
      ? `${order.id} was accepted. Confirm to generate your invoice.`
      : `${order.id} was declined by staff.`,
    href: '/marketplace/history',
  })

  return c.json({ order: mapCartOrder(updated) })
})

commerceRoutes.post('/cart-orders/:id/confirm', requireUser, async (c) => {
  const user = c.get('user')
  const order = await prisma.cartOrder.findUnique({ where: { id: c.req.param('id') } })
  if (!order || order.accountId !== user.accountId || order.status !== 'accepted') {
    return c.json({ error: 'Cart is not accepted.' }, 400)
  }

  const lines = JSON.parse(order.linesJson) as Array<{
    lotId: string
    qty: number
    unitPrice: number
  }>
  const stamp = Date.now()
  const invoiceId = `MKT-${String(new Date(stamp).getFullYear()).slice(-2)}-${stamp.toString().slice(-6)}`

  const result = await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      const lot = await tx.lot.findUnique({ where: { id: line.lotId } })
      if (!lot || line.qty > lot.qty) throw new Error(`Stock gone: ${line.lotId}`)
      const nextQty = lot.qty - line.qty
      if (nextQty <= 0) await tx.lot.delete({ where: { id: lot.id } })
      else await tx.lot.update({ where: { id: lot.id }, data: { qty: nextQty } })
    }
    const goods = lines.reduce((n, l) => n + l.qty * l.unitPrice, 0)
    const qty = lines.reduce((n, l) => n + l.qty, 0)
    const priced = withFee(goods, feeForMarketplace())
    const inv = await tx.invoice.create({
      data: {
        id: invoiceId,
        lotId: lines[0].lotId,
        channel: 'marketplace',
        amount: priced.total,
        qty,
        unitPrice: lines[0].unitPrice,
        status: 'draft',
        createdAt: BigInt(stamp),
        accountId: user.accountId,
        dataJson: JSON.stringify({
          lines,
          remarks: `Accepted cart ${order.id}`,
          feePct: priced.feePct,
        }),
      },
    })
    await tx.cartOrder.update({
      where: { id: order.id },
      data: { status: 'confirmed' },
    })
    return inv
  })

  await notify({
    id: `N-DRAFT-${result.id}`,
    accountId: user.accountId,
    kind: 'invoice',
    title: 'Purchase recorded',
    body: `Invoice ${result.id} will appear after Admin and Super issue it.`,
    href: '/account/invoices',
  })
  await notifyStaff(
    'invoice',
    'Invoice waiting to be issued',
    `${result.id} from cart ${order.id}`,
    '/admin',
    `N-ISSUE-${result.id}`,
  )

  return c.json({ invoice: mapInvoice(result) })
})

commerceRoutes.post('/offers', requireUser, requireWholesale, async (c) => {
  const user = c.get('user')
  const body = z
    .object({
      lotId: z.string(),
      qty: z.number().int().positive(),
      unitPrice: z.number().positive(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid offer.' }, 400)

  const lot = await prisma.lot.findUnique({ where: { id: body.data.lotId } })
  if (!lot || lot.channel !== 'marketplace' || !lot.buyNowPrice) {
    return c.json({ error: 'Listing not available.' }, 404)
  }
  if (body.data.qty > lot.qty) return c.json({ error: 'Qty exceeds stock.' }, 400)

  const open = await prisma.marketOffer.findFirst({
    where: {
      accountId: user.accountId,
      lotId: lot.id,
      status: { in: ['pending', 'accepted'] },
    },
  })
  if (open) return c.json({ error: 'You already have an open offer on this listing.' }, 400)

  const offer = await prisma.marketOffer.create({
    data: {
      id: `OFF-${Date.now().toString().slice(-8)}`,
      lotId: lot.id,
      accountId: user.accountId,
      qty: body.data.qty,
      unitPrice: body.data.unitPrice,
      listedPrice: lot.buyNowPrice,
      status: 'pending',
      createdAt: BigInt(Date.now()),
    },
  })

  await notify({
    id: `N-OFFER-${offer.id}`,
    accountId: user.accountId,
    kind: 'offer',
    title: 'Offer submitted',
    body: `${offer.id} · ${offer.qty} pcs @ ${offer.unitPrice} on ${lot.model}`,
    href: '/marketplace/history',
    skipEmail: true,
  })
  await notifyStaff(
    'offer',
    'Offer awaiting review',
    `${offer.id} from ${user.accountId}`,
    '/admin',
    `N-OFFER-STAFF-${offer.id}`,
  )

  return c.json({ offer: mapOffer(offer) })
})

commerceRoutes.post('/offers/:id/review', requireUser, requireStaff, async (c) => {
  const user = c.get('user')
  const body = z
    .object({ decision: z.enum(['accepted', 'declined']) })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid decision.' }, 400)

  const offer = await prisma.marketOffer.findUnique({ where: { id: c.req.param('id') } })
  if (!offer || offer.status !== 'pending') return c.json({ error: 'Not awaiting review.' }, 400)

  if (body.data.decision === 'accepted') {
    const lot = await prisma.lot.findUnique({ where: { id: offer.lotId } })
    if (!lot || offer.qty > lot.qty) return c.json({ error: 'Insufficient stock.' }, 400)
  }

  const updated = await prisma.marketOffer.update({
    where: { id: offer.id },
    data: {
      status: body.data.decision,
      reviewedAt: BigInt(Date.now()),
      reviewedBy: user.accountId,
    },
  })

  const accepted = body.data.decision === 'accepted'
  await notify({
    id: `N-OFFER-${offer.id}-${body.data.decision}`,
    accountId: offer.accountId,
    kind: 'offer',
    title: accepted ? 'Offer accepted' : 'Offer declined',
    body: accepted
      ? `${offer.id} was accepted. Confirm to generate your invoice.`
      : `${offer.id} was declined by staff.`,
    href: '/marketplace/history',
  })

  return c.json({ offer: mapOffer(updated) })
})

commerceRoutes.post('/offers/:id/confirm', requireUser, async (c) => {
  const user = c.get('user')
  const offer = await prisma.marketOffer.findUnique({ where: { id: c.req.param('id') } })
  if (!offer || offer.accountId !== user.accountId || offer.status !== 'accepted') {
    return c.json({ error: 'Offer is not accepted.' }, 400)
  }

  const stamp = Date.now()
  const invoiceId = `MKT-${String(new Date(stamp).getFullYear()).slice(-2)}-${stamp.toString().slice(-6)}`

  try {
    const inv = await prisma.$transaction(async (tx) => {
      const lot = await tx.lot.findUnique({ where: { id: offer.lotId } })
      if (!lot || offer.qty > lot.qty) throw new Error('Stock gone')
      const nextQty = lot.qty - offer.qty
      if (nextQty <= 0) await tx.lot.delete({ where: { id: lot.id } })
      else await tx.lot.update({ where: { id: lot.id }, data: { qty: nextQty } })

      const priced = withFee(offer.qty * offer.unitPrice, feeForMarketplace())
      const created = await tx.invoice.create({
        data: {
          id: invoiceId,
          lotId: offer.lotId,
          channel: 'marketplace',
          amount: priced.total,
          qty: offer.qty,
          unitPrice: offer.unitPrice,
          status: 'draft',
          createdAt: BigInt(stamp),
          accountId: user.accountId,
          dataJson: JSON.stringify({
            lines: [{ lotId: offer.lotId, qty: offer.qty, unitPrice: offer.unitPrice }],
            remarks: `Accepted offer ${offer.id}`,
            feePct: priced.feePct,
          }),
        },
      })
      await tx.marketOffer.update({ where: { id: offer.id }, data: { status: 'confirmed' } })
      return created
    })

    await notify({
      id: `N-DRAFT-${inv.id}`,
      accountId: user.accountId,
      kind: 'invoice',
      title: 'Purchase recorded',
      body: `Invoice ${inv.id} will appear after Admin and Super issue it.`,
      href: '/account/invoices',
    })
    await notifyStaff(
      'invoice',
      'Invoice waiting to be issued',
      `${inv.id} from offer ${offer.id}`,
      '/admin',
      `N-ISSUE-${inv.id}`,
    )

    return c.json({ invoice: mapInvoice(inv) })
  } catch {
    return c.json({ error: 'Could not confirm offer (stock?).' }, 400)
  }
})

commerceRoutes.post('/watch/:lotId', requireUser, requireWholesale, async (c) => {
  const user = c.get('user')
  const lotId = c.req.param('lotId') || ''
  if (!lotId) return c.json({ error: 'Lot required.' }, 400)
  const existing = await prisma.watchItem.findUnique({
    where: { accountId_lotId: { accountId: user.accountId, lotId } },
  })
  if (existing) {
    await prisma.watchItem.delete({ where: { id: existing.id } })
    return c.json({ watching: false })
  }
  await prisma.watchItem.create({ data: { accountId: user.accountId, lotId } })
  return c.json({ watching: true })
})

commerceRoutes.get('/invoices', requireUser, async (c) => {
  const user = c.get('user')
  const staff = user.role === 'admin' || user.role === 'superadmin'
  const rows = await prisma.invoice.findMany({
    where: staff ? undefined : { accountId: user.accountId },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ invoices: rows.map(mapInvoice) })
})
