import { useEffect, useRef, useState } from 'react'
import { APP_LOCALES, LOCALE_META } from '../i18n'
import { useStore } from '../store'

/** Compact language picker — native labels, no flag clutter. */
export function LanguageMenu({
  onOpen,
  onClose,
  closeWhen,
}: {
  onOpen?: () => void
  onClose?: () => void
  closeWhen?: boolean
}) {
  const { locale, setLocale, settings } = useStore()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (closeWhen) setOpen(false)
  }, [closeWhen])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        onClose?.()
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose])

  return (
    <div className={`lang-menu ${open ? 'open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="lang-menu-btn"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={settings.copy.navLanguage}
        title={settings.copy.navLanguage}
        onClick={() => {
          setOpen((v) => {
            const next = !v
            if (next) onOpen?.()
            else onClose?.()
            return next
          })
        }}
      >
        <span className="lang-menu-code" aria-hidden>
          {locale === 'zh-Hans' ? '简' : locale === 'zh-Hant' ? '繁' : locale.toUpperCase().slice(0, 2)}
        </span>
      </button>
      {open ? (
        <ul className="lang-menu-panel" role="listbox" aria-label={settings.copy.navLanguage}>
          {APP_LOCALES.map((id) => {
            const meta = LOCALE_META[id]
            const active = id === locale
            return (
              <li key={id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={active ? 'is-active' : undefined}
                  onClick={() => {
                    setLocale(id)
                    setOpen(false)
                    onClose?.()
                  }}
                >
                  {meta.label}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
