import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { CheckMenu, toggleValue } from '../components/CheckMenu'
import { isFilterUiTarget } from '../components/FilterPanel'
import { InvoicePreview } from '../components/InvoicePreview'
import { bidOutcome, fillStats } from '../lib/allocate'
import { downloadCsv as exportCsvFile } from '../lib/csv'
import { isSealedLot, typePillClass } from '../lib/auctionLists'
import { formatDateTime, isoDate, lotTypeLabel, usdAmt } from '../lib/format'
import { invoiceCoversLot, invoiceVisibleToBuyer } from '../lib/invoices'
import { useNow, useStore } from '../store'
import type { BidOutcome } from '../lib/allocate'
import type { Grade, Invoice, Lot } from '../types'

const STATUS_OPTIONS: BidOutcome[] = ['won', 'partial', 'lost']
const STATUS_LABELS: Record<BidOutcome, string> = {
  won: 'Won',
  partial: 'Partially Won',
  lost: 'Lost',
}

type FilterMenu = 'status' | 'maker' | 'product' | 'capacity' | 'grade' | null

function LockIcon({ open }: { open?: boolean }) {
  if (open) {
    return (
      <span className="gbs-lock is-open" title="Unlocked">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path
            fill="currentColor"
            d="M8 14a3 3 0 1 0 2.8 4H17v-2h-2v-2h2v-2h-6.2A3 3 0 0 0 8 14zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"
          />
        </svg>
      </span>
    )
  }
  return (
    <span className="gbs-lock" title="Locked">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path
          fill="currentColor"
          d="M8 10V7a4 4 0 0 1 8 0v3h2V7a6 6 0 0 0-12 0v3H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1zm2 0h4V7a2 2 0 0 0-4 0z"
        />
      </svg>
    </span>
  )
}

type Row = {
  lot: Lot
  qty: number
  bid: number
  win: number
  outcome: BidOutcome
  at: number
}

function Money({ unit, qty, hot }: { unit: number; qty: number; hot?: boolean }) {
  return (
    <div className={`gbs-money ${hot ? 'is-hot' : ''}`}>
      <div>{usdAmt(unit)}</div>
      <div className="gbs-money-total">({usdAmt(unit * qty)})</div>
    </div>
  )
}

