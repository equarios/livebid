import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  capacityOptions,
  CheckMenu,
  makerOptions,
  toggleValue,
} from '../components/CheckMenu'
import { InvoiceSummary } from '../components/InvoiceSummary'
import { ItemLink } from '../components/ItemLink'
import { clampRange, PriceMenu, priceBounds } from '../components/PriceRangeBar'
import { ConfirmBidDialog } from '../components/ConfirmBidDialog'
import { fillCopy, usd } from '../lib/format'
import { lotMoq, moqLabel } from '../lib/moq'
import { moneyForChannel, moneyForLot } from '../lib/invoices'
import { useStore } from '../store'
import type { Grade, Lot } from '../types'

function MarketRow({ lot }: { lot: Lot }) {
  const { addToCart, invoices, settings, cart } = useStore()
  const inCart = cart.find((c) => c.lotId === lot.id)?.qty ?? 0
  const left = Math.max(0, lot.qty - inCart)
  const lotMoney = moneyForLot(invoices, lot.id)
  const lineTotal = (lot.buyNowPrice ?? lot.currentPrice) * lot.qty
  const [qty, setQty] = useState(String(lotMoq(lot)))
  const [msg, setMsg] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const price = lot.buyNowPrice ?? lot.currentPrice

  function add() {
    const q = Number(qty)
    if (!Number.isInteger(q) || q < 1) {
      setOk(false)
      setMsg(settings.copy.warnQty)
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

  return (
    <tr>
      <td className="mono">{lot.id}</td>
      <td>
        <ItemLink lot={lot} />
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
      <td>
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
      </td>
      <td>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={add}
          disabled={!settings.features.cart}
        >
          {settings.copy.btnAddCart}
        </button>
        {msg ? <div className={ok ? 'ok tiny' : 'error tiny'}>{msg}</div> : null}
        {confirmOpen ? (
          <ConfirmBidDialog
            lot={lot}
            qty={Number(qty)}
            unitPrice={price}
            title={settings.copy.confirmCartTitle}
            body={settings.copy.confirmCartBody}
            priceLabel="Price / pc"
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => commitAdd(Number(qty))}
          />
        ) : null}
      </td>
    </tr>
  )
}

export function Marketplace() {
  const navigate = useNavigate()
  const { lots, cart, removeFromCart, checkoutCart, invoices, settings } = useStore()
  const GRADES = settings.grades
  const invoiceMoney = moneyForChannel(invoices, lots, 'marketplace')
  const [q, setQ] = useState('')
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [grades, setGrades] = useState<Grade[]>([])
  const [makers, setMakers] = useState<string[]>([])
  const [memories, setMemories] = useState<string[]>([])
  const [open, setOpen] = useState<'maker' | 'grade' | 'memory' | 'price' | null>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
  const marketLots = useMemo(() => lots.filter((l) => l.channel === 'marketplace'), [lots])
  const makersList = useMemo(() => makerOptions(marketLots), [marketLots])
  const capacities = useMemo(() => capacityOptions(marketLots), [marketLots])
  const bounds = useMemo(
    () => priceBounds(marketLots.map((l) => l.buyNowPrice ?? l.currentPrice)),
    [marketLots],
  )
  const [lo, setLo] = useState(bounds.min)
  const [hi, setHi] = useState(bounds.max)
  const range = clampRange(lo, hi, bounds.min, bounds.max)

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
        const price = l.buyNowPrice ?? l.currentPrice
        if (price < range.lo || price > range.hi) return false
        const hay = `${l.id} ${l.manufacturer} ${l.model} ${l.modelNumber} ${l.capacity} ${l.color}`.toLowerCase()
        return hay.includes(q.toLowerCase())
      }),
    [lots, q, grades, makers, memories, range.lo, range.hi],
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
      <div className="page-head">
        <div>
          <h1>{settings.copy.marketTitle}</h1>
          <p className="muted">{settings.copy.marketIntro}</p>
        </div>
      </div>
      <InvoiceSummary
        total={invoiceMoney.total}
        paid={invoiceMoney.paid}
        unpaid={invoiceMoney.unpaid}
        paidCount={invoiceMoney.paidCount}
        unpaidCount={invoiceMoney.unpaidCount}
      />
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
          {settings.filters.price ? (
          <PriceMenu
            min={bounds.min}
            max={bounds.max}
            lo={range.lo}
            hi={range.hi}
            open={open === 'price'}
            onOpen={() => setOpen((v) => (v === 'price' ? null : 'price'))}
            onChange={(nextLo, nextHi) => {
              setLo(nextLo)
              setHi(nextHi)
            }}
          />
          ) : null}
        </div>
      </div>
      {rows.length ? (
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
        <p className="empty">
          {marketLots.length ? settings.copy.emptyFilters : settings.copy.emptyMarket}
        </p>
      )}

      <div className="cart-panel card">
        <h2>
          {settings.copy.cartTitle}
          {cartRows.length ? ` (${cartRows.length})` : ''}
        </h2>
        {!cartRows.length ? (
          <p className="muted">{settings.copy.emptyCart}</p>
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
                      <ItemLink lot={lot} />
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
