import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LandHeroSlider } from '../components/LandHeroSlider'
import { PublicShell } from '../components/PublicShell'
import { groupLotsByType, isSealedLot, listPath } from '../lib/auctionLists'
import { usd } from '../lib/format'
import { lotThumb, photoFallback } from '../lib/photos'
import { DEFAULT_SETTINGS } from '../data'
import { hubConditionLinks, hubDeviceChipLinks } from '../lib/seoTaxonomy'
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
  const title = [lot.model, lot.modelNumber, lot.capacity].filter(Boolean).join(' ')
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
      </div>
      <div className="deal-card-body">
        <span className="deal-card-maker" title={lot.manufacturer}>
          {lot.manufacturer}
        </span>
        <strong>
          {lot.qty} {lot.qty === 1 ? 'unit' : 'units'} · {title} · Grade {lot.grade}
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
    wholesaleHeroes: (() => {
      const defaults = DEFAULT_SETTINGS.pages.wholesaleHeroes
      const raw =
        settings.pages?.wholesaleHeroes?.length && settings.pages.wholesaleHeroes.length >= 2
          ? settings.pages.wholesaleHeroes
          : defaults
      return raw.map((s, i) => ({
        ...s,
        imageUrl: s.imageUrl || defaults[i % defaults.length]?.imageUrl || '',
      }))
    })(),
    wholesaleHowSteps: settings.pages?.wholesaleHowSteps?.length
      ? settings.pages.wholesaleHowSteps
      : DEFAULT_SETTINGS.pages.wholesaleHowSteps,
    wholesaleTrust: settings.pages?.wholesaleTrust?.length
      ? settings.pages.wholesaleTrust
      : DEFAULT_SETTINGS.pages.wholesaleTrust,
  }
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
      navigate(user ? '/account' : '/register')
      return
    }
    if (user) {
      navigate(path)
      return
    }
    /* Guests: login only — do not put desk paths (/auctions, /marketplace) in the URL bar. */
    const desk =
      path === '/auctions' ||
      path.startsWith('/auctions') ||
      path === '/marketplace' ||
      path.startsWith('/marketplace')
    navigate('/login', desk ? undefined : { state: { from: path } })
  }

  return (
    <PublicShell mode="wholesale">
      {!q ? (
        <>
          <LandHeroSlider
            brand={brand}
            label={`${brand} wholesale`}
            veilClassName="is-wholesale"
            slides={pages.wholesaleHeroes.map((s) => ({
              title: s.title,
              body: s.body,
              cta: s.cta,
              imageUrl: s.imageUrl || '',
            }))}
            intervalSec={settings.pages?.heroIntervalSec || 7}
            primary={(slide, i) => (
              <button
                type="button"
                className="pub-btn pub-btn-fill"
                onClick={() => go(pages.wholesaleHeroes[i]?.to || '/auctions')}
              >
                {slide.cta}
              </button>
            )}
            secondary={
              <button type="button" className="land-hero-secondary" onClick={() => go('/register')}>
                Apply as buyer →
              </button>
            }
          />

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

          <section className="wholesale-cat-bar">
            <div className="pub-section-head is-rail">
              <h2>Browse by category</h2>
              <Link className="linkish" to="/wholesale/c">
                All categories
              </Link>
            </div>
            <nav className="wholesale-cat-panel" aria-label="Browse by category">
              <div className="wholesale-cat-row">
                <span className="wholesale-cat-row-label">Device</span>
                <ul className="wholesale-cat-chips">
                  {hubDeviceChipLinks().map((d) => (
                    <li key={d.id}>
                      <Link to={d.to}>{d.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="wholesale-cat-row">
                <span className="wholesale-cat-row-label">Condition</span>
                <ul className="wholesale-cat-chips">
                  {hubConditionLinks().map((c) => (
                    <li key={c.id}>
                      <Link to={c.to}>{c.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          </section>
        </>
      ) : null}

      <section className={`pub-section${q ? ' is-search-results' : ''}`}>
        <div className="pub-section-head is-rail">
          <h2>{q ? `Results for “${params.get('q')}”` : pages.wholesaleDealsTitle}</h2>
          <button type="button" className="linkish" onClick={() => go('/auctions')}>
            View all
          </button>
        </div>
        {dealGroups.length ? (
          dealGroups.map((group) => (
            <div key={group.value} className="deal-type-block">
              <div className="pub-section-head is-rail">
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
          <div className="mh-empty">
            <p>
              {q
                ? `No deals match “${params.get('q')}”. Try another model, SKU, or maker.`
                : pages.wholesaleEmptyDeals}
            </p>
          </div>
        )}
      </section>

      {settings.showMarketplace && (!q || market.length) ? (
        <section className="pub-section">
          <div className="deal-type-block">
            <div className="pub-section-head is-rail">
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
            {!market.length ? (
              <div className="mh-empty">
                <p>{pages.wholesaleEmptyMarket}</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {!q && makers.length ? (
        <section className="pub-section">
          <div className="deal-type-block">
            <div className="pub-section-head is-rail">
              <h2>{pages.wholesaleBrandsTitle}</h2>
              <button
                type="button"
                className="linkish"
                onClick={() => go('/auctions')}
              >
                View all
              </button>
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
          </div>
        </section>
      ) : null}

      {!q ? (
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
      ) : null}
    </PublicShell>
  )
}
