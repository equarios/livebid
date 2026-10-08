import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from './BrandLogo'

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="bstock-auth">
      <aside className="bstock-auth-aside">
        <Link to="/" className="bstock-auth-logo">
          <BrandLogo size="auth" />
        </Link>
        <h2>Find millions of products for all your inventory needs</h2>
        <div className="bstock-auth-art" aria-hidden>
          <svg viewBox="0 0 320 240" width="280" height="210">
            <rect x="24" y="36" width="170" height="118" rx="12" fill="#3d6db5" />
            <rect x="38" y="52" width="142" height="14" rx="4" fill="#8fb4ea" />
            <circle cx="198" cy="118" r="28" fill="#f4c542" />
            <rect x="150" y="128" width="86" height="72" rx="8" fill="#e8eef8" />
            <rect x="48" y="168" width="70" height="48" rx="6" fill="#c9d7ea" />
            <rect x="210" y="40" width="72" height="56" rx="8" fill="#f3d27a" />
          </svg>
        </div>
      </aside>
      <section className="bstock-auth-main">{children}</section>
    </div>
  )
}
