import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LandHeroSlider } from '../components/LandHeroSlider'
import { PublicShell } from '../components/PublicShell'
import { StoreProductCard } from '../components/StoreProductCard'
import { StoreProductPreview } from '../components/StoreProductPreview'
import { StoreRail } from '../components/StoreRail'
import { DEFAULT_SETTINGS } from '../data'
import { api, type StoreProductDto } from '../lib/api'
import { useStore } from '../store'

export function Store() {
  const { settings } = useStore()
  const [params] = useSearchParams()
  const q = (params.get('q') || '').trim().toLowerCase()
  const [products, setProducts] = useState<StoreProductDto[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [preview, setPreview] = useState<StoreProductDto | null>(null)

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

  const filtered = useMemo(() => {
    if (!q) return products
    return products.filter((p) => {
      const hay = [p.title, p.brand, p.category, p.slug, p.id].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [products, q])

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

  if (!settings.showStore) {
    return (
      <PublicShell mode="consumer">
        <p className="muted" style={{ padding: 24 }}>
          Retail store is turned off.
        </p>
      </PublicShell>
    )
  }

  const brand = settings.brandName || 'eQuarios'
  const storeName = settings.storeLabel || 'Store'

  return (
    <PublicShell mode="consumer">
      <LandHeroSlider
        brand={brand}
        label={`${brand} store`}
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

        {toast ? <p className="tiny retail-toast shop-toast">{toast}</p> : null}
        {err ? <p className="tiny imei-err">{err}</p> : null}
        {loading && !products.length ? <p className="muted tiny">Loading…</p> : null}

        <div className="store-lot-grid" aria-label="Store products">
          {filtered.map((p) => (
            <StoreProductCard
              key={p.id}
              product={p}
              onOpen={setPreview}
              onAdded={(title) => setToast(`Added ${title}`)}
            />
          ))}
        </div>

        {!loading && !filtered.length ? (
          <div className="mh-empty shop-empty">
            <p>{q ? 'No products match that search.' : 'No products listed yet.'}</p>
            {q ? (
              <Link to="/store" className="btn btn-sm">
                Clear search
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {preview ? <StoreProductPreview product={preview} onClose={() => setPreview(null)} /> : null}
    </PublicShell>
  )
}
