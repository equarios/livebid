import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { allocate, lastBidsForLot } from '../lib/allocate'
import { effectiveEndsAt, isAuctionOpen, listLabel } from '../lib/auctionLists'
import { trackingHref } from '../lib/fulfillment'
import { usd } from '../lib/format'
import { buildInvoice, invoiceCoversLot, invoiceStatusLabel, suggestInvoiceId } from '../lib/invoices'
import { SOLD_ARCHIVE_MS, SOLD_HIDE_AFTER_MS } from '../lib/stockFilter'
import { toastMsg } from '../lib/toast'
import { useNow, useStore } from '../store'
import type { Bid, Invoice, Lot, SiteSettings } from '../types'

type CloseTab = 'invoices' | 'bidders'
type CloseSpan = 'recent' | 'older'

type CloseFill = {
  lot: Lot
  qty: number
  unitPrice: number
}

type CloseBill = {
  key: string
  accountId: string
  slug: string
  ended: number
  fills: CloseFill[]
  uncovered: CloseFill[]
  invoices: Invoice[]
}

type BidLot = {
  lotId: string
  model: string
  won: number
  missed: number
  price: number
}

type BidderRow = {
  key: string
  accountId: string
  slug: string
  ended: number
  lots: number
  won: number
  missed: number
  prices: number[]
  lines: BidLot[]
}

function companyName(accounts: { accountId: string; company: string }[], accountId: string) {
  return accounts.find((a) => a.accountId === accountId)?.company || accountId
}

function isBot(accountId: string) {
  return accountId.startsWith('BOT-')
}

function covers(inv: Invoice, lotId: string, accountId: string) {
  return inv.status !== 'declined' && invoiceCoversLot(inv, lotId, accountId)
}

function inCloseSpan(ended: number, now: number, span: CloseSpan) {
  if (ended <= 0) return false
  const age = now - ended
  if (span === 'recent') return age <= SOLD_HIDE_AFTER_MS
  if (span === 'older') return age > SOLD_HIDE_AFTER_MS && age < SOLD_ARCHIVE_MS
  const unreachable: never = span
  return unreachable
}

export function closedAuctionLots(lots: Lot[], bids: Bid[], now: number, span: CloseSpan = 'recent') {
  return lots
    .filter((lot) => lot.channel === 'auction' && !isAuctionOpen(lot, now))
    .filter((lot) => inCloseSpan(effectiveEndsAt(lot), now, span))
    .filter((lot) => lastBidsForLot(bids, lot.id).length > 0)
    .sort((a, b) => effectiveEndsAt(b) - effectiveEndsAt(a))
}

function closeBills(lots: Lot[], bids: Bid[], invoices: Invoice[], now: number, span: CloseSpan): CloseBill[] {
  const map = new Map<string, CloseBill>()
  for (const lot of closedAuctionLots(lots, bids, now, span)) {
    const slug = lot.auctionType || 'live'
    const ended = effectiveEndsAt(lot)
    for (const slice of allocate(lot, bids)) {
      if (!slice.qty || isBot(slice.accountId)) continue
      const key = `${slice.accountId}::${slug}::${ended}`
      const row = map.get(key) || {
        key,
        accountId: slice.accountId,
        slug,
        ended,
        fills: [],
        uncovered: [],
        invoices: [],
      }
      const fill: CloseFill = { lot, qty: slice.qty, unitPrice: slice.unitPrice }
      row.fills.push(fill)
      const hit = invoices.find((inv) => covers(inv, lot.id, slice.accountId))
      if (hit) {
        if (!row.invoices.some((inv) => inv.id === hit.id)) row.invoices.push(hit)
      } else {
        row.uncovered.push(fill)
      }
      map.set(key, row)
    }
  }
  return [...map.values()].sort((a, b) => {
    const due = (row: CloseBill) => row.fills.reduce((n, fill) => n + fill.qty * fill.unitPrice, 0)
    return due(b) - due(a)
  })
}

export function closesNeedingInvoice(lots: Lot[], bids: Bid[], invoices: Invoice[], now: number) {
  return closeBills(lots, bids, invoices, now, 'recent').filter((row) => row.uncovered.length > 0)
}

function bidderRows(lots: Lot[], bids: Bid[], now: number, span: CloseSpan): BidderRow[] {
  const map = new Map<string, BidderRow>()
  for (const lot of closedAuctionLots(lots, bids, now, span)) {
    const slug = lot.auctionType || 'live'
    const ended = effectiveEndsAt(lot)
    const wonBy = new Map(allocate(lot, bids).map((slice) => [slice.accountId, slice.qty]))
    for (const bid of lastBidsForLot(bids, lot.id)) {
      if (isBot(bid.accountId)) continue
      const won = wonBy.get(bid.accountId) || 0
      const missed = Math.max(0, bid.qty - won)
      const key = `${bid.accountId}::${slug}::${ended}`
      const row = map.get(key) || {
        key,
        accountId: bid.accountId,
        slug,
        ended,
        lots: 0,
        won: 0,
        missed: 0,
        prices: [],
        lines: [],
      }
      row.lots += 1
      row.won += won
      row.missed += missed
      if (!row.prices.includes(bid.amount)) row.prices.push(bid.amount)
      row.lines.push({
        lotId: lot.id,
        model: `${lot.manufacturer} ${lot.model}`.trim(),
        won,
        missed,
        price: bid.amount,
      })
      map.set(key, row)
    }
  }
  return [...map.values()]
    .map((row) => ({
      ...row,
      lines: [...row.lines].sort((a, b) => b.missed - a.missed || b.won - a.won),
    }))
    .sort((a, b) => b.missed - a.missed || b.won - a.won)
}

