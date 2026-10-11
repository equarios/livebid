import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { StoreGallery } from '../components/StoreGallery'
import { StoreRail } from '../components/StoreRail'
import { StoreBlockSkeleton } from '../components/StoreSkeleton'
import { api, type StoreProductDto } from '../lib/api'
import { usd } from '../lib/format'
import { storeProductBrand } from '../lib/storeBrand'
import { addToStoreCart } from '../lib/storeCart'
import { useStore } from '../store'

/** Deep-link PDP — same rail language as Store / Cart / Orders. */
export function StoreProductPage() {
  const { slug = '' } = useParams()
  const { settings } = useStore()
  const [product, setProduct] = useState<StoreProductDto | null>(null)
  const [qty, setQty] = useState(1)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setProduct(null)
    setErr(null)
    void api
      .storeProduct(slug)
      .then((res) => {
        if (alive) setProduct(res.product)
      })
      .catch((e) => {
        if (alive) setErr(e instanceof Error ? e.message : 'Not found')
      })
    return () => {
      alive = false
    }
  }, [slug])

  useEffect(() => {
    if (!msg) return
    const id = window.setTimeout(() => setMsg(null), 2400)
    return () => window.clearTimeout(id)
  }, [msg])

  if (!settings.showStore) {
    return (
      <PublicShell mode="consumer">
        <p className="muted store-off-note">Retail store is turned off.</p>
      </PublicShell>
    )
  }

  const storeName = settings.storeLabel || 'Store'
  const soldOut = Boolean(product && product.stock < 1)
  const brand = product ? storeProductBrand(product) : ''

  return (
    <PublicShell mode="consumer">
      <div className="retail-store retail-pdp">
        <StoreRail
          page="product"
          title={product?.title || 'Product'}
          note={
            product
              ? `${[product.brand, product.category].filter(Boolean).join(' · ')} · fixed retail price`
              : 'Fixed retail price — add to cart and check out here.'
          }
          label={storeName}
        />

        {err ? (
          <div className="mh-empty shop-empty">
            <p>{err}</p>
            <Link to="/store" className="btn btn-primary btn-sm">
              Back to {storeName}
            </Link>
          </div>
        ) : null}
        {!product && !err ? <StoreBlockSkeleton rows={2} /> : null}

        {product ? (
          <div className="store-pdp-desk">
            <div className="store-pdp-media">
              <StoreGallery product={product} variant="detail" />
            </div>
            <div className="store-pdp-body">
              {brand ? <p className="deal-card-maker store-card-maker">{brand}</p> : null}
              <p className="store-pdp-price">
                <strong>{usd(product.price)}</strong>
                <span> / pc</span>
                {product.compareAt && product.compareAt > product.price ? (
                  <s>{usd(product.compareAt)}</s>
                ) : null}
              </p>
              <p className="muted tiny">
                {soldOut ? 'Sold out' : `${product.stock} in warehouse`} · Consumer store
              </p>

              <dl className="specs store-pdp-specs">
                {brand ? (
                  <div>
                    <dt>Brand</dt>
                    <dd>{brand}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Category</dt>
                  <dd>{product.category}</dd>
                </div>
                <div>
                  <dt>Availability</dt>
                  <dd>{soldOut ? 'Sold out' : `${product.stock} units`}</dd>
                </div>
                <div>
                  <dt>Channel</dt>
                  <dd>Retail</dd>
                </div>
              </dl>

              <h3 className="detail-notes-title">Condition notes</h3>
              <p className="store-pdp-desc">
                {product.description || 'Retail unit. Inspected and ready to ship.'}
              </p>

              <div className="store-preview-buy">
                <label className="field">
                  <span>Qty</span>
                  <input
                    type="number"
                    className="retail-qty"
                    min={1}
                    max={Math.max(1, product.stock)}
                    value={qty}
                    disabled={soldOut}
                    onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                  />
                </label>
                <div className="store-buy-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={soldOut}
                    onClick={() => {
                      addToStoreCart(product.id, qty)
                      setMsg(`Added ${qty} to cart`)
                    }}
                  >
                    Add to cart
                  </button>
                  <Link to="/store/cart" className="btn btn-primary">
                    Checkout
                  </Link>
                </div>
              </div>
              {msg ? (
                <p className="tiny retail-toast shop-toast" role="status">
                  {msg}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </PublicShell>
  )
}
