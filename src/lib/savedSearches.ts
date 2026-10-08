import type { AuctionType, Grade } from '../types'

export type SavedSearch = {
  name: string
  types: Array<AuctionType | 'ongoing'>
  grades: Grade[]
  makers: string[]
  memories: string[]
  origins?: string[]
  lo: number
  hi: number
  q: string
}

const KEY = 'equarios-named-searches'

export function readSavedSearches(): SavedSearch[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]') as unknown
    return Array.isArray(parsed) ? (parsed as SavedSearch[]) : []
  } catch {
    return []
  }
}

export function writeSavedSearches(list: SavedSearch[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 12)))
}
