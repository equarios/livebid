import { Link } from 'react-router-dom'
import { canUseWholesaleDesk } from '../lib/channelAccess'
import { useStore } from '../store'

/** Store → wholesale apply path for retail shoppers who need volume. */
export function StoreWholesaleHandoff() {
  const { user, settings, isStaff } = useStore()
  if (!settings.features.register) return null
  if (canUseWholesaleDesk(user, isStaff)) return null
  const ws = user?.wholesaleStatus || 'none'
  const applied =
    ws === 'submitted' || ws === 'under_review' || ws === 'needs_docs'
  const to = !user ? '/register' : '/account/wholesale'
  const goLabel = !user
    ? 'Apply as buyer →'
    : applied
      ? 'Check status →'
      : 'Apply as buyer →'
  const body = !user
    ? 'Apply once — unlock auctions & marketplace'
    : applied
      ? `Status: ${ws.replace(/_/g, ' ')} — continue on My Page`
      : 'Apply once — unlock auctions & marketplace'
  return (
    <section className="pub-section store-wholesale-handoff" aria-label="Wholesale">
      <Link to={to} className="wholesale-my-desk-bar store-wholesale-handoff-bar">
        <span className="wholesale-my-desk-label">Wholesale</span>
        <span className="wholesale-my-desk-stats">
          <strong>Need volume?</strong>
          <span aria-hidden>·</span>
          <span>{body}</span>
        </span>
        <span className="wholesale-my-desk-go">{goLabel}</span>
      </Link>
    </section>
  )
}
