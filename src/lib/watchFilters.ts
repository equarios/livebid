import type { Lot, Notice } from '../types'
import { api } from './api'
import { effectiveEndsAt } from './auctionLists'
import {
  categoryPath,
  conditionLabel,
  deviceClassLabel,
  lotMatchesFacet,
  type DeviceClass,
  type LotCondition,
  type SeoFacet,
} from './seoTaxonomy'

export type WatchFilter = {
  id: string
  deviceClass?: DeviceClass
  condition?: LotCondition
  label: string
  to: string
  createdAt: number
}

const KEY = 'livebid.watchFilters.v1'
const SEEN_KEY = 'livebid.watchNotified.v1'

function storageKey(accountId: string) {
  return `${KEY}:${accountId}`
}

function seenKey(accountId: string) {
  return `${SEEN_KEY}:${accountId}`
}

function loadSeen(accountId: string): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(accountId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveSeen(accountId: string, seen: Set<string>) {
  try {
    localStorage.setItem(seenKey(accountId), JSON.stringify([...seen].slice(-400)))
  } catch {
    /* quota */
  }
}

function noticeId(accountId: string, filterId: string, lotId: string) {
  return `watch:${accountId}:${filterId}:${lotId}`
}

function openLots(lots: Lot[], now: number) {
  return lots.filter((l) => {
    if (l.channel === 'auction') return effectiveEndsAt(l) > now
    return l.channel === 'marketplace'
  })
}

/** Mark current matches as already notified so only new lots ping later. */
export function seedWatchFilterSeen(
  accountId: string,
  facet: SeoFacet,
  lots: Lot[],
  now: number,
) {
  const filterId = categoryPath(facet)
  const seen = loadSeen(accountId)
  for (const lot of openLots(lots, now)) {
    if (!lotMatchesFacet(lot, facet)) continue
    seen.add(noticeId(accountId, filterId, lot.id))
  }
  saveSeen(accountId, seen)
}

export function loadWatchFilters(accountId: string): WatchFilter[] {
  try {
    const raw = localStorage.getItem(storageKey(accountId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as WatchFilter[]
    return Array.isArray(parsed) ? parsed.filter((f) => f && f.id && f.to) : []
  } catch {
    return []
  }
}

function saveWatchFilters(accountId: string, rows: WatchFilter[]) {
  const next = rows.slice(0, 24)
  try {
    localStorage.setItem(storageKey(accountId), JSON.stringify(next))
  } catch {
    /* quota */
  }
  void api.saveWatchFilters(next).catch(() => undefined)
}

/** Pull server filters after login (offline emails use the same list). */
export async function pullWatchFiltersFromServer(accountId: string): Promise<WatchFilter[]> {
  try {
    const res = await api.getWatchFilters()
    const rows = (res.filters || []) as WatchFilter[]
    if (Array.isArray(rows) && rows.length) {
      try {
        localStorage.setItem(storageKey(accountId), JSON.stringify(rows.slice(0, 24)))
      } catch {
        /* quota */
      }
      return rows
    }
  } catch {
    /* offline / demo */
  }
  return loadWatchFilters(accountId)
}

export function watchFilterLabel(facet: SeoFacet): string {
  const bits: string[] = []
  if (facet.deviceClass) bits.push(deviceClassLabel(facet.deviceClass))
  if (facet.condition) bits.push(conditionLabel(facet.condition))
  return bits.join(' · ') || 'Category'
}

export function upsertWatchFilter(
  accountId: string,
  facet: SeoFacet,
  lots?: Lot[],
  now?: number,
): WatchFilter[] {
  const rows = loadWatchFilters(accountId)
  const to = categoryPath(facet)
  const id = to
  const next: WatchFilter = {
    id,
    deviceClass: facet.deviceClass,
    condition: facet.condition,
    label: watchFilterLabel(facet),
    to,
    createdAt: Date.now(),
  }
  const without = rows.filter((r) => r.id !== id)
  const merged = [next, ...without]
  saveWatchFilters(accountId, merged)
  if (lots && typeof now === 'number') seedWatchFilterSeen(accountId, facet, lots, now)
  return merged
}

/** New open lots matching saved filters → NoticeBell items (client-local). */
export function drainWatchFilterNotices(
  accountId: string,
  lots: Lot[],
  now: number,
): Notice[] {
  const filters = loadWatchFilters(accountId)
  if (!filters.length) return []
  const seen = loadSeen(accountId)
  const open = openLots(lots, now)
  const notices: Notice[] = []
  const at = Date.now()
  for (const f of filters) {
    const facet: SeoFacet = {
      deviceClass: f.deviceClass,
      condition: f.condition,
    }
    for (const lot of open) {
      if (!lotMatchesFacet(lot, facet)) continue
      const id = noticeId(accountId, f.id, lot.id)
      if (seen.has(id)) continue
      seen.add(id)
      const title = `${lot.manufacturer} ${lot.model}`.trim()
      notices.push({
        id,
        accountId,
        kind: 'watch',
        title: `Watch match · ${f.label}`,
        body: title || lot.id,
        href: f.to,
        at,
      })
    }
  }
  if (notices.length) saveSeen(accountId, seen)
  return notices.slice(0, 12)
}

export function removeWatchFilter(accountId: string, id: string): WatchFilter[] {
  const merged = loadWatchFilters(accountId).filter((r) => r.id !== id)
  saveWatchFilters(accountId, merged)
  return merged
}

export function isWatchingFilter(accountId: string, facet: SeoFacet): boolean {
  const to = categoryPath(facet)
  return loadWatchFilters(accountId).some((r) => r.id === to)
}

/** Open lots matching any saved filter (auction or marketplace). */
export function countWatchFilterMatches(
  accountId: string,
  lots: Lot[],
  now: number,
): { filters: number; lots: number; firstTo: string | null } {
  const filters = loadWatchFilters(accountId)
  if (!filters.length) return { filters: 0, lots: 0, firstTo: null }
  const open = openLots(lots, now)
  const hit = new Set<string>()
  let firstTo: string | null = null
  for (const f of filters) {
    const facet: SeoFacet = {
      deviceClass: f.deviceClass,
      condition: f.condition,
    }
    for (const lot of open) {
      if (!lotMatchesFacet(lot, facet)) continue
      hit.add(lot.id)
      if (!firstTo) firstTo = f.to
    }
  }
  return { filters: filters.length, lots: hit.size, firstTo }
}
