/** Query key for digest / email deep-links into Your desk. */
export const PULSE_QUERY = 'pulse'

export type PulseKey = 'outbid' | 'invoice' | 'watch' | 'offer' | 'sealed' | 'bids' | 'pending' | 'soon'

const PULSE_KEYS = new Set<string>([
  'outbid',
  'invoice',
  'watch',
  'offer',
  'sealed',
  'bids',
  'pending',
  'soon',
])

export function parsePulseKey(raw: string | null | undefined): PulseKey | null {
  if (!raw || !PULSE_KEYS.has(raw)) return null
  return raw as PulseKey
}

/** Hub URL used in digest emails and staff notices. */
export function pulseHubPath(key: PulseKey): string {
  return `/wholesale?${PULSE_QUERY}=${key}`
}
