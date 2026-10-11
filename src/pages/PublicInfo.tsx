import { Link } from 'react-router-dom'
import { PubArticle } from '../components/PubArticle'
import { PublicShell } from '../components/PublicShell'
import { SupportEnquiry } from '../components/SupportEnquiry'
import { DEFAULT_SETTINGS } from '../data'
import { renderPageBody } from '../lib/pageBody'
import { useStore } from '../store'
import type { MarketingPageCopy } from '../types'

const PHOTO = {
  buyers:
    'https://images.unsplash.com/photo-1556656793-08538906a9f8?auto=format&fit=crop&w=2000&q=72',
  sellers:
    'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=2000&q=72',
  support:
    'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=2000&q=72',
} as const

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
      <PubArticle
        brand={brand}
        title={page.title}
        lead={page.lead}
        photo={PHOTO.buyers}
        sectionTitle="How buying works"
        actions={
          <>
            {page.primaryCta ? (
              <Link className="pub-btn pub-btn-fill" to="/register">
                {page.primaryCta}
              </Link>
            ) : null}
            {page.secondaryCta ? (
              <Link className="land-hero-secondary" to="/login">
                {page.secondaryCta} →
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
  const { settings } = useStore()
  const page = useMarketingPage('sellers')
  const brand = settings.brandName || 'eQuarios'
  return (
    <PublicShell mode="wholesale">
      <PubArticle
        brand={brand}
        title={page.title}
        lead={page.lead}
        photo={PHOTO.sellers}
        sectionTitle="Seller path"
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
  const { settings } = useStore()
  const page = useMarketingPage('support')
  const brand = settings.brandName || 'eQuarios'
  return (
    <PublicShell mode="wholesale">
      <PubArticle
        brand={brand}
        title={page.title}
        lead={page.lead}
        photo={PHOTO.support}
        sectionTitle="Quick answers"
        actions={
          <>
            <a className="pub-btn pub-btn-fill" href="#enquiry">
              Quick enquiry
            </a>
            {page.primaryCta ? (
              <Link className="land-hero-secondary" to="/login">
                {page.primaryCta} →
              </Link>
            ) : null}
          </>
        }
      >
        {renderPageBody(page.body)}
      </PubArticle>
      <SupportEnquiry />
    </PublicShell>
  )
}
