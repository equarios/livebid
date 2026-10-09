import { prisma } from './db'
import { sendMail } from './mail'

export type NoticeKind =
  | 'win'
  | 'invoice'
  | 'outbid'
  | 'closing'
  | 'fill'
  | 'offer'
  | 'cart'
  | 'payment'
  | 'shipping'
  | 'auth'

export type EmailPrefs = {
  win: boolean
  offer: boolean
  cart: boolean
  invoice: boolean
  payment: boolean
  shipping: boolean
  auth: boolean
  outbid: boolean
  closing: boolean
  fill: boolean
}

export const DEFAULT_EMAIL_PREFS: EmailPrefs = {
  win: true,
  offer: true,
  cart: true,
  invoice: true,
  payment: true,
  shipping: true,
  auth: true,
  outbid: false,
  closing: false,
  fill: false,
}

export function parseEmailPrefs(raw: string | null | undefined): EmailPrefs {
  try {
    const parsed = JSON.parse(raw || '{}') as Partial<EmailPrefs>
    return { ...DEFAULT_EMAIL_PREFS, ...parsed }
  } catch {
    return { ...DEFAULT_EMAIL_PREFS }
  }
}

/** Map notice kind → email pref key (invoice kind covers unpaid invoice alerts). */
function prefForKind(kind: NoticeKind): keyof EmailPrefs {
  if (kind === 'invoice') return 'invoice'
  if (kind === 'payment') return 'payment'
  if (kind === 'shipping') return 'shipping'
  if (kind === 'auth') return 'auth'
  return kind
}

export type NotifyInput = {
  id: string
  accountId: string
  kind: NoticeKind
  title: string
  body: string
  href: string
  /** Force email even if pref off (password reset). */
  forceEmail?: boolean
  /** Skip email even if pref on. */
  skipEmail?: boolean
}

/** Create in-app notice (idempotent by id) and optionally email. */
export async function notify(input: NotifyInput) {
  const existing = await prisma.notice.findUnique({ where: { id: input.id } })
  if (existing) return { notice: existing, emailed: false, created: false }

  const account = await prisma.account.findUnique({ where: { accountId: input.accountId } })
  if (!account) return { notice: null, emailed: false, created: false }

  const notice = await prisma.notice.create({
    data: {
      id: input.id,
      accountId: input.accountId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      href: input.href,
      at: BigInt(Date.now()),
      read: false,
    },
  })

  const prefs = parseEmailPrefs(account.emailPrefsJson)
  const wantEmail =
    input.forceEmail || (!input.skipEmail && prefs[prefForKind(input.kind)])

  let emailed = false
  if (wantEmail && account.email) {
    const result = await sendMail({
      to: account.email,
      subject: `[Equarios] ${input.title}`,
      text: `${input.body}\n\nOpen: ${process.env.APP_ORIGIN || 'http://localhost:5173'}${input.href}\n\n— Equarios`,
    })
    emailed = result.ok
  }

  return { notice, emailed, created: true }
}

export async function notifyMany(items: NotifyInput[]) {
  for (const item of items) {
    await notify(item)
  }
}

export async function notifyStaff(
  kind: NoticeKind,
  title: string,
  body: string,
  href: string,
  idPrefix: string,
) {
  const staff = await prisma.account.findMany({
    where: { role: { in: ['admin', 'superadmin'] }, status: 'active' },
  })
  const at = Date.now()
  for (const person of staff) {
    await notify({
      id: `${idPrefix}-${person.accountId}`,
      accountId: person.accountId,
      kind,
      title,
      body,
      href: person.role === 'superadmin' && href === '/admin' ? '/super' : href,
      skipEmail: false,
    })
    // stamp uniqueness if loop is fast
    void at
  }
}
