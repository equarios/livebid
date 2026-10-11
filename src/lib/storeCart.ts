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

export function clearStoreCart() {
  writeStoreCart([])
}

export function storeCartCount(lines = readStoreCart()) {
  return lines.reduce((n, l) => n + l.qty, 0)
}
