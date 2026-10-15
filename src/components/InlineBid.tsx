import { useEffect, useState, type FormEvent } from 'react'
import { ConfirmBidDialog } from './ConfirmBidDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { FavHeart } from './FavHeart'
import { fillCopy, usd, usdCents } from '../lib/format'
import { isAuctionOpen, isSealedLot } from '../lib/auctionLists'
import { feePctForLot, quoteMoney } from '../lib/invoices'
import {
  checkBidPrice,
  checkOrderQty,
  minBidPrice,
  minBidQty,
  moqLabel,
} from '../lib/moq'
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
  const closed = lot.channel === 'auction' && !isAuctionOpen(lot, now)
  const last = myLastBid(lot.id)
  const independent = isSealedLot(lot, settings, now)
  const priceCtx = {
    independent,
    lastOwnAmount: last?.amount,
    lastOwnQty: last?.qty,
  }
  const minNext = minBidPrice(lot, priceCtx)
  const minQty = minBidQty(lot, last?.qty)
  const [qty, setQty] = useState(String(minQty))
  const [amount, setAmount] = useState(String(minNext))
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState<{ qty: number; unitPrice: number } | null>(null)
  const [takeAllOpen, setTakeAllOpen] = useState(false)

  // After a successful bid, put that qty/price back in the boxes (no refresh).
  useEffect(() => {
    if (!last) return
    setQty(String(last.qty))
    setAmount(String(last.amount))
  }, [lot.id, last?.at, last?.qty, last?.amount])

  function restoreQty() {
    setQty(String(last?.qty ?? minQty))
  }

  function restoreAmount() {
    setAmount(String(last?.amount ?? minNext))
  }

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
    const qtyErr = checkOrderQty(lot, q, copy, {
      lastOwnQty: last?.qty,
      lastOwnAmount: last?.amount,
      amount: p,
    })
    if (qtyErr) return qtyErr
    const priceErr = checkBidPrice(lot, p, copy, priceCtx)
    if (priceErr) return priceErr
    return { qty: q, unitPrice: p }
  }

  function afterBidOk(parsed: { qty: number; unitPrice: number }) {
    setQty(String(parsed.qty))
    setAmount(String(parsed.unitPrice))
    setMsg(null)
  }

  function onBid(e?: FormEvent) {
    e?.preventDefault()
    if (closed) return
    const parsed = parseEntry()
    if (typeof parsed === 'string') {
      setMsg(parsed)
      return
    }
    setMsg(null)
    if (!settings.features.confirmBid) {
      void placeBid(lot.id, parsed.unitPrice, parsed.qty).then((err) => {
        if (err) setMsg(err)
        else afterBidOk(parsed)
      })
      return
    }
    setPending(parsed)
  }

  function confirm() {
    if (!pending) return
    const pendingBid = pending
    setPending(null)
    void placeBid(lot.id, pendingBid.unitPrice, pendingBid.qty).then((err) => {
      if (err) setMsg(err)
      else afterBidOk(pendingBid)
    })
  }

  const showTools =
    settings.features.takeAll ||
    !closed ||
    (withWatch && settings.features.favourites)

  const liveQty = Number(qty)
  const livePrice = currentAmount()
  const feePct = feePctForLot(lot, settings)
  const liveQuote =
    !closed && Number.isFinite(liveQty) && liveQty > 0
      ? quoteMoney(liveQty, livePrice, feePct)
      : null

  return (
    <>
      <form className={`inline-bid ${stacked ? 'stacked' : ''}`} onSubmit={onBid}>
        <div className="inline-bid-entry">
          <label className="inline-field">
            <span>Qty · {moqLabel(lot, copy.noMoq)}</span>
            <input
              type="number"
              min={minQty}
              max={lot.qty}
              step={1}
              disabled={closed}
              value={closed ? '' : qty}
              placeholder={String(last?.qty ?? minQty)}
              aria-label={`Quantity for ${lot.id}`}
              onChange={(e) => {
                setQty(e.target.value)
                const q = Number(e.target.value)
                const p = currentAmount()
                if (e.target.value !== '' && Number.isFinite(q)) {
                  setMsg(
                    checkOrderQty(lot, q, copy, {
                      lastOwnQty: last?.qty,
                      lastOwnAmount: last?.amount,
                      amount: p,
                    }) || null,
                  )
                } else {
                  setMsg(null)
                }
              }}
              onBlur={() => {
                if (qty.trim() === '' || !Number.isFinite(Number(qty)) || Number(qty) < minQty) {
                  restoreQty()
                }
              }}
            />
          </label>
          <label className="inline-field">
            <span>Your price</span>
            <input
              type="number"
              min={minNext}
              step={1}
              disabled={closed}
              value={closed ? '' : amount}
              placeholder={String(last?.amount ?? minNext)}
              aria-label={`Unit price for ${lot.id}`}
              onChange={(e) => {
                setAmount(e.target.value)
                const n = Number(e.target.value)
                const q = Number(qty)
                if (e.target.value === '' || !Number.isFinite(n)) {
                  setMsg(null)
                  return
                }
                setMsg(
                  checkBidPrice(lot, n, copy, priceCtx) ||
                    (Number.isFinite(q)
                      ? checkOrderQty(lot, q, copy, {
                          lastOwnQty: last?.qty,
                          lastOwnAmount: last?.amount,
                          amount: n,
                        })
                      : null) ||
                    null,
                )
              }}
              onBlur={() => {
                if (
                  amount.trim() === '' ||
                  !Number.isFinite(Number(amount)) ||
                  Number(amount) < minNext
                ) {
                  restoreAmount()
                }
              }}
            />
          </label>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={closed || !settings.features.bidding}
          >
            {copy.btnBid}
          </button>
        </div>
        {liveQuote ? (
          <div className="muted tiny bid-cost-hint">
            Goods {usdCents(liveQuote.goods)}
            {liveQuote.feePct > 0
              ? ` · Fee ${liveQuote.feePct}% ${usdCents(liveQuote.fee)} · Est. ${usdCents(liveQuote.total)}`
              : ` · Est. ${usdCents(liveQuote.total)}`}
          </div>
        ) : null}
        {showTools ? (
          <div className="inline-bid-tools">
            {settings.features.takeAll ? (
              <button
                type="button"
                className="btn"
                disabled={closed}
                onClick={() => {
                  if (settings.features.confirmTakeAll) setTakeAllOpen(true)
                  else setQty(String(lot.qty))
                }}
              >
                {copy.btnTakeAll}
              </button>
            ) : null}
            {!closed && !independent ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={setHigh}
                aria-label={`Set price to high ${usd(lot.currentPrice)} for ${lot.id}`}
              >
                Current {usd(lot.currentPrice)}
              </button>
            ) : null}
            {!closed
              ? [1, 3, 5].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => bump(delta)}
                    aria-label={`Add ${usd(delta)} to price for ${lot.id}`}
                  >
                    +${delta}
                  </button>
                ))
              : null}
            {withWatch && settings.features.favourites ? <FavHeart lotId={lot.id} /> : null}
          </div>
        ) : null}
        {msg ? <span className="error tiny">{msg}</span> : null}
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
