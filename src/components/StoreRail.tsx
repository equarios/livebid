import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { storeCartCount } from '../lib/storeCart'
import { StoreCurrencySelect } from '../lib/storeFx'

type RailPage = 'store' | 'cart' | 'orders' | 'product' | 'sold' | 'tradein'

/** Store page head — shared Shop / Cart / Orders strip, currency, title. */
export function StoreRail({
  page,
  title,
  count,
  note,
  label,
  crumb,
}: {
  page: RailPage
  title: string
  count?: number | string | null
  note: string
  label?: string
  /** Product breadcrumb label (PDP only). */
  crumb?: string | null
}) {
  const shopLabel = label || 'Store'
  const [cartN, setCartN] = useState(() => storeCartCount())

  useEffect(() => {
    const sync = () => setCartN(storeCartCount())
    window.addEventListener('livebid-store-cart', sync)
    return () => window.removeEventListener('livebid-store-cart', sync)
  }, [])

  const showContinue = page === 'cart' || page === 'orders' || page === 'tradein'
  const shopActive = page === 'store' || page === 'product' || page === 'sold'

  return (
    <header className="store-rail mh-desk-head" aria-label={title}>
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
            {cartN > 0 ? <em className="store-rail-cart-n">{cartN}</em> : null}
          </NavLink>
          <NavLink to="/store/orders" className={page === 'orders' ? 'active' : undefined}>
            Orders
          </NavLink>
        </nav>
        <div className="store-rail-top-end">
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

      <h2>
        {title}
        {count != null && count !== '' ? <em>{count}</em> : null}
      </h2>
      <p className="mh-desk-note">{note}</p>
    </header>
  )
}
