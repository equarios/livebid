import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ConfirmBidDialog } from '../components/ConfirmBidDialog'
import { timeLeft, typeLabel, usd } from '../lib/format'
import { useStore } from '../store'

export function LotDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { lots, now, myBid, myLastBid, placeBid, buyNow, toggleWatch, watchlist } = useStore()
  const lot = lots.find((l) => l.id === id)
  const [amount, setAmount] = useState('')
  const [qty, setQty] = useState('1')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState<{ qty: number; unitPrice: number; kind: 'bid' | 'buy' } | null>(
    null,
  )

  if (!lot) {
    return (
      <div className="empty">
        Listing is gone (sold or closed). <Link to="/auctions">Back to auctions</Link>
      </div>
    )
  }

  const lotId = lot.id
  const totalPcs = lot.qty
  const listPrice = lot.buyNowPrice
  const mine = myBid(lotId)
  const last = myLastBid(lotId)
  const closed = lot.endsAt <= now
  const minBid = lot.currentPrice + 1
  const winning =
    lot.auctionType === 'sealed'
      ? null
      : mine != null && mine >= lot.currentPrice
        ? true
        : mine != null
          ? false
          : null

  function parseQtyPrice(unitPrice: number, minPrice?: number) {
    const q = Number(qty)
    if (!Number.isInteger(q) || q < 1) return 'Desired qty must be a whole number of 1 or more.'
    if (q > totalPcs) return `Desired qty cannot exceed total pcs (${totalPcs}).`
    if (!Number.isFinite(unitPrice) || (minPrice != null && unitPrice < minPrice)) {
      return `Minimum price per pc is ${usd(minPrice ?? 1)}.`
    }
    return { qty: q, unitPrice }
  }

  function onBid(e: FormEvent) {
    e.preventDefault()
    const n = Number(amount || minBid)
    const parsed = parseQtyPrice(n, minBid)
    if (typeof parsed === 'string') {
      setMsg(parsed)
      return
    }
    setMsg(null)
    setPending({ ...parsed, kind: 'bid' })
  }

  function onBuy() {
    const price = listPrice ?? 0
    const parsed = parseQtyPrice(price)
    if (typeof parsed === 'string') {
      setMsg(parsed)
      return
    }
    setMsg(null)
    setPending({ ...parsed, kind: 'buy' })
  }

  function confirm() {
    if (!pending) return
    const { qty: q, unitPrice, kind } = pending
    setPending(null)
    if (kind === 'bid') {
      const err = placeBid(lotId, unitPrice, q)
      setMsg(err ?? `Confirmed ${q} pcs @ ${usd(unitPrice)}`)
      return
    }
    const err = buyNow(lotId, q)
    if (err) setMsg(err)
    else navigate('/invoices')
  }

  return (
    <div className="detail">
      <Link className="back" to={lot.channel === 'marketplace' ? '/marketplace' : '/auctions'}>
        ← Back
      </Link>
      <div className="detail-grid">
        <div className="card">
          <div className="device tall" style={{ background: lot.accent }}>
            <div className="device-screen">
              <span>{lot.manufacturer}</span>
              <strong>{lot.model}</strong>
              <em>{lot.capacity}</em>
            </div>
            <span className={`grade grade-${lot.grade}`}>Grade {lot.grade}</span>
          </div>
          <dl className="specs">
            <div>
              <dt>Lot</dt>
              <dd>{lot.id}</dd>
            </div>
            <div>
              <dt>Color</dt>
              <dd>{lot.color}</dd>
            </div>
            <div>
              <dt>Battery</dt>
              <dd>{lot.battery}%</dd>
            </div>
            <div>
              <dt>Total pcs</dt>
              <dd>{lot.qty}</dd>
            </div>
          </dl>
          <p>{lot.description}</p>
        </div>
        <aside className="card bid-panel">
          <span className={`pill pill-${lot.auctionType || 'market'}`}>
            {lot.channel === 'marketplace'
              ? typeLabel.marketplace
              : typeLabel[lot.auctionType || 'live']}
          </span>
          <h1>
            {lot.model} {lot.capacity}
          </h1>
          <p className="muted">{lot.manufacturer}</p>
          <div className="hero-price">
            {usd(lot.buyNowPrice ?? lot.currentPrice)}
            <small> / pc</small>
          </div>
          {lot.channel === 'auction' ? (
            <>
              <p className={`countdown lg ${closed ? 'closed' : ''}`}>
                {closed ? 'Auction closed' : `Ends in ${timeLeft(lot.endsAt, now)}`}
              </p>
              <p className="muted">{lot.bidCount} bids · start {usd(lot.startPrice)}</p>
              {lot.auctionType !== 'sealed' && winning != null && (
                <div className={`status ${winning ? 'win' : 'lose'}`}>
                  You are {winning ? 'winning' : 'losing'}
                </div>
              )}
              {lot.auctionType === 'sealed' && (
                <p className="muted">Sealed auction: other bids stay hidden until close.</p>
              )}
              {last != null ? (
                <p>
                  Your last order: {last.qty} pcs @ {usd(last.amount)} = {usd(last.qty * last.amount)}
                </p>
              ) : null}
              {!closed ? (
                <form onSubmit={onBid} className="bid-form">
                  <label>
                    Desired qty (pcs)
                    <input
                      type="number"
                      min={1}
                      max={lot.qty}
                      step={1}
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                    />
                  </label>
                  <label>
                    Your price per pc (USD)
                    <input
                      type="number"
                      min={minBid}
                      step={1}
                      value={amount}
                      placeholder={String(minBid)}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <button className="btn btn-navy" type="submit">
                    Review bid
                  </button>
                </form>
              ) : null}
            </>
          ) : (
            <>
              <p className="muted">USD · invoice due within 7 days of purchase.</p>
              <label>
                Desired qty (pcs)
                <input
                  type="number"
                  min={1}
                  max={lot.qty}
                  step={1}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </label>
              <button className="btn btn-navy" type="button" onClick={onBuy}>
                Review buy now
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => toggleWatch(lot.id)}
          >
            {watchlist.includes(lot.id) ? 'Remove from watchlist' : 'Add to watchlist'}
          </button>
          {msg ? <p className={msg.startsWith('Confirmed') ? 'ok' : 'error'}>{msg}</p> : null}
        </aside>
      </div>
      {pending ? (
        <ConfirmBidDialog
          lot={lot}
          qty={pending.qty}
          unitPrice={pending.unitPrice}
          onCancel={() => setPending(null)}
          onConfirm={confirm}
        />
      ) : null}
    </div>
  )
}
