import { originLabel } from './auctionLists'

/** Maker, model, and model number. Capacity stays on the spec line. */
export function lotItemTitle(lot: { manufacturer?: string; model: string; modelNumber?: string }) {
  return [lot.manufacturer, lot.model, lot.modelNumber].filter(Boolean).join(' ')
}

/** Model and model number when the maker is already shown on its own. */
export function lotModelTitle(lot: { model: string; modelNumber?: string }) {
  return [lot.model, lot.modelNumber].filter(Boolean).join(' ')
}

/** Capacity, origin, and color — once, under the name. */
export function lotItemSub(lot: { capacity?: string; origin?: string | null; color?: string }) {
  return [lot.capacity, originLabel(lot.origin), lot.color].filter(Boolean).join(' · ')
}
