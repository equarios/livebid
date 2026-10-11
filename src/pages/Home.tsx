import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { groupLotsByType, isSealedLot, listPath } from '../lib/auctionLists'
import { usd } from '../lib/format'
import { lotThumb, photoFallback } from '../lib/photos'
import { DEFAULT_SETTINGS } from '../data'
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

const HERO_PHOTO =
  'https://images.unsplash.com/photo-1556656793-08538906a9f8?auto=format&fit=crop&w=2000&q=72'

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
          {lot.qty} {lot.qty === 1 ? 'Unit' : 'Units'} of {lot.manufacturer} {lot.model} {lot.capacity} · Grade{' '}
          {lot.grade}
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

/** Wholesale hub — B2B workspace (auctions, marketplace, account). */
export function Home() {
  const { lots, user, settings } = useStore()
  const now = useNow()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const q = (params.get('q') || '').trim().toLowerCase()
  const pages = {
    ...DEFAULT_SETTINGS.pages,
    ...settings.pages,
    wholesaleHeroes: settings.pages?.wholesaleHeroes?.length
      ? settings.pages.wholesaleHeroes
      : DEFAULT_SETTINGS.pages.wholesaleHeroes,
    wholesaleHowSteps: settings.pages?.wholesaleHowSteps?.length
      ? settings.pages.wholesaleHowSteps
      : DEFAULT_SETTINGS.pages.wholesaleHowSteps,
    wholesaleTrust: settings.pages?.wholesaleTrust?.length
      ? settings.pages.wholesaleTrust
      : DEFAULT_SETTINGS.pages.wholesaleTrust,
  }
  const hero = pages.wholesaleHeroes[0]
  const brand = settings.brandName || 'eQuarios'

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
      navigate(user ? '/account' : '/register', { state: { from: '/auctions' } })
      return
    }
    if (user) navigate(path)
    else navigate('/login', { state: { from: path } })
  }

  return (
    <PublicShell mode="wholesale">
      <section className="land-hero wholesale-hero" aria-label={`${brand} wholesale`}>
        <div className="land-hero-media" aria-hidden>
          <div className="land-hero-photo" style={{ backgroundImage: `url(${HERO_PHOTO})` }} />
          <div className="land-hero-veil is-wholesale" />
          <div className="land-hero-grain" />
        </div>
        <div className="land-hero-copy">
          <p className="land-hero-brand">{brand}</p>
          <h1>{hero.title}</h1>
          <p className="land-hero-lead">{hero.body}</p>
          <div className="land-hero-cta">
            <button type="button" className="pub-btn pub-btn-fill" onClick={() => go(hero.to)}>
              {hero.cta}
            </button>
            <button type="button" className="land-hero-secondary" onClick={() => go('/register')}>
              Apply as buyer →
            </button>
          </div>
        </div>
      </section>

      <section className="how-strip">
        <h2>{pages.wholesaleHowTitle}</h2>
        <ol>
          {pages.wholesaleHowSteps.map((step, i) => (
            <li key={step.title}>
              <span className="how-step-n" aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
              <strong>{step.title}</strong>
              <span>{step.body}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="trust-strip" aria-label="Trust">
        {pages.wholesaleTrust.map((item) => (
          <p key={item.title}>
            <strong>{item.title}</strong>
            {item.body}
          </p>
        ))}
      </section>

      <section className="pub-section">
        <div className="pub-section-head">
          <h2>{q ? `Results for “${params.get('q')}”` : pages.wholesaleDealsTitle}</h2>
          <button type="button" className="linkish" onClick={() => go('/auctions')}>
            View all
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
              <div className="deal-grid">
                {group.lots.map((lot) => (
                  <DealCard
                    key={lot.id}
                    lot={lot}
                    showPrice={Boolean(user)}
                    hideHigh={isSealedLot(lot, settings)}
                    onOpen={() => go(listPath(lot.auctionType || group.value))}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="muted">{pages.wholesaleEmptyDeals}</p>
        )}
      </section>

      {settings.showMarketplace ? (
        <section className="pub-section">
          <div className="pub-section-head">
            <h2>{settings.marketplaceLabel}</h2>
            <button type="button" className="linkish" onClick={() => go('/marketplace')}>
              View all
            </button>
          </div>
          <div className="deal-grid">
            {market.map((lot) => (
              <DealCard
                key={lot.id}
                lot={lot}
                showPrice={Boolean(user)}
                onOpen={() => go('/marketplace')}
              />
            ))}
          </div>
          {!market.length ? <p className="muted">{pages.wholesaleEmptyMarket}</p> : null}
        </section>
      ) : null}

      {makers.length ? (
        <section className="pub-section">
          <div className="pub-section-head">
            <h2>{pages.wholesaleBrandsTitle}</h2>
          </div>
          <div className="brand-row">
            {makers.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => go(`/auctions?q=${encodeURIComponent(m)}`)}
              >
                {m}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="pub-split">
        <div>
          <h2>Buying on {brand}</h2>
          <p className="muted">
            Official wholesale auctions and marketplace for verified companies — phones, tablets, and
            electronics by grade and lot size.
          </p>
          <Link to="/buyers">How buying works →</Link>
        </div>
        <div>
          <h2>Selling through {brand}</h2>
          <p className="muted">
            Move returned and excess stock to approved B2B buyers. Catalog and clocks run from the ops
            desk.
          </p>
          <Link to="/sellers">For sellers →</Link>
        </div>
      </section>
    </PublicShell>
  )
}
