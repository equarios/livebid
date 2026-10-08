import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FillBar } from './FillBar'
import { InlineBid } from './InlineBid'
import { ItemLink } from './ItemLink'
import { bidStatus, fillStats, type FillStats } from '../lib/allocate'
import { auctionClockRows, isSealedLot, listPath, typePillClass } from '../lib/auctionLists'
import { lotTypeLabel, timeLeft, usd } from '../lib/format'
import { moqLabel } from '../lib/moq'
import { useNow, useStore } from '../store'
import type { Bid, Lot, SiteSettings } from '../types'
import { TimeLeft } from './TimeLeft'

type Row = {
  lot: Lot
  last: Bid | undefined
  stats: FillStats
  st: ReturnType<typeof bidStatus>
  closed: boolean
  yourTotal: number | null
  winTotal: number | null
}

function statusRank(st: ReturnType<typeof bidStatus>) {
  if (st.label === 'Winning') return 0
  if (st.label.startsWith('Partial')) return 1
  if (st.label === 'Bid in') return 2
  if (st.label === 'Outbid') return 3
  if (st.label === 'Closed') return 4
  return 5
}

function buildRows(
  lots: Lot[],
  myLastBid: (id: string) => Bid | undefined,
  bids: Bid[],
  me: string | undefined,
  settings: SiteSettings,
  now: number,
): Row[] {
  return lots.map((lot) => {
    const last = myLastBid(lot.id)
    const stats = fillStats(lot, bids, me)
    const closed = lot.endsAt <= now
    const sealedOpen = isSealedLot(lot, settings) && !closed
    const st = bidStatus(lot, stats.myPcs, last?.qty, now, settings)
    return {
      lot,
      last,
      stats,
      st,
      closed,
      yourTotal: last ? last.qty * last.amount : null,
      winTotal: sealedOpen ? null : stats.myPcs > 0 && last ? stats.myPcs * last.amount : 0,
    }
  })
}

function orderFocusRows(rows: Row[]) {
  return [...rows].sort((a, b) => {
    const aBid = a.last ? 0 : 1
    const bBid = b.last ? 0 : 1
    if (aBid !== bBid) return aBid - bBid
    const byStatus = statusRank(a.st) - statusRank(b.st)
    if (byStatus) return byStatus
    return a.lot.endsAt - b.lot.endsAt
  })
}

const DESK_KEY = 'equarios-auction-desk-hidden'

function closeHeat(pct: number) {
  if (pct >= 0.75) return 'hot'
  if (pct >= 0.4) return 'mid'
  return 'ok'
}

function closeProgress(endsAt: number, now: number, durationMs: number, windowMin: number, closing: boolean) {
  const left = Math.max(0, endsAt - now)
  if (closing) {
    const windowMs = Math.max(1, windowMin) * 60 * 1000
    return Math.max(0, Math.min(1, (windowMs - left) / windowMs))
  }
  return Math.max(0, Math.min(1, 1 - left / Math.max(1, durationMs)))
}

