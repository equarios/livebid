export function usd(n: number) {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
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
  live: 'Real-time',
  sealed: 'Sealed bid',
  hybrid: 'Hybrid',
  marketplace: 'Marketplace',
}
