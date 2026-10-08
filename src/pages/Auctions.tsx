import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { AuctionTable } from '../components/AuctionTable'
import { AuctionTypeNav } from '../components/AuctionTypeNav'
import { BidCsv } from '../components/BidCsv'
import {
  capacityOptions,
  CheckMenu,
  makerOptions,
  toggleValue,
} from '../components/CheckMenu'
import { clampRange, PriceMenu, priceBounds } from '../components/PriceRangeBar'
import { ItemLink } from '../components/ItemLink'
import { TimeLeft } from '../components/TimeLeft'
import { LotCompare } from '../components/LotCompare'
import {
  groupLotsByType,
  inAuctionList,
  isAuctionListKind,
  listIntro,
  listLabel,
  listPath,
  localTimeZone,
  originOptions,
  sortLots,
  type AuctionListKind,
} from '../lib/auctionLists'
import { isEndingSoon } from '../lib/format'
import { readSavedSearches, writeSavedSearches, type SavedSearch } from '../lib/savedSearches'
import { useStore } from '../store'
import type { AuctionType, Grade } from '../types'

type TypeFilter = AuctionType | 'ongoing'

const COACH_KEY = 'equarios-bid-coach-dismissed'

type SavedFilters = {
  types: TypeFilter[]
  grades: Grade[]
  makers: string[]
  memories: string[]
  origins: string[]
  lo: number
  hi: number
  q: string
}

export function Auctions() {
  const { type: typeParam } = useParams()
  const { settings } = useStore()
  if (typeParam && !isAuctionListKind(typeParam, settings)) return <Navigate to="/auctions" replace />
  const listKind: AuctionListKind = typeParam && isAuctionListKind(typeParam, settings) ? typeParam : 'all'
  return <AuctionList kind={listKind} />
}

