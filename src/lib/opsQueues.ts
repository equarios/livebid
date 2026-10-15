import type { Account, CartOrder, Invoice, ListingDrop, MarketOffer } from '../types'
import type { StoreOrderDto } from './api'
import { localIsoDate } from './fulfillment'

export type OpsQueueCounts = {
  pendingCarts: number
  pendingOffers: number
  catalogWait: number
  catalogWaitItems: number
  issueWait: number
  payRequests: number
  pendingAccounts: number
  /** submitted + under_review */
  wholesaleSubmitted: number
  wholesaleNeedsDocs: number
  /** Apps waiting on staff (submitted / under review / needs docs). */
  wholesaleApps: number
  /** Approved buyers idle (no bids in ~7d) — filled by staff desk when known. */
  wholesaleStuck: number
  /** Invoices/orders marked ready for warehouse pickup or buyer courier. */
  readyCollect: number
  /** buyer_courier paid/issued, not yet ready for collect. */
  awaitCourier: number
  /** Delivery with fee still TBD (admin_decide). */
  shipQuoteTbd: number
  /** Pickup appointments scheduled for today. */
  todayCollects: number
  /** Open product questions (store / auction / marketplace). */
  productAsks: number
  commerce: number
  money: number
  fulfillment: number
  total: number
}

function invOpen(inv: Invoice) {
  return inv.status !== 'declined' && !inv.shippedAt && !inv.shippingAddendum
}

export function opsQueueCounts(input: {
  cartOrders?: CartOrder[]
  offers?: MarketOffer[]
  listingDrops?: ListingDrop[]
  invoices?: Invoice[]
  accounts?: Account[]
  storeOrders?: StoreOrderDto[]
  wholesaleStuck?: number
  productAsks?: number
}): OpsQueueCounts {
  const pendingCarts = (input.cartOrders || []).filter((o) => o.status === 'pending').length
  const pendingOffers = (input.offers || []).filter((o) => o.status === 'pending').length
  const catalogWaitRows = (input.listingDrops || []).filter((d) => d.status === 'pending')
  const catalogWait = catalogWaitRows.length
  const catalogWaitItems = catalogWaitRows.reduce((n, d) => n + d.items.length, 0)
  const issueWait = (input.invoices || []).filter((i) => i.status === 'draft').length
  const payRequests = (input.invoices || []).filter((i) => i.status === 'pending_review').length
  const pendingAccounts = (input.accounts || []).filter((a) => a.status === 'pending').length
  const wholesaleSubmitted = (input.accounts || []).filter(
    (a) => a.wholesaleStatus === 'submitted' || a.wholesaleStatus === 'under_review',
  ).length
  const wholesaleNeedsDocs = (input.accounts || []).filter(
    (a) => a.wholesaleStatus === 'needs_docs',
  ).length
  const wholesaleApps = wholesaleSubmitted + wholesaleNeedsDocs
  const wholesaleStuck = input.wholesaleStuck || 0

  const invReady = (input.invoices || []).filter(
    (i) => invOpen(i) && i.readyForCollect && i.status !== 'draft',
  ).length
  const storeReady = (input.storeOrders || []).filter(
    (o) => o.readyForCollect && o.status === 'paid',
  ).length
  const readyCollect = invReady + storeReady

  const invAwait = (input.invoices || []).filter(
    (i) =>
      invOpen(i) &&
      i.fulfillmentMode === 'buyer_courier' &&
      !i.readyForCollect &&
      i.status !== 'draft',
  ).length
  const storeAwait = (input.storeOrders || []).filter(
    (o) =>
      o.fulfillmentMode === 'buyer_courier' &&
      !o.readyForCollect &&
      (o.status === 'paid' || o.status === 'pending_payment'),
  ).length
  const awaitCourier = invAwait + storeAwait

  const invTbd = (input.invoices || []).filter(
    (i) =>
      invOpen(i) &&
      i.fulfillmentMode === 'delivery' &&
      i.shippingFeeQuoted === false &&
      i.status !== 'draft',
  ).length
  const storeTbd = (input.storeOrders || []).filter(
    (o) =>
      o.fulfillmentMode === 'delivery' &&
      o.shippingFeeQuoted === false &&
      o.status !== 'cancelled' &&
      o.status !== 'shipped',
  ).length
  const shipQuoteTbd = invTbd + storeTbd

  const today = localIsoDate()
  const invToday = (input.invoices || []).filter(
    (i) => invOpen(i) && i.fulfillmentMode === 'pickup' && i.pickupDate === today,
  ).length
  const storeToday = (input.storeOrders || []).filter(
    (o) =>
      o.fulfillmentMode === 'pickup' &&
      o.pickupDate === today &&
      o.status !== 'cancelled' &&
      o.status !== 'shipped',
  ).length
  const todayCollects = invToday + storeToday

  const productAsks = Math.max(0, Math.floor(Number(input.productAsks) || 0))
  const commerce = pendingCarts + pendingOffers + productAsks
  const money = issueWait + payRequests
  const fulfillment = readyCollect + awaitCourier + shipQuoteTbd + todayCollects
  return {
    pendingCarts,
    pendingOffers,
    catalogWait,
    catalogWaitItems,
    issueWait,
    payRequests,
    pendingAccounts,
    wholesaleSubmitted,
    wholesaleNeedsDocs,
    wholesaleApps,
    wholesaleStuck,
    readyCollect,
    awaitCourier,
    shipQuoteTbd,
    todayCollects,
    productAsks,
    commerce,
    money,
    fulfillment,
    total:
      commerce +
      catalogWaitItems +
      money +
      pendingAccounts +
      wholesaleApps +
      wholesaleStuck +
      fulfillment,
  }
}
