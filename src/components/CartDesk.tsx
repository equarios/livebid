import { useState } from 'react'
import { ItemLink } from './ItemLink'
import { ConfirmDialog } from './ConfirmDialog'
import { formatDateTime, usd } from '../lib/format'
import { catalogFeePct, quoteMoney } from '../lib/invoices'
import { useStore } from '../store'
import type { CartOrder, SiteSettings } from '../types'

function statusLabel(status: CartOrder['status']) {
  if (status === 'pending') return 'Pending review'
  if (status === 'accepted') return 'Accepted — confirm'
  if (status === 'confirmed') return 'Invoiced'
  if (status === 'declined') return 'Declined'
  return 'Cancelled'
}

function orderGoods(order: CartOrder) {
  return order.lines.reduce((n, line) => n + line.qty * line.unitPrice, 0)
}

function orderQuote(order: CartOrder, settings: SiteSettings) {
  return quoteMoney(1, orderGoods(order), catalogFeePct('marketplace', undefined, settings))
}

function orderPcs(order: CartOrder) {
  return order.lines.reduce((n, line) => n + line.qty, 0)
}

export function CartDesk({ staff }: { staff?: boolean }) {
  const {
    cartOrders,
    lots,
    accounts,
    user,
    settings,
    reviewCartOrder,
    confirmCartOrder,
    cancelCartOrder,
  } = useStore()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const rows = (cartOrders || [])
    .filter((o) => (staff ? true : o.accountId === user?.accountId))
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)

  if (!rows.length) {
    return (
      <p className="muted">
        {staff
          ? 'No cart checkouts yet.'
          : 'No cart checkouts yet. Add items on Marketplace, then send for admin review.'}
      </p>
    )
  }

  const confirming = rows.find((o) => o.id === confirmId) || null
  const confirmingQuote = confirming ? orderQuote(confirming, settings) : null

  return (
    <>
      <div className="table-wrap offer-table-wrap">
        <table className="auction-table">
          <thead>
            <tr>
              <th>When</th>
              {staff ? <th>Buyer</th> : null}
              <th>Items</th>
              <th>Quantity</th>
              <th>Total</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => {
              const buyer = accounts.find((a) => a.accountId === order.accountId)
              const first = lots.find((l) => l.id === order.lines[0]?.lotId)
              const quote = orderQuote(order, settings)
              return (
                <tr key={order.id}>
                  <td className="mono">{formatDateTime(order.createdAt)}</td>
                  {staff ? <td>{buyer?.company || order.accountId}</td> : null}
                  <td className="item-col">
                    {first ? (
                      <ItemLink lot={first} showMoq={false} showGrade={false} showLotId />
                    ) : (
                      order.lines[0]?.lotId || '—'
                    )}
                    {order.lines.length > 1 ? (
                      <div className="muted tiny">+{order.lines.length - 1} more line(s)</div>
                    ) : null}
                  </td>
                  <td className="lot-qty">{orderPcs(order).toLocaleString()}</td>
                  <td className="price-cell">
                    {usd(quote.total)}
                    {quote.feePct > 0 ? (
                      <div className="muted tiny">incl. {quote.feePct}% fee</div>
                    ) : null}
                  </td>
                  <td>
                    <span
                      className={`pill pill-${
                        order.status === 'accepted'
                          ? 'live'
                          : order.status === 'confirmed'
                            ? 'win'
                            : order.status === 'pending'
                              ? 'hybrid'
                              : 'sealed'
                      }`}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </td>
                  <td className="cart-actions-col">
                    <div className="row-actions">
                      {staff && order.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => void reviewCartOrder(order.id, 'accepted')}
                          >
                            {settings.copy.btnAccept}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => void reviewCartOrder(order.id, 'declined')}
                          >
                            {settings.copy.btnDecline}
                          </button>
                        </>
                      ) : null}
                      {!staff && order.status === 'accepted' ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => setConfirmId(order.id)}
                        >
                          {settings.copy.btnConfirm}
                        </button>
                      ) : null}
                      {(order.status === 'pending' || order.status === 'accepted') &&
                      (staff || order.accountId === user?.accountId) ? (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => cancelCartOrder(order.id)}
                        >
                          {settings.copy.btnCancel}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="auction-cards offer-cards">
        {rows.map((order) => {
          const buyer = accounts.find((a) => a.accountId === order.accountId)
          const first = lots.find((l) => l.id === order.lines[0]?.lotId)
          return (
            <article key={order.id} className="auction-card">
              {first ? (
                <ItemLink lot={first} showMoq={false} showGrade={false} showLotId />
              ) : (
                <strong>{order.id}</strong>
              )}
              {staff ? <div className="muted tiny">{buyer?.company || order.accountId}</div> : null}
              <div className="auction-card-meta">
                <span>{order.lines.length} line(s)</span>
                <span>{orderPcs(order).toLocaleString()} pcs</span>
                <span>{usd(orderQuote(order, settings).total)}</span>
              </div>
              <span
                className={`pill pill-${
                  order.status === 'accepted'
                    ? 'live'
                    : order.status === 'confirmed'
                      ? 'win'
                      : order.status === 'pending'
                        ? 'hybrid'
                        : 'sealed'
                }`}
              >
                {statusLabel(order.status)}
              </span>
              <div className="row-actions">
                {staff && order.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void reviewCartOrder(order.id, 'accepted')}
                    >
                      {settings.copy.btnAccept}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => void reviewCartOrder(order.id, 'declined')}
                    >
                      {settings.copy.btnDecline}
                    </button>
                  </>
                ) : null}
                {!staff && order.status === 'accepted' ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setConfirmId(order.id)}
                  >
                    {settings.copy.btnConfirm}
                  </button>
                ) : null}
                {(order.status === 'pending' || order.status === 'accepted') &&
                (staff || order.accountId === user?.accountId) ? (
                  <button type="button" className="btn" onClick={() => cancelCartOrder(order.id)}>
                    {settings.copy.btnCancel}
                  </button>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
      {confirming ? (
        <ConfirmDialog
          title={settings.copy.confirmAcceptCartTitle}
          body={settings.copy.confirmAcceptCartBody}
          onCancel={() => setConfirmId(null)}
          onConfirm={() => {
            void confirmCartOrder(confirming.id)
            setConfirmId(null)
          }}
        >
          <div className="confirm-summary">
            <div>
              <dt>Cart</dt>
              <dd>{confirming.id}</dd>
            </div>
            <div>
              <dt>Lines</dt>
              <dd>{confirming.lines.length}</dd>
            </div>
            <div>
              <dt>Quantity</dt>
              <dd>{orderPcs(confirming).toLocaleString()} pcs</dd>
            </div>
            <div>
              <dt>Goods</dt>
              <dd>{usd(confirmingQuote?.goods || 0)}</dd>
            </div>
            {confirmingQuote && confirmingQuote.feePct > 0 ? (
              <div>
                <dt>Fee {confirmingQuote.feePct}%</dt>
                <dd>{usd(confirmingQuote.fee)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Est. total</dt>
              <dd>{usd(confirmingQuote?.total || 0)}</dd>
            </div>
          </div>
        </ConfirmDialog>
      ) : null}
    </>
  )
}
