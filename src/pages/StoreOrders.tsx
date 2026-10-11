import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { StoreRail } from '../components/StoreRail'
import { StoreBlockSkeleton } from '../components/StoreSkeleton'
import { api, type StoreOrderDto } from '../lib/api'
import { usd } from '../lib/format'
import { useStore } from '../store'

export function StoreOrders() {
  const { settings, user } = useStore()
  const [params] = useSearchParams()
  const placed = params.get('placed')
  const pay = params.get('pay')
  const [orders, setOrders] = useState<StoreOrderDto[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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
              Order <strong className="mono">{placed}</strong> recorded
              {pay === 'bank'
                ? ' — awaiting bank transfer confirmation.'
                : pay === 'paypal' || pay === 'card'
                  ? ' — demo payment accepted (not charged).'
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
          <div className="mh-table-wrap desk-list-scroll">
            <table className="gbs-table mh-table store-orders-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Pay</th>
                  <th className="num">Total</th>
                  <th>Items</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="mono">{o.id}</td>
                    <td>{o.status.replace(/_/g, ' ')}</td>
                    <td>{o.paymentMethod}</td>
                    <td className="num">{usd(o.total)}</td>
                    <td className="tiny store-orders-items">
                      {o.lines.map((l) => `${l.qty}× ${l.title}`).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PublicShell>
  )
}
