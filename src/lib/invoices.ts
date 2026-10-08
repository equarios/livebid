import type { Channel, Invoice, InvoiceStatus, Lot } from '../types'

export function invoiceChannel(inv: Invoice, lots: Lot[]): Channel {
  if (inv.channel) return inv.channel
  return lots.find((l) => l.id === inv.lotId)?.channel ?? 'marketplace'
}

export function moneyForChannel(invoices: Invoice[], lots: Lot[], channel: Channel) {
  const rows = invoices.filter((inv) => invoiceChannel(inv, lots) === channel)
  const paid = rows.filter((inv) => inv.status === 'paid').reduce((s, inv) => s + inv.amount, 0)
  const unpaid = rows.filter((inv) => inv.status !== 'paid').reduce((s, inv) => s + inv.amount, 0)
  return {
    paid,
    unpaid,
    total: paid + unpaid,
    paidCount: rows.filter((inv) => inv.status === 'paid').length,
    unpaidCount: rows.filter((inv) => inv.status !== 'paid').length,
  }
}

export function moneyForLot(invoices: Invoice[], lotId: string) {
  const rows = invoices.filter((inv) => inv.lotId === lotId)
  const paid = rows.filter((inv) => inv.status === 'paid').reduce((s, inv) => s + inv.amount, 0)
  const unpaid = rows.filter((inv) => inv.status !== 'paid').reduce((s, inv) => s + inv.amount, 0)
  return { paid, unpaid, total: paid + unpaid }
}

export function invoiceStatusLabel(status: InvoiceStatus) {
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
  const keys = [
    { key: 'issued', label: 'Issued', done: true },
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

export function invoicePill(status: InvoiceStatus) {
  if (status === 'paid') return 'pill-live'
  if (status === 'pending_review') return 'pill-hybrid'
  if (status === 'declined') return 'pill-sealed'
  return 'pill-sealed'
}

const PAY_WINDOW_MS = 48 * 60 * 60 * 1000

export function invoiceDueAt(inv: Invoice) {
  return inv.createdAt + PAY_WINDOW_MS
}

export function invoiceDueLabel(inv: Invoice, now = Date.now()) {
  if (inv.status === 'paid' || inv.shippedAt) return null
  const left = invoiceDueAt(inv) - now
  if (left <= 0) return 'Past due'
  const h = Math.floor(left / 3600000)
  const m = Math.floor((left % 3600000) / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h to pay`
  if (h >= 1) return `${h}h ${m}m to pay`
  return `${m}m to pay`
}

export function printInvoice(inv: Invoice, lot: Lot | undefined, company: string) {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900')
  if (!win) return
  const model = lot ? `${lot.manufacturer} ${lot.model} ${lot.capacity}` : inv.lotId
  win.document.write(`<!doctype html><html><head><title>${inv.id}</title>
<style>
  body{font-family:Segoe UI,system-ui,sans-serif;padding:32px;color:#1a1a1a}
  h1{font-size:22px;margin:0 0 8px}
  table{border-collapse:collapse;width:100%;margin-top:20px}
  th,td{border:1px solid #ddd;padding:8px 10px;text-align:left}
  .muted{color:#5b6570}
  .total{font-size:18px;font-weight:800}
</style></head><body>
  <h1>Equarios invoice ${inv.id}</h1>
  <p class="muted">${company}</p>
  <p>${auctionNumber(inv, lot)}</p>
  <table>
    <tr><th>Model</th><td>${model}</td></tr>
    <tr><th>Qty</th><td>${inv.qty}</td></tr>
    <tr><th>Price / pc</th><td>${inv.unitPrice.toFixed(2)} USD</td></tr>
    <tr><th>Total</th><td class="total">${inv.amount.toFixed(2)} USD</td></tr>
    <tr><th>Status</th><td>${clientInvoiceLabel(inv)}</td></tr>
  </table>
  <p class="muted">Pay within 48 hours of invoice date. Upload a receipt in My Page → Invoice.</p>
</body></html>`)
  win.document.close()
  win.focus()
  win.print()
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
