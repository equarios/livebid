import { usd } from './format'
import type { CopySettings, Lot } from '../types'

export type BidPriceCtx = {
  /** Offline / sealed: price is not tied to other clients’ highs. */
  independent?: boolean
  lastOwnAmount?: number
  lastOwnQty?: number
}

/** Minimum price shown in the bid box (can match your last bid). */
export function minBidPrice(lot: Pick<Lot, 'startPrice' | 'currentPrice'>, ctx?: BidPriceCtx) {
  if (ctx?.lastOwnAmount != null) return Math.round(ctx.lastOwnAmount)
  if (ctx?.independent) return Math.round(lot.startPrice)
  return Math.round(Math.max(lot.startPrice, lot.currentPrice)) + 1
}

function marketMinPrice(lot: Pick<Lot, 'startPrice' | 'currentPrice'>) {
  return Math.round(Math.max(lot.startPrice, lot.currentPrice)) + 1
}

export function checkBidPrice(
  lot: Pick<Lot, 'startPrice' | 'currentPrice'>,
  amount: number,
  copy?: Pick<CopySettings, 'warnMinPrice' | 'warnOwnBidLower' | 'warnStartPrice'>,
  ctx?: BidPriceCtx,
): string | null {
  if (!Number.isFinite(amount)) {
    return copy?.warnMinPrice || 'Enter a valid price per pc.'
  }
  const last = ctx?.lastOwnAmount
  if (last != null && amount < last) {
    const message =
      copy?.warnOwnBidLower ||
      'Your previous bid was {price} / pc. You cannot reduce it — enter the same or a higher price.'
    return message.replace('{price}', usd(last))
  }
  // Same price as last bid: qty rules decide whether the revise is useful.
  if (last != null && amount === last) return null

  if (ctx?.independent) {
    const floor = last ?? lot.startPrice
    if (amount >= floor) return null
    const message =
      copy?.warnStartPrice ||
      'Price must be at least {price} per pc. Other clients’ prices are not shown on Offline Auctions.'
    return message.replace('{price}', usd(floor))
  }

  const min = marketMinPrice(lot)
  if (amount >= min) return null
  const message =
    copy?.warnMinPrice ||
    'Price must be at least {price} per pc ($1 above the current high). You cannot bid lower.'
  return message.replace('{price}', usd(min))
}

export type BidQtyCtx = {
  lastOwnQty?: number
  lastOwnAmount?: number
  /** Unit price being submitted — used for same-price revise check. */
  amount?: number
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

export function minBidQty(lot: Pick<Lot, 'moq'>, lastOwnQty?: number) {
  return Math.max(lotMoq(lot), lastOwnQty ?? 0)
}

/** Clamp Super offer-floor % to 0–100 (default 30). */
export function offerFloorPct(pct?: number | null) {
  const n = Number(pct)
  if (!Number.isFinite(n)) return 30
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100))
}

/** Lowest offer allowed vs list (`pct`% of list, at least $1). */
export function minOfferPrice(listedPrice: number, pct?: number | null) {
  const list = Math.max(0, Number(listedPrice) || 0)
  const rate = offerFloorPct(pct) / 100
  return Math.max(1, Math.round(list * rate))
}

/**
 * Marketplace offer vs list only: ≥ Super `offerFloorPct` of original list.
 * (Pending-offer ratchet is qty / same-price rules elsewhere — price may move down to the floor.)
 */
export function checkOfferPrice(
  listedPrice: number,
  amount: number,
  copy?: Pick<CopySettings, 'warnMinPrice' | 'warnOfferPrice' | 'warnOwnBidLower'>,
  _lastOwnAmount?: number,
  pct?: number | null,
): string | null {
  const floorPct = offerFloorPct(pct)
  const floor = minOfferPrice(listedPrice, floorPct)
  if (!Number.isFinite(amount) || amount < floor) {
    return (
      copy?.warnOfferPrice ||
      'Offer must be at least {price} per pc ({pct}% of list).'
    )
      .replace('{price}', usd(floor))
      .replace('{pct}', String(floorPct))
  }
  return null
}

export function checkOrderQty(
  lot: Pick<Lot, 'qty' | 'moq'>,
  qty: number,
  copy?: Pick<CopySettings, 'warnQty' | 'warnMoq' | 'warnOverQty'>,
  ctx?: BidQtyCtx,
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
  if (ctx?.lastOwnQty != null && qty < ctx.lastOwnQty) {
    return `Your previous bid was ${ctx.lastOwnQty.toLocaleString()} pcs. You cannot reduce qty — enter the same or more.`
  }
  if (
    ctx?.lastOwnAmount != null &&
    ctx.amount != null &&
    ctx.amount === ctx.lastOwnAmount &&
    ctx.lastOwnQty != null &&
    qty <= ctx.lastOwnQty
  ) {
    return 'Same price as your last bid. Raise qty or price to update.'
  }
  return null
}
