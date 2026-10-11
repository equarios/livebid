import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

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
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const helpOn = ['/device-spec', '/info', '/tutorial'].includes(location.pathname)

  useEffect(() => {
    if (closeWhen) setOpen(false)
  }, [closeWhen])

  return (
    <div className={`help-menu gd-util ${open ? 'open' : ''}`}>
      <button
        type="button"
        className={`gd-util-btn ${helpOn || open ? 'active' : ''}`}
        aria-label="Help"
        aria-expanded={open}
        title="Help"
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
        Help
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
