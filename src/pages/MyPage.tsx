import { useLayoutEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AuctionTypeHead } from '../components/AuctionTypeHead'
import { RecentLots } from '../components/RecentLots'
import { usd } from '../lib/format'
import { invoiceTotals, invoiceVisibleToBuyer } from '../lib/invoices'
import { useStore } from '../store'

const TABS = [
  { to: '/account', label: 'Bid History', end: true },
  { to: '/account/marketplace-history', label: 'Marketplace' },
  { to: '/account/settings', label: 'Account Settings' },
  { to: '/account/favourites', label: 'Favorites' },
  { to: '/account/invoices', label: 'Invoice' },
  { to: '/account/complaint', label: 'Complaint' },
] as const

export function MyPage() {
  const { pathname } = useLocation()
  const { invoices, user, isStaff, settings, cart, cartOrders, offers } = useStore()
  const onInvoices = pathname.startsWith('/account/invoices')
  const onMarket = pathname.startsWith('/account/marketplace-history')
  const mine = invoices.filter(
    (i) => invoiceVisibleToBuyer(i) && (isStaff || !i.accountId || i.accountId === user?.accountId),
  )
  const unpaid = mine.filter((i) => i.status !== 'paid' && !i.shippedAt)
  const due = unpaid.reduce((n, i) => n + invoiceTotals(i, settings).total, 0)
  const openCartOrders = (cartOrders || []).filter(
    (o) =>
      o.accountId === user?.accountId &&
      (o.status === 'pending' || o.status === 'accepted'),
  ).length
  const cartCount = cart.length + openCartOrders
  const offerCount = (offers || []).filter(
    (o) =>
      o.accountId === user?.accountId &&
      (o.status === 'pending' || o.status === 'accepted'),
  ).length

  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--auction-desk-h', '0px')
    return () => {
      document.documentElement.style.removeProperty('--auction-desk-h')
    }
  }, [])

  return (
    <div className="mypage is-command-bar">
      <section className="auction-type-block is-solo">
        <AuctionTypeHead>
          <div className="auction-command">
            <nav className="mypage-tabs" aria-label="My Page">
              {TABS.map((tab) => (
                <NavLink key={tab.to} to={tab.to} end={'end' in tab ? tab.end : false}>
                  {tab.label}
                  {tab.to === '/account/marketplace-history' && cartCount ? (
                    <em>{cartCount}</em>
                  ) : null}
                </NavLink>
              ))}
            </nav>
            {onMarket && cartCount ? (
              <a href="#cart" className="auction-command-link is-yours">
                Cart {cartCount}
              </a>
            ) : null}
            {onMarket && offerCount ? (
              <a href="#offers" className="auction-command-link is-open">
                Offers {offerCount}
              </a>
            ) : null}
            {due > 0 ? (
              <Link
                to="/account/invoices"
                className="auction-command-stat is-lose"
                title="Unpaid invoice total"
              >
                Unpaid {usd(due)}
              </Link>
            ) : null}
          </div>
        </AuctionTypeHead>
        <div className="mypage-body">
          {!onInvoices && !onMarket ? <RecentLots /> : null}
          <Outlet />
        </div>
      </section>
    </div>
  )
}
