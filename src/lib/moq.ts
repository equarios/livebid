import { usd } from './format'
import type { CopySettings, Lot } from '../types'

export type BidPriceCtx = {
  /** Offline / sealed: price is not tied to other clients’ highs. */
  independent?: boolean
  lastOwnAmount?: number
}

/** Live: $1 above the displayed high. Offline: start, or your own last bid (cannot reduce). */
export function minBidPrice(lot: Pick<Lot, 'startPrice' | 'currentPrice'>, ctx?: BidPriceCtx) {
  if (ctx?.independent) {
    const floor = ctx.lastOwnAmount != null ? ctx.lastOwnAmount : lot.startPrice
    return Math.round(floor)
  }
  return Math.round(Math.max(lot.startPrice, lot.currentPrice)) + 1
}

export function checkBidPrice(
  lot: Pick<Lot, 'startPrice' | 'currentPrice'>,
  amount: number,
  copy?: Pick<CopySettings, 'warnMinPrice' | 'warnOwnBidLower' | 'warnStartPrice'>,
  ctx?: BidPriceCtx,
): string | null {
  const min = minBidPrice(lot, ctx)
  if (Number.isFinite(amount) && amount >= min) return null
  if (ctx?.independent && ctx.lastOwnAmount != null) {
    const message =
      copy?.warnOwnBidLower ||
      'Your previous bid was {price} / pc. You cannot reduce it. Enter the same or a higher price.'
    return message.replace('{price}', usd(ctx.lastOwnAmount))
  }
  if (ctx?.independent) {
    const message =
      copy?.warnStartPrice ||
      'Price must be at least {price} per pc. Other clients’ prices are not shown on Offline Auctions.'
    return message.replace('{price}', usd(min))
  }
  const message =
    copy?.warnMinPrice ||
    'Price must be at least {price} per pc ($1 above the current high). You cannot bid lower.'
  return message.replace('{price}', usd(min))
}

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
