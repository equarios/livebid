import { Hono } from 'hono'
import { z } from 'zod'
import {
  requireStaff,
  requireUser,
  requireWholesale,
  type AuthedEnv,
  type SessionUser,
} from '../auth'
import { prisma } from '../db'
import { notify, notifyStaff } from '../notify'

export const communityRoutes = new Hono<AuthedEnv>()

/** Wholesale buyers + staff (ops / sellers) only — not retail-only accounts. */
communityRoutes.use('*', requireUser, requireWholesale)

function isStaff(user: SessionUser | undefined) {
  return user?.role === 'admin' || user?.role === 'superadmin'
}

const listingBody = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000).optional(),
  category: z.string().trim().max(64).optional(),
  manufacturer: z.string().trim().max(80).optional(),
  model: z.string().trim().max(80).optional(),
  capacity: z.string().trim().max(40).optional(),
  grade: z.string().trim().max(16).optional(),
  color: z.string().trim().max(40).optional(),
  qty: z.number().int().min(1).max(100_000).optional(),
  price: z.number().min(0).max(1_000_000).nullable().optional(),
  currency: z.string().trim().max(8).optional(),
  imageUrl: z.string().trim().max(800).nullable().optional(),
})

function mapListing(
  row: {
    id: string
    accountId: string
    title: string
    description: string
    category: string
    manufacturer: string
    model: string
    capacity: string
    grade: string
    color: string
    qty: number
    price: number | null
    currency: string
    imageUrl: string | null
    status: string
    featured: boolean
    staffNote: string
    createdAt: Date
    updatedAt: Date
    publishedAt: Date | null
    account?: { company: string; firstName: string; lastName: string } | null
    _count?: { interests: number }
  },
  viewer?: SessionUser,
) {
  const staff = isStaff(viewer)
  const owner = viewer?.accountId === row.accountId
  const seller =
    row.account?.company?.trim() ||
    [row.account?.firstName, row.account?.lastName].filter(Boolean).join(' ').trim() ||
    'Member'
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    manufacturer: row.manufacturer,
    model: row.model,
    capacity: row.capacity,
    grade: row.grade,
    color: row.color,
    qty: row.qty,
    price: row.price,
    currency: row.currency,
    imageUrl: row.imageUrl,
    status: row.status,
    featured: row.featured,
    staffNote: staff || owner ? row.staffNote : '',
    interestCount: row._count?.interests ?? 0,
    sellerName: seller,
    mine: Boolean(owner),
    accountId: staff || owner ? row.accountId : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() || null,
  }
}

