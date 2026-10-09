import { useLayoutEffect, useRef, type ReactNode } from 'react'

export function AuctionTypeHead({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const apply = () => {
      const style = getComputedStyle(el)
      const margin =
        (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0)
      parent.style.setProperty(
        '--auction-type-head-h',
        `${Math.round(el.getBoundingClientRect().height + margin)}px`,
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
