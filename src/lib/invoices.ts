import type { Channel, Invoice, InvoiceLine, InvoiceStatus, Lot, SiteSettings } from '../types'

export function invoiceChannel(inv: Invoice, lots: Lot[]): Channel {
  if (inv.channel) return inv.channel
  return lots.find((l) => l.id === inv.lotId)?.channel ?? 'marketplace'
}

export function invoiceVisibleToBuyer(inv: Invoice) {
  if (inv.status === 'draft') return false
  if (inv.status === 'declined' && !inv.issuedAt && !inv.receiptData) return false
  return true
}

export function roundMoney(n: number) {
  return Math.round(n * 100) / 100
}

export function invoiceRatePct(settings?: SiteSettings | null) {
  const n = settings?.invoice?.feePct
  return Number.isFinite(n) && (n as number) >= 0 ? (n as number) : 2
}

export function appliedFeePct(inv: Invoice) {
  const n = inv.feePct
  return Number.isFinite(n) && (n as number) > 0 ? (n as number) : 0
}

export function invoicePayDays(settings?: SiteSettings | null) {
  const n = settings?.invoice?.payDays
  return Number.isFinite(n) && (n as number) >= 1 ? Math.round(n as number) : 7
}

export function invoiceLines(inv: Invoice): InvoiceLine[] {
  if (inv.lines?.length) return inv.lines
  return [{ lotId: inv.lotId, qty: inv.qty, unitPrice: inv.unitPrice }]
}

export function invoiceCoversLot(inv: Invoice, lotId: string, accountId: string) {
  if (inv.accountId !== accountId) return false
  if (inv.lotId === lotId) return true
  return invoiceLines(inv).some((line) => line.lotId === lotId)
}

export function invoiceTotals(inv: Invoice, _settings?: SiteSettings | null) {
  const lines = invoiceLines(inv)
  const goods = roundMoney(lines.reduce((s, line) => s + line.unitPrice * line.qty, 0))
  const qty = lines.reduce((s, line) => s + line.qty, 0)
  const feePct = appliedFeePct(inv)
  const fee = feePct > 0 ? roundMoney(goods * (feePct / 100)) : 0
  return { goods, fee, feePct, qty, total: roundMoney(goods + fee) }
}

export function buildInvoice(
  partial: Omit<Invoice, 'amount' | 'qty' | 'unitPrice' | 'status'> & {
    lines: InvoiceLine[]
    status?: Invoice['status']
  },
  settings?: SiteSettings | null,
): Invoice {
  const lines = partial.lines
  const qty = lines.reduce((s, line) => s + line.qty, 0)
  const unitPrice = lines[0]?.unitPrice || 0
  const draft: Invoice = {
    ...partial,
    qty,
    unitPrice,
    amount: 0,
    status: partial.status || 'draft',
    lines,
  }
  return { ...draft, amount: invoiceTotals(draft, settings).total }
}

export function moneyForChannel(invoices: Invoice[], lots: Lot[], channel: Channel, settings?: SiteSettings | null) {
  const rows = invoices.filter((inv) => invoiceChannel(inv, lots) === channel && invoiceVisibleToBuyer(inv))
  const paid = rows.filter((inv) => inv.status === 'paid').reduce((s, inv) => s + invoiceTotals(inv, settings).total, 0)
  const unpaid = rows.filter((inv) => inv.status !== 'paid').reduce((s, inv) => s + invoiceTotals(inv, settings).total, 0)
  return {
    paid,
    unpaid,
    total: paid + unpaid,
    paidCount: rows.filter((inv) => inv.status === 'paid').length,
    unpaidCount: rows.filter((inv) => inv.status !== 'paid').length,
  }
}

export function moneyForLot(invoices: Invoice[], lotId: string, settings?: SiteSettings | null) {
  const rows = invoices.filter(
    (inv) => invoiceVisibleToBuyer(inv) && invoiceLines(inv).some((line) => line.lotId === lotId),
  )
  const paid = rows.filter((inv) => inv.status === 'paid').reduce((s, inv) => s + invoiceTotals(inv, settings).total, 0)
  const unpaid = rows
    .filter((inv) => inv.status !== 'paid')
    .reduce((s, inv) => s + invoiceTotals(inv, settings).total, 0)
  return { paid, unpaid, total: paid + unpaid }
}

export function invoiceStatusLabel(status: InvoiceStatus) {
  if (status === 'draft') return 'Awaiting issue'
  if (status === 'pending_review') return 'Pending approval'
  if (status === 'declined') return 'Declined'
  return status[0].toUpperCase() + status.slice(1)
}

export function clientInvoiceLabel(inv: Invoice) {
  if (inv.status === 'paid' || inv.shippedAt) return 'Shipped'
  return 'Awaiting Payment'
}

export type InvoiceStep = {
  key: string
  label: string
  done: boolean
  current: boolean
}

export function invoiceSteps(inv: Invoice): InvoiceStep[] {
  const submitted = Boolean(inv.receiptData)
  const declined = inv.status === 'declined'
  const paid = inv.status === 'paid'
  const shipped = Boolean(inv.shippedAt)
  const decided = paid || declined
  const issued = inv.status !== 'draft'
  const keys = [
    { key: 'issued', label: issued ? 'Issued' : 'Staff issue', done: issued },
    { key: 'paid', label: submitted || decided ? 'Payment sent' : 'Awaiting payment', done: submitted || decided },
    {
      key: 'review',
      label: declined ? 'Declined' : paid ? 'Approved' : 'Dual approval',
      done: decided,
    },
    { key: 'ship', label: 'Shipped', done: shipped },
  ]
  const currentIndex = keys.findIndex((s) => !s.done)
  return keys.map((s, i) => ({
    ...s,
    current: currentIndex === -1 ? i === keys.length - 1 : i === currentIndex,
  }))
}

