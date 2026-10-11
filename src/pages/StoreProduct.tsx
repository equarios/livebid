import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { StoreGallery } from '../components/StoreGallery'
import { api, type StoreProductDto } from '../lib/api'
import { usd } from '../lib/format'
import { addToStoreCart, storeCartCount } from '../lib/storeCart'
import { useStore } from '../store'

/** Deep-link PDP — same layout language as LotDetailDialog / StoreProductPreview. */
export function StoreProductPage() {
  const { slug = '' } = useParams()
  const { settings } = useStore()
  const [product, setProduct] = useState<StoreProductDto | null>(null)
  const [qty, setQty] = useState(1)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [cartN, setCartN] = useState(() => storeCartCount())

  useEffect(() => {
    const onCart = () => setCartN(storeCartCount())
    window.addEventListener('livebid-store-cart', onCart)
    return () => window.removeEventListener('livebid-store-cart', onCart)
  }, [])

  useEffect(() => {
    let alive = true
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

  if (!settings.showStore) {
    return (
      <PublicShell mode="consumer">
        <p className="muted" style={{ padding: 24 }}>
          Retail store is turned off.
        </p>
      </PublicShell>
    )
  }

  const soldOut = Boolean(product && product.stock < 1)

  return (
    <PublicShell mode="consumer">
      <div className="retail-store retail-pdp">
        <div className="retail-pdp-nav">
          <Link to="/">← {settings.storeLabel || 'Store'}</Link>
          <Link to="/store/cart">Cart{cartN ? ` (${cartN})` : ''}</Link>
        </div>
        {err ? <p className="tiny imei-err">{err}</p> : null}
        {!product && !err ? <p className="muted tiny">Loading…</p> : null}
        {product ? (
          <div className="card lot-modal store-pdp-card">
            <div className="lot-modal-head">
              <div>
                <span className="pill pill-hybrid">Retail</span>
                <h1 id="store-pdp-title">{product.title}</h1>
                <p className="muted">
                  {usd(product.price)} / pc
                  {product.compareAt && product.compareAt > product.price
                    ? ` · was ${usd(product.compareAt)}`
                    : ''}
                  {' · '}
                  {soldOut ? 'Sold out' : `${product.stock} in stock`}
                </p>
              </div>
            </div>

            <StoreGallery product={product} variant="detail" />

            <dl className="specs">
              <div>
                <dt>Category</dt>
                <dd>{product.category}</dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd>{usd(product.price)}</dd>
              </div>
              <div>
                <dt>Availability</dt>
                <dd>{soldOut ? 'Sold out' : `${product.stock} units`}</dd>
              </div>
              <div>
                <dt>Channel</dt>
                <dd>Consumer store</dd>
              </div>
            </dl>

            <h3 className="detail-notes-title">Condition notes</h3>
            <p>{product.description || 'Retail unit. Inspected and ready to ship.'}</p>

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
              <Link to="/store/cart" className="btn btn-ghost">
                Checkout
              </Link>
            </div>
            {msg ? <p className="tiny retail-toast">{msg}</p> : null}
          </div>
        ) : null}
      </div>
    </PublicShell>
  )
}
