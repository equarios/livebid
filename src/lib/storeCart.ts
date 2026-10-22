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

export function addToStoreCart(productId: string, qty = 1) {
  const lines = readStoreCart()
  const hit = lines.find((l) => l.productId === productId)
  if (hit) hit.qty = Math.min(99, hit.qty + qty)
  else lines.push({ productId, qty: Math.min(99, qty) })
  writeStoreCart(lines)
  return lines
}

export function setStoreCartQty(productId: string, qty: number) {
  let lines = readStoreCart()
  if (qty <= 0) lines = lines.filter((l) => l.productId !== productId)
  else {
    const hit = lines.find((l) => l.productId === productId)
    if (hit) hit.qty = Math.min(99, qty)
    else lines.push({ productId, qty: Math.min(99, qty) })
  }
  writeStoreCart(lines)
  return lines
}

/** Swap one product for another, keeping qty (capped to maxStock). */
export function replaceStoreCartProduct(
  fromProductId: string,
  toProductId: string,
  maxStock = 99,
) {
  if (fromProductId === toProductId) return readStoreCart()
  const lines = readStoreCart()
  const from = lines.find((l) => l.productId === fromProductId)
  if (!from) return lines
  const qty = Math.min(from.qty, Math.max(1, maxStock))
  const without = lines.filter((l) => l.productId !== fromProductId)
  const hit = without.find((l) => l.productId === toProductId)
  if (hit) hit.qty = Math.min(99, hit.qty + qty)
  else without.push({ productId: toProductId, qty })
  writeStoreCart(without)
  return without
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

export function storeCartCount(lines = readStoreCart()) {
  return lines.reduce((n, l) => n + l.qty, 0)
}
