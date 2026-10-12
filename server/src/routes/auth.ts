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
  toSessionUser,
  userFromToken,
  verifyPassword,
  type AuthedEnv,
} from '../auth'
import { prisma } from '../db'
import { mapAccount } from '../map'
import { notify, notifyStaff } from '../notify'
import { sendMail } from '../mail'

export const authRoutes = new Hono<AuthedEnv>()

function exposeCodes() {
  return process.env.MAIL_EXPOSE_CODES === '1' || !process.env.RESEND_API_KEY
}

function suggestAccountId(email: string, firstName: string, lastName: string) {
  const local = email.split('@')[0]?.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()
  if (local) return `LB-${local}`
  const name = `${firstName}${lastName}`.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()
  return name ? `LB-${name}` : `LB-${Date.now().toString(36).toUpperCase()}`
}

async function issueEmailCode(accountId: string, email: string) {
  const code = String(1000 + Math.floor(Math.random() * 9000))
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await prisma.emailVerify.deleteMany({ where: { accountId } })
  await prisma.emailVerify.create({ data: { accountId, code, expiresAt } })
  await sendMail({
    to: email,
    subject: '[Equarios] Verify your email',
    text: `Your verification code is ${code}. It expires in 24 hours.\n\nEnter it on the sign-up page to activate your account.`,
  })
  return code
}

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
      OR: [{ accountId: ident.toUpperCase() }, { email: ident }],
    },
  })

  if (!found || !verifyPassword(body.data.password, found.passwordHash)) {
    return c.json({ error: 'Invalid account or password.' }, 401)
  }
  if (found.status === 'disabled') return c.json({ error: 'Account disabled.' }, 403)
  if (found.status === 'pending') {
    return c.json({ error: 'Account pending approval. Contact support if this persists.' }, 403)
  }
  if (!found.emailVerified) {
    const code = await issueEmailCode(found.accountId, found.email)
    return c.json(
      {
        error: 'Verify your email before signing in.',
        needsVerify: true,
        accountId: found.accountId,
        email: found.email,
        ...(exposeCodes() ? { code } : {}),
      },
      403,
    )
  }

  const session = await createSession(found.accountId)
  setSessionCookie(c, session.token, session.expiresAt)
  return c.json({ user: toSessionUser(found) })
})

