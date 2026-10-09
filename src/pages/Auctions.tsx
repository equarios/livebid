import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AuctionTable, BidTotals } from '../components/AuctionTable'
import { AuctionTypeHead } from '../components/AuctionTypeHead'
import { AuctionTypeNav, auctionTypeFilterOptions } from '../components/AuctionTypeNav'
import { BidCsv } from '../components/BidCsv'
import {
  capacityOptions,
  CheckMenu,
  makerOptions,
  toggleValue,
} from '../components/CheckMenu'
import { LotCompare } from '../components/LotCompare'
import {
  groupLotsByType,
  inAuctionList,
  isAuctionListKind,
  listIntro,
  listPath,
  localTimeZone,
  migrateLotAuctionType,
  type AuctionListKind,
} from '../lib/auctionLists'
import { useNow, useStore } from '../store'
import type { Grade, SiteSettings } from '../types'

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
  const { lots, settings, user, bids } = useStore()
  const location = useLocation()
  const typeSlugs = useMemo(() => settings.auctionTypes.map((t) => t.value), [settings.auctionTypes])
  const GRADES = settings.grades
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  useEffect(() => {
    setQ(params.get('q') || '')
  }, [params])
  const [listFilters, setListFilters] = useState<AuctionListKind[]>(() =>
    filtersFromHash(location.hash, settings),
  )
  const [grades, setGrades] = useState<Grade[]>([])
  const [makers, setMakers] = useState<string[]>([])
  const [memories, setMemories] = useState<string[]>([])
  const [open, setOpen] = useState<'type' | 'maker' | 'grade' | 'memory' | 'csv' | null>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
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
      if (!filtersRef.current?.contains(e.target as Node)) setOpen(null)
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
    setListFilters((prev) => {
      const allowed = new Set(auctionTypeFilterOptions(settings))
      if (!allowed.has(value)) return prev
      return toggleValue(prev, value)
    })
  }

  const tz = localTimeZone()
  const csvLots = filtered.filter((l) => l.endsAt > now)

  return (
    <div>
      <h1 className="sr-only">{settings.copy.auctionsTitle}</h1>
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
      <BidTotals lots={filtered}>
        <div className="filters" ref={filtersRef}>
          <input
            placeholder={settings.copy.searchAuctions}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
            }}
          />
          <div className="filter-groups">
            <AuctionTypeNav
              open={open === 'type'}
              onOpen={() => setOpen((v) => (v === 'type' ? null : 'type'))}
              selected={listFilters}
              onToggle={toggleListFilter}
              onSelectAll={() => setListFilters([])}
            />
            {settings.filters.maker ? (
            <CheckMenu
              title="Maker"
              open={open === 'maker'}
              onOpen={() => setOpen((v) => (v === 'maker' ? null : 'maker'))}
              options={makersList}
              selected={makers}
              onToggle={(value) => setMakers((prev) => toggleValue(prev, value))}
            />
            ) : null}
            {settings.filters.grade ? (
            <CheckMenu
              title="Grade"
              open={open === 'grade'}
              onOpen={() => setOpen((v) => (v === 'grade' ? null : 'grade'))}
              options={GRADES}
              selected={grades}
              onToggle={(value) => setGrades((prev) => toggleValue(prev, value))}
            />
            ) : null}
            {settings.filters.capacity ? (
            <CheckMenu
              title="Capacity"
              open={open === 'memory'}
              onOpen={() => setOpen((v) => (v === 'memory' ? null : 'memory'))}
              options={capacities}
              selected={memories}
              onToggle={(value) => setMemories((prev) => toggleValue(prev, value))}
            />
            ) : null}
            {!closedOnly ? (
              <BidCsv
                lots={csvLots}
                listKind={kind === 'closed' ? 'all' : kind}
                open={open === 'csv'}
                onOpen={() => setOpen((v) => (v === 'csv' ? null : 'csv'))}
              />
            ) : (
              <p className="muted tiny bid-csv-hint">
                Closed lots cannot take new bids. Clear Closed or add Ongoing for CSV.
              </p>
            )}
          </div>
        </div>
      </BidTotals>
      {groups.length ? (
        <div className="auction-lists-stack">
          {groups.map((group) => (
            <section
              key={group.value}
              id={`auction-list-${group.value}`}
              className="auction-type-block"
            >
              <AuctionTypeHead>
                <div>
                  <h2>
                    {group.label}
                    <em>{group.lots.length}</em>
                  </h2>
                  <p className="muted tiny auction-type-block-intro">
                    {listIntro(group.value, settings)} USD · {tz}. Your bids stay at the top.
                  </p>
                </div>
              </AuctionTypeHead>
              <AuctionTable
                lots={group.lots}
                compareIds={compareIds}
                onToggleCompare={toggleCompare}
                showTotals={false}
              />
            </section>
          ))}
        </div>
      ) : (
        <p className="empty">{settings.copy.emptyFilters}</p>
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
