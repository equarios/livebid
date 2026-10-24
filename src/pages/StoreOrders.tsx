import { FormEvent, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { StoreRail } from '../components/StoreRail'
import { StoreBlockSkeleton } from '../components/StoreSkeleton'
import { api, type StoreOrderDto } from '../lib/api'
import {
  COLLECTED_LABEL,
  FULFILLMENT_LABELS,
  READY_FOR_COLLECT_LABEL,
  SHIPPED_LABEL,
  trackingHref,
  trackingLabel,
} from '../lib/fulfillment'
import { moneyUsd, usd } from '../lib/format'
import { storeProductFallback } from '../lib/storePhotos'
import { useStore } from '../store'
import type { FulfillmentMode } from '../types'

function orderMoney(o: StoreOrderDto) {
  const code = (o.displayCurrency || 'USD').toUpperCase()
  if (code !== 'USD' && o.displayTotal != null) {
    return `${moneyUsd(o.displayTotal, code)} · ${usd(o.total)}`
  }
  return usd(o.total)
}

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  paid: 'Paid',
  shipped: SHIPPED_LABEL,
  cancelled: 'Cancelled',
}

const PAY_LABEL: Record<string, string> = {
  card: 'Card',
  paypal: 'PayPal',
  bank: 'Bank transfer',
  usdt: 'USDT',
  cash: 'Cash',
}

function statusLabel(status: string) {
  return STATUS_LABEL[status] || status.replace(/_/g, ' ')
}

function payLabel(method: string) {
  return PAY_LABEL[method] || method
}

function lineThumb(l: StoreOrderDto['lines'][0]) {
  return l.imageUrl || storeProductFallback({ title: l.title })
}

type Step = { key: string; label: string; done: boolean; current: boolean }

function orderSteps(o: StoreOrderDto): Step[] {
  if (o.status === 'cancelled') {
    return [
      { key: 'placed', label: 'Placed', done: true, current: false },
      { key: 'cancelled', label: 'Cancelled', done: true, current: true },
    ]
  }
  const collect =
    o.fulfillmentMode === 'pickup' || o.fulfillmentMode === 'buyer_courier'
  const paid = o.status === 'paid' || o.status === 'shipped'
  const ready = Boolean(o.readyForCollect) || o.status === 'shipped'
  const done = o.status === 'shipped'
  const awaitingPay = o.status === 'pending_payment'

  const step3Label = collect
    ? ready && !done
      ? READY_FOR_COLLECT_LABEL
      : done
        ? COLLECTED_LABEL
        : 'Ready to collect'
    : done
      ? SHIPPED_LABEL
      : 'Shipped'

  return [
    { key: 'placed', label: 'Placed', done: true, current: awaitingPay },
    {
      key: 'paid',
      label: 'Paid',
      done: paid,
      current: o.status === 'paid' && !ready,
    },
    {
      key: 'fulfill',
      label: step3Label,
      done: done || (collect && ready),
      current: paid && ready && !done ? true : paid && !ready && !awaitingPay,
    },
    {
      key: 'done',
      label: 'Done',
      done,
      current: done,
    },
  ]
}

function primaryAction(o: StoreOrderDto): { label: string; href?: string; hint?: string } | null {
  if (o.status === 'cancelled') return null
  if (o.status === 'pending_payment') {
    if (o.paymentMethod === 'bank') {
      return { label: 'Awaiting bank transfer', hint: `Include order ${o.id} in the remittance.` }
    }
    if (o.paymentMethod === 'usdt') {
      return { label: 'Awaiting USDT', hint: `Include order ${o.id} in the memo. Ask staff for wallet + network.` }
    }
    if (o.paymentMethod === 'cash') {
      return { label: 'Pay cash on collect', hint: `Bring exact amount for order ${o.id}.` }
    }
    return { label: 'Payment recorded', hint: 'Demo card/PayPal — staff may still confirm fulfillment.' }
  }
  const collect =
    o.fulfillmentMode === 'pickup' || o.fulfillmentMode === 'buyer_courier'
  if (collect && o.readyForCollect && o.status !== 'shipped') {
    return { label: READY_FOR_COLLECT_LABEL, hint: 'Bring your order id when you arrive.' }
  }
  if (o.trackingNo) {
    const href = trackingHref(o.courierCarrier, o.trackingNo)
    return {
      label: `Track · ${trackingLabel(o.courierCarrier, o.trackingNo)}`,
      href: href || undefined,
      hint: href ? undefined : trackingLabel(o.courierCarrier, o.trackingNo),
    }
  }
  if (o.status === 'shipped' && collect) {
    return { label: COLLECTED_LABEL }
  }
  if (o.status === 'paid') {
    return { label: 'Preparing your order', hint: 'We’ll update this page when it’s ready.' }
  }
  return null
}

