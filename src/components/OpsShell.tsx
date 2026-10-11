import type { ReactNode } from 'react'
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
  title: string
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
  const current = sections.find((s) => s.id === section) || sections[0]
  const desks = current?.desks || []
  const activeDesk = desks.some((d) => d.id === desk) ? desk : desks[0]?.id

  return (
    <div className="staff-page is-command-bar ops-page desk-page">
      <DeskIntro
        brand={settings.brandName || 'Equarios'}
        title={title}
        body={blurb || 'Staff operations desk.'}
      />
      <section className="auction-type-block is-solo ops-desk">
        <AuctionTypeHead>
          <div className="auction-command">
            <nav className="ops-nav" aria-label={`${title} sections`}>
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
