import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LandHeroSlider } from '../components/LandHeroSlider'
import { PublicShell } from '../components/PublicShell'
import { SeoHead } from '../components/SeoHead'
import { TimeLeft } from '../components/TimeLeft'
import { WholesaleDeskPulseBar } from '../components/WholesaleDeskPulseBar'
import { WholesaleOnboardChecklist } from '../components/WholesaleOnboardChecklist'
import {
  effectiveEndsAt,
  hideAuctionHigh,
  isInExtraSealed,
  listPath,
  migrateLotAuctionType,
} from '../lib/auctionLists'
import { usd } from '../lib/format'
import { lotItemSub, lotModelTitle } from '../lib/itemLine'
import { lotThumb, photoFallback } from '../lib/photos'
import { DEFAULT_SETTINGS } from '../data'
import { useNow, useStore } from '../store'
import { MAX_LANDER_HERO_SLIDES, type Lot, type SiteSettings } from '../types'

function closesLabel(endsAt: number, now: number) {
  const ms = endsAt - now
  if (ms <= 0) return 'Closed'
  const m = Math.floor(ms / 60000)
  if (m < 60) return `Closes in ${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return `Closes in ${h}h ${m % 60}m`
  return `Closes in ${Math.floor(h / 24)}d`
}

function auctionTypeBadge(lot: Lot, settings: SiteSettings, now: number) {
  if (isInExtraSealed(lot, now)) return 'Sealed'
  const kind = migrateLotAuctionType(lot.auctionType)
  return settings.auctionTypes.find((t) => t.value === kind)?.label || 'Auction'
}

function DealCard({
  lot,
  onOpen,
  showPrice,
  hideHigh,
  typeBadge,
}: {
  lot: Lot
  onOpen: () => void
  showPrice: boolean
  hideHigh?: boolean
  /** Auction type / Sealed — omit for marketplace. */
  typeBadge?: string
}) {
  const now = useNow()
  const title = lotModelTitle(lot)
  const closeAt = lot.channel === 'auction' ? effectiveEndsAt(lot) : lot.endsAt
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
        {typeBadge ? <em className="deal-card-type">{typeBadge}</em> : null}
      </div>
      <div className="deal-card-body">
        <span className="deal-card-maker" title={lot.manufacturer}>
          {lot.manufacturer}
        </span>
        <strong>{title}</strong>
        <span className="deal-card-meta">
          {lot.qty.toLocaleString()} {lot.qty === 1 ? 'unit' : 'units'} · {lotItemSub(lot)} · Grade {lot.grade}
        </span>
        {lot.channel === 'auction' ? (
          <span className="deal-card-meta">{closesLabel(closeAt, now)}</span>
        ) : (
          <span className="deal-card-meta">Marketplace</span>
        )}
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
  const withBrand = (template: string) => template.replace(/\{brand\}/gi, brand)
  const seoTitle = withBrand(pages.wholesaleSeoTitle || DEFAULT_SETTINGS.pages.wholesaleSeoTitle)
  const seoDescription = withBrand(
    pages.wholesaleSeoDescription || DEFAULT_SETTINGS.pages.wholesaleSeoDescription,
  )

  /** Open auctions, closing soon first. */
  const openAuctions = useMemo(() => {
    return lots
      .filter((l) => l.channel === 'auction' && effectiveEndsAt(l) > now)
      .filter((l) => {
        if (!q) return true
        const hay = `${l.manufacturer} ${l.model} ${l.modelNumber} ${l.capacity} ${l.color}`.toLowerCase()
        return hay.includes(q)
      })
      .slice()
      .sort((a, b) => effectiveEndsAt(a) - effectiveEndsAt(b))
  }, [lots, q, now])
  /**
   * Ending soon = one card per auction type: total pcs/lots + brands + next close
   * (desk summary, not per-device chips).
   */
  const endingSoonDesks = useMemo(() => {
    if (q || !openAuctions.length) return []
    const typeOrder = settings.auctionTypes.map((t) => t.value)
    type Desk = {
      value: string
      label: string
      pcs: number
      lots: number
      brands: Set<string>
      nextLot: Lot
      nextCloseAt: number
    }
    const map = new Map<string, Desk>()
    for (const lot of openAuctions) {
      const value = migrateLotAuctionType(lot.auctionType)
      const closeAt = effectiveEndsAt(lot)
      const brand = (lot.manufacturer || '').trim()
      const cur = map.get(value)
      if (!cur) {
        map.set(value, {
          value,
          label: settings.auctionTypes.find((t) => t.value === value)?.label || value,
          pcs: Math.max(0, lot.qty || 0),
          lots: 1,
          brands: new Set(brand ? [brand] : []),
          nextLot: lot,
          nextCloseAt: closeAt,
        })
        continue
      }
      cur.pcs += Math.max(0, lot.qty || 0)
      cur.lots += 1
      if (brand) cur.brands.add(brand)
      if (closeAt < cur.nextCloseAt) {
        cur.nextLot = lot
        cur.nextCloseAt = closeAt
      }
    }
    return [...map.values()]
      .map((d) => ({
        ...d,
        brandList: [...d.brands].sort(),
      }))
      .sort((a, b) => {
        const byClose = a.nextCloseAt - b.nextCloseAt
        if (byClose !== 0) return byClose
        const ia = typeOrder.indexOf(a.value)
        const ib = typeOrder.indexOf(b.value)
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
      })
  }, [openAuctions, q, settings.auctionTypes])
  const seoJsonLd = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: seoTitle,
      description: seoDescription,
      url: '/wholesale',
      isPartOf: { '@type': 'WebSite', name: brand },
      mainEntity: {
        '@type': 'ItemList',
        name: 'Open auction desks',
        numberOfItems: endingSoonDesks.length,
        itemListElement: endingSoonDesks.map((desk, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: desk.label,
          description: `${desk.pcs.toLocaleString()} pcs · ${desk.lots} lots`,
          url: listPath(desk.value),
        })),
      },
    }),
    [brand, seoTitle, seoDescription, endingSoonDesks],
  )
  const auctionDeals = openAuctions.slice(0, 12)
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
  const showMarketBlock = settings.showMarketplace && (!q || market.length > 0)
  const deskEmpty = !auctionDeals.length && !market.length

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
      <SeoHead
        title={seoTitle}
        description={seoDescription}
        path="/wholesale"
        noindex={Boolean(q)}
        jsonLd={seoJsonLd}
      />
      {/* Hero → ending soon → auctions/market desk → How/Trust. */}
      {!q ? (
        <>
          <LandHeroSlider
            brand={brand}
            label={`${brand} wholesale`}
            veilClassName="is-wholesale"
            slides={pages.wholesaleHeroes.slice(0, MAX_LANDER_HERO_SLIDES).map((s) => ({
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
            secondary={null}
          />
          <p className="muted tiny wholesale-we-buy-note">
            We also buy bulk inventory —{' '}
            <Link to="/sellers#sell-to-us">sell to us</Link>.
          </p>
        </>
      ) : null}

      {!q && user ? <WholesaleDeskPulseBar /> : null}
      {!q && user ? (
        <WholesaleOnboardChecklist forceOpen={params.get('onboard') === '1'} />
      ) : null}

      <div className={`wholesale-desk-band${q ? ' is-search' : ''}`}>
        {deskEmpty ? (
          <section className="pub-section">
            <div className="mh-empty wholesale-desk-empty">
              <p>
                {q
                  ? `No deals match “${params.get('q')}”. Try another model, SKU, or maker.`
                  : pages.wholesaleEmptyHub}
              </p>
              <div className="wholesale-desk-empty-actions">
                {settings.showMarketplace ? (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => go('/marketplace')}>
                    {pages.wholesaleBrowseMarketCta}
                  </button>
                ) : null}
                <button type="button" className="btn btn-sm" onClick={() => go('/auctions')}>
                  {pages.wholesaleOpenAuctionsCta}
                </button>
              </div>
            </div>
          </section>
        ) : (
          <>
            {!q && endingSoonDesks.length ? (
              <section
                id="wholesale-ending-soon"
                className="pub-section wholesale-ending-soon"
              >
                <div className="pub-section-head is-rail">
                  <h2>{pages.wholesaleEndingSoonTitle}</h2>
                  <button type="button" className="linkish" onClick={() => go('/auctions')}>
                    {pages.wholesaleEndingSoonViewAll}
                  </button>
                </div>
                <div className="ending-soon-row" aria-label="Auction desks ending soon">
                  {endingSoonDesks.map((desk) => {
                    const lot = desk.nextLot
                    const n = desk.brandList.length
                    const samples = desk.brandList.slice(0, 3)
                    const brandCount =
                      n === 0 ? 'No brands yet' : `${n.toLocaleString()} brand${n === 1 ? '' : 's'}`
                    const brandSamples =
                      n === 0
                        ? ''
                        : n <= 3
                          ? samples.join(' · ')
                          : `incl. ${samples.join(', ')} +${n - 3} more`
                    return (
                      <button
                        key={desk.value}
                        type="button"
                        className="ending-soon-chip is-desk"
                        onClick={() => go(listPath(desk.value))}
                        title={`${desk.label}: ${desk.pcs.toLocaleString()} pcs · ${brandCount}${n ? ` (${desk.brandList.join(', ')})` : ''}`}
                      >
                        <img
                          src={lotThumb(lot)}
                          alt=""
                          onError={(e) => {
                            e.currentTarget.onerror = null
                            e.currentTarget.src = photoFallback(lot)
                          }}
                        />
                        <span className="ending-soon-copy">
                          <span className="ending-soon-type">{desk.label}</span>
                          <strong>
                            {desk.pcs.toLocaleString()} pcs · {desk.lots}{' '}
                            {desk.lots === 1 ? 'lot' : 'lots'}
                          </strong>
                          <span className="ending-soon-stats">
                            <span className="ending-soon-brand-count">{brandCount}</span>
                            {brandSamples ? (
                              <span className="ending-soon-brand-samples">{brandSamples}</span>
                            ) : null}
                          </span>
                          <span className="ending-soon-foot">
                            <span className="ending-soon-clock">
                              <TimeLeft endsAt={desk.nextCloseAt} warn />
                            </span>
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {auctionDeals.length ? (
              <section className={`pub-section${q ? ' is-search-results' : ''}`}>
                <div className="deal-type-block">
                  <div className="pub-section-head is-rail">
                    <h2>{q ? `Results for “${params.get('q')}”` : pages.wholesaleDealsTitle}</h2>
                    <button type="button" className="linkish" onClick={() => go('/auctions')}>
                      {pages.wholesaleViewAllAuctions}
                    </button>
                  </div>
                  <div className="deal-grid" aria-label="Open auctions">
                    {auctionDeals.map((lot) => (
                      <DealCard
                        key={lot.id}
                        lot={lot}
                        showPrice={Boolean(user)}
                        hideHigh={hideAuctionHigh(lot, settings)}
                        typeBadge={auctionTypeBadge(lot, settings, now)}
                        onOpen={() => go(listPath(migrateLotAuctionType(lot.auctionType)))}
                      />
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {showMarketBlock ? (
              <section className="pub-section">
                <div className="deal-type-block">
                  <div className="pub-section-head is-rail">
                    <h2>{settings.marketplaceLabel}</h2>
                    <button type="button" className="linkish" onClick={() => go('/marketplace')}>
                      {pages.wholesaleViewAllMarket}
                    </button>
                  </div>
                  {market.length ? (
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
                  ) : (
                    <div className="mh-empty">
                      <p>{pages.wholesaleEmptyMarket}</p>
                    </div>
                  )}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>

      {!q ? (
        <section className="wholesale-info-strip" aria-label="How it works">
          <div className="wholesale-info-inner">
            <div className="wholesale-info-how">
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
            </div>
            <ul className="wholesale-info-trust">
              {pages.wholesaleTrust.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </PublicShell>
  )
}
