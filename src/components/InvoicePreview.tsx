import { ModalShell } from './ModalShell'
import { invoiceDocHtml, invoicePreviewParts, openInvoiceDocument } from '../lib/invoiceDoc'
import { useStore } from '../store'
import type { Invoice } from '../types'

export function InvoicePreview({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { lots, accounts, settings } = useStore()
  const buyer = accounts.find((a) => a.accountId === invoice.accountId)
  const html = invoiceDocHtml(invoice, lots, buyer, settings)
  const parts = invoicePreviewParts(html)

  return (
    <ModalShell onClose={onClose}>
      <div className="modal invoice-preview-modal" onClick={(e) => e.stopPropagation()}>
        <header className="invoice-preview-bar">
          <div className="invoice-preview-bar-id">
            <span className="muted tiny">Invoice</span>
            <strong className="mono">{invoice.id}</strong>
          </div>
          <div className="invoice-preview-bar-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => openInvoiceDocument(invoice, lots, buyer, settings, true)}
            >
              Print / PDF
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => openInvoiceDocument(invoice, lots, buyer, settings)}
            >
              Open
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </header>
        <div className="invoice-preview-stage">
          <div className="invoice-preview-page">
            <style>{parts.style}</style>
            <div dangerouslySetInnerHTML={{ __html: parts.body }} />
          </div>
        </div>
      </div>
    </ModalShell>
  )
}
