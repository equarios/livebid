import type { Account, Bid, Invoice, Lot, MarketOffer, CartOrder, CartItem, WatchItem, Notice, InventorySku } from '@prisma/client'
import { normalizeOrigin } from './origins'

function migrateAuctionType(value?: string | null) {
  if (value === 'sealed' || value === 'hybrid') return 'offline'
  return value || undefined
}

export function mapLot(lot: Lot) {
  return {
    id: lot.id,
    channel: lot.channel as 'auction' | 'marketplace',
    auctionType: migrateAuctionType(lot.auctionType),
    manufacturer: lot.manufacturer,
    model: lot.model,
    modelNumber: lot.modelNumber,
    capacity: lot.capacity,
    color: lot.color,
    grade: lot.grade,
    battery: lot.battery,
    qty: lot.qty,
    moq: lot.moq ?? undefined,
    startPrice: lot.startPrice,
    currentPrice: lot.currentPrice,
    buyNowPrice: lot.buyNowPrice ?? undefined,
    bidCount: lot.bidCount,
    endsAt: Number(lot.endsAt),
    extraSealedEndsAt:
      lot.extraSealedEndsAt != null && Number(lot.extraSealedEndsAt) > 0
        ? Number(lot.extraSealedEndsAt)
        : undefined,
    description: lot.description,
    accent: lot.accent,
    operator: lot.operator ?? undefined,
    simLocked: lot.simLocked ?? undefined,
    activationLocked: lot.activationLocked ?? undefined,
    origin: lot.origin != null && lot.origin !== '' ? normalizeOrigin(lot.origin) : undefined,
  }
}

export function mapAccount(a: Account) {
  return {
    accountId: a.accountId,
    company: a.company,
    email: a.email,
    firstName: a.firstName || undefined,
    lastName: a.lastName || undefined,
    address: a.address ?? undefined,
    phone: a.phone ?? undefined,
    buyerNumber: a.buyerNumber ?? undefined,
    role: a.role,
    status: a.status,
    emailVerified: a.emailVerified,
    wholesaleStatus: a.wholesaleStatus,
    // never send passwordHash to clients
  }
}

export function mapBid(b: Bid) {
  return {
    lotId: b.lotId,
    accountId: b.accountId,
    amount: b.amount,
    qty: b.qty,
    at: Number(b.at),
  }
}

export function mapCartItem(c: CartItem) {
  return { lotId: c.lotId, qty: c.qty }
}

export function mapCartOrder(o: CartOrder) {
  return {
    id: o.id,
    accountId: o.accountId,
    status: o.status,
    createdAt: Number(o.createdAt),
    reviewedAt: o.reviewedAt != null ? Number(o.reviewedAt) : undefined,
    reviewedBy: o.reviewedBy ?? undefined,
    lines: JSON.parse(o.linesJson) as Array<{ lotId: string; qty: number; unitPrice: number }>,
  }
}

export function mapOffer(o: MarketOffer) {
  return {
    id: o.id,
    lotId: o.lotId,
    accountId: o.accountId,
    qty: o.qty,
    unitPrice: o.unitPrice,
    listedPrice: o.listedPrice,
    status: o.status,
    createdAt: Number(o.createdAt),
    reviewedAt: o.reviewedAt != null ? Number(o.reviewedAt) : undefined,
    reviewedBy: o.reviewedBy ?? undefined,
  }
}

export function mapInvoice(inv: Invoice) {
  const extra = JSON.parse(inv.dataJson || '{}') as Record<string, unknown>
  return {
    id: inv.id,
    lotId: inv.lotId,
    channel: inv.channel,
    amount: inv.amount,
    qty: inv.qty,
    unitPrice: inv.unitPrice,
    status: inv.status,
    createdAt: Number(inv.createdAt),
    accountId: inv.accountId ?? undefined,
    ...extra,
    paidAt: inv.paidAt != null ? Number(inv.paidAt) : undefined,
  }
}

export function mapWatch(w: WatchItem) {
  return w.lotId
}

export function mapNotice(n: Notice) {
  return {
    id: n.id,
    accountId: n.accountId,
    kind: n.kind,
    title: n.title,
    body: n.body,
    href: n.href,
    at: Number(n.at),
    read: n.read,
  }
}

export function mapSku(s: InventorySku) {
  return {
    id: s.id,
    manufacturer: s.manufacturer,
    model: s.model,
    modelNumber: s.modelNumber,
    capacity: s.capacity,
    color: s.color,
    grade: s.grade,
    battery: s.battery,
    origin: normalizeOrigin(s.origin),
    operator: s.operator ?? undefined,
    simLocked: s.simLocked ?? undefined,
    activationLocked: s.activationLocked ?? undefined,
    description: s.description,
    defaultMoq: s.defaultMoq ?? undefined,
    lastPrice: s.lastPrice ?? undefined,
    onHand: 'onHand' in s && typeof (s as { onHand?: number }).onHand === 'number' ? (s as { onHand: number }).onHand : 0,
  }
}
