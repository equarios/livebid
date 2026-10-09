import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuctionTypeHead } from '../components/AuctionTypeHead'
import {
  capacityOptions,
  CheckMenu,
  makerOptions,
  toggleValue,
} from '../components/CheckMenu'
import { InvoiceSummary } from '../components/InvoiceSummary'
import { ItemLink } from '../components/ItemLink'
import { ConfirmBidDialog } from '../components/ConfirmBidDialog'
import { OfferDesk } from '../components/OfferDesk'
import { fillCopy, usd } from '../lib/format'
import { checkOrderQty, lotMoq, moqLabel } from '../lib/moq'
import { moneyForChannel, moneyForLot } from '../lib/invoices'
import { useStore } from '../store'
import type { Grade, Lot } from '../types'

function MarketLot({ lot, asCard }: { lot: Lot; asCard?: boolean }) {
  const { addToCart, invoices, settings, cart, offers, user, placeOffer, confirmOffer } = useStore()
  const inCart = cart.find((c) => c.lotId === lot.id)?.qty ?? 0
  const left = Math.max(0, lot.qty - inCart)
  const lotMoney = moneyForLot(invoices, lot.id, settings)
  const lineTotal = (lot.buyNowPrice ?? lot.currentPrice) * lot.qty
  const [qty, setQty] = useState(String(lotMoq(lot)))
  const [msg, setMsg] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [offerOpen, setOfferOpen] = useState(false)
  const [acceptOpen, setAcceptOpen] = useState(false)
  const price = lot.buyNowPrice ?? lot.currentPrice
  const [offerPrice, setOfferPrice] = useState(String(Math.max(1, price - 1)))
  const mine = (offers || [])
    .filter((o) => o.lotId === lot.id && o.accountId === user?.accountId)
    .sort((a, b) => b.createdAt - a.createdAt)[0]
  const liveOffer = mine && (mine.status === 'pending' || mine.status === 'accepted') ? mine : null

  function parsedQty() {
    const q = Number(qty)
    const qtyErr = checkOrderQty(lot, q, settings.copy)
    if (qtyErr) return qtyErr
    return q
  }

  function add() {
    const q = parsedQty()
    if (typeof q === 'string') {
      setOk(false)
      setMsg(q)
      return
    }
    setConfirmOpen(true)
  }

  function commitAdd(q: number) {
    const err = addToCart(lot.id, q)
    setConfirmOpen(false)
    if (err) {
      setOk(false)
      setMsg(err)
      return
    }
    setOk(true)
    setMsg(fillCopy(settings.copy.okAddedCart, { n: q }))
  }

  function startOffer() {
    const q = parsedQty()
    if (typeof q === 'string') {
      setOk(false)
      setMsg(q)
      return
    }
    setOfferOpen(true)
  }

  function commitOffer() {
    const q = parsedQty()
    const p = Number(offerPrice)
    setOfferOpen(false)
    if (typeof q === 'string') {
      setOk(false)
      setMsg(q)
      return
    }
    const err = placeOffer(lot.id, q, p)
    if (err) {
      setOk(false)
      setMsg(err)
      return
    }
    setOk(true)
    setMsg(settings.copy.okOffer)
  }

  function commitAccepted() {
    if (!liveOffer) return
    const err = confirmOffer(liveOffer.id)
    setAcceptOpen(false)
    if (err) {
      setOk(false)
      setMsg(err)
      return
    }
    setOk(true)
    setMsg(settings.copy.okOfferInvoiced)
  }

  const fields = (
    <div className="market-lot-fields">
      <label className="inline-field">
        <span>Desired qty</span>
        <input
          className="qty-input"
          type="number"
          min={lotMoq(lot)}
          max={lot.qty}
          step={1}
          value={qty}
          aria-label={`Desired qty for ${lot.id}`}
          onChange={(e) => setQty(e.target.value)}
        />
      </label>
      <label className="inline-field">
        <span>Offer / pc</span>
        <input
          className="qty-input"
          type="number"
          min={1}
          max={price - 1}
          step={1}
          value={offerPrice}
          aria-label={`Offer price for ${lot.id}`}
          onChange={(e) => setOfferPrice(e.target.value)}
        />
      </label>
    </div>
  )

  const actions = (
    <>
      <div className="offer-row-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={add}
          disabled={!settings.features.cart}
        >
          {settings.copy.btnBuy}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={startOffer}
          disabled={!settings.features.offers || liveOffer?.status === 'accepted'}
        >
          {settings.copy.btnOffer}
        </button>
        {liveOffer?.status === 'accepted' ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAcceptOpen(true)}>
            {settings.copy.btnConfirm}
          </button>
        ) : null}
      </div>
      {liveOffer ? (
        <div className="muted tiny">
          {liveOffer.status === 'pending'
            ? `Offer ${usd(liveOffer.unitPrice)} pending review`
            : `Accepted ${usd(liveOffer.unitPrice)} — confirm invoice`}
        </div>
      ) : null}
      {msg ? <div className={ok ? 'ok tiny' : 'error tiny'}>{msg}</div> : null}
      {confirmOpen ? (
        <ConfirmBidDialog
          lot={lot}
          qty={Number(qty)}
          unitPrice={price}
          title={settings.copy.confirmCartTitle}
          body={fillCopy(settings.copy.confirmCartBody, { n: Number(qty) })}
          priceLabel="List price / pc"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => commitAdd(Number(qty))}
        />
      ) : null}
      {offerOpen ? (
        <ConfirmBidDialog
          lot={lot}
          qty={Number(qty)}
          unitPrice={Number(offerPrice)}
          title={settings.copy.confirmOfferTitle}
          body={settings.copy.confirmOfferBody}
          priceLabel="Your offer / pc"
          onCancel={() => setOfferOpen(false)}
          onConfirm={commitOffer}
        />
      ) : null}
      {acceptOpen && liveOffer ? (
        <ConfirmBidDialog
          lot={lot}
          qty={liveOffer.qty}
          unitPrice={liveOffer.unitPrice}
          title={settings.copy.confirmAcceptOfferTitle}
          body={settings.copy.confirmAcceptOfferBody}
          priceLabel="Accepted offer / pc"
          onCancel={() => setAcceptOpen(false)}
          onConfirm={commitAccepted}
        />
      ) : null}
    </>
  )

  if (asCard) {
    return (
      <article className="auction-card">
        <ItemLink lot={lot} showMoq={false} showGrade={false} />
        <div className="auction-card-meta">
          <span className={`grade-inline grade-${lot.grade}`}>{lot.grade}</span>
          <span>
            {lot.qty.toLocaleString()} pcs · {left.toLocaleString()} left
            <span className="muted"> · {moqLabel(lot, settings.copy.noMoq)}</span>
          </span>
        </div>
        <div className="auction-card-prices">
          <span>
            List / pc <strong>{usd(price)}</strong>
          </span>
          <span>
            Total <strong>{usd(lineTotal)}</strong>
          </span>
        </div>
        {fields}
        {actions}
      </article>
    )
  }

  return (
    <tr>
      <td className="mono">{lot.id}</td>
      <td>
        <ItemLink lot={lot} showMoq={false} showGrade={false} />
      </td>
      <td>
        <span className={`grade-inline grade-${lot.grade}`}>{lot.grade}</span>
      </td>
      <td>
        {lot.qty.toLocaleString()}
        <div className="muted tiny">
          {left.toLocaleString()} left{inCart ? ` · ${inCart} in cart` : ''}
        </div>
        <div className="muted tiny">{moqLabel(lot, settings.copy.noMoq)}</div>
      </td>
      <td className="price-cell">{usd(price)}</td>
      <td className="price-cell">
        {usd(lineTotal)}
        <div className="muted tiny">
          {lot.qty} pcs × {usd(price)}
        </div>
      </td>
      <td className="price-cell">
        {lotMoney.paid ? usd(lotMoney.paid) : <span className="muted">—</span>}
      </td>
      <td className="price-cell">
        {lotMoney.unpaid ? usd(lotMoney.unpaid) : <span className="muted">—</span>}
      </td>
      <td>{fields}</td>
      <td>{actions}</td>
    </tr>
  )
}

