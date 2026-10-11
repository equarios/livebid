import type { ReactNode } from 'react'
import { resolveDeskBannerSlides } from '../lib/deskBanner'
import type { DeskBannerKey } from '../types'
import { useStore } from '../store'
import { AuctionTypeHead } from './AuctionTypeHead'
import { DeskIntro } from './DeskIntro'

export type OpsDesk = {
  id: string
  label: string
  count?: number
}

export type OpsSection = {
  id: string
  label: string
  count?: number
  desks?: OpsDesk[]
}

type Props = {
  /** Which Super-editable workbench banner to show. */
  deskKey: Extract<DeskBannerKey, 'admin' | 'super'>
  /** Fallback title when desk banner title is empty (legacy). */
  title?: string
  /** Fallback blurb when desk banner body is empty (legacy). */
  blurb?: string
  sections: OpsSection[]
  section: string
  desk?: string
  onSection: (id: string) => void
  onDesk?: (id: string) => void
  actions?: ReactNode
  children: ReactNode
}

export function OpsShell({
  deskKey,
  title,
  blurb,
  sections,
  section,
  desk,
  onSection,
  onDesk,
  actions,
  children,
}: Props) {
  const { settings } = useStore()
  const slides = resolveDeskBannerSlides(settings, deskKey).map((s, i) =>
    i === 0
      ? {
          ...s,
          title: s.title || title || (deskKey === 'super' ? 'Super admin' : 'Admin'),
          body: s.body || blurb || 'Staff operations desk.',
        }
      : s,
  )
  const heading = slides[0]?.title || title || (deskKey === 'super' ? 'Super admin' : 'Admin')
  const current = sections.find((s) => s.id === section) || sections[0]
  const desks = current?.desks || []
  const activeDesk = desks.some((d) => d.id === desk) ? desk : desks[0]?.id

  return (
    <div className="staff-page is-command-bar ops-page desk-page">
      <DeskIntro
        brand={settings.brandName || 'eQuarios'}
        slides={slides}
        intervalSec={settings.pages?.heroIntervalSec}
        veil="ops"
        label={heading}
      />
      <section className="auction-type-block is-solo ops-desk">
        <AuctionTypeHead>
          <div className="auction-command">
            <nav className="ops-nav" aria-label={`${heading} sections`}>
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`ops-nav-btn ${current?.id === s.id ? 'on' : ''}`}
                  onClick={() => onSection(s.id)}
                >
                  {s.label}
                  {s.count ? <em>{s.count}</em> : null}
                </button>
              ))}
            </nav>
            {actions ? <div className="ops-nav-actions">{actions}</div> : null}
          </div>
        </AuctionTypeHead>

        {desks.length > 1 ? (
          <div className="ops-subnav" role="tablist" aria-label="Desk">
            {desks.map((d) => (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={activeDesk === d.id}
                className={`ops-subnav-btn ${activeDesk === d.id ? 'on' : ''}`}
                onClick={() => onDesk?.(d.id)}
              >
                {d.label}
                {d.count ? <em>{d.count}</em> : null}
              </button>
            ))}
          </div>
        ) : null}

        <div className="ops-body">{children}</div>
      </section>
    </div>
  )
}
