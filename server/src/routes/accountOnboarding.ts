import { Hono } from 'hono'
import { z } from 'zod'
import { requireStaff, requireUser, type AuthedEnv } from '../auth'
import { prisma } from '../db'
import { isFulfillmentMode } from '../fulfillment'
import { notify, notifyStaff } from '../notify'
import { parseWatchFilters } from '../watchFilters'

export const accountOnboardingRoutes = new Hono<AuthedEnv>()

function mapLogistics(a: {
  preferredFulfillmentMode: string | null
  courierCarrier: string | null
  courierAccount: string | null
  address: string | null
}) {
  return {
    preferredFulfillmentMode: isFulfillmentMode(a.preferredFulfillmentMode)
      ? a.preferredFulfillmentMode
      : null,
    courierCarrier: a.courierCarrier || null,
    courierAccount: a.courierAccount || null,
    address: a.address || null,
  }
}

/** Buyer default logistics (pickup / delivery / own FedEx·UPS·DHL). */
accountOnboardingRoutes.get('/logistics', requireUser, async (c) => {
  const user = c.get('user')
  const acc = await prisma.account.findUnique({ where: { accountId: user.accountId } })
  if (!acc) return c.json({ error: 'Account not found.' }, 404)
  return c.json({ logistics: mapLogistics(acc) })
})

