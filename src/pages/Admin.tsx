import { useState, type FormEvent } from 'react'
import { ItemLink } from '../components/ItemLink'
import { InvoiceDesk } from '../components/InvoiceDesk'
import { OfferDesk } from '../components/OfferDesk'
import { TimeLeft } from '../components/TimeLeft'
import { ORIGINS, typePillClass } from '../lib/auctionLists'
import { listingLabel, listingMinutes } from '../lib/duration'
import { lotTypeLabel, usd } from '../lib/format'
import { useStore } from '../store'
import type { AuctionType, Channel, Grade, Lot } from '../types'

export function Admin() {
  const {
    lots,
    bids,
    invoices,
    offers,
    settings,
    addLot,
    updateLot,
    removeLot,
    extendLot,
    reopenAuctions,
  } = useStore()
  const live = lots.filter((l) => l.channel === 'auction' && l.endsAt > Date.now())
  const market = lots.filter((l) => l.channel === 'marketplace')
  const unpaid = invoices.filter((i) => i.status !== 'paid')
  const unpaidTotal = unpaid.reduce((s, i) => s + i.amount, 0)
  const pendingOffers = (offers || []).filter((o) => o.status === 'pending')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [id, setId] = useState(`LB-${Date.now().toString().slice(-5)}`)
  const [channel, setChannel] = useState<Channel>('auction')
  const [auctionType, setAuctionType] = useState<AuctionType>('live')
  const [manufacturer, setManufacturer] = useState('Apple')
  const [model, setModel] = useState('')
  const [modelNumber, setModelNumber] = useState('')
  const [capacity, setCapacity] = useState('128GB')
  const [color, setColor] = useState('Black')
  const [grade, setGrade] = useState<Grade>(settings.grades[0] || 'A')
  const [battery, setBattery] = useState('90')
  const [qty, setQty] = useState('1')
  const [moq, setMoq] = useState(settings.defaultMoq > 1 ? String(settings.defaultMoq) : '')
  const [price, setPrice] = useState('100')
  const defaultMins = listingMinutes(settings, 'reopen')
  const [hours, setHours] = useState(String(Math.floor(defaultMins / 60)))
  const [minutes, setMinutes] = useState(String(defaultMins % 60 || (defaultMins < 60 ? defaultMins : 0)))
  const [origin, setOrigin] = useState('INT')
  const [description, setDescription] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  function loadLot(lot: Lot) {
    setEditingId(lot.id)
    setId(lot.id)
    setChannel(lot.channel)
    setAuctionType(lot.auctionType || 'live')
    setManufacturer(lot.manufacturer)
    setModel(lot.model)
    setModelNumber(lot.modelNumber)
    setCapacity(lot.capacity)
    setColor(lot.color)
    setGrade(lot.grade)
    setBattery(String(lot.battery))
    setQty(String(lot.qty))
    setMoq(lot.moq && lot.moq > 1 ? String(lot.moq) : '')
    setPrice(String(lot.buyNowPrice ?? lot.currentPrice))
    setOrigin(lot.origin || 'INT')
    setDescription(lot.description)
    const left = Math.max(1, Math.round((lot.endsAt - Date.now()) / 60000))
    setHours(String(Math.floor(left / 60)))
    setMinutes(String(left % 60))
    setMsg(`Editing ${lot.id}`)
  }

  function onSaveLot(e: FormEvent) {
    e.preventDefault()
    const q = Number(qty)
    const p = Number(price)
    const b = Number(battery)
    const h = Number(hours)
    const min = Number(minutes)
    const totalMins = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(min) ? min : 0)
    if (!model.trim() || !Number.isInteger(q) || q < 1 || !Number.isFinite(p) || p < 1) {
      setMsg('Fill model, qty, and a valid price.')
      return
    }
    if (!Number.isFinite(totalMins) || totalMins < 1) {
      setMsg('Listing duration must be at least 1 minute.')
      return
    }
    const m = moq.trim() === '' ? undefined : Number(moq)
    if (m != null && (!Number.isInteger(m) || m < 1 || m > q)) {
      setMsg('MOQ must be empty (no MOQ) or a whole number between 1 and total pcs.')
      return
    }
    const existing = editingId ? lots.find((l) => l.id === editingId) : undefined
    const lot: Lot = {
      id: (editingId || id).trim() || `LB-${Date.now().toString().slice(-5)}`,
      channel,
      auctionType: channel === 'auction' ? auctionType : undefined,
      manufacturer,
      model: model.trim(),
      modelNumber: modelNumber.trim(),
      capacity,
      color,
      grade,
      battery: Number.isFinite(b) ? b : 90,
      qty: q,
      moq: m && m > 1 ? m : undefined,
      startPrice: existing?.startPrice ?? p,
      currentPrice: p,
      buyNowPrice: channel === 'marketplace' ? p : undefined,
      bidCount: existing?.bidCount ?? 0,
      endsAt: Date.now() + totalMins * 60 * 1000,
      description: description.trim() || existing?.description || 'Added from admin.',
      accent: existing?.accent ?? '#1d3348',
      origin,
    }
    if (editingId) {
      updateLot(lot)
      setMsg(`Saved ${lot.id}`)
    } else {
      addLot(lot)
      setMsg(`Listed ${lot.id}`)
    }
    setEditingId(null)
    setModel('')
    setModelNumber('')
    setDescription('')
    setMoq(settings.defaultMoq > 1 ? String(settings.defaultMoq) : '')
    setId(`LB-${Date.now().toString().slice(-5)}`)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Admin</h1>
          <p className="muted">Listings, bids, and invoices. User accounts are managed by super admin only.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={reopenAuctions}>
          Reopen all auctions ({listingLabel(listingMinutes(settings, 'reopen'))})
        </button>
      </div>

      <div className="bid-totals admin-kpis">
        <div className="bid-total-card">
          <span className="label">Open auctions</span>
          <strong>{live.length}</strong>
        </div>
        <div className="bid-total-card">
          <span className="label">{settings.marketplaceLabel} SKUs</span>
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
        <div className="bid-total-card">
          <span className="label">Pending offers</span>
          <strong>{pendingOffers.length}</strong>
        </div>
      </div>

      <section className="card admin-section pay-queue-card">
        <h2>Marketplace offers</h2>
        <p className="muted tiny">Accept a buyer’s price. They confirm, then an invoice is created at the offered rate.</p>
        <OfferDesk staff />
      </section>

      <section className="card admin-section pay-queue-card">
        <h2>Invoices &amp; payment confirmations</h2>
        <InvoiceDesk canAdmin />
      </section>

      <section className="card admin-section">
        <h2>{editingId ? `Edit listing ${editingId}` : 'Add listing'}</h2>
        <form className="admin-form" onSubmit={onSaveLot}>
          <label>
            Lot ID
            <input value={id} onChange={(e) => setId(e.target.value)} disabled={Boolean(editingId)} />
          </label>
          <label>
            Channel
            <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              <option value="auction">Auction</option>
              <option value="marketplace">{settings.marketplaceLabel}</option>
            </select>
          </label>
          {channel === 'auction' ? (
            <label>
              Type
              <select
                value={auctionType}
                onChange={(e) => setAuctionType(e.target.value as AuctionType)}
              >
                {settings.auctionTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
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
            Model #
            <input
              value={modelNumber}
              onChange={(e) => setModelNumber(e.target.value)}
              placeholder="A2882"
            />
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
            Origin
            <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
              {ORIGINS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label>
            Grade
            <select value={grade} onChange={(e) => setGrade(e.target.value)}>
              {settings.grades.map((g) => (
                <option key={g}>{g}</option>
              ))}
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
            MOQ (empty = none)
            <input
              type="number"
              min={1}
              placeholder="No MOQ"
              value={moq}
              onChange={(e) => setMoq(e.target.value)}
            />
          </label>
          <label>
            Price / pc (USD)
            <input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label>
            Hours open
            <input type="number" min={0} step={1} value={hours} onChange={(e) => setHours(e.target.value)} />
          </label>
          <label>
            Minutes open
            <input type="number" min={0} step={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </label>
          <label className="admin-span">
            Condition notes
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <button className="btn btn-primary" type="submit">
            {editingId ? 'Save listing' : 'Publish'}
          </button>
          {editingId ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setEditingId(null)
                setModel('')
                setModelNumber('')
                setDescription('')
                setId(`LB-${Date.now().toString().slice(-5)}`)
                setMsg(null)
              }}
            >
              Cancel edit
            </button>
          ) : null}
        </form>
        {msg ? <p className="ok">{msg}</p> : null}
      </section>

      <section className="card admin-section">
        <h2>All lots</h2>
        <div className="table-wrap auction-table-wrap">
        <table className="auction-table">
          <thead>
            <tr>
              <th>Lot</th>
              <th>Channel</th>
              <th>Item</th>
              <th>Pcs</th>
              <th>MOQ</th>
              <th>Price / pc</th>
              <th>Time left</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.id} className={lot.endsAt <= Date.now() && lot.channel === 'auction' ? 'is-closed' : ''}>
                <td className="mono">{lot.id}</td>
                <td>
                  <span className={`pill pill-${typePillClass(lot, settings)}`}>
                    {lotTypeLabel(lot, settings)}
                  </span>
                </td>
                <td>
                  <ItemLink lot={lot} />
                </td>
                <td>{lot.qty.toLocaleString()}</td>
                <td>{lot.moq && lot.moq > 1 ? lot.moq : '—'}</td>
                <td className="price-cell">{usd(lot.buyNowPrice ?? lot.currentPrice)}</td>
                <td>
                  {lot.channel === 'auction' ? <TimeLeft endsAt={lot.endsAt} closedLabel="Closed" /> : '—'}
                </td>
                <td className="row-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadLot(lot)}>
                    Edit
                  </button>
                  {lot.channel === 'auction' ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => extendLot(lot.id)}
                    >
                      +{listingLabel(listingMinutes(settings, 'extend'))}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (window.confirm(`Remove ${lot.id}?`)) removeLot(lot.id)
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="auction-cards">
          {lots.map((lot) => (
            <article
              key={lot.id}
              className={`auction-card ${lot.endsAt <= Date.now() && lot.channel === 'auction' ? 'is-closed' : ''}`}
            >
              <ItemLink lot={lot} />
              <div className="auction-card-meta">
                <span className={`pill pill-${typePillClass(lot, settings)}`}>
                  {lotTypeLabel(lot, settings)}
                </span>
                <span>{lot.qty.toLocaleString()} pcs</span>
                <span>{usd(lot.buyNowPrice ?? lot.currentPrice)}</span>
              </div>
              <div className="row-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadLot(lot)}>
                  Edit
                </button>
                {lot.channel === 'auction' ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => extendLot(lot.id)}>
                    +{listingLabel(listingMinutes(settings, 'extend'))}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    if (window.confirm(`Remove ${lot.id}?`)) removeLot(lot.id)
                  }}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
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
