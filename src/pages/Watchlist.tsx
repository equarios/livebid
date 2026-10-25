import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LotCard } from '../components/LotCard'
import { MyPageHead } from '../components/MyPageHead'
import {
  loadWatchFilters,
  removeWatchFilter,
  type WatchFilter,
} from '../lib/watchFilters'
import { useStore } from '../store'

export function Watchlist() {
  const { lots, watchlist, settings, myLastBid, user } = useStore()
  const [filters, setFilters] = useState<WatchFilter[]>(() =>
    user ? loadWatchFilters(user.accountId) : [],
  )
  const rows = useMemo(() => {
    const list = lots.filter((l) => watchlist.includes(l.id))
    return [...list].sort((a, b) => {
      const aBid = myLastBid(a.id) ? 0 : 1
      const bBid = myLastBid(b.id) ? 0 : 1
      if (aBid !== bBid) return aBid - bBid
      return a.endsAt - b.endsAt
    })
  }, [lots, watchlist, myLastBid])

  const withBids = rows.filter((lot) => myLastBid(lot.id)).length

  return (
    <div className="watchlist-page">
      <MyPageHead
        title="Favorites"
        count={rows.length}
        note={
          settings.copy.favouritesIntro ||
          'Saved lots you are watching. Matching open lots also show on Your desk.'
        }
        trust={[
          { to: '/auctions', label: 'Browse auctions' },
          { to: '/account/bids', label: 'Bids' },
        ]}
      >
        {withBids ? (
          <ul className="store-page-trust mypage-head-meta">
            <li>Your bids {withBids}</li>
          </ul>
        ) : null}
      </MyPageHead>

      {user && filters.length ? (
        <section className="watch-filters-panel help-panel" aria-label="Saved filters">
          <h3 className="mypage-panel-label">Saved filters</h3>
          <p className="muted tiny">Matching open lots show on Your desk as watch hits.</p>
          <ul className="watch-filters-list">
            {filters.map((f) => (
              <li key={f.id}>
                <Link to={f.to}>{f.label}</Link>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => setFilters(removeWatchFilter(user.accountId, f.id))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rows.length ? (
        <div className="grid">
          {rows.map((lot) => (
            <LotCard key={lot.id} lot={lot} />
          ))}
        </div>
      ) : (
        <div className="mh-empty shop-empty">
          <p>{settings.copy.emptyFavourites}</p>
          <Link className="btn btn-primary btn-sm" to="/auctions">
            Browse auctions
          </Link>
        </div>
      )}
    </div>
  )
}
