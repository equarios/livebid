import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckMenu,
  originFilterOptions,
  stringFilterOptions,
  toggleValue,
} from '../components/CheckMenu'
import { isFilterUiTarget } from '../components/FilterPanel'
import { LandHeroSlider } from '../components/LandHeroSlider'
import { PublicShell } from '../components/PublicShell'
import { StoreWholesaleHandoff } from '../components/StoreWholesaleHandoff'
import { StoreProductCard } from '../components/StoreProductCard'
import { StoreProductPreview } from '../components/StoreProductPreview'
import { StoreRail } from '../components/StoreRail'
import { StoreCatalogSkeleton } from '../components/StoreSkeleton'
import { DEFAULT_SETTINGS } from '../data'
import { api, type StoreProductDto } from '../lib/api'
import { pruneStoreCart } from '../lib/storeCart'
import { collapseStoreFamilies } from '../lib/storeVariants'
import { MAX_LANDER_HERO_SLIDES } from '../types'

import { originLabel } from '../lib/auctionLists'
import {
  STOCK_FILTER_LABEL,
  STOCK_FILTER_OPTIONS,
  isPubliclyListed,
  matchesStockFilter,
  parseTimeMs,
  sortStockLast,
  type StockFilter,
} from '../lib/stockFilter'
import { useStore } from '../store'
import type { Grade } from '../types'

type StoreFilterKey = 'brand' | 'grade' | 'memory' | 'origin' | 'category' | 'stock'
type StoreSort = 'featured' | 'newest' | 'price-asc' | 'price-desc'

