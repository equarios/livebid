/** Resolve brand for store cards — explicit field, else common title patterns. */
export function storeProductBrand(product: { brand?: string | null; title: string }) {
  const explicit = (product.brand || '').trim()
  if (explicit) return explicit

  const t = product.title.trim()
  const lower = t.toLowerCase()
  if (/^(iphone|ipad|macbook|watch)\b/.test(lower)) return 'Apple'
  if (/^galaxy\b/.test(lower)) return 'Samsung'
  if (/^pixel\b/.test(lower)) return 'Google'
  if (/^xperia\b/.test(lower)) return 'Sony'
  if (/^xiaomi\b|^redmi\b|^poco\b/.test(lower)) return 'Xiaomi'
  if (/^oneplus\b/.test(lower)) return 'OnePlus'
  if (/^motorola\b|^moto\b/.test(lower)) return 'Motorola'
  if (/^nokia\b/.test(lower)) return 'Nokia'
  if (/^huawei\b/.test(lower)) return 'Huawei'
  if (/^oppo\b/.test(lower)) return 'Oppo'
  if (/^asus\b/.test(lower)) return 'ASUS'
  if (/^dell\b/.test(lower)) return 'Dell'
  if (/^hp\b/.test(lower)) return 'HP'
  if (/^lenovo\b|^thinkpad\b/.test(lower)) return 'Lenovo'

  for (const maker of [
    'Apple',
    'Samsung',
    'Google',
    'Sony',
    'Xiaomi',
    'OnePlus',
    'Motorola',
    'Nokia',
    'Huawei',
    'Oppo',
    'ASUS',
    'Dell',
    'HP',
    'Lenovo',
  ]) {
    if (lower.startsWith(maker.toLowerCase() + ' ') || lower.startsWith(maker.toLowerCase() + '—')) {
      return maker
    }
  }
  return ''
}
