import { useEffect, useState } from 'react'
import { useStore } from '../store'

const KEY = 'equarios-site-warn-dismissed'

export function SiteWarnPopup() {
  const { settings } = useStore()
  const text =
    settings.features.siteNotice && settings.copy.siteNotice.trim()
      ? settings.copy.siteNotice.trim()
      : ''
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!text) {
      setOpen(false)
      return
    }
    try {
      setOpen(sessionStorage.getItem(KEY) !== text)
    } catch {
      setOpen(true)
    }
  }, [text])

  function dismiss() {
    try {
      if (text) sessionStorage.setItem(KEY, text)
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  if (!open || !text) return null

  return (
    <div className="warn-popup" role="status" aria-labelledby="warn-popup-title" aria-describedby="warn-popup-body">
      <strong id="warn-popup-title">Invoice</strong>
      <p id="warn-popup-body">{text}</p>
      <button type="button" className="warn-popup-x" aria-label="Dismiss warning" onClick={dismiss}>
        ×
      </button>
    </div>
  )
}
