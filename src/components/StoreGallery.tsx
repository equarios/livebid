import { useEffect, useState } from 'react'
import { storeProductFallback, storeProductImages } from '../lib/storePhotos'
import type { StoreProductDto } from '../lib/api'

type Props = {
  product: Pick<StoreProductDto, 'title' | 'imageUrl' | 'images'>
  /** card = cover only; detail = main + thumbs */
  variant?: 'card' | 'detail'
  onOpen?: () => void
  className?: string
}

/** Multi-image gallery for store cards and product detail. */
export function StoreGallery({ product, variant = 'detail', onOpen, className }: Props) {
  const images = storeProductImages(product, variant === 'card' ? 640 : 960)
  const [index, setIndex] = useState(0)
  const safe = Math.min(index, Math.max(0, images.length - 1))
  const current = images[safe] || storeProductFallback(product)

  useEffect(() => {
    setIndex(0)
  }, [product.title, product.imageUrl, product.images?.join('|')])

  if (variant === 'card') {
    const cover = images[0] || storeProductFallback(product)
    return (
      <div className={`store-gallery is-card ${className || ''}`}>
        <button
          type="button"
          className="lot-photo-link has-quick-view"
          onClick={onOpen}
          aria-label={`Quick view ${product.title}`}
        >
          <img
            src={cover}
            alt=""
            decoding="async"
            onError={(e) => {
              e.currentTarget.onerror = null
              e.currentTarget.src = storeProductFallback(product)
            }}
          />
          <span className="quick-view-hint" aria-hidden>
            Quick view
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className={`store-gallery is-detail lot-photos ${className || ''}`}>
      <div className="lot-photo-main">
        {images.length > 1 ? (
          <button
            type="button"
            className="store-gallery-nav is-prev"
            aria-label="Previous photo"
            onClick={() => setIndex((i) => (i + images.length - 1) % images.length)}
          >
            ‹
          </button>
        ) : null}
        <img
          src={current}
          alt=""
          onError={(e) => {
            e.currentTarget.onerror = null
            e.currentTarget.src = storeProductFallback(product)
          }}
        />
        {images.length > 1 ? (
          <button
            type="button"
            className="store-gallery-nav is-next"
            aria-label="Next photo"
            onClick={() => setIndex((i) => (i + 1) % images.length)}
          >
            ›
          </button>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="lot-photo-thumbs">
          {images.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              className={i === safe ? 'on' : undefined}
              onClick={() => setIndex(i)}
              aria-label={`Photo ${i + 1}`}
            >
              <img
                src={url}
                alt=""
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = storeProductFallback(product)
                }}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
