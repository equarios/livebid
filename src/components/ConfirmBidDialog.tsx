import { usd } from '../lib/format'
import type { Lot } from '../types'

type Props = {
  lot: Lot
  qty: number
  unitPrice: number
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmBidDialog({ lot, qty, unitPrice, onCancel, onConfirm }: Props) {
  const total = qty * unitPrice

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal card"
        role="dialog"
        aria-labelledby="confirm-bid-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-bid-title">Confirm this bid?</h2>
        <p className="muted">Check qty and price, then confirm.</p>
        <dl className="confirm-summary">
          <div>
            <dt>Lot</dt>
            <dd>
              {lot.id} · {lot.manufacturer} {lot.model}
            </dd>
          </div>
          <div>
            <dt>Desired qty</dt>
            <dd>{qty} pcs</dd>
          </div>
          <div>
            <dt>Your price / pc</dt>
            <dd>{usd(unitPrice)}</dd>
          </div>
          <div>
            <dt>Order total</dt>
            <dd className="price-cell">{usd(total)}</dd>
          </div>
        </dl>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
