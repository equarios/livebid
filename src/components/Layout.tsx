import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from './BrandLogo'
import { HelpMenu } from './HelpMenu'
import { LotPreviewProvider } from './LotPreview'
import { SiteNav } from './SiteNav'
import { SiteWarnPopup } from './SiteWarnPopup'
import { useStore } from '../store'

function searchTarget(pathname: string, showAuctions: boolean, showMarketplace: boolean) {
  if (pathname.startsWith('/marketplace')) return '/marketplace'
  if (pathname.startsWith('/auctions')) return '/auctions'
  if (showAuctions) return '/auctions'
  if (showMarketplace) return '/marketplace'
  return '/auctions'
}

export function Layout() {
  const { user, logout, notices, settings, markNoticesRead } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('q') || '')
  const headerRef = useRef<HTMLElement>(null)

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

  const myNotices = notices.filter((n) => n.accountId === user?.accountId).slice(0, 12)
  const unread = myNotices.filter((n) => !n.read).length
  const home = '/'
  const myPage = location.pathname.startsWith('/account')
  const displayName = (user?.company || user?.accountId || 'Account').replace(/\w\S*/g, (w) =>
    w[0].toUpperCase() + w.slice(1).toLowerCase(),
  )
  const placeholder =
    location.pathname.startsWith('/marketplace')
      ? settings.copy.searchMarket
      : settings.copy.searchAuctions
  const onShopList =
    location.pathname.startsWith('/auctions') || location.pathname.startsWith('/marketplace')

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
            <div className={navOpen ? 'is-open site-nav-wrap' : 'site-nav-wrap'}>
              <SiteNav onNavigate={() => setNavOpen(false)} />
            </div>
            <div className="topbar-user">
              <HelpMenu
                closeWhen={notesOpen || menuOpen}
                onOpen={() => {
                  setNotesOpen(false)
                  setMenuOpen(false)
                }}
              />
              <div className={`notice-menu ${notesOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="notice-bell"
                  aria-label="Notifications"
                  onClick={() => {
                    setNotesOpen((v) => !v)
                    setMenuOpen(false)
                    markNoticesRead()
                  }}
                >
                  🔔
                  {unread > 0 ? <em>{unread}</em> : null}
                </button>
                {notesOpen ? (
                  <div className="notice-panel">
                    <strong>Notifications</strong>
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
                      <p className="muted tiny">No notifications yet.</p>
                    )}
                  </div>
                ) : null}
              </div>
              <div className={`user-menu ${menuOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="user-menu-btn"
                  onClick={() => {
                    setMenuOpen((v) => !v)
                    setNotesOpen(false)
                  }}
                >
                  {displayName}
                  <span aria-hidden>▾</span>
                </button>
                {menuOpen ? (
                  <div className="user-menu-panel">
                    <div className="muted tiny">{user?.accountId}</div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setMenuOpen(false)
                        navigate('/account/settings')
                      }}
                    >
                      Account settings
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setMenuOpen(false)
                        void logout().then(() => window.location.assign('/'))
                      }}
                    >
                      {settings.copy.signOut}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>
        <SiteWarnPopup />
        <main className={`page ${myPage ? 'page-mypage' : ''}`}>
          <Outlet />
        </main>
      </div>
    </LotPreviewProvider>
  )
}
