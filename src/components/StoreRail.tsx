import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { storeCartCount } from '../lib/storeCart'

type RailPage = 'store' | 'cart' | 'orders' | 'product' | 'sold'

/** Shared Store desk head — lander / cart / orders / PDP. */
export function StoreRail({
  page,
  title,
  count,
  note,
  label,
}: {
  page: RailPage
  title: string
  count?: number | string | null
  note: string
  label?: string
}) {
  const [cartN, setCartN] = useState(() => storeCartCount())

  useEffect(() => {
    const sync = () => setCartN(storeCartCount())
    window.addEventListener('livebid-store-cart', sync)
    return () => window.removeEventListener('livebid-store-cart', sync)
  }, [])

  const links: Array<{ to: string; children: ReactNode; show: boolean }> = [
    {
      to: '/store',
      children: page === 'store' ? null : `← ${label || 'Store'}`,
      show: page !== 'store',
    },
    {
      to: '/store/cart',
      children: cartN ? `Cart · ${cartN}` : 'Cart',
      show: page !== 'cart',
    },
    {
      to: '/store/orders',
      children: 'Orders',
      show: page !== 'orders',
    },
    {
      to: '/store/sold',
      children: 'Recently sold',
      show: page !== 'sold',
    },
  ]

  return (
    <header className="store-rail mh-desk-head" aria-label={title}>
      <h2>
        {title}
        {count != null && count !== '' ? <em>{count}</em> : null}
      </h2>
      <p className="mh-desk-note">{note}</p>
      <div className="mh-desk-actions store-rail-links">
        {links
          .filter((l) => l.show && l.children)
          .map((l) => (
            <Link key={l.to} to={l.to} className="store-rail-link">
              {l.children}
            </Link>
          ))}
      </div>
    </header>
  )
}
