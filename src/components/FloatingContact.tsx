import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DEFAULT_SETTINGS } from '../data'
import { useStore } from '../store'
import { SupportEnquiry } from './SupportEnquiry'

/** Fixed bottom-right Contact Us — enquiry form first, channel shortcuts second. */
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
  const wechat = c.wechatId.trim()
  const whatsapp = (c.whatsapp || c.social.whatsapp || '').trim()
  const whatsappHref = whatsapp
    ? whatsapp.startsWith('http')
      ? whatsapp
      : `https://wa.me/${whatsapp.replace(/\D/g, '')}`
    : ''
  const hasChannels = Boolean(email || whatsappHref || wechat)

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
            <button
              type="button"
              className="float-contact-x"
              aria-label="Close"
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
                  onClick={() => void navigator.clipboard?.writeText(wechat).catch(() => undefined)}
                  title={`Copy ${wechat}`}
                >
                  WeChat
                </button>
              ) : null}
            </div>
          ) : null}

          <Link
            className="float-contact-support"
            to="/support#enquiry"
            onClick={() => setOpen(false)}
          >
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
