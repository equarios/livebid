/** Market / ship-from region — 3-letter codes (legacy 2-letter normalized). */

export const ORIGINS = ['JPN', 'KOR', 'EUR', 'USA', 'HKG', 'ARE', 'TWN', 'INT'] as const
export type OriginCode = (typeof ORIGINS)[number]

const ORIGIN_ALIASES: Record<string, OriginCode> = {
  JP: 'JPN',
  JPN: 'JPN',
  KR: 'KOR',
  KOR: 'KOR',
  EU: 'EUR',
  EUR: 'EUR',
  US: 'USA',
  USA: 'USA',
  HK: 'HKG',
  HKG: 'HKG',
  AE: 'ARE',
  ARE: 'ARE',
  TW: 'TWN',
  TWN: 'TWN',
  INT: 'INT',
}

export function normalizeOrigin(raw?: string | null): OriginCode {
  const key = String(raw || 'INT').trim().toUpperCase()
  return ORIGIN_ALIASES[key] || 'INT'
}
