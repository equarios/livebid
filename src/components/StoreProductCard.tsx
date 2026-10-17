import { useState } from 'react'
import { Link } from 'react-router-dom'
import { lotItemSub } from '../lib/itemLine'
import { usd } from '../lib/format'
import type { StoreProductDto } from '../lib/api'
import { storeProductBrand } from '../lib/storeBrand'
import { addToStoreCart } from '../lib/storeCart'
import { pushToast } from '../lib/toast'
import { AskAboutItem } from './AskAboutItem'
import { BatteryMark } from './BatteryMark'
import { StoreGallery } from './StoreGallery'

type Props = {
  product: StoreProductDto
  onOpen: (product: StoreProductDto) => void
  onAdded?: (title: string) => void
  index?: number
}

function escapeRe(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Title without brand, capacity, and grade — those already show as maker, specs, and badge. */
function cardHeadline(product: StoreProductDto, brand: string) {
  let title = product.title.trim()
  if (brand && title.toLowerCase().startsWith(`${brand.toLowerCase()} `)) {
    title = title.slice(brand.length).trim()
  }
  const capacity = (product.capacity || '').trim()
  if (capacity) {
    title = title.replace(new RegExp(`\\b${escapeRe(capacity)}\\b`, 'i'), ' ')
  }
  title = title.replace(/\b\d+\s?(?:GB|TB)\b/gi, ' ')
  title = title
    .replace(/\s*[—–-]\s*Grade\s+[A-Z0-9]+\s*$/i, ' ')
    .replace(/\bGrade\s+[A-Z0-9]+\b/gi, ' ')
    .replace(/\s*[—–-]\s*$/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  const model = (product.modelNumber || '').trim()
  if (model && !title.toLowerCase().includes(model.toLowerCase())) {
    title = [title, model].filter(Boolean).join(' ')
  }
  return title || product.title
}

/** Same visual language as wholesale lot-card tiles (specs + chips). */
export function StoreProductCard({ product, onOpen, onAdded, index = 0 }: Props) {
  const soldOut = product.stock < 1
  const onSale = Boolean(product.compareAt && product.compareAt > product.price)
  const brand = storeProductBrand(product)
  const headline = cardHeadline(product, brand)
  const sub = lotItemSub(product)
  const battery = Math.max(0, Math.floor(Number(product.battery) || 0))
  const [adding, setAdding] = useState(false)

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
        ) : (
          <>
            {product.grade ? (
              <span className={`grade grade-${product.grade}`}>Grade {product.grade}</span>
            ) : null}
            {onSale ? <span className="store-sale-badge">Sale</span> : null}
          </>
        )}
      </div>
      <div className="lot-body">
        {brand ? (
          <span className="deal-card-maker store-card-maker" title={brand}>
            {brand}
          </span>
        ) : null}
        <div className="lot-meta">
          <span className="pill pill-hybrid">Retail</span>
          {soldOut ? null : <span className="muted">{product.stock} left</span>}
        </div>
        <h3>
          <button type="button" className="item-link" onClick={() => onOpen(product)}>
            {headline}
          </button>
        </h3>
        <p className="muted item-specs">
          {sub || product.category}
          {sub && product.category ? ` · ${product.category}` : ''}
        </p>
        <div className="item-chips store-card-chips">
          {battery > 0 ? (
            <span className="item-chip">
              <BatteryMark value={battery} />
            </span>
          ) : null}
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
            {onSale ? (
              <div className="store-was">
                <s>{usd(product.compareAt!)}</s>
                <span>Save {usd(product.compareAt! - product.price)}</span>
              </div>
            ) : null}
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
              disabled={adding}
              onClick={() => {
                setAdding(true)
                addToStoreCart(product.id, 1)
                pushToast(`Added ${product.title} to cart`, 'ok', {
                  href: '/store/cart',
                  label: 'View cart',
                })
                onAdded?.(product.title)
                window.setTimeout(() => setAdding(false), 700)
              }}
            >
              {adding ? 'Added' : 'Add to cart'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
