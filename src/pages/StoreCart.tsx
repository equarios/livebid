import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { StoreConditionBadges } from '../components/StoreConditionBadges'
import { StoreWholesaleHandoff } from '../components/StoreWholesaleHandoff'
import { StoreRail } from '../components/StoreRail'
import { StoreBlockSkeleton } from '../components/StoreSkeleton'
import { api, type StoreProductDto } from '../lib/api'
import { usd } from '../lib/format'
import {
  DEFAULT_FULFILLMENT,
  FULFILLMENT_LABELS,
  earliestPickupDate,
  formatShippingMoney,
  resolveClientShippingQuote,
  shippingFeeHint,
} from '../lib/fulfillment'
import { storeProductHeadline } from '../lib/storeBrand'
import { useStoreFx } from '../lib/storeFx'
import { storeProductFallback, storeProductImage } from '../lib/storePhotos'
import {
  clearStoreCart,
  pruneStoreCart,
  readStoreCart,
  replaceStoreCartProduct,
  setStoreCartQty,
  storeCartCount,
  type StoreCartLine,
} from '../lib/storeCart'
import { storeVariantOptions, type VariantOption } from '../lib/storeVariants'
import {
  storeCartUpdated,
  storeOrderError,
  storeOrderPlaced,
  storeRemovedFromCart,
} from '../lib/storeFeedback'
import {
  applyTradeInCap,
  clearTradeInPending,
  readTradeInPending,
  subscribeTradeIn,
  type TradeInPending,
} from '../lib/tradeIn'
import { useStore } from '../store'
import type { FulfillmentMode, FulfillmentSettings } from '../types'

type PayMethod = 'card' | 'paypal' | 'bank' | 'usdt' | 'cash'

type StoreFulfillmentPublic = {
  modes: FulfillmentMode[]
  defaultMode: FulfillmentMode
  deliveryFeeFlat: number
  freeDeliveryMin: number
  deliveryPayer: FulfillmentSettings['deliveryPayer']
  pickupLabel: string
  pickupHours: string
  courierHints: string
  pickupSlots?: string[]
  pickupLeadDays?: number
  pickupSlotCap?: number
  earliestPickupDate?: string
}

type SlotOcc = {
  slot: string
  booked: number
  cap: number
  remaining: number | null
  full: boolean
}

function toSettings(p: StoreFulfillmentPublic): FulfillmentSettings {
  return {
    ...DEFAULT_FULFILLMENT,
    storeModes: p.modes,
    wholesaleModes: DEFAULT_FULFILLMENT.wholesaleModes,
    defaultStoreMode: p.defaultMode,
    deliveryFeeFlat: p.deliveryFeeFlat,
    freeDeliveryMin: p.freeDeliveryMin,
    deliveryPayer: p.deliveryPayer,
    pickupLabel: p.pickupLabel,
    pickupHours: p.pickupHours,
    courierHints: p.courierHints,
    pickupSlots: p.pickupSlots?.length ? p.pickupSlots : DEFAULT_FULFILLMENT.pickupSlots,
    pickupLeadDays: p.pickupLeadDays ?? DEFAULT_FULFILLMENT.pickupLeadDays,
    pickupSlotCap: p.pickupSlotCap ?? DEFAULT_FULFILLMENT.pickupSlotCap,
  }
}

/** Qty stepper — empty while typing OK; blur clamps to 1..max; never auto-removes. */
function CartQtyStepper({
  productId,
  qty,
  max,
  onChange,
}: {
  productId: string
  qty: number
  max: number
  onChange: (next: number) => void
}) {
  const cap = Math.max(1, max)
  const [draft, setDraft] = useState(String(qty))

  useEffect(() => {
    setDraft(String(qty))
  }, [qty, productId])

  function commit(raw: string) {
    const n = Math.floor(Number(raw))
    const next = !Number.isFinite(n) || n < 1 ? 1 : Math.min(cap, n)
    setDraft(String(next))
    if (next !== qty) onChange(next)
  }

  function bump(delta: number) {
    const next = Math.min(cap, Math.max(1, qty + delta))
    setDraft(String(next))
    if (next !== qty) onChange(next)
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }

  return (
    <div className="store-cart-stepper" role="group" aria-label="Quantity">
      <button
        type="button"
        className="store-cart-step"
        aria-label="Decrease quantity"
        disabled={qty <= 1}
        onClick={() => bump(-1)}
      >
        −
      </button>
      <input
        className="store-cart-step-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        aria-label="Quantity"
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={() => commit(draft)}
        onKeyDown={onKey}
      />
      <button
        type="button"
        className="store-cart-step"
        aria-label="Increase quantity"
        disabled={qty >= cap}
        onClick={() => bump(1)}
      >
        +
      </button>
    </div>
  )
}

