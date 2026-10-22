import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { StoreProductCard } from '../components/StoreProductCard'
import { StoreProductPreview } from '../components/StoreProductPreview'
import { StoreRail } from '../components/StoreRail'
import { StoreCatalogSkeleton } from '../components/StoreSkeleton'
import { api, type StoreProductDto } from '../lib/api'
import { collapseStoreFamilies } from '../lib/storeVariants'
import { useStore } from '../store'

/** Sold items that left the shop (older than 14 days, kept 180 days). */
export function StoreSold() {
  const { settings } = useStore()
  const [products, setProducts] = useState<StoreProductDto[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [preview, setPreview] = useState<StoreProductDto | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    void api
      .storeProducts({ archive: true })
      .then((res) => {
        if (alive) setProducts(res.products)
      })
      .catch((e) => {
        if (alive) setErr(e instanceof Error ? e.message : 'Could not load sold items.')
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

  if (!settings.showStore) {
    return (
      <PublicShell mode="consumer">
        <p className="muted store-off-note">Retail store is turned off.</p>
      </PublicShell>
    )
  }

  const storeName = settings.storeLabel || 'Store'
  const cards = collapseStoreFamilies(products)

  return (
    <PublicShell mode="consumer">
      <div className="retail-store">
        <StoreRail
          page="sold"
          title="Recently sold"
          count={loading ? '…' : cards.length}
          note="Left the shop after 14 days. Kept here for 180 days. Not for sale."
          label={storeName}
        />
        {toast ? (
          <p className="tiny retail-toast shop-toast" role="status">
            {toast}
          </p>
        ) : null}
        {err ? <p className="tiny imei-err">{err}</p> : null}
        {loading && !products.length ? (
          <StoreCatalogSkeleton />
        ) : cards.length ? (
          <div className="store-lot-grid" aria-label="Recently sold products">
            {cards.map((p, i) => (
              <StoreProductCard
                key={p.id}
                product={p}
                index={i}
                catalog={products}
                onOpen={setPreview}
              />
            ))}
          </div>
        ) : (
          <div className="mh-empty shop-empty">
            <p>No sold items in the archive.</p>
            <Link to="/store" className="btn btn-primary btn-sm">
              Back to {storeName}
            </Link>
          </div>
        )}
      </div>
      {preview ? (
        <StoreProductPreview
          product={preview}
          onClose={() => setPreview(null)}
          onOpenProduct={setPreview}
        />
      ) : null}
    </PublicShell>
  )
}
