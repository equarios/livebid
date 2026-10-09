import { Hono } from 'hono'
import { z } from 'zod'
import { requireUser, type AuthedEnv } from '../auth'
import { prisma } from '../db'
import { mapNotice } from '../map'
import { DEFAULT_EMAIL_PREFS, notify, parseEmailPrefs, type NoticeKind } from '../notify'

export const noticeRoutes = new Hono<AuthedEnv>()

noticeRoutes.get('/', requireUser, async (c) => {
  const user = c.get('user')
  const rows = await prisma.notice.findMany({
    where: { accountId: user.accountId },
    orderBy: { at: 'desc' },
    take: 100,
  })
  return c.json({ notices: rows.map(mapNotice) })
})

noticeRoutes.post('/read', requireUser, async (c) => {
  const user = c.get('user')
  await prisma.notice.updateMany({
    where: { accountId: user.accountId, read: false },
    data: { read: true },
  })
  return c.json({ ok: true })
})

noticeRoutes.get('/prefs', requireUser, async (c) => {
  const user = c.get('user')
  const account = await prisma.account.findUnique({ where: { accountId: user.accountId } })
  if (!account) return c.json({ error: 'Not found.' }, 404)
  return c.json({ prefs: parseEmailPrefs(account.emailPrefsJson) })
})

noticeRoutes.put('/prefs', requireUser, async (c) => {
  const user = c.get('user')
  const body = z
    .object({
      win: z.boolean().optional(),
      offer: z.boolean().optional(),
      cart: z.boolean().optional(),
      invoice: z.boolean().optional(),
      payment: z.boolean().optional(),
      shipping: z.boolean().optional(),
      auth: z.boolean().optional(),
      outbid: z.boolean().optional(),
      closing: z.boolean().optional(),
      fill: z.boolean().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid prefs.' }, 400)

  const account = await prisma.account.findUnique({ where: { accountId: user.accountId } })
  if (!account) return c.json({ error: 'Not found.' }, 404)
  const next = { ...parseEmailPrefs(account.emailPrefsJson), ...body.data }
  await prisma.account.update({
    where: { accountId: user.accountId },
    data: { emailPrefsJson: JSON.stringify(next) },
  })
  return c.json({ prefs: next })
})

/** Client/staff can push a transactional notice (invoice issued, paid, shipped). */
noticeRoutes.post('/', requireUser, async (c) => {
  const user = c.get('user')
  const body = z
    .object({
      accountId: z.string().min(1),
      kind: z.enum([
        'win',
        'invoice',
        'outbid',
        'closing',
        'fill',
        'offer',
        'cart',
        'payment',
        'shipping',
        'auth',
      ]),
      title: z.string().min(1).max(120),
      body: z.string().min(1).max(500),
      href: z.string().min(1).max(200),
      id: z.string().min(1).max(120).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid notice.' }, 400)

  const staff = user.role === 'admin' || user.role === 'superadmin'
  if (!staff && body.data.accountId !== user.accountId) {
    return c.json({ error: 'Forbidden.' }, 403)
  }

  const id =
    body.data.id ||
    `N-${body.data.kind.toUpperCase()}-${Date.now().toString(36)}-${body.data.accountId.slice(-4)}`

  const result = await notify({
    id,
    accountId: body.data.accountId,
    kind: body.data.kind as NoticeKind,
    title: body.data.title,
    body: body.data.body,
    href: body.data.href,
  })
  if (!result.notice) return c.json({ error: 'Account not found.' }, 404)
  return c.json({ notice: mapNotice(result.notice), emailed: result.emailed })
})

noticeRoutes.get('/defaults', (c) => c.json({ prefs: DEFAULT_EMAIL_PREFS }))
