import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from './BrandLogo'
import { LotPreviewProvider } from './LotPreview'
import { SiteNav } from './SiteNav'
import { useStore } from '../store'

export function Layout() {
  const { user, logout, notices, settings, markNoticesRead } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const myNotices = notices.filter((n) => n.accountId === user?.accountId).slice(0, 12)
  const unread = myNotices.filter((n) => !n.read).length
  const home = '/'
  const myPage = location.pathname.startsWith('/account')
  const displayName = (user?.company || user?.accountId || 'Account').replace(/\w\S*/g, (w) =>
    w[0].toUpperCase() + w.slice(1).toLowerCase(),
  )

  return (
    <LotPreviewProvider>
      <div className="app-shell">
        <header className="app-header">
          <div className="topbar">
            <button className="brand" type="button" onClick={() => navigate(home)}>
              <BrandLogo />
            </button>
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
                        logout()
                        window.location.assign('/')
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
        <main className={`page ${myPage ? 'page-mypage' : ''}`}>
          {settings.features.siteNotice && settings.copy.siteNotice.trim() && !myPage ? (
            <div className="site-notice" role="status">
              {settings.copy.siteNotice}
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </LotPreviewProvider>
  )
}
