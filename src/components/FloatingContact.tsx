import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DEFAULT_SETTINGS } from '../data'
import { useStore } from '../store'
import { SupportEnquiry } from './SupportEnquiry'

function isFormField(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'))
}

/** Fixed bottom-right Contact Us — hides on friction flows / while typing so it doesn’t cover CTAs. */
export function FloatingContact() {
  const { settings } = useStore()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [wechatCopied, setWechatCopied] = useState(false)
  const [formFocus, setFormFocus] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const path = location.pathname
  const onAuctions = path === '/auctions' || path.startsWith('/auctions/')
  const onSupport = path.startsWith('/support')
  /** Sticky checkout / trade-in bars — keep CTA clear. */
  const onBusyStore =
    path.startsWith('/store/cart') ||
    path.startsWith('/store/trade-in') ||
    path.startsWith('/store/checkout')
  const hideChrome = onAuctions || onSupport || onBusyStore

  const label = settings.copy.navContact || 'Contact us'

  const c = {
    ...DEFAULT_SETTINGS.contact,
    ...settings.contact,
    social: { ...DEFAULT_SETTINGS.contact.social, ...settings.contact?.social },
  }
  const brand = settings.brandName || 'us'
  const email = c.emailEnquiry.trim() || c.emailBusiness.trim()
  const wechat = c.wechatId.trim()
  const whatsapp = (c.whatsapp || c.social.whatsapp || '').trim()
  const whatsappHref = whatsapp
    ? whatsapp.startsWith('http')
      ? whatsapp
      : `https://wa.me/${whatsapp.replace(/\D/g, '')}`
    : ''
  const hasChannels = Boolean(email || whatsappHref || wechat)

  useEffect(() => {
    if (hideChrome) setOpen(false)
  }, [hideChrome])

  useEffect(() => {
    if (!wechatCopied) return
    const id = window.setTimeout(() => setWechatCopied(false), 1800)
    return () => window.clearTimeout(id)
  }, [wechatCopied])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    function insideFloat(el: EventTarget | null) {
      return el instanceof Node && Boolean(rootRef.current?.contains(el))
    }
    function syncFocus() {
      const active = document.activeElement
      // Only tuck for page forms — never for fields inside the Contact panel.
      setFormFocus(isFormField(active) && !insideFloat(active))
    }
    function onFocusIn(e: FocusEvent) {
      if (!isFormField(e.target)) return
      if (insideFloat(e.target)) {
        setFormFocus(false)
        return
      }
      setFormFocus(true)
      setOpen(false)
    }
    function onFocusOut() {
      window.setTimeout(syncFocus, 0)
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    syncFocus()
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  if (hideChrome) return null

  const tucked = formFocus && !open

  return (
    <div
      ref={rootRef}
      className={`float-contact${open ? ' is-open' : ''}${tucked ? ' is-tucked' : ''}`}
      aria-hidden={tucked || undefined}
    >
      {open ? (
        <div className="float-contact-panel" role="dialog" aria-label={label}>
          <div className="float-contact-head">
            <strong>
              {label} · {brand}
            </strong>
            <button
              type="button"
              className="float-contact-x"
              aria-label={settings.copy.btnCancel}
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <SupportEnquiry variant="panel" />

          {hasChannels ? (
            <div className="float-contact-channels" aria-label="Direct channels">
              {email ? (
                <a className="float-contact-chip" href={`mailto:${email}`} title={email}>
                  Email
                </a>
              ) : null}
              {whatsappHref ? (
                <a
                  className="float-contact-chip"
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              ) : null}
              {wechat ? (
                <button
                  type="button"
                  className="float-contact-chip"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(wechat)
                      .then(() => setWechatCopied(true))
                      .catch(() => undefined)
                  }}
                  title={`Copy ${wechat}`}
                >
                  {wechatCopied ? 'Copied' : 'WeChat'}
                </button>
              ) : null}
            </div>
          ) : null}
          {wechatCopied ? (
            <p className="tiny ok float-contact-copied" role="status">
              WeChat ID copied
            </p>
          ) : null}

          <Link
            className="float-contact-support"
            to="/support#enquiry"
            onClick={() => setOpen(false)}
          >
            Open support page →
          </Link>
        </div>
      ) : null}
      <button
        type="button"
        className="float-contact-btn"
        aria-expanded={open}
        aria-label={open ? settings.copy.btnCancel : label}
        tabIndex={tucked ? -1 : 0}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? settings.copy.btnCancel : label}
      </button>
    </div>
  )
}
