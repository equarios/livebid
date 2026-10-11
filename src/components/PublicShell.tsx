import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { BrandLogo } from './BrandLogo'
import { ConsumerNav } from './ConsumerNav'
import { HelpMenu } from './HelpMenu'
import { MeMenu } from './MeMenu'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'
import { canUseWholesaleDesk } from '../lib/channelAccess'
import { useStore } from '../store'

type ShellMode = 'consumer' | 'wholesale'

/** Marketing / apply chrome for guests on wholesale-facing pages. */
function GuestWholesaleNav({ onNavigate }: { onNavigate?: () => void }) {
  const { settings } = useStore()
  return (
    <nav
      className="site-nav"
      onClick={() => {
        onNavigate?.()
      }}
    >
      <NavLink to="/buyers">For Buyers</NavLink>
      {settings.features.register ? <NavLink to="/register">Apply</NavLink> : null}
      <NavLink to="/support">Support</NavLink>
    </nav>
  )
}

export function PublicShell({
  children,
  mode = 'consumer',
}: {
  children: ReactNode
  mode?: ShellMode
}) {
  const { user, settings, isStaff } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [navOpen, setNavOpen] = useState(false)
  const [panel, setPanel] = useState<'help' | 'me' | null>(null)
  const consumer = mode === 'consumer'
  const deskOk = canUseWholesaleDesk(user, isStaff)

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const qs = q.trim()
    if (consumer) {
      navigate(qs ? `/?q=${encodeURIComponent(qs)}` : '/')
      return
    }
    if (!user) {
      navigate(qs ? `/buyers?q=${encodeURIComponent(qs)}` : '/buyers')
      return
    }
    if (!deskOk) {
      navigate('/account')
      return
    }
    navigate(`/auctions${qs ? `?q=${encodeURIComponent(qs)}` : ''}`)
  }

  return (
    <div className={`pub ${consumer ? 'is-consumer' : 'is-wholesale'}`}>
      <header className="pub-header">
        <div className="pub-header-row">
          <Link
            to={consumer ? '/' : deskOk ? '/wholesale' : user ? '/account' : '/buyers'}
            className="pub-logo"
          >
            <BrandLogo />
          </Link>
          <form className="pub-search" onSubmit={onSearch}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                consumer
                  ? 'Search store products…'
                  : deskOk
                    ? 'Search wholesale auctions…'
                    : 'Search…'
              }
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
            {consumer ? (
              <ConsumerNav onNavigate={() => setNavOpen(false)} />
            ) : deskOk ? (
              <SiteNav onNavigate={() => setNavOpen(false)} />
            ) : (
              <GuestWholesaleNav onNavigate={() => setNavOpen(false)} />
            )}
            <HelpMenu
              onNavigate={() => setNavOpen(false)}
              onOpen={() => setPanel('help')}
              onClose={() => setPanel((p) => (p === 'help' ? null : p))}
              closeWhen={panel === 'me'}
            />
            <MeMenu
              mode={consumer ? 'consumer' : 'wholesale'}
              onNavigate={() => setNavOpen(false)}
              onOpen={() => setPanel('me')}
              onClose={() => setPanel((p) => (p === 'me' ? null : p))}
              closeWhen={panel === 'help'}
            />
          </div>
        </div>
      </header>
      <div className="pub-body">{children}</div>
      <SiteFooter />
    </div>
  )
}
