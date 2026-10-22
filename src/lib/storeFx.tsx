import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { FilterPanel, isFilterUiTarget } from '../components/FilterPanel'
import { api } from './api'

const STORAGE_KEY = 'livebid-store-currency'

const POPULAR = ['USD', 'HKD', 'CNY', 'EUR', 'GBP', 'JPY', 'AED', 'SGD', 'AUD', 'CAD']

type FxCtx = {
  currency: string
  setCurrency: (code: string) => void
  rates: Record<string, number>
  codes: string[]
  fetchedAt: string | null
  ready: boolean
  /** Format a USD amount in the shopper's display currency. */
  money: (usdAmount: number) => string
  convert: (usdAmount: number) => number
}

const Ctx = createContext<FxCtx | null>(null)

function readSavedCurrency() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)?.trim().toUpperCase()
    return v && /^[A-Z]{3}$/.test(v) ? v : 'USD'
  } catch {
    return 'USD'
  }
}

function formatMoney(amount: number, code: string) {
  try {
    return amount.toLocaleString(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: code === 'USD' || code === 'EUR' || code === 'GBP' ? 0 : 2,
      minimumFractionDigits: 0,
    })
  } catch {
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${code}`
  }
}

export function StoreFxProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState(readSavedCurrency)
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 })
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let gone = false
    api
      .storeFx()
      .then((snap) => {
        if (gone) return
        setRates({ USD: 1, ...snap.rates })
        setFetchedAt(snap.fetchedAt)
        setReady(true)
      })
      .catch(() => {
        if (!gone) {
          setRates({ USD: 1 })
          setReady(true)
        }
      })
    return () => {
      gone = true
    }
  }, [])

  const setCurrency = useCallback((code: string) => {
    const c = code.trim().toUpperCase() || 'USD'
    setCurrencyState(c)
    try {
      localStorage.setItem(STORAGE_KEY, c)
    } catch {
      /* ignore */
    }
  }, [])

  const codes = useMemo(() => {
    const list = Object.keys(rates).sort()
    if (!list.includes('USD')) list.unshift('USD')
    return list
  }, [rates])

  useEffect(() => {
    if (ready && !rates[currency]) setCurrency('USD')
  }, [ready, rates, currency, setCurrency])

  const convert = useCallback(
    (usdAmount: number) => {
      const per = rates[currency] ?? 1
      return Math.round(usdAmount * per * 100) / 100
    },
    [rates, currency],
  )

  const money = useCallback(
    (usdAmount: number) => formatMoney(convert(usdAmount), currency),
    [convert, currency],
  )

  const value = useMemo(
    () => ({ currency, setCurrency, rates, codes, fetchedAt, ready, money, convert }),
    [currency, setCurrency, rates, codes, fetchedAt, ready, money, convert],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStoreFx() {
  const ctx = useContext(Ctx)
  if (!ctx) {
    return {
      currency: 'USD',
      setCurrency: (_: string) => undefined,
      rates: { USD: 1 } as Record<string, number>,
      codes: ['USD'],
      fetchedAt: null as string | null,
      ready: false,
      money: (n: number) =>
        n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
      convert: (n: number) => n,
    }
  }
  return ctx
}

/** Chip + searchable panel — portaled so it never clips under store layouts. */
export function StoreCurrencySelect({ className }: { className?: string }) {
  const { currency, setCurrency, codes, ready } = useStoreFx()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (isFilterUiTarget(e.target, rootRef.current)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      setQ('')
      window.setTimeout(() => searchRef.current?.focus(), 0)
    }
  }, [open])

  if (!ready || codes.length <= 1) return null

  const available = new Set(codes)
  const popular = POPULAR.filter((c) => available.has(c))
  const needle = q.trim().toUpperCase()
  const filtered = needle
    ? codes.filter((c) => c.includes(needle)).slice(0, 40)
    : codes.filter((c) => !popular.includes(c)).slice(0, 40)

  function pick(code: string) {
    setCurrency(code)
    setOpen(false)
  }

  return (
    <div className={className || 'store-fx'} ref={rootRef}>
      <button
        type="button"
        className={`store-fx-chip${open ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Display currency ${currency}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="store-fx-chip-label">Currency</span>
        <strong>{currency}</strong>
        <em aria-hidden>▾</em>
      </button>
      <FilterPanel open={open} anchorRef={rootRef} className="store-fx-panel" role="listbox" aria-label="Currencies">
        <input
          ref={searchRef}
          className="store-fx-search"
          type="search"
          placeholder="Search code…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
        {!needle ? (
          <div className="store-fx-section">
            <p className="store-fx-section-label">Popular</p>
            <ul className="store-fx-list">
              {popular.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c === currency}
                    className={c === currency ? 'is-on' : undefined}
                    onClick={() => pick(c)}
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="store-fx-section">
          <p className="store-fx-section-label">{needle ? 'Matches' : 'All'}</p>
          <ul className="store-fx-list store-fx-list-scroll">
            {filtered.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c === currency}
                  className={c === currency ? 'is-on' : undefined}
                  onClick={() => pick(c)}
                >
                  {c}
                </button>
              </li>
            ))}
            {!filtered.length ? <li className="muted tiny store-fx-empty">No match</li> : null}
          </ul>
        </div>
        <p className="store-fx-hint muted tiny">Prices convert from USD · checkout stays USD</p>
      </FilterPanel>
    </div>
  )
}