export function Marketplace() {
  const navigate = useNavigate()
  const { lots, cart, removeFromCart, checkoutCart, invoices, settings } = useStore()
  const GRADES = settings.grades
  const invoiceMoney = moneyForChannel(invoices, lots, 'marketplace', settings)
  const [q, setQ] = useState('')
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [grades, setGrades] = useState<Grade[]>([])
  const [makers, setMakers] = useState<string[]>([])
  const [memories, setMemories] = useState<string[]>([])
  const [open, setOpen] = useState<'maker' | 'grade' | 'memory' | null>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
  const deskRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = deskRef.current
    if (!el) return
    const apply = () => {
      document.documentElement.style.setProperty('--auction-desk-h', `${Math.round(el.getBoundingClientRect().height)}px`)
    }
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    apply()
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty('--auction-desk-h')
    }
  }, [])
  const marketLots = useMemo(() => lots.filter((l) => l.channel === 'marketplace'), [lots])
  const makersList = useMemo(() => makerOptions(marketLots), [marketLots])
  const capacities = useMemo(() => capacityOptions(marketLots), [marketLots])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!filtersRef.current?.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const rows = useMemo(
    () =>
      lots.filter((l) => {
        if (l.channel !== 'marketplace') return false
        if (grades.length && !grades.includes(l.grade)) return false
        if (makers.length && !makers.includes(l.manufacturer)) return false
        if (memories.length && !memories.includes(l.capacity)) return false
        const hay = `${l.id} ${l.manufacturer} ${l.model} ${l.modelNumber} ${l.capacity} ${l.color}`.toLowerCase()
        return hay.includes(q.toLowerCase())
      }),
    [lots, q, grades, makers, memories],
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
    if (err) {
      setNotice({ ok: false, text: err })
      return
    }
    navigate('/account/invoices')
  }

  return (
    <div>
      <div ref={deskRef} className="auction-desk">
        <div className="auction-desk-head">
          <div>
            <strong>{settings.copy.marketTitle}</strong>
          </div>
        </div>
        <div className="auction-desk-filters">
      <div className="filters" ref={filtersRef}>
        <input
          placeholder={settings.copy.searchMarket}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="filter-groups market-filters">
          {settings.filters.maker ? (
          <CheckMenu
            title="Maker"
            open={open === 'maker'}
            onOpen={() => setOpen((v) => (v === 'maker' ? null : 'maker'))}
            options={makersList}
            selected={makers}
            onToggle={(value) => setMakers((prev) => toggleValue(prev, value))}
          />
          ) : null}
          {settings.filters.grade ? (
          <CheckMenu
            title="Grade"
            open={open === 'grade'}
            onOpen={() => setOpen((v) => (v === 'grade' ? null : 'grade'))}
            options={GRADES}
            selected={grades}
            onToggle={(value) => setGrades((prev) => toggleValue(prev, value))}
          />
          ) : null}
          {settings.filters.capacity ? (
          <CheckMenu
            title="Capacity"
            open={open === 'memory'}
            onOpen={() => setOpen((v) => (v === 'memory' ? null : 'memory'))}
            options={capacities}
            selected={memories}
            onToggle={(value) => setMemories((prev) => toggleValue(prev, value))}
          />
          ) : null}
        </div>
      </div>
        </div>
        <InvoiceSummary
          total={invoiceMoney.total}
          paid={invoiceMoney.paid}
          unpaid={invoiceMoney.unpaid}
          paidCount={invoiceMoney.paidCount}
          unpaidCount={invoiceMoney.unpaidCount}
        />
      </div>
      {rows.length ? (
        <section className="auction-type-block">
          <AuctionTypeHead>
            <div>
              <h2>
                {settings.copy.marketTitle}
                <em>{rows.length}</em>
              </h2>
              <p className="muted tiny auction-type-block-intro">{settings.copy.marketIntro}</p>
            </div>
          </AuctionTypeHead>
          <div className="table-wrap card auction-table-wrap">
            <table className="auction-table">
              <thead>
                <tr>
                  <th>Lot</th>
                  <th>Item</th>
                  <th>Grade</th>
                  <th>Total pcs</th>
                  <th>Price / pc</th>
                  <th>Total amount</th>
                  <th>Paid</th>
                  <th>Unpaid</th>
                  <th>Order</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((lot) => (
                  <MarketLot key={lot.id} lot={lot} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="auction-cards market-cards" aria-label="Marketplace lots">
            {rows.map((lot) => (
              <MarketLot key={lot.id} lot={lot} asCard />
            ))}
          </div>
        </section>
      ) : (
        <p className="empty">
          {marketLots.length ? settings.copy.emptyFilters : settings.copy.emptyMarket}
        </p>
      )}

      <div className="cart-panel card">
        <h2>My offers</h2>
        <OfferDesk />
      </div>
      <div className="cart-panel card">
        <h2>
          {settings.copy.cartTitle}
          {cartRows.length ? ` (${cartRows.length})` : ''}
        </h2>
        {!cartRows.length ? (
          <p className="muted">{settings.copy.emptyCart}</p>
        ) : (
          <>
            <div className="table-wrap cart-table-wrap">
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
                      <ItemLink lot={lot} showMoq={false} showGrade={false} />
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
                        {settings.copy.btnRemove}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="auction-cards cart-cards">
              {cartRows.map(({ item, lot, total }) => (
                <article key={item.lotId} className="auction-card">
                  <ItemLink lot={lot} showMoq={false} showGrade={false} />
                  <div className="auction-card-meta">
                    <span className={`grade-inline grade-${lot.grade}`}>{lot.grade}</span>
                    <span>{item.qty} pcs</span>
                    <span>{usd(lot.buyNowPrice ?? 0)} / pc</span>
                    <span>
                      Total <strong>{usd(total)}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeFromCart(item.lotId)}
                  >
                    {settings.copy.btnRemove}
                  </button>
                </article>
              ))}
            </div>
            <div className="cart-foot">
              <strong>Total {usd(cartTotal)}</strong>
              <button type="button" className="btn btn-primary" onClick={checkout}>
                {settings.copy.btnCheckout}
              </button>
            </div>
          </>
        )}
        {notice ? <p className={notice.ok ? 'ok' : 'error'}>{notice.text}</p> : null}
      </div>
    </div>
  )
}
