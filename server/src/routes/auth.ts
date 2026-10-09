import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { z } from 'zod'
import {
  COOKIE,
  clearSessionCookie,
  createSession,
  hashPassword,
  requireUser,
  setSessionCookie,
  userFromToken,
  verifyPassword,
  type AuthedEnv,
} from '../auth'
import { prisma } from '../db'
import { mapAccount } from '../map'
import { notify, notifyStaff } from '../notify'
import { sendMail } from '../mail'

export const authRoutes = new Hono<AuthedEnv>()

authRoutes.get('/me', async (c) => {
  const user = await userFromToken(getCookie(c, COOKIE))
  if (!user) return c.json({ user: null })
  return c.json({ user })
})

authRoutes.post('/login', async (c) => {
  const body = z
    .object({ ident: z.string().min(1), password: z.string().min(1) })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Account ID / email and password required.' }, 400)

  const ident = body.data.ident.trim()
  const found = await prisma.account.findFirst({
    where: {
      OR: [{ accountId: ident }, { email: ident }],
    },
  })

  if (!found || !verifyPassword(body.data.password, found.passwordHash)) {
    return c.json({ error: 'Invalid account or password.' }, 401)
  }
  if (found.status === 'disabled') return c.json({ error: 'Account disabled.' }, 403)
  if (found.status === 'pending') return c.json({ error: 'Account pending approval.' }, 403)

  const session = await createSession(found.accountId)
  setSessionCookie(c, session.token, session.expiresAt)
  return c.json({
    user: {
      accountId: found.accountId,
      company: found.company,
      email: found.email,
      role: found.role,
      status: found.status,
    },
  })
})

authRoutes.post('/register', async (c) => {
  const body = z
    .object({
      accountId: z.string().min(3).max(40),
      password: z.string().min(4),
      company: z.string().min(1),
      email: z.string().email(),
      address: z.string().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid registration.' }, 400)

  const id = body.data.accountId.trim().toUpperCase()
  const exists = await prisma.account.findFirst({
    where: {
      OR: [{ accountId: id }, { email: body.data.email.trim() }],
    },
  })
  if (exists) return c.json({ error: 'Account ID or email already taken.' }, 409)

  const created = await prisma.account.create({
    data: {
      accountId: id,
      passwordHash: hashPassword(body.data.password),
      company: body.data.company.trim(),
      email: body.data.email.trim(),
      address: body.data.address?.trim() || null,
      role: 'member',
      status: 'pending',
    },
  })

  await notify({
    id: `N-AUTH-WELCOME-${id}`,
    accountId: id,
    kind: 'auth',
    title: 'Welcome to Equarios',
    body: 'Your account is pending Super approval. We will email you when it is active.',
    href: '/login',
  })
  await notifyStaff(
    'auth',
    'New signup pending approval',
    `${id} · ${created.company} · ${created.email}`,
    '/super',
    `N-AUTH-SIGNUP-${id}`,
  )

  return c.json({ account: mapAccount(created), message: 'Registered. Wait for Super approval.' }, 201)
})

authRoutes.post('/password-reset/request', async (c) => {
  const body = z
    .object({ ident: z.string().min(1) })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Account ID or email required.' }, 400)

  const ident = body.data.ident.trim()
  const found = await prisma.account.findFirst({
    where: { OR: [{ accountId: ident.toUpperCase() }, { email: ident }] },
  })
  // Same response either way — avoid account enumeration
  if (!found || found.status === 'disabled') {
    return c.json({ ok: true, message: 'If that account exists, a reset code was sent.' })
  }

  const code = String(1000 + Math.floor(Math.random() * 9000))
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
  await prisma.passwordReset.deleteMany({ where: { accountId: found.accountId } })
  await prisma.passwordReset.create({
    data: { accountId: found.accountId, code, expiresAt },
  })

  await sendMail({
    to: found.email,
    subject: '[Equarios] Password reset code',
    text: `Your reset code is ${code}. It expires in 30 minutes.\n\nIf you did not request this, ignore this email.`,
  })

  const expose = process.env.MAIL_EXPOSE_CODES === '1' || !process.env.RESEND_API_KEY
  return c.json({
    ok: true,
    message: 'If that account exists, a reset code was sent.',
    ...(expose ? { code, email: found.email } : {}),
  })
})

authRoutes.post('/password-reset/confirm', async (c) => {
  const body = z
    .object({
      ident: z.string().min(1),
      code: z.string().min(4),
      password: z.string().min(6),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid reset request.' }, 400)

  const ident = body.data.ident.trim()
  const found = await prisma.account.findFirst({
    where: { OR: [{ accountId: ident.toUpperCase() }, { email: ident }] },
  })
  if (!found) return c.json({ error: 'Invalid account or code.' }, 400)

  const row = await prisma.passwordReset.findFirst({
    where: { accountId: found.accountId },
    orderBy: { createdAt: 'desc' },
  })
  if (!row || row.code !== body.data.code.trim()) {
    return c.json({ error: 'That reset code does not match.' }, 400)
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return c.json({ error: 'That reset code expired. Request a new one.' }, 400)
  }

  await prisma.account.update({
    where: { accountId: found.accountId },
    data: { passwordHash: hashPassword(body.data.password) },
  })
  await prisma.passwordReset.deleteMany({ where: { accountId: found.accountId } })
  await prisma.session.deleteMany({ where: { accountId: found.accountId } })

  await notify({
    id: `N-AUTH-RESET-${found.accountId}-${Date.now()}`,
    accountId: found.accountId,
    kind: 'auth',
    title: 'Password changed',
    body: 'Your password was reset successfully. Sign in with the new password.',
    href: '/login',
  })

  return c.json({ ok: true })
})

authRoutes.post('/logout', requireUser, async (c) => {
  const token = getCookie(c, COOKIE)
  if (token) {
    await prisma.session.deleteMany({ where: { token } })
  }
  clearSessionCookie(c)
  return c.json({ ok: true })
})

authRoutes.get('/accounts', requireUser, requireStaffGate, async (c) => {
  const rows = await prisma.account.findMany({ orderBy: { accountId: 'asc' } })
  return c.json({ accounts: rows.map(mapAccount) })
})

async function requireStaffGate(c: any, next: any) {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ error: 'Staff only.' }, 403)
  }
  await next()
}
