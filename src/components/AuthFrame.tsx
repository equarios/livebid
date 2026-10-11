import type { ReactNode } from 'react'
import { DEFAULT_SETTINGS } from '../data'
import { useStore } from '../store'
import { PublicShell } from './PublicShell'

export function AuthFrame({ children }: { children: ReactNode }) {
  const { settings } = useStore()
  const pages = { ...DEFAULT_SETTINGS.pages, ...settings.pages }
  return (
    <PublicShell mode="consumer">
      <div className="bstock-auth-page">
        <div className="bstock-auth">
          <aside className="bstock-auth-aside" aria-hidden={false}>
            <div className="bstock-auth-aside-bg" aria-hidden />
            <p className="bstock-auth-brand">{pages.authBrand}</p>
            <h2>{pages.authTitle}</h2>
            <p className="bstock-auth-aside-lead">{pages.authLead}</p>
          </aside>
          <section className="bstock-auth-main">
            <div className="bstock-auth-card">{children}</div>
          </section>
        </div>
      </div>
    </PublicShell>
  )
}
