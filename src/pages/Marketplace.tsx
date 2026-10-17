import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuctionTypeHead } from '../components/AuctionTypeHead'
import { readDeskCollapsed } from '../components/AuctionTable'
import { DeskIntro } from '../components/DeskIntro'
import { resolveDeskBannerSlides } from '../lib/deskBanner'
import {
  capacityOptions,
  CheckMenu,
  makerOptions,
  originFilterOptions,
  toggleValue,
} from '../components/CheckMenu'
import { isFilterUiTarget } from '../components/FilterPanel'
import { originLabel } from '../lib/auctionLists'
import { lotItemTitle } from '../lib/itemLine'
import { ItemLink } from '../components/ItemLink'
import { ConfirmBidDialog } from '../components/ConfirmBidDialog'
import { fillCopy, usd, usdCents } from '../lib/format'
import {
  STOCK_FILTER_LABEL,
  STOCK_FILTER_OPTIONS,
  isPubliclyListed,
  isSoldArchive,
  matchesStockFilter,
  sortStockLast,
  type StockFilter,
} from '../lib/stockFilter'
import { AskAboutItem } from '../components/AskAboutItem'
import {
  checkOfferPrice,
  checkOrderQty,
  minBidQty,
  minOfferPrice,
  moqLabel,
} from '../lib/moq'
import { feePctForLot, moneyForChannel, moneyForLot, quoteMoney } from '../lib/invoices'
import { useStore } from '../store'
import type { Grade, Lot } from '../types'

