import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { StoreProductCard } from '../components/StoreProductCard'
import { StoreProductPreview } from '../components/StoreProductPreview'
import { DEFAULT_SETTINGS } from '../data'
import { api, type StoreProductDto } from '../lib/api'
import { storeCartCount } from '../lib/storeCart'
import { useStore } from '../store'

/** Full-bleed store landing photo (devices in hand / desk). */
const HERO_PHOTO =
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=2000&q=72'

export function Store() {
  const { settings } = useStore()
  const [products, setProducts] = useState<StoreProductDto[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [preview, setPreview] = useState<StoreProductDto | null>(null)
  const [cartN, setCartN] = useState(() => storeCartCount())

  const heroes =
    settings.pages?.storeHeroes?.length
      ? settings.pages.storeHeroes
      : DEFAULT_SETTINGS.pages.storeHeroes
  const hero = heroes[0]

  useEffect(() => {
    const onCart = () => setCartN(storeCartCount())
    window.addEventListener('livebid-store-cart', onCart)
    return () => window.removeEventListener('livebid-store-cart', onCart)
  }, [])

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
      <section className="land-hero store-hero" aria-label={`${brand} store`}>
        <div className="land-hero-media" aria-hidden>
          <div className="land-hero-photo" style={{ backgroundImage: `url(${HERO_PHOTO})` }} />
          <div className="land-hero-veil" />
          <div className="land-hero-grain" />
        </div>
        <div className="land-hero-copy">
          <p className="land-hero-brand">{brand}</p>
          <h1>{hero.title}</h1>
          <p className="land-hero-lead">{hero.body}</p>
          <div className="land-hero-cta">
            <a href="#shop-catalog" className="pub-btn pub-btn-fill">
              {hero.cta}
            </a>
            <Link to="/buyers" className="land-hero-secondary">
              Wholesale buyers →
            </Link>
          </div>
        </div>
      </section>

      <div className="retail-store" id="shop-catalog">
        <header className="store-rail" aria-label="Store collection">
          <h2>
            {storeName}
            <span className="store-rail-count">{loading ? '…' : products.length}</span>
          </h2>
          <div className="store-rail-links">
            <Link to="/store/cart">Cart{cartN ? ` · ${cartN}` : ''}</Link>
            <Link to="/store/orders">Orders</Link>
          </div>
        </header>

        {toast ? <p className="tiny retail-toast shop-toast">{toast}</p> : null}
        {err ? <p className="tiny imei-err">{err}</p> : null}
        {loading && !products.length ? <p className="muted tiny">Loading…</p> : null}

        <div className="store-lot-grid" aria-label="Store products">
          {products.map((p) => (
            <StoreProductCard
              key={p.id}
              product={p}
              onOpen={setPreview}
              onAdded={(title) => setToast(`Added ${title}`)}
            />
          ))}
        </div>

        {!loading && !products.length ? (
          <p className="shop-empty muted">No products listed yet.</p>
        ) : null}
      </div>

      {preview ? <StoreProductPreview product={preview} onClose={() => setPreview(null)} /> : null}
    </PublicShell>
  )
}
