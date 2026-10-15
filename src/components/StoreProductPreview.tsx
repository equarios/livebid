import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { originLabel } from '../lib/auctionLists'
import { ModalShell } from './ModalShell'
import { StoreGallery } from './StoreGallery'
import { BatteryMark } from './BatteryMark'
import { usd } from '../lib/format'
import type { StoreProductDto } from '../lib/api'
import { storeProductBrand } from '../lib/storeBrand'
import { addToStoreCart } from '../lib/storeCart'

type Props = {
  product: StoreProductDto
  onClose: () => void
}

/** Detail dialog matching auction/marketplace lot-modal layout. */
export function StoreProductPreview({ product, onClose }: Props) {
  const [qty, setQty] = useState(1)
  const [msg, setMsg] = useState<string | null>(null)
  const soldOut = product.stock < 1
  const brand = storeProductBrand(product)
  const battery = Math.max(0, Math.floor(Number(product.battery) || 0))
  const title = [brand, product.title, product.modelNumber].filter(Boolean).join(' ')

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
            <span className="pill pill-hybrid">Retail</span>
            {brand ? <p className="deal-card-maker store-card-maker">{brand}</p> : null}
            <h2 id="store-preview-title">{title || product.title}</h2>
            <p className="muted">
              {usd(product.price)} / pc
              {product.compareAt && product.compareAt > product.price
                ? ` · was ${usd(product.compareAt)}`
                : ''}
              {' · '}
              {soldOut ? 'Sold out' : `${product.stock} in stock`}
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <StoreGallery product={product} variant="detail" />

        <dl className="specs">
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
          {battery > 0 ? (
            <div>
              <dt>Battery</dt>
              <dd>
                <BatteryMark value={battery} size={22} />
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
            <Link to="/store/cart" className="btn btn-primary" onClick={onClose}>
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
    </ModalShell>
  )
}
