import { startTransition, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckMenu, GRADES, toggleValue } from '../components/CheckMenu'
import { isFilterUiTarget } from '../components/FilterPanel'
import {
  api,
  type CommunityListingDto,
  type CommunityListingInput,
} from '../lib/api'
import { moneyUsd } from '../lib/format'
import { useStore } from '../store'

type Tab = 'board' | 'post' | 'mine' | 'queue'
type FilterMenu = 'category' | 'brand' | 'grade' | 'price' | null
type PriceFilter = 'fixed' | 'ask'

const CATEGORIES = ['Phones', 'Tablets', 'Laptops', 'Accessories', 'Other']
const BASE = '/account/community'
const PRICE_OPTS: PriceFilter[] = ['fixed', 'ask']

function ListPager({
  perPage,
  onPerPage,
  page,
  pages,
  start,
  end,
  total,
  onPage,
}: {
  perPage: number
  onPerPage: (n: number) => void
  page: number
  pages: number
  start: number
  end: number
  total: number
  onPage: (n: number) => void
}) {
  if (!total) return null
  return (
    <div className="gbs-pager">
      <label>
        rows per page:
        <select
          value={perPage}
          onChange={(e) => onPerPage(Number(e.target.value))}
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </label>
      <span>
        {start}–{end} of {total}
        {total > perPage ? ` · page ${page + 1}/${pages}` : ''}
      </span>
      <button type="button" disabled={page <= 0} onClick={() => onPage(page - 1)}>
        ‹
      </button>
      <button type="button" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
        ›
      </button>
    </div>
  )
}

function priceLabel(listing: CommunityListingDto) {
  if (listing.price == null) return 'Ask / offer'
  return `${moneyUsd(listing.price, listing.currency)}`
}

function itemLine(listing: CommunityListingDto) {
  return (
    [listing.manufacturer, listing.model, listing.capacity, listing.grade && `G${listing.grade}`]
      .filter(Boolean)
      .join(' · ') || listing.category
  )
}

