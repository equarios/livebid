import { useState } from 'react'
import type { StoreProductDto } from '../lib/api'
import { storeProductBrand, storeProductHeadline } from '../lib/storeBrand'
import { addToStoreCart } from '../lib/storeCart'
import { storeAddedToCart } from '../lib/storeFeedback'
import { useStoreFx } from '../lib/storeFx'
import { storeConditionHint, storeNeedsBuyAck } from '../lib/storeCondition'
import { AskAboutItem } from './AskAboutItem'
import { StoreCapacityPills, StoreColorDots } from './StoreVariantPicker'
import { StoreConditionBadges } from './StoreConditionBadges'
import { StoreGallery } from './StoreGallery'

const LOW_STOCK_AT = 8

type Props = {
  product: StoreProductDto
  onOpen: (product: StoreProductDto) => void
  onAdded?: (title: string) => void
  index?: number
  /** Full catalog — enables sibling color dots. */
  catalog?: StoreProductDto[]
}

/** Consumer grid tile — photo, brand, title, price; urgency/locks only when they matter. */
export function StoreProductCard({ product, onOpen, onAdded, index = 0, catalog }: Props) {
  const { money } = useStoreFx()
  const soldOut = product.stock < 1
  const onSale = Boolean(product.compareAt && product.compareAt > product.price)
  const brand = storeProductBrand(product)
  const headline = storeProductHeadline(product, brand)
  const variantCatalog = catalog?.length ? catalog : [product]
  const lowStock = !soldOut && product.stock > 0 && product.stock <= LOW_STOCK_AT
  const priceHint = storeNeedsBuyAck(product) ? storeConditionHint(product) : null
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
        <h3>
          <button type="button" className="item-link" onClick={() => onOpen(product)}>
            {headline}
          </button>
        </h3>
        <button type="button" className="item-details-cue" onClick={() => onOpen(product)}>
          Details
        </button>
        <StoreColorDots product={product} catalog={variantCatalog} onOpen={onOpen} />
        <StoreCapacityPills product={product} catalog={variantCatalog} onOpen={onOpen} />
        {lowStock ? <p className="muted store-card-stock">{product.stock} left</p> : null}
        <div className="lot-price-row">
          <div>
            <div className="price">
              {money(product.price)}
            </div>
            {onSale ? (
              <div className="store-was">
                <s>{money(product.compareAt!)}</s>
                <span>Save {money(product.compareAt! - product.price)}</span>
              </div>
            ) : null}
            {priceHint ? <p className="store-card-price-hint">{priceHint}</p> : null}
          </div>
        </div>
        <StoreConditionBadges product={product} />
        <div className="store-card-actions">
          {soldOut ? (
            <AskAboutItem
              channel="store"
              itemId={product.slug || product.id}
              itemTitle={product.title}
              itemHref={`/store/p/${encodeURIComponent(product.slug || product.id)}`}
              className="btn btn-primary btn-sm store-card-cta"
              label="Notify me"
              dialogTitle="Notify when back"
              presetMessage={`Please notify me when "${product.title}" is back in stock.`}
            />
          ) : storeNeedsBuyAck(product) ? (
            <button
              type="button"
              className="btn btn-primary btn-sm store-card-cta"
              onClick={() => onOpen(product)}
            >
              Review & add
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm store-card-cta"
              disabled={adding}
              onClick={() => {
                setAdding(true)
                addToStoreCart(product.id, 1)
                storeAddedToCart(product.title, 1)
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
