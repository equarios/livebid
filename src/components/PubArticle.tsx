import type { ReactNode } from 'react'

/** Public marketing page — Store-grade full-bleed hero + one body section. */
export function PubArticle({
  brand,
  title,
  lead,
  photo,
  sectionTitle,
  children,
  actions,
}: {
  brand: string
  title: string
  lead: string
  photo: string
  sectionTitle?: string
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="pub-land">
      <section className="land-hero pub-land-hero" aria-label={brand}>
        <div className="land-hero-media" aria-hidden>
          <div className="land-hero-photo" style={{ backgroundImage: `url(${photo})` }} />
          <div className="land-hero-veil is-wholesale" />
          <div className="land-hero-grain" />
        </div>
        <div className="land-hero-copy">
          <p className="land-hero-brand">{brand}</p>
          <h1>{title}</h1>
          <p className="land-hero-lead">{lead}</p>
          {actions ? <div className="land-hero-cta">{actions}</div> : null}
        </div>
      </section>
      {children ? (
        <section className="pub-land-body how-strip" aria-label={sectionTitle || 'Details'}>
          {sectionTitle ? <h2>{sectionTitle}</h2> : null}
          {children}
        </section>
      ) : null}
    </div>
  )
}
