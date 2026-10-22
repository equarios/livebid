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

/** Shared Help chrome — breadcrumb, title, lead, topic tabs. No marketing lander. */
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
  const mode = canUseWholesaleDesk(user, isStaff) ? 'wholesale' : 'consumer'
  const helpLabel = settings.copy.navHelp

  return (
    <PublicShell mode={mode}>
      <div className="help-page">
        <header className="help-page-head">
          <p className="help-page-crumb">
            <span>{helpLabel}</span>
            <span aria-hidden> / </span>
            <span>{title}</span>
          </p>
          <h1>{title}</h1>
          <p className="help-page-lead muted">{lead}</p>
          <nav className="help-page-tabs" aria-label={helpLabel}>
            {TABS.map((t) => {
              const label =
                t.labelKey === 'navSupport'
                  ? settings.copy.navSupport
                  : t.labelKey === 'navTutorial'
                    ? settings.copy.navTutorial
                    : t.label || ''
              return (
                <NavLink
                  key={t.id}
                  to={t.to}
                  end
                  className={({ isActive }) =>
                    `help-page-tab${isActive || page === t.id ? ' is-on' : ''}`
                  }
                >
                  {label}
                </NavLink>
              )
            })}
          </nav>
        </header>
        <div className="help-page-body">{children}</div>
      </div>
    </PublicShell>
  )
}
