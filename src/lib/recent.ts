const KEY = 'equarios-recent-lots'
const MAX = 8

export function readRecentLots() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function pushRecentLot(lotId: string) {
  const next = [lotId, ...readRecentLots().filter((id) => id !== lotId)].slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
    window.dispatchEvent(new Event('equarios-recent'))
  } catch {
    /* ignore */
  }
  return next
}
