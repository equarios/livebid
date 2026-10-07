import { useState, type FormEvent } from 'react'
import { timeLeft, typeLabel, usd } from '../lib/format'
import { useStore } from '../store'
import type { AuctionType, Channel, Grade, Lot } from '../types'

export function Admin() {
  const { lots, bids, invoices, now, addLot, extendLot, reopenAuctions, payInvoice } = useStore()
  const live = lots.filter((l) => l.channel === 'auction' && l.endsAt > now)
  const market = lots.filter((l) => l.channel === 'marketplace')
  const unpaid = invoices.filter((i) => i.status === 'unpaid')
  const unpaidTotal = unpaid.reduce((s, i) => s + i.amount, 0)

  const [id, setId] = useState(`LB-${Date.now().toString().slice(-5)}`)
  const [channel, setChannel] = useState<Channel>('auction')
  const [auctionType, setAuctionType] = useState<AuctionType>('live')
  const [manufacturer, setManufacturer] = useState('Apple')
  const [model, setModel] = useState('')
  const [capacity, setCapacity] = useState('128GB')
  const [color, setColor] = useState('Black')
  const [grade, setGrade] = useState<Grade>('A')
  const [battery, setBattery] = useState('90')
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('100')
  const [hours, setHours] = useState('4')
  const [msg, setMsg] = useState<string | null>(null)

  function onAdd(e: FormEvent) {
    e.preventDefault()
    const q = Number(qty)
    const p = Number(price)
    const b = Number(battery)
    const h = Number(hours)
    if (!model.trim() || !Number.isInteger(q) || q < 1 || !Number.isFinite(p) || p < 1) {
      setMsg('Fill model, qty, and a valid price.')
      return
    }
    const lot: Lot = {
      id: id.trim() || `LB-${Date.now().toString().slice(-5)}`,
      channel,
      auctionType: channel === 'auction' ? auctionType : undefined,
      manufacturer,
      model: model.trim(),
      capacity,
      color,
      grade,
      battery: Number.isFinite(b) ? b : 90,
      qty: q,
      startPrice: p,
      currentPrice: p,
      buyNowPrice: channel === 'marketplace' ? p : undefined,
      bidCount: 0,
      endsAt: Date.now() + (Number.isFinite(h) ? h : 4) * 60 * 60 * 1000,
      description: 'Added from admin.',
      accent: '#1d3348',
    }
    addLot(lot)
    setMsg(`Listed ${lot.id}`)
    setModel('')
    setId(`LB-${Date.now().toString().slice(-5)}`)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Admin</h1>
          <p className="muted">Lots, bids, invoices, and session controls for LiveBid.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={reopenAuctions}>
          Reopen all auctions (4h)
        </button>
      </div>

      <div className="bid-totals admin-kpis">
        <div className="bid-total-card">
          <span className="label">Open auctions</span>
          <strong>{live.length}</strong>
        </div>
        <div className="bid-total-card">
          <span className="label">Marketplace SKUs</span>
          <strong>{market.length}</strong>
        </div>
        <div className="bid-total-card">
          <span className="label">Bids placed</span>
          <strong>{bids.length}</strong>
        </div>
        <div className="bid-total-card win-card">
          <span className="label">Unpaid invoices</span>
          <strong>{usd(unpaidTotal)}</strong>
          <span className="muted tiny">{unpaid.length} open</span>
        </div>
      </div>

      <section className="card admin-section">
        <h2>Add listing</h2>
        <form className="admin-form" onSubmit={onAdd}>
          <label>
            Lot ID
            <input value={id} onChange={(e) => setId(e.target.value)} />
          </label>
          <label>
            Channel
            <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              <option value="auction">Auction</option>
              <option value="marketplace">Marketplace</option>
            </select>
          </label>
          {channel === 'auction' ? (
            <label>
              Type
              <select
                value={auctionType}
                onChange={(e) => setAuctionType(e.target.value as AuctionType)}
              >
                <option value="live">Real-time</option>
                <option value="sealed">Sealed</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
          ) : null}
          <label>
            Maker
            <input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
          </label>
          <label>
            Model
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="iPhone 14" />
          </label>
          <label>
            Capacity
            <input value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </label>
          <label>
            Color
            <input value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
          <label>
            Grade
            <select value={grade} onChange={(e) => setGrade(e.target.value as Grade)}>
              <option>S</option>
              <option>A</option>
              <option>B</option>
              <option>C</option>
            </select>
          </label>
          <label>
            Battery %
            <input type="number" value={battery} onChange={(e) => setBattery(e.target.value)} />
          </label>
          <label>
            Total pcs
            <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          <label>
            Price / pc (USD)
            <input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label>
            Hours open
            <input type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value)} />
          </label>
          <button className="btn btn-primary" type="submit">
            Publish
          </button>
        </form>
        {msg ? <p className="ok">{msg}</p> : null}
      </section>

      <section className="table-wrap card admin-section">
        <h2>All lots</h2>
        <table className="auction-table">
          <thead>
            <tr>
              <th>Lot</th>
              <th>Channel</th>
              <th>Item</th>
              <th>Pcs</th>
              <th>Price / pc</th>
              <th>Time left</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.id} className={lot.endsAt <= now && lot.channel === 'auction' ? 'is-closed' : ''}>
                <td className="mono">{lot.id}</td>
                <td>
                  <span className={`pill pill-${lot.auctionType || 'market'}`}>
                    {lot.channel === 'marketplace'
                      ? typeLabel.marketplace
                      : typeLabel[lot.auctionType || 'live']}
                  </span>
                </td>
                <td>
                  {lot.manufacturer} {lot.model} {lot.capacity}
                </td>
                <td>{lot.qty}</td>
                <td className="price-cell">{usd(lot.buyNowPrice ?? lot.currentPrice)}</td>
                <td className="countdown">
                  {lot.channel === 'auction'
                    ? lot.endsAt <= now
                      ? 'Closed'
                      : timeLeft(lot.endsAt, now)
                    : '—'}
                </td>
                <td>
                  {lot.channel === 'auction' ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => extendLot(lot.id, 2)}
                    >
                      +2h
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="table-wrap card admin-section">
        <h2>Invoices</h2>
        <table className="auction-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Lot</th>
              <th>Pcs</th>
              <th>Total</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.id}</td>
                <td>{inv.lotId}</td>
                <td>{inv.qty}</td>
                <td className="price-cell">{usd(inv.amount)}</td>
                <td>
                  <span className={`pill ${inv.status === 'paid' ? 'pill-live' : 'pill-sealed'}`}>
                    {inv.status}
                  </span>
                </td>
                <td>
                  {inv.status === 'unpaid' ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => payInvoice(inv.id)}
                    >
                      Mark paid
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!invoices.length ? <p className="empty">No invoices yet.</p> : null}
      </section>

      <section className="table-wrap card admin-section">
        <h2>Recent bids</h2>
        <table className="auction-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Lot</th>
              <th>Pcs</th>
              <th>Price / pc</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {[...bids].reverse().slice(0, 20).map((b, i) => (
              <tr key={`${b.lotId}-${b.at}-${i}`}>
                <td>{new Date(b.at).toLocaleString()}</td>
                <td className="mono">{b.lotId}</td>
                <td>{b.qty}</td>
                <td>{usd(b.amount)}</td>
                <td className="price-cell">{usd(b.qty * b.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!bids.length ? <p className="empty">No bids yet.</p> : null}
      </section>
    </div>
  )
}
