import { createHash, randomBytes } from 'node:crypto'
import type { Context, Next } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { prisma } from './db'

export const COOKIE = 'livebid_session'

export type SessionUser = {
  accountId: string
  company: string
  email: string
  role: 'superadmin' | 'admin' | 'member'
  status: 'pending' | 'active' | 'disabled'
}

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const hash = createHash('sha256').update(`${salt}:${password}`).digest('hex')
  return `${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split('$')
  if (!salt || !hash) return false
  const next = createHash('sha256').update(`${salt}:${password}`).digest('hex')
  return next === hash
}

export async function createSession(accountId: string) {
  const token = randomBytes(32).toString('hex')
  const days = Number(process.env.SESSION_DAYS || 14)
  const expiresAt = new Date(Date.now() + days * 86400000)
  await prisma.session.create({ data: { token, accountId, expiresAt } })
  return { token, expiresAt }
}

export async function destroySession(token: string) {
  await prisma.session.deleteMany({ where: { token } })
}

export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null
  const session = await prisma.session.findUnique({
    where: { token },
    include: { account: true },
  })
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  const a = session.account
  if (a.status === 'disabled') return null
  return {
    accountId: a.accountId,
    company: a.company,
    email: a.email,
    role: a.role as SessionUser['role'],
    status: a.status as SessionUser['status'],
  }
}

export function setSessionCookie(c: Context, token: string, expiresAt: Date) {
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
  })
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, COOKIE, { path: '/' })
}

export type AuthedEnv = { Variables: { user: SessionUser } }

export async function requireUser(c: Context<AuthedEnv>, next: Next) {
  const token = getCookie(c, COOKIE)
  const user = await userFromToken(token)
  if (!user) return c.json({ error: 'Sign in required.' }, 401)
  if (user.status === 'pending') return c.json({ error: 'Account pending approval.' }, 403)
  c.set('user', user)
  await next()
}

export async function requireStaff(c: Context<AuthedEnv>, next: Next) {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ error: 'Staff only.' }, 403)
  }
  await next()
}

export async function requireSuper(c: Context<AuthedEnv>, next: Next) {
  const user = c.get('user')
  if (user.role !== 'superadmin') {
    return c.json({ error: 'Super admin only.' }, 403)
  }
  await next()
}

export async function optionalUser(c: Context<AuthedEnv>, next: Next) {
  const token = getCookie(c, COOKIE)
  const user = await userFromToken(token)
  if (user && user.status === 'active') c.set('user', user)
  await next()
}
