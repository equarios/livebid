import { useEffect, useState, type FormEvent } from 'react'
import { ConfirmBidDialog } from './ConfirmBidDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { FavHeart } from './FavHeart'
import { fillCopy, usd } from '../lib/format'
import { isSealedLot } from '../lib/auctionLists'
import { checkBidPrice, checkOrderQty, lotMoq, minBidPrice, moqLabel } from '../lib/moq'
import { useNow, useStore } from '../store'
import type { Lot } from '../types'

export function InlineBid({
  lot,
  stacked,
  withWatch,
}: {
  lot: Lot
  stacked?: boolean
  withWatch?: boolean
}) {
  const now = useNow()
  const { placeBid, myLastBid, settings } = useStore()
  const copy = settings.copy
  const closed = lot.endsAt <= now
  const last = myLastBid(lot.id)
  const independent = isSealedLot(lot, settings)
  const priceCtx = { independent, lastOwnAmount: last?.amount }
  const minNext = minBidPrice(lot, priceCtx)
  const [qty, setQty] = useState(String(lotMoq(lot)))
  const [amount, setAmount] = useState(String(minNext))
  const [msg, setMsg] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [pending, setPending] = useState<{ qty: number; unitPrice: number } | null>(null)
  const [takeAllOpen, setTakeAllOpen] = useState(false)

  useEffect(() => {
    setAmount((prev) => {
      const n = Number(prev)
      if (!Number.isFinite(n) || n < minNext) return String(minNext)
      return prev
    })
  }, [minNext])

  function currentAmount() {
    const n = Number(amount)
    return Number.isFinite(n) ? n : minNext
  }

  function setHigh() {
    setAmount(String(minNext))
    setMsg(null)
  }

  function bump(delta: number) {
    setAmount(String(Math.max(minNext, Math.round(currentAmount() + delta))))
    setMsg(null)
  }

  function parseEntry() {
    const q = Number(qty)
    const p = Number(amount)
    const qtyErr = checkOrderQty(lot, q, copy)
    if (qtyErr) return qtyErr
    const priceErr = checkBidPrice(lot, p, copy, priceCtx)
    if (priceErr) return priceErr
    return { qty: q, unitPrice: p }
  }

  function onBid(e?: FormEvent) {
    e?.preventDefault()
    if (closed) return
    const parsed = parseEntry()
    if (typeof parsed === 'string') {
      setOk(false)
      setMsg(parsed)
      return
    }
    setMsg(null)
    if (!settings.features.confirmBid) {
      const err = placeBid(lot.id, parsed.unitPrice, parsed.qty)
      if (err) {
        setOk(false)
        setMsg(err)
        return
      }
      setOk(true)
      setMsg(fillCopy(copy.okBid, { qty: parsed.qty, price: usd(parsed.unitPrice) }))
      return
    }
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
    setMsg(fillCopy(copy.okBid, { qty: pending.qty, price: usd(pending.unitPrice) }))
  }

  return (
    <>
      <form className={`inline-bid ${stacked ? 'stacked' : ''}`} onSubmit={onBid}>
        <div className="inline-bid-row">
          <label className="inline-field">
            <span>Desired qty · {moqLabel(lot, copy.noMoq)}</span>
            <input
              type="number"
              min={lotMoq(lot)}
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
              min={minNext}
              step={1}
              disabled={closed}
              value={closed ? '' : amount}
              aria-label={`Unit price for ${lot.id}`}
              onChange={(e) => {
                setAmount(e.target.value)
                const n = Number(e.target.value)
                if (e.target.value !== '' && Number.isFinite(n) && n < minNext) {
                  setOk(false)
                  setMsg(checkBidPrice(lot, n, copy, priceCtx) || '')
                } else {
                  setMsg(null)
                }
              }}
            />
          </label>
          <div className="inline-bid-actions">
            {settings.features.takeAll ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={closed}
                onClick={() => {
                  if (settings.features.confirmTakeAll) setTakeAllOpen(true)
                  else setQty(String(lot.qty))
                }}
              >
                {copy.btnTakeAll}
              </button>
            ) : null}
            <button
              className="btn btn-primary btn-sm"
              type="button"
              disabled={closed || !settings.features.bidding}
              onClick={() => onBid()}
            >
              {copy.btnBid}
            </button>
            {withWatch && settings.features.favourites ? <FavHeart lotId={lot.id} /> : null}
          </div>
        </div>
        {!closed ? (
          <div className="price-steps">
            {independent ? null : (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={setHigh}
                aria-label={`Set price to high ${usd(lot.currentPrice)} for ${lot.id}`}
              >
                High {usd(lot.currentPrice)}
              </button>
            )}
            {[1, 3, 5].map((delta) => (
              <button
                key={delta}
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => bump(delta)}
                aria-label={`Add ${usd(delta)} to price for ${lot.id}`}
              >
                +${delta}
              </button>
            ))}
          </div>
        ) : null}
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
      {takeAllOpen ? (
        <ConfirmDialog
          title={copy.confirmTakeAllTitle}
          body={fillCopy(copy.confirmTakeAllBody, { n: lot.qty })}
          onCancel={() => setTakeAllOpen(false)}
          onConfirm={() => {
            setQty(String(lot.qty))
            setTakeAllOpen(false)
          }}
        />
      ) : null}
    </>
  )
}
