import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useDismissOnOutside } from '../lib/useDismissOnOutside'
import { useStore } from '../store'

export function HelpMenu({
  onNavigate,
  onOpen,
  onClose,
  closeWhen,
}: {
  onNavigate?: () => void
  onOpen?: () => void
  onClose?: () => void
  /** When true, force the help panel closed (e.g. notifications opened). */
  closeWhen?: boolean
}) {
  const { settings } = useStore()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const helpOn = ['/device-spec', '/info', '/tutorial'].includes(location.pathname)
  const helpLabel = settings.copy.navHelp

  useEffect(() => {
    if (closeWhen) setOpen(false)
  }, [closeWhen])

  useDismissOnOutside(open, rootRef, () => {
    setOpen(false)
    onClose?.()
  })

  return (
    <div className={`help-menu gd-util ${open ? 'open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`gd-util-btn ${helpOn || open ? 'active' : ''}`}
        aria-label={helpLabel}
        aria-expanded={open}
        title={helpLabel}
        onClick={(e) => {
          e.stopPropagation()
          if (open) {
            setOpen(false)
            onClose?.()
          } else {
            setOpen(true)
            onOpen?.()
          }
        }}
      >
        {helpLabel}
        <span className="gd-chevron" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          className="help-menu-panel gd-util-panel"
          onClick={() => {
            setOpen(false)
            onClose?.()
            onNavigate?.()
          }}
        >
          <NavLink to="/device-spec">Device spec</NavLink>
          <NavLink to="/info">Info</NavLink>
          <NavLink to="/tutorial">Tutorial</NavLink>
        </div>
      ) : null}
    </div>
  )
}
