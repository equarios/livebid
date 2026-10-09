import { usd } from '../lib/format'
import { feePctForLot, quoteMoney } from '../lib/invoices'
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
  priceLabel = 'Your Price',
  onCancel,
  onConfirm,
}: Props) {
  const { settings } = useStore()
  const copy = settings.copy
  const feePct = feePctForLot(lot, settings)
  const quote = quoteMoney(qty, unitPrice, feePct)

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
          <dt>Quantity</dt>
          <dd>{qty} pcs</dd>
        </div>
        <div>
          <dt>{priceLabel}</dt>
          <dd>{usd(unitPrice)}</dd>
        </div>
        <div>
          <dt>Goods</dt>
          <dd className="price-cell">{usd(quote.goods)}</dd>
        </div>
        {quote.feePct > 0 ? (
          <div>
            <dt>Fee {quote.feePct}%</dt>
            <dd className="price-cell">{usd(quote.fee)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Est. total</dt>
          <dd className="price-cell">{usd(quote.total)}</dd>
        </div>
      </dl>
    </ConfirmDialog>
  )
}
