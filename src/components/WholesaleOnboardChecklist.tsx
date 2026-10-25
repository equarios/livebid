import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { canUseWholesaleDesk } from '../lib/channelAccess'
import { pickFirstWinLots, type FirstWinPick } from '../lib/firstWinLots'
import { loadWatchFilters } from '../lib/watchFilters'
import { useNow, useStore } from '../store'

const FIRST_WIN_DISMISS = 'livebid.firstWin.v1'
const KEEP_GOING_DISMISS = 'livebid.keepGoing.v1'

function dismissed(key: string, accountId: string) {
  try {
    return localStorage.getItem(`${key}:${accountId}`) === '1'
  } catch {
    return false
  }
}

function setDismissed(key: string, accountId: string) {
  try {
    localStorage.setItem(`${key}:${accountId}`, '1')
  } catch {
    /* quota */
  }
}

function LotShortlist({
  picks,
  title,
  hint,
  onDismiss,
}: {
  picks: FirstWinPick[]
  title: string
  hint: string
  onDismiss: () => void
}) {
  return (
    <section className="pub-section wholesale-onboard wholesale-first-win" aria-label={title}>
      <div className="wholesale-onboard-head">
        <div>
          <h2>{title}</h2>
          <p className="muted tiny">{hint}</p>
        </div>
        <button type="button" className="linkish" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
      <ul className="wholesale-first-win-list">
        {picks.map((pick) => (
          <li key={pick.lot.id}>
            <div className="wholesale-onboard-copy">
              <strong>{pick.title}</strong>
              <span className="muted tiny">
                {pick.lot.qty} pcs · Grade {pick.lot.grade}
                {pick.bidders === 0
                  ? ' · no bids yet'
                  : ` · ${pick.bidders} bidder${pick.bidders === 1 ? '' : 's'}`}
              </span>
            </div>
            <Link className="btn btn-sm btn-primary" to={pick.href}>
              Bid
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** After setup: first win / keep going shortlists. Setup lives on Your desk hero. */
export function WholesaleOnboardChecklist({ forceOpen }: { forceOpen?: boolean }) {
  const { user, isStaff, accounts, bids, lots, invoices, notices } = useStore()
  const now = useNow()
  const [hide, setHide] = useState(false)

  const setupDone = useMemo(() => {
    if (!user) return false
    const filters = loadWatchFilters(user.accountId)
    const hasBid = (bids || []).some((b) => b.accountId === user.accountId)
    const addr =
      user.address?.trim() ||
      accounts.find((a) => a.accountId === user.accountId)?.address?.trim() ||
      ''
    return filters.length > 0 && hasBid && addr.length >= 8
  }, [user, accounts, bids])

  const hasWin = useMemo(() => {
    if (!user) return false
    if ((invoices || []).some((i) => i.accountId === user.accountId && i.status !== 'draft')) {
      return true
    }
    return (notices || []).some((n) => n.accountId === user.accountId && n.kind === 'win')
  }, [user, invoices, notices])

  const firstWinPicks = useMemo(() => {
    if (!user || hasWin) return []
    return pickFirstWinLots(lots, bids || [], now, 4)
  }, [user, hasWin, lots, bids, now])

  const keepGoingPicks = useMemo(() => {
    if (!user || !hasWin) return []
    return pickFirstWinLots(lots, bids || [], now, 4, {
      excludeAccountId: user.accountId,
    })
  }, [user, hasWin, lots, bids, now])

  if (!user || !canUseWholesaleDesk(user, isStaff)) return null
  if (hide) return null
  if (!setupDone && !forceOpen) return null

  const showFirstWin =
    setupDone &&
    !hasWin &&
    firstWinPicks.length > 0 &&
    (forceOpen || !dismissed(FIRST_WIN_DISMISS, user.accountId))
  const showKeepGoing =
    setupDone &&
    hasWin &&
    keepGoingPicks.length > 0 &&
    (forceOpen || !dismissed(KEEP_GOING_DISMISS, user.accountId))

  if (showFirstWin) {
    return (
      <LotShortlist
        picks={firstWinPicks}
        title="Win your first lot"
        hint="Low-competition desks closing within 48h — good places to get fill."
        onDismiss={() => {
          setDismissed(FIRST_WIN_DISMISS, user.accountId)
          setHide(true)
        }}
      />
    )
  }

  if (showKeepGoing) {
    return (
      <LotShortlist
        picks={keepGoingPicks}
        title="Your next desk"
        hint="Keep going — quiet lots closing soon that you have not bid on yet."
        onDismiss={() => {
          setDismissed(KEEP_GOING_DISMISS, user.accountId)
          setHide(true)
        }}
      />
    )
  }

  return null
}
