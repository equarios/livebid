import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { InvoicePreview } from '../components/InvoicePreview'
import { PaymentSubmitDialog } from '../components/PaymentSubmitDialog'
import { api } from '../lib/api'
import {
  DEFAULT_FULFILLMENT,
  FULFILLMENT_LABELS,
  earliestPickupDate,
  trackingHref,
  trackingLabel,
  COLLECTED_LABEL,
  READY_FOR_COLLECT_LABEL,
} from '../lib/fulfillment'
import {
  buyerNumber,
  clientInvoiceLabel,
  invoiceDueLabel,
  invoiceLines,
  invoiceSteps,
  invoiceTotals,
  invoiceVisibleToBuyer,
  type InvoiceStep,
} from '../lib/invoices'
import { gbsDate, moneyPlain, moneyUsd } from '../lib/format'
import { lotItemSub, lotItemTitle } from '../lib/itemLine'
import { pushToast } from '../lib/toast'
import { useNow, useStore } from '../store'
import type { FulfillmentMode, Invoice } from '../types'

function TrackingLink({
  carrier,
  trackingNo,
}: {
  carrier?: string | null
  trackingNo: string
}) {
  const href = trackingHref(carrier, trackingNo)
  const label = trackingLabel(carrier, trackingNo)
  if (!href) return <span className="mono">{label}</span>
  return (
    <a className="inv-track" href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  )
}

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5zm1.4.7 7.1 4.4c.3.2.7.2 1 0l7.1-4.4-.8-1.3-6.8 4.2-6.8-4.2z"
      />
    </svg>
  )
}

function StepDots({ steps }: { steps: InvoiceStep[] }) {
  return (
    <div className="inv-steps" title={steps.map((s) => s.label).join(' → ')}>
      <span className="inv-step-dots" aria-hidden>
        {steps.map((step) => (
          <i
            key={step.key}
            className={step.done ? 'is-done' : step.current ? 'is-current' : ''}
          />
        ))}
      </span>
    </div>
  )
}

function rowMeta(inv: Invoice) {
  return {
    label: clientInvoiceLabel(inv),
    steps: invoiceSteps(inv),
    lines: invoiceLines(inv),
  }
}

