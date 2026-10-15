import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { buildDeskPulse } from '../lib/deskPulse'
import { parsePulseKey, PULSE_QUERY } from '../lib/deskPulseNav'
import {
  loadPulseKey,
  preferRememberedPulse,
  rememberPulseKey,
} from '../lib/pulseMemory'
import { countWatchFilterMatches } from '../lib/watchFilters'
import { DEFAULT_SETTINGS } from '../data'
import { useNow, useStore } from '../store'

type Props = {
  /** When true, hide the bar if there is nothing actionable. */
  hideWhenEmpty?: boolean
}

/** Shared Your-desk pulse — wholesale hub + My Page overview. */
export function WholesaleDeskPulseBar({ hideWhenEmpty }: Props) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const now = useNow()
  const { user, lots, bids, offers, invoices, settings } = useStore()
  const pages = { ...DEFAULT_SETTINGS.pages, ...settings.pages }
  const pulseKey = parsePulseKey(params.get(PULSE_QUERY))

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
        document.querySelector(path === '#wholesale-ending-soon' ? '#wholesale-ending-soon' : path)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return
    }
    navigate(path)
  }, [pulseKey, deskPulse, user, lots.length, params, setParams, navigate])

  if (!user) return null
  if (hideWhenEmpty && !deskPulse.length) return null

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

  const primary = deskPulse[0]

  return (
    <section className="pub-section wholesale-my-desk" aria-label={pages.wholesaleMyDeskLabel}>
      <div
        className={`wholesale-my-desk-bar${deskPulse.some((s) => s.urgent) ? ' is-urgent' : ''}`}
      >
        <span className="wholesale-my-desk-label">{pages.wholesaleMyDeskLabel}</span>
        <span className="wholesale-my-desk-stats">
          {deskPulse.length ? (
            deskPulse.map((stat, i) => (
              <span key={stat.key}>
                {i > 0 ? <span aria-hidden> · </span> : null}
                <button
                  type="button"
                  className={`desk-pulse-link${stat.urgent ? ' is-pulse-urgent' : ''}${
                    stat.key === 'sealed' ? ' is-pulse-sealed' : ''
                  }`}
                  onClick={() => go(stat.href, stat.key)}
                >
                  <strong>{stat.label}</strong>
                </button>
              </span>
            ))
          ) : (
            <span>No open bids or offers — browse desks below</span>
          )}
        </span>
        <button
          type="button"
          className="wholesale-my-desk-go"
          onClick={() =>
            go(
              primary?.href === '#wholesale-ending-soon'
                ? '/wholesale'
                : primary?.href || '/account',
              primary?.key,
            )
          }
        >
          {primary?.href === '#wholesale-ending-soon'
            ? `${pages.wholesaleEndingSoonTitle} →`
            : primary
              ? 'Open →'
              : pages.wholesaleMyDeskGo}
        </button>
      </div>
    </section>
  )
}