function AuctionList({ kind }: { kind: AuctionListKind }) {
  const { lots, settings, user, bids } = useStore()
  const TYPES = settings.auctionTypes
  const typeOptions: TypeFilter[] = ['ongoing', ...TYPES.map((t) => t.value)]
  const GRADES = settings.grades
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  useEffect(() => {
    setQ(params.get('q') || '')
  }, [params])
  const [types, setTypes] = useState<TypeFilter[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [makers, setMakers] = useState<string[]>([])
  const [memories, setMemories] = useState<string[]>([])
  const [origins, setOrigins] = useState<string[]>([])
  const [open, setOpen] = useState<'type' | 'maker' | 'grade' | 'memory' | 'price' | 'origin' | null>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
  const [coachOn, setCoachOn] = useState(() => {
    try {
      return localStorage.getItem(COACH_KEY) !== '1'
    } catch {
      return true
    }
  })
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [searchName, setSearchName] = useState('')
  const [named, setNamed] = useState(readSavedSearches)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [sort, setSort] = useState('close-soon')
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(50)
  const filterKey = `equarios-auction-filters-${kind}`

  const catalog = useMemo(
    () => lots.filter((l) => inAuctionList(l, kind)),
    [lots, kind],
  )
  const makersList = useMemo(() => makerOptions(catalog), [catalog])
  const capacities = useMemo(() => capacityOptions(catalog), [catalog])
  const originList = useMemo(() => originOptions(catalog), [catalog])
  const bounds = useMemo(
    () => priceBounds(catalog.map((l) => l.currentPrice)),
    [catalog],
  )
  const [lo, setLo] = useState(bounds.min)
  const [hi, setHi] = useState(bounds.max)
  const range = clampRange(lo, hi, bounds.min, bounds.max)

  useEffect(() => {
    setPage(0)
    setCompareIds([])
    setLo(bounds.min)
    setHi(bounds.max)
  }, [kind, bounds.min, bounds.max])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!filtersRef.current?.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = catalog.filter((l) => {
    const wantOngoing = types.includes('ongoing')
    const typeSelected = types.filter((t): t is AuctionType => t !== 'ongoing')
    if (kind === 'all') {
      if (wantOngoing && l.endsAt <= Date.now()) return false
      if (typeSelected.length && (!l.auctionType || !typeSelected.includes(l.auctionType))) return false
    }
    if (grades.length && !grades.includes(l.grade)) return false
    if (makers.length && !makers.includes(l.manufacturer)) return false
    if (memories.length && !memories.includes(l.capacity)) return false
    if (origins.length && !origins.includes(l.origin || 'INT')) return false
    if (l.currentPrice < range.lo || l.currentPrice > range.hi) return false
    const hay = `${l.id} ${l.manufacturer} ${l.model} ${l.modelNumber} ${l.capacity} ${l.color} ${l.origin || ''}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  const typeOrder = TYPES.map((t) => t.value)
  const groupedView = kind === 'all' || kind === 'ongoing'
  const rows = sortLots(filtered, sort, groupedView ? typeOrder : undefined)
  const groups = groupedView ? groupLotsByType(filtered, settings, sort) : []
  const pages = Math.max(1, Math.ceil(rows.length / perPage))
  const safePage = Math.min(page, pages - 1)
  const slice = rows.slice(safePage * perPage, safePage * perPage + perPage)

  const closingSoon = useMemo(() => {
    const soon = catalog.filter((l) => isEndingSoon(l.endsAt, Date.now(), settings.endingSoonMinutes))
    if (kind === 'all' || kind === 'ongoing') {
      return groupLotsByType(soon, settings, 'close-soon').flatMap((g) => g.lots.slice(0, 4))
    }
    return sortLots(soon, 'close-soon').slice(0, 8)
  }, [catalog, settings, kind])

  const hasBids = Boolean(user && bids.some((b) => b.accountId === user.accountId))
  const kindMode = TYPES.find((t) => t.value === kind)?.fillMode
  const showCoach = coachOn && user && !hasBids && settings.features.bidding && kindMode !== 'sealed'

  function dismissCoach() {
    setCoachOn(false)
    try {
      localStorage.setItem(COACH_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  function currentSearch(): SavedFilters {
    return { types, grades, makers, memories, origins, lo: range.lo, hi: range.hi, q }
  }

  function applySearch(parsed: SavedFilters) {
    setTypes(parsed.types || [])
    setGrades(parsed.grades || [])
    setMakers(parsed.makers || [])
    setMemories(parsed.memories || [])
    setOrigins(parsed.origins || [])
    setLo(parsed.lo)
    setHi(parsed.hi)
    setQ(parsed.q || '')
    setPage(0)
  }

  function saveFilters() {
    try {
      localStorage.setItem(filterKey, JSON.stringify(currentSearch()))
      setSavedNote('Filters saved for this list.')
    } catch {
      setSavedNote('Could not save filters.')
    }
  }

  function loadFilters() {
    try {
      const raw = localStorage.getItem(filterKey)
      if (!raw) {
        setSavedNote('No saved filters for this list yet.')
        return
      }
      applySearch(JSON.parse(raw) as SavedFilters)
      setSavedNote('Saved filters applied.')
    } catch {
      setSavedNote('Could not load filters.')
    }
  }

  function saveNamed() {
    const name = searchName.trim()
    if (!name) {
      setSavedNote('Name this search first.')
      return
    }
    const next: SavedSearch[] = [
      { name, ...currentSearch() },
      ...named.filter((s) => s.name.toLowerCase() !== name.toLowerCase()),
    ]
    try {
      writeSavedSearches(next)
      setNamed(next)
      setSearchName('')
      setSavedNote(`Saved “${name}”.`)
    } catch {
      setSavedNote('Could not save that search.')
    }
  }

  function deleteNamed(name: string) {
    const next = named.filter((s) => s.name !== name)
    writeSavedSearches(next)
    setNamed(next)
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  const tz = localTimeZone()
  const showTypeFilter = kind === 'all' && settings.filters.type
  const title = kind === 'all' ? settings.copy.auctionsTitle : listLabel(kind, settings)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p className="muted">{listIntro(kind, settings)}</p>
          <p className="muted tiny">
            Prices in USD. Times in your local zone ({tz}). This list is its own inventory
            {kind !== 'all' && kind !== 'ongoing'
              ? ` — ${rows.length} lots`
              : ` — ${catalog.length} lots grouped by type so Real-time stays with Real-time`}.
          </p>
        </div>
      </div>
      <AuctionTypeNav />
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
      {settings.features.endingSoon && closingSoon.length ? (
        <div className="closing-strip">
          <strong>Closing soon on this list</strong>
          <div className="closing-row">
            {closingSoon.map((lot) => (
              <div key={lot.id} className="closing-chip">
                <ItemLink lot={lot} />
                <TimeLeft endsAt={lot.endsAt} warn />
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="filters" ref={filtersRef}>
        <input
          placeholder={settings.copy.searchAuctions}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(0)
          }}
        />
        <div className="filter-groups">
          {showTypeFilter ? (
          <CheckMenu
            title="Type"
            open={open === 'type'}
            onOpen={() => setOpen((v) => (v === 'type' ? null : 'type'))}
            options={typeOptions}
            selected={types}
            onToggle={(value) => setTypes((prev) => toggleValue(prev, value))}
            labelFor={(value) =>
              value === 'ongoing' ? 'Ongoing' : (TYPES.find((t) => t.value === value)?.label ?? value)
            }
          />
          ) : null}
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
          <CheckMenu
            title="Origin"
            open={open === 'origin'}
            onOpen={() => setOpen((v) => (v === 'origin' ? null : 'origin'))}
            options={originList}
            selected={origins}
            onToggle={(value) => setOrigins((prev) => toggleValue(prev, value))}
          />
          {settings.filters.price ? (
          <PriceMenu
            min={bounds.min}
            max={bounds.max}
            lo={range.lo}
            hi={range.hi}
            open={open === 'price'}
            onOpen={() => setOpen((v) => (v === 'price' ? null : 'price'))}
            onChange={(nextLo, nextHi) => {
              setLo(nextLo)
              setHi(nextHi)
            }}
          />
          ) : null}
        </div>
        <div className="filter-save">
          <label className="sort-label">
            Sort
            <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(0) }}>
              <option value="close-soon">Closing soon</option>
              <option value="close-late">Closing last</option>
              <option value="price">Price / pc</option>
              <option value="qty">Lot size</option>
              <option value="maker">Maker</option>
            </select>
          </label>
          <label className="sort-label">
            Per page
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(0) }}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <button type="button" className="btn btn-ghost" onClick={saveFilters}>
            Save filters
          </button>
          <button type="button" className="btn btn-ghost" onClick={loadFilters}>
            Load saved
          </button>
          <input
            className="named-search-input"
            placeholder="Name this search"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
          <button type="button" className="btn btn-ghost" onClick={saveNamed}>
            Save search
          </button>
          {named.map((s) => (
            <span key={s.name} className="named-search-chip">
              <button type="button" className="linkish" onClick={() => { applySearch(s); setSavedNote(`Applied “${s.name}”.`) }}>
                {s.name}
              </button>
              <button type="button" className="linkish" aria-label={`Delete ${s.name}`} onClick={() => deleteNamed(s.name)}>
                ×
              </button>
            </span>
          ))}
          {savedNote ? <span className="muted tiny">{savedNote}</span> : null}
        </div>
      </div>
      <BidCsv lots={catalog} listKind={kind} />
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
      {groupedView ? (
        groups.length ? (
          groups.map((group) => {
            const shown = group.lots.slice(0, perPage)
            return (
              <section key={group.value} className="auction-type-block">
                <div className="auction-type-block-head">
                  <h2>
                    {group.label}
                    <em>{group.lots.length}</em>
                  </h2>
                  {group.value !== 'other' ? (
                    <Link to={listPath(group.value)} className="linkish">
                      Open {group.label} list
                    </Link>
                  ) : null}
                </div>
                <AuctionTable lots={shown} compareIds={compareIds} onToggleCompare={toggleCompare} />
                {group.lots.length > shown.length ? (
                  <p className="muted tiny pager-note">
                    Showing {shown.length} of {group.lots.length}.{' '}
                    {group.value !== 'other' ? (
                      <Link to={listPath(group.value)}>See all {group.label} lots together</Link>
                    ) : null}
                  </p>
                ) : (
                  <p className="muted tiny pager-note">{group.lots.length} lots in {group.label}</p>
                )}
              </section>
            )
          })
        ) : (
          <p className="empty">{settings.copy.emptyFilters}</p>
        )
      ) : slice.length ? (
        <AuctionTable lots={slice} compareIds={compareIds} onToggleCompare={toggleCompare} />
      ) : (
        <p className="empty">{settings.copy.emptyFilters}</p>
      )}
      {!groupedView && rows.length > perPage ? (
        <div className="pager">
          <button type="button" className="btn btn-ghost" disabled={safePage <= 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            {safePage * perPage + 1}–{Math.min(rows.length, (safePage + 1) * perPage)} of {rows.length}
          </span>
          <button type="button" className="btn btn-ghost" disabled={safePage >= pages - 1} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      ) : !groupedView ? (
        <p className="muted tiny pager-note">{rows.length} lots on this list</p>
      ) : null}
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