function payShipLabel(inv: Invoice) {
  if (inv.fulfillmentMode === 'pickup') {
    if (inv.shippedAt) return 'Collected'
    if (inv.readyForCollect) return 'Ready for collect'
  }
  if (inv.trackingNo) {
    const via = inv.courierCarrier ? `${inv.courierCarrier} · ${inv.trackingNo}` : inv.trackingNo
    return via
  }
  if (inv.readyForCollect) return 'Ready for collect'
  if (inv.shippedAt) return 'Shipped'
  if (inv.status === 'paid') return 'Paid'
  return invoiceStatusLabel(inv.status)
}

function priceLabel(prices: number[]) {
  if (!prices.length) return '—'
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  if (low === high) return usd(low)
  return `${usd(low)}–${usd(high)}`
}

function pcs(n: number) {
  return n.toLocaleString('en-US')
}

function closedOn(ended: number) {
  return new Date(ended).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function CloseDesk() {
  const { lots, bids, invoices, accounts, settings, saveInvoice } = useStore()
  const now = useNow()
  const [tab, setTab] = useState<CloseTab>('invoices')
  const [span, setSpan] = useState<CloseSpan>('recent')
  const [needsOnly, setNeedsOnly] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const bills = useMemo(() => closeBills(lots, bids, invoices, now, span), [lots, bids, invoices, now, span])
  const needing = useMemo(() => bills.filter((row) => row.uncovered.length > 0), [bills])
  const bidders = useMemo(() => bidderRows(lots, bids, now, span), [lots, bids, now, span])
  const invoiceRows = (needsOnly ? needing : bills).slice(0, 200)

  async function createDraft(row: CloseBill) {
    if (!row.uncovered.length) return
    setBusyKey(row.key)
    const invoice = buildInvoice(
      {
        id: suggestInvoiceId(invoices, settings),
        lotId: row.uncovered[0].lot.id,
        channel: 'auction',
        createdAt: Date.now(),
        accountId: row.accountId,
        status: 'draft',
        lines: row.uncovered.map((fill) => ({
          lotId: fill.lot.id,
          qty: fill.qty,
          unitPrice: fill.unitPrice,
        })),
      },
      settings,
      lots,
    )
    const err = await saveInvoice(invoice)
    toastMsg(err || `Draft ${invoice.id} created — issue it in Money`)
    setBusyKey(null)
  }

  return (
    <section className="mh-desk">
      <header className="mh-desk-head">
        <h2>
          Closes
          <em>{tab === 'invoices' ? invoiceRows.length : bidders.length}</em>
        </h2>
        <p className="mh-desk-note">
          {span === 'recent'
            ? 'Staff only. Last 14 days. One invoice per company per auction list, for pieces they won.'
            : 'Staff only. Closes from 15 to 180 days ago. Same invoice and bidder rows, still no leftover stock.'}
        </p>
        <div className="close-desk-filters">
          <button
            type="button"
            className={`ops-nav-btn${tab === 'invoices' ? ' on' : ''}`}
            onClick={() => setTab('invoices')}
          >
            Invoices
          </button>
          <button
            type="button"
            className={`ops-nav-btn${tab === 'bidders' ? ' on' : ''}`}
            onClick={() => setTab('bidders')}
          >
            Bidders
          </button>
        </div>
        <div className="close-desk-filters">
          <button
            type="button"
            className={`ops-nav-btn${span === 'recent' ? ' on' : ''}`}
            onClick={() => setSpan('recent')}
          >
            Last 14 days
          </button>
          <button
            type="button"
            className={`ops-nav-btn${span === 'older' ? ' on' : ''}`}
            onClick={() => setSpan('older')}
          >
            Older
          </button>
        </div>
        {tab === 'invoices' ? (
          <div className="close-desk-filters">
            <button
              type="button"
              className={`ops-nav-btn${needsOnly ? ' on' : ''}`}
              onClick={() => setNeedsOnly(true)}
            >
              Needs invoice
            </button>
            <button
              type="button"
              className={`ops-nav-btn${needsOnly ? '' : ' on'}`}
              onClick={() => setNeedsOnly(false)}
            >
              {span === 'older' ? 'All older' : 'All recent'}
            </button>
          </div>
        ) : null}
      </header>
      {tab === 'invoices' ? (
        <InvoiceTable
          rows={invoiceRows}
          needsOnly={needsOnly}
          span={span}
          accounts={accounts}
          settings={settings}
          busyKey={busyKey}
          onCreate={(row) => void createDraft(row)}
        />
      ) : (
        <BidderTable rows={bidders} span={span} accounts={accounts} settings={settings} />
      )}
    </section>
  )
}

function InvoiceTable({
  rows,
  needsOnly,
  span,
  accounts,
  settings,
  busyKey,
  onCreate,
}: {
  rows: CloseBill[]
  needsOnly: boolean
  span: CloseSpan
  accounts: { accountId: string; company: string }[]
  settings: SiteSettings
  busyKey: string | null
  onCreate: (row: CloseBill) => void
}) {
  if (!rows.length) {
    const empty =
      span === 'older'
        ? needsOnly
          ? 'No older fills are waiting on an invoice.'
          : 'No auction fills from 15 to 180 days ago.'
        : needsOnly
          ? 'No fills are waiting on an invoice.'
          : 'No closed auction fills in the last 14 days.'
    return (
      <div className="mh-empty">
        <p>{empty}</p>
      </div>
    )
  }
  return (
    <table className="gbs-table mh-table">
      <thead>
        <tr>
          <th>Company</th>
          <th>List</th>
          {span === 'older' ? <th>Closed</th> : null}
          <th>Lots</th>
          <th>Pcs</th>
          <th>Due</th>
          <th>Next</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const lines = row.uncovered.length ? row.uncovered : row.fills
          const due = lines.reduce((n, fill) => n + fill.qty * fill.unitPrice, 0)
          const pcsSold = lines.reduce((n, fill) => n + fill.qty, 0)
          const only = row.invoices.length === 1 ? row.invoices[0] : null
          const href = only?.trackingNo ? trackingHref(only.courierCarrier, only.trackingNo) : null
          return (
            <tr key={row.key}>
              <td>{companyName(accounts, row.accountId)}</td>
              <td>{listLabel(row.slug, settings)}</td>
              {span === 'older' ? <td>{closedOn(row.ended)}</td> : null}
              <td>{lines.length}</td>
              <td>{pcs(pcsSold)}</td>
              <td>{usd(due)}</td>
              <td>
                {row.uncovered.length ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busyKey === row.key}
                    onClick={() => onCreate(row)}
                  >
                    {busyKey === row.key ? 'Creating…' : 'Create invoice'}
                  </button>
                ) : href && only ? (
                  <a href={href} target="_blank" rel="noreferrer">
                    {payShipLabel(only)}
                  </a>
                ) : (
                  <Link to="/admin?section=money">
                    {only ? payShipLabel(only) : `${row.invoices.length} invoices`}
                  </Link>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function BidderTable({
  rows,
  span,
  accounts,
  settings,
}: {
  rows: BidderRow[]
  span: CloseSpan
  accounts: { accountId: string; company: string }[]
  settings: SiteSettings
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  if (!rows.length) {
    return (
      <div className="mh-empty">
        <p>
          {span === 'older'
            ? 'No bids on auctions that closed 15 to 180 days ago.'
            : 'No bids on closed auctions in the last 14 days.'}
        </p>
      </div>
    )
  }
  return (
    <table className="gbs-table mh-table">
      <thead>
        <tr>
          <th>Company</th>
          <th>List</th>
          {span === 'older' ? <th>Closed</th> : null}
          <th>Lots</th>
          <th>Won</th>
          <th>Missed</th>
          <th>Price</th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 200).map((row) => {
          const open = openKey === row.key
          return (
            <Fragment key={row.key}>
              <tr>
                <td>
                  <button
                    type="button"
                    className="close-bid-open"
                    aria-expanded={open}
                    onClick={() => setOpenKey(open ? null : row.key)}
                  >
                    {companyName(accounts, row.accountId)}
                  </button>
                </td>
                <td>{listLabel(row.slug, settings)}</td>
                {span === 'older' ? <td>{closedOn(row.ended)}</td> : null}
                <td>{row.lots}</td>
                <td>{pcs(row.won)}</td>
                <td>{pcs(row.missed)}</td>
                <td>{priceLabel(row.prices)}</td>
              </tr>
              {open ? (
                <tr key={`${row.key}:lots`}>
                  <td colSpan={span === 'older' ? 7 : 6}>
                    <table className="gbs-table mh-table close-bid-lots">
                      <thead>
                        <tr>
                          <th>Lot</th>
                          <th>Won</th>
                          <th>Missed</th>
                          <th>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.lines.map((line) => (
                          <tr key={line.lotId}>
                            <td>
                              <span className="mono">{line.lotId}</span> {line.model}
                            </td>
                            <td>{pcs(line.won)}</td>
                            <td>{pcs(line.missed)}</td>
                            <td>{usd(line.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}
