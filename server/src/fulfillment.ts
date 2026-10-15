/** Shared fulfillment policy helpers (store + wholesale). */

export type FulfillmentMode = 'pickup' | 'delivery' | 'buyer_courier'
export type ShippingPayer = 'buyer' | 'seller' | 'platform' | 'admin_decide'
export type FulfillmentDesk = 'store' | 'wholesale'

export type FulfillmentConfig = {
  storeModes: FulfillmentMode[]
  wholesaleModes: FulfillmentMode[]
  defaultStoreMode: FulfillmentMode
  defaultWholesaleMode: FulfillmentMode
  /** Flat fee when mode is delivery and payer is buyer (before free threshold). */
  deliveryFeeFlat: number
  /** Subtotal at/above this → free delivery. 0 = never free by threshold. */
  freeDeliveryMin: number
  deliveryPayer: ShippingPayer
  pickupLabel: string
  pickupHours: string
  /** Hint text for buyer_courier carrier field. */
  courierHints: string
  /** Bookable pickup windows (local warehouse time). */
  pickupSlots: string[]
  /** Earliest pickup = today + N days (0 = same-day OK). */
  pickupLeadDays: number
  /** Max collects per date+slot. 0 = unlimited. */
  pickupSlotCap: number
}

export const DEFAULT_FULFILLMENT: FulfillmentConfig = {
  storeModes: ['pickup', 'delivery'],
  wholesaleModes: ['pickup', 'delivery', 'buyer_courier'],
  defaultStoreMode: 'delivery',
  defaultWholesaleMode: 'pickup',
  deliveryFeeFlat: 12,
  freeDeliveryMin: 200,
  deliveryPayer: 'buyer',
  pickupLabel: 'Warehouse pickup',
  pickupHours: 'Mon-Fri 10:00-18:00',
  courierHints: 'FedEx, UPS, DHL, or Other',
  pickupSlots: ['10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00'],
  pickupLeadDays: 0,
  pickupSlotCap: 8,
}

const MODES: FulfillmentMode[] = ['pickup', 'delivery', 'buyer_courier']
const PAYERS: ShippingPayer[] = ['buyer', 'seller', 'platform', 'admin_decide']

export function isFulfillmentMode(v: unknown): v is FulfillmentMode {
  return typeof v === 'string' && (MODES as string[]).includes(v)
}

export function clampMoney(n: unknown, fallback: number) {
  const v = Number(n)
  if (!Number.isFinite(v) || v < 0) return fallback
  return Math.round(v * 100) / 100
}

function normalizeModes(raw: unknown, fallback: FulfillmentMode[]): FulfillmentMode[] {
  if (!Array.isArray(raw)) return [...fallback]
  const next = raw.filter(isFulfillmentMode)
  return next.length ? [...new Set(next)] : [...fallback]
}

function normalizePayer(raw: unknown, fallback: ShippingPayer): ShippingPayer {
  return typeof raw === 'string' && (PAYERS as string[]).includes(raw)
    ? (raw as ShippingPayer)
    : fallback
}

function pickDefault(
  raw: unknown,
  allowed: FulfillmentMode[],
  fallback: FulfillmentMode,
): FulfillmentMode {
  if (isFulfillmentMode(raw) && allowed.includes(raw)) return raw
  return allowed.includes(fallback) ? fallback : allowed[0] || 'delivery'
}

export function normalizeFulfillment(raw: Partial<FulfillmentConfig> | null | undefined): FulfillmentConfig {
  const storeModes = normalizeModes(raw?.storeModes, DEFAULT_FULFILLMENT.storeModes)
  const wholesaleModes = normalizeModes(raw?.wholesaleModes, DEFAULT_FULFILLMENT.wholesaleModes)
  return {
    storeModes,
    wholesaleModes,
    defaultStoreMode: pickDefault(
      raw?.defaultStoreMode,
      storeModes,
      DEFAULT_FULFILLMENT.defaultStoreMode,
    ),
    defaultWholesaleMode: pickDefault(
      raw?.defaultWholesaleMode,
      wholesaleModes,
      DEFAULT_FULFILLMENT.defaultWholesaleMode,
    ),
    deliveryFeeFlat: clampMoney(raw?.deliveryFeeFlat, DEFAULT_FULFILLMENT.deliveryFeeFlat),
    freeDeliveryMin: clampMoney(raw?.freeDeliveryMin, DEFAULT_FULFILLMENT.freeDeliveryMin),
    deliveryPayer: normalizePayer(raw?.deliveryPayer, DEFAULT_FULFILLMENT.deliveryPayer),
    pickupLabel: String(raw?.pickupLabel || DEFAULT_FULFILLMENT.pickupLabel).trim().slice(0, 120) ||
      DEFAULT_FULFILLMENT.pickupLabel,
    pickupHours: String(raw?.pickupHours || DEFAULT_FULFILLMENT.pickupHours).trim().slice(0, 120) ||
      DEFAULT_FULFILLMENT.pickupHours,
    courierHints:
      String(raw?.courierHints || DEFAULT_FULFILLMENT.courierHints).trim().slice(0, 160) ||
      DEFAULT_FULFILLMENT.courierHints,
    pickupSlots: normalizeSlots(raw?.pickupSlots),
    pickupLeadDays: Math.max(
      0,
      Math.min(14, Math.floor(Number(raw?.pickupLeadDays) || DEFAULT_FULFILLMENT.pickupLeadDays)),
    ),
    pickupSlotCap: Math.max(
      0,
      Math.min(200, Math.floor(Number(raw?.pickupSlotCap) || DEFAULT_FULFILLMENT.pickupSlotCap)),
    ),
  }
}

