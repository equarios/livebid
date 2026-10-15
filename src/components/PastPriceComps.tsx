import { useEffect, useId, useRef, useState } from 'react'
import { api, type PriceCompDto } from '../lib/api'
import { usd } from '../lib/format'
import { useStore } from '../store'

const MIN_COMPS = 2

function relativeAgo(at: number, now: number) {
  const days = Math.max(0, Math.round((now - at) / 86400000))
  if (days <= 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 60) return `${days}d ago`
  const months = Math.round(days / 30)
  return months <= 1 ? '1mo ago' : `${months}mo ago`
}

function typeLabel(
  type: string,
  auctionTypes: Array<{ value: string; label: string }> | undefined,
) {
  if (type === 'marketplace') return 'Market'
  const def = auctionTypes?.find((t) => t.value === type)
  const label = def?.label || type
  return label.replace(/\s*Auctions?$/i, '').trim() || type
}

/** Compact “Past 3” chip → popover of recent clearing prices (same type + model). */
export function PastPriceComps({ lotId }: { lotId: string }) {
  const { settings } = useStore()
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [comps, setComps] = useState<PriceCompDto[] | null>(null)
  const [median, setMedian] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setComps(null)
    setMedian(null)
    setFailed(false)
    void api
      .lotPriceComps(lotId)
      .then((res) => {
        if (!alive) return
        setComps(res.comps || [])
        setMedian(res.median)
      })
      .catch(() => {
        if (alive) {
          setComps([])
          setFailed(true)
        }
      })
    return () => {
      alive = false
    }
  }, [lotId])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    // Defer so the opening click cannot immediately close the popover.
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', onDoc)
    }, 0)
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (failed || comps === null) return null
  if (comps.length < MIN_COMPS) return null

  const now = Date.now()

  return (
    <div className="past-comps" ref={rootRef}>
      <button
        type="button"
        className={`past-comps-chip${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        Recent $
      </button>
      {open ? (
        <div className="past-comps-pop" id={panelId} role="dialog" aria-label="Past clearing prices">
          <p className="past-comps-lead">Same type · model · sold</p>
          <ul className="past-comps-list">
            {comps.map((c) => (
              <li key={`${c.lotId}-${c.at}`}>
                <span className="past-comps-type">
                  {typeLabel(c.type, settings.auctionTypes)}
                </span>
                <strong>{usd(c.unitPrice)}</strong>
                <span className="muted tiny">{relativeAgo(c.at, now)}</span>
              </li>
            ))}
          </ul>
          {median != null ? (
            <p className="past-comps-median muted tiny">Recent ~{usd(median)}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
