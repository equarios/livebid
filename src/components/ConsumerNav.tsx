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

  const shopOpen =
    location.pathname === '/' ||
    location.pathname === '/store' ||
    location.pathname.startsWith('/store/p')
  const cartOpen = location.pathname.startsWith('/store/cart')
  const ordersOpen = location.pathname.startsWith('/store/orders')
  const supportOpen = location.pathname.startsWith('/support')

  return (
    <nav
      className="site-nav consumer-nav gd-nav"
      onClick={() => {
        onNavigate?.()
      }}
    >
      <NavLink to="/store" end className={shopOpen ? 'active' : undefined}>
        {settings.storeLabel && settings.storeLabel !== 'Store'
          ? settings.storeLabel
          : settings.copy.navStore}
      </NavLink>
      <NavLink to="/store/cart" className={cartOpen ? 'active' : undefined}>
        {settings.copy.navCart}
        {cartN > 0 ? <span className="gd-count">{cartN}</span> : null}
      </NavLink>
      <NavLink to="/store/orders" className={ordersOpen ? 'active' : undefined}>
        {settings.copy.navOrders}
      </NavLink>
      <NavLink to="/support" className={supportOpen ? 'active' : undefined}>
        {settings.copy.navSupport}
      </NavLink>
    </nav>
  )
}
