import { Link, NavLink, Outlet } from 'react-router-dom'
import { RecentLots } from '../components/RecentLots'
import { usd } from '../lib/format'
import { invoiceDueLabel, invoiceTotals, invoiceVisibleToBuyer } from '../lib/invoices'
import { useNow, useStore } from '../store'

const TABS = [
  { to: '/account', label: 'Bid History', end: true },
  { to: '/account/marketplace-history', label: 'Marketplace History' },
  { to: '/account/settings', label: 'Account Settings' },
  { to: '/account/favourites', label: 'Favorites' },
  { to: '/account/invoices', label: 'Invoice' },
  { to: '/account/complaint', label: 'Complaint' },
] as const

export function MyPage() {
  const now = useNow()
  const { lots, invoices, user, isStaff, settings } = useStore()
  const live = lots.filter((l) => l.channel === 'auction' && l.endsAt > now).length
  const mine = invoices.filter(
    (i) => invoiceVisibleToBuyer(i) && (isStaff || !i.accountId || i.accountId === user?.accountId),
  )
  const unpaid = mine.filter((i) => i.status !== 'paid' && !i.shippedAt)
  const due = unpaid.reduce((n, i) => n + invoiceTotals(i, settings).total, 0)
  const soonest = unpaid.map((i) => invoiceDueLabel(i, now, settings)).find((label) => label)

  return (
    <div className="mypage">
      <div className="mypage-subbar">
        <nav className="mypage-tabs" aria-label="My Page">
          {TABS.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end={'end' in tab ? tab.end : false}>
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="mypage-body">
        <div className="auction-desk-kpis">
          <div className="auction-desk-stat">
            <span className="label">Live auctions</span>
            <strong>{live}</strong>
            <Link to="/auctions">Open auction</Link>
          </div>
          <div className="auction-desk-stat">
            <span className="label">Marketplace</span>
            <strong>{lots.filter((l) => l.channel === 'marketplace').length}</strong>
            <Link to="/marketplace">Open marketplace</Link>
          </div>
          <div className="auction-desk-stat is-lose">
            <span className="label">Unpaid invoices</span>
            <strong>{usd(due)}</strong>
            <Link to="/account/invoices">Invoice</Link>
            {soonest ? <div className="muted tiny">{soonest}</div> : null}
          </div>
        </div>
        <RecentLots />
        <Outlet />
      </div>
    </div>
  )
}
