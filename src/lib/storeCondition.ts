/** Shared by store SKUs and auction/marketplace lots. */
export type DeviceConditionFields = {
  grade?: string | null
  simLocked?: boolean | null
  activationLocked?: boolean | null
}

export type StoreConditionFilter = 'ready' | 'sim-locked' | 'act-locked' | 'as-is'

export const STORE_CONDITION_OPTIONS: StoreConditionFilter[] = [
  'ready',
  'sim-locked',
  'act-locked',
  'as-is',
]

export const STORE_CONDITION_LABEL: Record<StoreConditionFilter, string> = {
  ready: 'Ready (unlocked)',
  'sim-locked': 'SIM locked',
  'act-locked': 'Activation / MDM locked',
  'as-is': 'As-is (C/D/F)',
}

/** Empty selection = All conditions (shared Store / Marketplace / Auctions default). */
export const STORE_CONDITION_DEFAULT: StoreConditionFilter[] = []

export type StoreConditionTab = 'all' | StoreConditionFilter

export const STORE_CONDITION_TABS: { id: StoreConditionTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ready', label: 'Ready' },
  { id: 'sim-locked', label: 'SIM locked' },
  { id: 'act-locked', label: 'MDM locked' },
  { id: 'as-is', label: 'As-is' },
]

export function isStoreConditionDefault(selected: StoreConditionFilter[]) {
  return selected.length === 0
}

export function activeStoreConditionTab(
  selected: StoreConditionFilter[],
): StoreConditionTab | null {
  if (isStoreConditionDefault(selected)) return 'all'
  if (selected.length === 1) return selected[0]
  return null
}

export function conditionsFromTab(id: StoreConditionTab): StoreConditionFilter[] {
  if (id === 'all') return STORE_CONDITION_DEFAULT
  return [id]
}

/** Lower grades sold with more wear / possible faults. */
export function storeIsAsIs(product: Pick<DeviceConditionFields, 'grade'>) {
  const g = (product.grade || '').trim().toUpperCase()
  return g === 'C' || g === 'D' || g === 'F'
}

export function storeIsReady(product: DeviceConditionFields) {
  return !product.simLocked && !product.activationLocked && !storeIsAsIs(product)
}

export function matchesStoreCondition(
  product: DeviceConditionFields,
  selected: StoreConditionFilter[],
) {
  if (!selected.length) return true
  return selected.some((c) => {
    if (c === 'ready') return storeIsReady(product)
    if (c === 'sim-locked') return Boolean(product.simLocked)
    if (c === 'act-locked') return Boolean(product.activationLocked)
    if (c === 'as-is') return storeIsAsIs(product)
    const _exhaustive: never = c
    return _exhaustive
  })
}

export function deviceConditionCounts(items: DeviceConditionFields[]) {
  return {
    all: items.length,
    ready: items.filter((p) => storeIsReady(p)).length,
    'sim-locked': items.filter((p) => p.simLocked).length,
    'act-locked': items.filter((p) => p.activationLocked).length,
    'as-is': items.filter((p) => storeIsAsIs(p)).length,
  }
}

export function storeNeedsBuyAck(product: DeviceConditionFields) {
  return Boolean(product.simLocked || product.activationLocked || storeIsAsIs(product))
}

export function storeConditionHint(product: DeviceConditionFields) {
  const bits: string[] = []
  if (product.simLocked) bits.push('SIM locked')
  if (product.activationLocked) bits.push('activation locked')
  if (storeIsAsIs(product)) bits.push(`Grade ${product.grade} · sold as-is`)
  if (!bits.length) return null
  return `Lower price may reflect: ${bits.join(' · ')}`
}

export function storeAckLabel(product: DeviceConditionFields) {
  const bits: string[] = []
  if (product.simLocked) bits.push('SIM locked')
  if (product.activationLocked) bits.push('activation locked')
  if (storeIsAsIs(product)) bits.push('sold as-is / may have faults')
  return `I understand this device is ${bits.join(' and ')}.`
}
