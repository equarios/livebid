import { NavLink, useLocation } from 'react-router-dom'
import { useNow, useStore } from '../store'

export function SiteNav({ onNavigate }: { onNavigate?: () => void }) {
  const {
    lots,
    invoices,
    cart,
    cartOrders,
    settings,
    isSuperAdmin,
    isStaff,
    accounts,
    listingDrops,
    user,
  } = useStore()
  // Coarse clock (15s) — live badge does not need 1Hz nav re-renders.
  const now = useNow()
  const location = useLocation()
  const me = user?.accountId
  const pendingCount = accounts.filter((a) => a.status === 'pending').length
  const payCount = invoices.filter((i) => i.status === 'pending_review' || i.status === 'draft').length
  const catalogWait = (listingDrops || []).filter((d) => d.status === 'pending').reduce((n, d) => n + d.items.length, 0)
  const liveCount = lots.filter((l) => l.channel === 'auction' && l.endsAt > now).length
  const cartBadge =
    cart.reduce((n, c) => n + c.qty, 0) +
    (cartOrders || [])
      .filter(
        (o) =>
          (!me || o.accountId === me) &&
          (o.status === 'pending' || o.status === 'accepted'),
      )
      .reduce((n, o) => n + o.lines.reduce((s, l) => s + l.qty, 0), 0)
  const auctionsOpen = location.pathname.startsWith('/auctions')
  const myPage = location.pathname.startsWith('/account')

  return (
    <nav
      className="site-nav"
      onClick={() => {
        onNavigate?.()
      }}
    >
      {settings.showAuctions ? (
        <NavLink to="/auctions" className={auctionsOpen ? 'active' : undefined}>
          {settings.copy.navAuctions}
          {liveCount > 0 ? <em>{liveCount}</em> : null}
        </NavLink>
      ) : null}
      {settings.showMarketplace ? (
        <NavLink to="/marketplace">{settings.marketplaceLabel}</NavLink>
      ) : null}
      <NavLink
        to={cartBadge ? '/account/marketplace-history' : '/account'}
        className={myPage ? 'active' : undefined}
      >
        {settings.copy.navAccount}
        {cartBadge > 0 ? <em>{cartBadge}</em> : null}
      </NavLink>
      {isStaff ? (
        <NavLink to="/admin" end>
          {settings.copy.navAdmin}
        </NavLink>
      ) : null}
      {isSuperAdmin ? (
        <NavLink to="/super">
          {settings.copy.navSuper}
          {pendingCount + payCount + catalogWait > 0 ? (
            <em>{pendingCount + payCount + catalogWait}</em>
          ) : null}
        </NavLink>
      ) : null}
    </nav>
  )
}