const SORT_OPTIONS: { id: StoreSort; label: string }[] = [
  { id: 'featured', label: 'Featured' },
  { id: 'newest', label: 'Newest' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
]

type Chip = { key: string; label: string; onRemove: () => void }

export function Store() {
  const { settings } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const q = (params.get('q') || '').trim().toLowerCase()
  const [products, setProducts] = useState<StoreProductDto[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [preview, setPreview] = useState<StoreProductDto | null>(null)
  const [brands, setBrands] = useState<string[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [memories, setMemories] = useState<string[]>([])
  const [origins, setOrigins] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [stock, setStock] = useState<StockFilter[]>(['available'])
  const [sort, setSort] = useState<StoreSort>('featured')
  const [open, setOpen] = useState<StoreFilterKey | null>(null)
  const filtersRef = useRef<HTMLDivElement>(null)

  const defaults = DEFAULT_SETTINGS.pages.storeHeroes
  const raw =
    settings.pages?.storeHeroes?.length && settings.pages.storeHeroes.length >= 2
      ? settings.pages.storeHeroes
      : defaults
  const heroes = raw.slice(0, MAX_LANDER_HERO_SLIDES).map((s, i) => ({
    title: s.title,
    body: s.body,
    cta: s.cta,
    imageUrl: s.imageUrl || defaults[i % defaults.length]?.imageUrl || '',
  }))

  const brandList = useMemo(
    () => stringFilterOptions(products.map((p) => p.brand)),
    [products],
  )
  const gradeList = useMemo(() => {
    const fromCatalog = stringFilterOptions(products.map((p) => p.grade)) as Grade[]
    return fromCatalog.length ? fromCatalog : settings.grades
  }, [products, settings.grades])
  const capacityList = useMemo(
    () => stringFilterOptions(products.map((p) => p.capacity)),
    [products],
  )
  const originsList = useMemo(() => originFilterOptions(products), [products])
  const categoryList = useMemo(
    () => stringFilterOptions(products.map((p) => p.category)),
    [products],
  )

  const showMaker = settings.filters.maker !== false && brandList.length > 0
  const showGrade = settings.filters.grade !== false && gradeList.length > 0
  const showCapacity = settings.filters.capacity !== false && capacityList.length > 0
  const showOrigin = settings.filters.origin !== false && originsList.length > 0
  const showCategory = categoryList.length > 1
  const showFilters = true

  const activeFilter =
    brands.length > 0 ||
    grades.length > 0 ||
    memories.length > 0 ||
    origins.length > 0 ||
    categories.length > 0 ||
    stock.length !== 1 ||
    stock[0] !== 'available'

  const filtered = useMemo(() => {
    const rows = products.filter((p) => {
      const inStock = p.stock > 0
      if (!isPubliclyListed(inStock, parseTimeMs(p.updatedAt))) return false
      if (!matchesStockFilter(inStock, stock)) return false
      if (brands.length && !brands.includes((p.brand || '').trim())) return false
      if (grades.length && !grades.includes((p.grade || '') as Grade)) return false
      if (memories.length && !memories.includes((p.capacity || '').trim())) return false
      if (origins.length && !origins.includes(originLabel(p.origin))) return false
      if (categories.length && !categories.includes((p.category || '').trim())) return false
      if (!q) return true
      const hay = [
        p.title,
        p.brand,
        p.category,
        p.slug,
        p.id,
        p.origin,
        p.capacity,
        p.color,
        p.grade,
        p.modelNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
    const collapsed = collapseStoreFamilies(rows)
    const stockSorted = sortStockLast(collapsed, (p) => p.stock > 0)
    const inStock = stockSorted.filter((p) => p.stock > 0)
    const out = stockSorted.filter((p) => p.stock < 1)
    const cmp = (a: StoreProductDto, b: StoreProductDto) => {
      if (sort === 'price-asc') return a.price - b.price
      if (sort === 'price-desc') return b.price - a.price
      if (sort === 'newest') {
        return parseTimeMs(b.updatedAt) - parseTimeMs(a.updatedAt)
      }
      return 0
    }
    if (sort === 'featured') return stockSorted
    return [...inStock.sort(cmp), ...out.sort(cmp)]
  }, [products, q, brands, grades, memories, origins, categories, stock, sort])

  const chips = useMemo(() => {
    const list: Chip[] = []
    if (q) {
      const rawQ = params.get('q') || q
      list.push({
        key: 'q',
        label: `Search: ${rawQ}`,
        onRemove: () => navigate('/store'),
      })
    }
    for (const b of brands) {
      list.push({
        key: `brand:${b}`,
        label: b,
        onRemove: () => startTransition(() => setBrands((prev) => prev.filter((x) => x !== b))),
      })
    }
    for (const c of categories) {
      list.push({
        key: `cat:${c}`,
        label: c,
        onRemove: () =>
          startTransition(() => setCategories((prev) => prev.filter((x) => x !== c))),
      })
    }
    for (const g of grades) {
      list.push({
        key: `grade:${g}`,
        label: `Grade ${g}`,
        onRemove: () => startTransition(() => setGrades((prev) => prev.filter((x) => x !== g))),
      })
    }
    for (const m of memories) {
      list.push({
        key: `mem:${m}`,
        label: m,
        onRemove: () => startTransition(() => setMemories((prev) => prev.filter((x) => x !== m))),
      })
    }
    for (const o of origins) {
      list.push({
        key: `origin:${o}`,
        label: o,
        onRemove: () => startTransition(() => setOrigins((prev) => prev.filter((x) => x !== o))),
      })
    }
    const stockDefault = stock.length === 1 && stock[0] === 'available'
    if (!stockDefault) {
      for (const s of stock) {
        list.push({
          key: `stock:${s}`,
          label: STOCK_FILTER_LABEL[s],
          onRemove: () =>
            startTransition(() =>
              setStock((prev) => {
                const next = prev.filter((x) => x !== s)
                return next.length ? next : ['available']
              }),
            ),
        })
      }
    }
    return list
  }, [q, params, brands, categories, grades, memories, origins, stock, navigate])

  useEffect(() => {
    let alive = true
    setLoading(true)
    void api
      .storeProducts()
      .then((res) => {
        if (!alive) return
        setProducts(res.products)
        pruneStoreCart(res.products.map((p) => p.id))
      })
      .catch((e) => {
        if (alive) setErr(e instanceof Error ? e.message : 'Could not load store.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!isFilterUiTarget(e.target, filtersRef.current)) setOpen(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function clearFilters() {
    setBrands([])
    setGrades([])
    setMemories([])
    setOrigins([])
    setCategories([])
    setStock(['available'])
    if (q) navigate('/store')
  }

  if (!settings.showStore) {
    return (
      <PublicShell mode="consumer">
        <p className="muted store-off-note">Retail store is turned off.</p>
      </PublicShell>
    )
  }

  const siteBrand = settings.brandName || 'eQuarios'
  const storeName = settings.storeLabel || 'Store'

  return (
    <PublicShell mode="consumer">
      <LandHeroSlider
        brand={siteBrand}
        label={`${siteBrand} store`}
        slides={heroes}
        intervalSec={settings.pages?.heroIntervalSec || 7}
        primary={(slide) => (
          <a href="#shop-catalog" className="pub-btn pub-btn-fill">
            {slide.cta}
          </a>
        )}
        secondary={
          <Link to="/buyers" className="land-hero-secondary">
            Wholesale buyers →
          </Link>
        }
      />

      <div className="retail-store" id="shop-catalog">
        <StoreRail
          page="store"
          title={storeName}
          count={loading ? '…' : filtered.length}
          note={
            q
              ? `Results for “${params.get('q')}”.`
              : 'Browse fixed prices, add to cart, and check out here.'
          }
          label={storeName}
        />
        <p className="muted tiny store-we-buy-note">
          We buy used phones too —{' '}
          <Link to="/store/trade-in">get a trade-in estimate</Link> toward your cart.
        </p>

        {showFilters ? (
          <div className="filters filters-no-search store-origin-filters" ref={filtersRef}>
            <div className="filter-groups">
              <CheckMenu
                title="Stock"
                open={open === 'stock'}
                onOpen={() => setOpen((v) => (v === 'stock' ? null : 'stock'))}
                options={STOCK_FILTER_OPTIONS}
                selected={stock}
                labelFor={(v) => STOCK_FILTER_LABEL[v]}
                onToggle={(value) =>
                  startTransition(() => setStock((prev) => toggleValue(prev, value)))
                }
              />
              {showMaker ? (
                <CheckMenu
                  title="Brand"
                  open={open === 'brand'}
                  onOpen={() => setOpen((v) => (v === 'brand' ? null : 'brand'))}
                  options={brandList}
                  selected={brands}
                  onToggle={(value) =>
                    startTransition(() => setBrands((prev) => toggleValue(prev, value)))
                  }
                />
              ) : null}
              {showCategory ? (
                <CheckMenu
                  title="Category"
                  open={open === 'category'}
                  onOpen={() => setOpen((v) => (v === 'category' ? null : 'category'))}
                  options={categoryList}
                  selected={categories}
                  onToggle={(value) =>
                    startTransition(() => setCategories((prev) => toggleValue(prev, value)))
                  }
                />
              ) : null}
              {showGrade ? (
                <CheckMenu
                  title="Grade"
                  open={open === 'grade'}
                  onOpen={() => setOpen((v) => (v === 'grade' ? null : 'grade'))}
                  options={gradeList}
                  selected={grades}
                  onToggle={(value) =>
                    startTransition(() => setGrades((prev) => toggleValue(prev, value)))
                  }
                />
              ) : null}
              {showCapacity ? (
                <CheckMenu
                  title="Capacity"
                  open={open === 'memory'}
                  onOpen={() => setOpen((v) => (v === 'memory' ? null : 'memory'))}
                  options={capacityList}
                  selected={memories}
                  onToggle={(value) =>
                    startTransition(() => setMemories((prev) => toggleValue(prev, value)))
                  }
                />
              ) : null}
              {showOrigin ? (
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
              <label
                className={`store-sort-pill${sort !== 'featured' ? ' is-active' : ''}`}
              >
                <span className="filter-trigger store-sort-face" aria-hidden>
                  <span className="filter-trigger-title">Sort</span>
                  <span className="filter-trigger-value">
                    {SORT_OPTIONS.find((o) => o.id === sort)?.label || 'Featured'}
                  </span>
                </span>
                <select
                  className="store-sort-native"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as StoreSort)}
                  aria-label="Sort products"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}

        {chips.length ? (
          <div className="store-filter-chips" aria-label="Active filters">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                className="store-filter-chip"
                onClick={c.onRemove}
                aria-label={`Remove ${c.label}`}
              >
                <span>{c.label}</span>
                <span aria-hidden>×</span>
              </button>
            ))}
            <button type="button" className="store-filter-clear" onClick={clearFilters}>
              Clear all
            </button>
          </div>
        ) : null}

        <p className="store-sold-link">
          <Link to="/store/sold">Recently sold →</Link>
        </p>

        {toast ? (
          <p className="tiny retail-toast shop-toast" role="status">
            {toast}
          </p>
        ) : null}
        {err ? <p className="tiny imei-err">{err}</p> : null}

        {loading && !products.length ? (
          <StoreCatalogSkeleton />
        ) : (
          <div className="store-lot-grid" aria-label="Store products">
            {filtered.map((p, i) => (
              <StoreProductCard
                key={p.id}
                product={p}
                index={i}
                catalog={products}
                onOpen={setPreview}
              />
            ))}
          </div>
        )}

        {!loading && !filtered.length ? (
          <div className="mh-empty shop-empty">
            <p>{q || activeFilter ? 'No products match that filter.' : 'No products listed yet.'}</p>
            {q || activeFilter ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {preview ? (
        <StoreProductPreview
          product={preview}
          onClose={() => setPreview(null)}
          onOpenProduct={setPreview}
        />
      ) : null}
      <StoreWholesaleHandoff />
    </PublicShell>
  )
}
