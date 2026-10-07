import { useEffect, useState, type FormEvent } from 'react'
import { ConfirmBidDialog } from './ConfirmBidDialog'
import { FillBar } from './FillBar'
import { fillStats } from '../lib/allocate'
import { timeLeft, typeLabel, usd } from '../lib/format'
import { useStore } from '../store'
import type { Lot } from '../types'

function statusFor(lot: Lot, myPcs: number, desired: number | undefined, now: number) {
  if (lot.endsAt <= now) return { label: 'Closed', className: 'muted' }
  if (lot.auctionType === 'sealed') {
    return desired != null ? { label: 'Bid in', className: 'status sealed' } : { label: '—', className: 'muted' }
  }
  if (desired == null) return { label: '—', className: 'muted' }
  if (myPcs <= 0) return { label: 'Outbid', className: 'status lose' }
  if (myPcs < desired) return { label: `Partial ${myPcs}/${desired}`, className: 'status lose' }
  return { label: 'Winning', className: 'status win' }
}

function InlineBid({ lot }: { lot: Lot }) {
  const { now, placeBid, myLastBid } = useStore()
  const min = lot.startPrice
  const closed = lot.endsAt <= now
  const last = myLastBid(lot.id)
  const [qty, setQty] = useState('1')
  const [amount, setAmount] = useState(String(min))
  const [msg, setMsg] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [pending, setPending] = useState<{ qty: number; unitPrice: number } | null>(null)

  useEffect(() => {
    setAmount((prev) => {
      const n = Number(prev)
      if (!Number.isFinite(n) || n < min) return String(min)
      return prev
    })
  }, [min])

  function parseEntry() {
    const q = Number(qty)
    const p = Number(amount)
    if (!Number.isInteger(q) || q < 1) return 'Desired qty must be a whole number of 1 or more.'
    if (q > lot.qty) return `Desired qty cannot exceed total pcs (${lot.qty}).`
    if (!Number.isFinite(p) || p < min) return `Minimum price per pc is ${usd(min)}.`
    return { qty: q, unitPrice: p }
  }

  function onBid(e: FormEvent) {
    e.preventDefault()
    if (closed) return
    const parsed = parseEntry()
    if (typeof parsed === 'string') {
      setOk(false)
      setMsg(parsed)
      return
    }
    setMsg(null)
    setPending(parsed)
  }

  function confirm() {
    if (!pending) return
    const err = placeBid(lot.id, pending.unitPrice, pending.qty)
    setPending(null)
    if (err) {
      setOk(false)
      setMsg(err)
      return
    }
    setOk(true)
    setMsg(`Confirmed ${pending.qty} pcs @ ${usd(pending.unitPrice)}`)
  }

  return (
    <>
      <form className="inline-bid" onSubmit={onBid}>
        <label className="inline-field">
          <span>Desired qty</span>
          <input
            type="number"
            min={1}
            max={lot.qty}
            step={1}
            disabled={closed}
            value={closed ? '' : qty}
            aria-label={`Desired qty for ${lot.id}`}
            onChange={(e) => setQty(e.target.value)}
          />
        </label>
        <label className="inline-field">
          <span>Your price / pc</span>
          <input
            type="number"
            min={min}
            step={1}
            disabled={closed}
            value={closed ? '' : amount}
            aria-label={`Unit price for ${lot.id}`}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={closed}
          onClick={() => setQty(String(lot.qty))}
        >
          Take all
        </button>
        <button className="btn btn-primary btn-sm" type="submit" disabled={closed}>
          Bid
        </button>
        {last ? (
          <span className="muted tiny">
            Last: {last.qty} pcs @ {usd(last.amount)}
          </span>
        ) : null}
        {msg ? <span className={ok ? 'ok tiny' : 'error tiny'}>{msg}</span> : null}
      </form>
      {pending ? (
        <ConfirmBidDialog
          lot={lot}
          qty={pending.qty}
          unitPrice={pending.unitPrice}
          onCancel={() => setPending(null)}
          onConfirm={confirm}
        />
      ) : null}
    </>
  )
}

