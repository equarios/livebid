import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { StoreConditionBadges } from '../components/StoreConditionBadges'
import { BatteryMark } from '../components/BatteryMark'
import { StoreWholesaleHandoff } from '../components/StoreWholesaleHandoff'
import { StoreRail } from '../components/StoreRail'
import { StoreBlockSkeleton } from '../components/StoreSkeleton'
import { api, type StoreProductDto } from '../lib/api'
import { usd } from '../lib/format'
import { originLabel } from '../lib/auctionLists'
import {
  DEFAULT_FULFILLMENT,
  earliestPickupDate,
  formatShippingMoney,
  resolveClientShippingQuote,
} from '../lib/fulfillment'
import { storeProductHeadline, storeProductBrand } from '../lib/storeBrand'
import { colorSwatch } from '../lib/storeSwatch'
import { useStoreFx } from '../lib/storeFx'
import { pushToast } from '../lib/toast'
import { storeProductFallback, storeProductImage } from '../lib/storePhotos'
import {
  clearStoreCart,
  pruneStoreCart,
  pruneStoreCartReport,
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

/** Cart review and checkout are two stages of the same route. */
type Stage = 'cart' | 'checkout'

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
  const soldOut = cap <= 1 && max <= 0
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
        readOnly={soldOut}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={() => commit(draft)}
        onKeyDown={onKey}
      />
      <button
        type="button"
        className="store-cart-step"
        aria-label="Increase quantity"
        disabled={soldOut || qty >= cap}
        onClick={() => bump(1)}
      >
        +
      </button>
    </div>
  )
}

/** Checkout form draft — survives a refresh so nobody retypes their details. */
const CHECKOUT_DRAFT_KEY = 'livebid-store-checkout-draft'

type CheckoutDraft = {
  email: string
  name: string
  phone: string
  address: string
  note: string
  promo: string
  stage: Stage
}

