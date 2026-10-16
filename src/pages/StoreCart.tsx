import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
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
import { storeProductFallback, storeProductImage } from '../lib/storePhotos'
import {
  clearStoreCart,
  readStoreCart,
  setStoreCartQty,
  storeCartCount,
  type StoreCartLine,
} from '../lib/storeCart'
import { pushToast } from '../lib/toast'
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

export function StoreCart() {
  const { settings, user } = useStore()
  const navigate = useNavigate()
  const [lines, setLines] = useState<StoreCartLine[]>(() => readStoreCart())
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
        if (alive) setProducts(res.products)
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
  const total = Math.round((subtotal + shipping) * 100) / 100
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
        lines: rows.map((r) => ({ productId: r.product.id, qty: r.line.qty })),
      })
      clearStoreCart()
      pushToast(`Order ${res.order.id} placed`, 'ok', {
        href: `/store/orders?placed=${encodeURIComponent(res.order.id)}&pay=${pay}`,
        label: 'View order',
      })
      navigate(`/store/orders?placed=${encodeURIComponent(res.order.id)}&pay=${pay}`)
    } catch (ex) {
      const message = ex instanceof Error ? ex.message : 'Checkout failed.'
      setErr(message)
      pushToast(message, 'err')
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
          note="Fixed retail checkout — separate from wholesale invoices."
          label={storeName}
        />

        {!lines.length ? (
          <div className="mh-empty shop-empty">
            <p>Your cart is empty.</p>
            <Link to="/store" className="btn btn-primary btn-sm">
              Shop collection
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
            <Link to="/store" className="btn btn-primary btn-sm">
              Shop collection
            </Link>
          </div>
        ) : (
          <div className="retail-checkout-grid">
            <div className="store-cart-lines">
              {rows.map(({ line, product }) => {
                const img = storeProductImage(product, 160)
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
                      <Link to={`/store/p/${product.slug}`} className="store-cart-title">
                        {product.title}
                      </Link>
                      <p className="muted tiny">
                        {usd(product.price)} / unit · {product.category}
                      </p>
                      <div className="store-cart-line-actions">
                        <label className="store-cart-qty">
                          <span className="sr-only">Qty</span>
                          <input
                            className="retail-qty"
                            type="number"
                            min={1}
                            max={product.stock}
                            value={line.qty}
                            onChange={(e) =>
                              setStoreCartQty(product.id, Number(e.target.value) || 0)
                            }
                          />
                        </label>
                        <strong className="store-cart-line-total">
                          {usd(product.price * line.qty)}
                        </strong>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setStoreCartQty(product.id, 0)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}

              <div className="retail-totals">
                <div>
                  <span>Subtotal</span>
                  <strong>{usd(subtotal)}</strong>
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
                  <strong>{formatShippingMoney(shipping, quote.quoted, usd)}</strong>
                </div>
                <div className="is-grand">
                  <span>Total{!quote.quoted ? ' + shipping TBD' : ''}</span>
                  <strong>{usd(total)}</strong>
                </div>
              </div>
              <p className="muted tiny">{shipHint}</p>
            </div>

            <form className="retail-checkout" onSubmit={(e) => void checkout(e)}>
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
              <p className="muted tiny store-pay-hint">
                Card/PayPal recorded for demo — not charged. Bank, USDT, and cash stay pending
                until staff confirms.
              </p>

              {err ? <p className="tiny imei-err" role="alert">{err}</p> : null}
              <button type="submit" className="btn btn-primary store-checkout-btn" disabled={busy}>
                {busy
                  ? 'Placing order…'
                  : pay === 'bank' || pay === 'usdt' || pay === 'cash'
                    ? `Place order · ${usd(total)}`
                    : `Pay with ${pay === 'paypal' ? 'PayPal' : 'card'} · ${usd(total)}`}
              </button>
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
