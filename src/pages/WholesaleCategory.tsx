import { useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { SeoHead } from '../components/SeoHead'
import { useLotPreview } from '../components/LotPreview'
import { canUseWholesaleDesk } from '../lib/channelAccess'
import { listPath } from '../lib/auctionLists'
import { usd } from '../lib/format'
import { lotItemSub, lotItemTitle } from '../lib/itemLine'
import { lotThumb, photoFallback } from '../lib/photos'
import {
  CONDITIONS,
  DEVICE_CLASSES,
  SEO_BRANDS,
  brandLabel,
  categoryPath,
  conditionLabel,
  deviceClassLabel,
  facetDescription,
  facetTitle,
  hubConditionLinks,
  hubDeviceLinks,
  lotMatchesFacet,
  parseCategoryParams,
  type SeoFacet,
} from '../lib/seoTaxonomy'
import {
  isWatchingFilter,
  removeWatchFilter,
  upsertWatchFilter,
} from '../lib/watchFilters'
import { useNow, useStore } from '../store'
import type { Lot } from '../types'

function crumbs(facet: SeoFacet) {
  const rows: { label: string; to: string }[] = [
    { label: 'Wholesale', to: '/wholesale' },
    { label: 'Categories', to: '/wholesale/c' },
  ]
  if (facet.deviceClass) {
    rows.push({
      label: deviceClassLabel(facet.deviceClass),
      to: categoryPath({ deviceClass: facet.deviceClass }),
    })
  }
  if (facet.condition && facet.deviceClass) {
    rows.push({
      label: conditionLabel(facet.condition),
      to: categoryPath({ deviceClass: facet.deviceClass, condition: facet.condition }),
    })
  }
  if (facet.brand && facet.deviceClass) {
    rows.push({
      label: brandLabel(facet.brand),
      to: categoryPath({
        deviceClass: facet.deviceClass,
        condition: facet.condition,
        brand: facet.brand,
      }),
    })
  }
  return rows
}

export function WholesaleCategoryPage() {
  const { a, b, c } = useParams()
  const location = useLocation()
  const parts = [a, b, c].filter((p): p is string => Boolean(p))
  const facet = parseCategoryParams(parts)
  if (facet === null) return <Navigate to="/wholesale/c" replace />

  const isHub = !facet.deviceClass
  return isHub ? (
    <CategoryHub key={location.pathname} />
  ) : (
    <CategoryDetail key={location.pathname} facet={facet} />
  )
}

function CategoryHub() {
  const { settings } = useStore()
  const brand = settings.brandName || 'Equarios'
  const title = `${brand} | Wholesale devices worldwide — phones, tablets, PCs, consoles`
  const description = facetDescription({}, brand)
  const devices = hubDeviceLinks()
  const conditions = CONDITIONS

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    isPartOf: { '@type': 'WebSite', name: brand },
    about: devices.map((d) => ({ '@type': 'Thing', name: d.label })),
  }

  return (
    <PublicShell mode="wholesale">
      <SeoHead title={title} description={description} path="/wholesale/c" jsonLd={jsonLd} />
      <article className="seo-cat">
        <header className="seo-cat-hero">
          <p className="seo-cat-kicker">{brand} wholesale desk</p>
          <h1>Buy &amp; sell devices worldwide</h1>
          <p className="seo-cat-lead">
            New, used, locked, unlocked, refurbished, recycled, and scrap — mobile phones (Apple,
            Android, other OS), tablets &amp; iPads, PCs, laptops, Chromebooks, PlayStation, Xbox,
            Nintendo, and more. B2B auctions and marketplace for verified buyers.
          </p>
          <div className="seo-cat-cta">
            <Link className="pub-btn pub-btn-fill" to="/register">
              Apply as buyer
            </Link>
            <Link className="pub-btn" to="/buyers">
              How wholesale works
            </Link>
          </div>
        </header>

        <section className="seo-cat-section">
          <h2>Shop by device</h2>
          <ul className="seo-cat-grid">
            {devices.map((d) => (
              <li key={d.id}>
                <Link to={d.to}>{d.label}</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="seo-cat-section">
          <h2>Shop by condition</h2>
          <ul className="seo-cat-chips">
            {conditions.map((id) => (
              <li key={id}>
                <Link to={categoryPath({ deviceClass: 'phones', condition: id })}>
                  {conditionLabel(id)}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="seo-cat-section">
          <h2>Popular brands</h2>
          <ul className="seo-cat-chips">
            {SEO_BRANDS.slice(0, 12).map((id) => (
              <li key={id}>
                <Link to={categoryPath({ deviceClass: 'phones', brand: id })}>{brandLabel(id)}</Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </PublicShell>
  )
}

function SeoLotRow({
  lot,
  deskOk,
  showPrice,
}: {
  lot: Lot
  deskOk: boolean
  showPrice: boolean
}) {
  const navigate = useNavigate()
  const { openLot: openLotPreview } = useLotPreview()
  const title = lotItemTitle(lot)

  function onOpen() {
    if (deskOk) {
      openLotPreview(lot.id)
      return
    }
    navigate('/login', { state: { from: listPath(lot.auctionType || 'live') } })
  }

  return (
    <button
      type="button"
      className="seo-lot-row"
      onClick={onOpen}
      aria-label={`${deskOk ? 'Quick view' : 'Sign in to view'} ${title}`}
    >
      <span className="seo-lot-thumb has-quick-view">
        <img
          src={lotThumb(lot)}
          alt=""
          onError={(e) => {
            e.currentTarget.onerror = null
            e.currentTarget.src = photoFallback(lot)
          }}
        />
        <span className="quick-view-hint" aria-hidden>
          {deskOk ? 'Quick view' : 'Sign in'}
        </span>
      </span>
      <span className="seo-lot-copy">
        <strong>{title}</strong>
        <span className="muted tiny">
          {lotItemSub(lot)} · Grade {lot.grade}
        </span>
        <span className="item-details-cue">{deskOk ? 'Details' : 'Sign in for details'}</span>
      </span>
      <span className="seo-lot-price">
        {showPrice ? `${usd(lot.currentPrice)} / pc` : 'Sign in for price'}
      </span>
    </button>
  )
}

function CategoryDetail({ facet }: { facet: SeoFacet }) {
  const { lots, settings, user, isStaff } = useStore()
  const now = useNow()
  const brand = settings.brandName || 'Equarios'
  const topic = facetTitle(facet)
  const title = `${topic} wholesale | ${brand}`
  const description = facetDescription(facet, brand)
  const path = categoryPath(facet)
  const deskOk = canUseWholesaleDesk(user, isStaff)
  const watchFacet: SeoFacet = {
    deviceClass: facet.deviceClass,
    condition: facet.condition,
  }
  const [watching, setWatching] = useState(() =>
    user ? isWatchingFilter(user.accountId, watchFacet) : false,
  )

  const matched = useMemo(() => {
    const seen = new Set<string>()
    return lots
      .filter((l) => l.endsAt > now || l.channel === 'marketplace')
      .filter((l) => lotMatchesFacet(l, facet))
      .filter((l) => {
        if (seen.has(l.id)) return false
        seen.add(l.id)
        return true
      })
      .slice(0, 24)
  }, [lots, facet, now])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: path,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: matched.length,
      itemListElement: matched.slice(0, 12).map((lot, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: lotItemTitle(lot),
      })),
    },
  }

  return (
    <PublicShell mode="wholesale">
      <SeoHead title={title} description={description} path={path} jsonLd={jsonLd} />
      <article className="seo-cat">
        <nav className="seo-cat-crumbs" aria-label="Breadcrumb">
          {crumbs(facet).map((c, i, arr) => (
            <span key={c.to}>
              {i > 0 ? <span className="seo-cat-crumbs-sep">/</span> : null}
              {i === arr.length - 1 ? <span>{c.label}</span> : <Link to={c.to}>{c.label}</Link>}
            </span>
          ))}
        </nav>

        <header className="seo-cat-hero is-compact">
          <h1>{topic}</h1>
          <p className="seo-cat-lead">{description}</p>
          <div className="seo-cat-cta">
            {deskOk ? (
              <Link className="pub-btn pub-btn-fill" to="/auctions">
                Open auctions
              </Link>
            ) : (
              <Link className="pub-btn pub-btn-fill" to="/register">
                Apply as buyer
              </Link>
            )}
            {user && facet.deviceClass ? (
              <button
                type="button"
                className="pub-btn"
                onClick={() => {
                  if (watching) {
                    removeWatchFilter(user.accountId, categoryPath(watchFacet))
                    setWatching(false)
                  } else {
                    upsertWatchFilter(user.accountId, watchFacet, lots, now)
                    setWatching(true)
                  }
                }}
              >
                {watching ? 'Watching filter' : 'Watch this filter'}
              </button>
            ) : null}
            <Link className="pub-btn" to="/wholesale/c">
              All categories
            </Link>
          </div>
        </header>

        {facet.deviceClass ? (
          <section className="seo-cat-section">
            <h2>Condition</h2>
            <ul className="seo-cat-chips">
              {hubConditionLinks(facet.deviceClass).map((c) => (
                <li key={c.id}>
                  <Link
                    to={c.to}
                    className={facet.condition === c.id ? 'is-active' : undefined}
                    aria-current={facet.condition === c.id ? 'page' : undefined}
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {facet.deviceClass && !facet.brand ? (
          <section className="seo-cat-section">
            <h2>Brands</h2>
            <ul className="seo-cat-chips">
              {SEO_BRANDS.map((id) => (
                <li key={id}>
                  <Link
                    to={categoryPath({
                      deviceClass: facet.deviceClass,
                      condition: facet.condition,
                      brand: id,
                    })}
                  >
                    {brandLabel(id)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="seo-cat-section">
          <h2>Live &amp; marketplace lots</h2>
          {matched.length ? (
            <ul className="seo-lot-list">
              {matched.map((lot) => (
                <li key={lot.id}>
                  <SeoLotRow lot={lot} deskOk={deskOk} showPrice={Boolean(user)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              No open lots in this category right now. Browse{' '}
              <Link to="/wholesale">the wholesale desk</Link> or{' '}
              <Link to="/register">apply as a buyer</Link> to get notified.
            </p>
          )}
        </section>

        <section className="seo-cat-section">
          <h2>More device types</h2>
          <ul className="seo-cat-chips">
            {DEVICE_CLASSES.filter((id) => id !== facet.deviceClass).map((id) => (
              <li key={id}>
                <Link to={categoryPath({ deviceClass: id, condition: facet.condition })}>
                  {deviceClassLabel(id)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </PublicShell>
  )
}
