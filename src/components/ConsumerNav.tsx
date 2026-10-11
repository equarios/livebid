import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { storeCartCount } from '../lib/storeCart'
import { useStore } from '../store'

/** Retail-only nav — GoDaddy-style text links + cart count. */
export function ConsumerNav({ onNavigate }: { onNavigate?: () => void }) {
  const { settings } = useStore()
  const location = useLocation()
  const [cartN, setCartN] = useState(() => storeCartCount())

  useEffect(() => {
    const sync = () => setCartN(storeCartCount())
    window.addEventListener('livebid-store-cart', sync)
    return () => window.removeEventListener('livebid-store-cart', sync)
  }, [])

  const shopOpen = location.pathname === '/' || location.pathname.startsWith('/store/p')
  const cartOpen = location.pathname.startsWith('/store/cart')
  const ordersOpen = location.pathname.startsWith('/store/orders')

  return (
    <nav
      className="site-nav consumer-nav gd-nav"
      onClick={() => {
        onNavigate?.()
      }}
    >
      <NavLink to="/" end className={shopOpen ? 'active' : undefined}>
        {settings.storeLabel || settings.copy.navStore || 'Store'}
      </NavLink>
      <NavLink to="/store/cart" className={cartOpen ? 'active' : undefined}>
        Cart
        {cartN > 0 ? <span className="gd-count">{cartN}</span> : null}
      </NavLink>
      <NavLink to="/store/orders" className={ordersOpen ? 'active' : undefined}>
        Orders
      </NavLink>
    </nav>
  )
}
