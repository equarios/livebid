import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AuctionTable,
  AUCTION_DESK_KEY,
  BidTotals,
  bidDeskSummary,
  readDeskCollapsed,
} from '../components/AuctionTable'
import { AuctionTypeHead } from '../components/AuctionTypeHead'
import { AuctionTypeNav, auctionTypeFilterOptions } from '../components/AuctionTypeNav'
import { BidCsv } from '../components/BidCsv'
import { DeskIntro } from '../components/DeskIntro'
import { resolveDeskBannerSlides } from '../lib/deskBanner'
import {
  capacityOptions,
  CheckMenu,
  makerOptions,
  originFilterOptions,
  toggleValue,
} from '../components/CheckMenu'
import { isFilterUiTarget } from '../components/FilterPanel'
import { LotCompare } from '../components/LotCompare'
import {
  auctionClockRows,
  groupLotsByType,
  inAuctionList,
  isAuctionListKind,
  listPath,
  migrateLotAuctionType,
  originLabel,
  type AuctionListKind,
} from '../lib/auctionLists'
import { usd } from '../lib/format'
import { useNow, useStore } from '../store'
import type { Grade, SiteSettings } from '../types'
import { TimeLeft } from '../components/TimeLeft'

const COACH_KEY = 'equarios-bid-coach-dismissed'

