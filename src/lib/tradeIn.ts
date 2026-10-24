/** Consumer store trade-in — estimate matrix + provisional cart credit (pending QC). */

export type TradeInGrade = 'S' | 'A' | 'B' | 'C'

export type TradeInDevice = {
  id: string
  brand: string
  model: string
  /** Hardware / marketing model number (e.g. A3090, SM-S921B). */
  modelNumber?: string
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
  /** Midpoint used as provisional cart credit (0 = quote after inspection). */
  creditUsd: number
  notes: string[]
  /** True when not in the price matrix — admin sets final credit at QC. */
  pendingQuote?: boolean
}

export const CUSTOM_TRADE_IN_PREFIX = 'custom:'

export function isCustomTradeInDeviceId(id: string) {
  return id.startsWith(CUSTOM_TRADE_IN_PREFIX)
}

export function customTradeInDeviceId(parts: {
  brand: string
  model: string
  modelNumber?: string
  capacity: string
}) {
  const slug = [parts.brand, parts.model, parts.modelNumber || '', parts.capacity]
    .map((s) =>
      String(s || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    )
    .filter(Boolean)
    .join('-')
    .slice(0, 60)
  return `${CUSTOM_TRADE_IN_PREFIX}${slug || 'device'}`
}

/** Unpriced device — accept online, credit after inspection. */
export function pendingTradeInQuote(input: {
  deviceId: string
  label: string
  grade: TradeInGrade
  battery: number
  simLocked: boolean
  activationLocked: boolean
}): TradeInQuote {
  return {
    deviceId: input.deviceId,
    label: input.label,
    grade: input.grade,
    battery: Math.max(0, Math.min(100, Math.floor(input.battery))),
    simLocked: input.simLocked,
    activationLocked: input.activationLocked,
    lowUsd: 0,
    highUsd: 0,
    creditUsd: 0,
    pendingQuote: true,
    notes: [
      'We buy this device — final credit is set after inspection.',
      'No provisional amount in cart until we confirm the model.',
    ],
  }
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

/** Plain-language condition answers — shoppers never see S/A/B/C. */
export type TradeInScreen = 'perfect' | 'light' | 'cracked'
export type TradeInBody = 'perfect' | 'light' | 'dented'

export type TradeInCondition = {
  screen: TradeInScreen
  body: TradeInBody
  /** Feature ids that still work (see TRADE_IN_FEATURES). */
  works: string[]
  /** null = shopper doesn't know. */
  battery: number | null
  simLocked: boolean
  activationLocked: boolean
}

export const TRADE_IN_FEATURES: Array<{ id: string; label: string }> = [
  { id: 'face', label: 'Face ID / fingerprint' },
  { id: 'camera', label: 'Camera & flash' },
  { id: 'sound', label: 'Speakers & mic' },
  { id: 'charge', label: 'Charging port' },
  { id: 'buttons', label: 'Buttons & vibration' },
]

const GRADE_LADDER: TradeInGrade[] = ['S', 'A', 'B', 'C']

/** Map shopper answers → internal grade (keeps the pricing matrix unchanged). */
export function gradeFromCondition(c: TradeInCondition): TradeInGrade {
  let i = 0
  if (c.screen === 'light') i += 1
  if (c.screen === 'cracked') i = 3
  if (c.body === 'light') i += 1
  if (c.body === 'dented') i += 1
  const broken = TRADE_IN_FEATURES.filter((f) => !c.works.includes(f.id)).length
  if (broken >= 2) i += 1
  return GRADE_LADDER[Math.min(3, i)]
}

const KEY = 'livebid-store-tradein'
const EVENT = 'livebid-store-tradein'

/** Offline / empty-API fallback — mirrors seed matrix. */
export const DEFAULT_TRADE_IN_DEVICES: TradeInDevice[] = [
  { id: 'iphone-15-128', brand: 'Apple', model: 'iPhone 15', modelNumber: 'A3090', capacity: '128GB', baseUsd: 420 },
  { id: 'iphone-15-256', brand: 'Apple', model: 'iPhone 15', modelNumber: 'A3090', capacity: '256GB', baseUsd: 460 },
  { id: 'iphone-14-128', brand: 'Apple', model: 'iPhone 14', modelNumber: 'A2882', capacity: '128GB', baseUsd: 310 },
  { id: 'iphone-13-128', brand: 'Apple', model: 'iPhone 13', modelNumber: 'A2482', capacity: '128GB', baseUsd: 240 },
  { id: 'iphone-12-64', brand: 'Apple', model: 'iPhone 12', modelNumber: 'A2403', capacity: '64GB', baseUsd: 160 },
  { id: 's24-256', brand: 'Samsung', model: 'Galaxy S24', modelNumber: 'SM-S921B', capacity: '256GB', baseUsd: 380 },
  { id: 's23-256', brand: 'Samsung', model: 'Galaxy S23', modelNumber: 'SM-S911B', capacity: '256GB', baseUsd: 280 },
  { id: 'a54-128', brand: 'Samsung', model: 'Galaxy A54', modelNumber: 'SM-A546B', capacity: '128GB', baseUsd: 120 },
  { id: 'pixel-8-128', brand: 'Google', model: 'Pixel 8', modelNumber: 'GKWS6', capacity: '128GB', baseUsd: 260 },
  { id: 'pixel-7-128', brand: 'Google', model: 'Pixel 7', modelNumber: 'GVU6C', capacity: '128GB', baseUsd: 170 },
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
  const num = (d.modelNumber || '').trim()
  return num
    ? `${d.brand} ${d.model} (${num}) ${d.capacity}`
    : `${d.brand} ${d.model} ${d.capacity}`
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
    if (!parsed?.deviceId || !parsed.label) return null
    if (!(parsed.creditUsd >= 0) || Number.isNaN(parsed.creditUsd)) return null
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
