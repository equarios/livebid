import { useEffect, useState } from 'react'
import { storeProductFallback, storeProductImages } from '../lib/storePhotos'
import type { StoreProductDto } from '../lib/api'

type Props = {
  product: Pick<StoreProductDto, 'title' | 'imageUrl' | 'images'>
  /** card = cover + dots; detail = main + thumbs */
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
    return (
      <div className={`store-gallery is-card ${className || ''}`}>
        <button
          type="button"
          className="lot-photo-link"
          onClick={onOpen}
          aria-label={`View ${product.title}`}
        >
          <img
            src={current}
            alt=""
            decoding="async"
            onError={(e) => {
              e.currentTarget.onerror = null
              e.currentTarget.src = storeProductFallback(product)
            }}
          />
        </button>
        {images.length > 1 ? (
          <div className="store-gallery-dots" role="tablist" aria-label="Photos">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === safe}
                className={i === safe ? 'on' : undefined}
                onClick={(e) => {
                  e.stopPropagation()
                  setIndex(i)
                }}
              />
            ))}
          </div>
        ) : null}
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
