import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { storeCartCount } from '../lib/storeCart'
import { StoreCurrencySelect } from '../lib/storeFx'

type RailPage = 'store' | 'cart' | 'orders' | 'product' | 'sold' | 'tradein'

/** Store page head — nav + optional merged hero (cart / orders / trade-in). */
export function StoreRail({
  page,
  title,
  count,
  note,
  label,
  crumb,
  /** Merged gradient header: tabs + title + trust in one panel. */
  hero = false,
  /** Hero H1; defaults to `title`. */
  headline,
  trust,
  onBack,
}: {
  page: RailPage
  title: string
  count?: number | string | null
  note: string
  label?: string
  crumb?: string | null
  hero?: boolean
  headline?: string
  trust?: string[]
  /** Product page: return to the page that opened it. */
  onBack?: () => void
}) {
  const shopLabel = label || 'Store'
  const [cartN, setCartN] = useState(() => storeCartCount())
  const [cartPulse, setCartPulse] = useState(false)

  useEffect(() => {
    const sync = () => {
      setCartN(storeCartCount())
      setCartPulse(true)
      window.setTimeout(() => setCartPulse(false), 560)
    }
    window.addEventListener('livebid-store-cart', sync)
    return () => window.removeEventListener('livebid-store-cart', sync)
  }, [])

  const showContinue = page === 'cart' || page === 'orders' || page === 'tradein'
  const shopActive = page === 'store' || page === 'product' || page === 'sold'
  const showCount = count != null && count !== '' && count !== 0
  const h1 = headline || title

  return (
    <header
      className={`store-rail mh-desk-head${hero ? ' is-hero store-page-hero' : ''}`}
      aria-label={title}
    >
      <div className="store-rail-top">
        <nav className="store-rail-journey" aria-label="Store">
          <NavLink to="/store" end className={shopActive ? 'active' : undefined}>
            Shop
          </NavLink>
          <NavLink to="/store/trade-in" className={page === 'tradein' ? 'active' : undefined}>
            Trade-in
          </NavLink>
          <NavLink to="/store/cart" className={page === 'cart' ? 'active' : undefined}>
            Cart
            {cartN > 0 ? (
              <em className={`store-rail-cart-n${cartPulse ? ' is-pulse' : ''}`}>{cartN}</em>
            ) : null}
          </NavLink>
          <NavLink to="/store/orders" className={page === 'orders' ? 'active' : undefined}>
            Orders
          </NavLink>
        </nav>
        <div className="store-rail-top-end">
          {onBack ? (
            <button type="button" className="store-rail-continue store-rail-back" onClick={onBack}>
              Back
            </button>
          ) : null}
          {showContinue ? (
            <Link to="/store" className="store-rail-continue">
              Continue shopping
            </Link>
          ) : null}
          <StoreCurrencySelect />
        </div>
      </div>

      {page === 'product' && crumb ? (
        <p className="store-rail-crumb">
          <Link to="/store">{shopLabel}</Link>
          <span aria-hidden> / </span>
          <span>{crumb}</span>
        </p>
      ) : null}
      {page === 'sold' ? (
        <p className="store-rail-crumb">
          <Link to="/store">{shopLabel}</Link>
          <span aria-hidden> / </span>
          <span>Recently sold</span>
        </p>
      ) : null}

      {hero ? (
        <div className="store-rail-hero-body">
          <h1>
            {h1}
            {showCount ? <em className="store-page-hero-count">{count}</em> : null}
          </h1>
          <p>{note}</p>
          {trust?.length ? (
            <ul className="store-page-trust">
              {trust.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <>
          <h2>
            {title}
            {count != null && count !== '' ? <em>{count}</em> : null}
          </h2>
          <p className="mh-desk-note">{note}</p>
        </>
      )}
    </header>
  )
}
