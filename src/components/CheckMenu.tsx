import { useRef } from 'react'
import type { Grade, Lot } from '../types'
import { FilterPanel } from './FilterPanel'

export const GRADES: Grade[] = ['S', 'A', 'B', 'C']

export function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function makerOptions(lots: Lot[]) {
  return [...new Set(lots.map((l) => l.manufacturer))].sort()
}

export function capacityOptions(lots: Lot[]) {
  return [...new Set(lots.map((l) => l.capacity))].sort((a, b) => {
    const na = parseInt(a, 10)
    const nb = parseInt(b, 10)
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
    return a.localeCompare(b)
  })
}

export function CheckMenu<T extends string>({
  title,
  open,
  onOpen,
  options,
  selected,
  onToggle,
  labelFor,
}: {
  title: string
  open: boolean
  onOpen: () => void
  options: T[]
  selected: T[]
  onToggle: (value: T) => void
  labelFor?: (value: T) => string
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const summary = selected.length
    ? selected.map((v) => (labelFor ? labelFor(v) : v)).join(', ')
    : 'All'
  const active = open || selected.length > 0

  return (
    <div className={`filter-menu ${open ? 'open' : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`filter-trigger${active ? ' is-active' : ''}`}
        onClick={onOpen}
        aria-expanded={open}
      >
        <span className="filter-trigger-title">{title}</span>
        <span className="filter-trigger-value">{summary}</span>
        {selected.length ? <em>{selected.length}</em> : null}
      </button>
      <FilterPanel open={open} anchorRef={triggerRef}>
        {options.map((value) => (
          <label key={value} className="filter-check">
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={() => onToggle(value)}
            />
            <span>{labelFor ? labelFor(value) : value}</span>
          </label>
        ))}
      </FilterPanel>
    </div>
  )
}
