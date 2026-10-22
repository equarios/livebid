import type { StoreProductDto } from './api'
import { storeProductBrand } from './storeBrand'

function norm(s: string | null | undefined) {
  return (s || '').trim().toLowerCase()
}

/** Family key: brand + model number, else brand + stripped title. */
export function storeVariantFamilyKey(p: StoreProductDto) {
  const brand = norm(storeProductBrand(p))
  const model = norm(p.modelNumber)
  if (brand && model) return `${brand}::${model}`
  let title = (p.title || '').trim()
  const b = storeProductBrand(p)
  if (b && title.toLowerCase().startsWith(b.toLowerCase() + ' ')) {
    title = title.slice(b.length).trim()
  }
  title = title
    .replace(/\b\d+\s?(?:GB|TB)\b/gi, ' ')
    .replace(/\bGrade\s+[A-Z0-9]+\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase()
  return `${brand}::${title || p.id}`
}

export type VariantOption = {
  value: string
  /** Best matching product for this option given the other axis. */
  product: StoreProductDto | null
  inStock: boolean
  selected: boolean
}

function scoreSibling(current: StoreProductDto, candidate: StoreProductDto) {
  let s = 0
  if (norm(candidate.grade) === norm(current.grade) && current.grade) s += 4
  if (candidate.stock > 0) s += 2
  if (candidate.id === current.id) s += 1
  return s
}

function bestMatch(
  siblings: StoreProductDto[],
  current: StoreProductDto,
  want: { color?: string; capacity?: string },
) {
  const color = want.color != null ? norm(want.color) : norm(current.color)
  const capacity = want.capacity != null ? norm(want.capacity) : norm(current.capacity)
  const pool = siblings.filter((p) => {
    if (color && norm(p.color) !== color) return false
    if (capacity && norm(p.capacity) !== capacity) return false
    return true
  })
  if (!pool.length) return null
  return [...pool].sort((a, b) => scoreSibling(current, b) - scoreSibling(current, a))[0]
}

export function storeVariantSiblings(product: StoreProductDto, catalog: StoreProductDto[]) {
  const key = storeVariantFamilyKey(product)
  return catalog.filter((p) => p.active !== false && storeVariantFamilyKey(p) === key)
}

/** Color + capacity options for a cart line. Empty axes omitted when only one value. */
export function storeVariantOptions(product: StoreProductDto, catalog: StoreProductDto[]) {
  const siblings = storeVariantSiblings(product, catalog)
  const colors = [
    ...new Set(siblings.map((p) => (p.color || '').trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b))
  const capacities = [
    ...new Set(siblings.map((p) => (p.capacity || '').trim()).filter(Boolean)),
  ].sort((a, b) => {
    const na = parseInt(a, 10)
    const nb = parseInt(b, 10)
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
    return a.localeCompare(b)
  })

  const colorOptions: VariantOption[] =
    colors.length > 1
      ? colors.map((value) => {
          const match = bestMatch(siblings, product, { color: value })
          return {
            value,
            product: match,
            inStock: Boolean(match && match.stock > 0),
            selected: norm(value) === norm(product.color),
          }
        })
      : []

  const capacityOptions: VariantOption[] =
    capacities.length > 1
      ? capacities.map((value) => {
          const match = bestMatch(siblings, product, { capacity: value })
          return {
            value,
            product: match,
            inStock: Boolean(match && match.stock > 0),
            selected: norm(value) === norm(product.capacity),
          }
        })
      : []

  return { siblings, colorOptions, capacityOptions }
}

function heroScore(p: StoreProductDto) {
  const stock = p.stock > 0 ? 1_000_000 : 0
  const price = Math.max(0, 100_000 - Math.round(p.price * 100))
  const updated = Date.parse(p.updatedAt) || 0
  return stock + price + Math.min(updated / 1e12, 1)
}

/**
 * One grid card per model family (brand + model #).
 * Prefers in-stock, then lower price. Pass already-filtered rows so filters still apply.
 */
export function collapseStoreFamilies(products: StoreProductDto[]) {
  const groups = new Map<string, StoreProductDto[]>()
  for (const p of products) {
    const key = storeVariantFamilyKey(p)
    const list = groups.get(key)
    if (list) list.push(p)
    else groups.set(key, [p])
  }
  const heroes: StoreProductDto[] = []
  for (const list of groups.values()) {
    const best = [...list].sort((a, b) => heroScore(b) - heroScore(a))[0]
    if (best) heroes.push(best)
  }
  return heroes
}
