import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDismissOnOutside } from '../lib/useDismissOnOutside'
import { useStore } from '../store'

/** Round header notifications control — same look on desk + store shells. */
export function NoticeBell({
  closeWhen,
  onOpen,
  onClose,
}: {
  closeWhen?: boolean
  onOpen?: () => void
  onClose?: () => void
}) {
  const { user, notices, settings, markNoticesRead } = useStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const myNotices = user
    ? notices.filter((n) => n.accountId === user.accountId).slice(0, 12)
    : []
  const unread = myNotices.filter((n) => !n.read).length

  useEffect(() => {
    if (closeWhen) setOpen(false)
  }, [closeWhen])

  useDismissOnOutside(open, rootRef, () => {
    setOpen(false)
    onClose?.()
  })

  if (!user) return null

  return (
    <div className={`notice-menu ${open ? 'open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="notice-bell"
        aria-label={settings.copy.navNotifications}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => {
            const next = !v
            if (next) {
              onOpen?.()
              markNoticesRead()
            } else onClose?.()
            return next
          })
        }}
      >
        🔔
        {unread > 0 ? <em>{unread}</em> : null}
      </button>
      {open ? (
        <div className="notice-panel">
          <strong>{settings.copy.navNotifications}</strong>
          {myNotices.length ? (
            myNotices.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`notice-item ${n.read ? '' : 'is-new'}`}
                onClick={() => {
                  setOpen(false)
                  onClose?.()
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
  )
}
