/**
 * After login, only honour return paths the signed-in role may open.
 * Stops guests/buyers from being bounced through /admin, /super, or desk URLs.
 */
export function sanitizeLoginFrom(
  fromRaw: string | undefined,
  opts: { isStaff: boolean; isSuperAdmin: boolean; canDesk: boolean },
): string | undefined {
  if (!fromRaw) return undefined
  const trimmed = fromRaw.trim()
  if (!trimmed.startsWith('/')) return undefined
  const path = trimmed.split('?')[0]?.split('#')[0] || ''
  if (path === '/login' || path === '/register') return undefined

  if (path === '/admin' || path.startsWith('/admin/')) {
    return opts.isStaff ? trimmed : undefined
  }
  if (path === '/super' || path.startsWith('/super/')) {
    return opts.isSuperAdmin ? trimmed : undefined
  }
  if (
    path === '/auctions' ||
    path.startsWith('/auctions/') ||
    path === '/marketplace' ||
    path.startsWith('/marketplace/')
  ) {
    return opts.canDesk ? trimmed : undefined
  }

  return trimmed
}

/** Guest → login: never stash staff desk paths in navigation state. */
export function guestLoginFrom(pathname: string, search = '', hash = ''): string {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return '/account'
  if (pathname === '/super' || pathname.startsWith('/super/')) return '/account'
  return `${pathname}${search}${hash}`
}
