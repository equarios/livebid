import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { StoreWholesaleHandoff } from '../components/StoreWholesaleHandoff'
import { StoreGallery } from '../components/StoreGallery'
import { StoreProductCard } from '../components/StoreProductCard'
import { StoreProductPreview } from '../components/StoreProductPreview'
import { StoreRail } from '../components/StoreRail'
import { StoreBlockSkeleton } from '../components/StoreSkeleton'
import { api, type StoreProductDto } from '../lib/api'
import { usd } from '../lib/format'
import { storeProductBrand } from '../lib/storeBrand'
import { AskAboutItem } from '../components/AskAboutItem'
import { BatteryMark } from '../components/BatteryMark'
import { originLabel } from '../lib/auctionLists'
import { similarStoreScore } from '../lib/stockFilter'
import { addToStoreCart } from '../lib/storeCart'
import { useStore } from '../store'

/** Deep-link PDP — same rail language as Store / Cart / Orders. */
export function StoreProductPage() {
  const { slug = '' } = useParams()
  const { settings } = useStore()
  const [product, setProduct] = useState<StoreProductDto | null>(null)
  const [catalog, setCatalog] = useState<StoreProductDto[]>([])
  const [qty, setQty] = useState(1)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [similarPreview, setSimilarPreview] = useState<StoreProductDto | null>(null)

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
    let alive = true
    void api
      .storeProducts()
      .then((res) => {
        if (alive) setCatalog(res.products)
      })
      .catch(() => {
        /* similar rail is optional */
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!msg) return
    const id = window.setTimeout(() => setMsg(null), 2400)
    return () => window.clearTimeout(id)
  }, [msg])

  const similar = useMemo(() => {
    if (!product || product.stock > 0) return []
    return catalog
      .map((p) => ({ p, score: similarStoreScore(product, p) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((x) => x.p)
  }, [product, catalog])

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
            <div className={`store-pdp-media${soldOut ? ' is-sold' : ''}`}>
              <StoreGallery product={product} variant="detail" />
              {soldOut ? <span className="sold-badge">Sold out</span> : null}
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
                {product.modelNumber ? (
                  <div>
                    <dt>Model #</dt>
                    <dd>{product.modelNumber}</dd>
                  </div>
                ) : null}
                {product.capacity ? (
                  <div>
                    <dt>Capacity</dt>
                    <dd>{product.capacity}</dd>
                  </div>
                ) : null}
                {product.color ? (
                  <div>
                    <dt>Color</dt>
                    <dd>{product.color}</dd>
                  </div>
                ) : null}
                {product.grade ? (
                  <div>
                    <dt>Grade</dt>
                    <dd>Grade {product.grade}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Origin</dt>
                  <dd>{originLabel(product.origin)}</dd>
                </div>
                {(product.battery || 0) > 0 ? (
                  <div>
                    <dt>Battery</dt>
                    <dd>
                      <BatteryMark value={product.battery || 0} size={22} />
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>SIM</dt>
                  <dd>{product.simLocked ? 'Locked' : 'Unlocked'}</dd>
                </div>
                <div>
                  <dt>Activation</dt>
                  <dd>{product.activationLocked ? 'Locked' : 'Open'}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{product.category}</dd>
                </div>
                <div>
                  <dt>Availability</dt>
                  <dd>{soldOut ? 'Sold out' : `${product.stock} units`}</dd>
                </div>
              </dl>

              <h3 className="detail-notes-title">Condition notes</h3>
              <p className="store-pdp-desc">
                {product.description || 'Retail unit. Inspected and ready to ship.'}
              </p>

              <div className="store-preview-buy">
                {!soldOut ? (
                  <label className="field">
                    <span>Qty</span>
                    <input
                      type="number"
                      className="retail-qty"
                      min={1}
                      max={Math.max(1, product.stock)}
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </label>
                ) : null}
                <div className="store-buy-actions">
                  {soldOut ? (
                    <AskAboutItem
                      channel="store"
                      itemId={product.slug || product.id}
                      itemTitle={product.title}
                      itemHref={`/store/p/${encodeURIComponent(product.slug || product.id)}`}
                      className="btn btn-primary"
                      label="Notify me when back"
                      dialogTitle="Notify when back"
                      presetMessage={`Please notify me when "${product.title}" is back in stock.`}
                    />
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        addToStoreCart(product.id, qty)
                        setMsg(`Added ${qty} to cart`)
                      }}
                    >
                      Add to cart
                    </button>
                  )}
                  {!soldOut ? (
                    <Link to="/store/cart" className="btn btn-primary">
                      Checkout
                    </Link>
                  ) : null}
                  <AskAboutItem
                    channel="store"
                    itemId={product.slug || product.id}
                    itemTitle={product.title}
                    itemHref={`/store/p/${encodeURIComponent(product.slug || product.id)}`}
                  />
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

        {similar.length ? (
          <section className="store-similar" aria-label="Similar in stock">
            <h2 className="store-similar-title">Similar in stock</h2>
            <p className="muted tiny store-similar-note">
              Close matches still available — same brand, category, or capacity.
            </p>
            <div className="store-lot-grid" aria-label="Similar products">
              {similar.map((p, i) => (
                <StoreProductCard
                  key={p.id}
                  product={p}
                  index={i}
                  onOpen={setSimilarPreview}
                  onAdded={(title) => setMsg(`Added ${title}`)}
                />
              ))}
            </div>
          </section>
        ) : null}

        <StoreWholesaleHandoff />
      </div>

      {similarPreview ? (
        <StoreProductPreview product={similarPreview} onClose={() => setSimilarPreview(null)} />
      ) : null}
    </PublicShell>
  )
}
