import { Hono } from 'hono'
import { z } from 'zod'
import { requireStaff, requireUser, type AuthedEnv } from '../auth'
import { feeForMarketplace, withFee } from '../feeConfig'
import { myPcs } from '../allocate'
import { prisma } from '../db'
import {
  mapBid,
  mapCartItem,
  mapCartOrder,
  mapInvoice,
  mapOffer,
  mapWatch,
  mapNotice,
} from '../map'
import { notify, notifyStaff } from '../notify'

export const commerceRoutes = new Hono<AuthedEnv>()

commerceRoutes.get('/bootstrap', requireUser, async (c) => {
  const user = c.get('user')
  const staff = user.role === 'admin' || user.role === 'superadmin'
  const [lots, bids, cartItems, cartOrders, offers, invoices, watch, notices, accounts, inventory] =
    await Promise.all([
      prisma.lot.findMany({ orderBy: { id: 'asc' } }),
      prisma.bid.findMany({ orderBy: { at: 'desc' } }),
      prisma.cartItem.findMany({ where: { accountId: user.accountId } }),
      staff
        ? prisma.cartOrder.findMany({ orderBy: { createdAt: 'desc' } })
        : prisma.cartOrder.findMany({
            where: { accountId: user.accountId },
            orderBy: { createdAt: 'desc' },
          }),
      staff
        ? prisma.marketOffer.findMany({ orderBy: { createdAt: 'desc' } })
        : prisma.marketOffer.findMany({
            where: { accountId: user.accountId },
            orderBy: { createdAt: 'desc' },
          }),
      staff
        ? prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } })
        : prisma.invoice.findMany({
            where: { accountId: user.accountId },
            orderBy: { createdAt: 'desc' },
          }),
      prisma.watchItem.findMany({ where: { accountId: user.accountId } }),
      prisma.notice.findMany({
        where: { accountId: user.accountId },
        orderBy: { at: 'desc' },
        take: 100,
      }),
      staff ? prisma.account.findMany({ orderBy: { accountId: 'asc' } }) : Promise.resolve([]),
      staff ? prisma.inventorySku.findMany({ orderBy: { id: 'asc' } }) : Promise.resolve([]),
    ])

  return c.json({
    lots: lots.map((l) => ({
      id: l.id,
      channel: l.channel,
      auctionType: l.auctionType || undefined,
      manufacturer: l.manufacturer,
      model: l.model,
      modelNumber: l.modelNumber,
      capacity: l.capacity,
      color: l.color,
      grade: l.grade,
      battery: l.battery,
      qty: l.qty,
      moq: l.moq ?? undefined,
      startPrice: l.startPrice,
      currentPrice: l.currentPrice,
      buyNowPrice: l.buyNowPrice ?? undefined,
      bidCount: l.bidCount,
      endsAt: Number(l.endsAt),
      description: l.description,
      accent: l.accent,
      operator: l.operator ?? undefined,
      simLocked: l.simLocked ?? undefined,
      activationLocked: l.activationLocked ?? undefined,
      origin: l.origin ?? undefined,
    })),
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
      address: a.address ?? undefined,
      phone: a.phone ?? undefined,
      buyerNumber: a.buyerNumber ?? undefined,
      role: a.role,
      status: a.status,
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
  })
})

commerceRoutes.post('/bids', requireUser, async (c) => {
  const user = c.get('user')
  const body = z
    .object({
      lotId: z.string(),
      amount: z.number().positive(),
      qty: z.number().int().positive(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid bid.' }, 400)

  const lot = await prisma.lot.findUnique({ where: { id: body.data.lotId } })
  if (!lot || lot.channel !== 'auction') return c.json({ error: 'Lot not found.' }, 404)
  if (Number(lot.endsAt) <= Date.now()) return c.json({ error: 'Auction closed.' }, 400)
  if (body.data.qty > lot.qty) return c.json({ error: 'Qty exceeds available.' }, 400)
  if (lot.moq && body.data.qty < lot.moq) return c.json({ error: `MOQ is ${lot.moq}.` }, 400)
  if (body.data.amount < lot.currentPrice) {
    return c.json({ error: `Bid must be at least ${lot.currentPrice}.` }, 400)
  }

  const priorBids = await prisma.bid.findMany({ where: { lotId: lot.id } })
  const priorRows = priorBids.map((b) => ({
    lotId: b.lotId,
    accountId: b.accountId,
    amount: b.amount,
    qty: b.qty,
    at: Number(b.at),
  }))
  const priorFill = new Map<string, number>()
  for (const accountId of new Set(priorRows.map((b) => b.accountId))) {
    priorFill.set(accountId, myPcs({ id: lot.id, qty: lot.qty }, priorRows, accountId))
  }

  const at = BigInt(Date.now())
  const [bid] = await prisma.$transaction([
    prisma.bid.create({
      data: {
        lotId: lot.id,
        accountId: user.accountId,
        amount: body.data.amount,
        qty: body.data.qty,
        at,
      },
    }),
    prisma.lot.update({
      where: { id: lot.id },
      data: {
        currentPrice: Math.max(lot.currentPrice, body.data.amount),
        bidCount: { increment: 1 },
      },
    }),
  ])

  const afterBids = [
    ...priorRows,
    {
      lotId: lot.id,
      accountId: user.accountId,
      amount: body.data.amount,
      qty: body.data.qty,
      at: Number(at),
    },
  ]
  for (const [accountId, before] of priorFill) {
    if (accountId === user.accountId) continue
    if (before <= 0) continue
    const after = myPcs({ id: lot.id, qty: lot.qty }, afterBids, accountId)
    if (after > 0) continue
    await notify({
      id: `N-OUTBID-${lot.id}-${accountId}-${Number(at)}`,
      accountId,
      kind: 'outbid',
      title: 'You were outbid',
      body: `${lot.manufacturer} ${lot.model} — raise price or qty to get units`,
      href: `/auctions#${lot.auctionType || 'live'}`,
    })
  }

  return c.json({ bid: mapBid(bid) })
})

commerceRoutes.post('/cart', requireUser, async (c) => {
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

commerceRoutes.delete('/cart/:lotId', requireUser, async (c) => {
  const user = c.get('user')
  await prisma.cartItem.deleteMany({
    where: { accountId: user.accountId, lotId: c.req.param('lotId') },
  })
  return c.json({ ok: true })
})

commerceRoutes.post('/cart/checkout', requireUser, async (c) => {
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

commerceRoutes.post('/offers', requireUser, async (c) => {
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

commerceRoutes.post('/watch/:lotId', requireUser, async (c) => {
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
