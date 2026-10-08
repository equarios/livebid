import type { SiteSettings } from '../types'

export function listingMinutes(settings: SiteSettings, kind: 'reopen' | 'extend') {
  const hours = kind === 'reopen' ? settings.reopenHours : settings.extendHours
  const mins = kind === 'reopen' ? settings.reopenMinutes : settings.extendMinutes
  const n = mins != null && Number.isFinite(mins) ? mins : (hours || 0) * 60
  return Math.max(1, Math.round(n))
}

export function listingMs(settings: SiteSettings, kind: 'reopen' | 'extend') {
  return listingMinutes(settings, kind) * 60 * 1000
}

export function listingLabel(minutes: number) {
  const n = Math.max(1, Math.round(minutes))
  if (n < 60) return `${n}m`
  const h = Math.floor(n / 60)
  const m = n % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
