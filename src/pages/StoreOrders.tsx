import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { StoreRail } from '../components/StoreRail'
import { StoreBlockSkeleton } from '../components/StoreSkeleton'
import { api, type StoreOrderDto } from '../lib/api'
import { usd } from '../lib/format'
import { useStore } from '../store'

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  paid: 'Paid',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
}

const PAY_LABEL: Record<string, string> = {
  card: 'Card',
  paypal: 'PayPal',
  bank: 'Bank transfer',
}

function statusLabel(status: string) {
  return STATUS_LABEL[status] || status.replace(/_/g, ' ')
}

function payLabel(method: string) {
  return PAY_LABEL[method] || method
}

export function StoreOrders() {
  const { settings, user } = useStore()
  const [params] = useSearchParams()
  const placed = params.get('placed')
  const pay = params.get('pay')
  const [orders, setOrders] = useState<StoreOrderDto[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(() => placed)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    let alive = true
    void api
      .storeOrders()
      .then((res) => {
        if (alive) setOrders(res.orders)
      })
      .catch((e) => {
        if (alive) setErr(e instanceof Error ? e.message : 'Could not load orders.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [user])

  if (!settings.showStore) {
    return (
      <PublicShell mode="consumer">
        <p className="muted store-off-note">Retail store is turned off.</p>
      </PublicShell>
    )
  }

  const storeName = settings.storeLabel || 'Store'
  const count = !user ? null : loading ? '…' : orders.length

  return (
    <PublicShell mode="consumer">
      <div className="retail-store store-orders-desk">
        <StoreRail
          page="orders"
          title="Orders"
          count={count}
          note="Consumer store orders only — not wholesale invoices."
          label={storeName}
        />

        {placed ? (
          <div className="retail-toast shop-toast store-order-confirm" role="status">
            <p>
              Order <strong className="mono">{placed}</strong> placed
              {pay === 'bank'
                ? ' — awaiting bank transfer confirmation.'
                : pay === 'paypal' || pay === 'card'
                  ? ' — payment recorded (demo).'
                  : '.'}{' '}
              Thank you.
            </p>
            <Link to="/store" className="btn btn-primary btn-sm">
              Keep shopping
            </Link>
          </div>
        ) : null}

        {!user ? (
          <div className="mh-empty shop-empty">
            <p>
              Sign in to see orders linked to your account. Guest checkouts still receive the order
              id above.
            </p>
            <Link to="/login" state={{ from: '/store/orders' }} className="btn btn-primary btn-sm">
              Sign in
            </Link>
          </div>
        ) : loading ? (
          <StoreBlockSkeleton rows={4} />
        ) : err ? (
          <p className="tiny imei-err">{err}</p>
        ) : !orders.length ? (
          <div className="mh-empty shop-empty">
            <p>No retail orders yet.</p>
            <Link to="/store" className="btn btn-primary btn-sm">
              Shop collection
            </Link>
          </div>
        ) : (
          <div className="store-orders-list">
            {orders.map((o) => {
              const open = openId === o.id
              return (
                <article key={o.id} className={`store-order-card${open ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="store-order-summary"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : o.id)}
                  >
                    <span className="mono store-order-id">{o.id}</span>
                    <span className="store-order-badge">{statusLabel(o.status)}</span>
                    <span className="muted tiny">{payLabel(o.paymentMethod)}</span>
                    <strong className="store-order-total">{usd(o.total)}</strong>
                  </button>
                  {open ? (
                    <div className="store-order-detail">
                      <p className="tiny muted">
                        {o.name} · {o.email}
                        {o.phone ? ` · ${o.phone}` : ''}
                      </p>
                      <p className="store-order-address">{o.address}</p>
                      {o.note ? <p className="tiny muted">Note: {o.note}</p> : null}
                      {o.paymentMethod === 'bank' && o.status === 'pending_payment' ? (
                        <p className="tiny store-order-bank-hint">
                          Bank transfer — staff will confirm when funds clear. Include order{' '}
                          <span className="mono">{o.id}</span> in the remittance.
                        </p>
                      ) : null}
                      <ul className="store-order-lines">
                        {o.lines.map((l) => (
                          <li key={l.id}>
                            <span>
                              {l.qty}× {l.title}
                            </span>
                            <span>{usd(l.unitPrice * l.qty)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="store-order-totals tiny">
                        <span>Subtotal {usd(o.subtotal)}</span>
                        <span>Shipping {usd(o.shippingFee)}</span>
                        <strong>Total {usd(o.total)}</strong>
                      </div>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </PublicShell>
  )
}
