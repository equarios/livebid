import { NavLink, useLocation } from 'react-router-dom'
import { canUseWholesaleDesk } from '../lib/channelAccess'
import { useNow, useStore } from '../store'

/** App shell nav — wholesale desk when approved; retail members see store + My Page. */
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
  const now = useNow()
  const location = useLocation()
  const me = user?.accountId
  const deskOk = canUseWholesaleDesk(user, isStaff)
  const pendingCount = accounts.filter(
    (a) => a.status === 'pending' || a.wholesaleStatus === 'under_review' || a.wholesaleStatus === 'submitted',
  ).length
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
  const wholesaleOpen = location.pathname.startsWith('/wholesale')
  const myPage = location.pathname.startsWith('/account')

  return (
    <nav
      className="site-nav"
      onClick={() => {
        onNavigate?.()
      }}
    >
      {deskOk ? (
        <>
          <NavLink to="/wholesale" className={wholesaleOpen ? 'active' : undefined}>
            Wholesale
          </NavLink>
          {settings.showAuctions ? (
            <NavLink to="/auctions" className={auctionsOpen ? 'active' : undefined}>
              {settings.copy.navAuctions}
              {liveCount > 0 ? <em>{liveCount}</em> : null}
            </NavLink>
          ) : null}
          {settings.showMarketplace ? (
            <NavLink to="/marketplace">{settings.marketplaceLabel}</NavLink>
          ) : null}
        </>
      ) : (
        <>
          {settings.showStore ? <NavLink to="/">Store</NavLink> : null}
          <NavLink to="/account/wholesale">Apply wholesale</NavLink>
        </>
      )}
      <NavLink
        to={deskOk && cartBadge ? '/account/marketplace-history' : '/account'}
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
