/** Invoice status helpers — keep in sync with src/lib/invoices.ts settle* */

export type PayDecision = 'accepted' | 'declined'

export type PayReview = {
  decision: PayDecision
  by: string
  at: number
}

export type InvoiceLike = {
  status: string
  issuedAt?: number
  accountId?: string
  trackingNo?: string
  receiptName?: string
  receiptData?: string
  paidDeclaredAt?: number
  opened?: boolean
  issueAdmin?: PayReview
  issueSuper?: PayReview
  adminReview?: PayReview
  superReview?: PayReview
}

export function settleInvoiceIssue<T extends InvoiceLike>(inv: T): T {
  if (inv.issueAdmin?.decision === 'declined' || inv.issueSuper?.decision === 'declined') {
    return { ...inv, status: 'declined' }
  }
  if (inv.issueAdmin?.decision === 'accepted' && inv.issueSuper?.decision === 'accepted') {
    return { ...inv, status: 'unpaid', issuedAt: inv.issuedAt || Date.now() }
  }
  return { ...inv, status: 'draft', issuedAt: undefined }
}

export function settleInvoice<T extends InvoiceLike>(inv: T): T {
  if (inv.adminReview?.decision === 'declined' || inv.superReview?.decision === 'declined') {
    return { ...inv, status: 'declined' }
  }
  if (inv.adminReview?.decision === 'accepted' && inv.superReview?.decision === 'accepted') {
    return { ...inv, status: 'paid' }
  }
  if (inv.receiptData) return { ...inv, status: 'pending_review' }
  return { ...inv, status: 'unpaid' }
}

const CORE_KEYS = new Set([
  'id',
  'lotId',
  'channel',
  'amount',
  'qty',
  'unitPrice',
  'status',
  'createdAt',
  'accountId',
])

export function splitInvoiceRow(inv: Record<string, unknown>) {
  const id = String(inv.id || '').trim().toUpperCase()
  const extra: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(inv)) {
    if (CORE_KEYS.has(k) || v === undefined) continue
    extra[k] = v
  }
  return {
    id,
    lotId: String(inv.lotId || ''),
    channel: String(inv.channel || 'marketplace'),
    amount: Number(inv.amount) || 0,
    qty: Math.max(0, Math.round(Number(inv.qty) || 0)),
    unitPrice: Number(inv.unitPrice) || 0,
    status: String(inv.status || 'draft'),
    createdAt: BigInt(Number(inv.createdAt) || Date.now()),
    accountId: inv.accountId ? String(inv.accountId).trim().toUpperCase() : null,
    dataJson: JSON.stringify(extra),
  }
}

/** Prisma update payload — never includes primary key. */
export function invoiceUpdateData(inv: Record<string, unknown>) {
  const row = splitInvoiceRow(inv)
  return {
    lotId: row.lotId,
    channel: row.channel,
    amount: row.amount,
    qty: row.qty,
    unitPrice: row.unitPrice,
    status: row.status,
    accountId: row.accountId,
    dataJson: row.dataJson,
  }
}
