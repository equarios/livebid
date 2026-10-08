import type { CopySettings, Lot } from '../types'

/** Effective minimum order qty. 1 means no wholesale MOQ. */
export function lotMoq(lot: Pick<Lot, 'moq'>): number {
  const n = lot.moq
  if (!n || n <= 1) return 1
  return n
}

export function hasMoq(lot: Pick<Lot, 'moq'>): boolean {
  return lotMoq(lot) > 1
}

export function moqLabel(lot: Pick<Lot, 'moq'>, noMoq = 'No MOQ'): string {
  return hasMoq(lot) ? `MOQ ${lotMoq(lot)}` : noMoq
}

export function checkOrderQty(
  lot: Pick<Lot, 'qty' | 'moq'>,
  qty: number,
  copy?: Pick<CopySettings, 'warnQty' | 'warnMoq' | 'warnOverQty'>,
): string | null {
  if (!Number.isInteger(qty) || qty < 1) {
    return copy?.warnQty || 'Desired qty must be a whole number of 1 or more.'
  }
  const min = lotMoq(lot)
  if (qty < min) {
    return (copy?.warnMoq || 'MOQ for this model is {n} pcs.').replace('{n}', String(min))
  }
  if (qty > lot.qty) {
    return (copy?.warnOverQty || 'Desired qty cannot exceed total pcs ({n}).').replace(
      '{n}',
      String(lot.qty),
    )
  }
  return null
}
