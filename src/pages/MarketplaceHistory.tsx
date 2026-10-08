import { useState } from 'react'
import { InvoicePreview } from '../components/InvoicePreview'
import { ItemLink } from '../components/ItemLink'
import { downloadCsv } from '../lib/csv'
import { invoicePill, invoiceStatusLabel, invoiceTotals, invoiceVisibleToBuyer } from '../lib/invoices'
import { formatDateTime, usdAmt } from '../lib/format'
import { OfferDesk } from '../components/OfferDesk'
import { useStore } from '../store'

export function MarketplaceHistory() {
  const { invoices, lots, user, isStaff, settings } = useStore()
  const [previewId, setPreviewId] = useState<string | null>(null)
  const rows = invoices.filter((inv) => {
    if (inv.channel !== 'marketplace') return false
    if (!isStaff && !invoiceVisibleToBuyer(inv)) return false
    if (isStaff) return true
    return !inv.accountId || inv.accountId === user?.accountId
  })

  function exportCsv() {
    downloadCsv(
      'marketplace-history.csv',
      ['Date', 'Invoice', 'Item', 'Qty', 'Unit', 'Total', 'Status'],
      rows.map((inv) => {
        const lot = lots.find((l) => l.id === inv.lotId)
        return [
          formatDateTime(inv.createdAt),
          inv.id,
          lot ? `${lot.manufacturer} ${lot.model}` : inv.lotId,
          inv.qty,
          inv.unitPrice,
          invoiceTotals(inv, settings).total,
          invoiceStatusLabel(inv.status),
        ]
      }),
    )
  }

  return (
    <div>
      <h2>Offers</h2>
      <OfferDesk staff={isStaff} />
      <h2>Orders</h2>
      <p>
        <button type="button" className="btn gbs-csv" onClick={exportCsv}>
          Export CSV
        </button>
      </p>
    <div className="table-wrap gbs-table-wrap">
      <table className="gbs-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Invoice</th>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Total</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((inv) => {
            const lot = lots.find((l) => l.id === inv.lotId)
            return (
              <tr key={inv.id}>
                <td className="mono">{formatDateTime(inv.createdAt)}</td>
                <td>{inv.id}</td>
                <td>{lot ? <ItemLink lot={lot} /> : inv.lotId}</td>
                <td>{inv.qty}</td>
                <td>{usdAmt(inv.unitPrice)}</td>
                <td>{usdAmt(invoiceTotals(inv, settings).total)}</td>
                <td>
                  <span className={`pill ${invoicePill(inv.status)}`}>{invoiceStatusLabel(inv.status)}</span>
                </td>
                <td>
                  {invoiceVisibleToBuyer(inv) ? (
                    <button type="button" className="linkish" onClick={() => setPreviewId(inv.id)}>
                      View invoice
                    </button>
                  ) : (
                    <span className="muted tiny">Awaiting issue</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!rows.length ? <p className="empty">No marketplace orders yet.</p> : null}
    </div>
    <div className="inv-cards">
      {rows.map((inv) => {
        const lot = lots.find((l) => l.id === inv.lotId)
        return (
          <article key={inv.id} className="inv-card">
            {lot ? <ItemLink lot={lot} /> : <strong>{inv.lotId}</strong>}
            <div className="muted tiny">{inv.id} · {formatDateTime(inv.createdAt)}</div>
            <div className="inv-card-meta">
              <span>{inv.qty} pcs</span>
              <span>{usdAmt(inv.unitPrice)} / pc</span>
              <span>{usdAmt(invoiceTotals(inv, settings).total)}</span>
            </div>
            <span className={`pill ${invoicePill(inv.status)}`}>{invoiceStatusLabel(inv.status)}</span>
            {invoiceVisibleToBuyer(inv) ? (
              <button type="button" className="linkish" onClick={() => setPreviewId(inv.id)}>
                View invoice
              </button>
            ) : null}
          </article>
        )
      })}
    </div>
      {previewId && invoices.some((i) => i.id === previewId) ? (
        <InvoicePreview invoice={invoices.find((i) => i.id === previewId)!} onClose={() => setPreviewId(null)} />
      ) : null}
    </div>
  )
}