export function auctionNumber(inv: Invoice, lot?: Lot) {
  if (inv.auctionLabel) return inv.auctionLabel
  if (!lot) return inv.lotId
  return `JPN SIM Unlocked ${lot.model} (${inv.id})`
}

export function buyerNumber(accountId: string, explicit?: string) {
  const manual = explicit?.trim()
  if (manual) return manual
  const digits = accountId.replace(/\D/g, '') || '0'
  return `9${digits.padStart(10, '0')}`.slice(0, 11)
}

/** Suggest HYB-26-286-039 style ids from Super prefix + existing invoices. */
export function suggestInvoiceId(invoices: Invoice[], settings?: SiteSettings | null) {
  const prefix = (settings?.invoice?.invoiceIdPrefix || 'HYB').trim().toUpperCase() || 'HYB'
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const start = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000)
  const dayPart = String(dayOfYear).padStart(3, '0')
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{2}-\\d{3}-(\\d+)$`, 'i')
  let maxSeq = 0
  for (const inv of invoices) {
    const m = inv.id.match(re)
    if (!m) continue
    const n = Number(m[1])
    if (Number.isFinite(n) && n > maxSeq) maxSeq = n
  }
  const seq = String(maxSeq + 1).padStart(3, '0')
  return `${prefix}-${yy}-${dayPart}-${seq}`
}

export function fillInvoiceTemplate(
  template: string,
  vars: { payDays?: number; feePct?: number },
) {
  return template
    .replace(/\{payDays\}/g, String(vars.payDays ?? ''))
    .replace(/\{feePct\}/g, String(vars.feePct ?? ''))
}

export function boxNoForLot(lotId: string, explicit?: string) {
  if (explicit?.trim()) return explicit.trim()
  if (!lotId || lotId === 'CUSTOM') return ''
  const n = lotId.replace(/\D/g, '').padStart(10, '0').slice(-10)
  return `BOX-${n}`
}

export function itemDescription(lot: Lot | undefined, lotId: string, override?: string) {
  if (override?.trim()) return override.trim()
  if (!lot) return lotId && lotId !== 'CUSTOM' ? lotId : 'Custom item'
  const sku = lot.modelNumber || lot.manufacturer
  return `${sku}_${lot.model} ${lot.capacity}`.replace(/\s+/g, ' ').trim()
}

export function normalizeInvoiceLines(lines: InvoiceLine[] | undefined, fallback?: InvoiceLine): InvoiceLine[] {
  const raw = lines?.length ? lines : fallback ? [fallback] : []
  return raw
    .map((line) => ({
      lotId: (line.lotId || 'CUSTOM').trim() || 'CUSTOM',
      qty: Math.max(1, Math.floor(Number(line.qty) || 0)),
      unitPrice: Math.max(0, Number(line.unitPrice) || 0),
      boxNo: line.boxNo?.trim() || undefined,
      description: line.description?.trim() || undefined,
      sim: line.sim?.trim() || undefined,
      grade: line.grade?.trim() || undefined,
    }))
    .filter((line) => line.qty >= 1)
}

export function invoicePill(status: InvoiceStatus) {
  if (status === 'paid') return 'pill-live'
  if (status === 'draft' || status === 'pending_review') return 'pill-hybrid'
  if (status === 'declined') return 'pill-sealed'
  return 'pill-sealed'
}

export function invoiceDueAt(inv: Invoice, settings?: SiteSettings | null) {
  return (inv.issuedAt || inv.createdAt) + invoicePayDays(settings) * 24 * 60 * 60 * 1000
}

export function invoiceDueLabel(inv: Invoice, now = Date.now(), settings?: SiteSettings | null) {
  if (inv.status === 'draft' || inv.status === 'paid' || inv.shippedAt) return null
  const left = invoiceDueAt(inv, settings) - now
  if (left <= 0) return 'Past due'
  const h = Math.floor(left / 3600000)
  const m = Math.floor((left % 3600000) / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h to pay`
  if (h >= 1) return `${h}h ${m}m to pay`
  return `${m}m to pay`
}

export function settleInvoiceIssue(inv: Invoice): Invoice {
  if (inv.issueAdmin?.decision === 'declined' || inv.issueSuper?.decision === 'declined') {
    return { ...inv, status: 'declined' }
  }
  if (inv.issueAdmin?.decision === 'accepted' && inv.issueSuper?.decision === 'accepted') {
    return { ...inv, status: 'unpaid', issuedAt: inv.issuedAt || Date.now() }
  }
  return { ...inv, status: 'draft', issuedAt: undefined }
}

export function settleInvoice(inv: Invoice): Invoice {
  if (inv.adminReview?.decision === 'declined' || inv.superReview?.decision === 'declined') {
    return { ...inv, status: 'declined' }
  }
  if (inv.adminReview?.decision === 'accepted' && inv.superReview?.decision === 'accepted') {
    return { ...inv, status: 'paid' }
  }
  if (inv.receiptData) return { ...inv, status: 'pending_review' }
  return { ...inv, status: 'unpaid' }
}
