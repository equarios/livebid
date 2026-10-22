import { NavLink, useLocation } from 'react-router-dom'
import { useStore } from '../store'

const HELP_PATHS = ['/device-spec', '/info', '/tutorial', '/support']

/** Single door into Help — topic tabs live on the Help pages. */
export function HelpMenu({
  onNavigate,
}: {
  onNavigate?: () => void
  onOpen?: () => void
  onClose?: () => void
  closeWhen?: boolean
}) {
  const { settings } = useStore()
  const location = useLocation()
  const helpOn = HELP_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`),
  )
  const helpLabel = settings.copy.navHelp

  return (
    <NavLink
      to="/support"
      className={`gd-util-btn help-link${helpOn ? ' active' : ''}`}
      aria-label={helpLabel}
      title={helpLabel}
      onClick={() => onNavigate?.()}
    >
      {helpLabel}
    </NavLink>
  )
}