export function Invoices() {
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const { invoices, lots, settings, user, accounts, markInvoiceOpened } = useStore()
  const [payId, setPayId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [fulfillId, setFulfillId] = useState<string | null>(null)
  const [fulfillMode, setFulfillMode] = useState<FulfillmentMode>('pickup')
  const [courierCarrier, setCourierCarrier] = useState('FedEx')
  const [courierAccount, setCourierAccount] = useState('')
  const [shipAddress, setShipAddress] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [pickupSlot, setPickupSlot] = useState('')
  const [slotOcc, setSlotOcc] = useState<
    Array<{ slot: string; remaining: number | null; full: boolean }>
  >([])
  const [fulfillBusy, setFulfillBusy] = useState(false)
  const [localFulfill, setLocalFulfill] = useState<
    Record<string, Partial<Invoice>>
  >({})
  const [notice, setNotice] = useState<string | null>(null)
  const [unopened, setUnopened] = useState(false)
  const [poOnly, setPoOnly] = useState(false)
  const copy = settings.copy
  const fulfillCfg = settings.fulfillment || DEFAULT_FULFILLMENT

  const rows = useMemo(() => {
    return invoices
      .filter((inv) => invoiceVisibleToBuyer(inv))
      .filter((inv) => !inv.accountId || inv.accountId === user?.accountId)
      .filter((inv) => (unopened ? !inv.opened : true))
      .filter((inv) => (poOnly ? Boolean(inv.poNumber) : true))
      .map((inv) => ({ ...inv, ...(localFulfill[inv.id] || {}) }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [invoices, user, unopened, poOnly, localFulfill])

  function openFulfill(inv: Invoice) {
    const acct = accounts.find((a) => a.accountId === user?.accountId)
    setFulfillId(inv.id)
    setFulfillMode(
      inv.fulfillmentMode ||
        acct?.preferredFulfillmentMode ||
        fulfillCfg.defaultWholesaleMode,
    )
    setCourierCarrier(inv.courierCarrier || acct?.courierCarrier || 'FedEx')
    setCourierAccount(inv.courierAccount || acct?.courierAccount || '')
    setShipAddress(inv.shipAddress || acct?.address || '')
    setPickupDate(inv.pickupDate || earliestPickupDate(fulfillCfg))
    setPickupSlot(inv.pickupSlot || fulfillCfg.pickupSlots[0] || '')
  }

  useEffect(() => {
    if (!fulfillId || fulfillMode !== 'pickup' || !pickupDate) {
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
  }, [fulfillId, fulfillMode, pickupDate])

  async function saveFulfillment() {
    if (!fulfillId) return
    if (fulfillMode === 'pickup' && (!pickupDate || !pickupSlot)) {
      setNotice('Choose a pickup date and time window.')
      return
    }
    setFulfillBusy(true)
    try {
      const res = await api.setInvoiceFulfillment(fulfillId, {
        fulfillmentMode: fulfillMode,
        courierCarrier: fulfillMode === 'buyer_courier' ? courierCarrier : undefined,
        courierAccount: fulfillMode === 'buyer_courier' ? courierAccount || undefined : undefined,
        shipAddress: fulfillMode === 'delivery' ? shipAddress : undefined,
        pickupDate: fulfillMode === 'pickup' ? pickupDate : undefined,
        pickupSlot: fulfillMode === 'pickup' ? pickupSlot : undefined,
      })
      const patched = res.invoice as Invoice
      setLocalFulfill((prev) => ({
        ...prev,
        [fulfillId]: {
          fulfillmentMode: patched.fulfillmentMode || fulfillMode,
          courierCarrier: patched.courierCarrier,
          courierAccount: patched.courierAccount,
          shipAddress: patched.shipAddress,
          shippingFee: patched.shippingFee,
          shippingFeeQuoted: patched.shippingFeeQuoted,
          readyForCollect: patched.readyForCollect,
          pickupDate: patched.pickupDate,
          pickupSlot: patched.pickupSlot,
        },
      }))
      const text = `Fulfillment saved on ${fulfillId}.`
      setNotice(text)
      pushToast(text, 'ok', { href: '/account/invoices', label: 'Invoices' })
      setFulfillId(null)
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Could not save fulfillment.'
      setNotice(text)
      pushToast(text, 'err')
    } finally {
      setFulfillBusy(false)
    }
  }

  const paying = rows.find((inv) => inv.id === payId) || invoices.find((inv) => inv.id === payId) || null
  const preview = rows.find((inv) => inv.id === previewId) || invoices.find((inv) => inv.id === previewId) || null
  const account = accounts.find((a) => a.accountId === user?.accountId)
  const company = (account?.company || user?.company || '').trim()
  const myBuyerNo = user ? buyerNumber(user.accountId, account?.buyerNumber) : ''
  const currency = settings.invoice.currency || 'USD'

  useEffect(() => {
    const raw = (params.get('pay') || '').trim().toUpperCase()
    if (!raw || !user) return
    const inv = invoices.find((i) => i.id === raw)
    if (!inv) return
    if (inv.accountId && inv.accountId !== user.accountId) return
    if (clientInvoiceLabel(inv) !== 'Awaiting Payment') return
    markInvoiceOpened(inv.id)
    setPayId(inv.id)
    const next = new URLSearchParams(params)
    next.delete('pay')
    setParams(next, { replace: true })
  }, [params, setParams, invoices, user, markInvoiceOpened])

  function openInvoice(invId: string, payIfAwaiting = false) {
    const inv = invoices.find((i) => i.id === invId)
    if (!inv) return
    markInvoiceOpened(inv.id)
    if (payIfAwaiting && clientInvoiceLabel(inv) === 'Awaiting Payment') {
      setPayId(inv.id)
      return
    }
    setPreviewId(inv.id)
  }

  const awaitingCount = rows.filter((inv) => clientInvoiceLabel(inv) === 'Awaiting Payment').length
  const noteParts = [
    company || null,
    myBuyerNo ? `Buyer # ${myBuyerNo}` : null,
    'Pay from issue date — unpaid lots can reopen.',
  ].filter(Boolean)

  return (
    <div className="inv-page mh-desk">
      <header className="mh-desk-head">
        <h2>
          Invoices
          <em>{rows.length}</em>
          {awaitingCount ? <em className="is-lose">Awaiting {awaitingCount}</em> : null}
        </h2>
        <p className="mh-desk-note">{noteParts.join(' · ')}</p>
        <div className="mh-desk-actions">
          <label className="auction-command-flag">
            <input type="checkbox" checked={unopened} onChange={(e) => setUnopened(e.target.checked)} />
            Unopened
          </label>
          <label className="auction-command-flag">
            <input type="checkbox" checked={poOnly} onChange={(e) => setPoOnly(e.target.checked)} />
            PO only
          </label>
        </div>
      </header>

      {notice ? <p className="ok tiny">{notice}</p> : null}

      {!rows.length ? (
        <div className="mh-empty">
          <p>{copy.emptyInvoices}</p>
        </div>
      ) : (
        <div className="mh-table-wrap desk-list-scroll" role="region" aria-label="Invoices">
          <table className="gbs-table mh-table inv-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Date</th>
                <th>Pay by</th>
                <th>Items</th>
                <th>Quantity</th>
                <th>Total ({currency})</th>
                <th>Tracking</th>
                <th>Invoice #</th>
                <th>Ship</th>
                <th>Remarks</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const lot = lots.find((l) => l.id === inv.lotId)
                const { label, steps, lines } = rowMeta(inv)
                const awaiting = label === 'Awaiting Payment'
                const totals = invoiceTotals(inv, settings)
                const auction = inv.auctionLabel || (lot ? lotItemTitle(lot) : inv.lotId)
                return (
                  <tr key={inv.id} className={inv.opened ? '' : 'is-unopened'}>
                    <td className="inv-status-cell">
                      <button
                        type="button"
                        className={`inv-status ${awaiting ? 'is-await' : 'is-shipped'}`}
                        onClick={() => openInvoice(inv.id, true)}
                      >
                        {label}
                      </button>
                      <StepDots steps={steps} />
                    </td>
                    <td>{gbsDate(inv.issuedAt || inv.createdAt)}</td>
                    <td className="inv-due">{invoiceDueLabel(inv, now, settings) || '—'}</td>
                    <td className="inv-model">
                      <div>{auction}</div>
                      <div className="muted tiny">
                        {lines.length > 1
                          ? `${lines.length} line items`
                          : lot
                            ? lotItemSub(lot)
                            : moneyPlain(inv.unitPrice) + ' / pc'}
                        {poOnly && inv.poNumber ? ` · PO ${inv.poNumber}` : ''}
                      </div>
                    </td>
                    <td className="inv-qty">{totals.qty.toLocaleString()}</td>
                    <td className="inv-total">{moneyUsd(totals.total, currency)}</td>
                    <td>
                      {inv.fulfillmentMode === 'pickup' ? (
                        <span className="muted">
                          {inv.shippedAt ? COLLECTED_LABEL : inv.readyForCollect ? READY_FOR_COLLECT_LABEL : '—'}
                        </span>
                      ) : inv.trackingNo ? (
                        <TrackingLink carrier={inv.courierCarrier} trackingNo={inv.trackingNo} />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="mono">{inv.id}</td>
                    <td>{inv.shippedAt ? gbsDate(inv.shippedAt) : <span className="muted">—</span>}</td>
                    <td className="inv-remarks">{inv.remarks || <span className="muted">—</span>}</td>
                    <td className="inv-docs">
                      <button
                        type="button"
                        className="inv-doc"
                        title="View invoice"
                        onClick={() => openInvoice(inv.id)}
                      >
                        <EnvelopeIcon />
                        <span className="sr-only">View invoice</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="inv-cards">
        {rows.map((inv) => {
          const lot = lots.find((l) => l.id === inv.lotId)
          const { label, steps, lines } = rowMeta(inv)
          const awaiting = label === 'Awaiting Payment'
          const totals = invoiceTotals(inv, settings)
          return (
            <article key={inv.id} className={`inv-card ${inv.opened ? '' : 'is-unopened'}`}>
              <div className="inv-card-top">
                <button
                  type="button"
                  className={`inv-status ${awaiting ? 'is-await' : 'is-shipped'}`}
                  onClick={() => openInvoice(inv.id, true)}
                >
                  {label}
                </button>
                <button type="button" className="inv-doc" title="View invoice" onClick={() => openInvoice(inv.id)}>
                  <EnvelopeIcon />
                </button>
              </div>
              <StepDots steps={steps} />
              <strong>
                {inv.shippingAddendum
                  ? `Shipping · ${inv.parentInvoiceId || inv.id}`
                  : inv.auctionLabel || (lot ? lotItemTitle(lot) : inv.lotId)}
              </strong>
              <div className="muted tiny mono">
                {inv.id}
                {inv.shippingAddendum ? ' · freight addendum' : ''}
              </div>
              <div className="inv-card-meta">
                <span>{totals.qty.toLocaleString()} pcs</span>
                {lines.length > 1 ? <span>{lines.length} lines</span> : null}
                <span>{moneyUsd(totals.total, currency)}</span>
              </div>
              <div className="muted tiny">
                {gbsDate(inv.issuedAt || inv.createdAt)}
                {invoiceDueLabel(inv, now, settings) ? ` · ${invoiceDueLabel(inv, now, settings)}` : ''}
              </div>
              {inv.shippingAddendum ? (
                <div className="tiny" style={{ marginTop: 8 }}>
                  Freight for {inv.parentInvoiceId || 'order'}
                </div>
              ) : (
                <div className="tiny" style={{ marginTop: 8 }}>
                  {FULFILLMENT_LABELS[inv.fulfillmentMode || fulfillCfg.defaultWholesaleMode]}
                  {inv.readyForCollect ? ` · ${READY_FOR_COLLECT_LABEL}` : ''}
                  {inv.courierCarrier ? ` · ${inv.courierCarrier}` : ''}
                  {inv.fulfillmentMode === 'delivery' && inv.shippingFeeQuoted === false
                    ? ' · Shipping TBD (pay goods now)'
                    : inv.shippingAddendumId
                      ? ` · Ship due on ${inv.shippingAddendumId}`
                      : inv.shippingFee
                        ? ` · Ship ${moneyUsd(inv.shippingFee, currency)}`
                        : ''}
                  {inv.fulfillmentMode === 'pickup' && inv.pickupDate
                    ? ` · ${inv.pickupDate}${inv.pickupSlot ? ` ${inv.pickupSlot}` : ''}`
                    : ''}
                </div>
              )}
              {!inv.shippingAddendum && inv.status !== 'paid' && inv.status !== 'declined' ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 8 }}
                  onClick={() => openFulfill(inv)}
                >
                  Set pickup / delivery
                </button>
              ) : null}
            </article>
          )
        })}
      </div>

      {fulfillId ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 420 }}>
            <h3>Fulfillment · {fulfillId}</h3>
            <p className="muted tiny">
              Pickup, platform delivery, or ship with your own FedEx / UPS / DHL account.
            </p>
            <label className="field">
              <span>Mode</span>
              <select
                value={fulfillMode}
                onChange={(e) => setFulfillMode(e.target.value as FulfillmentMode)}
              >
                {fulfillCfg.wholesaleModes.map((m) => (
                  <option key={m} value={m}>
                    {FULFILLMENT_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            {fulfillMode === 'delivery' ? (
              <label className="field">
                <span>Delivery address</span>
                <textarea
                  rows={3}
                  value={shipAddress}
                  onChange={(e) => setShipAddress(e.target.value)}
                />
              </label>
            ) : null}
            {fulfillMode === 'buyer_courier' ? (
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
                  />
                </label>
              </>
            ) : null}
            {fulfillMode === 'pickup' ? (
              <>
                <p className="muted tiny">
                  {fulfillCfg.pickupLabel} — {fulfillCfg.pickupHours}
                </p>
                <label className="field">
                  <span>Pickup date</span>
                  <input
                    type="date"
                    min={earliestPickupDate(fulfillCfg)}
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Time window</span>
                  <select value={pickupSlot} onChange={(e) => setPickupSlot(e.target.value)}>
                    {(fulfillCfg.pickupSlots || []).map((s) => {
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
            <div className="modal-actions" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={fulfillBusy}
                onClick={() => void saveFulfillment()}
              >
                {fulfillBusy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setFulfillId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? <InvoicePreview invoice={preview} onClose={() => setPreviewId(null)} /> : null}
      {paying ? (
        <PaymentSubmitDialog
          invoice={paying}
          onClose={() => setPayId(null)}
          onDone={(msg) => {
            setPayId(null)
            setNotice(msg)
          }}
        />
      ) : null}
    </div>
  )
}
