import { useEffect, useMemo, useState } from 'react'
import { readRecentLots } from '../lib/recent'
import { useStore } from '../store'
import { ItemLink } from './ItemLink'

export function RecentLots() {
  const { lots } = useStore()
  const [ids, setIds] = useState(readRecentLots)
  useEffect(() => {
    function sync() {
      setIds(readRecentLots())
    }
    window.addEventListener('equarios-recent', sync)
    return () => window.removeEventListener('equarios-recent', sync)
  }, [])
  const rows = useMemo(
    () => ids.map((id) => lots.find((l) => l.id === id)).filter((l): l is NonNullable<typeof l> => Boolean(l)),
    [ids, lots],
  )
  if (!rows.length) return null
  return (
    <div className="recent-lots">
      <strong>Recently viewed</strong>
      <div className="recent-row">
        {rows.slice(0, 6).map((lot) => (
          <div key={lot.id} className="recent-chip">
            <ItemLink lot={lot} />
          </div>
        ))}
      </div>
    </div>
  )
}
