import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LotCard } from '../components/LotCard'
import { useStore } from '../store'

export function Watchlist() {
  const { lots, watchlist, settings, myLastBid } = useStore()
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
