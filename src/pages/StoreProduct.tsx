import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, type NavigateFunction } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { StoreWholesaleHandoff } from '../components/StoreWholesaleHandoff'
import { StoreGallery } from '../components/StoreGallery'
import { StoreProductPreview } from '../components/StoreProductPreview'
import { StoreRail } from '../components/StoreRail'
import { StoreVariantPicker } from '../components/StoreVariantPicker'
import { StoreBlockSkeleton } from '../components/StoreSkeleton'
import { api, type StoreProductDto } from '../lib/api'
import { storeProductBrand, storeProductHeadline } from '../lib/storeBrand'
import { storeNeedsBuyAck } from '../lib/storeCondition'
import { storeVariantOptions } from '../lib/storeVariants'
import { useStoreFx } from '../lib/storeFx'
import { AskAboutItem } from '../components/AskAboutItem'
import { BatteryMark } from '../components/BatteryMark'
import { StoreConditionAck } from '../components/StoreConditionAck'
import { StoreConditionBadges } from '../components/StoreConditionBadges'
import { originLabel } from '../lib/auctionLists'
import { pickSimilarStoreProducts } from '../lib/stockFilter'
import { addToStoreCart } from '../lib/storeCart'
import { pushToast } from '../lib/toast'
import { storeAddedToCart, storeNeedsAckWarn } from '../lib/storeFeedback'
import { storeProductFallback, storeProductImage } from '../lib/storePhotos'
import { useStore } from '../store'

/** Step back to cart, checkout, shop, or whichever in-app page opened this product. */
function returnToOrigin(navigate: NavigateFunction) {
  const idx = (window.history.state as { idx?: number } | null)?.idx
  if (typeof idx === 'number' && idx > 0) navigate(-1)
  else navigate('/store')
}

