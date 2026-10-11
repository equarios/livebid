import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ModalShell } from './ModalShell'
import { StoreGallery } from './StoreGallery'
import { usd } from '../lib/format'
import type { StoreProductDto } from '../lib/api'
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

  return (
    <ModalShell onClose={onClose} className="lot-backdrop">
      <div
        className="modal card lot-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lot-modal-head">
          <div>
            <span className="pill pill-hybrid">Retail</span>
            <h2 id="store-preview-title">{product.title}</h2>
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
          <Link to="/store/cart" className="btn btn-ghost" onClick={onClose}>
            Checkout
          </Link>
          <Link to={`/store/p/${product.slug}`} className="btn btn-ghost" onClick={onClose}>
            Full page
          </Link>
        </div>
        {msg ? <p className="tiny retail-toast">{msg}</p> : null}
      </div>
    </ModalShell>
  )
}
