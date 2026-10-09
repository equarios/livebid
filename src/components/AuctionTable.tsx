import { Fragment, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FillBar } from './FillBar'
import { InlineBid } from './InlineBid'
import { ItemLink } from './ItemLink'
import { bidStatus, fillStats, type FillStats } from '../lib/allocate'
import { auctionClockRows, isSealedLot, listPath } from '../lib/auctionLists'
import { timeLeft, usd } from '../lib/format'
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

export const AUCTION_DESK_KEY = 'equarios-auction-desk-hidden'

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

export function bidDeskSummary(
  lots: Lot[],
  myLastBid: (id: string) => Bid | undefined,
  bids: Bid[],
  me: string | undefined,
  settings: SiteSettings,
  now: number,
) {
  const hideWin =
    lots.length > 0 && lots.every((lot) => isSealedLot(lot, settings) && lot.endsAt > now)
  let totalBid = 0
  let winningAmount = 0
  for (const lot of lots) {
    const last = myLastBid(lot.id)
    if (!last) continue
    totalBid += last.qty * last.amount
    const stats = fillStats(lot, bids, me)
    if (!isSealedLot(lot, settings) && stats.myPcs > 0) {
      winningAmount += stats.myPcs * last.amount
    }
  }
  return { totalBid, winningAmount, hideWin }
}

