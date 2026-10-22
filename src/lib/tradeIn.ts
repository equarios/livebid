/** Consumer store trade-in — estimate matrix + provisional cart credit (pending QC). */

export type TradeInGrade = 'S' | 'A' | 'B' | 'C'

export type TradeInDevice = {
  id: string
  brand: string
  model: string
  capacity: string
  /** Mid-band estimate in USD for Grade A, unlocked, healthy battery. */
  baseUsd: number
  active?: boolean
  sortOrder?: number
}

export type TradeInQuoteInput = {
  deviceId: string
  grade: TradeInGrade
  battery: number
  simLocked: boolean
  activationLocked: boolean
}

export type TradeInPhotoSlotId = 'front' | 'back' | 'left' | 'right'

export type TradeInQuote = {
  deviceId: string
  label: string
  grade: TradeInGrade
  battery: number
  simLocked: boolean
  activationLocked: boolean
  /** Low–high estimate USD (pending inspection). */
  lowUsd: number
  highUsd: number
  /** Midpoint used as provisional cart credit. */
  creditUsd: number
  notes: string[]
}

export type TradeInPending = TradeInQuote & {
  savedAt: number
  /** Ordered: front, back, left, right (+ optional extras). */
  images: string[]
  /** Optional condition video URL. */
  videoUrl?: string | null
  /** Validated 15-digit IMEI. */
  imei: string
}

/** Required angles before Apply to cart. */
export const TRADE_IN_PHOTO_SLOTS: Array<{ id: TradeInPhotoSlotId; label: string; hint: string }> = [
  { id: 'front', label: 'Front', hint: 'Screen on if possible' },
  { id: 'back', label: 'Back', hint: 'Full rear panel' },
  { id: 'left', label: 'Left side', hint: 'Buttons / ports edge' },
  { id: 'right', label: 'Right side', hint: 'Opposite edge' },
]

export const TRADE_IN_MIN_PHOTOS = TRADE_IN_PHOTO_SLOTS.length
export const TRADE_IN_MAX_PHOTOS = 8

export function tradeInPhotosReady(images: string[] | null | undefined) {
  const n = (images || []).filter((u) => typeof u === 'string' && u.trim()).length
  return n >= TRADE_IN_MIN_PHOTOS
}

/** Digits-only IMEI / Luhn (client mirror of server). */
export function normTradeInImei(raw: string) {
  return String(raw || '').replace(/\D/g, '')
}

