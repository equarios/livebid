import { useEffect, useMemo, useState } from 'react'
import { api, type StoreOrderDto } from '../lib/api'
import { FULFILLMENT_LABELS, formatShippingMoney, localIsoDate } from '../lib/fulfillment'
import { usd } from '../lib/format'
import { toastMsg } from '../lib/toast'
import { useStore } from '../store'
import type { FulfillmentMode, Invoice } from '../types'

type Filter = 'today' | 'ready' | 'courier' | 'tbd' | 'all'

function invOpen(inv: Invoice) {
  return (
    inv.status !== 'declined' &&
    inv.status !== 'draft' &&
    !inv.shippedAt &&
    !inv.shippingAddendum
  )
}

export function FulfillmentQueue() {
  const { invoices, accounts } = useStore()
  const [orders, setOrders] = useState<StoreOrderDto[]>([])
  const [filter, setFilter] = useState<Filter>('today')
  const [busy, setBusy] = useState(false)
  const [msg, setMsgState] = useState<string | null>(null)
  function setMsg(next: string | null) {
    setMsgState(next)
    toastMsg(next)
  }
  const [quoteId, setQuoteId] = useState<string | null>(null)
  const [quoteFee, setQuoteFee] = useState('12')
  const today = localIsoDate()

  async function refreshOrders() {
    try {
      const res = await api.storeOrders()
      setOrders(res.orders)
    } catch {
      setOrders([])
    }
  }

  useEffect(() => {
    void refreshOrders()
  }, [])

  const invRows = useMemo(() => {
    return invoices.filter((i) => {
      if (!invOpen(i) || i.shippingAddendum) return false
      if (filter === 'today') {
        return i.fulfillmentMode === 'pickup' && i.pickupDate === today
      }
      if (filter === 'ready') return Boolean(i.readyForCollect)
      if (filter === 'courier') {
        return i.fulfillmentMode === 'buyer_courier' && !i.readyForCollect
      }
      if (filter === 'tbd') {
        return i.fulfillmentMode === 'delivery' && i.shippingFeeQuoted === false
      }
      return Boolean(
        i.readyForCollect ||
          i.fulfillmentMode === 'buyer_courier' ||
          i.shippingFeeQuoted === false ||
          (i.fulfillmentMode === 'pickup' && i.pickupDate),
      )
    })
  }, [invoices, filter, today])

  const storeRows = useMemo(() => {
    return orders.filter((o) => {
      if (o.status === 'cancelled' || o.status === 'shipped') return false
      if (filter === 'today') {
        return o.fulfillmentMode === 'pickup' && o.pickupDate === today
      }
      if (filter === 'ready') return Boolean(o.readyForCollect) && o.status === 'paid'
      if (filter === 'courier') {
        return o.fulfillmentMode === 'buyer_courier' && !o.readyForCollect
      }
      if (filter === 'tbd') {
        return o.fulfillmentMode === 'delivery' && o.shippingFeeQuoted === false
      }
      return Boolean(
        o.readyForCollect ||
          o.fulfillmentMode === 'buyer_courier' ||
          o.shippingFeeQuoted === false ||
          (o.fulfillmentMode === 'pickup' && o.pickupDate),
      )
    })
  }, [orders, filter, today])

  async function markInvReady(inv: Invoice) {
    setBusy(true)
    setMsg(null)
    try {
      await api.setInvoiceFulfillment(inv.id, {
        fulfillmentMode: (inv.fulfillmentMode || 'pickup') as FulfillmentMode,
        courierCarrier: inv.courierCarrier,
        courierAccount: inv.courierAccount,
        readyForCollect: true,
      })
      setMsg(`${inv.id} marked ready for collect`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function markStoreReady(o: StoreOrderDto) {
    setBusy(true)
    setMsg(null)
    try {
      await api.updateStoreOrder(o.id, { readyForCollect: true })
      setMsg(`${o.id} marked ready for collect`)
      await refreshOrders()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function quoteStore(o: StoreOrderDto) {
    setBusy(true)
    setMsg(null)
    try {
      const fee = Math.max(0, Number(quoteFee) || 0)
      const res = await api.updateStoreOrder(o.id, { shippingFee: fee, shippingFeeQuoted: true })
      const shipId = res.shippingInvoiceId || ''
      setMsg(
        shipId
          ? `${o.id} quoted ${usd(fee)} · shipping invoice ${shipId} emailed`
          : `${o.id} delivery quoted at ${usd(fee)}`,
      )
      setQuoteId(null)
      await refreshOrders()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Quote failed')
    } finally {
      setBusy(false)
    }
  }

  async function quoteInv(inv: Invoice) {
    setBusy(true)
    setMsg(null)
    try {
      const fee = Math.max(0, Number(quoteFee) || 0)
      const res = await api.setInvoiceFulfillment(inv.id, {
        fulfillmentMode: 'delivery',
        shippingFee: fee,
      })
      const shipId = res.shippingInvoiceId || ''
      setMsg(
        shipId
          ? `${inv.id} quoted ${usd(fee)} · shipping invoice ${shipId} emailed`
          : `${inv.id} delivery quoted at ${usd(fee)}`,
      )
      setQuoteId(null)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Quote failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mh-desk">
      <header className="mh-desk-head">
        <h2>
          Fulfillment queue
          <em>{invRows.length + storeRows.length}</em>
        </h2>
        <p className="mh-desk-note">
          Ready for collect, awaiting buyer courier, and delivery fees still TBD.
        </p>
        <div className="mh-desk-actions">
          {(
            [
              ['today', "Today's collects"],
              ['ready', 'Ready for collect'],
              ['courier', 'Awaiting courier'],
              ['tbd', 'Fee TBD'],
              ['all', 'All open'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn btn-ghost btn-sm ${filter === id ? 'on' : ''}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void refreshOrders()}>
            Refresh
          </button>
        </div>
      </header>
      {msg ? <p className="tiny imei-msg">{msg}</p> : null}

      {!invRows.length && !storeRows.length ? (
        <p className="muted tiny">Nothing in this queue.</p>
      ) : (
        <div className="store-orders-list">
          {invRows.map((inv) => {
            const who = accounts.find((a) => a.accountId === inv.accountId)
            return (
              <article key={inv.id} className="store-order-card is-open">
                <div className="store-order-summary" style={{ cursor: 'default' }}>
                  <span className="mono store-order-id">{inv.id}</span>
                  <span className="store-order-badge">Invoice</span>
                  <span className="muted tiny">
                    {FULFILLMENT_LABELS[inv.fulfillmentMode || 'pickup']}
                    {inv.courierCarrier ? ` · ${inv.courierCarrier}` : ''}
                  </span>
                  <strong className="store-order-total">
                    {formatShippingMoney(inv.shippingFee || 0, inv.shippingFeeQuoted, usd)}
                  </strong>
                </div>
                <div className="store-order-detail">
                  <p className="tiny muted">
                    {who?.company || inv.accountId || '—'}
                    {inv.readyForCollect ? ' · Ready' : ''}
                    {inv.pickupDate
                      ? ` · ${inv.pickupDate}${inv.pickupSlot ? ` ${inv.pickupSlot}` : ''}`
                      : ''}
                  </p>
                  <div className="imei-row-actions">
                    {!inv.readyForCollect &&
                    (inv.fulfillmentMode === 'pickup' ||
                      inv.fulfillmentMode === 'buyer_courier') ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => void markInvReady(inv)}
                      >
                        Ready for collect
                      </button>
                    ) : null}
                    {inv.shippingFeeQuoted === false ? (
                      quoteId === inv.id ? (
                        <>
                          <input
                            className="retail-qty"
                            style={{ width: 88 }}
                            type="number"
                            min={0}
                            step={0.01}
                            value={quoteFee}
                            onChange={(e) => setQuoteFee(e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busy}
                            onClick={() => void quoteInv(inv)}
                          >
                            Save quote
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setQuoteId(inv.id)
                            setQuoteFee(String(inv.shippingFee || 12))
                          }}
                        >
                          Quote delivery
                        </button>
                      )
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
          {storeRows.map((o) => (
            <article key={o.id} className="store-order-card is-open">
              <div className="store-order-summary" style={{ cursor: 'default' }}>
                <span className="mono store-order-id">{o.id}</span>
                <span className="store-order-badge">Store</span>
                <span className="muted tiny">
                  {FULFILLMENT_LABELS[o.fulfillmentMode || 'delivery']}
                  {o.courierCarrier ? ` · ${o.courierCarrier}` : ''}
                </span>
                <strong className="store-order-total">
                  {formatShippingMoney(o.shippingFee, o.shippingFeeQuoted, usd)}
                </strong>
              </div>
              <div className="store-order-detail">
                <p className="tiny muted">
                  {o.name} · {o.email}
                  {o.readyForCollect ? ' · Ready' : ''}
                  {o.pickupDate
                    ? ` · ${o.pickupDate}${o.pickupSlot ? ` ${o.pickupSlot}` : ''}`
                    : ''}
                </p>
                <div className="imei-row-actions">
                  {o.status === 'paid' &&
                  !o.readyForCollect &&
                  (o.fulfillmentMode === 'pickup' || o.fulfillmentMode === 'buyer_courier') ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => void markStoreReady(o)}
                    >
                      Ready for collect
                    </button>
                  ) : null}
                  {o.shippingFeeQuoted === false ? (
                    quoteId === o.id ? (
                      <>
                        <input
                          className="retail-qty"
                          style={{ width: 88 }}
                          type="number"
                          min={0}
                          step={0.01}
                          value={quoteFee}
                          onChange={(e) => setQuoteFee(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busy}
                          onClick={() => void quoteStore(o)}
                        >
                          Save quote
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setQuoteId(o.id)
                          setQuoteFee(String(o.shippingFee || 12))
                        }}
                      >
                        Quote delivery
                      </button>
                    )
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