function MarketLot({ lot, asCard }: { lot: Lot; asCard?: boolean }) {
  const { addToCart, invoices, settings, cart, offers, user, placeOffer, confirmOffer } = useStore()
  const inCart = cart.find((c) => c.lotId === lot.id)?.qty ?? 0
  const left = Math.max(0, lot.qty - inCart)
  const soldOut = lot.qty < 1
  const lotMoney = moneyForLot(invoices, lot.id, settings)
  const lineTotal = (lot.buyNowPrice ?? lot.currentPrice) * lot.qty
  const [msg, setMsg] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [offerOpen, setOfferOpen] = useState(false)
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [working, setWorking] = useState<'buy' | 'offer' | null>(null)
  const price = lot.buyNowPrice ?? lot.currentPrice
  const mine = (offers || [])
    .filter((o) => o.lotId === lot.id && o.accountId === user?.accountId)
    .sort((a, b) => b.createdAt - a.createdAt)[0]
  const liveOffer = mine && (mine.status === 'pending' || mine.status === 'accepted') ? mine : null
  const pendingOffer = mine?.status === 'pending' ? mine : null
  const minQty = minBidQty(lot, pendingOffer?.qty)
  const listFloor = minOfferPrice(price, settings.offerFloorPct)
  /** Prefill list (or last pending). Super offer-floor % enforced on Offer click only. */
  const defaultOffer = pendingOffer?.unitPrice ?? price
  const [qty, setQty] = useState(String(minQty))
  const [offerPrice, setOfferPrice] = useState(String(defaultOffer))

  useEffect(() => {
    if (!pendingOffer) return
    setQty(String(pendingOffer.qty))
    setOfferPrice(String(pendingOffer.unitPrice))
  }, [lot.id, pendingOffer?.id, pendingOffer?.qty, pendingOffer?.unitPrice, pendingOffer?.createdAt])

  function restoreQty() {
    setQty(String(pendingOffer?.qty ?? minQty))
  }

  function restoreOfferPrice() {
    setOfferPrice(String(pendingOffer?.unitPrice ?? price))
  }

  function parsedQty(forOffer = false) {
    const q = Number(qty)
    const qtyErr = checkOrderQty(
      lot,
      q,
      settings.copy,
      forOffer
        ? {
            lastOwnQty: pendingOffer?.qty,
            lastOwnAmount: pendingOffer?.unitPrice,
            amount: Number(offerPrice),
          }
        : undefined,
    )
    if (qtyErr) return qtyErr
    return q
  }

  function add() {
    const q = parsedQty(false)
    if (typeof q === 'string') {
      setOk(false)
      setMsg(q)
      return
    }
    setConfirmOpen(true)
  }

  function commitAdd(q: number) {
    setConfirmOpen(false)
    setWorking('buy')
    void addToCart(lot.id, q).then((err) => {
      setWorking(null)
      if (err) {
        setOk(false)
        setMsg(err)
        return
      }
      setOk(true)
      setMsg(fillCopy(settings.copy.okAddedCart, { n: q }))
    })
  }

  function startOffer() {
    const q = parsedQty(true)
    const p = Number(offerPrice)
    if (typeof q === 'string') {
      setOk(false)
      setMsg(q)
      return
    }
    const priceErr = checkOfferPrice(
      price,
      p,
      settings.copy,
      pendingOffer?.unitPrice,
      settings.offerFloorPct,
    )
    if (priceErr) {
      setOk(false)
      setMsg(priceErr)
      return
    }
    setOfferOpen(true)
  }

  function commitOffer() {
    const q = parsedQty(true)
    const p = Number(offerPrice)
    setOfferOpen(false)
    if (typeof q === 'string') {
      setOk(false)
      setMsg(q)
      return
    }
    const priceErr = checkOfferPrice(
      price,
      p,
      settings.copy,
      pendingOffer?.unitPrice,
      settings.offerFloorPct,
    )
    if (priceErr) {
      setOk(false)
      setMsg(priceErr)
      return
    }
    setWorking('offer')
    void placeOffer(lot.id, q, p).then((err) => {
      setWorking(null)
      if (err) {
        setOk(false)
        setMsg(err)
        return
      }
      setQty(String(q))
      setOfferPrice(String(Math.round(p)))
      setOk(true)
      setMsg(settings.copy.okOffer)
    })
  }

  function commitAccepted() {
    if (!liveOffer) return
    setAcceptOpen(false)
    void confirmOffer(liveOffer.id).then((err) => {
      if (err) {
        setOk(false)
        setMsg(err)
        return
      }
      setOk(true)
      setMsg(settings.copy.okOfferInvoiced)
    })
  }

  const orderUi = soldOut ? (
    <div className={`inline-bid${asCard ? ' stacked' : ''}`}>
      <p className="tiny sold-row-note">Sold out</p>
      <AskAboutItem
        channel="marketplace"
        itemId={lot.id}
        itemTitle={lotItemTitle(lot)}
        itemHref={`/marketplace?q=${encodeURIComponent(lot.id)}`}
        className="btn btn-ghost btn-sm"
        label="Notify me"
        dialogTitle="Notify when back"
        presetMessage={`Please notify me when lot ${lot.id} (${lot.manufacturer} ${lot.model}) is available again.`}
      />
    </div>
  ) : (
    <div className={`inline-bid${asCard ? ' stacked' : ''}`}>
      <div className="inline-bid-row">
        <label className="inline-field">
          <span>Quantity</span>
          <input
            type="number"
            min={minQty}
            max={lot.qty}
            step={1}
            value={qty}
            placeholder={String(pendingOffer?.qty ?? minQty)}
            aria-label={`Quantity for ${lot.id}`}
            onChange={(e) => setQty(e.target.value)}
            onBlur={() => {
              if (qty.trim() === '' || !Number.isFinite(Number(qty)) || Number(qty) < minQty) {
                restoreQty()
              }
            }}
          />
        </label>
        <label className="inline-field">
          <span>Offer Price</span>
          <input
            type="number"
            min={listFloor}
            step={1}
            value={offerPrice}
            placeholder={String(pendingOffer?.unitPrice ?? price)}
            aria-label={`Offer price for ${lot.id}`}
            onChange={(e) => setOfferPrice(e.target.value)}
            onBlur={() => {
              // Only reset empty/garbage — never yank a typed lower price back to list.
              if (offerPrice.trim() === '' || !Number.isFinite(Number(offerPrice))) {
                restoreOfferPrice()
              }
            }}
          />
        </label>
        <div className="inline-bid-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={add}
            disabled={!settings.features.cart || working === 'buy'}
          >
            {working === 'buy' ? 'Adding…' : settings.copy.btnBuy}
          </button>
          <button
            type="button"
            className="btn"
            onClick={startOffer}
            disabled={!settings.features.offers || liveOffer?.status === 'accepted' || working === 'offer'}
          >
            {working === 'offer' ? 'Sending…' : settings.copy.btnOffer}
          </button>
          {liveOffer?.status === 'accepted' ? (
            <button type="button" className="btn btn-primary" onClick={() => setAcceptOpen(true)}>
              {settings.copy.btnConfirm}
            </button>
          ) : null}
        </div>
      </div>
      {(() => {
        const q = Number(qty)
        const offerP = Number(offerPrice)
        const feePct = feePctForLot(lot, settings)
        const buyQuote =
          Number.isFinite(q) && q > 0 ? quoteMoney(q, price, feePct) : null
        const offerQuote =
          Number.isFinite(q) && q > 0 && Number.isFinite(offerP) && offerP > 0
            ? quoteMoney(q, offerP, feePct)
            : null
        return buyQuote ? (
          <div className="muted tiny bid-cost-hint">
            Buy est. {usdCents(buyQuote.total)}
            {buyQuote.feePct > 0 ? ` (incl. ${buyQuote.feePct}% fee)` : ''}
            {offerQuote ? ` · Offer est. ${usdCents(offerQuote.total)}` : ''}
          </div>
        ) : null
      })()}
      {liveOffer ? (
        <div className="muted tiny">
          {liveOffer.status === 'pending'
            ? `Your offer ${liveOffer.qty.toLocaleString()} pcs × ${usd(liveOffer.unitPrice)} · pending`
            : `Accepted ${liveOffer.qty.toLocaleString()} pcs × ${usd(liveOffer.unitPrice)} — confirm invoice`}
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
          priceLabel="Current Price"
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
          priceLabel="Offer Price"
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
          priceLabel="Accepted Offer"
          onCancel={() => setAcceptOpen(false)}
          onConfirm={commitAccepted}
        />
      ) : null}
    </div>
  )

  if (asCard) {
    return (
      <article className={`auction-card${soldOut ? ' is-sold' : ''}`}>
        {soldOut ? <span className="sold-badge sold-badge-card">Sold out</span> : null}
        <ItemLink lot={lot} showMoq={false} showGrade={false} showLotId />
        <div className="auction-card-meta">
          <span className={`grade-inline grade-${lot.grade}`}>{lot.grade}</span>
          <div className="cell-stack lot-qty">
            <span className="cell-primary">{lot.qty.toLocaleString()}</span>
            <span className="cell-secondary">
              {soldOut
                ? 'Sold out'
                : `pcs · ${left.toLocaleString()} left${inCart ? ` · ${inCart} in cart` : ''}`}
            </span>
            <span className="cell-chip">{moqLabel(lot, settings.copy.noMoq)}</span>
          </div>
        </div>
        <div className="auction-card-prices">
          <div className="cell-stack">
            <span className="cell-secondary">Current Price</span>
            <span className="cell-primary">{usd(price)}</span>
            <span className="cell-secondary">/pc</span>
          </div>
          <div className="cell-stack">
            <span className="cell-secondary">Total amount</span>
            <span className="cell-primary">{usd(lineTotal)}</span>
          </div>
        </div>
        {orderUi}
      </article>
    )
  }

  return (
    <tr className={soldOut ? 'is-sold' : undefined}>
      <td className="item-col">
        <ItemLink lot={lot} showMoq={false} showGrade={false} showLotId />
        {soldOut ? <span className="sold-badge sold-badge-inline">Sold out</span> : null}
      </td>
      <td>
        <span className={`grade-inline grade-${lot.grade}`}>{lot.grade}</span>
      </td>
      <td className="lot-qty">
        <div className="cell-stack">
          <span className="cell-primary">{lot.qty.toLocaleString()}</span>
          <span className="cell-secondary">
            {soldOut
              ? 'Sold out'
              : `pcs · ${left.toLocaleString()} left${inCart ? ` · ${inCart} in cart` : ''}`}
          </span>
          <span className="cell-chip">{moqLabel(lot, settings.copy.noMoq)}</span>
        </div>
      </td>
      <td className="price-cell">
        <div className="cell-stack cell-stack-end">
          <span className="cell-primary">{usd(price)}</span>
          <span className="cell-secondary">/pc</span>
        </div>
      </td>
      <td className="price-cell">
        <div className="cell-stack cell-stack-end">
          <span className="cell-primary">{usd(lineTotal)}</span>
          <span className="cell-secondary">
            {lot.qty} pcs × {usd(price)}
          </span>
        </div>
      </td>
      <td className="price-cell">
        {lotMoney.paid ? usd(lotMoney.paid) : <span className="muted">—</span>}
      </td>
      <td className="price-cell">
        {lotMoney.unpaid ? usd(lotMoney.unpaid) : <span className="muted">—</span>}
      </td>
      <td>{orderUi}</td>
    </tr>
  )
}

