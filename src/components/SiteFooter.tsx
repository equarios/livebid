import { Link } from 'react-router-dom'
import { DEFAULT_SETTINGS } from '../data'
import { useStore } from '../store'

type SocialKey = 'facebook' | 'x' | 'instagram' | 'whatsapp' | 'linkedin' | 'google'

/** Official-style brand marks (Simple Icons paths), monochrome via currentColor. */
const SOCIAL_PATHS: Record<SocialKey, string> = {
  facebook:
    'M24 12.073C24 5.405 18.627.032 12 .032S0 5.405 0 12.073c0 6.012 4.388 10.987 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.06 24 18.085 24 12.073z',
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  instagram:
    'M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63a5.9 5.9 0 0 0-2.126 1.384A5.86 5.86 0 0 0 .63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.26 2.148.558 2.913a5.89 5.89 0 0 0 1.384 2.126 5.87 5.87 0 0 0 2.126 1.384c.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558a5.89 5.89 0 0 0 2.126-1.384 5.87 5.87 0 0 0 1.384-2.126c.296-.765.499-1.636.558-2.913.057-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913a5.89 5.89 0 0 0-1.384-2.126A5.87 5.87 0 0 0 19.86.63C19.095.333 18.224.131 16.947.072 15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 1 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z',
  whatsapp:
    'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z',
  linkedin:
    'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  google:
    'M12.48 10.92v3.28h7.84c-.24 1.84-.703 3.188-1.46 4.157-1.06 1.35-2.8 2.683-6.38 2.683-4.845 0-8.84-3.913-8.84-8.84s3.995-8.84 8.84-8.84c2.7 0 4.607.997 5.907 2.338l2.307-2.307C18.747 1.44 15.997 0 12.48 0 5.867 0 .535 5.21.535 12s5.332 12 11.945 12c3.454 0 6.06-1.148 8.085-3.29 2.09-2.2 2.76-5.377 2.76-7.941 0-.76-.063-1.469-.173-2.053h-10.67z',
}

function SocialGlyph({ name }: { name: SocialKey }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="currentColor" d={SOCIAL_PATHS[name]} />
    </svg>
  )
}

function Dot() {
  return (
    <span className="site-footer-dot" aria-hidden>
      ·
    </span>
  )
}

function Label({ children }: { children: string }) {
  return <em className="site-footer-lbl">{children}</em>
}

/** Keep the bar thin — full verified string stays on title / aria. */
function shortVerified(full: string) {
  const t = full.trim()
  if (t.length <= 42) return t
  const named = t.match(/^(GsmExchange,\s*ITAD,\s*Kadorf)/i)
  if (named) return `${named[1]} & more`
  return `${t.slice(0, 40).trimEnd()}…`
}

const SOCIALS: Array<{ key: SocialKey; label: string }> = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'x', label: 'X' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'google', label: 'Google' },
]

/** Prefer social URL; fall back to contact WhatsApp number (same as Support channels). */
function whatsappHref(socialUrl: string, phoneOrUrl: string) {
  const raw = (socialUrl || phoneOrUrl || '').trim()
  if (!raw) return ''
  if (raw.startsWith('http')) return raw
  const digits = raw.replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : ''
}

/** One store-style footer for the whole app. */
export function SiteFooter() {
  const { settings, user } = useStore()
  const c = {
    ...DEFAULT_SETTINGS.contact,
    ...(settings.contact || {}),
    social: {
      ...DEFAULT_SETTINGS.contact.social,
      ...(settings.contact?.social || {}),
    },
  }
  const verifiedFull = c.verifiedMember
  const verifiedShort = shortVerified(verifiedFull)
  const waHref = whatsappHref(c.social.whatsapp, c.whatsapp)
  const waLabel = c.whatsappDisplay.trim() || c.whatsapp.trim() || 'WhatsApp'
  const copyright =
    settings.pages?.footerCopyright?.trim() || DEFAULT_SETTINGS.pages.footerCopyright
  const canRegister = settings.features?.register !== false

  return (
    <footer className="site-footer is-mirror">
      <div className="site-footer-bar">
        <div className="site-footer-meta is-labeled">
          <span title={verifiedFull}>
            <Label>{settings.copy.footerVerified}</Label> {verifiedShort}
          </span>
          <Dot />
          <a href={`mailto:${c.emailEnquiry}`}>
            <Label>{settings.copy.footerEmail}</Label> {c.emailEnquiry}
          </a>
          <Dot />
          <a href={`tel:${c.phone}`}>
            <Label>{settings.copy.footerMobile}</Label> {c.phoneDisplay}
          </a>
          {waHref ? (
            <>
              <Dot />
              <a href={waHref} target="_blank" rel="noreferrer">
                <Label>WhatsApp</Label> {waLabel}
              </a>
            </>
          ) : null}
          <Dot />
          <span>
            <Label>WeChat</Label> {c.wechatId}
          </span>
          <Dot />
          <span>
            <Label>D-U-N-S</Label> {c.duns}
          </span>
        </div>

        <div className="site-footer-end">
          <div className="site-footer-social" aria-label={settings.copy.footerSocial}>
            {SOCIALS.map((s) => {
              const href = s.key === 'whatsapp' ? waHref : c.social[s.key]
              if (!href) return null
              return (
                <a
                  key={s.key}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  data-network={s.key}
                  className="sf-social-btn"
                >
                  <SocialGlyph name={s.key} />
                </a>
              )
            })}
          </div>
        </div>
      </div>
      {/* Public map — one row, · between links (same as meta bar above). */}
      <nav className="site-footer-nav" aria-label={settings.copy.footerNav}>
        {(
          [
            settings.showStore !== false
              ? {
                  to: '/store',
                  label:
                    settings.storeLabel && settings.storeLabel !== 'Store'
                      ? settings.storeLabel
                      : settings.copy.navStore,
                }
              : null,
            settings.showStore !== false
              ? { to: '/store/trade-in', label: 'Trade-in' }
              : null,
            { to: '/wholesale', label: settings.copy.navWholesale },
            { to: '/wholesale/c', label: 'Categories' },
            { to: '/buyers', label: settings.copy.navBuyers },
            { to: '/sellers', label: settings.copy.navSellers },
            { to: '/sellers#sell-to-us', label: 'Sell inventory' },
            { to: '/support', label: settings.copy.navSupport },
            { to: '/tutorial', label: settings.copy.navTutorial },
            user
              ? { to: '/account', label: settings.copy.navAccount }
              : { to: '/login', label: settings.copy.signInButton },
            !user && canRegister ? { to: '/register', label: settings.copy.navApply } : null,
          ] as Array<{ to: string; label: string } | null>
        )
          .filter((x): x is { to: string; label: string } => Boolean(x))
          .map((item, i) => (
            <span key={`${item.to}-${item.label}`} className="site-footer-nav-item">
              {i > 0 ? <Dot /> : null}
              <Link to={item.to}>{item.label}</Link>
            </span>
          ))}
      </nav>
      <p className="site-footer-copy">{copyright}</p>
    </footer>
  )
}
