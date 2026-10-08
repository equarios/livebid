import { listLabel, typeCounts, type AuctionListKind } from '../lib/auctionLists'
import { useNow, useStore } from '../store'

export function auctionTypeFilterOptions(settings: { auctionTypes: { value: string }[] }): AuctionListKind[] {
  return [...settings.auctionTypes.map((t) => t.value), 'ongoing', 'closed']
}

export function AuctionTypeNav({
  open,
  onOpen,
  selected,
  onToggle,
  onSelectAll,
}: {
  open: boolean
  onOpen: () => void
  selected: AuctionListKind[]
  onToggle: (value: AuctionListKind) => void
  onSelectAll: () => void
}) {
  const now = useNow()
  const { lots, settings } = useStore()
  const counts = typeCounts(lots, settings, now)
  const options = auctionTypeFilterOptions(settings)
  const allSelected = selected.length === 0
  const summary = allSelected
    ? 'All Auctions'
    : selected.map((v) => listLabel(v, settings)).join(', ')
  const active = open || !allSelected
  const badge = allSelected ? (counts.all ?? 0) : selected.length

  return (
    <div className={`filter-menu auction-type-menu${open ? ' open' : ''}`}>
      <button
        type="button"
        className={`filter-trigger${active ? ' is-active' : ''}`}
        onClick={onOpen}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="filter-trigger-title">Type</span>
        <span className="filter-trigger-value">{summary}</span>
        <em>{badge}</em>
      </button>
      {open ? (
        <div className="filter-panel auction-type-panel" role="listbox" aria-label="Auction lists" aria-multiselectable>
          <label className="filter-check auction-type-check">
            <input type="checkbox" checked={allSelected} onChange={onSelectAll} />
            <span>All Auctions</span>
            <em>{counts.all ?? 0}</em>
          </label>
          {options.map((kind) => (
            <label key={kind} className="filter-check auction-type-check">
              <input
                type="checkbox"
                checked={selected.includes(kind)}
                onChange={() => onToggle(kind)}
              />
              <span>{listLabel(kind, settings)}</span>
              <em>{counts[kind] ?? 0}</em>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  )
}
