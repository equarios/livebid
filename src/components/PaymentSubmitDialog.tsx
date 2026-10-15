import { useMemo, useState } from 'react'
import { ModalShell } from './ModalShell'
import { usd } from '../lib/format'
import { invoiceTotals } from '../lib/invoices'
import {
  CASH_RECEIPT_MARKER,
  WHOLESALE_PAY_LABEL,
  defaultPayMethod,
  payMethodHint,
  payMethodsForInvoice,
} from '../lib/wholesalePay'
import { useStore } from '../store'
import type { Invoice, WholesalePayMethod } from '../types'

const MAX_BYTES = 3 * 1024 * 1024

type Props = {
  invoice: Invoice
  onClose: () => void
  onDone: (msg: string) => void
}

export function PaymentSubmitDialog({ invoice, onClose, onDone }: Props) {
  const { lots, submitPayment, settings } = useStore()
  const copy = settings.copy
  const profile = settings.invoice
  const lot = lots.find((l) => l.id === invoice.lotId)
  const methods = useMemo(() => payMethodsForInvoice(invoice), [invoice])
  const [method, setMethod] = useState<WholesalePayMethod>(() => defaultPayMethod(invoice))
  const [payRef, setPayRef] = useState(invoice.payRef || '')
  const [acked, setAcked] = useState(false)
  const [file, setFile] = useState<{ name: string; data: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const totals = invoiceTotals(invoice, settings)
  const shipTbd =
    invoice.fulfillmentMode === 'delivery' && invoice.shippingFeeQuoted === false
  const shipQuoted =
    invoice.fulfillmentMode === 'delivery' &&
    invoice.shippingFeeQuoted !== false &&
    (invoice.shippingFee || 0) > 0
  const shipAddendumId = invoice.shippingAddendumId
  const isShipAddendum = Boolean(invoice.shippingAddendum)
  const hint = payMethodHint(method, invoice, profile)
  const needsReceipt = method === 'bank' || method === 'usdt'

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

  async function submit() {
    if (!acked) {
      setError(copy.warnPayAck)
      return
    }
    if (method === 'usdt' && !payRef.trim() && !file) {
      setError('Paste the USDT TX hash or upload a TX screenshot.')
      return
    }
    if (needsReceipt && method === 'bank' && !file) {
      setError(copy.warnReceipt)
      return
    }
    const receiptName =
      method === 'cash'
        ? 'Cash on collect'
        : file?.name || (payRef.trim() ? `ref-${payRef.trim().slice(0, 24)}` : 'payment-proof')
    const receiptData =
      method === 'cash'
        ? CASH_RECEIPT_MARKER
        : file?.data || `text:pay-ref:${payRef.trim()}`
    const err = await submitPayment(invoice.id, receiptName, receiptData, {
      payMethod: method,
      payRef: payRef.trim() || undefined,
    })
    if (err) {
      setError(err)
      return
    }
    onDone(
      method === 'cash'
        ? 'Cash on collect recorded — staff will confirm when you pick up.'
        : shipTbd
          ? 'Goods payment submitted. Shipping will be invoiced after staff quote.'
          : copy.okPaySubmitted,
    )
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="modal card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{copy.confirmPayTitle}</h2>
        <p className="muted">{copy.confirmPayBody}</p>
        {shipTbd ? (
          <p className="tiny ok" role="status">
            Pay goods now · shipping TBD — staff will quote delivery separately. This receipt covers
            goods (+ fee) only.
          </p>
        ) : null}
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
            <dt>Goods</dt>
            <dd>{usd(totals.goods)}</dd>
          </div>
          {totals.fee > 0 ? (
            <div>
              <dt>Fee ({totals.feePct}%)</dt>
              <dd>{usd(totals.fee)}</dd>
            </div>
          ) : null}
          {isShipAddendum ? null : (
            <div>
              <dt>Shipping</dt>
              <dd>
                {shipTbd
                  ? 'TBD (quoted later)'
                  : shipAddendumId
                    ? `See ${shipAddendumId}`
                    : shipQuoted
                      ? usd(invoice.shippingFee || 0)
                      : invoice.fulfillmentMode === 'pickup'
                        ? 'Pickup'
                        : invoice.fulfillmentMode === 'buyer_courier'
                          ? 'Your courier'
                          : usd(invoice.shippingFee || 0)}
              </dd>
            </div>
          )}
          <div>
            <dt>Pay now</dt>
            <dd>
              <strong>{usd(totals.total)}</strong>
              {shipTbd || shipAddendumId ? (
                <span className="muted tiny"> (goods only)</span>
              ) : isShipAddendum ? (
                <span className="muted tiny"> (freight)</span>
              ) : null}
            </dd>
          </div>
        </dl>

        <fieldset className="wholesale-pay-methods">
          <legend>Payment method</legend>
          <div className="retail-pay-options" role="radiogroup" aria-label="Payment method">
            {methods.map((id) => (
              <label key={id} className={method === id ? 'on' : undefined}>
                <input
                  type="radio"
                  name="wholesale-pay"
                  checked={method === id}
                  onChange={() => {
                    setMethod(id)
                    setError(null)
                  }}
                />
                <span className="retail-pay-label">
                  <strong>{WHOLESALE_PAY_LABEL[id]}</strong>
                  <em>
                    {id === 'bank'
                      ? 'SWIFT remittance'
                      : id === 'usdt'
                        ? 'Crypto transfer'
                        : 'Pay on collect'}
                  </em>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <pre className="wholesale-pay-hint">{hint}</pre>

        {method === 'usdt' || method === 'bank' ? (
          <label className="field">
            <span>{method === 'usdt' ? 'TX hash / reference (optional if you upload a file)' : 'Remittance reference (optional)'}</span>
            <input
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder={method === 'usdt' ? '0x… or Tron TX id' : 'Bank reference'}
            />
          </label>
        ) : null}

        <label className="ack">
          <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} />
          <span>
            {method === 'cash'
              ? 'I will pay cash when collecting this invoice.'
              : shipTbd
                ? 'I confirm this receipt is for goods (+ fee). Shipping will be arranged after quote.'
                : copy.payAckLabel}
          </span>
        </label>

        {needsReceipt ? (
          <label>
            {method === 'usdt' ? 'TX screenshot / PDF (or paste hash above)' : copy.receiptLabel}
            <input
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={(e) => onFile(e.target.files)}
            />
          </label>
        ) : (
          <p className="muted tiny">No receipt upload needed for cash — staff confirms at pickup.</p>
        )}
        {file ? <p className="muted tiny">{file.name}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {copy.btnCancel}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()}>
            {method === 'cash'
              ? `Confirm cash · ${usd(totals.total)}`
              : shipTbd
                ? `Pay goods · ${usd(totals.total)}`
                : copy.btnConfirm}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
