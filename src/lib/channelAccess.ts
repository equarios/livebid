import type { SiteSettings, User } from '../types'

/** Approved wholesale desk access (staff always; members when wholesale approved). */
export function canUseWholesaleDesk(user: User | null | undefined, isStaff: boolean) {
  if (!user) return false
  if (isStaff) return true
  if (user.wholesaleStatus === 'approved') return true
  // Legacy local demo accounts without wholesaleStatus field: active members count as approved.
  if (user.wholesaleStatus == null && user.status === 'active' && user.emailVerified !== false) {
    return true
  }
  return false
}

/** Where approved buyers land after sign-in. */
export function wholesaleHome(settings: Pick<SiteSettings, 'showAuctions' | 'showMarketplace'>) {
  if (settings.showAuctions) return '/auctions'
  if (settings.showMarketplace) return '/marketplace'
  return '/wholesale'
}

/** Public face of the site (retail when enabled). */
export function publicHome(settings: Pick<SiteSettings, 'showStore' | 'showAuctions' | 'showMarketplace'>) {
  if (settings.showStore) return '/'
  return wholesaleHome(settings)
}
