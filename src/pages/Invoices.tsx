import { useMemo, useState } from 'react'
import { InvoicePreview } from '../components/InvoicePreview'
import { PaymentSubmitDialog } from '../components/PaymentSubmitDialog'
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
import { useNow, useStore } from '../store'
import type { Invoice } from '../types'

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
  const { invoices, lots, settings, user, accounts, markInvoiceOpened } = useStore()
  const [payId, setPayId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [unopened, setUnopened] = useState(false)
  const [poOnly, setPoOnly] = useState(false)
  const copy = settings.copy

  const rows = useMemo(() => {
    return invoices
      .filter((inv) => invoiceVisibleToBuyer(inv))
      .filter((inv) => !inv.accountId || inv.accountId === user?.accountId)
      .filter((inv) => (unopened ? !inv.opened : true))
      .filter((inv) => (poOnly ? Boolean(inv.poNumber) : true))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [invoices, user, unopened, poOnly])

  const paying = rows.find((inv) => inv.id === payId) || invoices.find((inv) => inv.id === payId) || null
  const preview = rows.find((inv) => inv.id === previewId) || invoices.find((inv) => inv.id === previewId) || null
  const account = accounts.find((a) => a.accountId === user?.accountId)
  const company = (account?.company || user?.company || '').trim()
  const myBuyerNo = user ? buyerNumber(user.accountId, account?.buyerNumber) : ''
  const currency = settings.invoice.currency || 'USD'

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

  return (
    <div className="inv-page">
      <div className="mypage-toolbar">
        <div className="mypage-meta">
          {company ? <span className="mypage-meta-label">{company}</span> : null}
          <em>{rows.length}</em>
          {myBuyerNo ? <em className="is-open">Buyer # {myBuyerNo}</em> : null}
          {awaitingCount ? <em className="is-lose">Awaiting {awaitingCount}</em> : null}
        </div>
        <div className="mypage-toolbar-flags">
          <label className="auction-command-flag">
            <input type="checkbox" checked={unopened} onChange={(e) => setUnopened(e.target.checked)} />
            Unopened
          </label>
          <label className="auction-command-flag">
            <input type="checkbox" checked={poOnly} onChange={(e) => setPoOnly(e.target.checked)} />
            PO only
          </label>
        </div>
      </div>

      <div className="table-wrap gbs-table-wrap">
        <table className="gbs-table inv-table">
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
              const auction = inv.auctionLabel || (lot ? `${lot.manufacturer} ${lot.model}` : inv.lotId)
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
                          ? [lot.capacity, lot.color, lot.grade ? `Grade ${lot.grade}` : '']
                              .filter(Boolean)
                              .join(' · ')
                          : moneyPlain(inv.unitPrice) + ' / pc'}
                      {poOnly && inv.poNumber ? ` · PO ${inv.poNumber}` : ''}
                    </div>
                  </td>
                  <td className="inv-qty">{totals.qty.toLocaleString()}</td>
                  <td className="inv-total">{moneyUsd(totals.total, currency)}</td>
                  <td>
                    {inv.trackingNo ? (
                      <a
                        className="inv-track"
                        href={`https://www.dhl.com/en/express/tracking.html?AWB=${inv.trackingNo}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {inv.trackingNo}
                      </a>
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
        {!rows.length ? <p className="empty">{copy.emptyInvoices}</p> : null}
      </div>

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
              <strong>{inv.auctionLabel || (lot ? `${lot.manufacturer} ${lot.model}` : inv.lotId)}</strong>
              <div className="muted tiny mono">{inv.id}</div>
              <div className="inv-card-meta">
                <span>{totals.qty.toLocaleString()} pcs</span>
                {lines.length > 1 ? <span>{lines.length} lines</span> : null}
                <span>{moneyUsd(totals.total, currency)}</span>
              </div>
              <div className="muted tiny">
                {gbsDate(inv.issuedAt || inv.createdAt)}
                {invoiceDueLabel(inv, now, settings) ? ` · ${invoiceDueLabel(inv, now, settings)}` : ''}
              </div>
            </article>
          )
        })}
      </div>

      {notice ? <p className="ok">{notice}</p> : null}
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