const MARKET_DESK_KEY = 'equarios-market-desk-hidden'

export function Marketplace() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const { lots, cart, cartOrders, invoices, settings, offers, user } = useStore()
  const GRADES = settings.grades
  const invoiceMoney = moneyForChannel(invoices, lots, 'marketplace', settings)
  const [grades, setGrades] = useState<Grade[]>([])
  const [makers, setMakers] = useState<string[]>([])
  const [memories, setMemories] = useState<string[]>([])
  const [origins, setOrigins] = useState<string[]>([])
  const [stock, setStock] = useState<StockFilter[]>(['available'])
  const [open, setOpen] = useState<'maker' | 'grade' | 'memory' | 'origin' | 'stock' | null>(null)
  const [deskCollapsed, setDeskCollapsed] = useState(() => readDeskCollapsed(MARKET_DESK_KEY))
  const filtersRef = useRef<HTMLDivElement>(null)
  function toggleDesk() {
    setDeskCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(MARKET_DESK_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--auction-desk-h', '0px')
    return () => {
      document.documentElement.style.removeProperty('--auction-desk-h')
    }
  }, [])
  const marketLots = useMemo(() => lots.filter((l) => l.channel === 'marketplace'), [lots])
  const makersList = useMemo(() => makerOptions(marketLots), [marketLots])
  const capacities = useMemo(() => capacityOptions(marketLots), [marketLots])
  const originsList = useMemo(() => originFilterOptions(marketLots), [marketLots])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!isFilterUiTarget(e.target, filtersRef.current)) setOpen(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const rows = useMemo(() => {
    const now = Date.now()
    const list = lots.filter((l) => {
      if (l.channel !== 'marketplace') return false
      const inStock = l.qty > 0
      // Marketplace has no soldOutAt — use endsAt as age anchor when sold.
      if (!isPubliclyListed(inStock, l.endsAt, now)) return false
      if (!matchesStockFilter(inStock, stock)) return false
      if (grades.length && !grades.includes(l.grade)) return false
      if (makers.length && !makers.includes(l.manufacturer)) return false
      if (memories.length && !memories.includes(l.capacity)) return false
      if (origins.length && !origins.includes(originLabel(l.origin))) return false
      const hay = `${l.id} ${l.manufacturer} ${l.model} ${l.modelNumber} ${l.capacity} ${l.color} ${l.origin || ''}`.toLowerCase()
      return hay.includes(q.toLowerCase())
    })
    return sortStockLast(list, (l) => l.qty > 0)
  }, [lots, q, grades, makers, memories, origins, stock])

  const soldArchive = useMemo(() => {
    const now = Date.now()
    return lots
      .filter((l) => l.channel === 'marketplace' && isSoldArchive(l.qty > 0, l.endsAt, now))
      .sort((a, b) => b.endsAt - a.endsAt)
  }, [lots])

  const openCartOrders = (cartOrders || []).filter(
    (o) =>
      o.accountId === user?.accountId &&
      (o.status === 'pending' || o.status === 'accepted'),
  ).length
  const cartCount = cart.length + openCartOrders
  const myOffers = (offers || []).filter(
    (o) =>
      o.accountId === user?.accountId &&
      (o.status === 'pending' || o.status === 'accepted'),
  ).length

  return (
    <div className="market-page is-command-bar desk-page">
      <DeskIntro
        brand={settings.brandName || 'eQuarios'}
        slides={resolveDeskBannerSlides(settings, 'marketplace')}
        intervalSec={settings.pages?.heroIntervalSec}
        veil="trade"
        label="Marketplace"
      />
      {!deskCollapsed ? (
        <div className="auction-desk is-scrollaway">
          <div className="auction-desk-filters">
            <div className="filters filters-no-search" ref={filtersRef}>
              <div className="filter-groups market-filters">
                <CheckMenu
                  title="Stock"
                  open={open === 'stock'}
                  onOpen={() => setOpen((v) => (v === 'stock' ? null : 'stock'))}
                  options={STOCK_FILTER_OPTIONS}
                  selected={stock}
                  labelFor={(v) => STOCK_FILTER_LABEL[v]}
                  onToggle={(value) =>
                    startTransition(() => setStock((prev) => toggleValue(prev, value)))
                  }
                />
                {settings.filters.maker ? (
                  <CheckMenu
                    title="Maker"
                    open={open === 'maker'}
                    onOpen={() => setOpen((v) => (v === 'maker' ? null : 'maker'))}
                    options={makersList}
                    selected={makers}
                    onToggle={(value) =>
                      startTransition(() => setMakers((prev) => toggleValue(prev, value)))
                    }
                  />
                ) : null}
                {settings.filters.grade ? (
                  <CheckMenu
                    title="Grade"
                    open={open === 'grade'}
                    onOpen={() => setOpen((v) => (v === 'grade' ? null : 'grade'))}
                    options={GRADES}
                    selected={grades}
                    onToggle={(value) =>
                      startTransition(() => setGrades((prev) => toggleValue(prev, value)))
                    }
                  />
                ) : null}
                {settings.filters.capacity ? (
                  <CheckMenu
                    title="Capacity"
                    open={open === 'memory'}
                    onOpen={() => setOpen((v) => (v === 'memory' ? null : 'memory'))}
                    options={capacities}
                    selected={memories}
                    onToggle={(value) =>
                      startTransition(() => setMemories((prev) => toggleValue(prev, value)))
                    }
                  />
                ) : null}
                {settings.filters.origin ? (
                  <CheckMenu
                    title="Origin"
                    open={open === 'origin'}
                    onOpen={() => setOpen((v) => (v === 'origin' ? null : 'origin'))}
                    options={originsList}
                    selected={origins}
                    onToggle={(value) =>
                      startTransition(() => setOrigins((prev) => toggleValue(prev, value)))
                    }
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <section className="auction-type-block is-solo market-listings">
        <AuctionTypeHead>
          <div className="auction-command">
            <h2>
              Listings
              <em>{rows.length}</em>
            </h2>
            {cartCount ? (
              <Link to="/account/marketplace-history#cart" className="auction-command-link is-yours">
                Cart {cartCount}
              </Link>
            ) : null}
            {myOffers > 0 ? (
              <Link to="/account/marketplace-history#offers" className="auction-command-link is-open">
                Offers {myOffers}
              </Link>
            ) : null}
            <span className="auction-command-stat is-money" title="Paid + unpaid">
              Total {usd(invoiceMoney.total)}
            </span>
            <span className="auction-command-stat is-win" title={`${invoiceMoney.paidCount} paid`}>
              Paid {usd(invoiceMoney.paid)}
            </span>
            <span
              className="auction-command-stat is-lose"
              title={`${invoiceMoney.unpaidCount} unpaid`}
            >
              Unpaid {usd(invoiceMoney.unpaid)}
            </span>
          </div>
          <div className="auction-type-head-tools">
            {deskCollapsed ? (
              <p className="muted tiny auction-type-head-recap">Filters hidden</p>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost btn-sm auction-desk-chip-hide"
              onClick={toggleDesk}
              aria-label={
                deskCollapsed ? 'Show search filters' : 'Hide search filters'
              }
              title={deskCollapsed ? 'Show' : 'Hide'}
            >
              {deskCollapsed ? '+' : '−'}
            </button>
          </div>
        </AuctionTypeHead>
        {rows.length ? (
          <>
            <div className="table-wrap auction-table-wrap">
              <table className="auction-table">
                <thead>
                  <tr>
                    <th>Items</th>
                    <th>Grade</th>
                    <th>Quantity</th>
                    <th>Current Price</th>
                    <th>Total amount</th>
                    <th>Paid</th>
                    <th>Unpaid</th>
                    <th>Order</th>
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
          </>
        ) : (
          <div className="mh-empty">
            <p>{marketLots.length ? settings.copy.emptyFilters : settings.copy.emptyMarket}</p>
          </div>
        )}
        {soldArchive.length ? (
          <details className="sold-archive">
            <summary>
              Recently sold <em>{soldArchive.length}</em>
            </summary>
            <p className="muted tiny">Off the shop after 14 days. Kept here for 180 days.</p>
            <div className="auction-cards market-cards" aria-label="Recently sold lots">
              {soldArchive.map((lot) => (
                <MarketLot key={lot.id} lot={lot} asCard />
              ))}
            </div>
          </details>
        ) : null}
      </section>
    </div>
  )
}
