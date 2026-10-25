import { Link } from 'react-router-dom'
import { canUseWholesaleDesk } from '../lib/channelAccess'
import { useStore } from '../store'
import type { WholesaleStatus } from '../types'

const COPY: Record<
  WholesaleStatus,
  { title: string; body: string; primary: { to: string; label: string }; secondary?: { to: string; label: string } }
> = {
  none: {
    title: 'Apply for wholesale',
    body: 'Unlock auctions and marketplace pricing for verified B2B buyers.',
    primary: { to: '/account/wholesale', label: 'Start application' },
    secondary: { to: '/buyers', label: 'How it works' },
  },
  submitted: {
    title: 'Application submitted',
    body: 'Staff is reviewing your company details. You can add documents anytime.',
    primary: { to: '/account/documents', label: 'Upload documents' },
    secondary: { to: '/account/wholesale', label: 'View application' },
  },
  needs_docs: {
    title: 'Documents needed',
    body: 'Upload tax / resale files so staff can finish approving your desk.',
    primary: { to: '/account/documents', label: 'Upload documents' },
    secondary: { to: '/account/wholesale', label: 'View application' },
  },
  under_review: {
    title: 'Under review',
    body: 'Your wholesale application is with staff. We will unlock the desk when approved.',
    primary: { to: '/account/documents', label: 'Documents' },
    secondary: { to: '/account/wholesale', label: 'View application' },
  },
  approved: {
    title: 'Wholesale approved',
    body: 'Your desk is active — bid, buy marketplace, and pay invoices.',
    primary: { to: '/wholesale', label: 'Open wholesale hub' },
    secondary: { to: '/auctions', label: 'Auctions' },
  },
  rejected: {
    title: 'Not approved',
    body: 'This application was not approved. Update documents or contact support if you want a re-review.',
    primary: { to: '/account/documents', label: 'Documents' },
    secondary: { to: '/support', label: 'Contact support' },
  },
}

function statusLabel(ws: WholesaleStatus) {
  return ws.replace(/_/g, ' ')
}

/** Desk-style status hero for Apply / Overview. */
export function WholesaleStatusHero({
  status,
  staffNote,
  extraTrust,
}: {
  status: WholesaleStatus
  staffNote?: string
  extraTrust?: { to: string; label: string }[]
}) {
  const copy = COPY[status] || COPY.none
  const pill = statusLabel(status)
  return (
    <section
      className={`wholesale-status-hero ending-soon-chip is-hero is-${status}`}
      aria-label="Wholesale application status"
    >
      <div className="ending-soon-hero-body">
        <h2 className="ending-soon-hero-title">
          {copy.title}
          <em className="store-page-hero-count">{pill}</em>
        </h2>
        <p className="ending-soon-hero-note">
          {copy.body}
          {staffNote ? ` Staff note: ${staffNote}` : ''}
        </p>
        <ul className="store-page-trust">
          <li>
            <Link to={copy.primary.to}>{copy.primary.label} →</Link>
          </li>
          {copy.secondary ? (
            <li>
              <Link to={copy.secondary.to}>{copy.secondary.label}</Link>
            </li>
          ) : null}
          {extraTrust?.map((t) => (
            <li key={t.to}>
              <Link to={t.to}>{t.label}</Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** Clear application-status card for store → My Page funnel. */
export function WholesaleStatusCard() {
  const { user, isStaff } = useStore()
  if (!user) return null
  if (canUseWholesaleDesk(user, isStaff)) return null
  const ws = (user.wholesaleStatus || 'none') as WholesaleStatus
  return <WholesaleStatusHero status={ws} />
}