/** Wholesale desk board — live listings (featured first). */
communityRoutes.get('/listings', async (c) => {
  const user = c.get('user')
  const q = (c.req.query('q') || '').trim().toLowerCase()
  const category = (c.req.query('category') || '').trim()
  const mine = c.req.query('mine') === '1'
  const staffQueue = c.req.query('queue') === '1'

  if (mine) {
    const rows = await prisma.communityListing.findMany({
      where: { accountId: user.accountId },
      include: { account: true, _count: { select: { interests: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })
    return c.json({ listings: rows.map((r) => mapListing(r, user)) })
  }

  if (staffQueue) {
    if (!isStaff(user)) return c.json({ error: 'Staff only.' }, 403)
    const rows = await prisma.communityListing.findMany({
      where: { status: { in: ['pending', 'live', 'paused', 'rejected'] } },
      include: { account: true, _count: { select: { interests: true } } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
    })
    return c.json({ listings: rows.map((r) => mapListing(r, user)) })
  }

  const rows = await prisma.communityListing.findMany({
    where: {
      status: 'live',
      ...(category ? { category } : {}),
    },
    include: { account: true, _count: { select: { interests: true } } },
    orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  })
  const filtered = q
    ? rows.filter((r) => {
        const hay = `${r.title} ${r.description} ${r.manufacturer} ${r.model} ${r.category}`.toLowerCase()
        return hay.includes(q)
      })
    : rows
  return c.json({ listings: filtered.map((r) => mapListing(r, user)), take: 500 })
})

communityRoutes.get('/listings/:id', async (c) => {
  const user = c.get('user')
  const row = await prisma.communityListing.findUnique({
    where: { id: c.req.param('id') },
    include: { account: true, _count: { select: { interests: true } } },
  })
  if (!row) return c.json({ error: 'Listing not found.' }, 404)
  const staff = isStaff(user)
  const owner = user.accountId === row.accountId
  if (row.status !== 'live' && !staff && !owner) {
    return c.json({ error: 'Listing not found.' }, 404)
  }
  return c.json({ listing: mapListing(row, user) })
})

/** Wholesale members submit listings for staff review. */
communityRoutes.post('/listings', async (c) => {
  const user = c.get('user')

  const parsed = listingBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Invalid listing.' }, 400)

  const data = parsed.data
  const status = isStaff(user) ? 'live' : 'pending'
  const row = await prisma.communityListing.create({
    data: {
      accountId: user.accountId,
      title: data.title,
      description: data.description || '',
      category: data.category || 'Phones',
      manufacturer: data.manufacturer || '',
      model: data.model || '',
      capacity: data.capacity || '',
      grade: data.grade || '',
      color: data.color || '',
      qty: data.qty ?? 1,
      price: data.price === undefined ? null : data.price,
      currency: data.currency || 'USD',
      imageUrl: data.imageUrl || null,
      status,
      publishedAt: status === 'live' ? new Date() : null,
    },
    include: { account: true, _count: { select: { interests: true } } },
  })

  if (status === 'pending') {
    await notifyStaff(
      'cart',
      'Community listing to review',
      `${user.company || user.accountId}: ${row.title}`,
      '/account/community?queue=1',
      `cm-list-${row.id}`,
    )
  }

  return c.json({ listing: mapListing(row, user) }, 201)
})

communityRoutes.patch('/listings/:id', async (c) => {
  const user = c.get('user')
  const row = await prisma.communityListing.findUnique({ where: { id: c.req.param('id') } })
  if (!row) return c.json({ error: 'Listing not found.' }, 404)
  const staff = isStaff(user)
  const owner = row.accountId === user.accountId
  if (!staff && !owner) return c.json({ error: 'Not allowed.' }, 403)

  const parsed = listingBody
    .partial()
    .extend({
      status: z.enum(['draft', 'pending', 'live', 'paused', 'rejected', 'closed']).optional(),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Invalid update.' }, 400)

  const body = parsed.data
  let nextStatus = row.status
  if (body.status) {
    if (staff) nextStatus = body.status
    else if (owner && (body.status === 'paused' || body.status === 'closed' || body.status === 'pending')) {
      nextStatus = body.status
    } else if (owner && body.status === 'live' && row.status === 'paused') {
      nextStatus = 'pending'
    } else {
      return c.json({ error: 'Status change not allowed.' }, 403)
    }
  }

  const updated = await prisma.communityListing.update({
    where: { id: row.id },
    data: {
      title: body.title ?? undefined,
      description: body.description ?? undefined,
      category: body.category ?? undefined,
      manufacturer: body.manufacturer ?? undefined,
      model: body.model ?? undefined,
      capacity: body.capacity ?? undefined,
      grade: body.grade ?? undefined,
      color: body.color ?? undefined,
      qty: body.qty ?? undefined,
      price: body.price === undefined ? undefined : body.price,
      currency: body.currency ?? undefined,
      imageUrl: body.imageUrl === undefined ? undefined : body.imageUrl,
      status: nextStatus,
      publishedAt:
        nextStatus === 'live' && row.status !== 'live'
          ? new Date()
          : nextStatus !== 'live'
            ? null
            : undefined,
    },
    include: { account: true, _count: { select: { interests: true } } },
  })
  return c.json({ listing: mapListing(updated, user) })
})

/** Staff moderate / feature. */
communityRoutes.post('/staff/listings/:id', requireStaff, async (c) => {
  const user = c.get('user')
  const parsed = z
    .object({
      status: z.enum(['pending', 'live', 'paused', 'rejected', 'closed']).optional(),
      featured: z.boolean().optional(),
      staffNote: z.string().max(1000).optional(),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Invalid moderation.' }, 400)

  const row = await prisma.communityListing.findUnique({ where: { id: c.req.param('id') } })
  if (!row) return c.json({ error: 'Listing not found.' }, 404)

  const nextStatus = parsed.data.status ?? row.status
  const updated = await prisma.communityListing.update({
    where: { id: row.id },
    data: {
      status: nextStatus,
      featured: parsed.data.featured ?? undefined,
      staffNote: parsed.data.staffNote ?? undefined,
      publishedAt:
        nextStatus === 'live' && row.status !== 'live'
          ? new Date()
          : nextStatus !== 'live'
            ? null
            : undefined,
    },
    include: { account: true, _count: { select: { interests: true } } },
  })

  if (parsed.data.status && parsed.data.status !== row.status) {
    await notify({
      id: `cm-mod-${row.id}-${parsed.data.status}`,
      accountId: row.accountId,
      kind: 'cart',
      title: `Community: listing ${parsed.data.status}`,
      body: `${row.title}${parsed.data.staffNote ? ` — ${parsed.data.staffNote}` : ''}`,
      href: '/account/community?mine=1',
    })
  }

  return c.json({ listing: mapListing(updated, user) })
})

/** Wholesale member expresses buy interest — staff + seller notified. */
communityRoutes.post('/listings/:id/interest', async (c) => {
  const user = c.get('user')

  const parsed = z
    .object({
      message: z.string().trim().min(4).max(2000),
      qtyWanted: z.number().int().min(1).max(100_000).optional(),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Invalid interest.' }, 400)

  const listing = await prisma.communityListing.findUnique({ where: { id: c.req.param('id') } })
  if (!listing || listing.status !== 'live') {
    return c.json({ error: 'Listing is not open.' }, 404)
  }
  if (listing.accountId === user.accountId) {
    return c.json({ error: 'You cannot inquire on your own listing.' }, 400)
  }

  const interest = await prisma.communityInterest.create({
    data: {
      listingId: listing.id,
      accountId: user.accountId,
      message: parsed.data.message,
      qtyWanted: parsed.data.qtyWanted ?? null,
    },
  })

  const snippet = parsed.data.message.slice(0, 160)
  await notify({
    id: `cm-int-seller-${interest.id}`,
    accountId: listing.accountId,
    kind: 'offer',
    title: 'Interest on your Community listing',
    body: `${user.company || user.accountId} on “${listing.title}”: ${snippet}`,
    href: '/account/community?mine=1',
  })
  await notifyStaff(
    'offer',
    'Community interest',
    `${user.company || user.accountId} → ${listing.title}: ${snippet}`,
    '/account/community?queue=1',
    `cm-int-staff-${interest.id}`,
  )

  return c.json({
    interest: {
      id: interest.id,
      listingId: interest.listingId,
      status: interest.status,
      createdAt: interest.createdAt.toISOString(),
    },
  }, 201)
})

communityRoutes.get('/interests', async (c) => {
  const user = c.get('user')
  const staff = isStaff(user)
  const rows = await prisma.communityInterest.findMany({
    where: staff
      ? undefined
      : {
          OR: [
            { accountId: user.accountId },
            { listing: { accountId: user.accountId } },
          ],
        },
    include: {
      listing: { select: { id: true, title: true, accountId: true, status: true } },
      account: { select: { accountId: true, company: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: staff ? 200 : 80,
  })
  return c.json({
    interests: rows.map((r) => ({
      id: r.id,
      listingId: r.listingId,
      listingTitle: r.listing.title,
      listingStatus: r.listing.status,
      message: r.message,
      qtyWanted: r.qtyWanted,
      status: r.status,
      fromCompany: r.account.company,
      fromAccountId: staff || r.listing.accountId === user.accountId ? r.account.accountId : undefined,
      fromEmail: staff || r.listing.accountId === user.accountId ? r.account.email : undefined,
      mine: r.accountId === user.accountId,
      createdAt: r.createdAt.toISOString(),
    })),
  })
})
