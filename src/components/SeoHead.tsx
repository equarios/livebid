import { useEffect } from 'react'
import { APP_LOCALES, type AppLocale } from '../i18n/locales'
import { useStore } from '../store'

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const sel = `meta[${attr}="${key}"]`
  let el = document.head.querySelector(sel) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]:not([data-seo-hreflang])`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href
}

function siteOrigin() {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

export function SeoHead({
  title,
  description,
  path,
  noindex,
  jsonLd,
}: {
  title: string
  description: string
  /** Path only, e.g. /wholesale/c/phones */
  path: string
  noindex?: boolean
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}) {
  const { locale } = useStore()

  useEffect(() => {
    const origin = siteOrigin()
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    const canonical = `${origin}${cleanPath}`
    const prevTitle = document.title
    document.title = title
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', noindex ? 'noindex,follow' : 'index,follow')
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', canonical)
    upsertMeta('property', 'og:type', 'website')
    upsertLink('canonical', canonical)

    document.head.querySelectorAll('link[rel="alternate"][data-seo-hreflang]').forEach((n) => n.remove())
    for (const loc of APP_LOCALES) {
      const href =
        loc === 'en' ? canonical : `${canonical}${canonical.includes('?') ? '&' : '?'}lang=${loc}`
      const link = document.createElement('link')
      link.rel = 'alternate'
      link.hreflang = loc
      link.href = href
      link.setAttribute('data-seo-hreflang', loc)
      document.head.appendChild(link)
    }
    const xDefault = document.createElement('link')
    xDefault.rel = 'alternate'
    xDefault.hreflang = 'x-default'
    xDefault.href = canonical
    xDefault.setAttribute('data-seo-hreflang', 'x-default')
    document.head.appendChild(xDefault)

    document.head.querySelectorAll('script[data-seo-jsonld]').forEach((n) => n.remove())
    if (jsonLd) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.setAttribute('data-seo-jsonld', '1')
      script.textContent = JSON.stringify(jsonLd)
      document.head.appendChild(script)
    }

    void locale

    return () => {
      document.title = prevTitle
    }
  }, [title, description, path, noindex, jsonLd, locale])

  return null
}

/** Apply ?lang= from the URL once (SEO hreflang landing). */
export function useLangQuerySync() {
  const { setLocale, locale } = useStore()
  useEffect(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get('lang')
      if (!raw) return
      if ((APP_LOCALES as readonly string[]).includes(raw) && raw !== locale) {
        setLocale(raw as AppLocale)
      }
    } catch {
      /* ignore */
    }
  }, [setLocale, locale])
}
