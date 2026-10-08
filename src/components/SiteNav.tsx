import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useStore } from '../store'

export function SiteNav({ onNavigate }: { onNavigate?: () => void }) {
  const { lots, invoices, cart, settings, isSuperAdmin, isStaff, accounts } = useStore()
  const location = useLocation()
  const [helpOpen, setHelpOpen] = useState(false)
  const pendingCount = accounts.filter((a) => a.status === 'pending').length
  const payCount = invoices.filter((i) => i.status === 'pending_review').length
  const liveCount = lots.filter((l) => l.channel === 'auction' && l.endsAt > Date.now()).length
  const auctionsOpen = location.pathname.startsWith('/auctions')
  const myPage = location.pathname.startsWith('/account')
  const helpOn = ['/device-spec', '/info', '/tutorial'].includes(location.pathname)

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
      <div className={`help-menu ${helpOpen ? 'open' : ''}`}>
        <button
          type="button"
          className={`help-menu-btn ${helpOn ? 'active' : ''}`}
          aria-expanded={helpOpen}
          onClick={(e) => {
            e.stopPropagation()
            setHelpOpen((v) => !v)
          }}
        >
          Help
          <span aria-hidden>▾</span>
        </button>
        {helpOpen ? (
          <div className="help-menu-panel" onClick={() => setHelpOpen(false)}>
            <NavLink to="/device-spec">Device spec</NavLink>
            <NavLink to="/info">Info</NavLink>
            <NavLink to="/tutorial">Tutorial</NavLink>
          </div>
        ) : null}
      </div>
      {isStaff ? (
        <NavLink to="/admin">
          {settings.copy.navAdmin}
          {payCount > 0 ? <em>{payCount}</em> : null}
        </NavLink>
      ) : null}
      {isSuperAdmin ? (
        <NavLink to="/super">
          {settings.copy.navSuper}
          {payCount + pendingCount > 0 ? <em>{payCount + pendingCount}</em> : null}
        </NavLink>
      ) : null}
    </nav>
  )
}
