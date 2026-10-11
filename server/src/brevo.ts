/**
 * Brevo (Sendinblue) marketing API — contacts, lists, campaigns, reports.
 * Without BREVO_API_KEY, sync/send run in simulated mode for local demos.
 */

const API = 'https://api.brevo.com/v3'

export type BrevoContact = {
  email: string
  firstName?: string
  lastName?: string
  company?: string
  phone?: string
  tags?: string[]
}

export type BrevoCampaignStats = {
  sent?: number
  delivered?: number
  uniqueOpens?: number
  uniqueClicks?: number
  softBounces?: number
  hardBounces?: number
  unsubscriptions?: number
  complaints?: number
  viewed?: number
  trackableViews?: number
  deferred?: number
  [key: string]: unknown
}

function apiKey() {
  return process.env.BREVO_API_KEY?.trim() || ''
}

export function brevoConfigured() {
  return Boolean(apiKey())
}

export function brevoSender() {
  return {
    email: process.env.BREVO_SENDER_EMAIL?.trim() || process.env.MAIL_FROM?.replace(/.*<([^>]+)>.*/, '$1').trim() || 'noreply@example.com',
    name: process.env.BREVO_SENDER_NAME?.trim() || 'Equarios',
  }
}

async function brevoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const key = apiKey()
  if (!key) throw new Error('BREVO_API_KEY is not set.')
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'api-key': key,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  const text = await res.text()
  let data: unknown = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { message: text }
  }
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message: string }).message)
        : `Brevo ${res.status}`
    throw new Error(msg)
  }
  return data as T
}

async function brevoDefaultFolderId() {
  const envFolder = Number(process.env.BREVO_FOLDER_ID || 0)
  if (envFolder > 0) return envFolder
  const folders = await brevoFetch<{ folders?: Array<{ id: number }> }>('/contacts/folders?limit=10&offset=0')
  return folders.folders?.[0]?.id || 1
}

export async function brevoEnsureList(name = 'Equarios Clients', useEnvList = true): Promise<number> {
  const envId = Number(process.env.BREVO_LIST_ID || 0)
  if (useEnvList && envId > 0) return envId

  const existing = await brevoFetch<{ lists?: Array<{ id: number; name: string }> }>(
    '/contacts/lists?limit=50&offset=0',
  )
  const found = (existing.lists || []).find((l) => l.name === name)
  if (found) return found.id

  const folderId = await brevoDefaultFolderId()
  const created = await brevoFetch<{ id: number }>('/contacts/lists', {
    method: 'POST',
    body: JSON.stringify({ name, folderId }),
  })
  return created.id
}

export async function brevoUpsertContact(c: BrevoContact, listIds: number[]) {
  await brevoFetch('/contacts', {
    method: 'POST',
    body: JSON.stringify({
      email: c.email.toLowerCase(),
      updateEnabled: true,
      listIds,
      attributes: {
        FIRSTNAME: c.firstName || '',
        LASTNAME: c.lastName || '',
        COMPANY: c.company || '',
        SMS: c.phone || undefined,
        TAGS: (c.tags || []).join(','),
      },
    }),
  })
}

/** Import up to ~8k contacts per call (JSON body). Chunks handled by caller. */
export async function brevoImportContacts(contacts: BrevoContact[], listIds: number[]) {
  if (!contacts.length) return { processId: 0 }
  return brevoFetch<{ processId: number }>('/contacts/import', {
    method: 'POST',
    body: JSON.stringify({
      listIds,
      updateExistingContacts: true,
      emptyContactsAttributes: false,
      jsonBody: contacts.map((c) => ({
        email: c.email.toLowerCase(),
        attributes: {
          FIRSTNAME: c.firstName || '',
          LASTNAME: c.lastName || '',
          COMPANY: c.company || '',
        },
      })),
    }),
  })
}

export async function brevoCreateCampaign(input: {
  name: string
  subject: string
  previewText?: string
  htmlContent: string
  listIds: number[]
  tag?: string
}) {
  const sender = brevoSender()
  // Brevo requires unsubscribe in campaign HTML — inject if missing
  let html = input.htmlContent
  if (!/unsubscribe|{{\s*unsubscribe\s*}}/i.test(html)) {
    html +=
      '<p style="font-size:12px;color:#666;margin-top:24px">Equarios · <a href="{{ unsubscribe }}">Unsubscribe</a></p>'
  }

  return brevoFetch<{ id: number }>('/emailCampaigns', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      subject: input.subject,
      previewText: input.previewText || undefined,
      sender: { email: sender.email, name: sender.name },
      htmlContent: html,
      recipients: { listIds: input.listIds },
      tag: input.tag || 'equarios',
      inlineImageActivation: false,
    }),
  })
}

export async function brevoSendCampaignNow(campaignId: number) {
  return brevoFetch(`/emailCampaigns/${campaignId}/sendNow`, { method: 'POST' })
}

export async function brevoGetCampaign(campaignId: number) {
  return brevoFetch<{
    id: number
    name: string
    status: string
    statistics?: {
      globalStats?: BrevoCampaignStats
      campaignStats?: BrevoCampaignStats[]
    }
  }>(`/emailCampaigns/${campaignId}`)
}

export function mapBrevoStats(raw: {
  statistics?: { globalStats?: BrevoCampaignStats }
}): BrevoCampaignStats {
  return raw.statistics?.globalStats || {}
}
