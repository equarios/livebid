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
  type DeviceClass,
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

function openLots(lots: Lot[], now: number) {
  return lots.filter((l) => l.endsAt > now || l.channel === 'marketplace')
}

function facetStats(lots: Lot[], facet: SeoFacet) {
  let pcs = 0
  let n = 0
  const brands = new Set<string>()
  for (const lot of lots) {
    if (!lotMatchesFacet(lot, facet)) continue
    n += 1
    pcs += lot.qty || 0
    const m = lot.manufacturer?.trim()
    if (m) brands.add(m)
  }
  return { lots: n, pcs, brands: [...brands].sort() }
}

function FacetChip({
  to,
  label,
  count,
  active,
}: {
  to: string
  label: string
  count?: number
  active?: boolean
}) {
  return (
    <Link
      to={to}
      className={active ? 'is-active' : undefined}
      aria-current={active ? 'page' : undefined}
    >
      <span>{label}</span>
      {count != null && count > 0 ? <em className="seo-cat-chip-count">{count}</em> : null}
    </Link>
  )
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
  const { settings, lots, user, isStaff } = useStore()
  const now = useNow()
  const brand = settings.brandName || 'Equarios'
  const title = `${brand} | Wholesale devices worldwide — phones, tablets, PCs, consoles`
  const description = facetDescription({}, brand)
  const devices = hubDeviceLinks()
  const deskOk = canUseWholesaleDesk(user, isStaff)
  const live = useMemo(() => openLots(lots, now), [lots, now])

  const deviceCards = useMemo(() => {
    return devices.map((d) => {
      const stats = facetStats(live, { deviceClass: d.id as DeviceClass })
      const samples = stats.brands.slice(0, 3)
      const n = stats.brands.length
      const note =
        n === 0
          ? 'No open brands in this desk yet.'
          : n <= 3
            ? `${n} brand${n === 1 ? '' : 's'}: ${samples.join(', ')}.`
            : `${n} brands, incl. ${samples.join(', ')} +${n - 3} more.`
      return { ...d, ...stats, note }
    })
  }, [devices, live])

  /** Hub condition/brand chips deep-link via phones (largest funnel). */
  const hubBase: DeviceClass = 'phones'
  const conditionChips = useMemo(
    () =>
      CONDITIONS.map((id) => ({
        id,
        label: conditionLabel(id),
        to: categoryPath({ deviceClass: hubBase, condition: id }),
        count: facetStats(live, { deviceClass: hubBase, condition: id }).lots,
      })),
    [live],
  )
  const brandChips = useMemo(
    () =>
      SEO_BRANDS.slice(0, 12).map((id) => ({
        id,
        label: brandLabel(id),
        to: categoryPath({ deviceClass: hubBase, brand: id }),
        count: facetStats(live, { deviceClass: hubBase, brand: id }).lots,
      })),
    [live],
  )

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
        <header className="seo-cat-hero-chip ending-soon-chip is-hero" aria-label="Categories">
          <div className="ending-soon-hero-body">
            <h1 className="ending-soon-hero-title">
              Categories
              <em className="store-page-hero-count">{devices.length}</em>
            </h1>
            <p className="ending-soon-hero-note">
              Watch a device or condition — matches land on Your desk.
            </p>
            <ul className="store-page-trust">
              <li>
                <Link to={deskOk ? '/auctions' : '/register'}>
                  {deskOk ? 'Open auctions' : 'Apply as buyer'}
                </Link>
              </li>
              <li>
                <Link to={deskOk ? '/wholesale' : '/buyers'}>
                  {deskOk ? 'Your desk' : 'How wholesale works'}
                </Link>
              </li>
              <li>{devices.length} device types</li>
            </ul>
          </div>
        </header>

        <section className="seo-cat-section" aria-label="Shop by device">
          <div className="pub-section-head is-rail">
            <h2>Shop by device</h2>
          </div>
          <div className="ending-soon-row seo-cat-device-row">
            {deviceCards.map((d) => {
              const lotLabel = d.lots === 1 ? 'lot' : 'lots'
              return (
                <Link
                  key={d.id}
                  to={d.to}
                  className="ending-soon-chip is-desk is-hero seo-cat-device-chip"
                  title={`${d.label}: ${d.pcs.toLocaleString()} pcs · ${d.lots} ${lotLabel}`}
                >
                  <span className="ending-soon-hero-body">
                    <strong className="ending-soon-hero-title">
                      {d.label}
                      <em className="store-page-hero-count">{d.lots}</em>
                    </strong>
                    <span className="ending-soon-hero-note">{d.note}</span>
                    <ul className="store-page-trust">
                      <li>{d.pcs.toLocaleString()} pcs</li>
                      <li>
                        {d.lots.toLocaleString()} {lotLabel}
                      </li>
                    </ul>
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="seo-cat-section seo-cat-facet-strip">
          <h2>Condition</h2>
          <p className="seo-cat-facet-hint muted tiny">Filter phones by condition — or open a device above first.</p>
          <ul className="seo-cat-chips">
            {conditionChips.map((c) => (
              <li key={c.id}>
                <FacetChip to={c.to} label={c.label} count={c.count} />
              </li>
            ))}
          </ul>
        </section>

        <section className="seo-cat-section seo-cat-facet-strip">
          <h2>Popular brands</h2>
          <p className="seo-cat-facet-hint muted tiny">Phone brands with open lots highlighted.</p>
          <ul className="seo-cat-chips">
            {brandChips.map((b) => (
              <li key={b.id}>
                <FacetChip to={b.to} label={b.label} count={b.count} />
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
    return openLots(lots, now)
      .filter((l) => lotMatchesFacet(l, facet))
      .filter((l) => {
        if (seen.has(l.id)) return false
        seen.add(l.id)
        return true
      })
      .slice(0, 24)
  }, [lots, facet, now])

  const stats = useMemo(() => {
    let pcs = 0
    for (const lot of matched) pcs += lot.qty || 0
    return { lots: matched.length, pcs }
  }, [matched])

  const live = useMemo(() => openLots(lots, now), [lots, now])
  const conditionChips = useMemo(() => {
    if (!facet.deviceClass) return []
    return hubConditionLinks(facet.deviceClass).map((c) => ({
      ...c,
      count: facetStats(live, {
        deviceClass: facet.deviceClass,
        condition: c.id as SeoFacet['condition'],
      }).lots,
    }))
  }, [facet.deviceClass, live])
  const brandChips = useMemo(() => {
    if (!facet.deviceClass || facet.brand) return []
    return SEO_BRANDS.map((id) => ({
      id,
      label: brandLabel(id),
      to: categoryPath({
        deviceClass: facet.deviceClass,
        condition: facet.condition,
        brand: id,
      }),
      count: facetStats(live, {
        deviceClass: facet.deviceClass,
        condition: facet.condition,
        brand: id,
      }).lots,
    }))
  }, [facet.deviceClass, facet.condition, facet.brand, live])
  const moreDeviceChips = useMemo(
    () =>
      DEVICE_CLASSES.filter((id) => id !== facet.deviceClass).map((id) => ({
        id,
        label: deviceClassLabel(id),
        to: categoryPath({ deviceClass: id, condition: facet.condition }),
        count: facetStats(live, {
          deviceClass: id,
          condition: facet.condition,
        }).lots,
      })),
    [facet.deviceClass, facet.condition, live],
  )

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

  const lotLabel = stats.lots === 1 ? 'lot' : 'lots'

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

        <header className="seo-cat-hero-chip ending-soon-chip is-hero" aria-label={topic}>
          <div className="ending-soon-hero-body">
            <h1 className="ending-soon-hero-title">
              {topic}
              <em className="store-page-hero-count">{stats.lots}</em>
            </h1>
            <p className="ending-soon-hero-note">{description}</p>
            <ul className="store-page-trust">
              <li>
                {stats.pcs.toLocaleString()} pcs
              </li>
              <li>
                {stats.lots.toLocaleString()} {lotLabel}
              </li>
              {user && facet.deviceClass ? (
                <li>
                  <button
                    type="button"
                    className="seo-cat-trust-btn"
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
                    {watching ? 'Watching' : 'Watch filter'}
                  </button>
                </li>
              ) : null}
              <li>
                <Link to={deskOk ? '/auctions' : '/register'}>
                  {deskOk ? 'Open auctions' : 'Apply as buyer'}
                </Link>
              </li>
            </ul>
          </div>
        </header>

        {conditionChips.length ? (
          <section className="seo-cat-section seo-cat-facet-strip">
            <h2>Condition</h2>
            <ul className="seo-cat-chips">
              {conditionChips.map((c) => (
                <li key={c.id}>
                  <FacetChip
                    to={c.to}
                    label={c.label}
                    count={c.count}
                    active={facet.condition === c.id}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {brandChips.length ? (
          <section className="seo-cat-section seo-cat-facet-strip">
            <h2>Brands</h2>
            <ul className="seo-cat-chips">
              {brandChips.map((b) => (
                <li key={b.id}>
                  <FacetChip to={b.to} label={b.label} count={b.count} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="seo-cat-section">
          <div className="pub-section-head is-rail">
            <h2>Live &amp; marketplace lots</h2>
            <Link className="linkish" to="/wholesale/c">
              All categories
            </Link>
          </div>
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

        <section className="seo-cat-section seo-cat-facet-strip">
          <h2>More device types</h2>
          <ul className="seo-cat-chips">
            {moreDeviceChips.map((d) => (
              <li key={d.id}>
                <FacetChip to={d.to} label={d.label} count={d.count} />
              </li>
            ))}
          </ul>
        </section>
      </article>
    </PublicShell>
  )
}
