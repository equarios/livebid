/**
 * HiCellTek TAC/IMEI lookup (optional). Free tier ~100 req/mo with API key.
 * https://hicelltek.com/en/imei-api/
 *
 * Env: HICELLTEK_API_KEY — when unset, remote lookup is skipped.
 */

const ENDPOINT = 'https://imei.hicelltek.com/api/v1/tac/lookup'

export type HicelltekTacHit = {
  tac: string
  brand: string
  model: string
  name: string
  remainingLookups?: number
}

export function hicelltekConfigured() {
  return Boolean(process.env.HICELLTEK_API_KEY?.trim())
}

export async function fetchHicelltekTac(query: string): Promise<HicelltekTacHit | null> {
  const key = process.env.HICELLTEK_API_KEY?.trim()
  if (!key) return null

  const q = String(query || '').replace(/\D/g, '')
  if (q.length < 8) return null

  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Api-Key': key,
      },
      body: JSON.stringify({ query: q.length >= 14 ? q.slice(0, 15) : q.slice(0, 8) }),
      signal: AbortSignal.timeout(8000),
    })
  } catch (e) {
    console.warn('[hicelltek] request failed', e instanceof Error ? e.message : e)
    return null
  }

  // Misses often return HTTP 404 with { found: false }. Quota/auth are hard errors.
  if (res.status === 401 || res.status === 429) {
    console.warn('[hicelltek] status', res.status)
    return null
  }

  const data = (await res.json().catch(() => null)) as {
    found?: boolean
    error?: string
    tac?: string
    brand?: { name?: string } | string
    model?: string
    marketing_name?: string
    meta?: { remaining_lookups?: number }
  } | null

  if (!data) return null
  if (data.error === 'quota_exceeded' || data.error === 'captcha_required') {
    console.warn('[hicelltek]', data.error)
    return null
  }
  // Success payloads may omit `found`; only treat explicit false as a miss.
  if (data.found === false || res.status === 404) return null
  if (!res.ok) {
    console.warn('[hicelltek] status', res.status)
    return null
  }

  const brand =
    typeof data.brand === 'string' ? data.brand.trim() : String(data.brand?.name || '').trim()
  const model = String(data.model || data.marketing_name || '').trim()
  const tac = String(data.tac || q.slice(0, 8)).replace(/\D/g, '').slice(0, 8)
  if (!brand || !model || tac.length !== 8) return null

  return {
    tac,
    brand: brand.slice(0, 80),
    model: model.slice(0, 120),
    name: String(data.marketing_name || model).trim().slice(0, 160),
    remainingLookups: data.meta?.remaining_lookups,
  }
}
