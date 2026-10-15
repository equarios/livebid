import { useNavigate } from 'react-router-dom'
import { WholesaleDeskPulseBar } from '../components/WholesaleDeskPulseBar'
import { WholesaleOnboardChecklist } from '../components/WholesaleOnboardChecklist'
import { WholesaleStatusCard } from '../components/WholesaleStatusCard'
import { canUseWholesaleDesk } from '../lib/channelAccess'
import { usd } from '../lib/format'
import { invoiceTotals, invoiceVisibleToBuyer } from '../lib/invoices'
import { useNow, useStore } from '../store'

const WS_LABEL: Record<string, string> = {
  none: 'Not applied',
  submitted: 'Submitted',
  needs_docs: 'Needs documents',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Not approved',
}

type Card = {
  id: string
  to: string
  title: string
  count: number
  hint: string
  tone?: 'urgent' | 'open' | 'muted'
}

export function AccountOverview() {
  const navigate = useNavigate()
  const now = useNow()
  const { user, isStaff, notices, invoices, cart, cartOrders, watchlist, settings, lots, bids } =
    useStore()
  if (!user) return null

  const wholesaleOk = canUseWholesaleDesk(user, isStaff)
  const ws = user.wholesaleStatus || 'none'
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.company || 'there'
  const myNotices = notices.filter((n) => n.accountId === user.accountId && !n.read).length

  const mine = invoices.filter(
    (i) => invoiceVisibleToBuyer(i) && (isStaff || !i.accountId || i.accountId === user.accountId),
  )
  const unpaid = mine.filter((i) => i.status !== 'paid' && !i.shippedAt)
  const due = unpaid.reduce((n, i) => n + invoiceTotals(i, settings).total, 0)
  const openCart = (cartOrders || []).filter(
    (o) =>
      o.accountId === user.accountId &&
      (o.status === 'pending' || o.status === 'accepted'),
  ).length
  const cartCount = cart.length + openCart
  const liveLots = lots.filter((l) => l.channel === 'auction' && l.endsAt > now).length
  const myBidLots = new Set(
    bids.filter((b) => b.accountId === user.accountId).map((b) => b.lotId),
  ).size

  const cards: Card[] = wholesaleOk
    ? [
        {
          id: 'cart',
          to: '/account/marketplace-history#cart',
          title: 'Marketplace cart',
          count: cartCount,
          hint: cartCount ? 'Review and send for approval' : 'Empty — shop Marketplace',
          tone: cartCount ? 'urgent' : 'muted',
        },
        {
          id: 'invoices',
          to: '/account/invoices',
          title: 'Unpaid invoices',
          count: unpaid.length,
          hint: due > 0 ? `Due ${usd(due)}` : 'Nothing waiting',
          tone: unpaid.length ? 'urgent' : 'muted',
        },
        {
          id: 'favs',
          to: '/account/favourites',
          title: 'Favorites',
          count: watchlist.length,
          hint: 'Watchlist lots',
          tone: watchlist.length ? 'open' : 'muted',
        },
        {
          id: 'bids',
          to: '/account/bids',
          title: 'Bid history',
          count: myBidLots,
          hint: 'Lots you have bid on',
          tone: myBidLots ? 'open' : 'muted',
        },
        {
          id: 'live',
          to: '/auctions',
          title: 'Live auctions',
          count: liveLots,
          hint: 'Open lots to bid',
          tone: liveLots ? 'open' : 'muted',
        },
        {
          id: 'notices',
          to: '/account',
          title: 'Unread notices',
          count: myNotices,
          hint: myNotices ? 'Check the bell for details' : 'All caught up',
          tone: myNotices ? 'open' : 'muted',
        },
        {
          id: 'docs',
          to: '/account/documents',
          title: 'Documents',
          count: 0,
          hint: 'Tax / resale files',
          tone: 'muted',
        },
        {
          id: 'imei',
          to: '/account/imei',
          title: 'IMEI packs',
          count: 0,
          hint: 'Search unlock codes',
          tone: 'muted',
        },
      ]
    : [
        {
          id: 'wholesale',
          to: '/account/wholesale',
          title: 'Wholesale application',
          count: ws === 'none' ? 1 : 0,
          hint: WS_LABEL[ws] || ws,
          tone: ws === 'none' || ws === 'needs_docs' ? 'urgent' : ws === 'approved' ? 'muted' : 'open',
        },
        {
          id: 'docs',
          to: '/account/documents',
          title: 'Documents',
          count: 0,
          hint: 'Upload for review',
          tone: ws === 'needs_docs' ? 'urgent' : 'muted',
        },
        {
          id: 'notices',
          to: '/account',
          title: 'Unread notices',
          count: myNotices,
          hint: myNotices ? 'Check the bell for details' : 'All caught up',
          tone: myNotices ? 'open' : 'muted',
        },
        {
          id: 'settings',
          to: '/account/settings',
          title: 'Settings',
          count: 0,
          hint: 'Profile & email',
          tone: 'muted',
        },
      ]

  if (wholesaleOk && settings.showCommunity !== false) {
    cards.splice(5, 0, {
      id: 'community',
      to: '/account/community',
      title: 'Community',
      count: 0,
      hint: 'Peer board',
      tone: 'muted',
    })
  }

  const waiting = cards.filter((c) => c.tone === 'urgent' || (c.count > 0 && c.tone === 'open'))

  return (
    <div className="ops-today account-overview mypage-overview">
      {!wholesaleOk ? <WholesaleStatusCard /> : <WholesaleDeskPulseBar hideWhenEmpty />}
      {wholesaleOk ? <WholesaleOnboardChecklist /> : null}
      <header className="ops-today-head">
        <h2>Today</h2>
        <p className="muted tiny">
          Hi, {displayName}
          {user.company ? ` · ${user.company}` : ''}
          {waiting.length
            ? ` · ${waiting.length} queue${waiting.length === 1 ? '' : 's'} need attention.`
            : wholesaleOk
              ? ' · Nothing waiting — open Bids, Marketplace, or Invoice from the bar above.'
              : ` · Wholesale: ${WS_LABEL[ws] || ws}. Continue from the status card above.`}
        </p>
      </header>
      <div className="ops-today-grid mypage-overview-grid">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`ops-today-card mypage-queue-card is-${card.tone || 'muted'}`}
            onClick={() => {
              if (card.id === 'notices') {
                const bell = document.querySelector<HTMLButtonElement>('.notice-bell')
                bell?.click()
                return
              }
              navigate(card.to)
            }}
          >
            <span className="ops-today-count">{card.count}</span>
            <span className="ops-today-title">{card.title}</span>
            <span className="muted tiny">{card.hint}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
