import type { Lot } from '@prisma/client'
import { prisma } from './db'
import { notify } from './notify'

export type WatchFilterRow = {
  id: string
  deviceClass?: string
  condition?: string
  label: string
  to: string
  createdAt: number
}

const DEVICE_CLASSES = new Set([
  'phones',
  'tablets',
  'pcs',
  'laptops',
  'chromebooks',
  'consoles',
  'other',
])

function inferDeviceClass(lot: Pick<Lot, 'manufacturer' | 'model' | 'description'>): string {
  const hay = `${lot.manufacturer} ${lot.model} ${lot.description || ''}`.toLowerCase()
  if (/\b(playstation|xbox|nintendo|switch|psp|ps[345]|steam\s*deck|console)\b/.test(hay)) {
    return 'consoles'
  }
  if (/\bchromebook\b/.test(hay)) return 'chromebooks'
  if (/\b(macbook|laptop|notebook|thinkpad|zenbook|vivobook)\b/.test(hay)) return 'laptops'
  if (/\b(imac|mac\s*mini|desktop|pc\b|tower)\b/.test(hay)) return 'pcs'
  if (/\b(ipad|tablet|galaxy\s*tab|surface\s*go|tab\s*[as])\b/.test(hay)) return 'tablets'
  if (/\b(watch|airpods|buds|earphone|headphone)\b/.test(hay)) return 'other'
  if (/\b(iphone|galaxy\s*s|pixel|redmi|phone|smartphone)\b/.test(hay)) return 'phones'
  const m = lot.manufacturer.toLowerCase()
  if (m.includes('apple') || m.includes('samsung') || m.includes('google') || m.includes('xiaomi')) {
    return 'phones'
  }
  return 'other'
}

function inferCondition(
  lot: Pick<Lot, 'grade' | 'description' | 'simLocked' | 'activationLocked'>,
  want?: string,
): string {
  const hay = `${lot.grade || ''} ${lot.description || ''}`.toLowerCase()
  if (/\bscrap\b/.test(hay)) return 'scrap'
  if (/\brecycl/.test(hay)) return 'recycled'
  if (/\brefurb|renewed|certified\s*pre/.test(hay)) return 'refurbished'
  if (/\b(brand\s*new|sealed|bnib|new\s*open)\b/.test(hay) || lot.grade === 'S') return 'new'
  if (want === 'locked' || want === 'unlocked') {
    return lot.simLocked || lot.activationLocked ? 'locked' : 'unlocked'
  }
  return 'used'
}

export function lotMatchesFilter(lot: Lot, filter: WatchFilterRow): boolean {
  if (filter.deviceClass && DEVICE_CLASSES.has(filter.deviceClass)) {
    if (inferDeviceClass(lot) !== filter.deviceClass) return false
  }
  if (filter.condition) {
    if (filter.condition === 'locked') return Boolean(lot.simLocked || lot.activationLocked)
    if (filter.condition === 'unlocked') return !lot.simLocked && !lot.activationLocked
    return inferCondition(lot, filter.condition) === filter.condition
  }
  return true
}

export function parseWatchFilters(raw: string | null | undefined): WatchFilterRow[] {
  try {
    const parsed = JSON.parse(raw || '[]') as WatchFilterRow[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((f) => f && typeof f.id === 'string' && typeof f.to === 'string')
      .slice(0, 24)
  } catch {
    return []
  }
}

/** After lots publish — email/notice buyers whose saved filters match (works offline). */
export async function notifyWatchersForLots(lots: Lot[]) {
  if (!lots.length) return
  const accounts = await prisma.account.findMany({
    where: {
      wholesaleStatus: 'approved',
      status: 'active',
      NOT: { watchFiltersJson: '[]' },
    },
    select: { accountId: true, watchFiltersJson: true },
  })
  for (const acc of accounts) {
    const filters = parseWatchFilters(acc.watchFiltersJson)
    if (!filters.length) continue
    for (const filter of filters) {
      for (const lot of lots) {
        if (!lotMatchesFilter(lot, filter)) continue
        const title = `${lot.manufacturer} ${lot.model}`.trim() || lot.id
        await notify({
          id: `watch:${acc.accountId}:${filter.id}:${lot.id}`,
          accountId: acc.accountId,
          kind: 'watch',
          title: `Watch match · ${filter.label || filter.id}`,
          body: title,
          href: filter.to || '/wholesale',
        })
      }
    }
  }
}
