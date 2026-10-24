import type { StoreProductDto } from '../lib/api'
import { colorSwatch, type ColorSwatch } from '../lib/storeSwatch'
import { storeVariantOptions, type VariantOption } from '../lib/storeVariants'

type Props = {
  product: StoreProductDto
  catalog: StoreProductDto[]
  onSelect: (product: StoreProductDto) => void
  className?: string
}

/** Color + storage chips — same sibling rules as cart. */
export function StoreVariantPicker({ product, catalog, onSelect, className }: Props) {
  const { colorOptions, capacityOptions } = storeVariantOptions(product, catalog)
  if (!colorOptions.length && !capacityOptions.length) return null

  const pick = (opt: VariantOption) => {
    if (!opt.product || !opt.inStock || opt.selected) return
    onSelect(opt.product)
  }

  return (
    <div className={`store-variant-picker${className ? ` ${className}` : ''}`}>
      {colorOptions.length ? (
        <div className="store-cart-variants" role="group" aria-label="Color">
          <span className="store-cart-variant-label">Color</span>
          <div className="store-card-dots store-pdp-color-dots">
            {colorOptions.map((opt) => {
              const swatch = colorSwatch(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`store-card-dot${opt.selected ? ' is-on' : ''}${
                    opt.inStock ? '' : ' is-oos'
                  }${swatch.light ? ' is-light' : ''}`}
                  disabled={!opt.inStock}
                  title={opt.inStock ? opt.value : `${opt.value} · out of stock`}
                  aria-label={opt.value}
                  aria-pressed={opt.selected}
                  onClick={() => pick(opt)}
                >
                  <span className="store-card-dot-fill" style={{ background: swatch.background }} />
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
      {capacityOptions.length ? (
        <div className="store-cart-variants" role="group" aria-label="Storage">
          <span className="store-cart-variant-label">Storage</span>
          <div className="store-cart-variant-chips">
            {capacityOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`store-cart-chip store-card-cap${opt.selected ? ' is-on' : ''}${
                  opt.inStock ? '' : ' is-oos'
                }`}
                disabled={!opt.inStock}
                title={opt.inStock ? opt.value : `${opt.value} · out of stock`}
                onClick={() => pick(opt)}
              >
                {capacityLabel(opt.value)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function swatchStyle(name: string): ColorSwatch {
  return colorSwatch(name)
}

function cardColorOptions(product: StoreProductDto, catalog: StoreProductDto[]) {
  const { colorOptions } = storeVariantOptions(product, catalog)
  if (colorOptions.length) return colorOptions
  const value = (product.color || '').trim()
  if (!value) return []
  return [
    {
      value,
      product,
      inStock: product.stock > 0,
      selected: true,
    } satisfies VariantOption,
  ]
}

function cardCapacityOptions(product: StoreProductDto, catalog: StoreProductDto[]) {
  const { capacityOptions } = storeVariantOptions(product, catalog)
  if (capacityOptions.length) return capacityOptions
  const value = (product.capacity || '').trim()
  if (!value) return []
  return [
    {
      value,
      product,
      inStock: product.stock > 0,
      selected: true,
    } satisfies VariantOption,
  ]
}

/** Compact color dots for grid cards — always shows when a color exists. */
export function StoreColorDots({
  product,
  catalog,
  onOpen,
}: {
  product: StoreProductDto
  catalog: StoreProductDto[]
  onOpen: (product: StoreProductDto) => void
}) {
  const options = cardColorOptions(product, catalog)
  if (!options.length) return null
  const multi = options.length > 1
  return (
    <div className="store-card-dots" aria-label="Colors">
      {options.slice(0, 6).map((opt) => {
        const swatch = swatchStyle(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            className={`store-card-dot${opt.selected ? ' is-on' : ''}${
              opt.inStock ? '' : ' is-oos'
            }${swatch.light ? ' is-light' : ''}${!multi ? ' is-static' : ''}`}
            disabled={!opt.inStock}
            title={opt.inStock ? opt.value : `${opt.value} · out of stock`}
            aria-label={opt.value}
            onClick={(e) => {
              e.stopPropagation()
              if (!multi || !opt.product || !opt.inStock || opt.selected) return
              onOpen(opt.product)
            }}
          >
            <span className="store-card-dot-fill" style={{ background: swatch.background }} />
          </button>
        )
      })}
    </div>
  )
}

function capacityLabel(value: string) {
  const m = value.trim().match(/^(\d+)\s*(GB|TB)$/i)
  if (m) return `${m[1]}${(m[2] || 'GB').toUpperCase()}`
  return value.trim()
}

/** Compact storage pills for grid cards — always shows when capacity exists. */
export function StoreCapacityPills({
  product,
  catalog,
  onOpen,
}: {
  product: StoreProductDto
  catalog: StoreProductDto[]
  onOpen: (product: StoreProductDto) => void
}) {
  const options = cardCapacityOptions(product, catalog)
  if (!options.length) return null
  const multi = options.length > 1
  return (
    <div className="store-card-caps" aria-label="Storage">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`store-card-cap${opt.selected ? ' is-on' : ''}${
            opt.inStock ? '' : ' is-oos'
          }${!multi ? ' is-static' : ''}`}
          disabled={!opt.inStock}
          title={opt.inStock ? opt.value : `${opt.value} · out of stock`}
          onClick={(e) => {
            e.stopPropagation()
            if (!multi || !opt.product || !opt.inStock || opt.selected) return
            onOpen(opt.product)
          }}
        >
          {capacityLabel(opt.value)}
        </button>
      ))}
    </div>
  )
}
