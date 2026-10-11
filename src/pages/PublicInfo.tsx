import { Link } from 'react-router-dom'
import { PubArticle } from '../components/PubArticle'
import { PublicShell } from '../components/PublicShell'
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
  const page = useMarketingPage('buyers')
  return (
    <PublicShell mode="wholesale">
      <PubArticle
        kicker={page.kicker}
        title={page.title}
        lead={page.lead}
        actions={
          <>
            {page.primaryCta ? (
              <Link className="pub-btn pub-btn-fill" to="/register">
                {page.primaryCta}
              </Link>
            ) : null}
            {page.secondaryCta ? (
              <Link className="pub-btn" to="/login">
                {page.secondaryCta}
              </Link>
            ) : null}
          </>
        }
      >
        {renderPageBody(page.body)}
      </PubArticle>
    </PublicShell>
  )
}

export function SellersPage() {
  const page = useMarketingPage('sellers')
  return (
    <PublicShell mode="wholesale">
      <PubArticle
        kicker={page.kicker}
        title={page.title}
        lead={page.lead}
        actions={
          page.primaryCta ? (
            <Link className="pub-btn pub-btn-fill" to="/login">
              {page.primaryCta}
            </Link>
          ) : undefined
        }
      >
        {renderPageBody(page.body)}
      </PubArticle>
    </PublicShell>
  )
}

export function SupportPage() {
  const page = useMarketingPage('support')
  return (
    <PublicShell mode="wholesale">
      <PubArticle
        kicker={page.kicker}
        title={page.title}
        lead={page.lead}
        actions={
          <>
            {page.primaryCta ? (
              <Link className="pub-btn pub-btn-fill" to="/login">
                {page.primaryCta}
              </Link>
            ) : null}
            {page.secondaryCta ? (
              <Link className="pub-btn" to="/register">
                {page.secondaryCta}
              </Link>
            ) : null}
          </>
        }
      >
        {renderPageBody(page.body)}
      </PubArticle>
    </PublicShell>
  )
}
