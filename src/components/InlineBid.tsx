import { useEffect, useState, type FormEvent } from 'react'
import { ConfirmBidDialog } from './ConfirmBidDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { FavHeart } from './FavHeart'
import { fillCopy, usd } from '../lib/format'
import { checkOrderQty, lotMoq, moqLabel } from '../lib/moq'
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
  const min = lot.startPrice
  const closed = lot.endsAt <= now
  const last = myLastBid(lot.id)
  const [qty, setQty] = useState(String(lotMoq(lot)))
  const [amount, setAmount] = useState(String(min))
  const [msg, setMsg] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [pending, setPending] = useState<{ qty: number; unitPrice: number } | null>(null)
  const [takeAllOpen, setTakeAllOpen] = useState(false)

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
    const qtyErr = checkOrderQty(lot, q, copy)
    if (qtyErr) return qtyErr
    if (!Number.isFinite(p) || p < min) {
      return fillCopy(copy.warnMinPrice, { price: usd(min) })
    }
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
        <div className="inline-price-fav">
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
            {!closed ? (
              <button
                type="button"
                className="linkish bid-match"
                onClick={() => setAmount(String(Math.max(min, lot.currentPrice)))}
              >
                Use high {usd(lot.currentPrice)}
              </button>
            ) : null}
          </label>
          {withWatch && settings.features.favourites ? <FavHeart lotId={lot.id} /> : null}
        </div>
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
        </div>
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
