import { useEffect, useState } from 'react'
import { usd } from '../lib/format'

export function priceBounds(prices: number[]): { min: number; max: number } {
  if (!prices.length) return { min: 0, max: 0 }
  const max = Math.ceil(Math.max(...prices))
  return { min: 0, max: Math.max(0, max) }
}

export function clampRange(lo: number, hi: number, min: number, max: number) {
  const a = Math.min(Math.max(lo, min), max)
  const b = Math.max(Math.min(hi, max), min)
  return a <= b ? { lo: a, hi: b } : { lo: min, hi: max }
}

export function PriceMenu({
  min,
  max,
  lo,
  hi,
  open,
  onOpen,
  onChange,
}: {
  min: number
  max: number
  lo: number
  hi: number
  open: boolean
  onOpen: () => void
  onChange: (lo: number, hi: number) => void
}) {
  const [fromText, setFromText] = useState(String(lo))
  const [toText, setToText] = useState(String(hi))
  const all = lo <= min && hi >= max
  const summary = all ? 'All' : `${usd(lo)} – ${usd(hi)}`

  useEffect(() => {
    if (!open) {
      setFromText(String(lo))
      setToText(String(hi))
    }
  }, [lo, hi, open])

  function parseAmount(raw: string, fallback: number) {
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return fallback
    return Math.floor(n)
  }

  function commitFrom(raw: string) {
    const next = parseAmount(raw, lo)
    setFromText(String(next))
    onChange(next, Math.max(next, hi))
  }

  function commitTo(raw: string) {
    const next = parseAmount(raw, hi)
    setToText(String(next))
    onChange(Math.min(lo, next), next)
  }

  return (
    <div className={`filter-menu ${open ? 'open' : ''}`}>
      <button type="button" className="filter-trigger" onClick={onOpen} aria-expanded={open}>
        <span className="filter-trigger-title">Price / pc</span>
        <span className="filter-trigger-value">{summary}</span>
      </button>
      {open ? (
        <div className="filter-panel">
          <label className="inline-field">
            <span>Min $</span>
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="0"
              value={fromText}
              aria-label="Minimum price per pc"
              onChange={(e) => setFromText(e.target.value)}
              onBlur={(e) => commitFrom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitFrom(fromText)
              }}
            />
          </label>
          <label className="inline-field">
            <span>Max $</span>
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder={String(max)}
              value={toText}
              aria-label="Maximum price per pc"
              onChange={(e) => setToText(e.target.value)}
              onBlur={(e) => commitTo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTo(toText)
              }}
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}
