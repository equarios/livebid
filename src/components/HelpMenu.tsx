import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

export function HelpMenu({
  onNavigate,
  onOpen,
  closeWhen,
}: {
  onNavigate?: () => void
  onOpen?: () => void
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
    <div className={`help-menu ${open ? 'open' : ''}`}>
      <button
        type="button"
        className={`notice-bell help-bell ${helpOn ? 'active' : ''}`}
        aria-label="Help"
        aria-expanded={open}
        title="Help"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => {
            const next = !v
            if (next) onOpen?.()
            return next
          })
        }}
      >
        ?
      </button>
      {open ? (
        <div
          className="help-menu-panel"
          onClick={() => {
            setOpen(false)
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
