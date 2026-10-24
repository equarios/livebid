import type { StoreProductDto } from './api'
import { storeVariantFamilyKey } from './storeVariants'

export type StockFilter = 'available' | 'sold'

export const STOCK_FILTER_OPTIONS: StockFilter[] = ['available', 'sold']

export const STOCK_FILTER_LABEL: Record<StockFilter, string> = {
  available: 'In stock',
  sold: 'Sold out',
}

/** Sold listings older than this drop from the public catalog (unless staff). */
export const SOLD_HIDE_AFTER_MS = 14 * 24 * 60 * 60 * 1000
/** Sold history kept in the archive after it leaves the shop. */
export const SOLD_ARCHIVE_MS = 180 * 24 * 60 * 60 * 1000

/** Empty or both → all. One selected → that bucket only. */
export function matchesStockFilter(inStock: boolean, selected: StockFilter[]) {
  if (!selected.length || selected.length === STOCK_FILTER_OPTIONS.length) return true
  if (selected.includes('available') && inStock) return true
  if (selected.includes('sold') && !inStock) return true
  return false
}

/** In-stock first, sold last (stable within each group). */
export function sortStockLast<T>(items: T[], inStock: (item: T) => boolean): T[] {
  return [...items].sort((a, b) => Number(inStock(b)) - Number(inStock(a)))
}

/** True when a sold item is old enough to hide from the public grid. */
export function isSoldStale(soldAnchorMs: number, now = Date.now()) {
  if (!Number.isFinite(soldAnchorMs) || soldAnchorMs <= 0) return false
  return now - soldAnchorMs >= SOLD_HIDE_AFTER_MS
}

/**
 * Public visibility for sold items.
 * In-stock always shown. Sold shown only while fresh (within 14 days of anchor).
 */
export function isPubliclyListed(inStock: boolean, soldAnchorMs: number, now = Date.now()) {
  if (inStock) return true
  return !isSoldStale(soldAnchorMs, now)
}

/** Sold, off the shop (older than 14 days), still inside the archive window. */
export function isSoldArchive(inStock: boolean, soldAnchorMs: number, now = Date.now()) {
  if (inStock) return false
  if (!Number.isFinite(soldAnchorMs) || soldAnchorMs <= 0) return false
  const age = now - soldAnchorMs
  return age >= SOLD_HIDE_AFTER_MS && age < SOLD_ARCHIVE_MS
}

export function parseTimeMs(raw: string | number | null | undefined) {
  if (raw == null || raw === '') return 0
  if (typeof raw === 'number') return raw
  const n = Date.parse(raw)
  return Number.isFinite(n) ? n : 0
}

/** Rank in-stock peers; skips same color/GB family (variant picker covers those). */
export function pickSimilarStoreProducts(
  seed: StoreProductDto,
  catalog: StoreProductDto[],
  limit = 12,
) {
  const family = storeVariantFamilyKey(seed)
  return catalog
    .filter((p) => storeVariantFamilyKey(p) !== family)
    .map((p) => ({ p, score: similarStoreScore(seed, p) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p)
}

/** Score similar retail products (higher = closer). */
export function similarStoreScore(
  seed: {
    id: string
    brand?: string
    category?: string
    capacity?: string
    modelNumber?: string
    title?: string
  },
  candidate: {
    id: string
    brand?: string
    category?: string
    capacity?: string
    modelNumber?: string
    title?: string
    stock: number
  },
) {
  if (candidate.id === seed.id || candidate.stock < 1) return 0
  let score = 0
  const brand = (seed.brand || '').trim().toLowerCase()
  const cBrand = (candidate.brand || '').trim().toLowerCase()
  if (brand && brand === cBrand) score += 4
  if (seed.category && seed.category === candidate.category) score += 3
  if (seed.capacity && seed.capacity === candidate.capacity) score += 2
  const model = (seed.modelNumber || '').trim().toLowerCase()
  const cModel = (candidate.modelNumber || '').trim().toLowerCase()
  if (model && model === cModel) score += 5
  const title = (seed.title || '').toLowerCase()
  const cTitle = (candidate.title || '').toLowerCase()
  if (title && cTitle) {
    const token = title.split(/\s+/).find((t) => t.length > 3)
    if (token && cTitle.includes(token)) score += 1
  }
  return score
}
