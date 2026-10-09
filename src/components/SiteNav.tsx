import { NavLink, useLocation } from 'react-router-dom'
import { useNow, useStore } from '../store'

export function SiteNav({ onNavigate }: { onNavigate?: () => void }) {
  const { lots, invoices, cart, settings, isSuperAdmin, isStaff, accounts, listingDrops } = useStore()
  const now = useNow()
  const location = useLocation()
  const pendingCount = accounts.filter((a) => a.status === 'pending').length
  const payCount = invoices.filter((i) => i.status === 'pending_review' || i.status === 'draft').length
  const catalogWait = (listingDrops || []).filter((d) => d.status === 'pending').reduce((n, d) => n + d.items.length, 0)
  const liveCount = lots.filter((l) => l.channel === 'auction' && l.endsAt > now).length
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
        <NavLink to="/marketplace">
          {settings.marketplaceLabel}
          {cart.length > 0 ? <em>{cart.reduce((n, c) => n + c.qty, 0)}</em> : null}
        </NavLink>
      ) : null}
      <NavLink to="/account" className={myPage ? 'active' : undefined}>
        {settings.copy.navAccount}
      </NavLink>
      {isStaff ? (
        <NavLink to="/admin" end>
          {settings.copy.navAdmin}
        </NavLink>
      ) : null}
      {isSuperAdmin ? (
        <NavLink to={payCount > 0 ? '/super?tab=payments' : '/super'}>
          {settings.copy.navSuper}
          {payCount + pendingCount + catalogWait > 0 ? <em>{payCount + pendingCount + catalogWait}</em> : null}
        </NavLink>
      ) : null}
    </nav>
  )
}
