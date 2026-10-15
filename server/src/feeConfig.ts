import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_FULFILLMENT,
  normalizeFulfillment,
  type FulfillmentConfig,
} from './fulfillment'

export type FeeConfig = {
  marketplaceFeePct: number
  invoiceFeePct: number
  /** Lowest marketplace offer as % of list (0–100). */
  offerFloorPct: number
  auctionTypeFees: Record<string, number>
  fulfillment: FulfillmentConfig
}

const DEFAULT: FeeConfig = {
  marketplaceFeePct: 2,
  invoiceFeePct: 2,
  offerFloorPct: 30,
  auctionTypeFees: { live: 2, offline: 2 },
  fulfillment: { ...DEFAULT_FULFILLMENT },
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.join(__dirname, '../data/fees.json')

function clampPct(n: unknown, fallback: number) {
  const v = Number(n)
  if (!Number.isFinite(v) || v < 0) return fallback
  return Math.round(v * 100) / 100
}

function clampOfferFloorPct(n: unknown, fallback: number) {
  const v = clampPct(n, fallback)
  return Math.min(100, Math.max(0, v))
}

export function readFees(): FeeConfig {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Partial<FeeConfig> & {
      fulfillment?: Partial<FulfillmentConfig>
    }
    return {
      marketplaceFeePct: clampPct(raw.marketplaceFeePct, DEFAULT.marketplaceFeePct),
      invoiceFeePct: clampPct(raw.invoiceFeePct, DEFAULT.invoiceFeePct),
      offerFloorPct: clampOfferFloorPct(raw.offerFloorPct, DEFAULT.offerFloorPct),
      auctionTypeFees: {
        ...DEFAULT.auctionTypeFees,
        ...(raw.auctionTypeFees && typeof raw.auctionTypeFees === 'object' ? raw.auctionTypeFees : {}),
      },
      fulfillment: normalizeFulfillment(raw.fulfillment),
    }
  } catch {
    return {
      marketplaceFeePct: DEFAULT.marketplaceFeePct,
      invoiceFeePct: DEFAULT.invoiceFeePct,
      offerFloorPct: DEFAULT.offerFloorPct,
      auctionTypeFees: { ...DEFAULT.auctionTypeFees },
      fulfillment: { ...DEFAULT_FULFILLMENT },
    }
  }
}

export function writeFees(next: FeeConfig) {
  const clean: FeeConfig = {
    marketplaceFeePct: clampPct(next.marketplaceFeePct, 0),
    invoiceFeePct: clampPct(next.invoiceFeePct, 2),
    offerFloorPct: clampOfferFloorPct(next.offerFloorPct, DEFAULT.offerFloorPct),
    auctionTypeFees: {},
    fulfillment: normalizeFulfillment(next.fulfillment),
  }
  for (const [k, v] of Object.entries(next.auctionTypeFees || {})) {
    if (!k.trim()) continue
    clean.auctionTypeFees[k] = clampPct(v, 0)
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(clean, null, 2))
  return clean
}

export function readFulfillment(): FulfillmentConfig {
  return readFees().fulfillment
}

export function feeForAuctionType(slug: string) {
  const f = readFees()
  let key = slug || 'live'
  if (key === 'sealed' || key === 'hybrid') key = 'offline'
  if (Object.prototype.hasOwnProperty.call(f.auctionTypeFees, key)) {
    return clampPct(f.auctionTypeFees[key], 0)
  }
  return clampPct(f.invoiceFeePct, 2)
}

export function feeForMarketplace() {
  const f = readFees()
  if (Object.prototype.hasOwnProperty.call(f, 'marketplaceFeePct')) {
    return clampPct(f.marketplaceFeePct, 0)
  }
  return clampPct(f.invoiceFeePct, 2)
}

export function offerFloorPct() {
  return clampOfferFloorPct(readFees().offerFloorPct, DEFAULT.offerFloorPct)
}

/** Min unit price for a marketplace offer given list and Super %. */
export function minOfferUnitPrice(listedPrice: number, pct = offerFloorPct()) {
  const list = Math.max(0, Number(listedPrice) || 0)
  const rate = clampOfferFloorPct(pct, DEFAULT.offerFloorPct) / 100
  return Math.max(1, Math.round(list * rate))
}

export function roundMoney(n: number) {
  return Math.round(n * 100) / 100
}

export function withFee(goods: number, feePct: number) {
  const rate = clampPct(feePct, 0)
  const g = roundMoney(Math.max(0, goods))
  const fee = rate > 0 ? roundMoney(g * (rate / 100)) : 0
  return { goods: g, fee, feePct: rate > 0 ? rate : 0, total: roundMoney(g + fee) }
}
