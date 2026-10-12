import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { publicHome, wholesaleHome } from '../lib/channelAccess'
import { useStore } from '../store'
import type { User } from '../types'

export type MeMenuMode = 'consumer' | 'wholesale' | 'app'

function accountLabel(user: User) {
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim()
  if (name) return name.split(/\s+/)[0]
  if (user.company?.trim()) return user.company.trim().split(/\s+/)[0]
  return user.accountId
}

/** Shared account chrome — GoDaddy-style Sign In / Create Account / Account ▾. */
export function MeMenu({
  mode = 'consumer',
  onNavigate,
  onOpen,
  onClose,
  closeWhen,
}: {
  mode?: MeMenuMode
  onNavigate?: () => void
  onOpen?: () => void
  onClose?: () => void
  closeWhen?: boolean
}) {
  const { user, settings, logout, isStaff, isSuperAdmin } = useStore()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const meOn =
    location.pathname.startsWith('/account') ||
    location.pathname === '/login' ||
    location.pathname === '/register'

  const afterLogin = wholesaleHome(settings)
  const afterLogout = publicHome(settings)

  useEffect(() => {
    if (closeWhen) setOpen(false)
  }, [closeWhen])

  function close() {
    setOpen(false)
    onClose?.()
    onNavigate?.()
  }

  if (!user) {
    return (
      <div className="gd-auth-cluster">
        <Link
          to="/login"
          state={{ from: afterLogin }}
          className="gd-util-link"
          onClick={() => onNavigate?.()}
        >
          Sign In
        </Link>
        {settings.features.register ? (
          <Link
            to="/register"
            state={{ from: afterLogin }}
            className="gd-cta"
            onClick={() => onNavigate?.()}
          >
            Create Account
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <div className={`help-menu me-menu gd-util ${open ? 'open' : ''}`}>
      <button
        type="button"
        className={`gd-util-btn ${meOn || open ? 'active' : ''}`}
        aria-label="Account menu"
        aria-expanded={open}
        title="Account"
        onClick={(e) => {
          e.stopPropagation()
          if (open) {
            setOpen(false)
            onClose?.()
          } else {
            setOpen(true)
            onOpen?.()
          }
        }}
      >
        {accountLabel(user)}
        <span className="gd-chevron" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="help-menu-panel me-menu-panel gd-util-panel" onClick={(e) => e.stopPropagation()}>
          <p className="me-menu-who" title={user.email || user.accountId}>
            {user.company || user.accountId}
          </p>
          {mode === 'consumer' ? (
            <NavLink to="/store/orders" onClick={close}>
              Orders
            </NavLink>
          ) : null}
          <NavLink to="/account" onClick={close}>
            My Page
          </NavLink>
          <NavLink to="/account/documents" onClick={close}>
            Documents
          </NavLink>
          {mode === 'app' || mode === 'wholesale' ? (
            <NavLink to="/account/settings" onClick={close}>
              Account settings
            </NavLink>
          ) : null}
          <button
            type="button"
            className="me-menu-action"
            onClick={() => {
              close()
              void logout().then(() => {
                window.location.assign(afterLogout)
              })
            }}
          >
            {settings.copy.signOut || 'Sign out'}
          </button>
          {isStaff ? (
            <NavLink to="/admin" onClick={close}>
              {settings.copy.navAdmin}
            </NavLink>
          ) : null}
          {isSuperAdmin ? (
            <NavLink to="/super" onClick={close}>
              {settings.copy.navSuper}
            </NavLink>
          ) : null}
          {isStaff && settings.showStore && mode !== 'consumer' ? (
            <NavLink to="/" className="me-menu-switch" onClick={close}>
              Consumer store
            </NavLink>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
