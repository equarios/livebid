import { Hono } from 'hono'
import { z } from 'zod'
import { requireStaff, requireUser, type AuthedEnv } from '../auth'
import {
  brevoConfigured,
  brevoCreateCampaign,
  brevoEnsureList,
  brevoGetCampaign,
  brevoImportContacts,
  brevoSendCampaignNow,
  mapBrevoStats,
  type BrevoContact,
} from '../brevo'
import { prisma } from '../db'

export const marketingRoutes = new Hono<AuthedEnv>()
/** Public Brevo webhooks (no session). */
export const marketingHookRoutes = new Hono()

marketingRoutes.use('*', requireUser, requireStaff)

function parseTags(raw: string) {
  return raw
    .split(/[,;]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

function clientDto(c: {
  id: string
  email: string
  firstName: string
  lastName: string
  company: string
  phone: string
  tags: string
  status: string
  consentAt: Date | null
  source: string
  accountId: string | null
  brevoId: string | null
  lastSyncedAt: Date | null
  note: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: c.id,
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
    company: c.company,
    phone: c.phone,
    tags: parseTags(c.tags),
    status: c.status,
    consentAt: c.consentAt?.toISOString() ?? null,
    source: c.source,
    accountId: c.accountId,
    brevoId: c.brevoId,
    lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
    note: c.note,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

function campaignDto(c: {
  id: string
  name: string
  subject: string
  previewText: string
  htmlBody: string
  textBody: string
  audience: string
  status: string
  brevoCampaignId: string | null
  brevoListId: string | null
  errorMessage: string
  statsJson: string
  recipientCount: number
  createdBy: string
  sentAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  let stats: Record<string, unknown> = {}
  try {
    stats = JSON.parse(c.statsJson || '{}') as Record<string, unknown>
  } catch {
    stats = {}
  }
  return {
    id: c.id,
    name: c.name,
    subject: c.subject,
    previewText: c.previewText,
    htmlBody: c.htmlBody,
    textBody: c.textBody,
    audience: c.audience,
    status: c.status,
    brevoCampaignId: c.brevoCampaignId,
    brevoListId: c.brevoListId,
    errorMessage: c.errorMessage,
    stats,
    recipientCount: c.recipientCount,
    createdBy: c.createdBy,
    sentAt: c.sentAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    brevoReady: brevoConfigured(),
  }
}

async function audienceClients(audience: string) {
  const all = await prisma.marketingClient.findMany({
    where: { status: 'subscribed' },
    orderBy: { email: 'asc' },
  })
  if (audience === 'all_subscribed' || !audience) return all
  if (audience.startsWith('tag:')) {
    const tag = audience.slice(4).toLowerCase()
    return all.filter((c) => parseTags(c.tags).includes(tag))
  }
  return all
}

marketingRoutes.get('/status', async (c) => {
  const total = await prisma.marketingClient.count()
  const subscribed = await prisma.marketingClient.count({ where: { status: 'subscribed' } })
  const unsubscribed = await prisma.marketingClient.count({ where: { status: 'unsubscribed' } })
  const bounced = await prisma.marketingClient.count({ where: { status: 'bounced' } })
  return c.json({
    brevoConfigured: brevoConfigured(),
    total,
    subscribed,
    unsubscribed,
    bounced,
  })
})

marketingRoutes.get('/clients', async (c) => {
  const q = (c.req.query('q') || '').trim().toLowerCase()
  const status = c.req.query('status') || ''
  const tag = (c.req.query('tag') || '').trim().toLowerCase()
  const take = Math.min(200, Math.max(1, Number(c.req.query('limit') || 100)))
  const rows = await prisma.marketingClient.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q } },
              { firstName: { contains: q } },
              { lastName: { contains: q } },
              { company: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 5000,
  })
  const filtered = tag ? rows.filter((r) => parseTags(r.tags).includes(tag)) : rows
  return c.json({
    clients: filtered.slice(0, take).map(clientDto),
    total: filtered.length,
  })
})

marketingRoutes.post('/clients', async (c) => {
  const body = z
    .object({
      email: z.string().email(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      company: z.string().optional(),
      phone: z.string().optional(),
      tags: z.array(z.string()).optional(),
      status: z.enum(['subscribed', 'unsubscribed', 'bounced', 'complained']).optional(),
      note: z.string().optional(),
      accountId: z.string().optional(),
      consent: z.boolean().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid client.' }, 400)
  const email = body.data.email.trim().toLowerCase()
  const row = await prisma.marketingClient.upsert({
    where: { email },
    create: {
      email,
      firstName: body.data.firstName?.trim() || '',
      lastName: body.data.lastName?.trim() || '',
      company: body.data.company?.trim() || '',
      phone: body.data.phone?.trim() || '',
      tags: (body.data.tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean).join(','),
      status: body.data.status || 'subscribed',
      note: body.data.note?.trim() || '',
      accountId: body.data.accountId?.trim() || null,
      source: 'manual',
      consentAt: body.data.consent === false ? null : new Date(),
    },
    update: {
      firstName: body.data.firstName?.trim() || undefined,
      lastName: body.data.lastName?.trim() || undefined,
      company: body.data.company?.trim() || undefined,
      phone: body.data.phone?.trim() || undefined,
      tags: body.data.tags
        ? body.data.tags.map((t) => t.trim().toLowerCase()).filter(Boolean).join(',')
        : undefined,
      status: body.data.status,
      note: body.data.note?.trim(),
      accountId: body.data.accountId?.trim() || undefined,
      consentAt: body.data.consent === false ? null : undefined,
    },
  })
  return c.json({ client: clientDto(row) }, 201)
})

marketingRoutes.patch('/clients/:id', async (c) => {
  const id = c.req.param('id')
  const body = z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      company: z.string().optional(),
      phone: z.string().optional(),
      tags: z.array(z.string()).optional(),
      status: z.enum(['subscribed', 'unsubscribed', 'bounced', 'complained']).optional(),
      note: z.string().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid update.' }, 400)
  const found = await prisma.marketingClient.findUnique({ where: { id } })
  if (!found) return c.json({ error: 'Not found.' }, 404)
  const row = await prisma.marketingClient.update({
    where: { id },
    data: {
      ...(body.data.firstName != null ? { firstName: body.data.firstName.trim() } : {}),
      ...(body.data.lastName != null ? { lastName: body.data.lastName.trim() } : {}),
      ...(body.data.company != null ? { company: body.data.company.trim() } : {}),
      ...(body.data.phone != null ? { phone: body.data.phone.trim() } : {}),
      ...(body.data.tags
        ? { tags: body.data.tags.map((t) => t.trim().toLowerCase()).filter(Boolean).join(',') }
        : {}),
      ...(body.data.status ? { status: body.data.status } : {}),
      ...(body.data.note != null ? { note: body.data.note.trim() } : {}),
    },
  })
  return c.json({ client: clientDto(row) })
})

marketingRoutes.delete('/clients/:id', async (c) => {
  const id = c.req.param('id')
  await prisma.marketingClient.delete({ where: { id } }).catch(() => null)
  return c.json({ ok: true })
})

/** CSV: email,firstName,lastName,company,phone,tags,status */
marketingRoutes.post('/clients/import', async (c) => {
  const body = z
    .object({
      csv: z.string().min(1),
      defaultTags: z.array(z.string()).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'CSV required.' }, 400)

  const lines = body.data.csv
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return c.json({ error: 'CSV needs a header and at least one row.' }, 400)

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''))
  const idx = (name: string) => header.indexOf(name)
  const emailI = idx('email')
  if (emailI < 0) return c.json({ error: 'CSV must include an email column.' }, 400)

  let created = 0
  let updated = 0
  let skipped = 0
  const defaultTags = (body.data.defaultTags || []).map((t) => t.toLowerCase())

  for (const line of lines.slice(1)) {
    const cols = line.match(/("([^"]|"")*"|[^,]*)/g)?.map((x) => x.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) || []
    const email = (cols[emailI] || '').toLowerCase()
    if (!email || !email.includes('@')) {
      skipped++
      continue
    }
    const tagsRaw = idx('tags') >= 0 ? cols[idx('tags')] || '' : ''
    const tags = [...new Set([...parseTags(tagsRaw), ...defaultTags])]
    const statusRaw = (idx('status') >= 0 ? cols[idx('status')] : 'subscribed') || 'subscribed'
    const status = ['subscribed', 'unsubscribed', 'bounced', 'complained'].includes(statusRaw)
      ? statusRaw
      : 'subscribed'
    const existing = await prisma.marketingClient.findUnique({ where: { email } })
    await prisma.marketingClient.upsert({
      where: { email },
      create: {
        email,
        firstName: idx('firstname') >= 0 ? cols[idx('firstname')] || '' : idx('first_name') >= 0 ? cols[idx('first_name')] || '' : '',
        lastName: idx('lastname') >= 0 ? cols[idx('lastname')] || '' : idx('last_name') >= 0 ? cols[idx('last_name')] || '' : '',
        company: idx('company') >= 0 ? cols[idx('company')] || '' : '',
        phone: idx('phone') >= 0 ? cols[idx('phone')] || '' : '',
        tags: tags.join(','),
        status,
        source: 'csv',
        consentAt: status === 'subscribed' ? new Date() : null,
      },
      update: {
        firstName: idx('firstname') >= 0 || idx('first_name') >= 0 ? (cols[Math.max(idx('firstname'), idx('first_name'))] || undefined) : undefined,
        lastName: idx('lastname') >= 0 || idx('last_name') >= 0 ? (cols[Math.max(idx('lastname'), idx('last_name'))] || undefined) : undefined,
        company: idx('company') >= 0 ? cols[idx('company')] || undefined : undefined,
        phone: idx('phone') >= 0 ? cols[idx('phone')] || undefined : undefined,
        tags: tags.join(','),
        status,
      },
    })
    if (existing) updated++
    else created++
  }

  return c.json({ ok: true, created, updated, skipped })
})

marketingRoutes.post('/clients/sync-brevo', async (c) => {
  const subscribed = await prisma.marketingClient.findMany({
    where: { status: 'subscribed' },
    orderBy: { email: 'asc' },
  })
  if (!subscribed.length) return c.json({ error: 'No subscribed clients to sync.' }, 400)

  if (!brevoConfigured()) {
    const now = new Date()
    await prisma.marketingClient.updateMany({
      where: { status: 'subscribed' },
      data: { lastSyncedAt: now, brevoId: 'simulated' },
    })
    return c.json({
      ok: true,
      simulated: true,
      synced: subscribed.length,
      message: 'BREVO_API_KEY not set — marked synced locally only.',
    })
  }

  try {
    const listId = await brevoEnsureList()
    const chunkSize = 500
    let synced = 0
    for (let i = 0; i < subscribed.length; i += chunkSize) {
      const chunk = subscribed.slice(i, i + chunkSize)
      const payload: BrevoContact[] = chunk.map((r) => ({
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        company: r.company,
        phone: r.phone,
        tags: parseTags(r.tags),
      }))
      await brevoImportContacts(payload, [listId])
      await prisma.marketingClient.updateMany({
        where: { id: { in: chunk.map((x) => x.id) } },
        data: { lastSyncedAt: new Date(), brevoId: String(listId) },
      })
      synced += chunk.length
    }
    return c.json({ ok: true, synced, listId })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Brevo sync failed.' }, 502)
  }
})

marketingRoutes.get('/campaigns', async (c) => {
  const rows = await prisma.emailCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
  return c.json({ campaigns: rows.map(campaignDto), brevoConfigured: brevoConfigured() })
})

marketingRoutes.post('/campaigns', async (c) => {
  const user = c.get('user')
  const body = z
    .object({
      name: z.string().min(1),
      subject: z.string().min(1),
      previewText: z.string().optional(),
      htmlBody: z.string().min(10),
      textBody: z.string().optional(),
      audience: z.string().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Name, subject, and HTML body (10+ chars) required.' }, 400)

  const audience = body.data.audience || 'all_subscribed'
  const recipients = await audienceClients(audience)
  const row = await prisma.emailCampaign.create({
    data: {
      name: body.data.name.trim(),
      subject: body.data.subject.trim(),
      previewText: body.data.previewText?.trim() || '',
      htmlBody: body.data.htmlBody,
      textBody: body.data.textBody?.trim() || '',
      audience,
      status: 'draft',
      recipientCount: recipients.length,
      createdBy: user.accountId,
    },
  })
  return c.json({ campaign: campaignDto(row) }, 201)
})

marketingRoutes.post('/campaigns/:id/send', async (c) => {
  const id = c.req.param('id')
  const campaign = await prisma.emailCampaign.findUnique({ where: { id } })
  if (!campaign) return c.json({ error: 'Campaign not found.' }, 404)
  if (campaign.status === 'sent') return c.json({ error: 'Already sent.' }, 400)

  const recipients = await audienceClients(campaign.audience)
  const sendable = recipients.filter((r) => r.status === 'subscribed' && r.consentAt)
  if (!sendable.length) {
    // allow subscribed without consentAt for imported legacy lists
    const fallback = recipients.filter((r) => r.status === 'subscribed')
    if (!fallback.length) return c.json({ error: 'No subscribed recipients in audience.' }, 400)
  }
  const list = sendable.length ? sendable : recipients.filter((r) => r.status === 'subscribed')

  await prisma.emailCampaign.update({
    where: { id },
    data: { status: 'sending', recipientCount: list.length, errorMessage: '' },
  })

  if (!brevoConfigured()) {
    const updated = await prisma.emailCampaign.update({
      where: { id },
      data: {
        status: 'simulated',
        sentAt: new Date(),
        recipientCount: list.length,
        statsJson: JSON.stringify({
          sent: list.length,
          delivered: list.length,
          uniqueOpens: 0,
          uniqueClicks: 0,
          softBounces: 0,
          hardBounces: 0,
          unsubscriptions: 0,
          complaints: 0,
          note: 'Simulated — set BREVO_API_KEY to send for real.',
        }),
      },
    })
    return c.json({
      campaign: campaignDto(updated),
      simulated: true,
      message: 'Sent in simulated mode (no BREVO_API_KEY).',
    })
  }

  try {
    // Sync audience to a dedicated campaign list for clean targeting
    const listId = await brevoEnsureList(`Equarios · ${campaign.name}`.slice(0, 50), false)
    const chunkSize = 500
    for (let i = 0; i < list.length; i += chunkSize) {
      const chunk = list.slice(i, i + chunkSize)
      await brevoImportContacts(
        chunk.map((r) => ({
          email: r.email,
          firstName: r.firstName,
          lastName: r.lastName,
          company: r.company,
        })),
        [listId],
      )
    }

    const created = await brevoCreateCampaign({
      name: campaign.name,
      subject: campaign.subject,
      previewText: campaign.previewText || undefined,
      htmlContent: campaign.htmlBody,
      listIds: [listId],
      tag: 'equarios-admin',
    })
    await brevoSendCampaignNow(created.id)
    const remote = await brevoGetCampaign(created.id)
    const stats = mapBrevoStats(remote)

    const updated = await prisma.emailCampaign.update({
      where: { id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        brevoCampaignId: String(created.id),
        brevoListId: String(listId),
        recipientCount: list.length,
        statsJson: JSON.stringify(stats),
      },
    })
    return c.json({ campaign: campaignDto(updated) })
  } catch (e) {
    const updated = await prisma.emailCampaign.update({
      where: { id },
      data: {
        status: 'failed',
        errorMessage: e instanceof Error ? e.message : 'Brevo send failed',
      },
    })
    return c.json({ error: updated.errorMessage, campaign: campaignDto(updated) }, 502)
  }
})

marketingRoutes.post('/campaigns/:id/refresh', async (c) => {
  const id = c.req.param('id')
  const campaign = await prisma.emailCampaign.findUnique({ where: { id } })
  if (!campaign) return c.json({ error: 'Not found.' }, 404)
  if (!campaign.brevoCampaignId || !brevoConfigured()) {
    return c.json({ campaign: campaignDto(campaign), message: 'No Brevo campaign to refresh.' })
  }
  try {
    const remote = await brevoGetCampaign(Number(campaign.brevoCampaignId))
    const stats = mapBrevoStats(remote)
    const updated = await prisma.emailCampaign.update({
      where: { id },
      data: {
        statsJson: JSON.stringify(stats),
        status: remote.status === 'sent' || remote.status === 'queued' ? campaign.status : campaign.status,
      },
    })
    return c.json({ campaign: campaignDto(updated) })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Refresh failed.' }, 502)
  }
})

marketingHookRoutes.post('/brevo', async (c) => {
  const secret = process.env.BREVO_WEBHOOK_SECRET?.trim()
  if (secret) {
    const got = c.req.header('x-equarios-webhook-secret') || c.req.query('secret') || ''
    if (got !== secret) return c.json({ error: 'Unauthorized.' }, 401)
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    event?: string
    email?: string
    /** Brevo sometimes sends arrays */
    items?: Array<{ event?: string; email?: string }>
  }

  const events = body.items?.length
    ? body.items
    : body.email
      ? [{ event: body.event, email: body.email }]
      : []

  let updated = 0
  for (const ev of events) {
    const email = (ev.email || '').toLowerCase()
    if (!email) continue
    const event = (ev.event || '').toLowerCase()
    let status: string | null = null
    if (event.includes('unsubscribe')) status = 'unsubscribed'
    else if (event.includes('hard_bounce') || event === 'hardbounce' || event.includes('blocked')) {
      status = 'bounced'
    } else if (event.includes('spam') || event.includes('complaint')) status = 'complained'
    if (!status) continue
    const res = await prisma.marketingClient.updateMany({
      where: { email },
      data: { status },
    })
    updated += res.count
  }
  return c.json({ ok: true, updated })
})
