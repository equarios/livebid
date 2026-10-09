/** Thin client for the local Hono API (cookie session). */

export type ApiUser = {
  accountId: string
  company: string
  email: string
  role: 'superadmin' | 'admin' | 'member'
  status: 'pending' | 'active' | 'disabled'
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
  }
  return data
}

export const api = {
  health: () => req<{ ok: boolean }>('/api/health'),
  me: () => req<{ user: ApiUser | null }>('/api/auth/me'),
  login: (ident: string, password: string) =>
    req<{ user: ApiUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ ident, password }),
    }),
  register: (body: {
    accountId: string
    password: string
    company: string
    email: string
    address?: string
  }) =>
    req<{ message: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  logout: () => req<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  bootstrap: () => req<Record<string, unknown>>('/api/commerce/bootstrap'),
  placeBid: (lotId: string, amount: number, qty: number) =>
    req<{ bid: unknown }>('/api/commerce/bids', {
      method: 'POST',
      body: JSON.stringify({ lotId, amount, qty }),
    }),
  addToCart: (lotId: string, qty: number) =>
    req<{ item: unknown }>('/api/commerce/cart', {
      method: 'POST',
      body: JSON.stringify({ lotId, qty }),
    }),
  removeFromCart: (lotId: string) =>
    req<{ ok: boolean }>(`/api/commerce/cart/${encodeURIComponent(lotId)}`, {
      method: 'DELETE',
    }),
  checkoutCart: () =>
    req<{ order: unknown }>('/api/commerce/cart/checkout', { method: 'POST' }),
  reviewCartOrder: (id: string, decision: 'accepted' | 'declined') =>
    req<{ order: unknown }>(`/api/commerce/cart-orders/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),
  confirmCartOrder: (id: string) =>
    req<{ invoice: unknown }>(`/api/commerce/cart-orders/${encodeURIComponent(id)}/confirm`, {
      method: 'POST',
    }),
  placeOffer: (lotId: string, qty: number, unitPrice: number) =>
    req<{ offer: unknown }>('/api/commerce/offers', {
      method: 'POST',
      body: JSON.stringify({ lotId, qty, unitPrice }),
    }),
  reviewOffer: (id: string, decision: 'accepted' | 'declined') =>
    req<{ offer: unknown }>(`/api/commerce/offers/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),
  confirmOffer: (id: string) =>
    req<{ invoice: unknown }>(`/api/commerce/offers/${encodeURIComponent(id)}/confirm`, {
      method: 'POST',
    }),
  toggleWatch: (lotId: string) =>
    req<{ watching: boolean }>(`/api/commerce/watch/${encodeURIComponent(lotId)}`, {
      method: 'POST',
    }),
  notices: () => req<{ notices: unknown[] }>('/api/notices'),
  markNoticesRead: () => req<{ ok: boolean }>('/api/notices/read', { method: 'POST' }),
  emailPrefs: () => req<{ prefs: Record<string, boolean> }>('/api/notices/prefs'),
  saveEmailPrefs: (prefs: Partial<Record<string, boolean>>) =>
    req<{ prefs: Record<string, boolean> }>('/api/notices/prefs', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    }),
  pushNotice: (body: {
    accountId: string
    kind: string
    title: string
    body: string
    href: string
    id?: string
  }) =>
    req<{ notice: unknown; emailed: boolean }>('/api/notices', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  requestPasswordReset: (ident: string) =>
    req<{ ok: boolean; message: string; code?: string; email?: string }>(
      '/api/auth/password-reset/request',
      { method: 'POST', body: JSON.stringify({ ident }) },
    ),
  confirmPasswordReset: (ident: string, code: string, password: string) =>
    req<{ ok: boolean }>('/api/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ ident, code, password }),
    }),
  saveFees: (fees: {
    marketplaceFeePct: number
    invoiceFeePct: number
    auctionTypeFees: Record<string, number>
  }) =>
    req<{ fees: typeof fees }>('/api/settings/fees', {
      method: 'PUT',
      body: JSON.stringify(fees),
    }),
}

let apiReady: boolean | null = null

/** True when local Hono API is reachable (cached after first probe). */
export async function isApiAvailable() {
  if (apiReady != null) return apiReady
  try {
    await api.health()
    apiReady = true
  } catch {
    apiReady = false
  }
  return apiReady
}

export function resetApiProbe() {
  apiReady = null
}
