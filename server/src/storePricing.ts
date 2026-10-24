import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Store tax & promo configuration, persisted in server/data/storePricing.json. */

export type TaxMode = 'none' | 'inclusive' | 'exclusive'

export type StorePricing = {
  /** none = no tax charged; inclusive = tax already in listed price (shown split); exclusive = added at checkout. */
  taxMode: TaxMode
  /** e.g. "VAT", "GST", "Sales tax" — shown next to the rate. */
  taxLabel: string
  /** Percent (0–100), 2 decimals. */
  taxRatePct: number
  promos: PromoRule[]
}

export type PromoRule = {
  code: string
  /** Percent off subtotal (0–100). */
  pctOff: number
  /** Optional minimum subtotal to unlock. */
  minSubtotal: number
  /** ISO date (inclusive) after which the code expires. */
  expiresAt: string | null
  active: boolean
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.join(__dirname, '../data/storePricing.json')

const DEFAULT: StorePricing = {
  taxMode: 'none',
  taxLabel: 'VAT',
  taxRatePct: 0,
  promos: [],
}

const TAX_MODES: TaxMode[] = ['none', 'inclusive', 'exclusive']

function clampPct(n: unknown, fallback: number) {
  const v = Number(n)
  if (!Number.isFinite(v) || v < 0) return fallback
  return Math.min(100, Math.round(v * 100) / 100)
}

function clampMoney(n: unknown) {
  const v = Number(n)
  if (!Number.isFinite(v) || v < 0) return 0
  return Math.round(v * 100) / 100
}

function normalizeCode(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 24)
}

function normalizePromo(raw: unknown): PromoRule | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<PromoRule>
  const code = normalizeCode(r.code)
  if (!code) return null
  const pctOff = clampPct(r.pctOff, 0)
  if (pctOff <= 0) return null
  const expires = typeof r.expiresAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.expiresAt)
    ? r.expiresAt
    : null
  return {
    code,
    pctOff,
    minSubtotal: clampMoney(r.minSubtotal),
    expiresAt: expires,
    active: r.active !== false,
  }
}

export function readStorePricing(): StorePricing {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Partial<StorePricing>
    const taxMode = TAX_MODES.includes(raw.taxMode as TaxMode)
      ? (raw.taxMode as TaxMode)
      : DEFAULT.taxMode
    const promos = Array.isArray(raw.promos)
      ? (raw.promos.map(normalizePromo).filter(Boolean) as PromoRule[])
      : []
    return {
      taxMode,
      taxLabel: String(raw.taxLabel || DEFAULT.taxLabel).trim().slice(0, 24) || DEFAULT.taxLabel,
      taxRatePct: clampPct(raw.taxRatePct, 0),
      promos: promos.slice(0, 50),
    }
  } catch {
    return { ...DEFAULT, promos: [] }
  }
}

export function writeStorePricing(next: StorePricing): StorePricing {
  const clean: StorePricing = {
    taxMode: TAX_MODES.includes(next.taxMode) ? next.taxMode : 'none',
    taxLabel: String(next.taxLabel || 'VAT').trim().slice(0, 24) || 'VAT',
    taxRatePct: clampPct(next.taxRatePct, 0),
    promos: (Array.isArray(next.promos) ? next.promos : [])
      .map(normalizePromo)
      .filter(Boolean)
      .slice(0, 50) as PromoRule[],
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(clean, null, 2))
  return clean
}

/** Public bits shoppers may see (rates + live promo labels, never other rules). */
export function publicStorePricing() {
  const p = readStorePricing()
  return {
    taxMode: p.taxMode,
    taxLabel: p.taxLabel,
    taxRatePct: p.taxRatePct,
    promos: p.promos.filter((x) => x.active).map((x) => x.code),
  }
}

export type PromoEval = {
  ok: boolean
  error?: string
  code: string
  pctOff: number
}

/** Validate a promo code against the current rules and subtotal. */
export function evalPromo(rawCode: string, subtotal: number): PromoEval {
  const p = readStorePricing()
  const code = normalizeCode(rawCode)
  if (!code) return { ok: false, error: 'Enter a promo code.', code: '', pctOff: 0 }
  const rule = p.promos.find((x) => x.code === code)
  if (!rule || !rule.active) return { ok: false, error: 'That code isn’t valid.', code, pctOff: 0 }
  if (rule.expiresAt) {
    const today = new Date().toISOString().slice(0, 10)
    if (today > rule.expiresAt) {
      return { ok: false, error: 'That code has expired.', code, pctOff: 0 }
    }
  }
  if (rule.minSubtotal > 0 && subtotal < rule.minSubtotal) {
    return {
      ok: false,
      error: `Spend at least $${rule.minSubtotal.toFixed(2)} to use ${code}.`,
      code,
      pctOff: 0,
    }
  }
  return { ok: true, code, pctOff: rule.pctOff }
}

export type PricingBreakdown = {
  /** Price of goods before any discount (list prices). */
  subtotal: number
  /** Promo discount USD (≥ 0). */
  discount: number
  /** Goods after discount — the tax base for exclusive tax. */
  goods: number
  /** Tax USD charged on top (exclusive mode), ≥ 0. */
  tax: number
  /** Tax USD already inside listed prices (inclusive mode), informational. */
  taxIncluded: number
  /** List price label for tax on receipts ("VAT (20%)" or null). */
  taxLabel: string | null
  promoCode: string | null
  promoPctOff: number
}

/** Compute discount + tax for an order. Tax is always USD, computed server-side. */
export function computePricing(opts: {
  subtotal: number
  promoRawCode?: string | null
  /** Force skip promo validation (e.g. re-quoting an already-validated code). */
  skipPromoValidation?: boolean
}): PricingBreakdown {
  const subtotal = Math.max(0, Math.round(opts.subtotal * 100) / 100)
  const p = readStorePricing()

  let promoCode: string | null = null
  let promoPctOff = 0
  if (opts.promoRawCode) {
    const ev = opts.skipPromoValidation
      ? { ok: true, code: normalizeCode(opts.promoRawCode), pctOff: 0 }
      : evalPromo(opts.promoRawCode, subtotal)
    if (ev.ok) {
      const rule = p.promos.find((x) => x.code === ev.code)
      if (rule) {
        promoCode = rule.code
        promoPctOff = rule.pctOff
      }
    }
  }

  const discount = Math.round(subtotal * (promoPctOff / 100) * 100) / 100
  const goods = Math.round((subtotal - discount) * 100) / 100

  let tax = 0
  let taxIncluded = 0
  let taxLabel: string | null = null
  if (p.taxMode === 'exclusive' && p.taxRatePct > 0) {
    tax = Math.round(goods * (p.taxRatePct / 100) * 100) / 100
    taxLabel = `${p.taxLabel} (${p.taxRatePct}%)`
  } else if (p.taxMode === 'inclusive' && p.taxRatePct > 0) {
    taxIncluded = Math.round(goods * (p.taxRatePct / (100 + p.taxRatePct)) * 100) / 100
    taxLabel = `${p.taxLabel} (incl. ${p.taxRatePct}%)`
  }

  return {
    subtotal,
    discount,
    goods,
    tax,
    taxIncluded,
    taxLabel,
    promoCode,
    promoPctOff,
  }
}
