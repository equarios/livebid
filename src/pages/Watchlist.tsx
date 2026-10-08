import { useMemo } from 'react'
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
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{settings.copy.favouritesTitle}</h1>
          <p className="muted">{settings.copy.favouritesIntro}</p>
        </div>
      </div>
      <div className="grid">
        {rows.map((lot) => (
          <LotCard key={lot.id} lot={lot} />
        ))}
      </div>
      {!rows.length ? <p className="empty">{settings.copy.emptyFavourites}</p> : null}
    </div>
  )
}
