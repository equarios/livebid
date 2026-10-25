import { Link } from 'react-router-dom'
import { HelpLayout } from '../components/HelpLayout'
import { PublicShell } from '../components/PublicShell'
import { SellToUsEnquiry } from '../components/SellToUsEnquiry'
import { SupportEnquiry } from '../components/SupportEnquiry'
import { DEFAULT_SETTINGS } from '../data'
import { renderPageBody } from '../lib/pageBody'
import { useStore } from '../store'
import type { MarketingPageCopy } from '../types'

function useMarketingPage(key: 'buyers' | 'sellers' | 'support'): MarketingPageCopy {
  const { settings } = useStore()
  return {
    ...DEFAULT_SETTINGS.pages[key],
    ...(settings.pages?.[key] || {}),
  }
}

export function BuyersPage() {
  const { settings } = useStore()
  const page = useMarketingPage('buyers')
  const brand = settings.brandName || 'eQuarios'
  return (
    <PublicShell mode="wholesale">
      <article className="mkt-page">
        <header className="mkt-page-hero ending-soon-chip is-hero" aria-label={page.title}>
          <div className="ending-soon-hero-body">
            <p className="mkt-page-kicker">{brand} · For buyers</p>
            <h1 className="ending-soon-hero-title">{page.title}</h1>
            <p className="ending-soon-hero-note">{page.lead}</p>
            <ul className="store-page-trust">
              {page.primaryCta ? (
                <li>
                  <Link to="/register">{page.primaryCta} →</Link>
                </li>
              ) : null}
              {page.secondaryCta ? (
                <li>
                  <Link to="/login">{page.secondaryCta}</Link>
                </li>
              ) : null}
              <li>
                <Link to="/wholesale/c">Categories</Link>
              </li>
              <li>
                <Link to="/support">Help</Link>
              </li>
            </ul>
          </div>
        </header>

        <nav className="mkt-page-topics seo-cat-facet-strip" aria-label="Buyer links">
          <h2 className="mkt-page-topics-label">Quick links</h2>
          <ul className="seo-cat-chips">
            <li>
              <Link to="/register">Apply</Link>
            </li>
            <li>
              <Link to="/login">Sign in</Link>
            </li>
            <li>
              <Link to="/wholesale/c">Categories</Link>
            </li>
            <li>
              <Link to="/auctions">Live desks</Link>
            </li>
            <li>
              <Link to="/tutorial">How it works</Link>
            </li>
            <li>
              <Link to="/support">Support</Link>
            </li>
          </ul>
        </nav>

        <section className="mkt-page-body help-panel" aria-label="How buying works">
          <h2>How buying works</h2>
          {renderPageBody(page.body)}
        </section>
      </article>
    </PublicShell>
  )
}

export function SellersPage() {
  const { settings } = useStore()
  const page = useMarketingPage('sellers')
  const brand = settings.brandName || 'eQuarios'
  return (
    <PublicShell mode="wholesale">
      <article className="mkt-page">
        <header className="mkt-page-hero ending-soon-chip is-hero" aria-label={page.title}>
          <div className="ending-soon-hero-body">
            <p className="mkt-page-kicker">{brand} · For sellers</p>
            <h1 className="ending-soon-hero-title">{page.title}</h1>
            <p className="ending-soon-hero-note">{page.lead}</p>
            <ul className="store-page-trust">
              {page.primaryCta ? (
                <li>
                  <Link to="/login">{page.primaryCta} →</Link>
                </li>
              ) : null}
              <li>
                <a href="#sell-to-us">Sell to us</a>
              </li>
              <li>
                <Link to="/buyers">For buyers</Link>
              </li>
              <li>
                <Link to="/support">Support</Link>
              </li>
            </ul>
          </div>
        </header>

        <nav className="mkt-page-topics seo-cat-facet-strip" aria-label="Seller links">
          <h2 className="mkt-page-topics-label">Quick links</h2>
          <ul className="seo-cat-chips">
            <li>
              <Link to="/login">Staff sign in</Link>
            </li>
            <li>
              <a href="#sell-to-us">Sell inventory</a>
            </li>
            <li>
              <Link to="/buyers">For buyers</Link>
            </li>
            <li>
              <Link to="/wholesale">Wholesale</Link>
            </li>
            <li>
              <Link to="/support">Support</Link>
            </li>
          </ul>
        </nav>

        <section className="mkt-page-body help-panel" aria-label="Seller path">
          <h2>Seller path</h2>
          {renderPageBody(page.body)}
        </section>

        <section
          className="mkt-page-body help-panel sellers-supply"
          aria-labelledby="sell-to-us"
        >
          <h2 id="sell-to-us">Sell inventory to us</h2>
          <p>
            Wholesale suppliers: we buy graded phones, tablets, and related devices in volume.
            Share what you have — our desk replies with an offer after review. This is not the
            consumer trade-in program (no self-serve estimator).
          </p>
          <ul className="sellers-supply-list">
            <li>Bulk lots and mixed grades welcome</li>
            <li>Inspection before final settlement</li>
            <li>Offer by email after review</li>
          </ul>
          <SellToUsEnquiry />
        </section>
      </article>
    </PublicShell>
  )
}

export function SupportPage() {
  const { settings, user } = useStore()
  const page = useMarketingPage('support')
  return (
    <HelpLayout
      page="support"
      title={page.title || settings.copy.navSupport}
      lead={page.lead || 'Ask a question or reach us on email, WhatsApp, or WeChat.'}
    >
      <section className="help-panel help-support-card">
        <h2 className="help-support-h2">Quick answers</h2>
        {renderPageBody(page.body)}
        <p className="support-dispute-note">
          Lot or invoice dispute
          {user ? (
            <>
              {' '}
              — open <Link to="/account/complaint">Complaint</Link> on My Page.
            </>
          ) : (
            <>
              {' '}
              —{' '}
              <Link to="/login" state={{ from: '/account/complaint' }}>
                sign in
              </Link>{' '}
              and use Complaint on My Page.
            </>
          )}
        </p>
        <p className="help-support-actions">
          <a className="btn btn-primary btn-sm" href="#enquiry">
            Quick enquiry
          </a>
        </p>
      </section>
      <SupportEnquiry />
    </HelpLayout>
  )
}
