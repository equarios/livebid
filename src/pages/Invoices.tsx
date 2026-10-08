import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PaymentSubmitDialog } from '../components/PaymentSubmitDialog'
import { auctionNumber, clientInvoiceLabel, invoiceDueLabel, invoiceSteps, printInvoice } from '../lib/invoices'
import { gbsDate, moneyPlain } from '../lib/format'
import { useNow, useStore } from '../store'

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        fill="currentColor"
        d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5zm1.4.7 7.1 4.4c.3.2.7.2 1 0l7.1-4.4-.8-1.3-6.8 4.2-6.8-4.2z"
      />
    </svg>
  )
}

export function Invoices() {
  const now = useNow()
  const { invoices, lots, settings, user, accounts, markInvoiceOpened } = useStore()
  const [payId, setPayId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [unopened, setUnopened] = useState(false)
  const [poOnly, setPoOnly] = useState(false)
  const copy = settings.copy

  const rows = useMemo(() => {
    return invoices
      .filter((inv) => !inv.accountId || inv.accountId === user?.accountId)
      .filter((inv) => (unopened ? !inv.opened : true))
      .filter((inv) => (poOnly ? Boolean(inv.poNumber) : true))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [invoices, user, unopened, poOnly])

  const paying = rows.find((inv) => inv.id === payId) || invoices.find((inv) => inv.id === payId) || null
  const company = (
    accounts.find((a) => a.accountId === user?.accountId)?.company ||
    user?.company ||
    'equarios corporation limited'
  ).toLowerCase()

  return (
    <div className="inv-page">
      <div className="inv-flags">
        <label>
          <input type="checkbox" checked={unopened} onChange={(e) => setUnopened(e.target.checked)} />
          Unopened
        </label>
        <label>
          <input type="checkbox" checked={poOnly} onChange={(e) => setPoOnly(e.target.checked)} />
          PO Number
        </label>
      </div>
      <h2 className="inv-company">{company}</h2>
      <p className="inv-links">
        <Link to="/account/settings">[Edit Account Settings]</Link>
        <Link to="/account">[View your bid history]</Link>
      </p>
      <div className="table-wrap gbs-table-wrap">
        <table className="gbs-table inv-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Invoice Date</th>
              <th>Pay by</th>
              <th>Auction Number</th>
              <th>Model</th>
              <th>Qty</th>
              <th>Price / pc</th>
              <th>Tracking No</th>
              <th>Invoice No</th>
              <th>Shipping Date</th>
              <th>Invoice Total (USD)</th>
              <th>Remarks</th>
              <th>Documents</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => {
              const lot = lots.find((l) => l.id === inv.lotId)
              const label = clientInvoiceLabel(inv)
              const awaiting = label === 'Awaiting Payment'
              return (
                <tr key={inv.id} className={inv.opened ? '' : 'is-unopened'}>
                  <td>
                    <button
                      type="button"
                      className={`inv-status ${awaiting ? 'is-await' : 'is-shipped'}`}
                      onClick={() => {
                        markInvoiceOpened(inv.id)
                        if (awaiting) setPayId(inv.id)
                      }}
                    >
                      {awaiting ? '⚠ ' : ''}
                      {label}
                    </button>
                    <ol className="inv-timeline">
                      {invoiceSteps(inv).map((step) => (
                        <li
                          key={step.key}
                          className={step.done ? 'is-done' : step.current ? 'is-current' : ''}
                        >
                          {step.label}
                        </li>
                      ))}
                    </ol>
                  </td>
                  <td>{gbsDate(inv.createdAt)}</td>
                  <td className="inv-due">{invoiceDueLabel(inv, now) || '—'}</td>
                  <td className="inv-auction">
                    {auctionNumber(inv, lot)}
                    {poOnly && inv.poNumber ? <div className="muted tiny">PO {inv.poNumber}</div> : null}
                  </td>
                  <td className="inv-model">
                    {lot ? (
                      <>
                        <div>
                          {lot.manufacturer} {lot.model}
                          {lot.modelNumber ? ` ${lot.modelNumber}` : ''}
                        </div>
                        <div className="muted tiny">
                          {lot.capacity}
                          {lot.color ? ` · ${lot.color}` : ''}
                          {lot.grade ? ` · Grade ${lot.grade}` : ''}
                        </div>
                      </>
                    ) : (
                      inv.lotId
                    )}
                  </td>
                  <td className="inv-qty">{inv.qty.toLocaleString()}</td>
                  <td className="inv-total">{moneyPlain(inv.unitPrice)}</td>
                  <td>
                    {inv.trackingNo ? (
                      <a className="inv-track" href={`https://www.dhl.com/en/express/tracking.html?AWB=${inv.trackingNo}`} target="_blank" rel="noreferrer">
                        {inv.trackingNo}
                      </a>
                    ) : (
                      ''
                    )}
                  </td>
                  <td>{inv.id.replace(/-\d{4}$/, '')}</td>
                  <td>{inv.shippedAt ? gbsDate(inv.shippedAt) : ''}</td>
                  <td className="inv-total">{moneyPlain(inv.amount)}</td>
                  <td>{inv.remarks || ''}</td>
                  <td>
                    <button
                      type="button"
                      className="inv-doc"
                      title="Documents"
                      onClick={() => {
                        markInvoiceOpened(inv.id)
                        if (awaiting) setPayId(inv.id)
                      }}
                    >
                      <EnvelopeIcon />
                    </button>
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => printInvoice(inv, lot, company)}
                    >
                      Print
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
          const label = clientInvoiceLabel(inv)
          const awaiting = label === 'Awaiting Payment'
          return (
            <article key={inv.id} className={`inv-card ${inv.opened ? '' : 'is-unopened'}`}>
              <button
                type="button"
                className={`inv-status ${awaiting ? 'is-await' : 'is-shipped'}`}
                onClick={() => {
                  markInvoiceOpened(inv.id)
                  if (awaiting) setPayId(inv.id)
                }}
              >
                {awaiting ? '⚠ ' : ''}
                {label}
              </button>
              <ol className="inv-timeline">
                {invoiceSteps(inv).map((step) => (
                  <li key={step.key} className={step.done ? 'is-done' : step.current ? 'is-current' : ''}>
                    {step.label}
                  </li>
                ))}
              </ol>
              <div>
                <strong>
                  {lot ? `${lot.manufacturer} ${lot.model}` : inv.lotId}
                </strong>
                <div className="muted tiny">{auctionNumber(inv, lot)}</div>
              </div>
              <div className="inv-card-meta">
                <span>{inv.qty.toLocaleString()} pcs</span>
                <span>{moneyPlain(inv.unitPrice)} / pc</span>
                <span>{moneyPlain(inv.amount)} total</span>
              </div>
              <div className="muted tiny">
                {gbsDate(inv.createdAt)}
                {invoiceDueLabel(inv, now) ? ` · ${invoiceDueLabel(inv, now)}` : ''}
              </div>
              <button type="button" className="linkish" onClick={() => printInvoice(inv, lot, company)}>
                Print invoice
              </button>
            </article>
          )
        })}
      </div>
      {notice ? <p className="ok">{notice}</p> : null}
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
