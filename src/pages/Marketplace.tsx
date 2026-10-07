import { useMemo, useState } from 'react'
import { usd } from '../lib/format'
import { useStore } from '../store'
import type { Lot } from '../types'

function MarketRow({ lot }: { lot: Lot }) {
  const { addToCart } = useStore()
  const [qty, setQty] = useState('1')
  const [msg, setMsg] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const price = lot.buyNowPrice ?? lot.currentPrice

  function add() {
    const q = Number(qty)
    const err = addToCart(lot.id, Number.isInteger(q) ? q : 0)
    if (err) {
      setOk(false)
      setMsg(err)
      return
    }
    setOk(true)
    setMsg(`Added ${q} pcs`)
  }

  return (
    <tr>
      <td className="mono">{lot.id}</td>
      <td>
        <div className="item-name">
          {lot.manufacturer} {lot.model} {lot.capacity}
        </div>
        <div className="muted tiny">{lot.color}</div>
      </td>
      <td>
        <span className={`grade-inline grade-${lot.grade}`}>{lot.grade}</span>
      </td>
      <td>{lot.battery}%</td>
      <td>{lot.qty}</td>
      <td className="price-cell">{usd(price)}</td>
      <td>
        <input
          className="qty-input"
          type="number"
          min={1}
          max={lot.qty}
          step={1}
          value={qty}
          aria-label={`Desired qty for ${lot.id}`}
          onChange={(e) => setQty(e.target.value)}
        />
      </td>
      <td>
        <button type="button" className="btn btn-primary btn-sm" onClick={add}>
          Add to cart
        </button>
        {msg ? <div className={ok ? 'ok tiny' : 'error tiny'}>{msg}</div> : null}
      </td>
    </tr>
  )
}

export function Marketplace() {
  const { lots, cart, removeFromCart, checkoutCart } = useStore()
  const [q, setQ] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const rows = useMemo(
    () =>
      lots.filter((l) => {
        if (l.channel !== 'marketplace') return false
        const hay = `${l.id} ${l.manufacturer} ${l.model} ${l.capacity}`.toLowerCase()
        return hay.includes(q.toLowerCase())
      }),
    [lots, q],
  )

  const cartRows = cart
    .map((item) => {
      const lot = lots.find((l) => l.id === item.lotId)
      if (!lot || !lot.buyNowPrice) return null
      return { item, lot, total: lot.buyNowPrice * item.qty }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)

  const cartTotal = cartRows.reduce((sum, row) => sum + row.total, 0)

  function checkout() {
    const err = checkoutCart()
    setNotice(err ?? 'Checkout complete. Invoice created.')
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Marketplace</h1>
          <p className="muted">Fixed wholesale prices. Add to cart on this page — no extra listing screen.</p>
        </div>
      </div>
      <div className="filters">
        <input
          placeholder="Search listings"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {rows.length ? (
        <div className="table-wrap card auction-table-wrap">
          <table className="auction-table">
            <thead>
              <tr>
                <th>Lot</th>
                <th>Item</th>
                <th>Grade</th>
                <th>Batt</th>
                <th>Total pcs</th>
                <th>Price / pc</th>
                <th>Desired qty</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((lot) => (
                <MarketRow key={lot.id} lot={lot} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No marketplace listings right now.</p>
      )}

      <div className="cart-panel card">
        <h2>Cart {cartRows.length ? `(${cartRows.length})` : ''}</h2>
        {!cartRows.length ? (
          <p className="muted">Cart is empty. Choose desired qty and add to cart.</p>
        ) : (
          <>
            <table className="auction-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Pcs</th>
                  <th>Unit</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cartRows.map(({ item, lot, total }) => (
                  <tr key={item.lotId}>
                    <td>
                      {lot.manufacturer} {lot.model}
                    </td>
                    <td>{item.qty}</td>
                    <td>{usd(lot.buyNowPrice ?? 0)}</td>
                    <td className="price-cell">{usd(total)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeFromCart(item.lotId)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="cart-foot">
              <strong>Total {usd(cartTotal)}</strong>
              <button type="button" className="btn btn-primary" onClick={checkout}>
                Checkout
              </button>
            </div>
          </>
        )}
        {notice ? <p className={notice.startsWith('Checkout') ? 'ok' : 'error'}>{notice}</p> : null}
      </div>
    </div>
  )
}
