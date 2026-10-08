import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { groupLotsByType, isSealedLot, listPath } from '../lib/auctionLists'
import { usd } from '../lib/format'
import { lotThumb, photoFallback } from '../lib/photos'
import { useNow, useStore } from '../store'
import type { Lot } from '../types'

function closesLabel(endsAt: number, now: number) {
  const ms = endsAt - now
  if (ms <= 0) return 'Closed'
  const m = Math.floor(ms / 60000)
  if (m < 60) return `Closes in ${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return `Closes in ${h}h ${m % 60}m`
  return `Closes in ${Math.floor(h / 24)}d`
}

const HEROES = [
  {
    kicker: 'Live wholesale auctions',
    title: 'Source excess inventory. Bid by the piece.',
    body: 'Buy returned, overstock, and open-box lots directly from Equarios — phones, tablets, and more.',
    cta: 'Shop all listings',
    to: '/auctions',
    tone: 'hero-a',
  },
  {
    kicker: 'Buy Now marketplace',
    title: 'No bidding. Just buying.',
    body: 'Fixed wholesale prices with cart checkout. New marketplace lots drop alongside live auctions.',
    cta: 'Shop Buy Now',
    to: '/marketplace',
    tone: 'hero-b',
  },
  {
    kicker: 'Pay after you win',
    title: 'Invoices, receipts, dual approval.',
    body: 'Pay your invoice, upload the receipt, and wait for admin plus super admin to accept.',
    cta: 'Create a buyer account',
    to: '/register',
    tone: 'hero-c',
  },
]

function DealCard({
  lot,
  onOpen,
  showPrice,
  hideHigh,
}: {
  lot: Lot
  onOpen: () => void
  showPrice: boolean
  hideHigh?: boolean
}) {
  const now = useNow()
  return (
    <button type="button" className="deal-card" onClick={onOpen}>
      <div className="deal-card-img">
        <img
          src={lotThumb(lot)}
          alt=""
          onError={(e) => {
            e.currentTarget.onerror = null
            e.currentTarget.src = photoFallback(lot)
          }}
        />
        <em>{lot.manufacturer}</em>
      </div>
      <div className="deal-card-body">
        <strong>
          {lot.qty} {lot.qty === 1 ? 'Unit' : 'Units'} of {lot.manufacturer} {lot.model} {lot.capacity} · Grade {lot.grade}
        </strong>
        <span>{closesLabel(lot.endsAt, now)}</span>
        {showPrice ? (
          <span className="deal-price">
            {hideHigh ? `${usd(lot.startPrice)} start` : `${usd(lot.currentPrice)} / pc`}
          </span>
        ) : (
          <span className="deal-price is-locked">Sign in to see price</span>
        )}
      </div>
    </button>
  )
}

export function Home() {
  const { lots, user, settings } = useStore()
  const now = useNow()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const q = (params.get('q') || '').trim().toLowerCase()
  const [slide, setSlide] = useState(0)
  const hero = HEROES[slide]
  const dealGroups = useMemo(() => {
    const rows = lots
      .filter((l) => l.channel === 'auction' && l.endsAt > now)
      .filter((l) => {
        if (!q) return true
        const hay = `${l.manufacturer} ${l.model} ${l.modelNumber} ${l.capacity} ${l.color}`.toLowerCase()
        return hay.includes(q)
      })
    return groupLotsByType(rows, settings, 'close-soon').map((g) => ({
      ...g,
      lots: g.lots.slice(0, 4),
    }))
  }, [lots, q, settings, now])
  const market = useMemo(
    () =>
      lots
        .filter((l) => l.channel === 'marketplace')
        .filter((l) => {
          if (!q) return true
          const hay = `${l.manufacturer} ${l.model} ${l.modelNumber} ${l.capacity} ${l.color}`.toLowerCase()
          return hay.includes(q)
        })
        .slice(0, 7),
    [lots, q],
  )
  const makers = useMemo(() => [...new Set(lots.map((l) => l.manufacturer))], [lots])

  function go(path: string) {
    if (path === '/register') {
      navigate(user ? '/account' : '/register')
      return
    }
    if (user) navigate(path)
    else navigate('/login', { state: { from: path } })
  }

  return (
    <PublicShell>
      <section className={`pub-hero ${hero.tone}`}>
        <button type="button" className="hero-arrow" aria-label="Previous slide" onClick={() => setSlide((s) => (s + HEROES.length - 1) % HEROES.length)}>
          ‹
        </button>
        <div className="pub-hero-copy">
          <p className="kicker">{hero.kicker}</p>
          <h1>{hero.title}</h1>
          <p>{hero.body}</p>
          <button type="button" className="pub-btn pub-btn-fill" onClick={() => go(hero.to)}>
            {hero.cta}
          </button>
        </div>
        <button type="button" className="hero-arrow" aria-label="Next slide" onClick={() => setSlide((s) => (s + 1) % HEROES.length)}>
          ›
        </button>
      </section>

      <section className="how-strip">
        <h2>How Equarios works</h2>
        <ol>
          <li>
            <strong>1. Register</strong>
            <span>Use a work email. Super admin reviews your company.</span>
          </li>
          <li>
            <strong>2. Get approved</strong>
            <span>After accept, sign in to see prices, bid, and buy.</span>
          </li>
          <li>
            <strong>3. Bid or Buy Now</strong>
            <span>Live auctions fill by last bid per account. Marketplace is cart checkout.</span>
          </li>
          <li>
            <strong>4. Pay the invoice</strong>
            <span>Upload a receipt. Admin and super admin both accept before it is paid.</span>
          </li>
        </ol>
      </section>

      <section className="trust-strip">
        <p>
          <strong>Verified buyers only.</strong> Prices stay hidden until your account is accepted.
        </p>
        <p>
          <strong>Dual approval pay.</strong> Admin and Super Admin both accept before an invoice is paid.
        </p>
        <p>
          <strong>7-day invoice window.</strong> Pay in advance from the issue date. Unpaid lots can be reopened to other buyers.
        </p>
      </section>

      <section className="pub-section">
        <div className="pub-section-head">
          <h2>{q ? `Results for “${params.get('q')}”` : 'Best Deals'}</h2>
          <button type="button" className="linkish" onClick={() => go('/auctions')}>
            View All
          </button>
        </div>
        {dealGroups.length ? (
          dealGroups.map((group) => (
            <div key={group.value} className="deal-type-block">
              <div className="pub-section-head">
                <h3>{group.label}</h3>
                <button type="button" className="linkish" onClick={() => go(listPath(group.value))}>
                  View {group.label}
                </button>
              </div>
              <div className="deal-row">
                {group.lots.map((lot) => (
                  <DealCard
                    key={lot.id}
                    lot={lot}
                    showPrice={!!user}
                    hideHigh={isSealedLot(lot, settings)}
                    onOpen={() => go(`/auctions#${lot.auctionType || 'live'}`)}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="muted">No matching auction lots on this page. Sign in to search the full catalog.</p>
        )}
      </section>

      <section className="pub-section">
        <div className="pub-section-head">
          <h2>Shop by brand</h2>
        </div>
        <div className="brand-pills">
          {makers.map((m) => (
            <button key={m} type="button" onClick={() => go(`/auctions?q=${encodeURIComponent(m)}`)}>
              {m}
            </button>
          ))}
        </div>
      </section>

      <section className="pub-section">
        <div className="pub-section-head">
          <h2>Buy Now · {settings.marketplaceLabel}</h2>
          <button type="button" className="linkish" onClick={() => go('/marketplace')}>
            View All
          </button>
        </div>
        <div className="deal-row">
          {market.map((lot) => (
            <DealCard key={lot.id} lot={lot} showPrice={!!user} onOpen={() => go('/marketplace')} />
          ))}
        </div>
      </section>

      <section className="pub-split">
        <div>
          <h2>Equarios: the place to find inventory for resale</h2>
          <p className="muted">
            Buy direct through official wholesale auctions. Source phones, tablets, and electronics across grades, capacities, and lot sizes.
          </p>
          <Link to="/buyers">How buying works →</Link>
        </div>
        <div>
          <h2>Selling through Equarios</h2>
          <p className="muted">
            Move returned and excess stock to verified B2B buyers. Listing duration can be as short as one minute for live demo lots.
          </p>
          <Link to="/sellers">For sellers →</Link>
        </div>
      </section>
    </PublicShell>
  )
}
