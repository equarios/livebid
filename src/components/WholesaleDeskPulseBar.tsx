import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { canUseWholesaleDesk } from '../lib/channelAccess'
import { buildDeskPulse } from '../lib/deskPulse'
import { parsePulseKey, PULSE_QUERY } from '../lib/deskPulseNav'
import {
  loadPulseKey,
  preferRememberedPulse,
  rememberPulseKey,
} from '../lib/pulseMemory'
import { countWatchFilterMatches, loadWatchFilters } from '../lib/watchFilters'
import { DEFAULT_SETTINGS } from '../data'
import { useNow, useStore } from '../store'

const ONBOARD_DISMISS = 'livebid.onboardDesk.v1'

type Props = {
  /** When true, hide the bar if there is nothing actionable. */
  hideWhenEmpty?: boolean
  /** Re-open setup steps (e.g. ?onboard=1). */
  forceOpenOnboard?: boolean
}

type OnboardStep = {
  id: string
  label: string
  hint: string
  to: string
  cta: string
  done: boolean
}

function dismissed(accountId: string) {
  try {
    return localStorage.getItem(`${ONBOARD_DISMISS}:${accountId}`) === '1'
  } catch {
    return false
  }
}

function setDismissed(accountId: string) {
  try {
    localStorage.setItem(`${ONBOARD_DISMISS}:${accountId}`, '1')
  } catch {
    /* quota */
  }
}

