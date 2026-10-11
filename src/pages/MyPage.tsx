import { useLayoutEffect, useMemo } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AuctionTypeHead } from '../components/AuctionTypeHead'
import { DeskIntro } from '../components/DeskIntro'
import { canUseWholesaleDesk } from '../lib/channelAccess'
import { usd } from '../lib/format'
import { invoiceTotals, invoiceVisibleToBuyer } from '../lib/invoices'
import { useStore } from '../store'

type Tab = { to: string; label: string; end?: boolean; badge?: number }

export function MyPage() {
  const { pathname } = useLocation()
  const { invoices, user, isStaff, settings, cart, cartOrders, offers, watchlist } = useStore()
  const wholesaleOk = canUseWholesaleDesk(user, isStaff)
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
  const favCount = watchlist.length

  const tabs = useMemo((): Tab[] => {
    const base: Tab[] = [{ to: '/account', label: 'Overview', end: true }]
    // Application desk only — approved buyers already have the full trading bar.
    if (!wholesaleOk) {
      base.push({ to: '/account/wholesale', label: 'Wholesale' })
    }
    base.push({ to: '/account/documents', label: 'Documents' })
    if (wholesaleOk) {
      base.push(
        { to: '/account/bids', label: 'Bids' },
        {
          to: '/account/marketplace-history',
          label: 'Marketplace',
          badge: cartCount || undefined,
        },
      )
      if (settings.showCommunity !== false) {
        base.push({ to: '/account/community', label: 'Community' })
      }
      base.push(
        {
          to: '/account/favourites',
          label: 'Favorites',
          badge: favCount || undefined,
        },
        {
          to: '/account/invoices',
          label: 'Invoice',
          badge: unpaid.length || undefined,
        },
        { to: '/account/imei', label: 'IMEI' },
      )
    }
    base.push(
      { to: '/account/settings', label: 'Settings' },
      { to: '/account/complaint', label: 'Complaint' },
    )
    return base
  }, [wholesaleOk, settings.showCommunity, cartCount, favCount, unpaid.length])

  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--auction-desk-h', '0px')
    return () => {
      document.documentElement.style.removeProperty('--auction-desk-h')
    }
  }, [])

  return (
    <div className="mypage is-command-bar desk-page">
      <DeskIntro
        brand={settings.brandName || 'eQuarios'}
        title={settings.copy.accountTitle || 'My Page'}
        body={settings.copy.accountIntro}
        tone="trade"
      />
      <section className="auction-type-block is-solo mypage-desk">
        <AuctionTypeHead>
          <div className="auction-command">
            <nav className="ops-nav mypage-ops-nav" aria-label="My Page">
              {tabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) => `ops-nav-btn${isActive ? ' on' : ''}`}
                >
                  {tab.label}
                  {tab.badge ? <em>{tab.badge}</em> : null}
                </NavLink>
              ))}
            </nav>
            <div className="ops-nav-actions">
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
          </div>
        </AuctionTypeHead>
        <div className="mypage-body">
          <Outlet />
        </div>
      </section>
    </div>
  )
}
