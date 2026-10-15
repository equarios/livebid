/**
 * UTC quiet window for non-urgent buyer email.
 * CARE_QUIET_START_HOUR (default 22) → CARE_QUIET_END_HOUR (default 7).
 * Set both equal to disable.
 */
export function isQuietHours(now = new Date()): boolean {
  const startRaw = Number(process.env.CARE_QUIET_START_HOUR)
  const endRaw = Number(process.env.CARE_QUIET_END_HOUR)
  const start = Number.isFinite(startRaw) && startRaw >= 0 && startRaw <= 23 ? startRaw : 22
  const end = Number.isFinite(endRaw) && endRaw >= 0 && endRaw <= 23 ? endRaw : 7
  if (start === end) return false
  const h = now.getUTCHours()
  if (start < end) return h >= start && h < end
  return h >= start || h < end
}

/** Kinds deferred overnight — invoice / sealed / auth / wins still email. */
const QUIET_KINDS = new Set([
  'outbid',
  'watch',
  'digest',
  'closing',
  'fill',
  'thanks',
])

export function isQuietEmailKind(kind: string): boolean {
  return QUIET_KINDS.has(kind)
}