/** Your-desk hero — same chip pattern as Ending soon / Live Auctions. */
export function WholesaleDeskPulseBar({ hideWhenEmpty, forceOpenOnboard }: Props) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const now = useNow()
  const { user, isStaff, accounts, lots, bids, offers, invoices, settings } = useStore()
  const pages = { ...DEFAULT_SETTINGS.pages, ...settings.pages }
  const pulseKey = parsePulseKey(params.get(PULSE_QUERY))
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [onboardHide, setOnboardHide] = useState(false)

  useEffect(() => {
    if (!forceOpenOnboard || !params.has('onboard')) return
    const next = new URLSearchParams(params)
    next.delete('onboard')
    setParams(next, { replace: true })
  }, [forceOpenOnboard, params, setParams])

  const endingSoonToday = useMemo(() => {
    const day = 24 * 60 * 60 * 1000
    const open = lots.filter(
      (l) => l.channel === 'auction' && (l.extraSealedEndsAt || l.endsAt) > now,
    )
    const byType = new Map<string, number>()
    for (const lot of open) {
      const t = lot.auctionType || 'live'
      const end = lot.extraSealedEndsAt || lot.endsAt
      if (end - now > day) continue
      const prev = byType.get(t)
      if (prev == null || end < prev) byType.set(t, end)
    }
    return byType.size
  }, [lots, now])

  const deskPulse = useMemo(() => {
    if (!user) return []
    const watch = countWatchFilterMatches(user.accountId, lots, now)
    const raw = buildDeskPulse({
      accountId: user.accountId,
      lots,
      bids: bids || [],
      offers: offers || [],
      invoices: invoices || [],
      now,
      watchMatches: watch.lots,
      watchHref: watch.firstTo,
      endingSoonToday,
    })
    return preferRememberedPulse(raw, loadPulseKey(user.accountId))
  }, [user, lots, bids, offers, invoices, now, endingSoonToday])

  const onboardSteps = useMemo((): OnboardStep[] => {
    if (!user || !canUseWholesaleDesk(user, isStaff)) return []
    const filters = loadWatchFilters(user.accountId)
    const hasBid = (bids || []).some((b) => b.accountId === user.accountId)
    const addr =
      user.address?.trim() ||
      accounts.find((a) => a.accountId === user.accountId)?.address?.trim() ||
      ''
    return [
      {
        id: 'watch',
        label: 'Watch filter',
        hint: 'Matches show on Your desk',
        to: '/wholesale/c',
        cta: 'Categories',
        done: filters.length > 0,
      },
      {
        id: 'bid',
        label: 'First bid',
        hint: 'Bid a live desk for fill',
        to: '/auctions',
        cta: 'Live desks',
        done: hasBid,
      },
      {
        id: 'address',
        label: 'Ship address',
        hint: 'Needed on invoices',
        to: '/account/settings',
        cta: 'Settings',
        done: addr.length >= 8,
      },
    ]
  }, [user, isStaff, accounts, bids])

  const onboardRemaining = onboardSteps.filter((s) => !s.done)
  const showOnboard =
    Boolean(user) &&
    !onboardHide &&
    onboardRemaining.length > 0 &&
    (forceOpenOnboard || (user ? !dismissed(user.accountId) : false))

  /** Digest / email deep-link: open the matching desk action once. */
  useEffect(() => {
    if (!pulseKey || !user) return
    const match = deskPulse.find((s) => s.key === pulseKey)
    /* Wait for catalog so outbid/watch can resolve to a real lot. */
    if (!match && pulseKey !== 'invoice' && !lots.length) return

    const fallback: Record<string, string> = {
      outbid: '/auctions',
      invoice: '/account/invoices',
      watch: '/account/favourites',
      offer: '/account/marketplace-history#offers',
      sealed: '/auctions',
      bids: '/auctions',
      pending: '/account/marketplace-history#offers',
      soon: '#wholesale-ending-soon',
    }
    const path = match?.href || fallback[pulseKey]
    if (params.has(PULSE_QUERY)) {
      const next = new URLSearchParams(params)
      next.delete(PULSE_QUERY)
      setParams(next, { replace: true })
    }
    rememberPulseKey(user.accountId, pulseKey)
    if (!path) return
    if (path.startsWith('#')) {
      requestAnimationFrame(() => {
        document
          .querySelector(path === '#wholesale-ending-soon' ? '#wholesale-ending-soon' : path)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return
    }
    navigate(path)
  }, [pulseKey, deskPulse, user, lots.length, params, setParams, navigate])

  if (!user) return null
  if (hideWhenEmpty && !deskPulse.length && !showOnboard) return null

  function go(path: string, key?: string) {
    if (key) rememberPulseKey(user!.accountId, key)
    if (path.startsWith('#')) {
      if (path === '#wholesale-ending-soon') {
        navigate('/wholesale')
        return
      }
      const el = document.querySelector(path)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    navigate(path)
  }

  const nextStep = onboardRemaining[0]
  const focus = onboardSteps.find((s) => s.id === previewId) ?? nextStep
  const thenTrail = onboardRemaining
    .filter((s) => s.id !== focus?.id)
    .map((s) => s.label)
    .join(' → ')
  const doneN = onboardSteps.length - onboardRemaining.length

  const heroCount = deskPulse.length || (showOnboard ? onboardRemaining.length : 0)
  const note = showOnboard && focus
    ? `${focus.label} · ${focus.hint}${thenTrail ? ` · Then: ${thenTrail}` : ''}`
    : deskPulse.length
      ? deskPulse.map((s) => s.label).join(' · ')
      : 'No open bids or offers — browse desks below'

  const setupTo = focus?.done ? nextStep?.to : focus?.to
  const setupCta = focus?.done ? nextStep?.cta : focus?.cta

  return (
    <section className="pub-section wholesale-my-desk" aria-label={pages.wholesaleMyDeskLabel}>
      <div
        className={`wholesale-desk-hero ending-soon-chip is-hero${
          deskPulse.some((s) => s.urgent) ? ' is-urgent' : ''
        }`}
      >
        <div className="ending-soon-hero-body">
          <strong className="ending-soon-hero-title">
            {pages.wholesaleMyDeskLabel}
            {heroCount > 0 ? (
              <em className="store-page-hero-count">{heroCount}</em>
            ) : null}
          </strong>
          <span className="ending-soon-hero-note">
            {note}
            {showOnboard ? (
              <>
                {' '}
                <button
                  type="button"
                  className="wholesale-desk-hero-skip"
                  onClick={() => {
                    setDismissed(user.accountId)
                    setOnboardHide(true)
                  }}
                >
                  Skip
                </button>
              </>
            ) : null}
          </span>
          {showOnboard ? (
            <ol
              className="wholesale-onboard-dots wholesale-desk-hero-dots"
              aria-label={`${doneN} of ${onboardSteps.length} setup done`}
            >
              {onboardSteps.map((step) => {
                const selected = step.id === focus?.id
                return (
                  <li
                    key={step.id}
                    className={`${step.done ? 'is-done' : ''} ${selected ? 'is-current' : ''}`.trim()}
                  >
                    <button
                      type="button"
                      className="wholesale-onboard-dot"
                      title={step.label}
                      aria-label={`${step.label}${step.done ? ' — done' : selected ? ' — showing' : ''}`}
                      aria-pressed={selected}
                      onClick={() => setPreviewId(step.id)}
                    />
                  </li>
                )
              })}
            </ol>
          ) : null}
          <ul className="store-page-trust">
            {deskPulse.map((stat) => (
              <li key={stat.key}>
                <button
                  type="button"
                  className={`desk-pulse-link wholesale-desk-hero-chip${
                    stat.urgent ? ' is-pulse-urgent' : ''
                  }${stat.key === 'sealed' ? ' is-pulse-sealed' : ''}`}
                  onClick={() => go(stat.href, stat.key)}
                >
                  {stat.label}
                </button>
              </li>
            ))}
            {showOnboard && setupTo && setupCta ? (
              <li>
                <button
                  type="button"
                  className="desk-pulse-link wholesale-desk-hero-chip"
                  onClick={() => go(setupTo)}
                >
                  {setupCta} →
                </button>
              </li>
            ) : null}
            {!deskPulse.length && !showOnboard ? (
              <li>
                <button
                  type="button"
                  className="desk-pulse-link wholesale-desk-hero-chip"
                  onClick={() => go('/auctions')}
                >
                  {pages.wholesaleMyDeskGo}
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </section>
  )
}
