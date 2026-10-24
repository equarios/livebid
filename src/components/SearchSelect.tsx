import { useEffect, useId, useMemo, useRef, useState } from 'react'

export type SearchSelectOption = {
  value: string
  label: string
  /** Right-aligned secondary text, e.g. "up to $240". */
  hint?: string
  /** Extra words matched by search but not shown. */
  keywords?: string
}

type SearchSelectProps = {
  label: string
  value: string
  options: SearchSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
}

/** Searchable single-select (combobox) — scales to hundreds of options. */
export function SearchSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches',
  disabled = false,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) =>
      `${o.label} ${o.hint || ''} ${o.keywords || ''}`.toLowerCase().includes(q),
    )
  }, [options, query])

  useEffect(() => {
    if (open) return
    setQuery('')
    setActive(0)
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function choose(next: string) {
    onChange(next)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = filtered[active]
      if (hit) choose(hit.value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className={`ss${open ? ' is-open' : ''}`} ref={rootRef}>
      <span className="ss-label">{label}</span>
      <button
        type="button"
        className={`ss-trigger${open ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selected ? 'ss-value' : 'ss-value is-empty'}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="ss-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="ss-pop">
          <input
            ref={inputRef}
            className="ss-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder}
            autoComplete="off"
            aria-controls={listId}
          />
          <ul className="ss-list" role="listbox" id={listId}>
            {filtered.length ? (
              filtered.map((o, i) => (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    className={`ss-opt${o.value === value ? ' is-selected' : ''}${
                      i === active ? ' is-active' : ''
                    }`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o.value)}
                  >
                    <span className="ss-opt-label">{o.label}</span>
                    {o.hint ? <span className="ss-opt-hint">{o.hint}</span> : null}
                  </button>
                </li>
              ))
            ) : (
              <li className="ss-empty">{emptyText}</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
