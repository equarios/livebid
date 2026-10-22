import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DEFAULT_SETTINGS } from '../data'
import { useStore } from '../store'
import { SupportEnquiry } from './SupportEnquiry'

/** Fixed bottom-right Contact Us shortcut — same enquiry as /support. */
export function FloatingContact() {
  const { settings } = useStore()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [wechatCopied, setWechatCopied] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const onAuctions =
    location.pathname === '/auctions' || location.pathname.startsWith('/auctions/')
  const onSupport = location.pathname.startsWith('/support')
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
    if (onAuctions || onSupport) setOpen(false)
  }, [onAuctions, onSupport])

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

  if (onAuctions || onSupport) return null

  return (
    <div ref={rootRef} className={`float-contact ${open ? 'is-open' : ''}`}>
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
        onClick={() => setOpen((v) => !v)}
      >
        {open ? settings.copy.btnCancel : label}
      </button>
    </div>
  )
}