export function isValidTradeInImei(raw: string) {
  const d = normTradeInImei(raw)
  if (d.length < 14 || d.length > 16) return false
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

const KEY = 'livebid-store-tradein'
const EVENT = 'livebid-store-tradein'

/** Offline / empty-API fallback — mirrors seed matrix. */
export const DEFAULT_TRADE_IN_DEVICES: TradeInDevice[] = [
  { id: 'iphone-15-128', brand: 'Apple', model: 'iPhone 15', capacity: '128GB', baseUsd: 420 },
  { id: 'iphone-15-256', brand: 'Apple', model: 'iPhone 15', capacity: '256GB', baseUsd: 460 },
  { id: 'iphone-14-128', brand: 'Apple', model: 'iPhone 14', capacity: '128GB', baseUsd: 310 },
  { id: 'iphone-13-128', brand: 'Apple', model: 'iPhone 13', capacity: '128GB', baseUsd: 240 },
  { id: 'iphone-12-64', brand: 'Apple', model: 'iPhone 12', capacity: '64GB', baseUsd: 160 },
  { id: 's24-256', brand: 'Samsung', model: 'Galaxy S24', capacity: '256GB', baseUsd: 380 },
  { id: 's23-256', brand: 'Samsung', model: 'Galaxy S23', capacity: '256GB', baseUsd: 280 },
  { id: 'a54-128', brand: 'Samsung', model: 'Galaxy A54', capacity: '128GB', baseUsd: 120 },
  { id: 'pixel-8-128', brand: 'Google', model: 'Pixel 8', capacity: '128GB', baseUsd: 260 },
  { id: 'pixel-7-128', brand: 'Google', model: 'Pixel 7', capacity: '128GB', baseUsd: 170 },
]

/** @deprecated Use DEFAULT_TRADE_IN_DEVICES or API list. */
export const TRADE_IN_DEVICES = DEFAULT_TRADE_IN_DEVICES

const GRADE_MULT: Record<TradeInGrade, number> = {
  S: 1.05,
  A: 1,
  B: 0.82,
  C: 0.55,
}

export function tradeInDeviceLabel(d: TradeInDevice) {
  return `${d.brand} ${d.model} ${d.capacity}`
}

export function estimateTradeIn(
  input: TradeInQuoteInput,
  devices: TradeInDevice[] = DEFAULT_TRADE_IN_DEVICES,
): TradeInQuote | null {
  const device = devices.find((d) => d.id === input.deviceId)
  if (!device) return null

  const notes: string[] = []
  let mult = GRADE_MULT[input.grade]
  if (input.grade === 'C') notes.push('Grade C / as-is units settle at the low end after inspection.')

  const batt = Math.max(0, Math.min(100, Math.floor(input.battery)))
  if (batt > 0 && batt < 80) {
    mult *= 0.88
    notes.push('Battery under 80% reduces credit.')
  } else if (batt > 0 && batt < 90) {
    mult *= 0.95
  }

  if (input.simLocked) {
    mult *= 0.78
    notes.push('SIM locked — lower band until unlock proof.')
  }
  if (input.activationLocked) {
    mult *= 0.72
    notes.push('Activation locked — must be released before final credit.')
  }

  const mid = Math.round(device.baseUsd * mult)
  const lowUsd = Math.max(10, Math.round(mid * 0.88))
  const highUsd = Math.round(mid * 1.08)
  const creditUsd = Math.round((lowUsd + highUsd) / 2)

  if (!notes.length) notes.push('Final credit after we inspect the device.')

  return {
    deviceId: device.id,
    label: tradeInDeviceLabel(device),
    grade: input.grade,
    battery: batt,
    simLocked: input.simLocked,
    activationLocked: input.activationLocked,
    lowUsd,
    highUsd,
    creditUsd,
    notes,
  }
}

/** Cap provisional credit so it never exceeds cart merchandise. */
export function applyTradeInCap(creditUsd: number, cartSubtotalUsd: number) {
  if (cartSubtotalUsd <= 0) return 0
  return Math.min(creditUsd, Math.round(cartSubtotalUsd * 100) / 100)
}

export function readTradeInPending(): TradeInPending | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TradeInPending
    if (!parsed?.deviceId || !(parsed.creditUsd > 0)) return null
    const images = Array.isArray(parsed.images)
      ? parsed.images.filter((u) => typeof u === 'string' && u.trim())
      : []
    if (!tradeInPhotosReady(images)) return null
    const imei = typeof parsed.imei === 'string' ? parsed.imei.replace(/\D/g, '') : ''
    if (imei.length < 14) return null
    const videoUrl =
      typeof parsed.videoUrl === 'string' && parsed.videoUrl.trim()
        ? parsed.videoUrl.trim()
        : null
    return { ...parsed, images, videoUrl, imei }
  } catch {
    return null
  }
}

export function writeTradeInPending(
  quote: TradeInQuote,
  images: string[],
  videoUrl: string | null | undefined,
  imei: string,
) {
  const cleaned = images.filter((u) => typeof u === 'string' && u.trim()).slice(0, TRADE_IN_MAX_PHOTOS)
  if (!tradeInPhotosReady(cleaned)) {
    throw new Error(`Add at least ${TRADE_IN_MIN_PHOTOS} photos (all sides).`)
  }
  const digits = String(imei || '').replace(/\D/g, '')
  if (digits.length < 14) {
    throw new Error('Look up a valid IMEI first.')
  }
  const row: TradeInPending = {
    ...quote,
    images: cleaned,
    videoUrl: videoUrl?.trim() || null,
    imei: digits,
    savedAt: Date.now(),
  }
  localStorage.setItem(KEY, JSON.stringify(row))
  window.dispatchEvent(new Event(EVENT))
  return row
}

export function clearTradeInPending() {
  localStorage.removeItem(KEY)
  window.dispatchEvent(new Event(EVENT))
}

export function subscribeTradeIn(fn: () => void) {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}
