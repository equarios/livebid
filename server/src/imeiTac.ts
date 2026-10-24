import { prisma } from './db'
import { fetchHicelltekTac, hicelltekConfigured } from './hicelltekTac'

/** Digits only. */
export function normImei(raw: string) {
  return String(raw || '').replace(/\D/g, '')
}

/** GSMA Luhn over 14 digits; 15th is check. Also accept 14–16 digit strings. */
export function isValidImei(raw: string) {
  const d = normImei(raw)
  if (d.length < 14 || d.length > 16) return false
  if (!/^\d+$/.test(d)) return false
  const body = d.slice(0, 14)
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let n = Number(body[i])
    if (i % 2 === 1) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }
  const check = (10 - (sum % 10)) % 10
  if (d.length === 14) return true
  return check === Number(d[14])
}

export function tacFromImei(imei: string) {
  const d = normImei(imei)
  return d.slice(0, 8)
}

function normToken(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Collapse common TAC vendor spellings to Matrix brands. */
function brandKey(s: string) {
  let t = normToken(s)
  if (t.startsWith('apple')) return 'apple'
  if (t.startsWith('samsung')) return 'samsung'
  if (t.startsWith('google') || t.includes('pixel')) return 'google'
  if (t.startsWith('xiaomi') || t === 'redmi' || t === 'poco') return 'xiaomi'
  if (t.startsWith('huawei') || t.startsWith('honor')) return t.split(' ')[0]
  if (t.startsWith('oneplus')) return 'oneplus'
  if (t.startsWith('oppo')) return 'oppo'
  if (t.startsWith('vivo')) return 'vivo'
  if (t.startsWith('motorola') || t === 'moto') return 'motorola'
  if (t.startsWith('nokia')) return 'nokia'
  if (t.startsWith('sony')) return 'sony'
  if (t.startsWith('lg ')) return 'lg'
  return t
}

export type MatrixDeviceRow = {
  id: string
  brand: string
  model: string
  modelNumber?: string | null
  capacity: string
  baseUsd: number
  active: boolean
}

/** Match TAC brand/model against active buy matrix. */
export function matchMatrixDevices(
  brand: string,
  model: string,
  matrix: MatrixDeviceRow[],
): MatrixDeviceRow[] {
  const b = brandKey(brand)
  const m = normToken(model)
  if (!b || !m) return []

  const active = matrix.filter((d) => d.active && d.baseUsd > 0)
  const brandHit = active.filter((d) => brandKey(d.brand) === b)

  const scored = brandHit
    .map((d) => {
      const dm = normToken(d.model)
      let score = 0
      if (m === dm) score = 100
      else if (m.includes(dm) || dm.includes(m)) score = 80
      else {
        // "Galaxy S24 Ultra" vs matrix "Galaxy S24"
        const parts = dm.split(' ').filter((p) => p.length > 1)
        const hits = parts.filter((p) => m.includes(p)).length
        if (hits && hits === parts.length) score = 70
        else if (hits >= 2) score = 55
        // iPhone15,2 / iPhone 15 style
        else if (dm.replace(/\s/g, '') && m.replace(/\s/g, '').includes(dm.replace(/\s/g, '')))
          score = 60
      }
      return { d, score }
    })
    .filter((x) => x.score >= 50)
    .sort((a, b) => b.score - a.score)

  if (!scored.length) return []
  const top = scored[0].score
  return scored.filter((x) => x.score >= top - 20).map((x) => x.d)
}

async function resolveTacRow(tac: string, imei: string) {
  const local = await prisma.storeImeiTac.findUnique({ where: { tac } })
  if (local) return local

  if (!hicelltekConfigured()) return null

  const remote = await fetchHicelltekTac(imei)
  if (!remote) return null

  return prisma.storeImeiTac.upsert({
    where: { tac: remote.tac },
    create: {
      tac: remote.tac,
      brand: remote.brand,
      model: remote.model,
      name: remote.name,
    },
    update: {
      brand: remote.brand,
      model: remote.model,
      name: remote.name,
    },
  })
}

export async function lookupImeiAgainstMatrix(imeiRaw: string) {
  const imei = normImei(imeiRaw)
  if (!isValidImei(imei)) {
    return { ok: false as const, error: 'Enter a valid 15-digit IMEI.' }
  }
  const tac = tacFromImei(imei)
  const row = await resolveTacRow(tac, imei)
  if (!row) {
    // Still accept the device — shopper picks or types the model below.
    return {
      ok: true as const,
      imei,
      tac,
      matches: [],
      hint: 'IMEI saved — pick or enter your device below.',
    }
  }

  const matrix = await prisma.storeTradeInDevice.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { brand: 'asc' }],
  })
  const matches = matchMatrixDevices(row.brand, row.model, matrix)

  return {
    ok: true as const,
    imei,
    tac,
    brand: row.brand,
    model: row.model,
    name: row.name,
    matches: matches.map((d) => ({
      id: d.id,
      brand: d.brand,
      model: d.model,
      modelNumber: d.modelNumber || '',
      capacity: d.capacity,
      baseUsd: d.baseUsd,
    })),
    hint: matches.length
      ? undefined
      : `Recognized ${row.brand} ${row.model} — confirm details below. Final credit after inspection.`,
  }
}
