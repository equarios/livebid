import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { originLabel } from '../lib/auctionLists'
import { lotItemSub } from '../lib/itemLine'
import { api, type StoreProductDto } from '../lib/api'
import { storeProductBrand, storeProductHeadline } from '../lib/storeBrand'
import { storeNeedsBuyAck } from '../lib/storeCondition'
import { addToStoreCart } from '../lib/storeCart'
import { pushToast } from '../lib/toast'
import { storeAddedToCart, storeNeedsAckWarn } from '../lib/storeFeedback'
import { useStoreFx } from '../lib/storeFx'
import { pickSimilarStoreProducts } from '../lib/stockFilter'
import { storeProductFallback, storeProductImage } from '../lib/storePhotos'
import { AskAboutItem } from './AskAboutItem'
import { BatteryMark } from './BatteryMark'
import { ModalShell } from './ModalShell'
import { StoreConditionAck } from './StoreConditionAck'
import { StoreConditionBadges } from './StoreConditionBadges'
import { StoreGallery } from './StoreGallery'
import { StoreVariantPicker } from './StoreVariantPicker'

type Props = {
  product: StoreProductDto
  onClose: () => void
  /** Optional: switch preview to another product (similar tiles). */
  onOpenProduct?: (product: StoreProductDto) => void
}

/** Detail dialog — same frame as auction lot modal; retail buy actions. */
export function StoreProductPreview({ product, onClose, onOpenProduct }: Props) {
  const { money } = useStoreFx()
  const [qty, setQty] = useState(1)
  const [msg, setMsg] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<StoreProductDto[]>([])
  const [acked, setAcked] = useState(false)
  const [ackNudge, setAckNudge] = useState(0)
  const soldOut = product.stock < 1
  const needsAck = storeNeedsBuyAck(product)
  const brand = storeProductBrand(product)
  const battery = Math.max(0, Math.floor(Number(product.battery) || 0))
  const headline = storeProductHeadline(product, brand)
  const sub = lotItemSub({
    capacity: product.capacity,
    origin: product.origin,
    color: product.color,
  })

  useEffect(() => {
    setQty(1)
    setAcked(false)
    setAckNudge(0)
  }, [product.id])

  useEffect(() => {
    let alive = true
    void api
      .storeProducts()
      .then((res) => {
        if (alive) setCatalog(res.products)
      })
      .catch(() => {
        if (alive) setCatalog([])
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

  return (
    <ModalShell onClose={onClose} className="lot-backdrop">
      <div
        className="modal card lot-modal store-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lot-modal-head">
          <div>
            {brand ? <p className="deal-card-maker store-card-maker">{brand}</p> : null}
            <h2 id="store-preview-title">{headline}</h2>
            {sub ? <p className="muted item-specs">{sub}</p> : null}
            <p className="muted">
              {money(product.price)} / pc
              {product.compareAt && product.compareAt > product.price
                ? ` · was ${money(product.compareAt)}`
                : ''}
              {' · '}
              {soldOut ? 'Sold out' : `${product.stock} in stock`}
              {product.grade ? ` · Grade ${product.grade}` : ''}
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <StoreGallery product={product} variant="detail" />

        {catalog.length ? (
          <StoreVariantPicker
            product={product}
            catalog={catalog}
            onSelect={(next) => {
              setQty(1)
              onOpenProduct?.(next)
            }}
            className="store-preview-variants"
          />
        ) : null}

        <dl className="specs store-spec-list">
          {product.grade ? (
            <div>
              <dt>Grade</dt>
              <dd className={`grade-${product.grade}`}>{product.grade}</dd>
            </div>
          ) : null}
          {battery > 0 ? (
            <div>
              <dt>Battery</dt>
              <dd>
                <BatteryMark value={battery} size={22} />
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
          {product.color ? (
            <div>
              <dt>Color</dt>
              <dd>{product.color}</dd>
            </div>
          ) : null}
          {product.capacity ? (
            <div>
              <dt>Capacity</dt>
              <dd>{product.capacity}</dd>
            </div>
          ) : null}
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
        </dl>

        <h3 className="detail-notes-title">Condition & locks</h3>
        <StoreConditionBadges product={product} variant="detail" />
        <p>{product.description || 'Retail unit. Inspected and ready to ship.'}</p>

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
            <label className="field store-buy-qty">
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
              className="btn btn-primary store-buy-primary"
              disabled={soldOut}
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
                onClose()
              }}
            >
              Add to cart
            </button>
            <Link
              to={`/store/p/${product.slug}`}
              className="btn btn-ghost store-buy-secondary"
              onClick={onClose}
            >
              Full page
            </Link>
          </div>
        </div>

        <div className="lot-modal-ask" style={{ marginTop: 12 }}>
          <AskAboutItem
            channel="store"
            itemId={product.id}
            itemTitle={headline}
            itemHref={`/store/p/${product.slug}`}
          />
        </div>

        <SimilarStoreProducts product={product} onOpen={onOpenProduct} onClose={onClose} />

        {msg ? (
          <p className="tiny retail-toast shop-toast" role="status">
            {msg}
          </p>
        ) : null}
      </div>
    </ModalShell>
  )
}

function SimilarStoreProducts({
  product,
  onOpen,
  onClose,
}: {
  product: StoreProductDto
  onOpen?: (product: StoreProductDto) => void
  onClose: () => void
}) {
  const { money } = useStoreFx()
  const navigate = useNavigate()
  const [rows, setRows] = useState<StoreProductDto[]>([])

  useEffect(() => {
    let gone = false
    void api
      .storeProducts()
      .then((res) => {
        if (gone) return
        setRows(pickSimilarStoreProducts(product, res.products, 12))
      })
      .catch(() => {
        if (!gone) setRows([])
      })
    return () => {
      gone = true
    }
  }, [product])

  if (!rows.length) return null

  return (
    <div className="similar-lots store-similar-preview">
      <h3 className="detail-notes-title">You may also like</h3>
      <div className="store-similar-tiles" role="list">
        {rows.map((row) => {
          const label = storeProductHeadline(row)
          const openQuick = () => {
            if (onOpen) {
              onOpen(row)
              return
            }
            onClose()
            navigate(`/store/p/${row.slug}`)
          }
          return (
            <button
              key={row.id}
              type="button"
              className="store-similar-tile"
              role="listitem"
              aria-label={`Quick view ${label}`}
              onClick={openQuick}
            >
              <span className="store-similar-tile-media">
                <img
                  src={storeProductImage(row)}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = storeProductFallback(row)
                  }}
                />
                <span className="quick-view-hint" aria-hidden>
                  Quick view
                </span>
              </span>
              <span className="store-similar-tile-name">{label}</span>
              <span className="store-similar-tile-price">{money(row.price)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