function normalizeSlots(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_FULFILLMENT.pickupSlots]
  const next = raw
    .map((s) => String(s || '').trim().slice(0, 40))
    .filter(Boolean)
  return next.length ? [...new Set(next)].slice(0, 12) : [...DEFAULT_FULFILLMENT.pickupSlots]
}

/** YYYY-MM-DD in local time. */
export function localIsoDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function earliestPickupDate(cfg: FulfillmentConfig, from = new Date()) {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + (cfg.pickupLeadDays || 0))
  return localIsoDate(d)
}

export function isValidPickupDate(dateIso: string, cfg: FulfillmentConfig) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return false
  return dateIso >= earliestPickupDate(cfg)
}

export function modesForDesk(cfg: FulfillmentConfig, desk: FulfillmentDesk): FulfillmentMode[] {
  return desk === 'store' ? cfg.storeModes : cfg.wholesaleModes
}

export function defaultModeForDesk(cfg: FulfillmentConfig, desk: FulfillmentDesk): FulfillmentMode {
  return desk === 'store' ? cfg.defaultStoreMode : cfg.defaultWholesaleMode
}

export type ShippingQuote = {
  /** Amount charged on the order (0 when TBD / pickup / own courier). */
  fee: number
  /** False when payer is admin_decide and staff has not quoted yet. */
  quoted: boolean
  /** Buyer-facing label. */
  label: 'free' | 'flat' | 'tbd' | 'none'
}

/** Resolve shipping fee charged on the order/invoice (platform line). */
export function resolveShippingFee(opts: {
  mode: FulfillmentMode
  subtotal: number
  cfg: FulfillmentConfig
  /** Staff override when payer is admin_decide. */
  overrideFee?: number | null
  /** Staff already confirmed a quote (including $0). */
  quoted?: boolean
}): number {
  return resolveShippingQuote(opts).fee
}

export function resolveShippingQuote(opts: {
  mode: FulfillmentMode
  subtotal: number
  cfg: FulfillmentConfig
  overrideFee?: number | null
  quoted?: boolean
}): ShippingQuote {
  const { mode, subtotal, cfg } = opts
  if (mode === 'pickup' || mode === 'buyer_courier') {
    return { fee: 0, quoted: true, label: 'none' }
  }
  if (cfg.deliveryPayer === 'seller' || cfg.deliveryPayer === 'platform') {
    return { fee: 0, quoted: true, label: 'free' }
  }
  if (cfg.deliveryPayer === 'admin_decide') {
    if (opts.quoted || opts.overrideFee === 0 || (opts.overrideFee != null && Number.isFinite(opts.overrideFee))) {
      const fee =
        opts.overrideFee === 0 || (opts.overrideFee != null && Number.isFinite(opts.overrideFee))
          ? clampMoney(opts.overrideFee, 0)
          : 0
      return { fee, quoted: true, label: fee === 0 ? 'free' : 'flat' }
    }
    return { fee: 0, quoted: false, label: 'tbd' }
  }
  if (cfg.freeDeliveryMin > 0 && subtotal >= cfg.freeDeliveryMin) {
    return { fee: 0, quoted: true, label: 'free' }
  }
  const fee = clampMoney(cfg.deliveryFeeFlat, 0)
  return { fee, quoted: true, label: fee === 0 ? 'free' : 'flat' }
}

export function publicStoreFulfillment(cfg: FulfillmentConfig) {
  return {
    modes: cfg.storeModes,
    defaultMode: cfg.defaultStoreMode,
    deliveryFeeFlat: cfg.deliveryFeeFlat,
    freeDeliveryMin: cfg.freeDeliveryMin,
    deliveryPayer: cfg.deliveryPayer,
    pickupLabel: cfg.pickupLabel,
    pickupHours: cfg.pickupHours,
    courierHints: cfg.courierHints,
    pickupSlots: cfg.pickupSlots,
    pickupLeadDays: cfg.pickupLeadDays,
    pickupSlotCap: cfg.pickupSlotCap,
    earliestPickupDate: earliestPickupDate(cfg),
  }
}

export function shippingAddendumId(parentId: string) {
  const base = String(parentId || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 28)
  return `SHIP-${base || 'FEE'}`
}
