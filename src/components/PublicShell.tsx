import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from './BrandLogo'
import { ConsumerNav } from './ConsumerNav'
import { HelpMenu } from './HelpMenu'
import { LanguageMenu } from './LanguageMenu'
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
      <NavLink to="/buyers">{settings.copy.navBuyers}</NavLink>
      <NavLink to="/wholesale/c">Categories</NavLink>
      {settings.features.register ? <NavLink to="/register">{settings.copy.navApply}</NavLink> : null}
      <NavLink to="/support">{settings.copy.navSupport}</NavLink>
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
  const location = useLocation()
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('q') || '')
  const [navOpen, setNavOpen] = useState(false)
  const [panel, setPanel] = useState<'help' | 'me' | null>(null)
  const consumer = mode === 'consumer'
  const deskOk = canUseWholesaleDesk(user, isStaff)

  useEffect(() => {
    setQ(new URLSearchParams(location.search).get('q') || '')
  }, [location.search])

  /* Warm store chunks so catalog / cart feel instant after first public hit. */
  useEffect(() => {
    if (!consumer) return
    void import('../pages/Store')
    void import('../pages/StoreCart')
    void import('../pages/StoreOrders')
    void import('../pages/StoreProduct')
  }, [consumer])

  /** Same wording family as the app header — only the channel word changes. */
  const placeholder = consumer
    ? settings.copy.searchGeneric
    : settings.copy.searchAuctions || settings.copy.searchGeneric

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const qs = q.trim()
    if (consumer) {
      navigate(qs ? `/store?q=${encodeURIComponent(qs)}` : '/store')
      return
    }
    if (!user) {
      /* Guests search the wholesale deal board — empty query still goes to For Buyers. */
      navigate(qs ? `/wholesale?q=${encodeURIComponent(qs)}` : '/buyers')
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
            to={consumer ? '/store' : deskOk ? '/wholesale' : user ? '/account' : '/buyers'}
            className="pub-logo"
          >
            <BrandLogo />
          </Link>
          <form className="pub-search" onSubmit={onSearch} role="search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              aria-label={settings.copy.ariaSearch}
            />
            <button type="submit" aria-label={settings.copy.ariaSubmitSearch}>
              ⌕
            </button>
          </form>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={navOpen}
            aria-label={settings.copy.navMenu}
            onClick={() => setNavOpen((v) => !v)}
          >
            {settings.copy.navMenu}
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
            <LanguageMenu
              onOpen={() => setPanel(null)}
              closeWhen={panel === 'help' || panel === 'me'}
            />
          </div>
        </div>
      </header>
      <div className="pub-body">{children}</div>
      <SiteFooter />
    </div>
  )
}
