import type { Account, CartOrder, Invoice, ListingDrop, MarketOffer } from '../types'

export type OpsQueueCounts = {
  pendingCarts: number
  pendingOffers: number
  catalogWait: number
  catalogWaitItems: number
  issueWait: number
  payRequests: number
  pendingAccounts: number
  commerce: number
  money: number
  total: number
}

export function opsQueueCounts(input: {
  cartOrders?: CartOrder[]
  offers?: MarketOffer[]
  listingDrops?: ListingDrop[]
  invoices?: Invoice[]
  accounts?: Account[]
}): OpsQueueCounts {
  const pendingCarts = (input.cartOrders || []).filter((o) => o.status === 'pending').length
  const pendingOffers = (input.offers || []).filter((o) => o.status === 'pending').length
  const catalogWaitRows = (input.listingDrops || []).filter((d) => d.status === 'pending')
  const catalogWait = catalogWaitRows.length
  const catalogWaitItems = catalogWaitRows.reduce((n, d) => n + d.items.length, 0)
  const issueWait = (input.invoices || []).filter((i) => i.status === 'draft').length
  const payRequests = (input.invoices || []).filter((i) => i.status === 'pending_review').length
  const pendingAccounts = (input.accounts || []).filter((a) => a.status === 'pending').length
  const commerce = pendingCarts + pendingOffers
  const money = issueWait + payRequests
  return {
    pendingCarts,
    pendingOffers,
    catalogWait,
    catalogWaitItems,
    issueWait,
    payRequests,
    pendingAccounts,
    commerce,
    money,
    total: commerce + catalogWaitItems + money + pendingAccounts,
  }
}
