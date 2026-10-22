import type { StoreProductDto } from './api'

/** Lower grades sold with more wear / possible faults. */
export function storeIsAsIs(product: Pick<StoreProductDto, 'grade'>) {
  const g = (product.grade || '').trim().toUpperCase()
  return g === 'C' || g === 'D' || g === 'F'
}

export function storeNeedsBuyAck(
  product: Pick<StoreProductDto, 'simLocked' | 'activationLocked' | 'grade'>,
) {
  return Boolean(product.simLocked || product.activationLocked || storeIsAsIs(product))
}

export function storeConditionHint(
  product: Pick<StoreProductDto, 'simLocked' | 'activationLocked' | 'grade'>,
) {
  const bits: string[] = []
  if (product.simLocked) bits.push('SIM locked')
  if (product.activationLocked) bits.push('activation locked')
  if (storeIsAsIs(product)) bits.push(`Grade ${product.grade} · sold as-is`)
  if (!bits.length) return null
  return `Lower price may reflect: ${bits.join(' · ')}`
}

export function storeAckLabel(
  product: Pick<StoreProductDto, 'simLocked' | 'activationLocked' | 'grade'>,
) {
  const bits: string[] = []
  if (product.simLocked) bits.push('SIM locked')
  if (product.activationLocked) bits.push('activation locked')
  if (storeIsAsIs(product)) bits.push('sold as-is / may have faults')
  return `I understand this device is ${bits.join(' and ')}.`
}
