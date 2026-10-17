import { originLabel, normalizeOrigin } from './auctionLists'
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
    originLabel(row.origin),
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
  return `${sku.color} · Grade ${sku.grade} · ${originLabel(sku.origin)} · ${sku.battery}% · ${sim} · ${act}${
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
    origin: normalizeOrigin(lot.origin),
    operator: lot.operator,
    simLocked: lot.simLocked,
    activationLocked: lot.activationLocked,
    description: lot.description || '',
    defaultMoq: lot.moq,
    lastPrice: lot.currentPrice,
    onHand: 0,
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

/** Take listed qty off matching warehouse SKUs. Fails closed if a SKU is missing or short. */
export function reserveInventory(list: InventorySku[], lots: Lot[]): { inventory: InventorySku[]; error: string | null } {
  const next = list.map((sku) => ({ ...sku }))
  const need = new Map<string, { sku: InventorySku; qty: number; name: string }>()
  for (const lot of lots) {
    if (lot.qty < 1) continue
    const fp = skuFingerprint(lot)
    const sku = next.find((row) => skuFingerprint(row) === fp)
    const name = `${lot.manufacturer} ${lot.model}`.trim()
    if (!sku) return { inventory: list, error: `No warehouse item matches ${name}.` }
    const row = need.get(sku.id) || { sku, qty: 0, name }
    row.qty += lot.qty
    need.set(sku.id, row)
  }
  for (const row of need.values()) {
    const onHand = Math.max(0, Math.floor(Number(row.sku.onHand) || 0))
    if (row.qty > onHand) {
      return { inventory: list, error: `Only ${onHand} on hand for ${row.name}. This list needs ${row.qty}.` }
    }
  }
  for (const row of need.values()) {
    const onHand = Math.max(0, Math.floor(Number(row.sku.onHand) || 0))
    row.sku.onHand = onHand - row.qty
  }
  return { inventory: next, error: null }
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
