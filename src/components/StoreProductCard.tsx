import { Link } from 'react-router-dom'
import { originLabel } from '../lib/auctionLists'
import { usd } from '../lib/format'
import type { StoreProductDto } from '../lib/api'
import { storeProductBrand } from '../lib/storeBrand'
import { addToStoreCart } from '../lib/storeCart'
import { AskAboutItem } from './AskAboutItem'
import { BatteryMark } from './BatteryMark'
import { StoreGallery } from './StoreGallery'

type Props = {
  product: StoreProductDto
  onOpen: (product: StoreProductDto) => void
  onAdded?: (title: string) => void
  index?: number
}

/** Same visual language as wholesale lot-card tiles (specs + chips). */
export function StoreProductCard({ product, onOpen, onAdded, index = 0 }: Props) {
  const soldOut = product.stock < 1
  const onSale = Boolean(product.compareAt && product.compareAt > product.price)
  const brand = storeProductBrand(product)
  const headline = [product.title, product.modelNumber].filter(Boolean).join(' ')
  const sub = [product.capacity, originLabel(product.origin), product.color]
    .filter(Boolean)
    .join(' · ')
  const battery = Math.max(0, Math.floor(Number(product.battery) || 0))

  return (
    <article
      className={`card lot-card store-lot-card shop-card${soldOut ? ' is-sold' : ''}`}
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
      aria-disabled={soldOut || undefined}
    >
      <div className="store-lot-card-media">
        <StoreGallery product={product} variant="card" onOpen={() => onOpen(product)} />
        {soldOut ? (
          <span className="sold-badge">Sold out</span>
        ) : product.grade ? (
          <span className={`grade grade-${product.grade}`}>Grade {product.grade}</span>
        ) : onSale ? (
          <span className="grade">Sale</span>
        ) : null}
      </div>
      <div className="lot-body">
        {brand ? (
          <span className="deal-card-maker store-card-maker" title={brand}>
            {brand}
          </span>
        ) : null}
        <div className="lot-meta">
          <span className="pill pill-hybrid">Retail</span>
          <span className="muted">{soldOut ? 'Sold out' : `${product.stock} left`}</span>
        </div>
        <h3>
          <button type="button" className="item-link" onClick={() => onOpen(product)}>
            {headline}
          </button>
        </h3>
        <p className="muted item-specs">
          {sub || product.category}
          {sub && product.category ? ` · ${product.category}` : ''}
          {onSale ? ` · Was ${usd(product.compareAt!)}` : ''}
        </p>
        <div className="item-chips store-card-chips">
          {battery > 0 ? (
            <span className="item-chip">
              <BatteryMark value={battery} />
            </span>
          ) : null}
          {product.grade ? <span className="item-chip">Grade {product.grade}</span> : null}
          <span className={`item-chip${product.simLocked ? ' lock' : ''}`}>
            {product.simLocked ? 'SIM locked' : 'SIM unlocked'}
          </span>
          <span className={`item-chip${product.activationLocked ? ' lock' : ''}`}>
            {product.activationLocked ? 'Act locked' : 'Act open'}
          </span>
        </div>
        <div className="lot-price-row">
          <div>
            <div className="label">Buy now</div>
            <div className="price">
              {usd(product.price)}
              <small> / unit</small>
            </div>
          </div>
        </div>
        <div className="store-card-actions">
          <Link to={`/store/p/${product.slug}`} className="btn btn-primary btn-sm">
            Product Details
          </Link>
          {soldOut ? (
            <AskAboutItem
              channel="store"
              itemId={product.slug || product.id}
              itemTitle={product.title}
              itemHref={`/store/p/${encodeURIComponent(product.slug || product.id)}`}
              className="btn btn-primary btn-sm"
              label="Notify me"
              dialogTitle="Notify when back"
              presetMessage={`Please notify me when "${product.title}" is back in stock.`}
            />
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                addToStoreCart(product.id, 1)
                onAdded?.(product.title)
              }}
            >
              Add to cart
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
