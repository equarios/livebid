import { useRef } from 'react'
import { originLabel } from '../lib/auctionLists'
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

export function originFilterOptions(lots: Array<{ origin?: string | null }>) {
  return [...new Set(lots.map((l) => originLabel(l.origin)).filter(Boolean))].sort()
}

export function stringFilterOptions(values: Array<string | null | undefined>) {
  return [...new Set(values.map((v) => (v || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  )
}

export function CheckMenu<T extends string>({
  title,
  open,
  onOpen,
  options,
  selected,
  onToggle,
  labelFor,
  /** When false, selection does not paint the trigger as active (e.g. stock default). */
  highlight,
}: {
  title: string
  open: boolean
  onOpen: () => void
  options: T[]
  selected: T[]
  onToggle: (value: T) => void
  labelFor?: (value: T) => string
  highlight?: boolean
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const summary = selected.length
    ? selected.map((v) => (labelFor ? labelFor(v) : v)).join(', ')
    : 'All'
  const marked = highlight ?? selected.length > 0
  const active = open || marked

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
        {marked && selected.length ? <em>{selected.length}</em> : null}
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

/** Single-select filter/sort menu; closes after a pick via onChange. */
export function ChoiceMenu<T extends string>({
  title,
  open,
  onOpen,
  options,
  value,
  onChange,
  labelFor,
  defaultValue,
}: {
  title: string
  open: boolean
  onOpen: () => void
  options: T[]
  value: T
  onChange: (value: T) => void
  labelFor?: (value: T) => string
  defaultValue?: T
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const summary = labelFor ? labelFor(value) : value
  const marked = defaultValue !== undefined ? value !== defaultValue : false
  const active = open || marked

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
      </button>
      <FilterPanel open={open} anchorRef={triggerRef} role="listbox" aria-label={title}>
        {options.map((opt) => (
          <label key={opt} className="filter-check">
            <input
              type="radio"
              name={`choice-${title}`}
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            <span>{labelFor ? labelFor(opt) : opt}</span>
          </label>
        ))}
      </FilterPanel>
    </div>
  )
}