/** Deep-link PDP — same rail language as Store / Cart / Orders. */
export function StoreProductPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { settings } = useStore()
  const { money } = useStoreFx()
  const [product, setProduct] = useState<StoreProductDto | null>(null)
  const [catalog, setCatalog] = useState<StoreProductDto[]>([])
  const [qty, setQty] = useState(1)
  const [acked, setAcked] = useState(false)
  const [ackNudge, setAckNudge] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [similarPreview, setSimilarPreview] = useState<StoreProductDto | null>(null)

  useEffect(() => {
    let alive = true
    setProduct(null)
    setErr(null)
    setQty(1)
    setAcked(false)
    setAckNudge(0)
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
    if (!product || !catalog.length) return []
    return pickSimilarStoreProducts(product, catalog, 12)
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
  const needsAck = product ? storeNeedsBuyAck(product) : false
  const brand = product ? storeProductBrand(product) : ''
  const headline = product ? storeProductHeadline(product, brand) : ''

  const save =
    product?.compareAt && product.compareAt > product.price ? product.compareAt - product.price : 0
  const savePct = save && product ? Math.round((save / product.compareAt!) * 100) : 0

  const ship = settings.fulfillment
  const deliveryNote = !ship || ship.deliveryPayer !== 'buyer'
    ? 'Free delivery'
    : ship.freeDeliveryMin > 0
      ? `Free delivery over ${money(ship.freeDeliveryMin)}`
      : ship.deliveryFeeFlat > 0
        ? `${money(ship.deliveryFeeFlat)} delivery`
        : 'Free delivery'

  /** Picker already shows these — don't repeat them in the spec list. */
  const variantOpts = product ? storeVariantOptions(product, catalog) : null
  const showSpecColor = !variantOpts?.colorOptions.length
  const showSpecCapacity = !variantOpts?.capacityOptions.length

  return (
    <PublicShell mode="consumer">
      <div className="retail-store retail-pdp">
        <StoreRail
          page="product"
          title={headline || product?.title || 'Product'}
          headline={headline || product?.title || 'Product'}
          note={
            product
              ? `${[brand || product.brand, product.category].filter(Boolean).join(' · ')} · fixed retail price`
              : 'Fixed retail price — add to cart and check out here.'
          }
          label={storeName}
          hero
          trust={[deliveryNote, '14-day returns', 'Inspected & graded']}
          onBack={() => returnToOrigin(navigate)}
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
              <h1 className="store-pdp-title">{headline}</h1>
              <p className="store-pdp-price">
                <strong>{money(product.price)}</strong>
                <span className="store-pdp-unit">/ pc</span>
                {product.compareAt && product.compareAt > product.price ? (
                  <>
                    <s>{money(product.compareAt)}</s>
                    <span className="store-pdp-save">
                      Save {money(save)}
                      {savePct > 0 ? ` · ${savePct}%` : ''}
                    </span>
                  </>
                ) : null}
              </p>
              <div className="store-pdp-lead">
                <div className="store-pdp-stockline">
                  {soldOut ? (
                    <span className="store-pdp-stock is-out">Sold out</span>
                  ) : (
                    <span
                      className={`store-pdp-stock${product.stock <= 3 ? ' is-low' : ''}`}
                    >
                      {product.stock <= 3
                        ? `Only ${product.stock} left`
                        : `${product.stock} in stock`}
                    </span>
                  )}
                  <span className="store-pdp-meta">Consumer store</span>
                  <StoreConditionBadges product={product} variant="card" />
                </div>
                <p className="store-pdp-desc">
                  {product.description || 'Retail unit. Inspected and ready to ship.'}
                </p>
              </div>

              {catalog.length ? (
                <StoreVariantPicker
                  product={product}
                  catalog={catalog}
                  onSelect={(next) => {
                    setQty(1)
                    if (next.slug !== slug) navigate(`/store/p/${next.slug}`, { replace: true })
                    else setProduct(next)
                  }}
                  className="store-pdp-variants"
                />
              ) : null}

              <dl className="specs store-spec-list store-pdp-specs">
                {product.grade ? (
                  <div>
                    <dt>Grade</dt>
                    <dd className={`grade-${product.grade}`}>{product.grade}</dd>
                  </div>
                ) : null}
                {(product.battery || 0) > 0 ? (
                  <div>
                    <dt>Battery</dt>
                    <dd>
                      <BatteryMark value={product.battery || 0} size={22} />
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Origin</dt>
                  <dd>{originLabel(product.origin)}</dd>
                </div>
                {product.modelNumber ? (
                  <div>
                    <dt>Model #</dt>
                    <dd>{product.modelNumber}</dd>
                  </div>
                ) : null}
                {showSpecColor && product.color ? (
                  <div>
                    <dt>Color</dt>
                    <dd>{product.color}</dd>
                  </div>
                ) : null}
                {showSpecCapacity && product.capacity ? (
                  <div>
                    <dt>Capacity</dt>
                    <dd>{product.capacity}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Category</dt>
                  <dd>{product.category}</dd>
                </div>
              </dl>
              <div className="store-pdp-buy">
                <div className="store-preview-buy">
                  {needsAck && !soldOut ? (
                    <StoreConditionAck
                      product={product}
                      checked={acked}
                      onChange={setAcked}
                      nudge={ackNudge}
                    />
                  ) : null}
                  <div className="store-buy-actions">
                    {!soldOut ? (
                      <label className="field store-buy-qty">
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
                    {soldOut ? (
                      <AskAboutItem
                        channel="store"
                        itemId={product.slug || product.id}
                        itemTitle={product.title}
                        itemHref={`/store/p/${encodeURIComponent(product.slug || product.id)}`}
                        className="btn btn-primary btn-sm"
                        label="Notify me when back"
                        dialogTitle="Notify when back"
                        presetMessage={`Please notify me when "${product.title}" is back in stock.`}
                      />
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary store-buy-primary"
                        onClick={() => {
                          if (needsAck && !acked) {
                            storeNeedsAckWarn()
                            setAckNudge((n) => n + 1)
                            return
                          }
                          const landed = addToStoreCart(product.id, qty, product.stock)
                          if (!landed) {
                            pushToast('This item is out of stock.')
                            return
                          }
                          storeAddedToCart(product.title, qty)
                        }}
                      >
                        Add to cart
                      </button>
                    )}
                    {!soldOut ? (
                      <Link to="/store/cart" className="btn store-buy-secondary">
                        Checkout
                      </Link>
                    ) : null}
                    <AskAboutItem
                      channel="store"
                      itemId={product.slug || product.id}
                      itemTitle={product.title}
                      itemHref={`/store/p/${encodeURIComponent(product.slug || product.id)}`}
                      className="btn store-buy-secondary store-buy-ask"
                    />
                  </div>
                  <p className="muted tiny store-we-buy-note">
                    Trade in your old device toward this —{' '}
                    <Link to="/store/trade-in">estimate credit</Link>.
                  </p>
                </div>
                {msg ? (
                  <p className="tiny retail-toast shop-toast" role="status">
                    {msg}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {similar.length ? (
          <section className="store-similar" aria-label="You may also like">
            <h2 className="store-similar-title">You may also like</h2>
            <p className="muted tiny store-similar-note">
              Same brand or category — not other colors/GB of this model.
            </p>
            <div className="store-similar-tiles" aria-label="Similar products" role="list">
              {similar.map((p) => {
                const label = storeProductHeadline(p)
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="store-similar-tile"
                    role="listitem"
                    aria-label={`Quick view ${label}`}
                    onClick={() => setSimilarPreview(p)}
                  >
                    <span className="store-similar-tile-media">
                      <img
                        src={storeProductImage(p)}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.onerror = null
                          e.currentTarget.src = storeProductFallback(p)
                        }}
                      />
                      <span className="quick-view-hint" aria-hidden>
                        Quick view
                      </span>
                    </span>
                    <span className="store-similar-tile-name">{label}</span>
                    <span className="store-similar-tile-price">{money(p.price)}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ) : null}

        <StoreWholesaleHandoff />
      </div>

      {similarPreview ? (
        <StoreProductPreview
          product={similarPreview}
          onClose={() => setSimilarPreview(null)}
          onOpenProduct={setSimilarPreview}
        />
      ) : null}
    </PublicShell>
  )
}
