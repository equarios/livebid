import { Link } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { canUseWholesaleDesk, publicHome, wholesaleHome } from '../lib/channelAccess'
import { useStore } from '../store'

export function NotFound() {
  const { user, isStaff, settings } = useStore()
  const desk = canUseWholesaleDesk(user, isStaff)
  const home = desk ? wholesaleHome(settings) : publicHome(settings)
  const label = home.startsWith('/auctions')
    ? settings.copy.navAuctions
    : home.startsWith('/marketplace')
      ? settings.copy.marketTitle
      : settings.showStore
        ? settings.copy.navStore
        : settings.copy.navWholesale
  return (
    <PublicShell mode={desk ? 'wholesale' : 'consumer'}>
      <section className="not-found card">
        <h1>Page not found</h1>
        <p className="muted">That address is not in the app.</p>
        <Link to={home} className="btn btn-primary">
          {label}
        </Link>
      </section>
    </PublicShell>
  )
}