export function AuctionTable({ lots }: { lots: Lot[] }) {
  const { now, myLastBid, watchlist, toggleWatch, bids, user } = useStore()
  const me = user?.accountId

  let alreadyBid = 0
  let winningAmount = 0
  for (const lot of lots) {
    const last = myLastBid(lot.id)
    if (!last) continue
    alreadyBid += last.qty * last.amount
    const stats = fillStats(lot, bids, me)
    if (lot.auctionType !== 'sealed' && stats.myPcs > 0) {
      winningAmount += stats.myPcs * last.amount
    }
  }

  return (
    <>
      <div className="bid-totals">
        <div className="bid-total-card">
          <span className="label">Total already bid</span>
          <strong>{usd(alreadyBid)}</strong>
          <span className="muted tiny">Your qty × your price on these lots</span>
        </div>
        <div className="bid-total-card win-card">
          <span className="label">Winning amount</span>
          <strong>{usd(winningAmount)}</strong>
          <span className="muted tiny">Pcs you are currently allocated × your price</span>
        </div>
      </div>
      <div className="fill-key">
        <span><i className="fill-take" /> Take-all pcs</span>
        <span><i className="fill-small" /> Small qty (often higher $/pc)</span>
        <span><i className="fill-open" /> Open pcs</span>
      </div>
      <div className="table-wrap card auction-table-wrap">
        <table className="auction-table">
          <thead>
            <tr>
              <th>Lot</th>
              <th>Type</th>
              <th>Item</th>
              <th>Grade</th>
              <th>Batt</th>
              <th>Total pcs</th>
              <th>Pcs fill</th>
              <th>High / pc</th>
              <th>Your bid total</th>
              <th>Winning amount</th>
              <th>Time left</th>
              <th>Status</th>
              <th>Your order</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => {
              const last = myLastBid(lot.id)
              const stats = fillStats(lot, bids, me)
              const closed = lot.endsAt <= now
              const st = statusFor(lot, stats.myPcs, last?.qty, now)
              const watching = watchlist.includes(lot.id)
              const yourTotal = last ? last.qty * last.amount : null
              const winTotal =
                lot.auctionType === 'sealed' ? null : stats.myPcs > 0 && last ? stats.myPcs * last.amount : 0
              return (
                <tr key={lot.id} className={closed ? 'is-closed' : ''}>
                  <td className="mono">{lot.id}</td>
                  <td>
                    <span className={`pill pill-${lot.auctionType || 'market'}`}>
                      {typeLabel[lot.auctionType || 'live']}
                    </span>
                  </td>
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
                <td className="fill-cell">
                  <FillBar total={lot.qty} stats={stats} sealed={lot.auctionType === 'sealed'} me={me} />
                </td>
                <td className="price-cell">{usd(lot.currentPrice)}</td>
                <td className="price-cell">
                    {yourTotal != null && last ? (
                      <>
                        {usd(yourTotal)}
                        <div className="muted tiny">
                          {last.qty} pcs × {usd(last.amount)}
                          {last.qty >= lot.qty ? ' · take all' : ' · small qty'}
                        </div>
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="price-cell">
                    {winTotal == null ? (
                      <span className="muted">Hidden</span>
                    ) : (
                      <>
                        {usd(winTotal)}
                        <div className="muted tiny">{stats.myPcs} pcs allocated</div>
                      </>
                    )}
                  </td>
                  <td className={`countdown ${closed ? 'closed' : ''}`}>
                    {closed ? 'Closed' : timeLeft(lot.endsAt, now)}
                  </td>
                  <td className={st.className}>{st.label}</td>
                  <td>
                    <InlineBid lot={lot} />
                  </td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className={`btn btn-ghost btn-sm ${watching ? 'on' : ''}`}
                      onClick={() => toggleWatch(lot.id)}
                    >
                      {watching ? 'Watching' : 'Watch'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
