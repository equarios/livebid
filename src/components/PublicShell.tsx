import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { BrandLogo } from './BrandLogo'
import { SiteNav } from './SiteNav'
import { useStore } from '../store'

export function PublicShell({ children }: { children: ReactNode }) {
  const { user, settings } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [navOpen, setNavOpen] = useState(false)

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const qs = q.trim()
    if (!user) {
      navigate(qs ? `/?q=${encodeURIComponent(qs)}` : '/')
      return
    }
    navigate(`/auctions${qs ? `?q=${encodeURIComponent(qs)}` : ''}`)
  }

  return (
    <div className="pub">
      <header className="pub-header">
        <div className="pub-header-row">
          <Link to="/" className="pub-logo">
            <BrandLogo />
          </Link>
          <form className="pub-search" onSubmit={onSearch}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for auctions by category, product, seller..."
              aria-label="Search"
            />
            <button type="submit" aria-label="Submit search">
              ⌕
            </button>
          </form>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={navOpen}
            aria-label="Menu"
            onClick={() => setNavOpen((v) => !v)}
          >
            Menu
          </button>
          <div className={`pub-links ${navOpen ? 'is-open' : ''}`}>
            <SiteNav onNavigate={() => setNavOpen(false)} />
            {user ? null : (
              <>
                <Link className="pub-btn" to="/login">
                  Sign In
                </Link>
                {settings.features.register ? (
                  <Link className="pub-btn pub-btn-fill" to="/register">
                    Register Now
                  </Link>
                ) : null}
              </>
            )}
          </div>
        </div>
      </header>
      <div className="pub-body">{children}</div>
      <footer className="pub-footer">
        <Link to="/" className="pub-logo">
          <BrandLogo size="footer" />
        </Link>
        <div>
          <NavLink to="/buyers">For Buyers</NavLink>
          <NavLink to="/sellers">For Sellers</NavLink>
          <NavLink to="/support">Support</NavLink>
          <NavLink to="/login">Sign In</NavLink>
          <NavLink to="/register">Register Now</NavLink>
        </div>
        <p>
          {settings.brandName} · {settings.tagline}
        </p>
      </footer>
    </div>
  )
}