accountOnboardingRoutes.put('/logistics', requireUser, async (c) => {
  const user = c.get('user')
  const body = z
    .object({
      preferredFulfillmentMode: z
        .enum(['pickup', 'delivery', 'buyer_courier'])
        .nullable()
        .optional(),
      courierCarrier: z.string().max(80).nullable().optional(),
      courierAccount: z.string().max(80).nullable().optional(),
      address: z.string().max(500).nullable().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid logistics.' }, 400)

  const mode = body.data.preferredFulfillmentMode
  if (mode === 'buyer_courier') {
    const carrier = (body.data.courierCarrier || '').trim()
    if (carrier.length < 2) {
      return c.json({ error: 'Choose a courier for your own-account shipping.' }, 400)
    }
  }

  const updated = await prisma.account.update({
    where: { accountId: user.accountId },
    data: {
      preferredFulfillmentMode:
        body.data.preferredFulfillmentMode === undefined
          ? undefined
          : body.data.preferredFulfillmentMode,
      courierCarrier:
        body.data.courierCarrier === undefined
          ? undefined
          : body.data.courierCarrier?.trim() || null,
      courierAccount:
        body.data.courierAccount === undefined
          ? undefined
          : body.data.courierAccount?.trim() || null,
      address:
        body.data.address === undefined ? undefined : body.data.address?.trim() || null,
    },
  })
  return c.json({ logistics: mapLogistics(updated) })
})

function parsePayload(raw: string) {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

accountOnboardingRoutes.get('/watch-filters', requireUser, async (c) => {
  const user = c.get('user')
  const acc = await prisma.account.findUnique({ where: { accountId: user.accountId } })
  if (!acc) return c.json({ error: 'Account not found.' }, 404)
  return c.json({ filters: parseWatchFilters(acc.watchFiltersJson) })
})

accountOnboardingRoutes.put('/watch-filters', requireUser, async (c) => {
  const user = c.get('user')
  const body = z
    .object({
      filters: z
        .array(
          z.object({
            id: z.string().min(1).max(200),
            deviceClass: z.string().optional(),
            condition: z.string().optional(),
            label: z.string().min(1).max(120),
            to: z.string().min(1).max(200),
            createdAt: z.number().optional(),
          }),
        )
        .max(24),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid filters.' }, 400)
  const rows = body.data.filters.map((f) => ({
    ...f,
    createdAt: f.createdAt || Date.now(),
  }))
  await prisma.account.update({
    where: { accountId: user.accountId },
    data: { watchFiltersJson: JSON.stringify(rows) },
  })
  return c.json({ filters: rows })
})

accountOnboardingRoutes.get('/wholesale-application', requireUser, async (c) => {
  const user = c.get('user')
  const acc = await prisma.account.findUnique({ where: { accountId: user.accountId } })
  if (!acc) return c.json({ error: 'Account not found.' }, 404)
  let app = await prisma.wholesaleApplication.findUnique({ where: { accountId: user.accountId } })
  if (!app) {
    app = await prisma.wholesaleApplication.create({
      data: { accountId: user.accountId, status: 'draft', payloadJson: '{}' },
    })
  }
  return c.json({
    application: {
      id: app.id,
      status: app.status,
      payload: parsePayload(app.payloadJson),
      staffNote: app.staffNote,
      submittedAt: app.submittedAt?.toISOString() ?? null,
      reviewedAt: app.reviewedAt?.toISOString() ?? null,
      wholesaleStatus: acc.wholesaleStatus,
    },
  })
})

accountOnboardingRoutes.put('/wholesale-application', requireUser, async (c) => {
  const user = c.get('user')
  const body = z
    .object({
      payload: z.record(z.string(), z.unknown()).optional(),
      submit: z.boolean().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid application.' }, 400)

  let app = await prisma.wholesaleApplication.findUnique({ where: { accountId: user.accountId } })
  if (!app) {
    app = await prisma.wholesaleApplication.create({
      data: { accountId: user.accountId, status: 'draft', payloadJson: '{}' },
    })
  }
  if (app.status === 'approved') {
    return c.json({ error: 'Application already approved.' }, 400)
  }

  const nextPayload = body.data.payload
    ? { ...parsePayload(app.payloadJson), ...body.data.payload }
    : parsePayload(app.payloadJson)
  const submit = Boolean(body.data.submit)
  const updated = await prisma.wholesaleApplication.update({
    where: { id: app.id },
    data: {
      payloadJson: JSON.stringify(nextPayload),
      status: submit ? 'submitted' : app.status === 'draft' ? 'draft' : app.status,
      submittedAt: submit ? new Date() : app.submittedAt,
    },
  })
  if (submit) {
    await prisma.account.update({
      where: { accountId: user.accountId },
      data: { wholesaleStatus: 'under_review' },
    })
    await notify({
      id: `N-WS-APP-${user.accountId}-${Date.now()}`,
      accountId: user.accountId,
      kind: 'auth',
      title: 'Wholesale application submitted',
      body: 'Staff will review your documents. Track status on My Page.',
      href: '/account/wholesale',
    })
    await notifyStaff(
      'auth',
      'Wholesale application submitted',
      `${user.accountId} · ${user.company}`,
      '/super?section=accounts',
      `N-WS-STAFF-${user.accountId}-${Date.now()}`,
    )
  }
  return c.json({
    application: {
      id: updated.id,
      status: updated.status,
      payload: nextPayload,
      staffNote: updated.staffNote,
      submittedAt: updated.submittedAt?.toISOString() ?? null,
    },
  })
})

accountOnboardingRoutes.get('/documents', requireUser, async (c) => {
  const user = c.get('user')
  const rows = await prisma.accountDocument.findMany({
    where: { accountId: user.accountId },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({
    documents: rows.map((d) => ({
      id: d.id,
      direction: d.direction,
      category: d.category,
      title: d.title,
      fileName: d.fileName,
      mimeType: d.mimeType,
      note: d.note,
      createdBy: d.createdBy,
      createdAt: d.createdAt.toISOString(),
      size: Math.round((d.dataBase64.length * 3) / 4),
    })),
  })
})

accountOnboardingRoutes.post('/documents', requireUser, async (c) => {
  const user = c.get('user')
  const body = z
    .object({
      title: z.string().min(1),
      category: z.string().min(1).default('other'),
      fileName: z.string().min(1),
      mimeType: z.string().min(1).default('application/octet-stream'),
      dataBase64: z.string().min(1).max(2_500_000),
      note: z.string().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid document (max ~1.8MB).' }, 400)

  const doc = await prisma.accountDocument.create({
    data: {
      accountId: user.accountId,
      direction: 'client_upload',
      category: body.data.category,
      title: body.data.title.trim(),
      fileName: body.data.fileName.trim(),
      mimeType: body.data.mimeType,
      dataBase64: body.data.dataBase64,
      note: body.data.note?.trim() || '',
      createdBy: user.accountId,
    },
  })
  await notifyStaff(
    'auth',
    'Client uploaded a document',
    `${user.accountId} · ${doc.title}`,
    '/super?section=accounts',
    `N-DOC-${doc.id}`,
  )
  return c.json({
    document: {
      id: doc.id,
      title: doc.title,
      fileName: doc.fileName,
      category: doc.category,
      createdAt: doc.createdAt.toISOString(),
    },
  }, 201)
})

accountOnboardingRoutes.get('/documents/:id/download', requireUser, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const doc = await prisma.accountDocument.findUnique({ where: { id } })
  if (!doc) return c.json({ error: 'Not found.' }, 404)
  if (doc.accountId !== user.accountId && user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ error: 'Forbidden.' }, 403)
  }
  return c.json({
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    dataBase64: doc.dataBase64,
  })
})

/** Staff: list wholesale applications */
accountOnboardingRoutes.get('/staff/wholesale-applications', requireUser, requireStaff, async (c) => {
  const rows = await prisma.wholesaleApplication.findMany({
    where: { status: { not: 'draft' } },
    include: { account: true },
    orderBy: { updatedAt: 'desc' },
  })
  return c.json({
    applications: rows.map((a) => ({
      id: a.id,
      accountId: a.accountId,
      company: a.account.company,
      email: a.account.email,
      status: a.status,
      wholesaleStatus: a.account.wholesaleStatus,
      staffNote: a.staffNote,
      submittedAt: a.submittedAt?.toISOString() ?? null,
      payload: parsePayload(a.payloadJson),
    })),
  })
})

const STUCK_IDLE_MS = 7 * 24 * 60 * 60 * 1000
const STUCK_GRACE_MS = 2 * 24 * 60 * 60 * 1000

/** Approved buyers with no bids in 7 days (after a 2-day grace). */
accountOnboardingRoutes.get('/staff/wholesale-stuck', requireUser, requireStaff, async (c) => {
  const since = BigInt(Date.now() - STUCK_IDLE_MS)
  const approved = await prisma.account.findMany({
    where: {
      wholesaleStatus: 'approved',
      status: 'active',
      role: 'member',
      NOT: { accountId: { startsWith: 'BOT-' } },
    },
    select: {
      accountId: true,
      company: true,
      email: true,
      createdAt: true,
      wholesaleApp: { select: { reviewedAt: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 300,
  })
  const ids = approved.map((a) => a.accountId)
  const recent =
    ids.length > 0
      ? await prisma.bid.findMany({
          where: { accountId: { in: ids }, at: { gt: since } },
          distinct: ['accountId'],
          select: { accountId: true },
        })
      : []
  const active = new Set(recent.map((r) => r.accountId))
  const now = Date.now()
  const stuckBase = approved
    .filter((a) => !active.has(a.accountId))
    .filter((a) => {
      const approvedAt = a.wholesaleApp?.reviewedAt?.getTime() ?? a.createdAt.getTime()
      return now - approvedAt >= STUCK_GRACE_MS
    })
  const stuckIds = stuckBase.map((a) => a.accountId)

  const nudgeNotices =
    stuckIds.length > 0
      ? await prisma.notice.findMany({
          where: {
            accountId: { in: stuckIds },
            id: { startsWith: 'N-STUCK-' },
          },
          select: { id: true, accountId: true, at: true },
          orderBy: { at: 'desc' },
        })
      : []
  const lastNudge = new Map<string, number>()
  const nudgeCounts = new Map<string, number>()
  for (const n of nudgeNotices) {
    nudgeCounts.set(n.accountId, (nudgeCounts.get(n.accountId) || 0) + 1)
    if (!lastNudge.has(n.accountId)) lastNudge.set(n.accountId, Number(n.at))
  }

  const lastBidRows =
    stuckIds.length > 0
      ? await prisma.bid.groupBy({
          by: ['accountId'],
          where: { accountId: { in: stuckIds } },
          _max: { at: true },
        })
      : []
  const lastBid = new Map(
    lastBidRows.map((r) => [r.accountId, r._max.at != null ? Number(r._max.at) : null]),
  )

  const stuck = stuckBase.map((a) => {
    const nudgedAt = lastNudge.get(a.accountId) ?? null
    const bidAt = lastBid.get(a.accountId) ?? null
    const bidAfterNudge = Boolean(nudgedAt && bidAt && bidAt > nudgedAt)
    return {
      accountId: a.accountId,
      company: a.company,
      email: a.email,
      approvedAt: (a.wholesaleApp?.reviewedAt ?? a.createdAt).toISOString(),
      lastNudgeAt: nudgedAt != null ? new Date(nudgedAt).toISOString() : null,
      nudgeCount: nudgeCounts.get(a.accountId) || 0,
      lastBidAt: bidAt != null ? new Date(bidAt).toISOString() : null,
      bidAfterNudge,
    }
  })
  return c.json({ stuck, idleDays: 7 })
})

const RECOVER_WINDOW_MS = 48 * 60 * 60 * 1000
const RECOVER_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000

/** Buyers who bid within 48h of an idle nudge — proof the queue works. */
accountOnboardingRoutes.get('/staff/wholesale-recovered', requireUser, requireStaff, async (c) => {
  const now = Date.now()
  const since = BigInt(now - RECOVER_LOOKBACK_MS)
  const nudges = await prisma.notice.findMany({
    where: {
      id: { startsWith: 'N-STUCK-' },
      at: { gte: since },
    },
    select: { id: true, accountId: true, at: true },
    orderBy: { at: 'desc' },
    take: 500,
  })
  const latestNudge = new Map<string, { at: number; id: string }>()
  for (const n of nudges) {
    if (!latestNudge.has(n.accountId)) {
      latestNudge.set(n.accountId, { at: Number(n.at), id: n.id })
    }
  }
  const accountIds = [...latestNudge.keys()]
  if (!accountIds.length) return c.json({ recovered: [] })

  const accounts = await prisma.account.findMany({
    where: { accountId: { in: accountIds } },
    select: { accountId: true, company: true, email: true },
  })
  const byId = new Map(accounts.map((a) => [a.accountId, a]))

  const thanks = await prisma.notice.findMany({
    where: {
      accountId: { in: accountIds },
      id: { startsWith: 'N-THANKS-RECOVER-' },
      at: { gte: since },
    },
    select: { accountId: true },
  })
  const thanked = new Set(thanks.map((t) => t.accountId))

  const minNudge = Math.min(...[...latestNudge.values()].map((n) => n.at))
  const bidsAfter = await prisma.bid.findMany({
    where: {
      accountId: { in: accountIds },
      at: { gt: BigInt(minNudge) },
    },
    select: { accountId: true, at: true },
    orderBy: { at: 'asc' },
  })
  const firstBidAfter = new Map<string, number>()
  for (const b of bidsAfter) {
    const nudge = latestNudge.get(b.accountId)
    if (!nudge) continue
    const at = Number(b.at)
    if (at <= nudge.at || at > nudge.at + RECOVER_WINDOW_MS) continue
    if (!firstBidAfter.has(b.accountId)) firstBidAfter.set(b.accountId, at)
  }

  const recovered = [...firstBidAfter.entries()]
    .map(([accountId, bidAt]) => {
      const acc = byId.get(accountId)
      const nudge = latestNudge.get(accountId)
      if (!acc || !nudge) return null
      return {
        accountId,
        company: acc.company,
        email: acc.email,
        nudgedAt: new Date(nudge.at).toISOString(),
        bidAt: new Date(bidAt).toISOString(),
        thanked: thanked.has(accountId),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r != null)
    .sort((a, b) => Date.parse(b.bidAt) - Date.parse(a.bidAt))
    .slice(0, 80)

  return c.json({ recovered })
})

accountOnboardingRoutes.post('/staff/wholesale-applications/:accountId', requireUser, requireStaff, async (c) => {
  const staff = c.get('user')
  const accountId = (c.req.param('accountId') ?? '').toUpperCase()
  const body = z
    .object({
      action: z.enum([
        'approve',
        'reject',
        'needs_docs',
        'under_review',
        'note',
        'send_notice',
        'nudge_idle',
        'thanks_recover',
      ]),
      staffNote: z.string().optional(),
      noticeTitle: z.string().optional(),
      noticeBody: z.string().optional(),
      noticeHref: z.string().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid action.' }, 400)

  const acc = await prisma.account.findUnique({ where: { accountId } })
  if (!acc) return c.json({ error: 'Account not found.' }, 404)
  const app = await prisma.wholesaleApplication.findUnique({ where: { accountId } })

  if (body.data.action === 'nudge_idle') {
    if (acc.wholesaleStatus !== 'approved') {
      return c.json({ error: 'Buyer is not approved.' }, 400)
    }
    const day = new Date().toISOString().slice(0, 10)
    const result = await notify({
      id: `N-STUCK-${accountId}-${day}`,
      accountId,
      kind: 'auth',
      title: body.data.noticeTitle?.trim() || 'Your wholesale desk is waiting',
      body:
        body.data.noticeBody?.trim() ||
        'You are approved but have not bid recently. Open the hub to place a first bid or save a watch filter.',
      href: body.data.noticeHref?.trim() || '/wholesale?onboard=1',
      forceEmail: true,
    })
    return c.json({ ok: true, already: !result.created })
  }

  if (body.data.action === 'thanks_recover') {
    const day = new Date().toISOString().slice(0, 10)
    const result = await notify({
      id: `N-THANKS-RECOVER-${accountId}-${day}`,
      accountId,
      kind: 'thanks',
      title: body.data.noticeTitle?.trim() || 'Good to see you back on the desk',
      body:
        body.data.noticeBody?.trim() ||
        'Thanks for bidding again. Open the hub for quiet lots closing soon — Your next desk.',
      href: body.data.noticeHref?.trim() || '/wholesale?onboard=1',
      forceEmail: true,
    })
    return c.json({ ok: true, already: !result.created })
  }

  if (body.data.action === 'send_notice') {
    const title = body.data.noticeTitle?.trim() || 'Message from Equarios'
    const noticeBody = body.data.noticeBody?.trim() || body.data.staffNote?.trim() || ''
    if (!noticeBody) return c.json({ error: 'Notice body required.' }, 400)
    await notify({
      id: `N-STAFF-${accountId}-${Date.now()}`,
      accountId,
      kind: 'auth',
      title,
      body: noticeBody,
      href: body.data.noticeHref?.trim() || '/account',
      forceEmail: true,
    })
    return c.json({ ok: true })
  }

  if (body.data.action === 'note' && app) {
    await prisma.wholesaleApplication.update({
      where: { id: app.id },
      data: { staffNote: body.data.staffNote?.trim() || '' },
    })
    return c.json({ ok: true })
  }

  const map: Record<string, { app: string; ws: string }> = {
    approve: { app: 'approved', ws: 'approved' },
    reject: { app: 'rejected', ws: 'rejected' },
    needs_docs: { app: 'needs_docs', ws: 'needs_docs' },
    under_review: { app: 'under_review', ws: 'under_review' },
  }
  const next = map[body.data.action]
  if (!next) return c.json({ error: 'Unknown action.' }, 400)

  await prisma.account.update({
    where: { accountId },
    data: {
      wholesaleStatus: next.ws,
      status: next.ws === 'approved' ? 'active' : acc.status,
    },
  })
  if (app) {
    await prisma.wholesaleApplication.update({
      where: { id: app.id },
      data: {
        status: next.app,
        staffNote: body.data.staffNote?.trim() ?? app.staffNote,
        reviewedAt: new Date(),
        reviewedBy: staff.accountId,
      },
    })
  }
  const approved = next.ws === 'approved'
  await notify({
    id: `N-WS-${body.data.action}-${accountId}-${Date.now()}`,
    accountId,
    kind: 'auth',
    title: approved
      ? body.data.noticeTitle?.trim() || 'Desk unlocked — wholesale approved'
      : body.data.noticeTitle?.trim() ||
        (next.ws === 'rejected' ? 'Wholesale application update' : 'Wholesale application update'),
    body:
      body.data.noticeBody?.trim() ||
      body.data.staffNote?.trim() ||
      (approved
        ? 'Your wholesale desk is active. Next: save a watch filter, place a first bid, and confirm your ship/bill address.'
        : `Status: ${next.ws.replace(/_/g, ' ')}.`),
    href: body.data.noticeHref?.trim() || (approved ? '/wholesale?onboard=1' : '/account/wholesale'),
    forceEmail: approved,
  })
  return c.json({ ok: true, wholesaleStatus: next.ws })
})

accountOnboardingRoutes.post('/staff/documents', requireUser, requireStaff, async (c) => {
  const staff = c.get('user')
  const body = z
    .object({
      accountId: z.string().min(1),
      title: z.string().min(1),
      category: z.string().default('staff_form'),
      fileName: z.string().min(1),
      mimeType: z.string().default('application/octet-stream'),
      dataBase64: z.string().min(1).max(2_500_000),
      note: z.string().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid document.' }, 400)
  const accountId = body.data.accountId.trim().toUpperCase()
  const acc = await prisma.account.findUnique({ where: { accountId } })
  if (!acc) return c.json({ error: 'Account not found.' }, 404)

  const doc = await prisma.accountDocument.create({
    data: {
      accountId,
      direction: 'staff_send',
      category: body.data.category,
      title: body.data.title.trim(),
      fileName: body.data.fileName.trim(),
      mimeType: body.data.mimeType,
      dataBase64: body.data.dataBase64,
      note: body.data.note?.trim() || '',
      createdBy: staff.accountId,
    },
  })
  await notify({
    id: `N-DOC-SEND-${doc.id}`,
    accountId,
    kind: 'auth',
    title: 'New document from Equarios',
    body: `${doc.title} is available on My Page → Documents.`,
    href: '/account/documents',
  })
  return c.json({ ok: true, id: doc.id }, 201)
})
