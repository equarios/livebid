export type StoreCartLine = { productId: string; qty: number }

const KEY = 'livebid-store-cart'

export function readStoreCart(): StoreCartLine[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoreCartLine[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((l) => l && typeof l.productId === 'string' && Number.isInteger(l.qty) && l.qty > 0)
      .map((l) => ({ productId: l.productId, qty: Math.min(99, l.qty) }))
  } catch {
    return []
  }
}

export function writeStoreCart(lines: StoreCartLine[]) {
  localStorage.setItem(KEY, JSON.stringify(lines))
  window.dispatchEvent(new Event('livebid-store-cart'))
}

/** Total units of a product the shopper may hold. Unknown stock falls back to 99. */
export function storeCartStockCap(stock: number | null | undefined) {
  if (typeof stock !== 'number' || !Number.isFinite(stock)) return 99
  return Math.max(1, Math.min(99, Math.floor(stock)))
}

/**
 * Add units to the cart, capped to the product's real stock.
 * Returns the resulting line qty so callers can tell whether the add landed.
 */
export function addToStoreCart(productId: string, qty = 1, stock?: number | null) {
  const cap = storeCartStockCap(stock)
  const lines = readStoreCart()
  const hit = lines.find((l) => l.productId === productId)
  if (hit) hit.qty = Math.min(cap, hit.qty + Math.max(1, qty))
  else lines.push({ productId, qty: Math.min(cap, Math.max(1, qty)) })
  writeStoreCart(lines)
  return lines.find((l) => l.productId === productId)?.qty ?? 0
}

export function setStoreCartQty(productId: string, qty: number, stock?: number | null) {
  const cap = storeCartStockCap(stock)
  let lines = readStoreCart()
  if (qty <= 0) lines = lines.filter((l) => l.productId !== productId)
  else {
    const next = Math.min(cap, qty)
    const hit = lines.find((l) => l.productId === productId)
    if (hit) hit.qty = next
    else lines.push({ productId, qty: next })
  }
  writeStoreCart(lines)
  return lines
}

/**
 * Swap one product for another, keeping qty (capped to maxStock).
 * Never merges into an existing line for the target — the swapped-out line is
 * replaced in place so the cart can't silently double.
 */
export function replaceStoreCartProduct(
  fromProductId: string,
  toProductId: string,
  maxStock = 99,
) {
  if (fromProductId === toProductId) return readStoreCart()
  const lines = readStoreCart()
  const idx = lines.findIndex((l) => l.productId === fromProductId)
  if (idx < 0) return lines
  const cap = storeCartStockCap(maxStock)
  const qty = Math.min(cap, lines[idx].qty)
  const existing = lines.findIndex((l) => l.productId === toProductId)
  if (existing >= 0 && existing !== idx) {
    // Target already in cart: keep the larger qty on the kept line, drop the old one.
    lines[existing].qty = Math.min(storeCartStockCap(maxStock), Math.max(lines[existing].qty, qty))
    lines.splice(idx, 1)
  } else {
    lines[idx] = { productId: toProductId, qty }
  }
  writeStoreCart(lines)
  return lines
}

export function clearStoreCart() {
  writeStoreCart([])
}

/** Drop lines whose product ids are gone (e.g. after reseed). */
export function pruneStoreCart(validProductIds: Iterable<string>) {
  const ok = new Set(validProductIds)
  const lines = readStoreCart()
  const next = lines.filter((l) => ok.has(l.productId))
  if (next.length !== lines.length) writeStoreCart(next)
  return next
}

/**
 * Like pruneStoreCart, but reports what was removed so the cart can tell the
 * shopper instead of silently shrinking.
 */
export function pruneStoreCartReport(validProductIds: Iterable<string>) {
  const ok = new Set(validProductIds)
  const lines = readStoreCart()
  const kept = lines.filter((l) => ok.has(l.productId))
  const removed = lines.filter((l) => !ok.has(l.productId))
  if (removed.length) writeStoreCart(kept)
  return { kept, removed }
}

export function storeCartCount(lines = readStoreCart()) {
  return lines.reduce((n, l) => n + l.qty, 0)
}
