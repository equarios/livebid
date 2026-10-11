import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { api, type StoreOrderDto } from '../lib/api'
import { usd } from '../lib/format'
import { useStore } from '../store'

export function StoreOrders() {
  const { settings, user } = useStore()
  const [params] = useSearchParams()
  const placed = params.get('placed')
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
        <p className="muted" style={{ padding: 24 }}>
          Retail store is turned off.
        </p>
      </PublicShell>
    )
  }

  return (
    <PublicShell mode="consumer">
      <div className="retail-store">
        <header className="retail-hero">
          <div>
            <h1>Retail orders</h1>
            <p className="muted tiny">Consumer store orders only (not wholesale invoices).</p>
          </div>
          <Link to="/" className="btn btn-ghost btn-sm">
            Back to store
          </Link>
        </header>

        {placed ? (
          <p className="retail-toast">
            Order <strong className="mono">{placed}</strong> placed. Thank you!
          </p>
        ) : null}

        {!user ? (
          <p className="muted">
            <Link to="/login" state={{ from: '/store/orders' }}>
              Sign in
            </Link>{' '}
            to see orders linked to your account. Guest checkouts still receive the order id above.
          </p>
        ) : loading ? (
          <p className="muted tiny">Loading…</p>
        ) : err ? (
          <p className="tiny imei-err">{err}</p>
        ) : !orders.length ? (
          <p className="muted">No retail orders yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="auction-table">
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
                    <td className="tiny">
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
