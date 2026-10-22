import type { StoreProductDto } from '../lib/api'
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
          <div className="store-cart-variant-chips">
            {colorOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`store-cart-chip${opt.selected ? ' is-on' : ''}${
                  opt.inStock ? '' : ' is-oos'
                }`}
                disabled={!opt.inStock}
                title={opt.inStock ? opt.value : `${opt.value} · out of stock`}
                onClick={() => pick(opt)}
              >
                {opt.value}
              </button>
            ))}
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
                className={`store-cart-chip${opt.selected ? ' is-on' : ''}${
                  opt.inStock ? '' : ' is-oos'
                }`}
                disabled={!opt.inStock}
                title={opt.inStock ? opt.value : `${opt.value} · out of stock`}
                onClick={() => pick(opt)}
              >
                {opt.value}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function swatchStyle(name: string): { background: string; light?: boolean } {
  const n = name.toLowerCase()
  if (/(black|onyx|obsidian|phantom|midnight|charcoal|space)/.test(n)) {
    return { background: 'linear-gradient(145deg, #3a3a3c 0%, #0d0d0f 55%, #2c2c2e 100%)' }
  }
  if (/(graphite|gray|grey)/.test(n)) {
    return { background: 'linear-gradient(145deg, #b0b0b5 0%, #6e6e73 100%)' }
  }
  if (/(silver|marble)/.test(n)) {
    return { background: 'linear-gradient(145deg, #f5f5f7 0%, #c7c7cc 55%, #e8e8ed 100%)', light: true }
  }
  if (/(white|snow|starlight|cream|milk)/.test(n)) {
    return { background: 'linear-gradient(145deg, #ffffff 0%, #ebebf0 100%)', light: true }
  }
  if (/(blue|sky)/.test(n)) {
    return { background: 'linear-gradient(145deg, #7eb6e8 0%, #2f5f9e 55%, #1e3a6e 100%)' }
  }
  if (/(navy|cobalt)/.test(n)) {
    return { background: 'linear-gradient(145deg, #4a6fa5 0%, #1a2f5a 100%)' }
  }
  if (/(pink|rose)/.test(n)) {
    return { background: 'linear-gradient(145deg, #f5c6d4 0%, #d4849a 55%, #b85a75 100%)' }
  }
  if (/(violet|purple)/.test(n)) {
    return { background: 'linear-gradient(145deg, #b8a4d9 0%, #6b4f9a 100%)' }
  }
  if (/(green|mint|meadow|lime)/.test(n)) {
    return { background: 'linear-gradient(145deg, #8fd4b0 0%, #2f7a58 100%)' }
  }
  if (/(gold|yellow)/.test(n)) {
    return { background: 'linear-gradient(145deg, #f0e0a8 0%, #c9a227 100%)', light: true }
  }
  if (/(orange|sunrise)/.test(n)) {
    return { background: 'linear-gradient(145deg, #ffb07c 0%, #e07030 100%)' }
  }
  if (/(red|coral)/.test(n)) {
    return { background: 'linear-gradient(145deg, #f08080 0%, #c0392b 100%)' }
  }
  return { background: 'linear-gradient(145deg, #c5cdd6 0%, #7a8794 100%)' }
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