function filtersFromHash(hash: string, settings: SiteSettings): AuctionListKind[] {
  const kind = hash.replace(/^#/, '') || 'all'
  if (!kind || kind === 'all' || !isAuctionListKind(kind, settings)) return []
  return [kind]
}

export function Auctions() {
  const { type: typeParam } = useParams()
  const { settings } = useStore()
  if (typeParam && !isAuctionListKind(typeParam, settings)) return <Navigate to="/auctions" replace />
  if (typeParam) return <Navigate to={{ pathname: '/auctions', hash: typeParam }} replace />
  return <AuctionList />
}

function AuctionList() {
  const now = useNow()
  const navigate = useNavigate()
  const { lots, settings, user, bids, myLastBid } = useStore()
  const me = user?.accountId
  const location = useLocation()
  const typeSlugs = useMemo(() => settings.auctionTypes.map((t) => t.value), [settings.auctionTypes])
  const GRADES = settings.grades
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const [listFilters, setListFilters] = useState<AuctionListKind[]>(() =>
    filtersFromHash(location.hash, settings),
  )
  const [grades, setGrades] = useState<Grade[]>([])
  const [makers, setMakers] = useState<string[]>([])
  const [memories, setMemories] = useState<string[]>([])
  const [origins, setOrigins] = useState<string[]>([])
  const [open, setOpen] = useState<'type' | 'maker' | 'grade' | 'memory' | 'origin' | 'csv' | null>(
    null,
  )
  const filtersRef = useRef<HTMLDivElement>(null)
  const toolsRef = useRef<HTMLDivElement>(null)
  const skipHashWrite = useRef(false)
  const [coachOn, setCoachOn] = useState(() => {
    try {
      return localStorage.getItem(COACH_KEY) !== '1'
    } catch {
      return true
    }
  })
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [deskCollapsed, setDeskCollapsed] = useState(() => readDeskCollapsed(AUCTION_DESK_KEY))
  function toggleDesk() {
    setDeskCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(AUCTION_DESK_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const selectedTypes = listFilters.filter((f) => typeSlugs.includes(f))
  const wantOngoing = listFilters.includes('ongoing')
  const wantClosed = listFilters.includes('closed')
  const kind: AuctionListKind = listFilters.length === 1 ? listFilters[0] : 'all'
  const closedOnly = wantClosed && !wantOngoing

  useEffect(() => {
    if (skipHashWrite.current) {
      skipHashWrite.current = false
      return
    }
    const fromHash = filtersFromHash(location.hash, settings)
    setListFilters((prev) => {
      // Multi-select clears the hash — do not treat that as "All".
      if (prev.length > 1 && fromHash.length === 0) return prev
      const same =
        fromHash.length === prev.length && fromHash.every((v, i) => v === prev[i])
      return same ? prev : fromHash
    })
  }, [location.hash, settings])

  useEffect(() => {
    const next =
      listFilters.length === 1 ? listPath(listFilters[0]) : listPath('all')
    const current = `${location.pathname}${location.hash || ''}`
    if (current === next || (next === '/auctions' && location.pathname === '/auctions' && !location.hash)) {
      return
    }
    skipHashWrite.current = true
    navigate(next, { replace: true })
  }, [listFilters, location.hash, location.pathname, navigate])

  const catalog = useMemo(
    () => lots.filter((l) => inAuctionList(l, 'all', now)),
    [lots, now],
  )
  const makersList = useMemo(() => makerOptions(catalog), [catalog])
  const capacities = useMemo(() => capacityOptions(catalog), [catalog])
  const originsList = useMemo(() => originFilterOptions(catalog), [catalog])

  useEffect(() => {
    setCompareIds([])
  }, [listFilters.join('|')])

  useEffect(() => {
    if (open === 'type' || selectedTypes.length !== 1) return
    const node = document.getElementById(`auction-list-${selectedTypes[0]}`)
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedTypes.join('|'), catalog.length, open])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (
        !isFilterUiTarget(e.target, filtersRef.current) &&
        !isFilterUiTarget(e.target, toolsRef.current)
      ) {
        setOpen(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = catalog.filter((l) => {
    const lotType = migrateLotAuctionType(l.auctionType)
    if (selectedTypes.length && !selectedTypes.includes(lotType)) return false
    if (wantOngoing && !wantClosed && l.endsAt <= now) return false
    if (wantClosed && !wantOngoing && l.endsAt > now) return false
    if (grades.length && !grades.includes(l.grade)) return false
    if (makers.length && !makers.includes(l.manufacturer)) return false
    if (memories.length && !memories.includes(l.capacity)) return false
    if (origins.length && !origins.includes(originLabel(l.origin))) return false
    const hay = `${l.id} ${l.manufacturer} ${l.model} ${l.modelNumber} ${l.capacity} ${l.color} ${l.origin || ''}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  const groups = groupLotsByType(filtered, settings, closedOnly ? 'close-late' : 'close-soon')

  const hasBids = Boolean(user && bids.some((b) => b.accountId === user.accountId))
  const showCoach = coachOn && user && !hasBids && settings.features.bidding

  function dismissCoach() {
    setCoachOn(false)
    try {
      localStorage.setItem(COACH_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  function toggleListFilter(value: AuctionListKind) {
    startTransition(() => {
      setListFilters((prev) => {
        const allowed = new Set(auctionTypeFilterOptions(settings))
        if (!allowed.has(value)) return prev
        return toggleValue(prev, value)
      })
    })
  }

  const csvLots = filtered.filter((l) => l.endsAt > now)

  return (
    <div className="auctions-page is-command-bar desk-page">
      <DeskIntro
        brand={settings.brandName || 'eQuarios'}
        slides={resolveDeskBannerSlides(settings, 'auctions')}
        intervalSec={settings.pages?.heroIntervalSec}
        veil="trade"
        label="Auctions"
      />
      {showCoach ? (
        <div className="coach-panel">
          <div>
            <strong>First bid</strong>
            <p>
              Enter qty (MOQ or more) and a per-piece price. Last bid per account counts. Highest
              prices fill the lot first. Take all if you want every remaining unit.
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={dismissCoach}>
            Got it
          </button>
        </div>
      ) : null}
      {compareIds.length ? (
        <div className="compare-bar">
          <span>{compareIds.length} selected for compare (pick 2)</span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={compareIds.length < 2}
            onClick={() => setCompareOpen(true)}
          >
            Compare
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCompareIds([])}>
            Clear
          </button>
        </div>
      ) : null}
      <BidTotals lots={filtered} collapsed={deskCollapsed} scrollAway showChips={false}>
        <div className="filters filters-no-search" ref={filtersRef}>
          <div className="filter-groups">
            <AuctionTypeNav
              open={open === 'type'}
              onOpen={() => setOpen((v) => (v === 'type' ? null : 'type'))}
              selected={listFilters}
              onToggle={toggleListFilter}
              onSelectAll={() => startTransition(() => setListFilters([]))}
            />
            {settings.filters.maker ? (
              <CheckMenu
                title="Maker"
                open={open === 'maker'}
                onOpen={() => setOpen((v) => (v === 'maker' ? null : 'maker'))}
                options={makersList}
                selected={makers}
                onToggle={(value) =>
                  startTransition(() => setMakers((prev) => toggleValue(prev, value)))
                }
              />
            ) : null}
            {settings.filters.grade ? (
              <CheckMenu
                title="Grade"
                open={open === 'grade'}
                onOpen={() => setOpen((v) => (v === 'grade' ? null : 'grade'))}
                options={GRADES}
                selected={grades}
                onToggle={(value) =>
                  startTransition(() => setGrades((prev) => toggleValue(prev, value)))
                }
              />
            ) : null}
            {settings.filters.capacity ? (
              <CheckMenu
                title="Capacity"
                open={open === 'memory'}
                onOpen={() => setOpen((v) => (v === 'memory' ? null : 'memory'))}
                options={capacities}
                selected={memories}
                onToggle={(value) =>
                  startTransition(() => setMemories((prev) => toggleValue(prev, value)))
                }
              />
            ) : null}
            {settings.filters.origin ? (
              <CheckMenu
                title="Origin"
                open={open === 'origin'}
                onOpen={() => setOpen((v) => (v === 'origin' ? null : 'origin'))}
                options={originsList}
                selected={origins}
                onToggle={(value) =>
                  startTransition(() => setOrigins((prev) => toggleValue(prev, value)))
                }
              />
            ) : null}
          </div>
        </div>
      </BidTotals>
      {groups.length ? (
        <div className="auction-lists-stack">
          {groups.map((group, groupIndex) => {
            const yourBids = group.lots.filter((lot) => myLastBid(lot.id)).length
            const openLots = group.lots.length - yourBids
            const solo = groups.length === 1
            const groupSummary = bidDeskSummary(
              group.lots,
              myLastBid,
              bids,
              me,
              settings,
              now,
            )
            const typeMeta = settings.auctionTypes.find((t) => t.value === group.value)
            const clock = auctionClockRows(group.lots, settings, now, settings.endingSoonMinutes).find(
              (r) => r.value === group.value,
            )
            const showTimer = Boolean(clock && clock.endsAt > now)
            const timerTitle = clock
              ? clock.phase === 'extra'
                ? `${group.label} · Sealed · prior bidders only`
                : clock.extraEndsAt && clock.extraEndsAt > clock.liveEndsAt
                  ? `${group.label} · live close, then Sealed`
                  : `${group.label} · time left`
              : `${group.label} · time left`
            return (
            <section
              key={group.value}
              id={`auction-list-${group.value}`}
              className={`auction-type-block${solo ? ' is-solo' : ''}`}
            >
              <AuctionTypeHead>
                <div className="auction-command">
                  <h2>
                    {group.label}
                    <em>{group.lots.length}</em>
                  </h2>
                  {showTimer && clock ? (
                    <span
                      className={`auction-command-timer${clock.phase === 'extra' ? ' is-extra' : ''}${
                        clock.closing ? ' is-hot' : ''
                      }`}
                      style={
                        clock.durationMs > 0
                          ? {
                              ['--close-pct' as string]: `${Math.round(
                                Math.max(
                                  0,
                                  Math.min(
                                    1,
                                    1 - (clock.endsAt - now) / Math.max(1, clock.durationMs),
                                  ),
                                ) * 100,
                              )}%`,
                            }
                          : undefined
                      }
                      title={timerTitle}
                    >
                      {clock.phase === 'extra' ? (
                        <em className="auction-command-timer-phase">Sealed</em>
                      ) : null}
                      <TimeLeft endsAt={clock.endsAt} />
                    </span>
                  ) : null}
                  <span
                    className={`auction-command-stat${groupSummary.hideWin ? '' : ' is-win'}`}
                    title={
                      groupSummary.hideWin
                        ? 'Win/lose stays hidden until close'
                        : 'Pcs you are currently allocated × your price'
                    }
                  >
                    Winning {groupSummary.hideWin ? 'Hidden' : usd(groupSummary.winningAmount)}
                  </span>
                  {!deskCollapsed ? (
                    <>
                      {(typeMeta?.feePct ?? settings.invoice.feePct) > 0 ? (
                        <span
                          className="auction-command-stat is-fee"
                          title="System usage fee on winning goods"
                        >
                          Fee {typeMeta?.feePct ?? settings.invoice.feePct}%
                        </span>
                      ) : null}
                      {yourBids > 0 ? (
                        <span className="auction-command-stat is-yours" title="Lots you have bid on">
                          Your bids {yourBids}
                        </span>
                      ) : null}
                      {openLots > 0 ? (
                        <span className="auction-command-stat is-open" title="Lots you have not bid on">
                          Open {openLots}
                        </span>
                      ) : null}
                      <span
                        className="auction-command-stat is-money"
                        title="Your qty × your price on these lots"
                      >
                        Total Bid {usd(groupSummary.totalBid)}
                      </span>
                    </>
                  ) : null}
                </div>
                <div
                  className="auction-type-head-tools"
                  ref={groupIndex === 0 ? toolsRef : undefined}
                >
                  {groupIndex === 0 && !closedOnly ? (
                    <BidCsv
                      lots={csvLots}
                      listKind={kind === 'closed' ? 'all' : kind}
                      open={open === 'csv'}
                      onOpen={() => setOpen((v) => (v === 'csv' ? null : 'csv'))}
                      variant="tools"
                    />
                  ) : null}
                  {groupIndex === 0 && closedOnly ? (
                    <p className="muted tiny bid-csv-hint">CSV needs open lots</p>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm auction-desk-chip-hide"
                    onClick={toggleDesk}
                    aria-label={
                      deskCollapsed
                        ? 'Show search and filters'
                        : 'Hide search and filters'
                    }
                    title={deskCollapsed ? 'Show filters' : 'Hide filters'}
                  >
                    {deskCollapsed ? '+' : '−'}
                  </button>
                </div>
              </AuctionTypeHead>
              <AuctionTable
                lots={group.lots}
                compareIds={compareIds}
                onToggleCompare={toggleCompare}
                showTotals={false}
                showBidGroups={false}
              />
            </section>
            )
          })}
        </div>
      ) : (
        <>
          {!closedOnly ? (
            <div className="auction-type-head-tools auction-empty-tools" ref={toolsRef}>
              <BidCsv
                lots={csvLots}
                listKind={kind === 'closed' ? 'all' : kind}
                open={open === 'csv'}
                onOpen={() => setOpen((v) => (v === 'csv' ? null : 'csv'))}
                variant="tools"
              />
            </div>
          ) : null}
          <div className="mh-empty">
            <p>{settings.copy.emptyFilters}</p>
          </div>
        </>
      )}
      {compareOpen ? (
        <LotCompare
          ids={compareIds}
          onClose={() => setCompareOpen(false)}
          onClear={(id) => {
            setCompareIds((prev) => prev.filter((x) => x !== id))
            setCompareOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
