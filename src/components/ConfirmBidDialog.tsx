import { usd } from '../lib/format'
import type { Lot } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { useStore } from '../store'

type Props = {
  lot: Lot
  qty: number
  unitPrice: number
  title?: string
  body?: string
  priceLabel?: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmBidDialog({
  lot,
  qty,
  unitPrice,
  title,
  body,
  priceLabel = 'Your price / pc',
  onCancel,
  onConfirm,
}: Props) {
  const { settings } = useStore()
  const copy = settings.copy
  const total = qty * unitPrice

  return (
    <ConfirmDialog
      title={title || copy.confirmBidTitle}
      body={body || copy.confirmBidBody}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <dl className="confirm-summary">
        <div>
          <dt>Lot</dt>
          <dd>
            {lot.id} · {lot.manufacturer} {lot.model}
            {lot.modelNumber ? ` (${lot.modelNumber})` : ''}
          </dd>
        </div>
        <div>
          <dt>Desired qty</dt>
          <dd>{qty} pcs</dd>
        </div>
        <div>
          <dt>{priceLabel}</dt>
          <dd>{usd(unitPrice)}</dd>
        </div>
        <div>
          <dt>Order total</dt>
          <dd className="price-cell">{usd(total)}</dd>
        </div>
      </dl>
    </ConfirmDialog>
  )
}
