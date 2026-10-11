import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DEFAULT_SETTINGS } from '../data'
import { useStore } from '../store'

/** Fixed bottom-right Contact Us — stays visible while scrolling (GoDaddy-style). */
export function FloatingContact() {
  const { settings } = useStore()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const onAuctions =
    location.pathname === '/auctions' || location.pathname.startsWith('/auctions/')

  const c = {
    ...DEFAULT_SETTINGS.contact,
    ...settings.contact,
    social: { ...DEFAULT_SETTINGS.contact.social, ...settings.contact?.social },
  }
  const brand = settings.brandName || 'us'
  const email = c.emailEnquiry.trim() || c.emailBusiness.trim()
  const phone = c.phone.trim()
  const phoneLabel = c.phoneDisplay.trim() || phone
  const wechat = c.wechatId.trim()
  const whatsapp = (c.whatsapp || c.social.whatsapp || '').trim()
  const whatsappHref = whatsapp
    ? whatsapp.startsWith('http')
      ? whatsapp
      : `https://wa.me/${whatsapp.replace(/\D/g, '')}`
    : ''

  useEffect(() => {
    if (onAuctions) setOpen(false)
  }, [onAuctions])

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

  if (onAuctions) return null

  return (
    <div ref={rootRef} className={`float-contact ${open ? 'is-open' : ''}`}>
      {open ? (
        <div className="float-contact-panel" role="dialog" aria-label="Contact us">
          <div className="float-contact-head">
            <strong>Contact {brand}</strong>
            <button type="button" className="float-contact-x" aria-label="Close" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>
          <p className="float-contact-lead">We usually reply within one business day.</p>
          <div className="float-contact-actions">
            {email ? (
              <a className="float-contact-link" href={`mailto:${email}`}>
                <span>Email</span>
                <em>{email}</em>
              </a>
            ) : null}
            {phone ? (
              <a className="float-contact-link" href={`tel:${phone}`}>
                <span>Phone</span>
                <em>{phoneLabel}</em>
              </a>
            ) : null}
            {whatsappHref ? (
              <a className="float-contact-link" href={whatsappHref} target="_blank" rel="noreferrer">
                <span>WhatsApp</span>
                <em>{c.whatsappDisplay.trim() || 'Message us'}</em>
              </a>
            ) : null}
            {wechat ? (
              <button
                type="button"
                className="float-contact-link"
                onClick={() => void navigator.clipboard?.writeText(wechat).catch(() => undefined)}
              >
                <span>WeChat</span>
                <em>
                  {wechat} · copy
                </em>
              </button>
            ) : null}
          </div>
          <Link className="float-contact-support" to="/support" onClick={() => setOpen(false)}>
            Support &amp; help centre
          </Link>
        </div>
      ) : null}
      <button
        type="button"
        className="float-contact-btn"
        aria-expanded={open}
        aria-label={open ? 'Close contact' : 'Contact us'}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Close' : 'Contact Us'}
      </button>
    </div>
  )
}
