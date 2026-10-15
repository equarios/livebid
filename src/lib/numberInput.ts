/** Display value for controlled number fields — empty string while cleared. */
export function numStr(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return ''
  return String(n)
}

/** Parse non-negative int; empty → undefined (keep field blank while typing). */
export function parseNonNegInt(raw: string): number | undefined {
  const t = raw.trim()
  if (t === '') return undefined
  const n = Math.floor(Number(t))
  if (!Number.isFinite(n) || n < 0) return undefined
  return n
}

/** Commit non-negative int; empty → fallback. */
export function commitNonNegInt(raw: string, fallback = 0): number {
  return parseNonNegInt(raw) ?? fallback
}
