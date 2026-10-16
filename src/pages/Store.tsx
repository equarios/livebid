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
  const [open, setOpen] = useState<StoreFilterKey | null>(null)
  const filtersRef = useRef<HTMLDivElement>(null)

  const defaults = DEFAULT_SETTINGS.pages.storeHeroes
  const raw =
    settings.pages?.storeHeroes?.length && settings.pages.storeHeroes.length >= 2
      ? settings.pages.storeHeroes
      : defaults
  const heroes = raw.map((s, i) => ({
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
    return sortStockLast(rows, (p) => p.stock > 0)
  }, [products, q, brands, grades, memories, origins, categories, stock])

  useEffect(() => {
    let alive = true
    setLoading(true)
    void api
      .storeProducts()
      .then((res) => {
        if (alive) setProducts(res.products)
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
              : 'Fixed retail prices — add to cart and check out here.'
          }
          label={storeName}
        />

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
            </div>
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
          <div className="store-lot-grid" aria-label="Store products">
            {filtered.map((p, i) => (
              <StoreProductCard
                key={p.id}
                product={p}
                index={i}
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

      {preview ? <StoreProductPreview product={preview} onClose={() => setPreview(null)} /> : null}
      <StoreWholesaleHandoff />
    </PublicShell>
  )
}
