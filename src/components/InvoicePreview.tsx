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
        <h2>Invoice {invoice.id}</h2>
        <p className="muted tiny">
          Commercial invoice on Equarios letterhead. Issued after Admin and Super confirmation.
        </p>
        <div className="invoice-preview-frame">
          <style>{parts.style}</style>
          <div dangerouslySetInnerHTML={{ __html: parts.body }} />
        </div>
        <div className="row-actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openInvoiceDocument(invoice, lots, buyer, settings, true)}
          >
            Print / PDF
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => openInvoiceDocument(invoice, lots, buyer, settings)}
          >
            Open document
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