function OrderCard({
  order: o,
  open,
  onToggle,
}: {
  order: StoreOrderDto
  open: boolean
  onToggle: () => void
}) {
  const steps = orderSteps(o)
  const action = primaryAction(o)
  const thumbs = o.lines.slice(0, 4)

  return (
    <article className={`store-order-card${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="store-order-summary"
        aria-expanded={open}
        onClick={onToggle}
      >
        <div className="store-order-thumbs" aria-hidden>
          {thumbs.map((l) => (
            <img
              key={l.id}
              src={lineThumb(l)}
              alt=""
              onError={(e) => {
                e.currentTarget.onerror = null
                e.currentTarget.src = storeProductFallback({ title: l.title })
              }}
            />
          ))}
        </div>
        <div className="store-order-summary-main">
          <span className="mono store-order-id">{o.id}</span>
          <span className="muted tiny store-order-meta">
            {payLabel(o.paymentMethod)} ·{' '}
            {FULFILLMENT_LABELS[(o.fulfillmentMode as FulfillmentMode) || 'delivery']}
          </span>
        </div>
        <span className="store-order-badge">{statusLabel(o.status)}</span>
        <strong className="store-order-total">{orderMoney(o)}</strong>
      </button>

      <ol className="store-order-steps" aria-label="Order progress">
        {steps.map((s) => (
          <li
            key={s.key}
            className={
              s.done ? 'is-done' : s.current ? 'is-current' : undefined
            }
          >
            <span>{s.label}</span>
          </li>
        ))}
      </ol>

      {action ? (
        <div className="store-order-action">
          {action.href ? (
            <a
              className="btn btn-primary btn-sm"
              href={action.href}
              target="_blank"
              rel="noreferrer"
            >
              {action.label}
            </a>
          ) : (
            <span className="store-order-action-label">{action.label}</span>
          )}
          {action.hint ? <p className="muted tiny">{action.hint}</p> : null}
        </div>
      ) : null}

      {open ? (
        <div className="store-order-detail">
          <p className="tiny muted">
            {o.name} · {o.email}
            {o.phone ? ` · ${o.phone}` : ''}
          </p>
          <p className="store-order-address">{o.address}</p>
          {o.note ? <p className="tiny muted">Note: {o.note}</p> : null}
          {o.paymentMethod === 'bank' && o.status === 'pending_payment' ? (
            <p className="tiny store-order-bank-hint">
              Bank transfer — staff will confirm when funds clear. Include order{' '}
              <span className="mono">{o.id}</span> in the remittance.
            </p>
          ) : null}
          {o.paymentMethod === 'usdt' && o.status === 'pending_payment' ? (
            <p className="tiny store-order-bank-hint">
              USDT — staff will confirm when the transfer clears. Include order{' '}
              <span className="mono">{o.id}</span> in the memo / note, and ask staff for the
              wallet address and network (e.g. TRC-20 / ERC-20).
            </p>
          ) : null}
          {o.paymentMethod === 'cash' && o.status === 'pending_payment' ? (
            <p className="tiny store-order-bank-hint">
              Cash — bring exact amount when you collect. Staff marks paid on receipt. Order{' '}
              <span className="mono">{o.id}</span>.
            </p>
          ) : null}
          <ul className="store-order-lines">
            {o.lines.map((l) => (
              <li key={l.id}>
                <div className="store-order-line-main">
                  <img
                    className="store-order-line-thumb"
                    src={lineThumb(l)}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src = storeProductFallback({ title: l.title })
                    }}
                  />
                  <span>
                    {l.slug ? (
                      <Link to={`/store/p/${l.slug}`}>{l.qty}× {l.title}</Link>
                    ) : (
                      <>
                        {l.qty}× {l.title}
                      </>
                    )}
                  </span>
                </div>
                <span>{usd(l.unitPrice * l.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="store-order-totals tiny">
            <span>Subtotal {usd(o.subtotal)}</span>
            {(o.discount || 0) > 0 ? (
              <span>
                Promo {o.promoCode ? `${o.promoCode} ` : ''}−{usd(o.discount || 0)}
              </span>
            ) : null}
            <span>Shipping {usd(o.shippingFee)}</span>
            {(o.tax || 0) > 0 ? <span>Tax {usd(o.tax || 0)}</span> : null}
            {o.tradeIn ? (
              <div className="store-order-tradein">
                <span>
                  Trade-in{' '}
                  {(o.tradeInCredit || 0) > 0
                    ? `−${usd(o.tradeInCredit || 0)}`
                    : o.tradeIn.finalCredit != null && o.tradeIn.finalCredit > 0
                      ? `−${usd(o.tradeIn.finalCredit)}`
                      : '(quote after inspection)'}
                  {o.tradeIn.label ? ` · ${o.tradeIn.label}` : ''}
                  {o.tradeIn.imei ? ` · IMEI ${o.tradeIn.imei}` : ''}
                </span>
                <ol className="store-order-tradein-steps" aria-label="Trade-in status">
                  {(
                    [
                      ['pending_receive', 'Ship device'],
                      ['received', 'Received'],
                      ['accepted', 'Credit final'],
                    ] as const
                  ).map(([id, label]) => {
                    const status = o.tradeIn!.status
                    const rejected = status === 'rejected'
                    const adjusted = status === 'adjusted'
                    const order = ['pending_receive', 'received', 'accepted'] as const
                    const cur =
                      status === 'adjusted'
                        ? 2
                        : status === 'rejected'
                          ? -1
                          : Math.max(0, order.indexOf(status as (typeof order)[number]))
                    const stepIx = order.indexOf(id)
                    const done = !rejected && cur >= stepIx
                    const current = !rejected && cur === stepIx
                    return (
                      <li
                        key={id}
                        className={`store-order-tradein-step${done ? ' is-done' : ''}${
                          current ? ' is-current' : ''
                        }${rejected && id === 'pending_receive' ? ' is-rejected' : ''}`}
                      >
                        {rejected && id === 'accepted'
                          ? 'Not accepted'
                          : adjusted && id === 'accepted'
                            ? 'Credit adjusted'
                            : label}
                      </li>
                    )
                  })}
                </ol>
                <p className="muted tiny">
                  Status: {o.tradeIn.status.replace(/_/g, ' ')}
                  {o.tradeIn.staffNote ? ` · ${o.tradeIn.staffNote}` : ''}
                  {' · '}Check your email for ship-in / QC updates.
                </p>
                {o.tradeIn.images?.length ? (
                  <div className="store-order-trade-thumbs" aria-label="Trade-in photos">
                    {o.tradeIn.images.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="store-order-trade-thumb"
                      >
                        <img src={url} alt="" />
                      </a>
                    ))}
                  </div>
                ) : null}
                {o.tradeIn.videoUrl ? (
                  <div className="store-order-trade-video">
                    <video src={o.tradeIn.videoUrl} controls playsInline preload="metadata" />
                  </div>
                ) : null}
              </div>
            ) : null}
            <strong>Total {usd(o.total)}</strong>
          </div>
          <div className="store-order-again">
            <Link to="/store" className="btn btn-ghost btn-sm">
              Buy again
            </Link>
            <Link
              to={`/support?order=${encodeURIComponent(o.id)}#enquiry`}
              className="linkish tiny store-order-help"
            >
              Need help with this order?
            </Link>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export function StoreOrders() {
  const { settings, user } = useStore()
  const [params] = useSearchParams()
  const placed = params.get('placed')
  const pay = params.get('pay')
  const [orders, setOrders] = useState<StoreOrderDto[]>([])
  const [guestOrder, setGuestOrder] = useState<StoreOrderDto | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(() => placed)
  const [lookupId, setLookupId] = useState(() => placed || '')
  const [lookupEmail, setLookupEmail] = useState('')
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupErr, setLookupErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    let alive = true
    void api
      .storeOrders()
      .then((res) => {
        if (alive) setOrders(res.orders)
      })
      .catch((e) => {
        if (alive) setErr(e instanceof Error ? e.message : 'Could not load orders.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [user])

  async function onLookup(e: FormEvent) {
    e.preventDefault()
    setLookupErr(null)
    setLookupBusy(true)
    try {
      const res = await api.lookupStoreOrder({ id: lookupId.trim(), email: lookupEmail.trim() })
      setGuestOrder(res.order)
      setOpenId(res.order.id)
    } catch (ex) {
      setGuestOrder(null)
      setLookupErr(ex instanceof Error ? ex.message : 'Order not found.')
    } finally {
      setLookupBusy(false)
    }
  }

  if (!settings.showStore) {
    return (
      <PublicShell mode="consumer">
        <p className="muted store-off-note">Retail store is turned off.</p>
      </PublicShell>
    )
  }

  const storeName = settings.storeLabel || 'Store'
  const count = !user ? (guestOrder ? 1 : null) : loading ? '…' : orders.length
  const list = user ? orders : guestOrder ? [guestOrder] : []

  return (
    <PublicShell mode="consumer">
      <div className="retail-store store-orders-desk">
        <StoreRail
          page="orders"
          title="Orders"
          headline="Your orders"
          count={count != null && count !== '' && count !== 0 ? count : null}
          note="Track payments, delivery, and trade-in status in one place."
          label={storeName}
          hero
          trust={['Payment & shipping updates', 'Trade-in QC status', 'Reorder anytime']}
        />

        {placed ? (
          <div className="retail-toast shop-toast store-order-confirm" role="status">
            <p>
              Order <strong className="mono">{placed}</strong> placed
              {pay === 'bank'
                ? ' — awaiting bank transfer confirmation.'
                : pay === 'usdt'
                  ? ' — awaiting USDT confirmation.'
                  : pay === 'cash'
                    ? ' — pay cash when you collect.'
                    : pay === 'paypal' || pay === 'card'
                      ? ' — payment recorded (demo).'
                      : '.'}{' '}
              Thank you.
            </p>
            <Link to="/store" className="btn btn-primary btn-sm">
              Keep shopping
            </Link>
          </div>
        ) : null}

        {!user ? (
          <form className="store-order-lookup store-order-lookup-panel" onSubmit={(e) => void onLookup(e)}>
            <h3>Find your order</h3>
            <p className="muted tiny">
              Enter the order id and the email used at checkout. Or{' '}
              <Link to="/login" state={{ from: '/store/orders' }}>
                sign in
              </Link>{' '}
              to see all orders on your account.
            </p>
            <div className="store-order-lookup-fields">
              <label className="field">
                <span>Order id</span>
                <input
                  required
                  value={lookupId}
                  onChange={(e) => setLookupId(e.target.value)}
                  placeholder="e.g. SO-…"
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  required
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <button type="submit" className="btn btn-primary btn-sm" disabled={lookupBusy}>
                {lookupBusy ? 'Looking up…' : 'Find order'}
              </button>
            </div>
            {lookupErr ? (
              <p className="tiny imei-err" role="alert">
                {lookupErr}
              </p>
            ) : null}
          </form>
        ) : null}

        {user && loading ? (
          <StoreBlockSkeleton rows={4} />
        ) : user && err ? (
          <p className="tiny imei-err">{err}</p>
        ) : user && !orders.length ? (
          <div className="store-page-empty">
            <p className="store-page-empty-title">No orders yet</p>
            <p className="muted">When you check out, your receipts and trade-ins show up here.</p>
            <div className="store-page-empty-actions">
              <Link to="/store" className="btn btn-primary">
                Continue shopping
              </Link>
              <Link to="/store/trade-in" className="btn btn-ghost">
                Start a trade-in
              </Link>
            </div>
          </div>
        ) : list.length ? (
          <div className="store-orders-list">
            {list.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                open={openId === o.id}
                onToggle={() => setOpenId(openId === o.id ? null : o.id)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </PublicShell>
  )
}
