import { Hono } from 'hono'
import { z } from 'zod'
import { requireStaff, requireUser, type AuthedEnv } from '../auth'
import { prisma } from '../db'
import { notify, notifyStaff } from '../notify'

export const accountOnboardingRoutes = new Hono<AuthedEnv>()

function parsePayload(raw: string) {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

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

accountOnboardingRoutes.post('/staff/wholesale-applications/:accountId', requireUser, requireStaff, async (c) => {
  const staff = c.get('user')
  const accountId = c.req.param('accountId').toUpperCase()
  const body = z
    .object({
      action: z.enum(['approve', 'reject', 'needs_docs', 'under_review', 'note', 'send_notice']),
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
  await notify({
    id: `N-WS-${body.data.action}-${accountId}-${Date.now()}`,
    accountId,
    kind: 'auth',
    title:
      next.ws === 'approved'
        ? 'Wholesale account approved'
        : next.ws === 'rejected'
          ? 'Wholesale application update'
          : 'Wholesale application update',
    body:
      body.data.staffNote?.trim() ||
      (next.ws === 'approved'
        ? 'You can now access auctions and marketplace.'
        : `Status: ${next.ws.replace(/_/g, ' ')}.`),
    href: next.ws === 'approved' ? '/auctions' : '/account/wholesale',
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