function ListingTable({
  listings,
  mode,
  onInquire,
  onModerate,
  onOwnerStatus,
  isStaff,
  emptyTitle,
  emptyBody,
  emptyAction,
}: {
  listings: CommunityListingDto[]
  mode: 'board' | 'mine' | 'queue'
  onInquire: (l: CommunityListingDto) => void
  onModerate?: (l: CommunityListingDto, action: 'live' | 'reject' | 'feature' | 'unfeature') => void
  onOwnerStatus?: (l: CommunityListingDto, status: 'paused' | 'closed' | 'pending') => void
  isStaff?: boolean
  emptyTitle: string
  emptyBody: string
  emptyAction?: { label: string; onClick: () => void }
}) {
  return (
    <div className="desk-list-scroll cm-table-wrap" role="region" aria-label="Community listings">
      <table className="gbs-table cm-table">
        <thead>
          <tr>
            <th>Items</th>
            <th>Quantity</th>
            <th>Price</th>
            {mode === 'board' ? <th>Seller</th> : <th>Interest</th>}
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => (
            <tr key={listing.id} className={listing.featured ? 'is-featured' : undefined}>
              <td className="item-col">
                <div className="item-cell">
                  <div className="item-thumb cm-thumb" aria-hidden>
                    {listing.imageUrl ? (
                      <img src={listing.imageUrl} alt="" loading="lazy" />
                    ) : (
                      <span>{listing.category.slice(0, 1)}</span>
                    )}
                  </div>
                  <div className="item-text">
                    <div className="item-title">
                      {listing.featured ? <em className="cm-feat">★ </em> : null}
                      {listing.title}
                    </div>
                    <div className="item-sub">{itemLine(listing)}</div>
                  </div>
                </div>
              </td>
              <td className="lot-qty">{listing.qty.toLocaleString('en-US')}</td>
              <td className="price-cell">
                <span className="cell-primary">{priceLabel(listing)}</span>
                {listing.price != null ? <div className="tiny muted">/ pc</div> : null}
              </td>
              <td>
                {mode === 'board' ? (
                  <>
                    <span className="tiny">{listing.sellerName}</span>
                    {listing.interestCount > 0 ? (
                      <div className="tiny muted">{listing.interestCount} interest</div>
                    ) : null}
                  </>
                ) : (
                  <span className="lot-qty">{listing.interestCount}</span>
                )}
              </td>
              <td>
                <span className={`cm-pill status-${listing.status}`}>{listing.status}</span>
              </td>
              <td className="cart-actions-col">
                <div className="row-actions">
                  <div className="cm-mod-actions">
                    {mode === 'board' && listing.status === 'live' && !listing.mine ? (
                      <button
                        type="button"
                        className="cm-mod-btn is-approve"
                        onClick={() => onInquire(listing)}
                      >
                        Interest
                      </button>
                    ) : null}
                    {mode === 'board' && listing.mine ? (
                      <span className="tiny muted">Yours</span>
                    ) : null}
                    {mode === 'mine' && onOwnerStatus ? (
                      <>
                        {listing.status === 'live' || listing.status === 'paused' ? (
                          <button
                            type="button"
                            className="cm-mod-btn is-feature"
                            onClick={() =>
                              onOwnerStatus(
                                listing,
                                listing.status === 'paused' ? 'pending' : 'paused',
                              )
                            }
                          >
                            {listing.status === 'paused' ? 'Resubmit' : 'Pause'}
                          </button>
                        ) : null}
                        {listing.status !== 'closed' ? (
                          <button
                            type="button"
                            className="cm-mod-btn is-reject"
                            onClick={() => onOwnerStatus(listing, 'closed')}
                          >
                            Close
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    {(mode === 'queue' || (isStaff && mode === 'board')) && onModerate ? (
                      <>
                        {listing.status !== 'live' ? (
                          <button
                            type="button"
                            className="cm-mod-btn is-approve"
                            onClick={() => onModerate(listing, 'live')}
                          >
                            Approve
                          </button>
                        ) : null}
                        {listing.status === 'pending' || listing.status === 'live' ? (
                          <button
                            type="button"
                            className="cm-mod-btn is-reject"
                            onClick={() => onModerate(listing, 'reject')}
                          >
                            Reject
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={`cm-mod-btn is-feature${listing.featured ? ' is-on' : ''}`}
                          onClick={() =>
                            onModerate(listing, listing.featured ? 'unfeature' : 'feature')
                          }
                        >
                          {listing.featured ? 'Unfeature' : 'Feature'}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!listings.length ? (
        <div className="mh-empty cm-empty-state">
          <div>
            <strong>{emptyTitle}</strong>
            <p>{emptyBody}</p>
          </div>
          {emptyAction ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={emptyAction.onClick}>
              {emptyAction.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Wholesale Community — Board / Mine / Post desk panels. */
export function Community() {
  const { user, settings, isStaff } = useStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const initialTab: Tab = params.get('queue') === '1' && isStaff
    ? 'queue'
    : params.get('mine') === '1'
      ? 'mine'
      : params.get('post') === '1'
        ? 'post'
        : 'board'

  const [tab, setTab] = useState<Tab>(initialTab)
  const [listings, setListings] = useState<CommunityListingDto[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(50)
  const [filterOpen, setFilterOpen] = useState<FilterMenu>(null)
  const [filterCats, setFilterCats] = useState<string[]>([])
  const [filterBrands, setFilterBrands] = useState<string[]>([])
  const [filterGrades, setFilterGrades] = useState<string[]>([])
  const [filterPrice, setFilterPrice] = useState<PriceFilter[]>([])
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const filtersRef = useRef<HTMLDivElement>(null)
  const [inquire, setInquire] = useState<CommunityListingDto | null>(null)
  const [interestMsg, setInterestMsg] = useState('')
  const [interestQty, setInterestQty] = useState('1')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<CommunityListingInput>({
    title: '',
    description: '',
    category: 'Phones',
    manufacturer: '',
    model: '',
    capacity: '',
    grade: '',
    qty: 1,
    price: null,
    imageUrl: '',
  })
  const [priceMode, setPriceMode] = useState<'fixed' | 'offer'>('offer')

  const enabled = settings.showCommunity !== false

  const load = async (next: Tab = tab) => {
    if (next === 'post') {
      setLoading(false)
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const res = await api.communityListings({
        q: next === 'board' ? q : undefined,
        mine: next === 'mine',
        queue: next === 'queue',
      })
      setListings(res.listings)
      setPage(0)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load Community.')
      setListings([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!enabled) return
    void load(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, enabled])

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    if (!filterOpen) return
    function onDoc(e: MouseEvent) {
      if (isFilterUiTarget(e.target)) return
      if (filtersRef.current?.contains(e.target as Node)) return
      setFilterOpen(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [filterOpen])

  const brandOptions = useMemo(
    () =>
      [...new Set(listings.map((l) => l.manufacturer.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [listings],
  )
  const categoryOptions = useMemo(() => {
    const fromData = [...new Set(listings.map((l) => l.category).filter(Boolean))]
    return [...new Set([...CATEGORIES, ...fromData])].sort()
  }, [listings])

  const filtersActive =
    filterCats.length + filterBrands.length + filterGrades.length + filterPrice.length > 0 ||
    featuredOnly

  const filteredListings = useMemo(() => {
    if (tab !== 'board') return listings
    const needle = q.trim().toLowerCase()
    return listings.filter((l) => {
      if (featuredOnly && !l.featured) return false
      if (filterCats.length && !filterCats.includes(l.category)) return false
      if (filterBrands.length && !filterBrands.includes(l.manufacturer)) return false
      if (filterGrades.length && !filterGrades.includes(l.grade)) return false
      if (filterPrice.length) {
        const isAsk = l.price == null
        const ok =
          (filterPrice.includes('ask') && isAsk) || (filterPrice.includes('fixed') && !isAsk)
        if (!ok) return false
      }
      if (!needle) return true
      const hay = `${l.title} ${l.description} ${l.manufacturer} ${l.model} ${l.capacity} ${l.category} ${l.grade}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [listings, tab, q, featuredOnly, filterCats, filterBrands, filterGrades, filterPrice])

  const sourceList = tab === 'board' ? filteredListings : listings
  const pages = Math.max(1, Math.ceil(sourceList.length / perPage))
  const safePage = Math.min(page, pages - 1)
  const visibleRows = sourceList.slice(safePage * perPage, safePage * perPage + perPage)
  const start = sourceList.length ? safePage * perPage + 1 : 0
  const end = Math.min(sourceList.length, (safePage + 1) * perPage)

  useEffect(() => {
    setPage(0)
  }, [filterCats, filterBrands, filterGrades, filterPrice, featuredOnly, q, tab, perPage])

  const mineStats = useMemo(() => {
    if (tab !== 'mine') return null
    return {
      live: listings.filter((l) => l.status === 'live').length,
      pending: listings.filter((l) => l.status === 'pending').length,
      other: listings.filter((l) => !['live', 'pending'].includes(l.status)).length,
      interest: listings.reduce((n, l) => n + l.interestCount, 0),
    }
  }, [listings, tab])

  const previewTitle =
    form.title.trim() ||
    [form.qty, form.manufacturer, form.model, form.capacity, form.grade && `Grade ${form.grade}`]
      .filter(Boolean)
      .join(' ')

  function goTab(next: Tab) {
    setTab(next)
    setOk(null)
    setErr(null)
    setPage(0)
    const sp = new URLSearchParams()
    if (next === 'mine') sp.set('mine', '1')
    if (next === 'queue') sp.set('queue', '1')
    if (next === 'post') sp.set('post', '1')
    setParams(sp, { replace: true })
  }

  async function onPost(e: FormEvent) {
    e.preventDefault()
    if (!user) {
      navigate('/login', { state: { from: `${BASE}?post=1` } })
      return
    }
    setSaving(true)
    setErr(null)
    setOk(null)
    try {
      const body: CommunityListingInput = {
        ...form,
        qty: Number(form.qty) || 1,
        price: priceMode === 'offer' ? null : Number(form.price) || 0,
        imageUrl: form.imageUrl?.trim() || null,
      }
      const res = await api.createCommunityListing(body)
      setOk(
        res.listing.status === 'live'
          ? 'Listing is live on the board.'
          : 'Submitted for review — check Mine for status.',
      )
      setForm({
        title: '',
        description: '',
        category: 'Phones',
        manufacturer: '',
        model: '',
        capacity: '',
        grade: '',
        qty: 1,
        price: null,
        imageUrl: '',
      })
      goTab('mine')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not post listing.')
    } finally {
      setSaving(false)
    }
  }

  async function sendInterest(e: FormEvent) {
    e.preventDefault()
    if (!inquire) return
    if (!user) {
      navigate('/login', { state: { from: BASE } })
      return
    }
    setSaving(true)
    setErr(null)
    try {
      await api.communityInterest(inquire.id, {
        message: interestMsg.trim(),
        qtyWanted: Number(interestQty) || undefined,
      })
      setOk('Interest sent — seller and Equarios ops were notified.')
      setInquire(null)
      setInterestMsg('')
      void load(tab)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send interest.')
    } finally {
      setSaving(false)
    }
  }

  async function moderate(
    listing: CommunityListingDto,
    action: 'live' | 'reject' | 'feature' | 'unfeature',
  ) {
    setSaving(true)
    setErr(null)
    try {
      if (action === 'live' || action === 'reject') {
        await api.moderateCommunityListing(listing.id, {
          status: action === 'live' ? 'live' : 'rejected',
        })
      } else {
        await api.moderateCommunityListing(listing.id, {
          featured: action === 'feature',
        })
      }
      setOk(action === 'live' ? 'Listing approved.' : action === 'reject' ? 'Listing rejected.' : 'Updated.')
      void load(tab)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Moderation failed.')
    } finally {
      setSaving(false)
    }
  }

  async function ownerStatus(listing: CommunityListingDto, status: 'paused' | 'closed' | 'pending') {
    setSaving(true)
    setErr(null)
    try {
      await api.updateCommunityListing(listing.id, { status })
      setOk(status === 'closed' ? 'Listing closed.' : status === 'paused' ? 'Listing paused.' : 'Resubmitted for review.')
      void load('mine')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not update listing.')
    } finally {
      setSaving(false)
    }
  }

  if (!enabled) {
    return <p className="muted">Community is turned off.</p>
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'board', label: 'Board' },
    { id: 'mine', label: 'Mine' },
    { id: 'post', label: 'Post' },
  ]
  if (isStaff) tabs.push({ id: 'queue', label: 'Queue' })

  return (
    <div className="cm-desk mypage-listings">
      <div className="cm-switch" role="tablist" aria-label="Community">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'is-on' : undefined}
            onClick={() => goTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {ok ? <p className="ok tiny cm-flash">{ok}</p> : null}
      {err ? <p className="error tiny cm-flash">{err}</p> : null}

      {tab === 'board' ? (
        <section className="cm-panel mh-desk" aria-labelledby="cm-board-title">
          <header className="mh-desk-head">
            <h2 id="cm-board-title">
              Board
              <em>
                {loading ? '…' : filteredListings.length}
                {filtersActive || q.trim() ? ` match` : ''}
              </em>
            </h2>
            <p className="mh-desk-note">Peer stock board — inquire on live lots, or post your own.</p>
            <div className="mh-desk-actions">
              <form
                className="cm-search"
                onSubmit={(e) => {
                  e.preventDefault()
                  void load('board')
                }}
              >
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search brand, model…"
                  aria-label="Search board"
                />
                <button type="submit" className="btn btn-sm">
                  Search
                </button>
              </form>
            </div>
          </header>

          <div className="cm-filters mypage-filters auction-desk-filters" ref={filtersRef}>
            <div className="filter-groups cm-filter-groups">
              <CheckMenu
                title="Category"
                open={filterOpen === 'category'}
                onOpen={() => setFilterOpen((v) => (v === 'category' ? null : 'category'))}
                options={categoryOptions}
                selected={filterCats}
                onToggle={(value) =>
                  startTransition(() => setFilterCats((prev) => toggleValue(prev, value)))
                }
              />
              <CheckMenu
                title="Brand"
                open={filterOpen === 'brand'}
                onOpen={() => setFilterOpen((v) => (v === 'brand' ? null : 'brand'))}
                options={brandOptions}
                selected={filterBrands}
                onToggle={(value) =>
                  startTransition(() => setFilterBrands((prev) => toggleValue(prev, value)))
                }
              />
              <CheckMenu
                title="Grade"
                open={filterOpen === 'grade'}
                onOpen={() => setFilterOpen((v) => (v === 'grade' ? null : 'grade'))}
                options={[...GRADES]}
                selected={filterGrades}
                onToggle={(value) =>
                  startTransition(() => setFilterGrades((prev) => toggleValue(prev, value)))
                }
              />
              <CheckMenu
                title="Price"
                open={filterOpen === 'price'}
                onOpen={() => setFilterOpen((v) => (v === 'price' ? null : 'price'))}
                options={PRICE_OPTS}
                selected={filterPrice}
                labelFor={(v) => (v === 'ask' ? 'Ask / offer' : 'Fixed')}
                onToggle={(value) =>
                  startTransition(() => setFilterPrice((prev) => toggleValue(prev, value)))
                }
              />
            </div>
            <label className={`cm-chip-toggle${featuredOnly ? ' is-on' : ''}`}>
              <input
                type="checkbox"
                checked={featuredOnly}
                onChange={(e) => setFeaturedOnly(e.target.checked)}
              />
              Featured
            </label>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => goTab('post')}>
              Post stock
            </button>
            {filtersActive ? (
              <button
                type="button"
                className="linkish cm-clear-filters"
                onClick={() => {
                  setFilterCats([])
                  setFilterBrands([])
                  setFilterGrades([])
                  setFilterPrice([])
                  setFeaturedOnly(false)
                  setFilterOpen(null)
                }}
              >
                Clear
              </button>
            ) : null}
          </div>

          {loading ? <p className="muted tiny">Loading…</p> : null}
          {!loading ? (
            <ListingTable
              mode="board"
              listings={visibleRows}
              isStaff={isStaff}
              onInquire={setInquire}
              onModerate={isStaff ? moderate : undefined}
              emptyTitle={filtersActive || q.trim() ? 'No matches' : 'Board is quiet'}
              emptyBody={
                filtersActive || q.trim()
                  ? 'Try clearing filters or search.'
                  : 'No live listings right now. Post stock or check back soon.'
              }
              emptyAction={
                filtersActive || q.trim()
                  ? {
                      label: 'Clear filters',
                      onClick: () => {
                        setFilterCats([])
                        setFilterBrands([])
                        setFilterGrades([])
                        setFilterPrice([])
                        setFeaturedOnly(false)
                        setQ('')
                      },
                    }
                  : { label: 'Post stock', onClick: () => goTab('post') }
              }
            />
          ) : null}
          {!loading ? (
            <ListPager
              perPage={perPage}
              onPerPage={(n) => {
                setPerPage(n)
                setPage(0)
              }}
              page={safePage}
              pages={pages}
              start={start}
              end={end}
              total={sourceList.length}
              onPage={setPage}
            />
          ) : null}
        </section>
      ) : null}

      {tab === 'mine' ? (
        <section className="cm-panel mh-desk" aria-labelledby="cm-mine-title">
          <header className="mh-desk-head">
            <h2 id="cm-mine-title">
              Mine
              {mineStats ? <em>{mineStats.live + mineStats.pending}</em> : null}
            </h2>
            <p className="mh-desk-note">Your posts — pending review, live, or paused.</p>
            <div className="mypage-meta">
              {mineStats ? (
                <>
                  <em className="is-yours">{mineStats.live} live</em>
                  <em className="is-open">{mineStats.pending} pending</em>
                  <em>{mineStats.interest} interest</em>
                </>
              ) : null}
            </div>
            <div className="mh-desk-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => goTab('post')}>
                New post
              </button>
            </div>
          </header>
          {loading ? <p className="muted tiny">Loading…</p> : null}
          {!loading ? (
            <ListingTable
              mode="mine"
              listings={visibleRows}
              onInquire={setInquire}
              onOwnerStatus={ownerStatus}
              emptyTitle="Nothing posted yet"
              emptyBody="Submit stock for review — it appears here while pending, then on the Board when live."
              emptyAction={{ label: 'Post stock', onClick: () => goTab('post') }}
            />
          ) : null}
          {!loading ? (
            <ListPager
              perPage={perPage}
              onPerPage={(n) => {
                setPerPage(n)
                setPage(0)
              }}
              page={safePage}
              pages={pages}
              start={start}
              end={end}
              total={sourceList.length}
              onPage={setPage}
            />
          ) : null}
        </section>
      ) : null}

      {tab === 'queue' && isStaff ? (
        <section className="cm-panel mh-desk" aria-labelledby="cm-queue-title">
          <header className="mh-desk-head">
            <h2 id="cm-queue-title">
              Queue
              <em>{loading ? '…' : listings.length}</em>
            </h2>
            <p className="mh-desk-note">Listings waiting for staff review.</p>
          </header>
          {loading ? <p className="muted tiny">Loading…</p> : null}
          {!loading ? (
            <ListingTable
              mode="queue"
              listings={visibleRows}
              isStaff
              onInquire={setInquire}
              onModerate={moderate}
              emptyTitle="Queue clear"
              emptyBody="No listings waiting for review."
            />
          ) : null}
          {!loading ? (
            <ListPager
              perPage={perPage}
              onPerPage={(n) => {
                setPerPage(n)
                setPage(0)
              }}
              page={safePage}
              pages={pages}
              start={start}
              end={end}
              total={sourceList.length}
              onPage={setPage}
            />
          ) : null}
        </section>
      ) : null}

      {tab === 'post' ? (
        <section className="cm-panel cm-panel-post mh-desk" aria-labelledby="cm-post-title">
          <header className="mh-desk-head">
            <h2 id="cm-post-title">Post</h2>
            <p className="mh-desk-note">Staff review before live — keep the title scannable.</p>
          </header>

          <div className="cm-post-layout">
            <form className="cm-post" onSubmit={(e) => void onPost(e)}>
              <fieldset className="cm-fieldset">
                <legend>Listing</legend>
                <label>
                  Title
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="20x iPhone 13 128GB Grade A"
                  />
                </label>
                <div className="cm-post-row">
                  <label>
                    Category
                    <select
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Qty
                    <input
                      type="number"
                      min={1}
                      required
                      value={form.qty ?? 1}
                      onChange={(e) => setForm((f) => ({ ...f, qty: Number(e.target.value) }))}
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="cm-fieldset">
                <legend>Specs</legend>
                <div className="cm-post-row is-4">
                  <label>
                    Brand
                    <input
                      value={form.manufacturer || ''}
                      onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
                    />
                  </label>
                  <label>
                    Model
                    <input
                      value={form.model || ''}
                      onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    />
                  </label>
                  <label>
                    Capacity
                    <input
                      value={form.capacity || ''}
                      onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                    />
                  </label>
                  <label>
                    Grade
                    <input
                      value={form.grade || ''}
                      onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="cm-fieldset">
                <legend>Pricing</legend>
                <div className="cm-price-toggle" role="group" aria-label="Pricing mode">
                  <button
                    type="button"
                    className={priceMode === 'offer' ? 'is-on' : undefined}
                    onClick={() => setPriceMode('offer')}
                  >
                    Ask / offer
                  </button>
                  <button
                    type="button"
                    className={priceMode === 'fixed' ? 'is-on' : undefined}
                    onClick={() => setPriceMode('fixed')}
                  >
                    Fixed / pc
                  </button>
                </div>
                {priceMode === 'fixed' ? (
                  <label>
                    Unit price (USD)
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      value={form.price ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                      placeholder="0.00"
                    />
                  </label>
                ) : (
                  <p className="muted tiny">Buyers send interest; Equarios helps negotiate.</p>
                )}
              </fieldset>

              <fieldset className="cm-fieldset">
                <legend>Details</legend>
                <label>
                  Description
                  <textarea
                    rows={3}
                    value={form.description || ''}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Condition, lock status, location, shipping…"
                  />
                </label>
                <label>
                  Image URL <span className="muted">(optional)</span>
                  <input
                    value={form.imageUrl || ''}
                    onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="https://…"
                  />
                </label>
              </fieldset>

              <div className="cm-post-actions">
                <button type="button" className="btn" onClick={() => goTab('board')}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Submitting…' : 'Submit for review'}
                </button>
              </div>
            </form>

            <aside className="cm-preview" aria-label="Row preview">
              <h3>Board preview</h3>
              <div className="cm-preview-row">
                <div className="cm-thumb" aria-hidden>
                  {form.imageUrl?.trim() ? (
                    <img src={form.imageUrl.trim()} alt="" />
                  ) : (
                    <span>{(form.category || 'P').slice(0, 1)}</span>
                  )}
                </div>
                <div>
                  <strong>{previewTitle || 'Your title'}</strong>
                  <p>
                    {[form.manufacturer, form.model, form.capacity, form.grade && `G${form.grade}`]
                      .filter(Boolean)
                      .join(' · ') || 'Specs appear here'}
                  </p>
                  <p className="cm-preview-price">
                    {priceMode === 'fixed' && form.price != null
                      ? `${moneyUsd(Number(form.price) || 0)} / pc`
                      : 'Ask / offer'}
                    <span> · {Number(form.qty) || 1} pcs</span>
                  </p>
                </div>
              </div>
              <p className="muted tiny">This is how buyers skim your row on the Board.</p>
            </aside>
          </div>
        </section>
      ) : null}

      {inquire ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setInquire(null)}>
          <div
            className="modal cm-inquire"
            role="dialog"
            aria-labelledby="cm-inquire-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="cm-inquire-title">Interest — {inquire.title}</h2>
            <p className="muted tiny">
              Notify seller + Equarios ops. No off-platform payment until staff guides the deal.
            </p>
            <form onSubmit={(e) => void sendInterest(e)}>
              <label>
                Qty wanted
                <input
                  type="number"
                  min={1}
                  value={interestQty}
                  onChange={(e) => setInterestQty(e.target.value)}
                />
              </label>
              <label>
                Message
                <textarea
                  required
                  rows={3}
                  value={interestMsg}
                  onChange={(e) => setInterestMsg(e.target.value)}
                  placeholder="Need, target price, timing…"
                />
              </label>
              <div className="cm-inquire-actions">
                <button type="button" className="btn" onClick={() => setInquire(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
