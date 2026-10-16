import type { FulfillmentMode, FulfillmentSettings, ShippingPayer } from '../types'

export const DEFAULT_FULFILLMENT: FulfillmentSettings = {
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

export const SHIP_CARRIERS = ['FedEx', 'UPS', 'DHL', 'Other'] as const

/** Public tracking page for a known carrier. Other or a blank carrier has no link. */
export function trackingHref(carrier: string | null | undefined, trackingNo: string) {
  const no = trackingNo.trim()
  if (!no) return null
  const c = (carrier || '').trim().toLowerCase()
  if (c.startsWith('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(no)}`
  if (c.startsWith('ups')) return `https://www.ups.com/track?tracknum=${encodeURIComponent(no)}`
  if (c.startsWith('dhl')) return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(no)}`
  return null
}

export function localIsoDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function earliestPickupDate(cfg: FulfillmentSettings, from = new Date()) {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + (cfg.pickupLeadDays || 0))
  return localIsoDate(d)
}

export const FULFILLMENT_LABELS: Record<FulfillmentMode, string> = {
  pickup: 'Self pickup',
  delivery: 'Delivery',
  buyer_courier: 'Ship with my account',
}

export const PAYER_LABELS: Record<ShippingPayer, string> = {
  buyer: 'Buyer pays',
  seller: 'Seller pays',
  platform: 'Platform pays',
  admin_decide: 'Staff quotes per order',
}

export type ClientShippingQuote = {
  fee: number
  quoted: boolean
  label: 'free' | 'flat' | 'tbd' | 'none'
}

export function resolveClientShippingQuote(
  mode: FulfillmentMode,
  subtotal: number,
  cfg: FulfillmentSettings,
): ClientShippingQuote {
  if (mode === 'pickup' || mode === 'buyer_courier') {
    return { fee: 0, quoted: true, label: 'none' }
  }
  if (cfg.deliveryPayer === 'seller' || cfg.deliveryPayer === 'platform') {
    return { fee: 0, quoted: true, label: 'free' }
  }
  if (cfg.deliveryPayer === 'admin_decide') {
    return { fee: 0, quoted: false, label: 'tbd' }
  }
  if (cfg.freeDeliveryMin > 0 && subtotal >= cfg.freeDeliveryMin) {
    return { fee: 0, quoted: true, label: 'free' }
  }
  const fee = Math.round((cfg.deliveryFeeFlat || 0) * 100) / 100
  return { fee, quoted: true, label: fee === 0 ? 'free' : 'flat' }
}

export function resolveClientShippingFee(
  mode: FulfillmentMode,
  subtotal: number,
  cfg: FulfillmentSettings,
): number {
  return resolveClientShippingQuote(mode, subtotal, cfg).fee
}

export function shippingFeeHint(mode: FulfillmentMode, subtotal: number, cfg: FulfillmentSettings) {
  if (mode === 'pickup') return `${cfg.pickupLabel} · ${cfg.pickupHours}`
  if (mode === 'buyer_courier') return `Use your ${cfg.courierHints} — freight billed to your account`
  if (cfg.deliveryPayer === 'seller' || cfg.deliveryPayer === 'platform') return 'Free delivery'
  if (cfg.deliveryPayer === 'admin_decide') return 'Delivery fee TBD — staff will quote'
  if (cfg.freeDeliveryMin > 0 && subtotal >= cfg.freeDeliveryMin) {
    return `Free delivery over $${cfg.freeDeliveryMin}`
  }
  if (cfg.freeDeliveryMin > 0) {
    return `$${cfg.deliveryFeeFlat} delivery · free over $${cfg.freeDeliveryMin}`
  }
  return `$${cfg.deliveryFeeFlat} delivery`
}

export function formatShippingMoney(
  fee: number,
  quoted: boolean | undefined,
  usd: (n: number) => string,
) {
  if (quoted === false) return 'TBD'
  return usd(fee)
}
