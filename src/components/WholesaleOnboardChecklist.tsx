import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { canUseWholesaleDesk } from '../lib/channelAccess'
import { pickFirstWinLots, type FirstWinPick } from '../lib/firstWinLots'
import { loadWatchFilters } from '../lib/watchFilters'
import { useNow, useStore } from '../store'

const DISMISS_KEY = 'livebid.onboardDesk.v1'
const FIRST_WIN_DISMISS = 'livebid.firstWin.v1'
const KEEP_GOING_DISMISS = 'livebid.keepGoing.v1'

type Step = {
  id: string
  label: string
  hint: string
  to: string
  done: boolean
}

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
    <section className="wholesale-onboard wholesale-first-win" aria-label={title}>
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

/** Post-approval checklist → first win → keep going. */
export function WholesaleOnboardChecklist({ forceOpen }: { forceOpen?: boolean }) {
  const { user, isStaff, accounts, bids, lots, invoices, notices } = useStore()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const [hide, setHide] = useState(false)

  useEffect(() => {
    if (!forceOpen || !params.has('onboard')) return
    const next = new URLSearchParams(params)
    next.delete('onboard')
    setParams(next, { replace: true })
  }, [forceOpen, params, setParams])

  const steps = useMemo((): Step[] => {
    if (!user) return []
    const filters = loadWatchFilters(user.accountId)
    const hasBid = (bids || []).some((b) => b.accountId === user.accountId)
    const addr =
      user.address?.trim() ||
      accounts.find((a) => a.accountId === user.accountId)?.address?.trim() ||
      ''
    return [
      {
        id: 'watch',
        label: 'Save a watch filter',
        hint: 'Device / Condition on Categories — get matches on Your desk',
        to: '/wholesale/c',
        done: filters.length > 0,
      },
      {
        id: 'bid',
        label: 'Place your first bid',
        hint: 'Open a live desk and bid for fill',
        to: '/auctions',
        done: hasBid,
      },
      {
        id: 'address',
        label: 'Confirm ship / bill address',
        hint: 'Needed on invoices — check Settings',
        to: '/account/settings',
        done: addr.length >= 8,
      },
    ]
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

  const remaining = steps.filter((s) => !s.done)
  const showOnboard = remaining.length > 0 && (forceOpen || !dismissed(DISMISS_KEY, user.accountId))
  const showFirstWin =
    !remaining.length &&
    !hasWin &&
    firstWinPicks.length > 0 &&
    (forceOpen || !dismissed(FIRST_WIN_DISMISS, user.accountId))
  const showKeepGoing =
    !remaining.length &&
    hasWin &&
    keepGoingPicks.length > 0 &&
    (forceOpen || !dismissed(KEEP_GOING_DISMISS, user.accountId))

  if (showOnboard) {
    const doneN = steps.length - remaining.length
    return (
      <section className="wholesale-onboard" aria-label="Get started on your desk">
        <div className="wholesale-onboard-head">
          <div>
            <h2>What&apos;s next</h2>
            <p className="muted tiny">
              {doneN}/{steps.length} done — finish these to get the most from your desk.
            </p>
          </div>
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setDismissed(DISMISS_KEY, user.accountId)
              setHide(true)
            }}
          >
            Skip for now
          </button>
        </div>
        <ol className="wholesale-onboard-steps">
          {steps.map((step) => (
            <li key={step.id} className={step.done ? 'is-done' : ''}>
              <span className="wholesale-onboard-check" aria-hidden>
                {step.done ? '✓' : '○'}
              </span>
              <div className="wholesale-onboard-copy">
                <strong>{step.label}</strong>
                <span className="muted tiny">{step.hint}</span>
              </div>
              {!step.done ? (
                <Link className="btn btn-sm btn-primary" to={step.to}>
                  Go
                </Link>
              ) : (
                <span className="wholesale-onboard-done muted tiny">Done</span>
              )}
            </li>
          ))}
        </ol>
      </section>
    )
  }

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
