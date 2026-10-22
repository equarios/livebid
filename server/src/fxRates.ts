import { prisma } from './db'

const STALE_MS = 20 * 60 * 60 * 1000
const FEED = 'https://open.er-api.com/v6/latest/USD'

export type FxSnapshot = {
  base: 'USD'
  rates: Record<string, number>
  fetchedAt: string | null
}

function money(n: number) {
  return Math.round(n * 100) / 100
}

/** Convert a USD amount using units-per-USD rate. */
export function usdToDisplay(usd: number, perUsd: number) {
  return money(usd * (Number.isFinite(perUsd) && perUsd > 0 ? perUsd : 1))
}

export async function loadFxSnapshot(): Promise<FxSnapshot> {
  const rows = await prisma.fxRate.findMany({ orderBy: { code: 'asc' } })
  const rates: Record<string, number> = { USD: 1 }
  let fetchedAt: string | null = null
  for (const row of rows) {
    rates[row.code] = row.perUsd
    const iso = row.fetchedAt.toISOString()
    if (!fetchedAt || iso > fetchedAt) fetchedAt = iso
  }
  return { base: 'USD', rates, fetchedAt }
}

export async function getPerUsd(code: string): Promise<number> {
  const c = (code || 'USD').trim().toUpperCase() || 'USD'
  if (c === 'USD') return 1
  const row = await prisma.fxRate.findUnique({ where: { code: c } })
  return row && row.perUsd > 0 ? row.perUsd : 1
}

async function fetchRemoteRates(): Promise<{ rates: Record<string, number>; source: string } | null> {
  try {
    const res = await fetch(FEED, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return null
    const data = (await res.json()) as {
      result?: string
      rates?: Record<string, number>
    }
    if (data.result !== 'success' || !data.rates || typeof data.rates !== 'object') return null
    const rates: Record<string, number> = { USD: 1 }
    for (const [code, n] of Object.entries(data.rates)) {
      const c = code.trim().toUpperCase()
      if (!/^[A-Z]{3}$/.test(c)) continue
      if (!Number.isFinite(n) || n <= 0) continue
      rates[c] = n
    }
    return { rates, source: 'open.er-api.com' }
  } catch (err) {
    console.error('[fx] feed failed', err)
    return null
  }
}

/** Upsert full rate table from the public feed. */
export async function refreshFxRates(): Promise<FxSnapshot> {
  const remote = await fetchRemoteRates()
  if (!remote) return loadFxSnapshot()

  const now = new Date()
  const entries = Object.entries(remote.rates)
  await prisma.$transaction(
    entries.map(([code, perUsd]) =>
      prisma.fxRate.upsert({
        where: { code },
        create: { code, perUsd, source: remote.source, fetchedAt: now },
        update: { perUsd, source: remote.source, fetchedAt: now },
      }),
    ),
  )
  return loadFxSnapshot()
}

/** Refresh when empty or older than ~20h. Safe to call from care loop. */
export async function ensureFxRatesFresh(): Promise<void> {
  const newest = await prisma.fxRate.findFirst({ orderBy: { fetchedAt: 'desc' } })
  if (newest && Date.now() - newest.fetchedAt.getTime() < STALE_MS) return
  await refreshFxRates()
}
