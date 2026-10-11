import { usd } from '../lib/format'
import type { StoreProductDto } from '../lib/api'
import { addToStoreCart } from '../lib/storeCart'
import { StoreGallery } from './StoreGallery'

type Props = {
  product: StoreProductDto
  onOpen: (product: StoreProductDto) => void
  onAdded?: (title: string) => void
}

/** Same visual language as wholesale lot-card tiles. */
export function StoreProductCard({ product, onOpen, onAdded }: Props) {
  const soldOut = product.stock < 1
  const onSale = Boolean(product.compareAt && product.compareAt > product.price)

  return (
    <article className="card lot-card store-lot-card">
      <div className="store-lot-card-media">
        <StoreGallery product={product} variant="card" onOpen={() => onOpen(product)} />
        <span className="grade">{onSale ? 'Sale' : product.category}</span>
      </div>
      <div className="lot-body">
        <div className="lot-meta">
          <span className="pill pill-hybrid">Retail</span>
          <span className="muted">{soldOut ? 'Sold out' : `${product.stock} left`}</span>
        </div>
        <h3>
          <button type="button" className="item-link" onClick={() => onOpen(product)}>
            {product.title}
          </button>
        </h3>
        <p className="muted item-specs">
          {product.category} · Ready to ship
          {onSale ? ` · Was ${usd(product.compareAt!)}` : ''}
        </p>
        <div className="lot-price-row">
          <div>
            <div className="label">Buy now</div>
            <div className="price">
              {usd(product.price)}
              <small> / unit</small>
            </div>
          </div>
          <div className="right">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={soldOut}
              onClick={() => {
                addToStoreCart(product.id, 1)
                onAdded?.(product.title)
              }}
            >
              {soldOut ? 'Sold out' : 'Add to cart'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
