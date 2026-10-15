import type { DeskPulseStat } from './deskPulse'
import { parsePulseKey, type PulseKey } from './deskPulseNav'

const KEY = 'livebid.pulseMemory.v1'

function storageKey(accountId: string) {
  return `${KEY}:${accountId}`
}

export function rememberPulseKey(accountId: string, key: string) {
  if (!parsePulseKey(key)) return
  try {
    localStorage.setItem(storageKey(accountId), key)
  } catch {
    /* quota */
  }
}

export function loadPulseKey(accountId: string): PulseKey | null {
  try {
    return parsePulseKey(localStorage.getItem(storageKey(accountId)))
  } catch {
    return null
  }
}

/** Move the remembered chip to the front when it is still actionable. */
export function preferRememberedPulse(
  stats: DeskPulseStat[],
  remembered: PulseKey | null,
): DeskPulseStat[] {
  if (!remembered || stats.length < 2) return stats
  const idx = stats.findIndex((s) => s.key === remembered)
  if (idx <= 0) return stats
  const next = stats.slice()
  const [hit] = next.splice(idx, 1)
  return [hit, ...next]
}
