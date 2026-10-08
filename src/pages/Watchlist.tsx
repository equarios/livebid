import { LotCard } from '../components/LotCard'
import { useStore } from '../store'

export function Watchlist() {
  const { lots, watchlist, settings } = useStore()
  const rows = lots.filter((l) => watchlist.includes(l.id))
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
