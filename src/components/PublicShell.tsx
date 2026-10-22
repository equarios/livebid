import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AppToastHost } from './AppToast'
import { BrandLogo } from './BrandLogo'
import { LotPreviewProvider } from './LotPreview'
import { ConsumerNav } from './ConsumerNav'
import { HelpMenu } from './HelpMenu'
import { LanguageMenu } from './LanguageMenu'
import { MeMenu } from './MeMenu'
import { NoticeBell } from './NoticeBell'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'
import { HeaderDeskPulse } from './HeaderDeskPulse'
import { WholesaleCatSubnav } from './WholesaleCatSubnav'
import { canUseWholesaleDesk } from '../lib/channelAccess'
import { useWatchFilterNotices } from '../lib/useWatchFilterNotices'
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
      <NavLink to="/sellers">{settings.copy.navSellers}</NavLink>
      <NavLink to="/wholesale/c">Categories</NavLink>
      {settings.features.register ? <NavLink to="/register">{settings.copy.navApply}</NavLink> : null}
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
  const [panel, setPanel] = useState<'me' | 'lang' | 'notes' | null>(null)
  const consumer = mode === 'consumer'
  const deskOk = canUseWholesaleDesk(user, isStaff)
  const showCatSubnav =
    !consumer &&
    (location.pathname === '/wholesale' || location.pathname.startsWith('/wholesale/'))
  useWatchFilterNotices()

  useEffect(() => {
    setQ(new URLSearchParams(location.search).get('q') || '')
  }, [location.search])

  /* Route change — collapse Menu / panels so they don’t stay “stuck” open. */
  useEffect(() => {
    setNavOpen(false)
    setPanel(null)
  }, [location.pathname])

  useEffect(() => {
    if (!navOpen) return
    function onPointer(e: PointerEvent) {
      const root = document.querySelector('.pub-header')
      if (!root) return
      const t = e.target
      if (!(t instanceof Node)) return
      const toggle = root.querySelector('.nav-toggle')
      const links = root.querySelector('.pub-links')
      if (toggle?.contains(t) || links?.contains(t)) return
      setNavOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setNavOpen(false)
    }
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [navOpen])

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
    : location.pathname.startsWith('/marketplace')
      ? settings.copy.searchMarket
      : location.pathname.startsWith('/auctions')
        ? settings.copy.searchAuctions
        : settings.copy.searchGeneric

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const qs = q.trim()
    const query = qs ? `?q=${encodeURIComponent(qs)}` : ''
    if (consumer) {
      navigate(`/store${query}`)
      return
    }
    if (!user) {
      /* Guests search the wholesale deal board — empty query still goes to For Buyers. */
      navigate(qs ? `/wholesale${query}` : '/buyers')
      return
    }
    if (!deskOk) {
      navigate('/account')
      return
    }
    const path = location.pathname.startsWith('/marketplace')
      ? '/marketplace'
      : location.pathname.startsWith('/auctions')
        ? '/auctions'
        : location.pathname.startsWith('/wholesale')
          ? '/wholesale'
          : settings.showAuctions
            ? '/auctions'
            : '/marketplace'
    navigate(`${path}${query}`)
  }

  return (
    <LotPreviewProvider>
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
          <div className="pub-util">
            {!consumer && deskOk ? <HeaderDeskPulse /> : null}
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
                <SiteNav open={navOpen} onNavigate={() => setNavOpen(false)} />
              ) : (
                <GuestWholesaleNav onNavigate={() => setNavOpen(false)} />
              )}
              <HelpMenu onNavigate={() => setNavOpen(false)} />
              <MeMenu
                mode={consumer ? 'consumer' : 'wholesale'}
                onNavigate={() => setNavOpen(false)}
                onOpen={() => setPanel('me')}
                onClose={() => setPanel((p) => (p === 'me' ? null : p))}
                closeWhen={panel === 'lang' || panel === 'notes'}
              />
              <div className="topbar-icon-pair">
                <NoticeBell
                  closeWhen={panel === 'me' || panel === 'lang'}
                  onOpen={() => setPanel('notes')}
                  onClose={() => setPanel((p) => (p === 'notes' ? null : p))}
                />
                <LanguageMenu
                  onOpen={() => setPanel('lang')}
                  onClose={() => setPanel((p) => (p === 'lang' ? null : p))}
                  closeWhen={panel === 'me' || panel === 'notes'}
                />
              </div>
            </div>
          </div>
        </div>
        {showCatSubnav ? <WholesaleCatSubnav /> : null}
      </header>
      <div className="pub-body">{children}</div>
      <SiteFooter />
      <AppToastHost />
    </div>
    </LotPreviewProvider>
  )
}
