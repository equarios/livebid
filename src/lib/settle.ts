import { allocate, fillStats } from './allocate'
import { isEndingSoon, moneyPlain } from './format'
import { isSealedLot } from './auctionLists'
import type { Bid, Invoice, Lot, Notice, SiteSettings } from '../types'

function isBot(accountId: string) {
  return accountId.startsWith('BOT-')
}

export function auctionInvoiceId(lotId: string, accountId: string) {
  return `INV-${lotId.slice(-5)}-${accountId.replace(/[^A-Z0-9]/gi, '').slice(-4)}`.toUpperCase()
}

export function settleClosedAuctions(
  lots: Lot[],
  bids: Bid[],
  invoices: Invoice[],
  notices: Notice[],
  nowTs: number,
): { invoices: Invoice[]; notices: Notice[] } {
  const extraInv: Invoice[] = []
  const extraNotes: Notice[] = []

  for (const lot of lots) {
    if (lot.channel !== 'auction' || lot.endsAt > nowTs) continue
    const slices = allocate(lot, bids)
    for (const slice of slices) {
      if (!slice.qty || isBot(slice.accountId)) continue
      const id = auctionInvoiceId(lot.id, slice.accountId)
      const exists =
        invoices.some((inv) => inv.id === id || (inv.lotId === lot.id && inv.accountId === slice.accountId)) ||
        extraInv.some((inv) => inv.id === id || (inv.lotId === lot.id && inv.accountId === slice.accountId))
      if (exists) continue
      const inv: Invoice = {
        id,
        lotId: lot.id,
        channel: 'auction',
        qty: slice.qty,
        unitPrice: slice.unitPrice,
        amount: slice.unitPrice * slice.qty,
        status: 'unpaid',
        createdAt: nowTs,
        accountId: slice.accountId,
        opened: false,
        auctionLabel: `JPN SIM Unlocked ${lot.model} (${lot.id})`,
      }
      extraInv.push(inv)
      extraNotes.push({
        id: `N-${id}`,
        accountId: slice.accountId,
        kind: 'win',
        title: 'You won an auction',
        body: `${lot.manufacturer} ${lot.model} · ${slice.qty} pcs · ${moneyPlain(inv.amount)} USD invoice ${inv.id}`,
        href: '/account/invoices',
        at: nowTs,
        read: false,
      })
    }
  }

  if (!extraInv.length) return { invoices, notices }
  return {
    invoices: [...extraInv, ...invoices],
    notices: [...extraNotes, ...notices],
  }
}

export function buyerCareNotices(
  lots: Lot[],
  bids: Bid[],
  watchlist: string[],
  accountId: string | undefined,
  notices: Notice[],
  nowTs: number,
  endingSoonMinutes: number,
  settings?: SiteSettings,
): Notice[] {
  if (!accountId) return notices
  const extra: Notice[] = []
  const seen = (id: string) => notices.some((n) => n.id === id) || extra.some((n) => n.id === id)

  for (const lot of lots) {
    if (lot.channel !== 'auction' || lot.endsAt <= nowTs) continue
    if (watchlist.includes(lot.id) && isEndingSoon(lot.endsAt, nowTs, endingSoonMinutes)) {
      const id = `N-CLOSE-${lot.id}-${accountId}`
      if (!seen(id)) {
        extra.push({
          id,
          accountId,
          kind: 'closing',
          title: 'Watchlist lot closing soon',
          body: `${lot.manufacturer} ${lot.model} · ${lot.id}`,
          href: `/auctions#${lot.auctionType || 'live'}`,
          at: nowTs,
          read: false,
        })
      }
    }
    const stats = fillStats(lot, bids, accountId)
    const hasBid = bids.some((b) => b.lotId === lot.id && b.accountId === accountId)
    if (hasBid && stats.myPcs === 0 && !isSealedLot(lot, settings)) {
      const id = `N-FILL-${lot.id}-${accountId}`
      if (!seen(id)) {
        extra.push({
          id,
          accountId,
          kind: 'fill',
          title: 'You are out of fill',
          body: `${lot.manufacturer} ${lot.model} — raise price or qty to get units`,
          href: `/auctions#${lot.auctionType || 'live'}`,
          at: nowTs,
          read: false,
        })
      }
    }
  }

  if (!extra.length) return notices
  return [...extra, ...notices]
}
