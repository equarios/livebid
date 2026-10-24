import { NavLink, useLocation } from 'react-router-dom'
import { canUseWholesaleDesk } from '../lib/channelAccess'
import { useStore } from '../store'

/**
 * Consumer site nav — Store + Wholesale only.
 * Trade-in / Cart / Orders live in the store page hero (StoreRail).
 */
export function ConsumerNav({ onNavigate }: { onNavigate?: () => void }) {
  const { settings, user, isStaff } = useStore()
  const wholesaleOk = canUseWholesaleDesk(user, isStaff)
  const location = useLocation()

  const storeOpen =
    location.pathname === '/' ||
    location.pathname === '/store' ||
    location.pathname.startsWith('/store/')

  return (
    <nav
      className="site-nav consumer-nav gd-nav"
      onClick={() => {
        onNavigate?.()
      }}
    >
      <NavLink to="/store" end className={storeOpen ? 'active' : undefined}>
        {settings.storeLabel && settings.storeLabel !== 'Store'
          ? settings.storeLabel
          : settings.copy.navStore}
      </NavLink>
      {wholesaleOk ? (
        <NavLink to="/wholesale">{settings.copy.navWholesale}</NavLink>
      ) : null}
    </nav>
  )
}
