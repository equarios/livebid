import { Hono } from 'hono'
import { z } from 'zod'
import { optionalUser, requireStaff, requireUser, type AuthedEnv } from '../auth'
import { sendMail } from '../mail'
import { notifyStaff } from '../notify'
import {
  countOpenProductEnquiries,
  createProductEnquiry,
  listProductEnquiries,
  setProductEnquiryStatus,
} from '../productEnquiry'
import { rateLimitOrRetryAfter } from '../rateLimit'

export const enquiryRoutes = new Hono<AuthedEnv>()

const createSchema = z.object({
  channel: z.enum(['store', 'auction', 'marketplace']),
  itemId: z.string().min(1).max(80),
  itemTitle: z.string().min(1).max(200),
  itemHref: z.string().max(300).optional(),
  name: z.string().min(1).max(120),
  email: z.string().email().max(160),
  message: z.string().min(3).max(2000),
})

function enquiryInboxTo() {
  return (
    process.env.ENQUIRY_EMAIL?.trim() ||
    process.env.MAIL_ENQUIRY?.trim() ||
    'enquiry@equarios.com'
  )
}

enquiryRoutes.post('/', optionalUser, async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  const retry = await rateLimitOrRetryAfter(`enquiry:${ip}`, 8, 60)
  if (retry) return c.json({ error: 'Too many questions — try again in a minute.' }, 429)

  const body = createSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Check name, email, and your question.' }, 400)

  const user = c.get('user')
  const href =
    (body.data.itemHref || '').trim() ||
    (body.data.channel === 'store'
      ? `/store/p/${encodeURIComponent(body.data.itemId)}`
      : '/')

  const row = createProductEnquiry({
    channel: body.data.channel,
    itemId: body.data.itemId.trim(),
    itemTitle: body.data.itemTitle.trim(),
    itemHref: href,
    name: body.data.name.trim(),
    email: body.data.email.trim().toLowerCase(),
    accountId: user?.accountId ?? null,
    message: body.data.message.trim(),
  })

  const channelLabel =
    row.channel === 'store' ? 'Store' : row.channel === 'auction' ? 'Auction' : 'Marketplace'
  const staffHref = '/admin?section=commerce&desk=asks'
  await notifyStaff(
    'offer',
    `Product question · ${channelLabel}`,
    `${row.name} asks about ${row.itemTitle} (${row.itemId}): ${row.message.slice(0, 160)}`,
    staffHref,
    `N-ASK-${row.id}`,
  )

  const origin = process.env.APP_ORIGIN || process.env.SITE_URL || 'http://localhost:5173'
  await sendMail({
    to: enquiryInboxTo(),
    subject: `[Equarios] Ask · ${channelLabel} · ${row.itemTitle}`,
    text: [
      `Enquiry ${row.id}`,
      `Channel: ${channelLabel}`,
      `Item: ${row.itemTitle} (${row.itemId})`,
      `Link: ${origin}${href.startsWith('/') ? href : `/${href}`}`,
      `From: ${row.name} <${row.email}>`,
      row.accountId ? `Account: ${row.accountId}` : null,
      '',
      row.message,
      '',
      `Desk: ${origin}${staffHref}`,
    ]
      .filter(Boolean)
      .join('\n'),
  })

  return c.json({ enquiry: row }, 201)
})

enquiryRoutes.get('/', requireUser, requireStaff, async (c) => {
  const status = c.req.query('status')
  const rows =
    status === 'open' || status === 'done'
      ? listProductEnquiries({ status })
      : listProductEnquiries()
  return c.json({ enquiries: rows, openCount: countOpenProductEnquiries() })
})

enquiryRoutes.get('/count', requireUser, requireStaff, async (c) => {
  return c.json({ openCount: countOpenProductEnquiries() })
})

enquiryRoutes.patch('/:id', requireUser, requireStaff, async (c) => {
  const body = z
    .object({ status: z.enum(['open', 'done']) })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid status.' }, 400)
  const id = (c.req.param('id') || '').trim()
  if (!id) return c.json({ error: 'Not found.' }, 404)
  const row = setProductEnquiryStatus(id, body.data.status)
  if (!row) return c.json({ error: 'Not found.' }, 404)
  return c.json({ enquiry: row })
})
