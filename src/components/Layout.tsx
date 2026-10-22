import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppToastHost } from './AppToast'
import { BrandLogo } from './BrandLogo'
import { HeaderDeskPulse } from './HeaderDeskPulse'
import { HelpMenu } from './HelpMenu'
import { LanguageMenu } from './LanguageMenu'
import { LotPreviewProvider } from './LotPreview'
import { MeMenu } from './MeMenu'
import { NoticeBell } from './NoticeBell'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'
import { SiteWarnPopup } from './SiteWarnPopup'
import { canUseWholesaleDesk, wholesaleHome } from '../lib/channelAccess'
import { useWatchFilterNotices } from '../lib/useWatchFilterNotices'
import { useStore } from '../store'

function searchTarget(pathname: string, showAuctions: boolean, showMarketplace: boolean) {
  if (pathname.startsWith('/marketplace')) return '/marketplace'
  if (pathname.startsWith('/auctions')) return '/auctions'
  if (showAuctions) return '/auctions'
  if (showMarketplace) return '/marketplace'
  return '/auctions'
}

export function Layout() {
  const { user, settings, isStaff } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('q') || '')
  const headerRef = useRef<HTMLElement>(null)
  useWatchFilterNotices()

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const apply = () => {
      document.documentElement.style.setProperty(
        '--app-header-h',
        `${Math.round(el.getBoundingClientRect().height)}px`,
      )
    }
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    apply()
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty('--app-header-h')
    }
  }, [navOpen, q])

  useEffect(() => {
    setQ(new URLSearchParams(location.search).get('q') || '')
  }, [location.search])

  /* Route change — collapse any stuck header toggles. */
  useEffect(() => {
    setNavOpen(false)
    setNotesOpen(false)
    setMenuOpen(false)
  }, [location.pathname])

  /* Menu toggle + drawer are siblings in .topbar — dismiss if click is outside both. */
  useEffect(() => {
    if (!navOpen) return
    function onPointer(e: PointerEvent) {
      const root = headerRef.current
      if (!root) return
      const t = e.target
      if (!(t instanceof Node)) return
      const toggle = root.querySelector('.nav-toggle')
      const wrap = root.querySelector('.site-nav-wrap')
      if (toggle?.contains(t) || wrap?.contains(t)) return
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

  const home = canUseWholesaleDesk(user, isStaff) ? wholesaleHome(settings) : '/account'
  const myPage = location.pathname.startsWith('/account')
  const placeholder =
    location.pathname.startsWith('/marketplace')
      ? settings.copy.searchMarket
      : settings.copy.searchAuctions
  const onShopList =
    location.pathname.startsWith('/auctions') || location.pathname.startsWith('/marketplace')

  function closeOtherChrome() {
    setNotesOpen(false)
    setMenuOpen(false)
    setNavOpen(false)
  }

  function goSearch(nextQ: string, replace = false) {
    const path = searchTarget(
      location.pathname,
      settings.showAuctions,
      settings.showMarketplace,
    )
    const qs = nextQ.trim()
    navigate(`${path}${qs ? `?q=${encodeURIComponent(qs)}` : ''}`, { replace })
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault()
    goSearch(q, false)
  }

  return (
    <LotPreviewProvider>
      <div className="app-shell">
        <header className="app-header" ref={headerRef}>
          <div className="topbar">
            <button className="brand" type="button" onClick={() => navigate(home)}>
              <BrandLogo />
            </button>
            <form className="app-search" onSubmit={onSearchSubmit} role="search">
              <input
                value={q}
                onChange={(e) => {
                  const next = e.target.value
                  setQ(next)
                  if (onShopList) goSearch(next, true)
                }}
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
              onClick={() => {
                setNavOpen((v) => !v)
                setNotesOpen(false)
                setMenuOpen(false)
              }}
            >
              {settings.copy.navMenu}
            </button>
            <div className={navOpen ? 'is-open site-nav-wrap' : 'site-nav-wrap'}>
              {/* Pass open state onto <nav> too — mobile CSS hides `.topbar nav` unless `.is-open`. */}
              <SiteNav open={navOpen} onNavigate={() => setNavOpen(false)} />
            </div>
            <div className="topbar-user">
              <HeaderDeskPulse />
              <HelpMenu onNavigate={() => setNavOpen(false)} />
              <MeMenu
                mode="app"
                closeWhen={notesOpen || navOpen}
                onOpen={() => {
                  setMenuOpen(true)
                  setNotesOpen(false)
                  setNavOpen(false)
                }}
                onClose={() => setMenuOpen(false)}
              />
              {/* End of bar: bell + language (same round controls). */}
              <div className="topbar-icon-pair">
                <NoticeBell
                  closeWhen={menuOpen || navOpen}
                  onOpen={() => {
                    setNotesOpen(true)
                    setMenuOpen(false)
                    setNavOpen(false)
                  }}
                  onClose={() => setNotesOpen(false)}
                />
                <LanguageMenu
                  closeWhen={notesOpen || menuOpen || navOpen}
                  onOpen={closeOtherChrome}
                />
              </div>
            </div>
          </div>
        </header>
        <SiteWarnPopup />
        <main className={`page ${myPage ? 'page-mypage' : ''}`}>
          <Outlet />
        </main>
        <SiteFooter />
        <AppToastHost />
      </div>
    </LotPreviewProvider>
  )
}
