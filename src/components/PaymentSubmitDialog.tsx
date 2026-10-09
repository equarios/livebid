import { useState } from 'react'
import { ModalShell } from './ModalShell'
import { usd } from '../lib/format'
import { invoiceTotals } from '../lib/invoices'
import { useStore } from '../store'
import type { Invoice } from '../types'

const MAX_BYTES = 3 * 1024 * 1024

type Props = {
  invoice: Invoice
  onClose: () => void
  onDone: (msg: string) => void
}

export function PaymentSubmitDialog({ invoice, onClose, onDone }: Props) {
  const { lots, submitPayment, settings } = useStore()
  const copy = settings.copy
  const lot = lots.find((l) => l.id === invoice.lotId)
  const [acked, setAcked] = useState(false)
  const [file, setFile] = useState<{ name: string; data: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function onFile(list: FileList | null) {
    const picked = list?.[0]
    if (!picked) {
      setFile(null)
      return
    }
    if (picked.size > MAX_BYTES) {
      setFile(null)
      setError(copy.warnReceipt)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setError(null)
      setFile({ name: picked.name, data: String(reader.result || '') })
    }
    reader.readAsDataURL(picked)
  }

  function submit() {
    if (!acked) {
      setError(copy.warnPayAck)
      return
    }
    if (!file) {
      setError(copy.warnReceipt)
      return
    }
    const err = submitPayment(invoice.id, file.name, file.data)
    if (err) {
      setError(err)
      return
    }
    onDone(copy.okPaySubmitted)
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="modal card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{copy.confirmPayTitle}</h2>
        <p className="muted">{copy.confirmPayBody}</p>
        <dl className="confirm-summary">
          <div>
            <dt>Invoice</dt>
            <dd>{invoice.id}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>
              {lot
                ? `${lot.manufacturer} ${lot.model}${lot.modelNumber ? ` ${lot.modelNumber}` : ''} ${lot.capacity}`
                : invoice.lotId}
            </dd>
          </div>
          <div>
            <dt>Qty</dt>
            <dd>{invoice.qty.toLocaleString()} pcs</dd>
          </div>
          <div>
            <dt>Current Price</dt>
            <dd>{usd(invoice.unitPrice)}</dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd>{usd(invoiceTotals(invoice, settings).total)}</dd>
          </div>
        </dl>
        <label className="ack">
          <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} />
          <span>{copy.payAckLabel}</span>
        </label>
        <label>
          {copy.receiptLabel}
          <input
            type="file"
            accept="image/*,.pdf,application/pdf"
            onChange={(e) => onFile(e.target.files)}
          />
        </label>
        {file ? <p className="muted tiny">{file.name}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {copy.btnCancel}
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            {copy.btnConfirm}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
