import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from './BrandLogo'
import { HelpMenu } from './HelpMenu'
import { LanguageMenu } from './LanguageMenu'
import { LotPreviewProvider } from './LotPreview'
import { MeMenu } from './MeMenu'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'
import { SiteWarnPopup } from './SiteWarnPopup'
import { canUseWholesaleDesk, wholesaleHome } from '../lib/channelAccess'
import { useDismissOnOutside } from '../lib/useDismissOnOutside'
import { useStore } from '../store'

function searchTarget(pathname: string, showAuctions: boolean, showMarketplace: boolean) {
  if (pathname.startsWith('/marketplace')) return '/marketplace'
  if (pathname.startsWith('/auctions')) return '/auctions'
  if (showAuctions) return '/auctions'
  if (showMarketplace) return '/marketplace'
  return '/auctions'
}

export function Layout() {
  const { user, notices, settings, markNoticesRead, isStaff } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('q') || '')
  const headerRef = useRef<HTMLElement>(null)
  const noticeRef = useRef<HTMLDivElement>(null)

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

  useDismissOnOutside(notesOpen, noticeRef, () => setNotesOpen(false))

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

  const myNotices = notices.filter((n) => n.accountId === user?.accountId).slice(0, 12)
  const unread = myNotices.filter((n) => !n.read).length
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
              <HelpMenu
                closeWhen={notesOpen || menuOpen || navOpen}
                onOpen={closeOtherChrome}
                onClose={() => setMenuOpen(false)}
              />
              <div className={`notice-menu ${notesOpen ? 'open' : ''}`} ref={noticeRef}>
                <button
                  type="button"
                  className="notice-bell"
                  aria-label={settings.copy.navNotifications}
                  aria-expanded={notesOpen}
                  onClick={() => {
                    setNotesOpen((v) => !v)
                    setMenuOpen(false)
                    setNavOpen(false)
                    markNoticesRead()
                  }}
                >
                  🔔
                  {unread > 0 ? <em>{unread}</em> : null}
                </button>
                {notesOpen ? (
                  <div className="notice-panel">
                    <strong>{settings.copy.navNotifications}</strong>
                    {myNotices.length ? (
                      myNotices.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          className={`notice-item ${n.read ? '' : 'is-new'}`}
                          onClick={() => {
                            setNotesOpen(false)
                            navigate(n.href)
                          }}
                        >
                          <span>{n.title}</span>
                          <span className="muted tiny">{n.body}</span>
                        </button>
                      ))
                    ) : (
                      <p className="muted tiny">—</p>
                    )}
                  </div>
                ) : null}
              </div>
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
              <LanguageMenu
                closeWhen={notesOpen || menuOpen || navOpen}
                onOpen={closeOtherChrome}
              />
            </div>
          </div>
        </header>
        <SiteWarnPopup />
        <main className={`page ${myPage ? 'page-mypage' : ''}`}>
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </LotPreviewProvider>
  )
}
