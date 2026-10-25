import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { PublicShell } from './PublicShell'
import { canUseWholesaleDesk } from '../lib/channelAccess'
import { useStore } from '../store'

export type HelpPageId = 'device-spec' | 'info' | 'tutorial' | 'support'

const TABS: {
  id: HelpPageId
  to: string
  labelKey?: 'navSupport' | 'navTutorial'
  label?: string
}[] = [
  { id: 'device-spec', to: '/device-spec', label: 'Device spec' },
  { id: 'info', to: '/info', label: 'Info' },
  { id: 'tutorial', to: '/tutorial', labelKey: 'navTutorial' },
  { id: 'support', to: '/support', labelKey: 'navSupport' },
]

/** Shared Help chrome — hero chip + topic chips (same language as Categories / desk). */
export function HelpLayout({
  page,
  title,
  lead,
  children,
}: {
  page: HelpPageId
  title: string
  lead: string
  children: ReactNode
}) {
  const { user, isStaff, settings } = useStore()
  /* Match store header for guests/pending; desk buyers keep wholesale SiteNav. */
  const mode = canUseWholesaleDesk(user, isStaff) ? 'wholesale' : 'consumer'
  const helpLabel = settings.copy.navHelp

  const tabLabels = TABS.map((t) => {
    const label =
      t.labelKey === 'navSupport'
        ? settings.copy.navSupport
        : t.labelKey === 'navTutorial'
          ? settings.copy.navTutorial
          : t.label || ''
    return { ...t, label }
  })

  return (
    <PublicShell mode={mode}>
      <div className="help-page">
        <header className="help-page-hero ending-soon-chip is-hero" aria-label={title}>
          <div className="ending-soon-hero-body">
            <p className="help-page-crumb">
              {helpLabel}
              <span aria-hidden> / </span>
              {title}
            </p>
            <h1 className="ending-soon-hero-title">
              {title}
              <em className="store-page-hero-count">{TABS.length}</em>
            </h1>
            <p className="ending-soon-hero-note">{lead}</p>
            <ul className="store-page-trust">
              {tabLabels.map((t) => (
                <li key={t.id}>
                  <NavLink to={t.to} end className={({ isActive }) => (isActive || page === t.id ? 'is-on' : undefined)}>
                    {t.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </header>

        <nav className="help-page-topics seo-cat-facet-strip" aria-label={helpLabel}>
          <h2 className="help-page-topics-label">Topics</h2>
          <ul className="seo-cat-chips help-page-chips">
            {tabLabels.map((t) => (
              <li key={t.id}>
                <NavLink
                  to={t.to}
                  end
                  className={({ isActive }) => (isActive || page === t.id ? 'is-active' : undefined)}
                >
                  {t.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="help-page-body">{children}</div>
      </div>
    </PublicShell>
  )
}