export function BidHistory() {
  const { lots, bids, user, invoices, settings } = useStore()
  const me = user?.accountId
  const now = useNow()
  const [preview, setPreview] = useState<Invoice | null>(null)

  function issuedForLot(lotId: string) {
    if (!me) return undefined
    return invoices.find(
      (inv) => invoiceVisibleToBuyer(inv) && invoiceCoversLot(inv, lotId, me),
    )
  }

  const [from, setFrom] = useState(isoDate(now - 30 * 86400000))
  const [to, setTo] = useState(isoDate(now + 14 * 86400000))
  const [statuses, setStatuses] = useState<BidOutcome[]>([])
  const [makers, setMakers] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [capacities, setCapacities] = useState<string[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [open, setOpen] = useState<FilterMenu>(null)
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(25)
  const filtersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!isFilterUiTarget(e.target, filtersRef.current)) setOpen(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const allRows = useMemo(() => {
    if (!me) return []
    const rows: Row[] = []
    for (const lot of lots) {
      if (lot.channel !== 'auction') continue
      const last = bids
        .filter((b) => b.lotId === lot.id && b.accountId === me)
        .reduce<typeof bids[0] | undefined>((a, b) => (!a || b.at > a.at ? b : a), undefined)
      if (!last) continue
      if (lot.endsAt > now && isSealedLot(lot, settings)) continue
      const stats = fillStats(lot, bids, me)
      const outcome = bidOutcome(lot, stats.myPcs, last.qty, now)
      if (!outcome) continue
      const filled = stats.myPcs > 0 ? stats.myPcs : last.qty
      rows.push({
        lot,
        qty: filled,
        bid: last.amount,
        win: stats.myPcs > 0 ? last.amount : lot.currentPrice,
        outcome,
        at: lot.endsAt,
      })
    }
    return rows.sort((a, b) => b.at - a.at)
  }, [lots, bids, me, now, settings])

  const makerOptions = useMemo(
    () => [...new Set(allRows.map((r) => r.lot.manufacturer))].sort(),
    [allRows],
  )
  const productOptions = useMemo(
    () => [...new Set(allRows.map((r) => r.lot.model))].sort(),
    [allRows],
  )
  const capacityOptions = useMemo(
    () => [...new Set(allRows.map((r) => r.lot.capacity))].sort(),
    [allRows],
  )
  const gradeOptions = useMemo(
    () => [...new Set(allRows.map((r) => r.lot.grade))].sort() as Grade[],
    [allRows],
  )

  const filtered = allRows.filter((row) => {
    const day = isoDate(Math.min(row.at, now))
    if (from && day < from) return false
    if (to && day > to) return false
    if (statuses.length && !statuses.includes(row.outcome)) return false
    if (makers.length && !makers.includes(row.lot.manufacturer)) return false
    if (products.length && !products.includes(row.lot.model)) return false
    if (capacities.length && !capacities.includes(row.lot.capacity)) return false
    if (grades.length && !grades.includes(row.lot.grade)) return false
    return true
  })

  const pages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, pages - 1)
  const slice = filtered.slice(safePage * perPage, safePage * perPage + perPage)
  const start = filtered.length ? safePage * perPage + 1 : 0
  const end = Math.min(filtered.length, (safePage + 1) * perPage)

  function reset() {
    setFrom(isoDate(now - 30 * 86400000))
    setTo(isoDate(now + 14 * 86400000))
    setStatuses([])
    setMakers([])
    setProducts([])
    setCapacities([])
    setGrades([])
    setOpen(null)
    setPage(0)
  }

  function downloadCsv() {
    const header = [
      'Auction End Date',
      'Auction Type',
      'Auction Type Id',
      'Status',
      'Manufacturer',
      'Model',
      'Operator',
      'Grade',
      'Qty',
      'Winning Price',
      'Bid Value',
      'Gap Price',
    ]
    exportCsvFile(
      'bid-history.csv',
      header,
      filtered.map((row) => [
        formatDateTime(row.at),
        lotTypeLabel(row.lot, settings),
        row.lot.auctionType || 'live',
        row.outcome,
        row.lot.manufacturer,
        `${row.lot.modelNumber} ${row.lot.model} ${row.lot.capacity} ${row.lot.color}`,
        row.lot.operator || '-',
        row.lot.grade,
        row.qty,
        row.win,
        row.bid,
        row.bid - row.win,
      ]),
    )
  }

  const wonCount = filtered.filter((r) => r.outcome === 'won' || r.outcome === 'partial').length

  return (
    <div className="bid-history-page">
      <div className="mypage-filters auction-desk-filters" ref={filtersRef}>
        <div className="filters filters-no-search">
          <div className="filter-groups">
            <label className="mypage-date">
              <span className="filter-trigger-title">From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value)
                  setPage(0)
                }}
              />
            </label>
            <span className="mypage-date-tilde" aria-hidden>
              ~
            </span>
            <label className="mypage-date">
              <span className="filter-trigger-title">To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value)
                  setPage(0)
                }}
              />
            </label>
            <CheckMenu
              title="Status"
              open={open === 'status'}
              onOpen={() => setOpen((v) => (v === 'status' ? null : 'status'))}
              options={STATUS_OPTIONS}
              selected={statuses}
              onToggle={(value) => {
                startTransition(() => {
                  setStatuses((prev) => toggleValue(prev, value))
                  setPage(0)
                })
              }}
              labelFor={(value) => STATUS_LABELS[value]}
            />
            <CheckMenu
              title="Maker"
              open={open === 'maker'}
              onOpen={() => setOpen((v) => (v === 'maker' ? null : 'maker'))}
              options={makerOptions}
              selected={makers}
              onToggle={(value) => {
                startTransition(() => {
                  setMakers((prev) => toggleValue(prev, value))
                  setPage(0)
                })
              }}
            />
            <CheckMenu
              title="Product"
              open={open === 'product'}
              onOpen={() => setOpen((v) => (v === 'product' ? null : 'product'))}
              options={productOptions}
              selected={products}
              onToggle={(value) => {
                startTransition(() => {
                  setProducts((prev) => toggleValue(prev, value))
                  setPage(0)
                })
              }}
            />
            <CheckMenu
              title="Capacity"
              open={open === 'capacity'}
              onOpen={() => setOpen((v) => (v === 'capacity' ? null : 'capacity'))}
              options={capacityOptions}
              selected={capacities}
              onToggle={(value) => {
                startTransition(() => {
                  setCapacities((prev) => toggleValue(prev, value))
                  setPage(0)
                })
              }}
            />
            <CheckMenu
              title="Grade"
              open={open === 'grade'}
              onOpen={() => setOpen((v) => (v === 'grade' ? null : 'grade'))}
              options={gradeOptions}
              selected={grades}
              onToggle={(value) => {
                startTransition(() => {
                  setGrades((prev) => toggleValue(prev, value))
                  setPage(0)
                })
              }}
            />
            <div className="mypage-filter-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
                Reset
              </button>
              <button type="button" className="btn btn-sm" onClick={downloadCsv}>
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="mypage-meta">
        <em>{filtered.length} rows</em>
        {wonCount ? <em className="is-yours">Won {wonCount}</em> : null}
      </div>
      <div className="table-wrap gbs-table-wrap">
        <table className="gbs-table">
          <thead>
            <tr>
              <th>Auction End Date</th>
              <th>Auction Type</th>
              <th>Status</th>
              <th>Manufacturer</th>
              <th>Model</th>
              <th>Operator</th>
              <th>Grade</th>
              <th>SIM</th>
              <th>Activation</th>
              <th>Quantity</th>
              <th>Winning Price</th>
              <th>Bid Value</th>
              <th>Gap Price</th>
              <th>Invoice</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => {
              const gap = row.bid - row.win
              const inv = row.outcome === 'lost' ? undefined : issuedForLot(row.lot.id)
              return (
                <tr key={row.lot.id}>
                  <td className="mono">{formatDateTime(row.at)}</td>
                  <td>
                    <span className={`gbs-type gbs-type-${typePillClass(row.lot, settings)}`}>
                      {lotTypeLabel(row.lot, settings)}
                    </span>
                  </td>
                  <td>
                    <span className={`gbs-outcome gbs-outcome-${row.outcome}`}>
                      {row.outcome === 'won' ? 'Won' : row.outcome === 'partial' ? 'Partially Won' : 'Lost'}
                    </span>
                  </td>
                  <td>{row.lot.manufacturer}</td>
                  <td className="gbs-model">
                    <div>
                      {row.lot.modelNumber}_{row.lot.model.replace(/\s+/g, '_')}
                    </div>
                    <div className="muted">
                      {row.lot.capacity}
                      {row.lot.color ? ` ${row.lot.color}` : ''}
                    </div>
                  </td>
                  <td>{row.lot.operator || '-'}</td>
                  <td>{row.lot.grade}</td>
                  <td>
                    <LockIcon open={row.lot.simLocked === false} />
                  </td>
                  <td>
                    <LockIcon open={!row.lot.activationLocked} />
                  </td>
                  <td>{row.qty}</td>
                  <td>
                    <Money unit={row.win} qty={row.qty} />
                  </td>
                  <td>
                    <Money unit={row.bid} qty={row.qty} hot={row.bid !== row.win} />
                  </td>
                  <td>{gap ? usdAmt(gap) : ''}</td>
                  <td>
                    {inv ? (
                      <button type="button" className="linkish" onClick={() => setPreview(inv)}>
                        {inv.id}
                      </button>
                    ) : row.outcome === 'won' || row.outcome === 'partial' ? (
                      <span className="muted tiny">Awaiting issue</span>
                    ) : (
                      ''
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!filtered.length ? <p className="empty">No bid history for these filters.</p> : null}
      </div>
      <div className="inv-cards">
        {slice.map((row) => {
          const gap = row.bid - row.win
          const inv = row.outcome === 'lost' ? undefined : issuedForLot(row.lot.id)
          return (
            <article key={row.lot.id} className="inv-card">
              <div>
                <strong>
                  {row.lot.manufacturer} {row.lot.model}
                </strong>
                <div className="muted tiny">{formatDateTime(row.at)}</div>
              </div>
              <div className="auction-card-meta">
                <span className={`gbs-type gbs-type-${typePillClass(row.lot, settings)}`}>
                  {lotTypeLabel(row.lot, settings)}
                </span>
                <span className={`gbs-outcome gbs-outcome-${row.outcome}`}>
                  {row.outcome === 'won' ? 'Won' : row.outcome === 'partial' ? 'Partially Won' : 'Lost'}
                </span>
                <span>{row.qty} pcs</span>
              </div>
              <div className="inv-card-meta">
                <span>Win {usdAmt(row.win)}</span>
                <span>Bid {usdAmt(row.bid)}</span>
                {gap ? <span>Gap {usdAmt(gap)}</span> : null}
              </div>
              {inv ? (
                <button type="button" className="linkish" onClick={() => setPreview(inv)}>
                  View invoice {inv.id}
                </button>
              ) : null}
            </article>
          )
        })}
      </div>
      <div className="gbs-pager">
        <label>
          rows per page:
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value))
              setPage(0)
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>
        <span>
          {start}–{end} of {filtered.length}
        </span>
        <button type="button" disabled={safePage <= 0} onClick={() => setPage(safePage - 1)}>
          ‹
        </button>
        <button type="button" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>
          ›
        </button>
      </div>
      {preview ? <InvoicePreview invoice={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  )
}
