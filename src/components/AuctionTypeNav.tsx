import { NavLink } from 'react-router-dom'
import { listLabel, listPath, typeCounts, type AuctionListKind } from '../lib/auctionLists'
import { useStore } from '../store'

export function AuctionTypeNav() {
  const { lots, settings } = useStore()
  const counts = typeCounts(lots, settings)
  const items: AuctionListKind[] = ['all', ...settings.auctionTypes.map((t) => t.value), 'ongoing']

  return (
    <nav className="auction-type-nav" aria-label="Auction lists">
      {items.map((kind) => (
        <NavLink
          key={kind}
          to={listPath(kind)}
          end={kind === 'all'}
          className={({ isActive }) => (isActive ? 'is-active' : undefined)}
        >
          {listLabel(kind, settings)}
          <em>{counts[kind] ?? 0}</em>
        </NavLink>
      ))}
    </nav>
  )
}
