import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

const PANEL_ATTR = 'data-filter-panel'
const GAP = 6
const Z = 50

/** True if target is inside a filter trigger root or a portaled filter panel. */
export function isFilterUiTarget(target: EventTarget | null, root?: Node | null) {
  if (!(target instanceof Node)) return false
  if (root?.contains(target)) return true
  return target instanceof Element && Boolean(target.closest(`[${PANEL_ATTR}]`))
}

export function FilterPanel({
  open,
  anchorRef,
  className,
  children,
  role,
  'aria-label': ariaLabel,
  'aria-multiselectable': ariaMulti,
}: {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  className?: string
  children: ReactNode
  role?: string
  'aria-label'?: string
  'aria-multiselectable'?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null)
      return
    }

    function place() {
      const anchor = anchorRef.current
      const panel = panelRef.current
      if (!anchor || !panel) return
      const r = anchor.getBoundingClientRect()
      const pw = panel.offsetWidth
      const ph = panel.offsetHeight
      const vw = window.innerWidth
      const vh = window.innerHeight
      let left = r.left
      if (left + pw > vw - 8) left = Math.max(8, vw - pw - 8)
      if (left < 8) left = 8
      const spaceBelow = vh - r.bottom - GAP
      const spaceAbove = r.top - GAP
      const openUp = spaceBelow < ph && spaceAbove > spaceBelow
      const top = openUp ? Math.max(8, r.top - GAP - ph) : r.bottom + GAP
      setStyle({
        position: 'fixed',
        top,
        left,
        zIndex: Z,
        minWidth: Math.max(180, r.width),
      })
    }

    place()
    const ro = new ResizeObserver(place)
    if (panelRef.current) ro.observe(panelRef.current)
    if (anchorRef.current) ro.observe(anchorRef.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchorRef, children])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={panelRef}
      className={['filter-panel', 'is-portaled', className].filter(Boolean).join(' ')}
      {...{ [PANEL_ATTR]: '' }}
      role={role}
      aria-label={ariaLabel}
      aria-multiselectable={ariaMulti}
      style={style ?? { position: 'fixed', top: -9999, left: -9999, zIndex: Z, visibility: 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  )
}
