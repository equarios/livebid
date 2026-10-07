import { LotCard } from '../components/LotCard'
import { useStore } from '../store'

export function Watchlist() {
  const { lots, watchlist } = useStore()
  const rows = lots.filter((l) => watchlist.includes(l.id))
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Watchlist</h1>
          <p className="muted">Lots you marked so you can jump back during the session.</p>
        </div>
      </div>
      <div className="grid">
        {rows.map((lot) => (
          <LotCard key={lot.id} lot={lot} />
        ))}
      </div>
      {!rows.length ? <p className="empty">Nothing watched yet.</p> : null}
    </div>
  )
}