export function BidTotals({ lots, children }: { lots: Lot[]; children?: ReactNode }) {
  const now = useNow()
  const { myLastBid, bids, user, settings } = useStore()
  const me = user?.accountId
  const deskRef = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DESK_KEY) === '1'
    } catch {
      return false
    }
  })
  useLayoutEffect(() => {
    const el = deskRef.current
    if (!el) return
    const apply = () => {
      document.documentElement.style.setProperty('--auction-desk-h', `${Math.round(el.getBoundingClientRect().height)}px`)
    }
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    apply()
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty('--auction-desk-h')
    }
  }, [hidden, children])
  const hideWin =
    lots.length > 0 && lots.every((lot) => isSealedLot(lot, settings) && lot.endsAt > now)
  let alreadyBid = 0
  let winningAmount = 0
  for (const lot of lots) {
    const last = myLastBid(lot.id)
    if (!last) continue
    alreadyBid += last.qty * last.amount
    const stats = fillStats(lot, bids, me)
    if (!isSealedLot(lot, settings) && stats.myPcs > 0) {
      winningAmount += stats.myPcs * last.amount
    }
  }
  const clockRows = settings.features.endingSoon
    ? auctionClockRows(lots, settings, now, settings.endingSoonMinutes)
    : []
  const closingSoon = clockRows.filter((row) => row.closing)
  const closeBars = closingSoon.length ? closingSoon : clockRows.slice(0, 1)
  function toggle() {
    const next = !hidden
    setHidden(next)
    try {
      localStorage.setItem(DESK_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  return (
    <div ref={deskRef} className={`auction-desk${hidden ? ' is-collapsed' : ''}`}>
      <div className="auction-desk-head">
        <div>
          <strong>Bidding snapshot</strong>
          {hidden ? (
            <p className="muted tiny auction-desk-recap">
              {usd(alreadyBid)} bid
              {hideWin ? '' : ` · ${usd(winningAmount)} winning`}
              {closingSoon.length ? ` · ${closingSoon.length} closing soon` : ''}
            </p>
          ) : null}
        </div>
        <div className="auction-desk-head-actions">
          {settings.features.endingSoon ? (
            <span
              className={`auction-close-count${closingSoon.length ? ' on' : ''}`}
              title={
                closingSoon.length
                  ? closingSoon.map((row) => row.label).join(', ')
                  : 'No auctions in the warning window'
              }
            >
              Closing <strong>{closingSoon.length}</strong>
            </span>
          ) : null}
          <button type="button" className="auction-close-count" onClick={toggle}>
            {hidden ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>
      {children ? <div className="auction-desk-filters">{children}</div> : null}
      {!hidden ? (
        <>
          <div className="auction-desk-kpis">
            <div
              className="auction-desk-stat"
              title="Your qty × your price on these lots"
            >
              <span className="label">Already bid</span>
              <strong>{usd(alreadyBid)}</strong>
            </div>
            <div
              className="auction-desk-stat is-win"
              title={
                hideWin
                  ? 'Win/lose stays hidden on Offline Auctions until close'
                  : 'Pcs you are currently allocated × your price'
              }
            >
              <span className="label">Winning</span>
              <strong>{hideWin ? 'Hidden' : usd(winningAmount)}</strong>
            </div>
            {closeBars.map((row) => {
              const pct = closeProgress(
                row.endsAt,
                now,
                row.durationMs,
                settings.endingSoonMinutes,
                row.closing,
              )
              const heat = row.closing ? closeHeat(pct) : 'ok'
              return (
                <Link
                  key={row.value}
                  to={listPath(row.value)}
                  className={`auction-close-bar is-${heat}`}
                  title={`${row.label} · ${row.count} lots · ${timeLeft(row.endsAt, now)} left`}
                >
                  <span className="auction-close-bar-top">
                    <strong>{row.label}</strong>
                    <TimeLeft endsAt={row.endsAt} />
                  </span>
                  <span className="muted tiny">
                    {row.count === 1 ? '1 lot' : `${row.count} lots`} ·{' '}
                    {row.closing ? 'closing now' : 'next close'}
                  </span>
                  <span className="auction-close-track" aria-hidden>
                    <span className="auction-close-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
                  </span>
                </Link>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}

function YouWin({ row }: { row: Row }) {
  const { settings } = useStore()
  const { lot, last, stats, st, closed, winTotal } = row
  const sealedOpen = isSealedLot(lot, settings) && !closed
  return (
    <div className="you-win">
      <FillBar
        total={lot.qty}
        myPcs={sealedOpen ? last?.qty ?? 0 : stats.myPcs}
        sealed={sealedOpen}
        status={st}
        kind={lotTypeLabel(lot, settings)}
        kindClass={typePillClass(lot, settings)}
      />
      <div className="you-win-amt">
        {winTotal == null ? (
          <strong className="muted">Hidden</strong>
        ) : (
          <>
            <strong>{usd(winTotal)}</strong>
            {stats.myPcs > 0 ? (
              <span className="muted tiny">{stats.myPcs} pcs allocated</span>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function LotCells({
  row,
  compareIds,
  onToggleCompare,
}: {
  row: Row
  compareIds?: string[]
  onToggleCompare?: (id: string) => void
}) {
  const { settings } = useStore()
  const { lot, last, yourTotal } = row
  return (
    <>
      {onToggleCompare ? (
        <td>
          <input
            type="checkbox"
            checked={compareIds?.includes(lot.id) || false}
            aria-label={`Compare ${lot.id}`}
            onChange={() => onToggleCompare(lot.id)}
          />
        </td>
      ) : null}
      <td className="mono">{lot.id}</td>
      <td>
        <ItemLink lot={lot} />
      </td>
      <td>
        <span className={`grade-inline grade-${lot.grade}`}>{lot.grade}</span>
      </td>
      <td>
        {lot.qty.toLocaleString()}
        <div className="muted tiny">{moqLabel(lot, settings.copy.noMoq)}</div>
      </td>
      <td className="price-cell">
        {isSealedLot(lot, settings) && !row.closed ? (
          <span className="muted">Hidden</span>
        ) : (
          usd(lot.currentPrice)
        )}
      </td>
      <td className="price-cell">
        {yourTotal != null && last ? (
          <>
            {usd(yourTotal)}
            <div className="muted tiny">
              {last.qty} pcs × {usd(last.amount)}
              {last.qty >= lot.qty ? ' · take all' : ' · small qty'}
            </div>
          </>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td className="fill-cell">
        <YouWin row={row} />
      </td>
      <td>
        <TimeLeft endsAt={lot.endsAt} />
      </td>
      <td>
        <InlineBid lot={lot} withWatch />
      </td>
    </>
  )
}

function LotCardBlock({
  row,
  compareIds,
  onToggleCompare,
}: {
  row: Row
  compareIds?: string[]
  onToggleCompare?: (id: string) => void
}) {
  const { settings } = useStore()
  const { lot, last, closed, yourTotal } = row
  return (
    <article className={`auction-card ${closed ? 'is-closed' : ''} ${last ? 'has-bid' : ''}`}>
      {onToggleCompare ? (
        <label className="compare-check">
          <input
            type="checkbox"
            checked={compareIds?.includes(lot.id) || false}
            onChange={() => onToggleCompare(lot.id)}
          />
          Compare
        </label>
      ) : null}
      <ItemLink lot={lot} />
      <div className="auction-card-meta">
        <span className={`grade-inline grade-${lot.grade}`}>{lot.grade}</span>
        <span>{lot.qty.toLocaleString()} pcs</span>
        <TimeLeft endsAt={lot.endsAt} />
      </div>
      <YouWin row={row} />
      <div className="auction-card-prices">
        <span>
          High / pc{' '}
          <strong>
            {isSealedLot(lot, settings) && !closed ? 'Hidden' : usd(lot.currentPrice)}
          </strong>
        </span>
        <span>
          Your bid <strong>{yourTotal != null && last ? usd(yourTotal) : '—'}</strong>
        </span>
      </div>
      <InlineBid lot={lot} stacked withWatch />
    </article>
  )
}

export function AuctionTable({
  lots,
  compareIds,
  onToggleCompare,
  showTotals = true,
}: {
  lots: Lot[]
  compareIds?: string[]
  onToggleCompare?: (id: string) => void
  showTotals?: boolean
}) {
  const now = useNow()
  const { myLastBid, bids, user, settings } = useStore()
  const me = user?.accountId
  const colSpan = (onToggleCompare ? 1 : 0) + 9

  const sections = useMemo(() => {
    const ordered = orderFocusRows(buildRows(lots, myLastBid, bids, me, settings, now))
    const mine = ordered.filter((r) => r.last)
    const rest = ordered.filter((r) => !r.last)
    if (!mine.length) return [{ key: 'all', title: null as string | null, rows: rest }]
    if (!rest.length) {
      return [{ key: 'mine', title: `Your bids · ${mine.length}`, rows: mine }]
    }
    return [
      { key: 'mine', title: `Your bids · ${mine.length}`, rows: mine },
      { key: 'rest', title: `Not bid yet · ${rest.length}`, rows: rest },
    ]
  }, [lots, myLastBid, bids, me, settings, now])

  return (
    <>
      {showTotals ? <BidTotals lots={lots} /> : null}
      <div className="table-wrap card auction-table-wrap">
        <table className="auction-table">
          <thead>
            <tr>
              {onToggleCompare ? <th>Cmp</th> : null}
              <th>Lot</th>
              <th>Item</th>
              <th>Grade</th>
              <th>Total pcs</th>
              <th>High / pc</th>
              <th>Your bid total</th>
              <th>You · Winning</th>
              <th>Time left</th>
              <th>Your order</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <Fragment key={section.key}>
                {section.title ? (
                  <tr className="group-row">
                    <td colSpan={colSpan}>{section.title}</td>
                  </tr>
                ) : null}
                {section.rows.map((row) => (
                  <tr
                    key={row.lot.id}
                    className={`${row.closed ? 'is-closed' : ''} ${row.last ? 'has-bid' : ''}`}
                  >
                    <LotCells
                      row={row}
                      compareIds={compareIds}
                      onToggleCompare={onToggleCompare}
                    />
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="auction-cards" aria-label="Auction lots">
        {sections.map((section) => (
          <Fragment key={`card-${section.key}`}>
            {section.title ? <h3 className="auction-card-group">{section.title}</h3> : null}
            {section.rows.map((row) => (
              <LotCardBlock
                key={row.lot.id}
                row={row}
                compareIds={compareIds}
                onToggleCompare={onToggleCompare}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </>
  )
}