export function StoreCart() {
  const { settings, user } = useStore()
  const { money, currency } = useStoreFx()
  const navigate = useNavigate()
  const [lines, setLines] = useState<StoreCartLine[]>(() => readStoreCart())
  const [tradeIn, setTradeIn] = useState<TradeInPending | null>(() => readTradeInPending())
  const [products, setProducts] = useState<StoreProductDto[]>([])
  const [catalogReady, setCatalogReady] = useState(false)
  const [email, setEmail] = useState(user?.email || '')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [pay, setPay] = useState<PayMethod>('card')
  const [fulfillment, setFulfillment] = useState<StoreFulfillmentPublic | null>(null)
  const [mode, setMode] = useState<FulfillmentMode>('delivery')
  const [courierCarrier, setCourierCarrier] = useState('FedEx')
  const [courierAccount, setCourierAccount] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [pickupSlot, setPickupSlot] = useState('')
  const [slotOcc, setSlotOcc] = useState<SlotOcc[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [catalogErr, setCatalogErr] = useState<string | null>(null)
  const [catalogTick, setCatalogTick] = useState(0)

  useEffect(() => {
    const sync = () => setLines(readStoreCart())
    window.addEventListener('livebid-store-cart', sync)
    return () => window.removeEventListener('livebid-store-cart', sync)
  }, [])

  useEffect(() => subscribeTradeIn(() => setTradeIn(readTradeInPending())), [])

  useEffect(() => {
    let alive = true
    void api
      .storeFulfillment()
      .then(async (res) => {
        if (!alive) return
        setFulfillment(res.fulfillment)
        const slots = res.fulfillment.pickupSlots || DEFAULT_FULFILLMENT.pickupSlots
        setPickupSlot(slots[0] || '')
        setPickupDate(
          res.fulfillment.earliestPickupDate ||
            earliestPickupDate({
              ...DEFAULT_FULFILLMENT,
              pickupLeadDays: res.fulfillment.pickupLeadDays ?? 0,
            }),
        )
        let nextMode = res.fulfillment.defaultMode
        if (user) {
          try {
            const log = await api.getLogistics()
            if (
              log.logistics.preferredFulfillmentMode &&
              res.fulfillment.modes.includes(log.logistics.preferredFulfillmentMode)
            ) {
              nextMode = log.logistics.preferredFulfillmentMode
              if (log.logistics.courierCarrier) setCourierCarrier(log.logistics.courierCarrier)
              if (log.logistics.courierAccount) setCourierAccount(log.logistics.courierAccount)
              if (log.logistics.address) setAddress(log.logistics.address)
            }
          } catch {
            /* keep store default */
          }
        }
        setMode(nextMode)
      })
      .catch(() => {
        if (!alive) return
        const fallback = settings.fulfillment || DEFAULT_FULFILLMENT
        setFulfillment({
          modes: fallback.storeModes,
          defaultMode: fallback.defaultStoreMode,
          deliveryFeeFlat: fallback.deliveryFeeFlat,
          freeDeliveryMin: fallback.freeDeliveryMin,
          deliveryPayer: fallback.deliveryPayer,
          pickupLabel: fallback.pickupLabel,
          pickupHours: fallback.pickupHours,
          courierHints: fallback.courierHints,
        })
        setMode(fallback.defaultStoreMode)
      })
    return () => {
      alive = false
    }
  }, [settings.fulfillment, user])

  useEffect(() => {
    if (mode !== 'pickup' || !pickupDate) {
      setSlotOcc([])
      return
    }
    let alive = true
    void api
      .storePickupSlots(pickupDate)
      .then((res) => {
        if (!alive) return
        setSlotOcc(res.slots)
        setPickupSlot((cur) => {
          const stillOpen = res.slots.find((s) => s.slot === cur && !s.full)
          if (stillOpen) return cur
          return res.slots.find((s) => !s.full)?.slot || cur
        })
      })
      .catch(() => {
        if (alive) setSlotOcc([])
      })
    return () => {
      alive = false
    }
  }, [mode, pickupDate])

  useEffect(() => {
    let alive = true
    setCatalogReady(false)
    setCatalogErr(null)
    void api
      .storeProducts()
      .then((res) => {
        if (!alive) return
        setProducts(res.products)
        setLines(pruneStoreCart(res.products.map((p) => p.id)))
      })
      .catch((e) => {
        if (alive) {
          setProducts([])
          setCatalogErr(e instanceof Error ? e.message : 'Could not load catalog.')
        }
      })
      .finally(() => {
        if (alive) setCatalogReady(true)
      })
    return () => {
      alive = false
    }
  }, [catalogTick])

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email)
  }, [user, email])

  const rows = useMemo(() => {
    return lines
      .map((l) => {
        const p = products.find((x) => x.id === l.productId)
        return p ? { line: l, product: p } : null
      })
      .filter(Boolean) as Array<{ line: StoreCartLine; product: StoreProductDto }>
  }, [lines, products])

  const cartN = storeCartCount()
  const storeName = settings.storeLabel || 'Store'
  const subtotal = rows.reduce((n, r) => n + r.product.price * r.line.qty, 0)
  const cfg = fulfillment ? toSettings(fulfillment) : settings.fulfillment || DEFAULT_FULFILLMENT
  const modes = fulfillment?.modes?.length ? fulfillment.modes : cfg.storeModes
  const quote = resolveClientShippingQuote(mode, subtotal, cfg)
  const shipping = quote.fee
  const tradeInCredit = tradeIn ? applyTradeInCap(tradeIn.creditUsd, subtotal) : 0
  const total = Math.round((subtotal + shipping - tradeInCredit) * 100) / 100
  const shipHint = shippingFeeHint(mode, subtotal, cfg)

  async function checkout(e: FormEvent) {
    e.preventDefault()
    if (!rows.length) {
      setErr('Cart is empty.')
      return
    }
    const mail = email.trim()
    const fullName = name.trim()
    const shipTo = address.trim()
    if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setErr('Enter a valid email for the order confirmation.')
      return
    }
    if (!fullName) {
      setErr('Enter the name on the order.')
      return
    }
    if (mode === 'delivery' && shipTo.length < 8) {
      setErr('Enter a full shipping address.')
      return
    }
    if (mode === 'buyer_courier' && courierCarrier.trim().length < 2) {
      setErr('Choose your courier (FedEx, UPS, DHL, or Other).')
      return
    }
    if (mode === 'pickup' && (!pickupDate || !pickupSlot)) {
      setErr('Choose a pickup date and time window.')
      return
    }
    for (const r of rows) {
      if (r.line.qty < 1 || r.line.qty > r.product.stock) {
        setErr(`${r.product.title} qty must be between 1 and ${r.product.stock}.`)
        return
      }
    }
    setBusy(true)
    setErr(null)
    try {
      const res = await api.placeStoreOrder({
        email: mail,
        name: fullName,
        phone: phone.trim() || undefined,
        address: mode === 'delivery' ? shipTo : undefined,
        note: note.trim() || undefined,
        paymentMethod: pay,
        fulfillmentMode: mode,
        courierCarrier: mode === 'buyer_courier' ? courierCarrier.trim() : undefined,
        courierAccount: mode === 'buyer_courier' ? courierAccount.trim() || undefined : undefined,
        pickupDate: mode === 'pickup' ? pickupDate : undefined,
        pickupSlot: mode === 'pickup' ? pickupSlot : undefined,
        displayCurrency: currency,
        tradeIn:
          tradeIn && tradeInCredit > 0
            ? {
                deviceId: tradeIn.deviceId,
                label: tradeIn.label,
                grade: tradeIn.grade,
                battery: tradeIn.battery,
                simLocked: tradeIn.simLocked,
                activationLocked: tradeIn.activationLocked,
                estimateLow: tradeIn.lowUsd,
                estimateHigh: tradeIn.highUsd,
                creditUsd: tradeInCredit,
                images: tradeIn.images,
                videoUrl: tradeIn.videoUrl || null,
                imei: tradeIn.imei,
              }
            : undefined,
        lines: rows.map((r) => ({ productId: r.product.id, qty: r.line.qty })),
      })
      clearStoreCart()
      clearTradeInPending()
      storeOrderPlaced(res.order.id, pay)
      navigate(`/store/orders?placed=${encodeURIComponent(res.order.id)}&pay=${pay}`)
    } catch (ex) {
      const message = ex instanceof Error ? ex.message : 'Checkout failed.'
      setErr(message)
      storeOrderError(message)
    } finally {
      setBusy(false)
    }
  }

  if (!settings.showStore) {
    return (
      <PublicShell mode="consumer">
        <p className="muted store-off-note">Retail store is turned off.</p>
      </PublicShell>
    )
  }

  return (
    <PublicShell mode="consumer">
      <div className="retail-store retail-cart">
        <StoreRail
          page="cart"
          title="Cart"
          count={cartN}
          note={
            currency !== 'USD'
              ? `Prices shown in ${currency}. You’ll be charged in USD at checkout.`
              : 'Review your items, then check out securely.'
          }
          label={storeName}
        />

        {!lines.length ? (
          <div className="mh-empty shop-empty">
            <p>Your cart is empty.</p>
            <Link to="/store" className="btn btn-primary btn-sm">
              Continue shopping
            </Link>
            <Link to="/store/trade-in" className="btn btn-ghost btn-sm">
              Trade-in estimate
            </Link>
          </div>
        ) : !catalogReady ? (
          <StoreBlockSkeleton rows={3} />
        ) : catalogErr ? (
          <div className="mh-empty shop-empty">
            <p>{catalogErr}</p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setCatalogTick((n) => n + 1)}
            >
              Retry
            </button>
          </div>
        ) : !rows.length ? (
          <div className="mh-empty shop-empty">
            <p>Cart items are no longer available.</p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                clearStoreCart()
                clearTradeInPending()
                setTradeIn(null)
                setLines([])
              }}
            >
              Clear cart
            </button>
            <Link to="/store" className="btn btn-ghost btn-sm">
              Continue shopping
            </Link>
          </div>
        ) : (
          <div className="retail-checkout-grid">
            <div className="store-cart-lines">
              {rows.map(({ line, product }) => {
                const img = storeProductImage(product, 160)
                const { colorOptions, capacityOptions } = storeVariantOptions(
                  product,
                  products,
                )
                const swapTo = (opt: VariantOption) => {
                  if (!opt.product || !opt.inStock || opt.selected) return
                  setLines(
                    replaceStoreCartProduct(product.id, opt.product.id, opt.product.stock),
                  )
                  storeCartUpdated()
                }
                return (
                  <article key={product.id} className="store-cart-line">
                    <Link to={`/store/p/${product.slug}`} className="store-cart-thumb">
                      <img
                        src={img}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.onerror = null
                          e.currentTarget.src = storeProductFallback(product)
                        }}
                      />
                    </Link>
                    <div className="store-cart-line-body">
                      <div className="store-cart-line-top">
                        <div className="store-cart-line-main">
                          <Link to={`/store/p/${product.slug}`} className="store-cart-title">
                            {storeProductHeadline(product)}
                          </Link>
                          {product.grade ? (
                            <p className="muted tiny">Grade {product.grade}</p>
                          ) : null}
                          <StoreConditionBadges product={product} variant="cart" />
                          {colorOptions.length ? (
                            <div className="store-cart-variants" role="group" aria-label="Color">
                              <span className="store-cart-variant-label">Color</span>
                              <div className="store-cart-variant-chips">
                                {colorOptions.map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    className={`store-cart-chip${opt.selected ? ' is-on' : ''}${
                                      opt.inStock ? '' : ' is-oos'
                                    }`}
                                    disabled={!opt.inStock}
                                    title={
                                      opt.inStock ? opt.value : `${opt.value} · out of stock`
                                    }
                                    onClick={() => swapTo(opt)}
                                  >
                                    {opt.value}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {capacityOptions.length ? (
                            <div className="store-cart-variants" role="group" aria-label="Storage">
                              <span className="store-cart-variant-label">Storage</span>
                              <div className="store-cart-variant-chips">
                                {capacityOptions.map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    className={`store-cart-chip${opt.selected ? ' is-on' : ''}${
                                      opt.inStock ? '' : ' is-oos'
                                    }`}
                                    disabled={!opt.inStock}
                                    title={
                                      opt.inStock ? opt.value : `${opt.value} · out of stock`
                                    }
                                    onClick={() => swapTo(opt)}
                                  >
                                    {opt.value}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {!colorOptions.length && !capacityOptions.length ? (
                            <p className="store-cart-options">
                              {[product.capacity, product.color].filter(Boolean).join(' · ') ||
                                product.category}
                            </p>
                          ) : null}
                        </div>
                        <div className="store-cart-line-side">
                          <strong className="store-cart-line-total">
                            {money(product.price * line.qty)}
                          </strong>
                          <p className="muted tiny store-cart-unit">{money(product.price)} each</p>
                        </div>
                      </div>
                      <div className="store-cart-line-actions">
                        <CartQtyStepper
                          productId={product.id}
                          qty={line.qty}
                          max={product.stock}
                          onChange={(next) => {
                            setStoreCartQty(product.id, next)
                            setLines(readStoreCart())
                            storeCartUpdated()
                          }}
                        />
                        <button
                          type="button"
                          className="store-cart-remove"
                          onClick={() => {
                            setStoreCartQty(product.id, 0)
                            setLines(readStoreCart())
                            storeRemovedFromCart(product.title)
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
              <div className="store-cart-foot">
                <Link to="/store" className="store-cart-continue">
                  ← Continue shopping
                </Link>
                {shipHint ? <p className="muted tiny">{shipHint}</p> : null}
              </div>
            </div>

            <form className="retail-checkout" onSubmit={(e) => void checkout(e)}>
              <div className="store-cart-summary">
                <h2 className="store-cart-summary-title">Order summary</h2>
                <div className="retail-totals">
                  <div>
                    <span>Subtotal</span>
                    <strong>{money(subtotal)}</strong>
                  </div>
                  <div>
                    <span>
                      {mode === 'pickup'
                        ? 'Pickup'
                        : mode === 'buyer_courier'
                          ? 'Your courier'
                          : 'Shipping'}
                      {mode === 'delivery' && quote.quoted && shipping === 0 && cfg.freeDeliveryMin > 0
                        ? ` (free over $${cfg.freeDeliveryMin})`
                        : ''}
                      {!quote.quoted ? ' (TBD)' : ''}
                    </span>
                    <strong>{formatShippingMoney(shipping, quote.quoted, money)}</strong>
                  </div>
                  {tradeIn && tradeInCredit > 0 ? (
                    <div className="store-cart-tradein">
                      <span>
                        Trade-in credit (pending)
                        <Link to="/store/trade-in" className="store-cart-tradein-edit">
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="linkish store-cart-tradein-remove"
                          onClick={() => {
                            clearTradeInPending()
                            setTradeIn(null)
                          }}
                        >
                          Remove
                        </button>
                      </span>
                      <strong>−{money(tradeInCredit)}</strong>
                      <p className="muted tiny store-cart-tradein-note">
                        {tradeIn.label} · IMEI {tradeIn.imei} · {tradeIn.images.length} photos ·
                        final after inspection · maxed to cart subtotal
                      </p>
                    </div>
                  ) : (
                    <p className="muted tiny store-cart-tradein-cta">
                      Have an old device?{' '}
                      <Link to="/store/trade-in">Get a trade-in estimate</Link>
                    </p>
                  )}
                  <div className="is-grand">
                    <span>Total{!quote.quoted ? ' + shipping TBD' : ''}</span>
                    <strong>{money(total)}</strong>
                  </div>
                  {currency !== 'USD' ? (
                    <div className="muted tiny store-cart-usd">
                      <span>Charged in USD</span>
                      <strong>{usd(total)}</strong>
                    </div>
                  ) : null}
                </div>
              </div>

              <h2>Fulfillment</h2>
              <div className="retail-pay-options" role="radiogroup" aria-label="Fulfillment">
                {modes.map((m) => (
                  <label key={m} className={mode === m ? 'on' : undefined}>
                    <input
                      type="radio"
                      name="fulfillment"
                      checked={mode === m}
                      onChange={() => setMode(m)}
                    />
                    <span className="retail-pay-label">
                      <strong>{FULFILLMENT_LABELS[m]}</strong>
                      <em>
                        {m === 'pickup'
                          ? cfg.pickupHours
                          : m === 'buyer_courier'
                            ? cfg.courierHints
                            : PAYER_SHORT(cfg)}
                      </em>
                    </span>
                  </label>
                ))}
              </div>

              {mode === 'pickup' ? (
                <>
                  <p className="muted tiny">
                    {cfg.pickupLabel} — {cfg.pickupHours}. Book a window; staff confirms when ready.
                  </p>
                  <label className="field">
                    <span>Pickup date</span>
                    <input
                      type="date"
                      required
                      min={earliestPickupDate(cfg)}
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Time window</span>
                    <select
                      required
                      value={pickupSlot}
                      onChange={(e) => setPickupSlot(e.target.value)}
                    >
                      {(cfg.pickupSlots || []).map((s) => {
                        const occ = slotOcc.find((o) => o.slot === s)
                        const full = Boolean(occ?.full)
                        const left =
                          occ?.remaining != null ? ` · ${occ.remaining} left` : ''
                        return (
                          <option key={s} value={s} disabled={full}>
                            {s}
                            {full ? ' · full' : left}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                </>
              ) : null}

              {mode === 'buyer_courier' ? (
                <>
                  <label className="field">
                    <span>Courier</span>
                    <select
                      value={courierCarrier}
                      onChange={(e) => setCourierCarrier(e.target.value)}
                    >
                      {['FedEx', 'UPS', 'DHL', 'Other'].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Your account # (optional)</span>
                    <input
                      value={courierAccount}
                      onChange={(e) => setCourierAccount(e.target.value)}
                      placeholder="Staff will confirm before collect"
                    />
                  </label>
                </>
              ) : null}

              <h2>{mode === 'delivery' ? 'Ship to' : 'Contact'}</h2>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Full name</span>
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              {mode === 'delivery' ? (
                <label className="field">
                  <span>Address</span>
                  <textarea
                    required
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </label>
              ) : null}
              <label className="field">
                <span>Phone (optional)</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="field">
                <span>Note (optional)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} />
              </label>

              <h2>Payment</h2>
              <div className="retail-pay-options" role="radiogroup" aria-label="Payment method">
                {(
                  [
                    ['card', 'Card', 'Pay at checkout'],
                    ['paypal', 'PayPal', 'Pay with PayPal'],
                    ['bank', 'Bank transfer', 'Staff confirms'],
                    ['usdt', 'USDT (crypto)', 'Staff confirms'],
                    ['cash', 'Cash', 'Pay on pickup / collect'],
                  ] as const
                ).map(([id, label, hint]) => (
                  <label key={id} className={pay === id ? 'on' : undefined}>
                    <input
                      type="radio"
                      name="pay"
                      checked={pay === id}
                      onChange={() => setPay(id)}
                    />
                    <span className="retail-pay-label">
                      <strong>{label}</strong>
                      <em>{hint}</em>
                    </span>
                  </label>
                ))}
              </div>
              {err ? <p className="tiny imei-err" role="alert">{err}</p> : null}
              <button type="submit" className="btn btn-primary store-checkout-btn" disabled={busy}>
                {busy
                  ? 'Placing order…'
                  : pay === 'bank' || pay === 'usdt' || pay === 'cash'
                    ? `Place order · ${money(total)}`
                    : `Pay with ${pay === 'paypal' ? 'PayPal' : 'card'} · ${money(total)}`}
              </button>
              <ul className="store-cart-trust">
                <li>Prices charged in USD</li>
                <li>Pickup, courier, or delivery</li>
                <li>Bank, USDT & cash confirmed by staff</li>
              </ul>
            </form>
          </div>
        )}
        <StoreWholesaleHandoff />
      </div>
    </PublicShell>
  )
}

function PAYER_SHORT(cfg: FulfillmentSettings) {
  if (cfg.deliveryPayer === 'buyer') {
    return cfg.freeDeliveryMin > 0
      ? `From $${cfg.deliveryFeeFlat} · free over $${cfg.freeDeliveryMin}`
      : `$${cfg.deliveryFeeFlat}`
  }
  if (cfg.deliveryPayer === 'admin_decide') return 'Fee TBD — staff quotes'
  return 'Free delivery'
}
