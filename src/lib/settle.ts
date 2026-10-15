import { allocate, fillStats } from './allocate'
import { isEndingSoon, moneyPlain } from './format'
import { effectiveEndsAt, isInExtraSealed, isSealedLot } from './auctionLists'
import { buildInvoice, invoiceCoversLot } from './invoices'
import type { Bid, Invoice, InvoiceLine, Lot, Notice, SiteSettings } from '../types'

function isBot(accountId: string) {
  return accountId.startsWith('BOT-')
}

export function auctionInvoiceId(lotId: string, accountId: string) {
  return `INV-${lotId.slice(-5)}-${accountId.replace(/[^A-Z0-9]/gi, '').slice(-4)}`.toUpperCase()
}

function kdpInvoiceId(nowTs: number, accountId: string, slug: string) {
  const d = new Date(nowTs)
  const yy = String(d.getFullYear()).slice(-2)
  const start = Date.UTC(d.getFullYear(), 0, 0)
  const doy = String(Math.floor((nowTs - start) / 86400000)).padStart(3, '0')
  const tail = accountId.replace(/[^A-Z0-9]/gi, '').slice(-3).padStart(3, '0')
  const list = slug.replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase() || 'KDP'
  return `${list}-${yy}-${doy}-${tail}`
}

export function settleClosedAuctions(
  lots: Lot[],
  bids: Bid[],
  invoices: Invoice[],
  notices: Notice[],
  nowTs: number,
  staff: Array<{ accountId: string; role: string }> = [],
  settings?: SiteSettings,
): { invoices: Invoice[]; notices: Notice[] } {
  const extraInv: Invoice[] = []
  const extraNotes: Notice[] = []
  const groups = new Map<
    string,
    { accountId: string; slug: string; lines: InvoiceLine[]; models: string[] }
  >()

  for (const lot of lots) {
    if (lot.channel !== 'auction' || effectiveEndsAt(lot) > nowTs) continue
    const slices = allocate(lot, bids)
    for (const slice of slices) {
      if (!slice.qty || isBot(slice.accountId)) continue
      const already =
        invoices.some((inv) => invoiceCoversLot(inv, lot.id, slice.accountId)) ||
        extraInv.some((inv) => invoiceCoversLot(inv, lot.id, slice.accountId))
      if (already) continue
      const slug = lot.auctionType || 'live'
      const key = `${slice.accountId}::${slug}`
      const row = groups.get(key) || { accountId: slice.accountId, slug, lines: [], models: [] }
      row.lines.push({ lotId: lot.id, qty: slice.qty, unitPrice: slice.unitPrice })
      row.models.push(lot.model)
      groups.set(key, row)
    }
  }

  for (const group of groups.values()) {
    const id = kdpInvoiceId(nowTs, group.accountId, group.slug)
    const uniqueId = extraInv.some((inv) => inv.id === id) || invoices.some((inv) => inv.id === id)
      ? `${id}-${group.lines[0].lotId.slice(-3)}`
      : id
    const sampleLot = lots.find((l) => l.id === group.lines[0].lotId)
    const inv = buildInvoice(
      {
        id: uniqueId,
        lotId: group.lines[0].lotId,
        channel: 'auction',
        createdAt: nowTs,
        accountId: group.accountId,
        opened: false,
        auctionLabel: `JPN SIM Unlocked ${[...new Set(group.models)].slice(0, 3).join(' / ')} (${uniqueId})`,
        lines: group.lines,
      },
      settings,
      sampleLot ? [sampleLot] : lots,
    )
    extraInv.push(inv)
    const items = [...new Set(group.models)].slice(0, 4).join(', ')
    const more = group.models.length > 4 ? ` +${group.models.length - 4} more` : ''
    extraNotes.push({
      id: `N-${uniqueId}`,
      accountId: group.accountId,
      kind: 'win',
      title: 'You won an auction',
      body: `${inv.qty} pcs · ${moneyPlain(inv.amount)} USD · ${items}${more}. Invoice ${inv.id} — open for line details.`,
      href: '/account/invoices',
      at: nowTs,
      read: false,
    })
    for (const person of staff) {
      extraNotes.push({
        id: `N-ISSUE-${uniqueId}-${person.accountId}`,
        accountId: person.accountId,
        kind: 'invoice',
        title: 'Invoice waiting to be issued',
        body: `${inv.id} · ${inv.qty} pcs. Admin then Super must stamp it.`,
        href: person.role === 'superadmin' ? '/super' : '/admin',
        at: nowTs,
        read: false,
      })
    }
  }

  const THANKS_WINDOW_MS = 48 * 60 * 60 * 1000
  const thanksSeen = (id: string) =>
    notices.some((n) => n.id === id) || extraNotes.some((n) => n.id === id)
  for (const lot of lots) {
    if (lot.channel !== 'auction' || effectiveEndsAt(lot) > nowTs) continue
    if (effectiveEndsAt(lot) <= nowTs - THANKS_WINDOW_MS) continue
    const bidders = new Set(
      bids.filter((b) => b.lotId === lot.id && !isBot(b.accountId)).map((b) => b.accountId),
    )
    for (const accountId of bidders) {
      const id = `N-THANKS-${lot.id}-${accountId}`
      if (thanksSeen(id)) continue
      extraNotes.push({
        id,
        accountId,
        kind: 'thanks',
        title: 'Thanks for joining',
        body: `${lot.manufacturer} ${lot.model} has closed. Thanks for bidding — check wins and invoices in your account.`,
        href: '/account/bids',
        at: nowTs,
        read: false,
      })
    }
  }

  if (!extraInv.length && !extraNotes.length) return { invoices, notices }
  return {
    invoices: extraInv.length ? [...extraInv, ...invoices] : invoices,
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
    if (lot.channel !== 'auction' || effectiveEndsAt(lot) <= nowTs) continue
    const hasBid = bids.some((b) => b.lotId === lot.id && b.accountId === accountId)
    const overtime = isInExtraSealed(lot, nowTs)
    const href = `/auctions#${lot.auctionType || 'live'}`
    const label = `${lot.manufacturer} ${lot.model}`

    if (overtime && hasBid) {
      const startId = `N-SEALED-START-${lot.id}-${accountId}`
      if (!seen(startId)) {
        const left = Math.max(1, Math.round((effectiveEndsAt(lot) - nowTs) / 60_000))
        extra.push({
          id: startId,
          accountId,
          kind: 'closing',
          title: 'Sealed started',
          body: `${label} · ${left}m left · prior bidders only`,
          href,
          at: nowTs,
          read: false,
        })
      }
    }

    if (
      overtime &&
      hasBid &&
      isEndingSoon(effectiveEndsAt(lot), nowTs, endingSoonMinutes)
    ) {
      const id = `N-SEALED-CLOSE-${lot.id}-${accountId}`
      if (!seen(id)) {
        extra.push({
          id,
          accountId,
          kind: 'closing',
          title: 'Sealed closing soon',
          body: `${label} · ${lot.id}`,
          href,
          at: nowTs,
          read: false,
        })
      }
    } else if (
      !overtime &&
      watchlist.includes(lot.id) &&
      isEndingSoon(lot.endsAt, nowTs, endingSoonMinutes)
    ) {
      const id = `N-CLOSE-${lot.id}-${accountId}`
      if (!seen(id)) {
        extra.push({
          id,
          accountId,
          kind: 'closing',
          title: 'Watchlist lot closing soon',
          body: `${label} · ${lot.id}`,
          href,
          at: nowTs,
          read: false,
        })
      }
    }

    const stats = fillStats(lot, bids, accountId)
    if (hasBid && stats.myPcs === 0 && !isSealedLot(lot, settings, nowTs)) {
      const id = `N-FILL-${lot.id}-${accountId}`
      if (!seen(id)) {
        extra.push({
          id,
          accountId,
          kind: 'fill',
          title: 'You are out of fill',
          body: `${label} — raise price or qty to get units`,
          href,
          at: nowTs,
          read: false,
        })
      }
    }
  }

  if (!extra.length) return notices
  return [...extra, ...notices]
}
