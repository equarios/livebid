import { useEffect, useState } from 'react'
import type { StoreProductDto } from '../lib/api'
import { storeProductBrand, storeProductHeadline } from '../lib/storeBrand'
import { addToStoreCart } from '../lib/storeCart'
import { storeAddedToCart } from '../lib/storeFeedback'
import { pushToast } from '../lib/toast'
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
  const [active, setActive] = useState(product)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    setActive(product)
  }, [product])

  const soldOut = active.stock < 1
  const onSale = Boolean(active.compareAt && active.compareAt > active.price)
  const brand = storeProductBrand(active)
  const headline = storeProductHeadline(active, brand)
  const variantCatalog = catalog?.length ? catalog : [active]
  const lowStock = !soldOut && active.stock > 0 && active.stock <= LOW_STOCK_AT
  const priceHint = storeNeedsBuyAck(active) ? storeConditionHint(active) : null

  return (
    <article
      className={`card lot-card store-lot-card shop-card${soldOut ? ' is-sold' : ''}`}
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
      aria-disabled={soldOut || undefined}
    >
      <div className="store-lot-card-media">
        <StoreGallery product={active} variant="card" onOpen={() => onOpen(active)} />
        {soldOut ? (
          <span className="sold-badge">Sold out</span>
        ) : (
          <>
            {active.grade ? (
              <span className={`grade grade-${active.grade}`}>Grade {active.grade}</span>
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
        <div className="store-card-title-row">
          <h3>
            <button type="button" className="item-link" onClick={() => onOpen(active)}>
              {headline}
            </button>
          </h3>
          <button type="button" className="item-details-cue" onClick={() => onOpen(active)}>
            Quick view
          </button>
        </div>
        <StoreColorDots product={active} catalog={variantCatalog} onOpen={setActive} />
        <StoreCapacityPills product={active} catalog={variantCatalog} onOpen={setActive} />
        {lowStock ? <p className="muted store-card-stock">{active.stock} left</p> : null}
        <div className="lot-price-row">
          <div>
            <div className="price">{money(active.price)}</div>
            {onSale ? (
              <div className="store-was">
                <s>{money(active.compareAt!)}</s>
                <span>Save {money(active.compareAt! - active.price)}</span>
              </div>
            ) : null}
            {priceHint ? <p className="store-card-price-hint">{priceHint}</p> : null}
          </div>
        </div>
        <StoreConditionBadges product={active} />
        <div className="store-card-actions">
          {soldOut ? (
            <AskAboutItem
              channel="store"
              itemId={active.slug || active.id}
              itemTitle={active.title}
              itemHref={`/store/p/${encodeURIComponent(active.slug || active.id)}`}
              className="btn btn-primary btn-sm store-card-cta"
              label="Notify me"
              dialogTitle="Notify when back"
              presetMessage={`Please notify me when "${active.title}" is back in stock.`}
            />
          ) : storeNeedsBuyAck(active) ? (
            <button
              type="button"
              className="btn btn-primary btn-sm store-card-cta"
              onClick={() => onOpen(active)}
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
                const landed = addToStoreCart(active.id, 1, active.stock)
                storeAddedToCart(active.title, 1)
                onAdded?.(active.title)
                window.setTimeout(() => setAdding(false), 700)
                if (!landed) {
                  pushToast(`${active.title} is out of stock.`)
                }
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
