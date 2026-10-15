import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LotCard } from '../components/LotCard'
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
      {user && filters.length ? (
        <section className="watch-filters-panel" aria-label="Saved filters">
          <div className="mypage-meta">
            <em>{filters.length} saved filter{filters.length === 1 ? '' : 's'}</em>
            <span className="muted tiny">
              Matching open lots show on Your desk as watch hits.
            </span>
          </div>
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

      <div className="mypage-meta">
        <em>{rows.length} saved</em>
        {withBids ? <em className="is-yours">Your bids {withBids}</em> : null}
        {settings.copy.favouritesIntro ? (
          <span className="muted tiny">{settings.copy.favouritesIntro}</span>
        ) : null}
      </div>
      {rows.length ? (
        <div className="grid">
          {rows.map((lot) => (
            <LotCard key={lot.id} lot={lot} />
          ))}
        </div>
      ) : (
        <section className="account-panel account-empty">
          <p className="muted">{settings.copy.emptyFavourites}</p>
          <Link className="btn btn-primary" to="/auctions">
            Browse auctions
          </Link>
        </section>
      )}
    </div>
  )
}
