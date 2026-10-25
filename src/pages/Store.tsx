import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckMenu,
  ChoiceMenu,
  originFilterOptions,
  stringFilterOptions,
  toggleValue,
} from '../components/CheckMenu'
import { isFilterUiTarget } from '../components/FilterPanel'
import { LandHeroSlider } from '../components/LandHeroSlider'
import { PublicShell } from '../components/PublicShell'
import { StoreWholesaleHandoff } from '../components/StoreWholesaleHandoff'
import { CatalogPager } from '../components/CatalogPager'
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
import {
  STORE_CONDITION_DEFAULT,
  STORE_CONDITION_LABEL,
  STORE_CONDITION_OPTIONS,
  STORE_CONDITION_TABS,
  activeStoreConditionTab,
  conditionsFromTab,
  deviceConditionCounts,
  isStoreConditionDefault,
  matchesStoreCondition,
  storeIsReady,
  type StoreConditionFilter,
  type StoreConditionTab,
} from '../lib/storeCondition'
import { useStore } from '../store'
import type { Grade } from '../types'

type StoreFilterKey =
  | 'brand'
  | 'grade'
  | 'memory'
  | 'origin'
  | 'category'
  | 'stock'
  | 'condition'
  | 'sort'
  | 'pageSize'
type StoreSort = 'featured' | 'newest' | 'price-asc' | 'price-desc'

const SORT_IDS: StoreSort[] = ['featured', 'newest', 'price-asc', 'price-desc']
const SORT_LABEL: Record<StoreSort, string> = {
  featured: 'Default',
  newest: 'Newest',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
}
const STOCK_DEFAULT: StockFilter[] = ['available']
const PAGE_SIZE_OPTIONS = [24, 36, 48] as const
type StorePageSize = (typeof PAGE_SIZE_OPTIONS)[number]
const PAGE_SIZE_IDS = ['24', '36', '48'] as const
const PAGE_SIZE_DEFAULT: StorePageSize = 36
const PAGE_SIZE_KEY = 'equarios.store.pageSize'

function readStorePageSize(): StorePageSize {
  try {
    const n = Number(localStorage.getItem(PAGE_SIZE_KEY))
    if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return n as StorePageSize
  } catch {
    /* ignore */
  }
  return PAGE_SIZE_DEFAULT
}

function isStockDefault(s: StockFilter[]) {
  return s.length === 1 && s[0] === 'available'
}

type Chip = { key: string; label: string; onRemove: () => void }

