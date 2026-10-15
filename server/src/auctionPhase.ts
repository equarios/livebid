/** Live → Extra sealed phase helpers (server). */

export type PhaseLot = {
  endsAt: bigint | number
  extraSealedEndsAt?: bigint | number | null
}

export function lotEndsAtMs(lot: PhaseLot): number {
  return Number(lot.endsAt)
}

export function lotExtraSealedEndsAtMs(lot: PhaseLot): number | null {
  if (lot.extraSealedEndsAt == null) return null
  const n = Number(lot.extraSealedEndsAt)
  return n > 0 ? n : null
}

/** When the lot finally settles (Extra sealed end, else live end). */
export function effectiveEndsAtMs(lot: PhaseLot): number {
  return lotExtraSealedEndsAtMs(lot) ?? lotEndsAtMs(lot)
}

export function isAuctionOpen(lot: PhaseLot, now = Date.now()): boolean {
  return effectiveEndsAtMs(lot) > now
}

/** Live clock finished, Extra sealed overtime still open. */
export function isInExtraSealed(lot: PhaseLot, now = Date.now()): boolean {
  const extra = lotExtraSealedEndsAtMs(lot)
  if (extra == null) return false
  return now > lotEndsAtMs(lot) && now <= extra
}

export function computeExtraSealedEndsAt(closesAt: number, extraSealedMinutes?: number): number | null {
  const mins = Math.floor(Number(extraSealedMinutes) || 0)
  if (mins <= 0 || !closesAt) return null
  return closesAt + mins * 60 * 1000
}
