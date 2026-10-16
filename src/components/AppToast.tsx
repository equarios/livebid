import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { dismissToast, subscribeToast, TOAST_MS, type AppToast as Toast } from '../lib/toast'

export function AppToastHost() {
  const [toast, setToast] = useState<Toast | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [paused, setPaused] = useState(false)
  const hideTimer = useRef(0)
  const leaveTimer = useRef(0)

  function close() {
    window.clearTimeout(hideTimer.current)
    setLeaving(true)
    window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => {
      setToast(null)
      setLeaving(false)
      dismissToast()
    }, 180)
  }

  useEffect(() => {
    return subscribeToast((next) => {
      window.clearTimeout(hideTimer.current)
      window.clearTimeout(leaveTimer.current)
      setLeaving(false)
      setPaused(false)
      setToast(next)
    })
  }, [])

  useEffect(() => {
    if (!toast || paused || leaving) {
      window.clearTimeout(hideTimer.current)
      return
    }
    hideTimer.current = window.setTimeout(close, TOAST_MS)
    return () => window.clearTimeout(hideTimer.current)
  }, [toast, paused, leaving])

  if (!toast) return null

  const ok = toast.tone === 'ok'

  return (
    <div
      className={`app-toast is-${toast.tone}${leaving ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="app-toast-mark" aria-hidden>
        {ok ? '✓' : '!'}
      </span>
      <p>{toast.text}</p>
      {toast.action ? (
        <Link to={toast.action.href} className="app-toast-go" onClick={close}>
          {toast.action.label}
        </Link>
      ) : null}
      <button type="button" className="app-toast-x" onClick={close} aria-label="Dismiss">
        ×
      </button>
      <i
        className={`app-toast-bar${paused ? ' is-paused' : ''}`}
        style={{ animationDuration: `${TOAST_MS}ms` }}
      />
    </div>
  )
}