export function Store() {
  const { settings } = useStore()
  const navigate = useNavigate()
  const [params, setSearchParams] = useSearchParams()
  const q = (params.get('q') || '').trim().toLowerCase()
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1)
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
  const [stock, setStock] = useState<StockFilter[]>(STOCK_DEFAULT)
  const [conditions, setConditions] = useState<StoreConditionFilter[]>(STORE_CONDITION_DEFAULT)
  const [sort, setSort] = useState<StoreSort>('featured')
  const [pageSize, setPageSize] = useState<StorePageSize>(readStorePageSize)
  const [open, setOpen] = useState<StoreFilterKey | null>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
  const catalogTopRef = useRef<HTMLDivElement>(null)

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
    !isStockDefault(stock) ||
    !isStoreConditionDefault(conditions)

  const matchesCatalogFilters = (p: StoreProductDto) => {
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
  }

  const filtered = useMemo(() => {
    const rows = products.filter(
      (p) => matchesCatalogFilters(p) && matchesStoreCondition(p, conditions),
    )
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
    const sorted =
      sort === 'featured' ? stockSorted : [...inStock.sort(cmp), ...out.sort(cmp)]
    // Keep ready units ahead of restricted when several condition filters are on.
    if (!isStoreConditionDefault(conditions) && conditions.length > 1) {
      const ready = sorted.filter((p) => storeIsReady(p))
      const rest = sorted.filter((p) => !storeIsReady(p))
      return [...ready, ...rest]
    }
    return sorted
  }, [products, q, brands, grades, memories, origins, categories, stock, conditions, sort])

  const conditionCounts = useMemo(
    () => deviceConditionCounts(collapseStoreFamilies(products.filter(matchesCatalogFilters))),
    [products, q, brands, grades, memories, origins, categories, stock],
  )

  const conditionTabs = STORE_CONDITION_TABS.filter(
    (t) => t.id === 'all' || conditionCounts[t.id] > 0,
  )
  const activeConditionTab = activeStoreConditionTab(conditions)

  function selectConditionTab(id: StoreConditionTab) {
    startTransition(() => setConditions(conditionsFromTab(id)))
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, safePage, pageSize])

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
    if (!isStockDefault(stock)) {
      for (const s of stock) {
        list.push({
          key: `stock:${s}`,
          label: STOCK_FILTER_LABEL[s],
          onRemove: () =>
            startTransition(() =>
              setStock((prev) => {
                const next = prev.filter((x) => x !== s)
                return next.length ? next : STOCK_DEFAULT
              }),
            ),
        })
      }
    }
    if (!isStoreConditionDefault(conditions)) {
      for (const c of conditions) {
        list.push({
          key: `cond:${c}`,
          label: STORE_CONDITION_LABEL[c],
          onRemove: () =>
            startTransition(() => setConditions((prev) => prev.filter((x) => x !== c))),
        })
      }
    }
    return list
  }, [q, params, brands, categories, grades, memories, origins, stock, conditions, navigate])

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
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(null)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const skipFilterPageReset = useRef(true)

  // Clamp stale ?page= after catalog is loaded (avoid wiping deep links before fetch).
  useEffect(() => {
    if (loading) return
    if (page === safePage) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (safePage <= 1) next.delete('page')
        else next.set('page', String(safePage))
        return next
      },
      { replace: true },
    )
  }, [loading, page, safePage, setSearchParams])

  // Back to page 1 when filters / search / sort change (skip first mount).
  useEffect(() => {
    if (skipFilterPageReset.current) {
      skipFilterPageReset.current = false
      return
    }
    setSearchParams(
      (prev) => {
        if (!prev.get('page')) return prev
        const next = new URLSearchParams(prev)
        next.delete('page')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional reset trigger
  }, [q, brands, grades, memories, origins, categories, stock, conditions, sort, pageSize])

  function goToPage(n: number) {
    const nextPage = Math.min(Math.max(1, n), pageCount)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (nextPage <= 1) next.delete('page')
        else next.set('page', String(nextPage))
        return next
      },
      { replace: true },
    )
    catalogTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function changePageSize(next: StorePageSize) {
    setPageSize(next)
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(next))
    } catch {
      /* ignore */
    }
  }

  function clearFilters() {
    setBrands([])
    setGrades([])
    setMemories([])
    setOrigins([])
    setCategories([])
    setStock(STOCK_DEFAULT)
    setConditions(STORE_CONDITION_DEFAULT)
    if (q) navigate('/store')
    else {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('page')
          return next
        },
        { replace: true },
      )
    }
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
        className="store-hub-hero"
        slides={heroes}
        intervalSec={settings.pages?.heroIntervalSec || 7}
        primary={(slide) => (
          <a href="#shop-catalog" className="pub-btn pub-btn-fill">
            {slide.cta}
          </a>
        )}
        secondary={null}
      />

      <nav className="store-hub-links" aria-label="Store quick links">
        <h2 className="store-hub-links-label">Quick links</h2>
        <ul className="seo-cat-chips">
          <li>
            <a href="#shop-catalog">Shop</a>
          </li>
          <li>
            <Link to="/store/trade-in">Trade-in</Link>
          </li>
          <li>
            <Link to="/store/cart">Cart</Link>
          </li>
          <li>
            <Link to="/store/sold">Recently sold</Link>
          </li>
          <li>
            <Link to="/buyers">Wholesale buyers</Link>
          </li>
          <li>
            <Link to="/support">Help</Link>
          </li>
        </ul>
      </nav>

      <div className="retail-store" id="shop-catalog" ref={catalogTopRef}>
        <StoreRail
          page="store"
          title={storeName}
          headline={storeName}
          count={loading ? '…' : filtered.length}
          note={
            q
              ? `Results for “${params.get('q')}”.`
              : 'Browse fixed prices, add to cart, and check out here. Trade in your old phone toward the total.'
          }
          label={storeName}
          hero
          trust={['Fixed prices', 'Trade-in toward cart', 'Secure checkout']}
        />

        {conditionTabs.length > 1 ? (
          <div
            className="store-condition-tabs"
            role="tablist"
            aria-label="Device condition"
          >
            {conditionTabs.map((t) => {
              const selected = activeConditionTab === t.id
              const count = conditionCounts[t.id]
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`store-cond-tab-${t.id}`}
                  aria-selected={selected}
                  className={`store-condition-tab${selected ? ' is-active' : ''}`}
                  onClick={() => selectConditionTab(t.id)}
                >
                  <span>{t.label}</span>
                  <em>{count}</em>
                </button>
              )
            })}
          </div>
        ) : null}

        {showFilters ? (
          <div className="filters filters-no-search store-origin-filters" ref={filtersRef}>
            <p className="store-hub-filters-label">Filters</p>
            <div className="filter-groups">
              <CheckMenu
                title="Stock"
                open={open === 'stock'}
                onOpen={() => setOpen((v) => (v === 'stock' ? null : 'stock'))}
                options={STOCK_FILTER_OPTIONS}
                selected={stock}
                labelFor={(v) => STOCK_FILTER_LABEL[v]}
                highlight={!isStockDefault(stock)}
                onToggle={(value) =>
                  startTransition(() => setStock((prev) => toggleValue(prev, value)))
                }
              />
              <CheckMenu
                title="Condition"
                open={open === 'condition'}
                onOpen={() => setOpen((v) => (v === 'condition' ? null : 'condition'))}
                options={STORE_CONDITION_OPTIONS}
                selected={conditions}
                labelFor={(v) => STORE_CONDITION_LABEL[v]}
                highlight={!isStoreConditionDefault(conditions)}
                onToggle={(value) =>
                  startTransition(() => setConditions((prev) => toggleValue(prev, value)))
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
              <ChoiceMenu
                title="Sort"
                open={open === 'sort'}
                onOpen={() => setOpen((v) => (v === 'sort' ? null : 'sort'))}
                options={SORT_IDS}
                value={sort}
                defaultValue="featured"
                labelFor={(id) => SORT_LABEL[id]}
                onChange={(next) => {
                  startTransition(() => setSort(next))
                  setOpen(null)
                }}
              />
              <ChoiceMenu
                title="Per page"
                open={open === 'pageSize'}
                onOpen={() => setOpen((v) => (v === 'pageSize' ? null : 'pageSize'))}
                options={[...PAGE_SIZE_IDS]}
                value={String(pageSize)}
                defaultValue={String(PAGE_SIZE_DEFAULT)}
                onChange={(next) => {
                  changePageSize(Number(next) as StorePageSize)
                  setOpen(null)
                }}
              />
              <Link to="/store/sold" className="store-sold-link">
                Recently sold
              </Link>
            </div>
          </div>
        ) : (
          <p className="store-sold-link-fallback">
            <Link to="/store/sold" className="store-sold-link">
              Recently sold
            </Link>
          </p>
        )}

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

        {toast ? (
          <p className="tiny retail-toast shop-toast" role="status">
            {toast}
          </p>
        ) : null}
        {err ? <p className="tiny imei-err">{err}</p> : null}

        {loading && !products.length ? (
          <StoreCatalogSkeleton />
        ) : (
          <>
            <div className="store-lot-grid" aria-label="Store products">
              {pageItems.map((p, i) => (
                <StoreProductCard
                  key={p.id}
                  product={p}
                  index={i}
                  catalog={products}
                  onOpen={setPreview}
                />
              ))}
            </div>
            {!loading ? (
              <CatalogPager
                page={safePage}
                pageCount={pageCount}
                pageSize={pageSize}
                total={filtered.length}
                onPage={goToPage}
                label="Catalog pages"
              />
            ) : null}
          </>
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