function readCheckoutDraft(): Partial<CheckoutDraft> {
  try {
    const raw = localStorage.getItem(CHECKOUT_DRAFT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<CheckoutDraft>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeCheckoutDraft(d: CheckoutDraft) {
  try {
    localStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(d))
  } catch {
    /* storage full / blocked — drafts are best-effort */
  }
}

function clearCheckoutDraft() {
  try {
    localStorage.removeItem(CHECKOUT_DRAFT_KEY)
  } catch {
    /* ignore */
  }
}

export function StoreCart() {
  const { settings, user } = useStore()
  const { money, currency } = useStoreFx()
  const navigate = useNavigate()
  const draft = readCheckoutDraft()
  const [stage, setStage] = useState<Stage>(draft.stage === 'checkout' ? 'checkout' : 'cart')
  const [lines, setLines] = useState<StoreCartLine[]>(() => readStoreCart())
  const [tradeIn, setTradeIn] = useState<TradeInPending | null>(() => readTradeInPending())
  const [products, setProducts] = useState<StoreProductDto[]>([])
  const [catalogReady, setCatalogReady] = useState(false)
  const [email, setEmail] = useState(draft.email || user?.email || '')
  const [name, setName] = useState(draft.name || '')
  const [phone, setPhone] = useState(draft.phone || '')
  const [address, setAddress] = useState(draft.address || '')
  const [note, setNote] = useState(draft.note || '')
  const [promoInput, setPromoInput] = useState(draft.promo || '')
  const [promo, setPromo] = useState<{ code: string; pctOff: number } | null>(null)
  const [promoBusy, setPromoBusy] = useState(false)
  const [promoErr, setPromoErr] = useState<string | null>(null)
  const [pricing, setPricing] = useState<{
    taxMode: 'none' | 'inclusive' | 'exclusive'
    taxLabel: string
    taxRatePct: number
  } | null>(null)
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
  /** Lines dropped on catalog load because the product is gone. */
  const [dropped, setDropped] = useState<StoreCartLine[]>([])

  useEffect(() => {
    const sync = () => setLines(readStoreCart())
    window.addEventListener('livebid-store-cart', sync)
    return () => window.removeEventListener('livebid-store-cart', sync)
  }, [])

  useEffect(() => subscribeTradeIn(() => setTradeIn(readTradeInPending())), [])

  useEffect(() => {
    let alive = true
    void api
      .storePricing()
      .then((res) => {
        if (!alive) return
        setPricing({
          taxMode: res.pricing.taxMode,
          taxLabel: res.pricing.taxLabel,
          taxRatePct: res.pricing.taxRatePct,
        })
      })
      .catch(() => {
        /* pricing rules unavailable — cart renders without tax */
      })
    return () => {
      alive = false
    }
  }, [])

  /** Persist the checkout draft whenever a field changes. */
  useEffect(() => {
    writeCheckoutDraft({ email, name, phone, address, note, promo: promoInput, stage })
  }, [email, name, phone, address, note, promoInput, stage])

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
        const { kept, removed } = pruneStoreCartReport(res.products.map((p) => p.id))
        if (removed.length) {
          setDropped(removed)
          pushToast(
            `${removed.length} item${removed.length === 1 ? '' : 's'} were removed — no longer available.`,
          )
        }
        setLines(kept)
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
  const discount = promo ? Math.round(subtotal * (promo.pctOff / 100) * 100) / 100 : 0
  /** Goods after promo — the base for shipping thresholds, trade-in cap and tax. */
  const goods = Math.round((subtotal - discount) * 100) / 100
  const taxRate = pricing?.taxMode === 'exclusive' ? pricing.taxRatePct : 0
  const tax = Math.round(goods * (taxRate / 100) * 100) / 100
  const taxIncluded =
    pricing?.taxMode === 'inclusive'
      ? Math.round(goods * (pricing.taxRatePct / (100 + pricing.taxRatePct)) * 100) / 100
      : 0
  const taxLabel =
    pricing && pricing.taxMode !== 'none' && pricing.taxRatePct > 0
      ? `${pricing.taxLabel} (${pricing.taxRatePct}%${
          pricing.taxMode === 'inclusive' ? ' incl.' : ''
        })`
      : null
  const cfg = fulfillment ? toSettings(fulfillment) : settings.fulfillment || DEFAULT_FULFILLMENT
  const modes = fulfillment?.modes?.length ? fulfillment.modes : cfg.storeModes
  const quote = resolveClientShippingQuote(mode, goods, cfg)
  const shipping = quote.fee
  const tradeInCredit = tradeIn ? applyTradeInCap(tradeIn.creditUsd, goods) : 0
  const total = Math.round((goods + shipping + tax - tradeInCredit) * 100) / 100
  /** Cart stage has no fulfillment choice yet — preview plain delivery. */
  const cartShipQuote = resolveClientShippingQuote('delivery', goods, cfg)
  const cartTotal = Math.round((goods + cartShipQuote.fee + tax - tradeInCredit) * 100) / 100

  const itemCount = rows.reduce((n, r) => n + r.line.qty, 0)
  const freeShipGap =
    cfg.deliveryPayer === 'buyer' && cfg.freeDeliveryMin > 0 && goods < cfg.freeDeliveryMin
      ? Math.round((cfg.freeDeliveryMin - goods) * 100) / 100
      : 0
  const freeShipPct =
    cfg.freeDeliveryMin > 0
      ? Math.min(100, Math.round((goods / cfg.freeDeliveryMin) * 100))
      : 100

  /** Auto-validate a remembered promo once the catalog gives us a real subtotal. */
  const promoBootRef = useRef(false)
  useEffect(() => {
    if (promoBootRef.current || promo || !promoInput.trim() || subtotal <= 0) return
    promoBootRef.current = true
    void api
      .applyStorePromo(promoInput, subtotal)
      .then((res) => setPromo({ code: res.code, pctOff: res.pctOff }))
      .catch((ex) => {
        setPromo(null)
        setPromoErr(ex instanceof Error ? ex.message : 'That code isn’t valid.')
      })
  }, [promoInput, promo, subtotal])

  async function applyPromo() {
    const code = promoInput.trim()
    if (!code) {
      setPromoErr('Enter a promo code.')
      return
    }
    setPromoBusy(true)
    setPromoErr(null)
    try {
      const res = await api.applyStorePromo(code, subtotal)
      setPromo({ code: res.code, pctOff: res.pctOff })
      setPromoInput(res.code)
      pushToast(`${res.code} applied — ${res.pctOff}% off.`)
    } catch (ex) {
      setPromo(null)
      setPromoErr(ex instanceof Error ? ex.message : 'That code isn’t valid.')
    } finally {
      setPromoBusy(false)
    }
  }

  function removePromo() {
    setPromo(null)
    setPromoInput('')
    setPromoErr(null)
  }

  function goCheckout() {
    setErr(null)
    setStage('checkout')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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
        promoCode: promo?.code,
        tradeIn: tradeIn
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
      clearCheckoutDraft()
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

  /** Order summary — cart stage previews plain delivery; checkout uses the chosen mode. */
  const summary = (showCheckoutCta: boolean) => {
    const shipQuote = showCheckoutCta ? cartShipQuote : quote
    const grandTotal = showCheckoutCta ? cartTotal : total
    return (
    <aside className="cart2-summary">
      <div className="store-cart-summary">
        <h2 className="store-cart-summary-title">Order summary</h2>
        <div className="retail-totals">
          <div>
            <span>
              Subtotal
              {itemCount > 0 ? ` · ${itemCount} item${itemCount === 1 ? '' : 's'}` : ''}
            </span>
            <strong>{money(subtotal)}</strong>
          </div>
          {discount > 0 ? (
            <div className="cart2-row-discount">
              <span>
                Promo {promo?.code}
                <button type="button" className="linkish tiny" onClick={removePromo}>
                  Remove
                </button>
              </span>
              <strong>−{money(discount)}</strong>
            </div>
          ) : null}
          <div>
            <span>
              {showCheckoutCta
                ? 'Shipping'
                : mode === 'pickup'
                  ? 'Pickup'
                  : mode === 'buyer_courier'
                    ? 'Your courier'
                    : 'Shipping'}
              {!shipQuote.quoted ? ' (TBD)' : shipQuote.fee === 0 ? ' (free)' : ''}
            </span>
            <strong>{formatShippingMoney(shipQuote.fee, shipQuote.quoted, money)}</strong>
          </div>
          {taxLabel ? (
            <div>
              <span>
                {taxLabel}
                {taxIncluded > 0 ? ' — included' : ''}
              </span>
              <strong>{taxIncluded > 0 ? money(taxIncluded) : money(tax)}</strong>
            </div>
          ) : null}
          {tradeIn && tradeInCredit > 0 ? (
            <div className="store-cart-tradein">
              <span>Trade-in credit (pending)</span>
              <strong>−{money(tradeInCredit)}</strong>
            </div>
          ) : null}
          <div className="is-grand">
            <span>Total{!shipQuote.quoted ? ' + shipping TBD' : ''}</span>
            <strong>{money(grandTotal)}</strong>
          </div>
          {currency !== 'USD' ? (
            <div className="cart2-usd-note">
              <div>
                <span>Card charged in USD</span>
                <strong>{usd(grandTotal)}</strong>
              </div>
              <p className="muted tiny">
                Shown in {currency} for reference. Your bank converts the USD charge and may add a
                conversion fee.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {tradeIn ? (
        <div className="cart2-tradein">
          <div className="cart2-tradein-top">
            <strong>{tradeIn.label}</strong>
            <span>{tradeInCredit > 0 ? `−${money(tradeInCredit)}` : 'TBD'}</span>
          </div>
          <p className="muted tiny">
            IMEI {tradeIn.imei} · {tradeIn.images.length} photos · final after inspection
          </p>
          <div className="cart2-tradein-actions">
            <Link to="/store/trade-in" className="linkish tiny">
              Edit
            </Link>
            <button
              type="button"
              className="linkish tiny"
              onClick={() => {
                clearTradeInPending()
                setTradeIn(null)
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <p className="muted tiny store-cart-tradein-cta">
          Have an old device? <Link to="/store/trade-in">Get a trade-in estimate</Link>
        </p>
      )}

      {showCheckoutCta ? (
        <>
          <div className="cart2-promo">
            <label className="field">
              <span>Promo code</span>
              <div className="cart2-promo-row">
                <input
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value.toUpperCase())
                    if (promoErr) setPromoErr(null)
                  }}
                  placeholder="Enter code"
                  autoComplete="off"
                  autoCapitalize="characters"
                  disabled={promoBusy || Boolean(promo)}
                />
                {promo ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={removePromo}>
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={promoBusy || !promoInput.trim()}
                    onClick={() => void applyPromo()}
                  >
                    {promoBusy ? 'Checking…' : 'Apply'}
                  </button>
                )}
              </div>
            </label>
            {promoErr ? (
              <p className="cart2-promo-err" role="alert">
                {promoErr}
              </p>
            ) : promo ? (
              <p className="cart2-promo-ok">
                {promo.code} applied — {promo.pctOff}% off.
              </p>
            ) : null}
          </div>
          <button type="button" className="btn btn-primary cart2-cta" onClick={goCheckout}>
            Checkout · {money(cartTotal)}
          </button>
          <ul className="store-cart-trust">
            <li>Secure checkout</li>
            <li>Trade-in credit applied at checkout</li>
            <li>Track status in Orders</li>
          </ul>
        </>
      ) : (
        <ul className="store-cart-trust">
          <li>Prices charged in USD</li>
          <li>Pickup, courier, or delivery</li>
          <li>Bank, USDT &amp; cash confirmed by staff</li>
        </ul>
      )}
    </aside>
    )
  }

  return (
    <PublicShell mode="consumer">
      <div className="retail-store retail-cart">
        <StoreRail
          page="cart"
          title={stage === 'cart' ? 'Cart' : 'Checkout'}
          headline={stage === 'cart' ? 'Your cart' : 'Checkout'}
          count={cartN}
          note={
            stage === 'cart'
              ? currency !== 'USD'
                ? `Prices shown in ${currency}. You’ll be charged in USD at checkout.`
                : 'Review your items, then check out securely.'
              : 'Contact, delivery and payment — then place your order.'
          }
          label={storeName}
          hero
          trust={
            stage === 'cart'
              ? ['Secure checkout', 'Trade-in credit at checkout', 'Track status in Orders']
              : ['Encrypted checkout', 'Free returns within 14 days', 'Track status in Orders']
          }
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
        ) : stage === 'cart' ? (
          <>
          <ol className="ck-steps is-bar" aria-label="Checkout steps">
            <li className="is-on" aria-current="step">
              <span className="ck-steps-dot" aria-hidden>
                1
              </span>
              Cart
            </li>
            <li>
              <span className="ck-steps-dot" aria-hidden>
                2
              </span>
              Details
            </li>
            <li>
              <span className="ck-steps-dot" aria-hidden>
                3
              </span>
              Payment
            </li>
          </ol>
          <div className="cart2-grid">
            <div className="store-cart-lines">
              {dropped.length ? (
                <div className="cart2-dropped" role="status">
                  <p>
                    <strong>
                      {dropped.length} item{dropped.length === 1 ? '' : 's'}
                    </strong>{' '}
                    removed — no longer available.
                  </p>
                  <button
                    type="button"
                    className="linkish tiny"
                    onClick={() => setDropped([])}
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}
              {freeShipGap > 0 ? (
                <div className="cart2-freeship">
                  <p>
                    <strong>{money(freeShipGap)}</strong> away from free delivery
                  </p>
                  <div
                    className="cart2-freeship-track"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={freeShipPct}
                    aria-label="Progress to free delivery"
                  >
                    <span style={{ width: `${freeShipPct}%` }} />
                  </div>
                </div>
              ) : null}

              {rows.map(({ line, product }) => {
                const img = storeProductImage(product, 200)
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
                const variantBits = [product.color, product.capacity].filter(Boolean)
                return (
                  <article
                    key={product.id}
                    className={`cart2-line${product.stock <= 0 ? ' is-oos' : ''}`}
                  >
                    <Link to={`/store/p/${product.slug}`} className="cart2-line-thumb">
                      <img
                        src={img}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.onerror = null
                          e.currentTarget.src = storeProductFallback(product)
                        }}
                      />
                    </Link>

                    <div className="cart2-line-body">
                      <div className="cart2-line-head">
                        <div>
                          <Link to={`/store/p/${product.slug}`} className="cart2-line-title">
                            {storeProductHeadline(product)}
                          </Link>
                          <p className="cart2-line-sub">
                            {product.color ? (
                              <span className="cart2-line-dot-wrap">
                                <span
                                  className="cart2-line-dot"
                                  style={{ background: colorSwatch(product.color).background }}
                                  aria-hidden
                                />
                              </span>
                            ) : null}
                            {variantBits.length ? variantBits.join(' · ') : product.category}
                            {product.grade ? ` · Grade ${product.grade}` : ''}
                          </p>
                          {product.description?.trim() ? (
                            <p className="cart2-line-desc">{product.description.trim()}</p>
                          ) : null}
                          <ul className="cart2-line-chips" aria-label="Item details">
                            {storeProductBrand(product) ? (
                              <li>
                                <span className="k">Brand</span>
                                {storeProductBrand(product)}
                              </li>
                            ) : null}
                            {product.modelNumber ? (
                              <li>
                                <span className="k">Model</span>
                                {product.modelNumber}
                              </li>
                            ) : null}
                            {product.origin ? (
                              <li>
                                <span className="k">Origin</span>
                                {originLabel(product.origin)}
                              </li>
                            ) : null}
                            {product.battery && product.battery > 0 ? (
                              <li>
                                <span className="k">Battery</span>
                                <BatteryMark value={product.battery} size={16} />
                              </li>
                            ) : null}
                            {variantBits.length ? <li>{product.category}</li> : null}
                            {product.stock > 3 ? <li>{product.stock} in stock</li> : null}
                          </ul>
                        </div>
                        <div className="cart2-line-money">
                          <strong>{money(product.price * line.qty)}</strong>
                          <span className="muted tiny">{money(product.price)} each</span>
                        </div>
                      </div>

                      {product.stock <= 0 ? (
                        <p className="cart2-line-oos">
                          Out of stock — remove it or pick another option to check out.
                        </p>
                      ) : product.stock <= 3 ? (
                        <p className="cart2-line-low">
                          Only {product.stock} left — checkout soon.
                        </p>
                      ) : null}

                      <StoreConditionBadges product={product} variant="card" />

                      {colorOptions.length || capacityOptions.length ? (
                        <details className="cart2-line-options">
                          <summary>
                            Change options
                            {variantBits.length ? (
                              <span className="muted tiny"> · {variantBits.join(' / ')}</span>
                            ) : null}
                          </summary>
                          <div className="cart2-line-choices">
                            {colorOptions.length ? (
                              <div className="store-cart-variants" role="group" aria-label="Color">
                                <span className="store-cart-variant-label">Colour</span>
                                <div className="store-cart-variant-chips">
                                  {colorOptions.map((opt) => {
                                    const sw = colorSwatch(opt.value)
                                    return (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        className={`store-cart-chip is-dot${
                                          opt.selected ? ' is-on' : ''
                                        }${opt.inStock ? '' : ' is-oos'}`}
                                        disabled={!opt.inStock}
                                        onClick={() => swapTo(opt)}
                                      >
                                        <span
                                          className="store-cart-chip-dot"
                                          style={{ background: sw.background }}
                                          aria-hidden
                                        />
                                        {opt.value}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            ) : null}
                            {capacityOptions.length ? (
                              <div
                                className="store-cart-variants"
                                role="group"
                                aria-label="Storage"
                              >
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
                                      onClick={() => swapTo(opt)}
                                    >
                                      {opt.value}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </details>
                      ) : null}
                    </div>

                    <div className="cart2-line-actions">
                      <CartQtyStepper
                        productId={product.id}
                        qty={line.qty}
                        max={product.stock}
                        onChange={(next) => {
                          setStoreCartQty(product.id, next, product.stock)
                          setLines(readStoreCart())
                          storeCartUpdated()
                        }}
                      />
                      <button
                        type="button"
                        className="cart2-line-remove"
                        onClick={() => {
                          setStoreCartQty(product.id, 0)
                          setLines(readStoreCart())
                          storeRemovedFromCart(product.title)
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                )
              })}
              <div className="store-cart-foot">
                <Link to="/store" className="store-cart-continue">
                  ← Continue shopping
                </Link>
              </div>
            </div>

            {summary(true)}
          </div>
          </>
        ) : (
          <form className="cart2-grid is-checkout" onSubmit={(e) => void checkout(e)}>
            <div className="cart2-flow">
              <div className="ck-top">
                <button type="button" className="cart2-back" onClick={() => setStage('cart')}>
                  ← Back to cart
                </button>
                <ol className="ck-steps is-bar" aria-label="Checkout steps">
                  <li className="is-done">
                    <span className="ck-steps-dot" aria-hidden>
                      ✓
                    </span>
                    Cart
                  </li>
                  <li className="is-on" aria-current="step">
                    <span className="ck-steps-dot" aria-hidden>
                      2
                    </span>
                    Details
                  </li>
                  <li>
                    <span className="ck-steps-dot" aria-hidden>
                      3
                    </span>
                    Payment
                  </li>
                </ol>
              </div>

              <section className="cart2-step cart2-recap" aria-labelledby="ck-items">
                <h2 id="ck-items" className="cart2-step-title">
                  <span className="cart2-step-copy">
                    Your items
                    <em>
                      {itemCount} item{itemCount === 1 ? '' : 's'} · {money(goods)}
                    </em>
                  </span>
                  <button type="button" className="cart2-recap-edit" onClick={() => setStage('cart')}>
                    Edit
                  </button>
                </h2>
                <ul className="cart2-recap-list">
                  {rows.map(({ line, product }) => (
                    <li key={product.id}>
                      <img
                        src={storeProductImage(product, 120)}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.onerror = null
                          e.currentTarget.src = storeProductFallback(product)
                        }}
                      />
                      <div className="cart2-recap-copy">
                        <strong>{storeProductHeadline(product)}</strong>
                        <span>
                          {[product.color, product.capacity].filter(Boolean).join(' · ') ||
                            product.category}
                          {' · '}
                          Qty {line.qty}
                        </span>
                      </div>
                      <span className="cart2-recap-price">{money(product.price * line.qty)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="cart2-step" aria-labelledby="ck-contact">
                <h2 id="ck-contact" className="cart2-step-title">
                  <span className="cart2-step-num">1</span>
                  <span className="cart2-step-copy">
                    Contact
                    <em>Where the receipt and updates go</em>
                  </span>
                </h2>
                <div className="cart2-fields is-contact">
                  <label className="field">
                    <span>Email</span>
                    <input
                      type="email"
                      required
                      value={email}
                      autoComplete="email"
                      inputMode="email"
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Full name</span>
                    <input
                      required
                      value={name}
                      autoComplete="name"
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Phone (optional)</span>
                    <input
                      value={phone}
                      autoComplete="tel"
                      inputMode="tel"
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="cart2-step" aria-labelledby="ck-delivery">
                <h2 id="ck-delivery" className="cart2-step-title">
                  <span className="cart2-step-num">2</span>
                  <span className="cart2-step-copy">
                    Delivery
                    <em>How you want to receive it</em>
                  </span>
                </h2>
                <div className="cart2-fulfill" role="radiogroup" aria-label="Fulfillment">
                  {modes.map((m) => (
                    <label key={m} className={mode === m ? 'on' : undefined}>
                      <input
                        type="radio"
                        name="fulfillment"
                        checked={mode === m}
                        onChange={() => setMode(m)}
                      />
                      <span>
                        {m === 'delivery' ? 'Ship' : m === 'pickup' ? 'Pickup' : 'Courier'}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="cart2-fulfill-panel">
                  {mode === 'delivery' ? (
                    <>
                      <p className="cart2-fulfill-hint">{PAYER_SHORT(cfg)}</p>
                      <label className="field">
                        <span>Shipping address</span>
                        <textarea
                          required
                          rows={2}
                          value={address}
                          autoComplete="street-address"
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Street, city, postal code, country"
                        />
                      </label>
                    </>
                  ) : null}

                  {mode === 'pickup' ? (
                    <>
                      <div className="cart2-fields">
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
                              const left = occ?.remaining != null ? ` · ${occ.remaining} left` : ''
                              return (
                                <option key={s} value={s} disabled={full}>
                                  {s}
                                  {full ? ' · full' : left}
                                </option>
                              )
                            })}
                          </select>
                        </label>
                      </div>
                      <p className="cart2-fulfill-hint">
                        {cfg.pickupLabel} — {cfg.pickupHours}. Staff confirms when ready.
                      </p>
                    </>
                  ) : null}

                  {mode === 'buyer_courier' ? (
                    <>
                      {cfg.courierHints ? (
                        <p className="cart2-fulfill-hint">{cfg.courierHints}</p>
                      ) : null}
                      <div className="cart2-fields">
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
                      </div>
                    </>
                  ) : null}

                  <label className="field cart2-fulfill-note">
                    <span>Order note (optional)</span>
                    <input
                      value={note}
                      autoComplete="off"
                      maxLength={500}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Delivery instructions, gift note…"
                    />
                  </label>
                </div>
              </section>

              <section className="cart2-step" aria-labelledby="ck-pay">
                <h2 id="ck-pay" className="cart2-step-title">
                  <span className="cart2-step-num">3</span>
                  <span className="cart2-step-copy">
                    Payment
                    <em>Choose how to pay</em>
                  </span>
                </h2>
                <div className="cart2-pay" role="radiogroup" aria-label="Payment method">
                  {(
                    [
                      ['card', 'Card'],
                      ['paypal', 'PayPal'],
                      ['bank', 'Bank'],
                      ['usdt', 'USDT'],
                      ['cash', 'Cash'],
                    ] as const
                  ).map(([id, label]) => (
                    <label key={id} className={pay === id ? 'on' : undefined}>
                      <input
                        type="radio"
                        name="pay"
                        checked={pay === id}
                        onChange={() => setPay(id)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <p className="cart2-pay-hint">
                  {
                    (
                      {
                        card: 'Pay at checkout',
                        paypal: 'Pay with PayPal',
                        bank: 'Staff confirms bank transfer',
                        usdt: 'Staff confirms crypto payment',
                        cash: 'Pay on pickup / collect',
                      } as const
                    )[pay]
                  }
                </p>

                {err ? (
                  <p className="tiny imei-err" role="alert">
                    {err}
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="btn btn-primary store-checkout-btn"
                  disabled={busy}
                >
                  {busy
                    ? 'Placing order…'
                    : pay === 'bank' || pay === 'usdt' || pay === 'cash'
                      ? `Place order · ${money(total)}`
                      : `Pay with ${pay === 'paypal' ? 'PayPal' : 'card'} · ${money(total)}`}
                </button>
                <p className="muted tiny cart2-terms">
                  By placing this order you accept the store terms and the trade-in inspection
                  policy. Credit never exceeds your cart total.
                </p>
              </section>
            </div>

            {summary(false)}
            <div className="ck-mobile-bar" role="region" aria-label="Order total">
              <div>
                <span className="muted tiny">
                  {itemCount} item{itemCount === 1 ? '' : 's'}
                  {!quote.quoted ? ' · shipping TBD' : ''}
                </span>
                <strong>{money(total)}</strong>
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Placing…' : 'Place order'}
              </button>
            </div>
          </form>
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
