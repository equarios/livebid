import type { InventorySku, Lot } from '../types'

export function skuFingerprint(row: {
  manufacturer: string
  model: string
  modelNumber?: string
  capacity: string
  color: string
  grade: string
  origin?: string
  simLocked?: boolean
  activationLocked?: boolean
}) {
  return [
    row.manufacturer,
    row.model,
    row.modelNumber,
    row.capacity,
    row.color,
    row.grade,
    row.origin || 'INT',
    row.simLocked ? '1' : '0',
    row.activationLocked ? '1' : '0',
  ]
    .map((v) => String(v || '').trim().toLowerCase())
    .join('|')
}

export function skuTitle(sku: InventorySku) {
  return `${sku.manufacturer} ${sku.model}${sku.modelNumber ? ` ${sku.modelNumber}` : ''} ${sku.capacity}`.trim()
}

export function skuSpecLine(sku: InventorySku) {
  const sim = sku.simLocked ? 'SIM locked' : 'SIM unlocked'
  const act = sku.activationLocked ? 'Act locked' : 'Act open'
  const moq = sku.defaultMoq && sku.defaultMoq > 1 ? `MOQ ${sku.defaultMoq}` : 'No MOQ'
  return `${sku.color} · Grade ${sku.grade} · ${sku.origin || 'INT'} · ${sku.battery}% · ${sim} · ${act}${
    sku.operator ? ` · ${sku.operator}` : ''
  } · ${moq}`
}

export function skuFromLot(lot: Lot, id?: string): InventorySku {
  return {
    id: id || `SKU-${Date.now().toString(36)}-${Math.floor(Math.random() * 90 + 10)}`,
    manufacturer: lot.manufacturer,
    model: lot.model,
    modelNumber: lot.modelNumber || '',
    capacity: lot.capacity,
    color: lot.color,
    grade: lot.grade,
    battery: lot.battery,
    origin: lot.origin || 'INT',
    operator: lot.operator,
    simLocked: lot.simLocked,
    activationLocked: lot.activationLocked,
    description: lot.description || '',
    defaultMoq: lot.moq,
    lastPrice: lot.currentPrice,
  }
}

export function inventoryFromLots(lots: Lot[]): InventorySku[] {
  const map = new Map<string, InventorySku>()
  lots.forEach((lot, i) => {
    const fp = skuFingerprint(lot)
    if (map.has(fp)) return
    map.set(fp, skuFromLot(lot, `SKU-${String(i + 1).padStart(3, '0')}`))
  })
  return [...map.values()]
}

export function upsertInventory(list: InventorySku[], lots: Lot[]): InventorySku[] {
  const next = [...list]
  const byFp = new Map(next.map((s) => [skuFingerprint(s), s]))
  for (const lot of lots) {
    const fp = skuFingerprint(lot)
    const hit = byFp.get(fp)
    if (hit) {
      const updated: InventorySku = {
        ...hit,
        battery: lot.battery,
        description: lot.description || hit.description,
        defaultMoq: lot.moq ?? hit.defaultMoq,
        lastPrice: lot.currentPrice,
        operator: lot.operator || hit.operator,
      }
      const ix = next.findIndex((s) => s.id === hit.id)
      if (ix >= 0) next[ix] = updated
      byFp.set(fp, updated)
    } else {
      const sku = skuFromLot(lot)
      next.unshift(sku)
      byFp.set(fp, sku)
    }
  }
  return next
}

export function filterSkus(list: InventorySku[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return list
  return list.filter((sku) =>
    `${skuTitle(sku)} ${skuSpecLine(sku)} ${sku.id}`.toLowerCase().includes(q),
  )
}
