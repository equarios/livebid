import type { Lot, SiteSettings } from '../types'

export function fillCopy(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] == null ? `{${key}}` : String(vars[key]),
  )
}

export function isEndingSoon(endsAt: number, now: number, minutes: number) {
  return endsAt > now && endsAt - now <= minutes * 60 * 1000
}

export function specLocks(lot: Lot) {
  const sim = lot.simLocked ? 'SIM locked' : 'SIM unlocked'
  const act = lot.activationLocked ? 'Act locked' : 'Act open'
  return `${sim} · ${act}`
}

export function specLine(lot: Lot) {
  return `Grade ${lot.grade} · ${specLocks(lot)}`
}

export function usd(n: number) {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

export function usdAmt(n: number) {
  return `${n.toLocaleString('en-US')} USD`
}

export function formatDateTime(ts: number) {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  let tz = ''
  try {
    tz =
      new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
        .formatToParts(d)
        .find((part) => part.type === 'timeZoneName')?.value || ''
  } catch {
    tz = ''
  }
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${tz ? ` ${tz}` : ''}`
}

export function gbsDate(ts: number) {
  const d = new Date(ts)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${String(d.getDate()).padStart(2, '0')},${months[d.getMonth()]},${d.getFullYear()}`
}

export function moneyPlain(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function moneyUsd(n: number, currency = 'USD') {
  const code = (currency || 'USD').trim() || 'USD'
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${code}`
}

export function invoiceSlashDate(ts: number) {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`
}

export function isoDate(ts: number) {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function timeLeft(endsAt: number, now = Date.now()) {
  const ms = Math.max(0, endsAt - now)
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 48) return `${Math.floor(h / 24)}d ${h % 24}h`
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export const typeLabel: Record<string, string> = {
  live: 'Live Auctions',
  offline: 'Offline Auctions',
  sealed: 'Offline Auctions',
  hybrid: 'Offline Auctions',
  marketplace: 'Marketplace',
}

export function lotTypeLabel(lot: Lot, settings?: SiteSettings) {
  if (lot.channel === 'marketplace') return settings?.marketplaceLabel || typeLabel.marketplace
  const fromSettings = settings?.auctionTypes.find((t) => t.value === lot.auctionType)?.label
  return fromSettings || typeLabel[lot.auctionType || 'live']
}
