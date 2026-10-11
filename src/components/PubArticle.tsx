import type { ReactNode } from 'react'

/** Shared public marketing article — one composition under PublicShell. */
export function PubArticle({
  kicker,
  title,
  lead,
  children,
  actions,
}: {
  kicker: string
  title: string
  lead: string
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <article className="pub-article">
      <header className="pub-article-hero">
        <p className="kicker">{kicker}</p>
        <h1>{title}</h1>
        <p className="pub-article-lead">{lead}</p>
        {actions ? <div className="pub-article-actions">{actions}</div> : null}
      </header>
      {children ? <div className="pub-article-body">{children}</div> : null}
    </article>
  )
}
