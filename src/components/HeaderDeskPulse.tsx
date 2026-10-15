import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { canUseWholesaleDesk } from '../lib/channelAccess'
import { buildDeskPulse } from '../lib/deskPulse'
import {
  loadPulseKey,
  preferRememberedPulse,
  rememberPulseKey,
} from '../lib/pulseMemory'
import { countWatchFilterMatches } from '../lib/watchFilters'
import { useNow, useStore } from '../store'

/** Compact “N need you” control in the signed-in app / wholesale header. */
export function HeaderDeskPulse() {
  const navigate = useNavigate()
  const now = useNow()
  const { user, isStaff, lots, bids, offers, invoices } = useStore()
  const deskOk = canUseWholesaleDesk(user, isStaff)

  const urgent = useMemo(() => {
    if (!user || !deskOk) return []
    const watch = countWatchFilterMatches(user.accountId, lots, now)
    const pulse = buildDeskPulse({
      accountId: user.accountId,
      lots,
      bids: bids || [],
      offers: offers || [],
      invoices: invoices || [],
      now,
      watchMatches: watch.lots,
      watchHref: watch.firstTo,
      endingSoonToday: 0,
    })
    const ordered = preferRememberedPulse(pulse, loadPulseKey(user.accountId))
    return ordered.filter((s) => s.urgent)
  }, [user, deskOk, lots, bids, offers, invoices, now])

  if (!deskOk || !urgent.length) return null
  const first = urgent[0]
  const n = urgent.length

  return (
    <button
      type="button"
      className="header-desk-pulse"
      title={urgent.map((s) => s.label).join(' · ')}
      onClick={() => {
        rememberPulseKey(user!.accountId, first.key)
        navigate(first.href.startsWith('#') ? '/wholesale' : first.href)
      }}
    >
      <em>{n}</em>
      <span>need you</span>
    </button>
  )
}