export function BidTotals({
  lots,
  children,
  collapsed = false,
  /** Desk scrolls away; sticky offset ignores desk height (command bar owns sticky). */
  scrollAway = false,
  /** When false, money/timer chips are omitted (shown on the list command bar instead). */
  showChips = true,
}: {
  lots: Lot[]
  children?: ReactNode
  /** When true, the whole desk is removed (toggle + recap live on the list head). */
  collapsed?: boolean
  scrollAway?: boolean
  showChips?: boolean
}) {
  const now = useNow()
  const { myLastBid, bids, user, settings, isStaff, reopenAuctions, extendAuctionType } = useStore()
  const me = user?.accountId
  const deskRef = useRef<HTMLDivElement>(null)
  const { totalBid, winningAmount, hideWin } = bidDeskSummary(
    lots,
    myLastBid,
    bids,
    me,
    settings,
    now,
  )
  const clockRows = settings.features.endingSoon
    ? auctionClockRows(lots, settings, now, settings.endingSoonMinutes)
    : []
  const closingSoon = clockRows.filter((row) => row.closing)
  const closeBars = closingSoon.length ? closingSoon : clockRows.slice(0, 1)
  const listsClosed =
    settings.auctionTypes.length > 0 &&
    settings.auctionTypes.every((t) => !t.closesAt || t.closesAt <= now)
  const staffActions =
    isStaff &&
    (listsClosed ||
      settings.auctionTypes.some((t) => !t.closesAt || t.closesAt <= now))

  useLayoutEffect(() => {
    if (scrollAway || (collapsed && !staffActions)) {
      document.documentElement.style.setProperty('--auction-desk-h', '0px')
      return () => {
        document.documentElement.style.removeProperty('--auction-desk-h')
      }
    }
    const el = deskRef.current
    if (!el) return
    const apply = () => {
      document.documentElement.style.setProperty(
        '--auction-desk-h',
        `${Math.round(el.getBoundingClientRect().height)}px`,
      )
    }
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    apply()
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty('--auction-desk-h')
    }
  }, [collapsed, children, staffActions, scrollAway])

  if (collapsed && !staffActions) return null

  return (
    <div
      ref={deskRef}
      className={`auction-desk${collapsed ? ' is-collapsed' : ''}${scrollAway ? ' is-scrollaway' : ''}`}
    >
      {staffActions ? (
        <div className="auction-desk-head">
          <div />
          <div className="auction-desk-head-actions">
            {isStaff && listsClosed ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => reopenAuctions()}
                title="Start a new shared close clock for every auction list"
              >
                Reopen lists
              </button>
            ) : null}
            {isStaff && !listsClosed
              ? settings.auctionTypes.map((t) =>
                  t.closesAt && t.closesAt > now ? null : (
                    <button
                      key={t.value}
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => extendAuctionType(t.value)}
                    >
                      Open {t.label}
                    </button>
                  ),
                )
              : null}
          </div>
        </div>
      ) : null}
      {children && !collapsed ? <div className="auction-desk-filters">{children}</div> : null}
      {!collapsed && showChips ? (
        <div className="auction-desk-chips" aria-label="Bidding totals">
          <div
            className="filter-trigger is-static is-bid-chip"
            title="Your qty × your price on these lots"
          >
            <span className="filter-trigger-title">Total Bid</span>
            <span className="filter-trigger-value">{usd(totalBid)}</span>
          </div>
          <div
            className={`filter-trigger is-static${hideWin ? '' : ' is-win-chip'}`}
            title={
              hideWin
                ? 'Win/lose stays hidden on Offline Auctions until close'
                : 'Pcs you are currently allocated × your price'
            }
          >
            <span className="filter-trigger-title">Winning</span>
            <span className="filter-trigger-value">
              {hideWin ? 'Hidden' : usd(winningAmount)}
            </span>
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
                className={`filter-trigger is-close-chip is-${heat}`}
                style={{ ['--close-pct' as string]: `${Math.round(pct * 100)}%` }}
                title={`${row.label} · ${row.count} lots · ${timeLeft(row.endsAt, now)} left`}
              >
                <span className="filter-trigger-title">{row.label}</span>
                <span className="filter-trigger-value">
                  <TimeLeft endsAt={row.endsAt} />
                  <em>{row.count === 1 ? '1' : row.count}</em>
                </span>
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function YouWin({ row }: { row: Row }) {
  const { settings } = useStore()
  const { lot, last, stats, st, closed, winTotal } = row
  const sealedOpen = isSealedLot(lot, settings) && !closed
  const myPcs = sealedOpen ? last?.qty ?? 0 : stats.myPcs
  return (
    <FillBar
      total={lot.qty}
      myPcs={myPcs}
      sealed={sealedOpen}
      status={st}
      endsAt={lot.endsAt}
      amount={winTotal == null ? 'Hidden' : usd(winTotal)}
      amountNote={
        !sealedOpen && stats.myPcs > 0 ? `${stats.myPcs.toLocaleString()} pcs allocated` : null
      }
    />
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
      <td className="item-col">
        <ItemLink lot={lot} showMoq={false} showGrade={false} showLotId />
      </td>
      <td>
        <span className={`grade-inline grade-${lot.grade}`}>{lot.grade}</span>
      </td>
      <td className="lot-qty">
        <div className="cell-stack">
          <span className="cell-primary">{lot.qty.toLocaleString()}</span>
          <span className="cell-secondary">pcs</span>
          <span className="cell-chip">{moqLabel(lot, settings.copy.noMoq)}</span>
        </div>
      </td>
      <td className="price-cell">
        {isSealedLot(lot, settings) && !row.closed ? (
          <div className="cell-stack cell-stack-end">
            <span className="cell-chip soft">Hidden</span>
          </div>
        ) : (
          <div className="cell-stack cell-stack-end">
            <span className="cell-primary">{usd(lot.currentPrice)}</span>
            <span className="cell-secondary">/pc</span>
          </div>
        )}
      </td>
      <td className="price-cell">
        {yourTotal != null && last ? (
          <div className="cell-stack cell-stack-end">
            <span className="cell-primary">{usd(yourTotal)}</span>
            <span className="cell-secondary">
              {last.qty} pcs × {usd(last.amount)}
            </span>
            <span className="cell-chip">{last.qty >= lot.qty ? 'take all' : 'small qty'}</span>
          </div>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td className="fill-cell">
        <YouWin row={row} />
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
      <ItemLink lot={lot} showMoq={false} showGrade={false} showLotId />
      <div className="auction-card-meta">
        <span className={`grade-inline grade-${lot.grade}`}>{lot.grade}</span>
        <div className="cell-stack lot-qty">
          <span className="cell-primary">{lot.qty.toLocaleString()}</span>
          <span className="cell-secondary">pcs</span>
          <span className="cell-chip">{moqLabel(lot, settings.copy.noMoq)}</span>
        </div>
      </div>
      <YouWin row={row} />
      <div className="auction-card-prices">
        <div className="cell-stack">
          <span className="cell-secondary">Current Price</span>
          {isSealedLot(lot, settings) && !closed ? (
            <span className="cell-chip soft">Hidden</span>
          ) : (
            <>
              <span className="cell-primary">{usd(lot.currentPrice)}</span>
              <span className="cell-secondary">/pc</span>
            </>
          )}
        </div>
        <div className="cell-stack">
          <span className="cell-secondary">Your bid</span>
          <span className="cell-primary">
            {yourTotal != null && last ? usd(yourTotal) : '—'}
          </span>
          {yourTotal != null && last ? (
            <>
              <span className="cell-secondary">
                {last.qty} pcs × {usd(last.amount)}
              </span>
              <span className="cell-chip">{last.qty >= lot.qty ? 'take all' : 'small qty'}</span>
            </>
          ) : null}
        </div>
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
  showBidGroups = true,
}: {
  lots: Lot[]
  compareIds?: string[]
  onToggleCompare?: (id: string) => void
  showTotals?: boolean
  /** When false, keep your-bids-first order but hide in-table section titles. */
  showBidGroups?: boolean
}) {
  const now = useNow()
  const { myLastBid, bids, user, settings } = useStore()
  const me = user?.accountId
  const colSpan = (onToggleCompare ? 1 : 0) + 7

  const sections = useMemo(() => {
    const ordered = orderFocusRows(buildRows(lots, myLastBid, bids, me, settings, now))
    const mine = ordered.filter((r) => r.last)
    const rest = ordered.filter((r) => !r.last)
    if (!showBidGroups) {
      return [{ key: 'all', title: null as string | null, rows: ordered }]
    }
    if (!mine.length) return [{ key: 'all', title: null as string | null, rows: rest }]
    if (!rest.length) {
      return [{ key: 'mine', title: `Your bids · ${mine.length}`, rows: mine }]
    }
    return [
      { key: 'mine', title: `Your bids · ${mine.length}`, rows: mine },
      { key: 'rest', title: `Not bid yet · ${rest.length}`, rows: rest },
    ]
  }, [lots, myLastBid, bids, me, settings, now, showBidGroups])

  return (
    <>
      {showTotals ? <BidTotals lots={lots} /> : null}
      <div className="table-wrap card auction-table-wrap">
        <table className="auction-table">
          <thead>
            <tr>
              {onToggleCompare ? <th>Cmp</th> : null}
              <th>Items</th>
              <th>Grade</th>
              <th>Quantity</th>
              <th>Current Price</th>
              <th>Your bid total</th>
              <th>Winning Status</th>
              <th>Bid Order</th>
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
