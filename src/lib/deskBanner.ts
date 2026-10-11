import { DEFAULT_SETTINGS } from '../data'
import type {
  DeskBannerKey,
  DeskBannerSlide,
  DeskBanners,
  SiteSettings,
} from '../types'

export const DESK_BANNER_KEYS: DeskBannerKey[] = [
  'auctions',
  'marketplace',
  'myPage',
  'admin',
  'super',
]

export const DESK_BANNER_LABELS: Record<DeskBannerKey, string> = {
  auctions: 'Auctions',
  marketplace: 'Marketplace',
  myPage: 'My Page',
  admin: 'Admin',
  super: 'Super admin',
}

/** Curated photo when Super leaves Image URL blank (first default slide). */
export const DESK_BANNER_DEFAULT_PHOTOS: Record<DeskBannerKey, string> = {
  auctions: DEFAULT_SETTINGS.pages.deskBanners.auctions[0]!.imageUrl!,
  marketplace: DEFAULT_SETTINGS.pages.deskBanners.marketplace[0]!.imageUrl!,
  myPage: DEFAULT_SETTINGS.pages.deskBanners.myPage[0]!.imageUrl!,
  admin: DEFAULT_SETTINGS.pages.deskBanners.admin[0]!.imageUrl!,
  super: DEFAULT_SETTINGS.pages.deskBanners.super[0]!.imageUrl!,
}

function asSlideList(raw: unknown, fallback: DeskBannerSlide[]): DeskBannerSlide[] {
  if (Array.isArray(raw) && raw.length) {
    return raw.map((row, i) => {
      const pad = fallback[i % fallback.length] || fallback[0]!
      const obj =
        row && typeof row === 'object' ? (row as Partial<DeskBannerSlide>) : ({} as Partial<DeskBannerSlide>)
      return {
        title: typeof obj.title === 'string' ? obj.title : pad.title,
        body: typeof obj.body === 'string' ? obj.body : pad.body,
        imageUrl: typeof obj.imageUrl === 'string' ? obj.imageUrl : pad.imageUrl,
      }
    })
  }
  // Older single-object shape { title, body, imageUrl }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as DeskBannerSlide
    const pad = fallback[0]!
    return [
      {
        title: typeof obj.title === 'string' ? obj.title : pad.title,
        body: typeof obj.body === 'string' ? obj.body : pad.body,
        imageUrl: typeof obj.imageUrl === 'string' ? obj.imageUrl : pad.imageUrl,
      },
      ...fallback.slice(1),
    ]
  }
  return fallback.map((s) => ({ ...s }))
}

function legacyFirstSlide(settings: SiteSettings, key: DeskBannerKey): DeskBannerSlide {
  const def = DEFAULT_SETTINGS.pages.deskBanners[key][0]!
  const copy = settings.copy
  if (key === 'auctions') {
    return {
      title: copy.auctionsTitle || def.title,
      body: copy.auctionsIntro || def.body,
      imageUrl: def.imageUrl,
    }
  }
  if (key === 'marketplace') {
    return {
      title: copy.marketTitle || def.title,
      body: copy.marketIntro || def.body,
      imageUrl: def.imageUrl,
    }
  }
  if (key === 'myPage') {
    return {
      title: copy.accountTitle || def.title,
      body: copy.accountIntro || def.body,
      imageUrl: def.imageUrl,
    }
  }
  return { ...def }
}

export function mergeDeskBanners(partial?: Partial<DeskBanners> | null): DeskBanners {
  const base = DEFAULT_SETTINGS.pages.deskBanners
  const p = partial && typeof partial === 'object' ? partial : {}
  const out = {} as DeskBanners
  for (const key of DESK_BANNER_KEYS) {
    out[key] = asSlideList(p[key], base[key])
  }
  return out
}

/** Resolve slide list for a desk banner (photos filled with curated defaults). */
export function resolveDeskBannerSlides(
  settings: SiteSettings,
  key: DeskBannerKey,
): Array<Required<DeskBannerSlide>> {
  const def = DEFAULT_SETTINGS.pages.deskBanners[key]
  const stored = settings.pages?.deskBanners?.[key]
  let slides = asSlideList(stored, def)
  if (!slides.length) slides = def.map((s) => ({ ...s }))

  // Prefer legacy Site copy for slide 1 title/body when stored slide 1 still matches seed
  // or when deskBanners were never customized beyond merge defaults.
  const legacy = legacyFirstSlide(settings, key)
  const first = slides[0]!
  const seedFirst = def[0]!
  if (
    (!stored || !Array.isArray(stored)) &&
    (first.title === seedFirst.title || first.body === seedFirst.body)
  ) {
    slides = [{ ...first, title: legacy.title, body: legacy.body }, ...slides.slice(1)]
  }

  return slides.map((s, i) => {
    const pad = def[i % def.length] || def[0]!
    return {
      title: (s.title || '').trim() || pad.title,
      body: (s.body || '').trim() || pad.body,
      imageUrl:
        (s.imageUrl || '').trim() ||
        (pad.imageUrl || '').trim() ||
        DESK_BANNER_DEFAULT_PHOTOS[key],
    }
  })
}

/** First slide — for copy mirror / OpsShell fallbacks. */
export function resolveDeskBanner(
  settings: SiteSettings,
  key: DeskBannerKey,
): Required<DeskBannerSlide> {
  return resolveDeskBannerSlides(settings, key)[0]!
}
