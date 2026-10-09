import { useLayoutEffect, useRef, type ReactNode } from 'react'

export function AuctionTypeHead({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const apply = () => {
      // Border-box only — margin below the head is breathing room, not sticky offset.
      parent.style.setProperty(
        '--auction-type-head-h',
        `${Math.round(el.getBoundingClientRect().height)}px`,
      )
    }
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    apply()
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="auction-type-block-head">
      {children}
    </div>
  )
}
