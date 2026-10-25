import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type MyPageTrustLink = { to: string; label: string }

/** Compact desk hero for My Page outlets (Documents, Settings, More tabs). */
export function MyPageHead({
  title,
  count,
  note,
  trust,
  children,
}: {
  title: string
  count?: string | number | null
  note: string
  trust?: MyPageTrustLink[]
  children?: ReactNode
}) {
  const showCount = count != null && count !== ''
  return (
    <header className="mypage-head-hero ending-soon-chip is-hero" aria-label={title}>
      <div className="ending-soon-hero-body">
        <h2 className="ending-soon-hero-title">
          {title}
          {showCount ? <em className="store-page-hero-count">{count}</em> : null}
        </h2>
        <p className="ending-soon-hero-note">{note}</p>
        {trust?.length ? (
          <ul className="store-page-trust">
            {trust.map((t) => (
              <li key={t.to}>
                <Link to={t.to}>{t.label}</Link>
              </li>
            ))}
          </ul>
        ) : null}
        {children}
      </div>
    </header>
  )
}
