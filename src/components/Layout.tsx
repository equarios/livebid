import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useStore } from '../store'

export function Layout() {
  const { user, logout, lots, invoices, cart } = useStore()
  const navigate = useNavigate()
  const liveCount = lots.filter(
    (l) => l.channel === 'auction' && l.auctionType === 'live' && l.endsAt > Date.now(),
  ).length
  const unpaid = invoices.filter((i) => i.status === 'unpaid').length

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => navigate('/auctions')}>
          <span className="brand-mark">LB</span>
          LiveBid
        </button>
        <nav>
          <NavLink to="/auctions">
            Auctions
            {liveCount > 0 ? <em>{liveCount}</em> : null}
          </NavLink>
          <NavLink to="/marketplace">
            Marketplace
            {cart.length > 0 ? <em>{cart.reduce((n, c) => n + c.qty, 0)}</em> : null}
          </NavLink>
          <NavLink to="/watchlist">Watchlist</NavLink>
          <NavLink to="/invoices">
            Invoices
            {unpaid > 0 ? <em>{unpaid}</em> : null}
          </NavLink>
          <NavLink to="/account">Account</NavLink>
          {user?.accountId === 'ADMIN-0001' ? <NavLink to="/admin">Admin</NavLink> : null}
        </nav>
        <div className="topbar-user">
          <span>{user?.accountId}</span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