authRoutes.post('/register', async (c) => {
  const body = z
    .object({
      firstName: z.string().min(1).max(80),
      lastName: z.string().min(1).max(80),
      email: z.string().email(),
      emailConfirm: z.string().email(),
      password: z.string().min(6),
      passwordConfirm: z.string().min(6),
      company: z.string().optional(),
      accountId: z.string().min(3).max(40).optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Fill all required fields. Password min 6 characters.' }, 400)

  const email = body.data.email.trim().toLowerCase()
  const emailConfirm = body.data.emailConfirm.trim().toLowerCase()
  if (email !== emailConfirm) return c.json({ error: 'Email addresses do not match.' }, 400)
  if (body.data.password !== body.data.passwordConfirm) {
    return c.json({ error: 'Passwords do not match.' }, 400)
  }

  const firstName = body.data.firstName.trim()
  const lastName = body.data.lastName.trim()
  let id = (body.data.accountId || suggestAccountId(email, firstName, lastName)).trim().toUpperCase()
  const exists = await prisma.account.findFirst({
    where: { OR: [{ accountId: id }, { email }] },
  })
  if (exists?.email === email) return c.json({ error: 'Email already registered. Sign in instead.' }, 409)
  if (exists) {
    id = `${id}-${Math.floor(Math.random() * 90 + 10)}`
  }

  const company =
    body.data.company?.trim() ||
    [firstName, lastName].filter(Boolean).join(' ') ||
    id

  const created = await prisma.account.create({
    data: {
      accountId: id,
      passwordHash: hashPassword(body.data.password),
      company,
      email,
      firstName,
      lastName,
      address: body.data.address?.trim() || null,
      phone: body.data.phone?.trim() || null,
      role: 'member',
      status: 'active',
      emailVerified: false,
      wholesaleStatus: 'none',
    },
  })

  const code = await issueEmailCode(id, email)

  await notify({
    id: `N-AUTH-WELCOME-${id}`,
    accountId: id,
    kind: 'auth',
    title: 'Welcome to Equarios',
    body: 'Verify your email, then shop the store. Apply for wholesale from My Page when ready.',
    href: '/register',
  })
  await notifyStaff(
    'auth',
    'New retail signup',
    `${id} · ${created.company} · ${created.email}`,
    '/super?section=accounts',
    `N-AUTH-SIGNUP-${id}`,
  )

  return c.json(
    {
      account: mapAccount(created),
      needsVerify: true,
      message: 'Check your email for a verification code.',
      ...(exposeCodes() ? { code, email } : {}),
    },
    201,
  )
})

authRoutes.post('/verify-email', async (c) => {
  const body = z
    .object({
      ident: z.string().min(1),
      code: z.string().min(4),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Account and code required.' }, 400)

  const ident = body.data.ident.trim()
  const found = await prisma.account.findFirst({
    where: { OR: [{ accountId: ident.toUpperCase() }, { email: ident.toLowerCase() }] },
  })
  if (!found) return c.json({ error: 'Invalid account or code.' }, 400)
  if (found.emailVerified) {
    const session = await createSession(found.accountId)
    setSessionCookie(c, session.token, session.expiresAt)
    return c.json({ user: toSessionUser(found), message: 'Already verified.' })
  }

  const row = await prisma.emailVerify.findFirst({
    where: { accountId: found.accountId },
    orderBy: { createdAt: 'desc' },
  })
  if (!row || row.code !== body.data.code.trim()) {
    return c.json({ error: 'That verification code does not match.' }, 400)
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return c.json({ error: 'That code expired. Request a new one.' }, 400)
  }

  const updated = await prisma.account.update({
    where: { accountId: found.accountId },
    data: { emailVerified: true },
  })
  await prisma.emailVerify.deleteMany({ where: { accountId: found.accountId } })

  const session = await createSession(updated.accountId)
  setSessionCookie(c, session.token, session.expiresAt)

  await notify({
    id: `N-AUTH-VERIFIED-${updated.accountId}-${Date.now()}`,
    accountId: updated.accountId,
    kind: 'auth',
    title: 'Email verified',
    body: 'Your account is ready. Shop the store, or apply for wholesale from My Page.',
    href: '/account',
  })

  return c.json({ user: toSessionUser(updated), message: 'Email verified.' })
})

authRoutes.post('/verify-email/resend', async (c) => {
  const body = z
    .object({ ident: z.string().min(1) })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Account ID or email required.' }, 400)

  const ident = body.data.ident.trim()
  const found = await prisma.account.findFirst({
    where: { OR: [{ accountId: ident.toUpperCase() }, { email: ident.toLowerCase() }] },
  })
  if (!found || found.status === 'disabled' || found.emailVerified) {
    return c.json({ ok: true, message: 'If that account needs verification, a new code was sent.' })
  }
  const code = await issueEmailCode(found.accountId, found.email)
  return c.json({
    ok: true,
    message: 'If that account needs verification, a new code was sent.',
    ...(exposeCodes() ? { code, email: found.email } : {}),
  })
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

  return c.json({
    ok: true,
    message: 'If that account exists, a reset code was sent.',
    ...(exposeCodes() ? { code, email: found.email } : {}),
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

authRoutes.patch('/accounts/:id', requireUser, requireStaffGate, async (c) => {
  const id = (c.req.param('id') ?? '').toUpperCase()
  const body = z
    .object({
      status: z.enum(['pending', 'active', 'disabled']).optional(),
      role: z.enum(['member', 'admin', 'superadmin']).optional(),
      wholesaleStatus: z
        .enum(['none', 'submitted', 'needs_docs', 'under_review', 'approved', 'rejected'])
        .optional(),
      emailVerified: z.boolean().optional(),
      company: z.string().optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid update.' }, 400)
  const found = await prisma.account.findUnique({ where: { accountId: id } })
  if (!found) return c.json({ error: 'Account not found.' }, 404)
  const updated = await prisma.account.update({
    where: { accountId: id },
    data: {
      ...(body.data.status != null ? { status: body.data.status } : {}),
      ...(body.data.role != null ? { role: body.data.role } : {}),
      ...(body.data.wholesaleStatus != null ? { wholesaleStatus: body.data.wholesaleStatus } : {}),
      ...(body.data.emailVerified != null ? { emailVerified: body.data.emailVerified } : {}),
      ...(body.data.company != null ? { company: body.data.company.trim() } : {}),
      ...(body.data.email != null ? { email: body.data.email.trim() } : {}),
      ...(body.data.address != null ? { address: body.data.address.trim() || null } : {}),
      ...(body.data.phone != null ? { phone: body.data.phone.trim() || null } : {}),
    },
  })
  return c.json({ account: mapAccount(updated) })
})

async function requireStaffGate(c: any, next: any) {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ error: 'Staff only.' }, 403)
  }
  await next()
}
