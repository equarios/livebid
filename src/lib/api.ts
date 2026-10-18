/** Thin client for the local Hono API (cookie session). */

export type CompanyResultDto = {
  from: number
  to: number
  collectedGoods: number
  collectedFees: number
  owedGoods: number
  owedFees: number
  costOfGoods: number
  writtenOff: number
  grossProfit: number
  missingSales: number
  missingPcs: number
  missingWriteoffPcs: number
  stockValue: number
  stockUncostedPcs: number
  missing: {
    key: string
    skuId: string | null
    label: string
    kind: 'sale' | 'unlinked' | 'writeoff'
    pcs: number
    amount: number
  }[]
}

export type ApiUser = {
  accountId: string
  company: string
  email: string
  firstName?: string
  lastName?: string
  role: 'superadmin' | 'admin' | 'member'
  status: 'pending' | 'active' | 'disabled'
  emailVerified?: boolean
  wholesaleStatus?: 'none' | 'submitted' | 'needs_docs' | 'under_review' | 'approved' | 'rejected'
}

export class ApiError extends Error {
  needsVerify?: boolean
  accountId?: string
  email?: string
  code?: string
  constructor(
    message: string,
    extra?: { needsVerify?: boolean; accountId?: string; email?: string; code?: string },
  ) {
    super(message)
    this.name = 'ApiError'
    if (extra) Object.assign(this, extra)
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const { headers: initHeaders, ...rest } = init || {}
  const res = await fetch(path, {
    credentials: 'include',
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(initHeaders as Record<string, string> | undefined),
    },
  })
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string
    needsVerify?: boolean
    accountId?: string
    email?: string
    code?: string
  }
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, {
      needsVerify: data.needsVerify,
      accountId: data.accountId,
      email: data.email,
      code: data.code,
    })
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
    firstName: string
    lastName: string
    email: string
    emailConfirm: string
    password: string
    passwordConfirm: string
    company?: string
    accountId?: string
    address?: string
    phone?: string
  }) =>
    req<{
      message: string
      needsVerify?: boolean
      code?: string
      email?: string
      account: { accountId: string }
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  verifyEmail: (ident: string, code: string) =>
    req<{ user: ApiUser; message: string }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ ident, code }),
    }),
  resendVerifyEmail: (ident: string) =>
    req<{ ok: boolean; message: string; code?: string; email?: string }>(
      '/api/auth/verify-email/resend',
      { method: 'POST', body: JSON.stringify({ ident }) },
    ),
  patchAccount: (
    accountId: string,
    body: Partial<{
      status: string
      role: string
      wholesaleStatus: string
      emailVerified: boolean
      company: string
      email: string
      address: string
      phone: string
    }>,
  ) =>
    req<{ account: unknown }>(`/api/auth/accounts/${encodeURIComponent(accountId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getWatchFilters: () =>
    req<{
      filters: Array<{
        id: string
        deviceClass?: string
        condition?: string
        label: string
        to: string
        createdAt: number
      }>
    }>('/api/account/watch-filters'),
  saveWatchFilters: (
    filters: Array<{
      id: string
      deviceClass?: string
      condition?: string
      label: string
      to: string
      createdAt?: number
    }>,
  ) =>
    req<{ filters: unknown[] }>('/api/account/watch-filters', {
      method: 'PUT',
      body: JSON.stringify({ filters }),
    }),
  getWholesaleApplication: () =>
    req<{
      application: {
        id: string
        status: string
        payload: Record<string, unknown>
        staffNote: string
        submittedAt: string | null
        reviewedAt?: string | null
        wholesaleStatus: string
      }
    }>('/api/account/wholesale-application'),
  saveWholesaleApplication: (body: { payload?: Record<string, unknown>; submit?: boolean }) =>
    req<{
      application: {
        id: string
        status: string
        payload: Record<string, unknown>
        staffNote: string
        submittedAt: string | null
      }
    }>('/api/account/wholesale-application', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  listAccountDocuments: () =>
    req<{ documents: unknown[] }>('/api/account/documents'),
  uploadAccountDocument: (body: {
    title: string
    category: string
    fileName: string
    mimeType: string
    dataBase64: string
    note?: string
  }) =>
    req<{ document: unknown }>('/api/account/documents', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  downloadAccountDocument: (id: string) =>
    req<{ fileName: string; mimeType: string; dataBase64: string }>(
      `/api/account/documents/${encodeURIComponent(id)}/download`,
    ),
  staffWholesaleApplications: () =>
    req<{
      applications: Array<{
        id: string
        accountId: string
        company: string
        email: string
        status: string
        wholesaleStatus: string
        staffNote: string
        submittedAt: string | null
        payload: Record<string, unknown>
      }>
    }>('/api/account/staff/wholesale-applications'),
  staffWholesaleStuck: () =>
    req<{
      stuck: Array<{
        accountId: string
        company: string
        email: string
        approvedAt: string
        lastNudgeAt: string | null
        nudgeCount: number
        lastBidAt: string | null
        bidAfterNudge: boolean
      }>
      idleDays: number
    }>('/api/account/staff/wholesale-stuck'),
  staffWholesaleRecovered: () =>
    req<{
      recovered: Array<{
        accountId: string
        company: string
        email: string
        nudgedAt: string
        bidAt: string
        thanked: boolean
      }>
    }>('/api/account/staff/wholesale-recovered'),
  staffWholesaleAction: (
    accountId: string,
    body: {
      action:
        | 'approve'
        | 'reject'
        | 'needs_docs'
        | 'under_review'
        | 'note'
        | 'send_notice'
        | 'nudge_idle'
        | 'thanks_recover'
      staffNote?: string
      noticeTitle?: string
      noticeBody?: string
      noticeHref?: string
    },
  ) =>
    req<{ ok: boolean; wholesaleStatus?: string; already?: boolean }>(
      `/api/account/staff/wholesale-applications/${encodeURIComponent(accountId)}`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  staffSendDocument: (body: {
    accountId: string
    title: string
    category?: string
    fileName: string
    mimeType?: string
    dataBase64: string
    note?: string
  }) =>
    req<{ ok: boolean; id: string }>('/api/account/staff/documents', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  marketingStatus: () =>
    req<{
      brevoConfigured: boolean
      total: number
      subscribed: number
      unsubscribed: number
      bounced: number
    }>('/api/marketing/status'),
  marketingClients: (opts?: { q?: string; status?: string; tag?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (opts?.q) qs.set('q', opts.q)
    if (opts?.status) qs.set('status', opts.status)
    if (opts?.tag) qs.set('tag', opts.tag)
    if (opts?.limit) qs.set('limit', String(opts.limit))
    const q = qs.toString()
    return req<{ clients: unknown[]; total: number }>(`/api/marketing/clients${q ? `?${q}` : ''}`)
  },
  marketingUpsertClient: (body: {
    email: string
    firstName?: string
    lastName?: string
    company?: string
    phone?: string
    tags?: string[]
    status?: string
    note?: string
    consent?: boolean
  }) =>
    req<{ client: unknown }>('/api/marketing/clients', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  marketingImportCsv: (csv: string, defaultTags?: string[]) =>
    req<{ ok: boolean; created: number; updated: number; skipped: number }>(
      '/api/marketing/clients/import',
      { method: 'POST', body: JSON.stringify({ csv, defaultTags }) },
    ),
  marketingSyncBrevo: () =>
    req<{
      ok: boolean
      synced: number
      listId?: number
      simulated?: boolean
      message?: string
    }>('/api/marketing/clients/sync-brevo', { method: 'POST' }),
  marketingCampaigns: () =>
    req<{ campaigns: unknown[]; brevoConfigured: boolean }>('/api/marketing/campaigns'),
  marketingCreateCampaign: (body: {
    name: string
    subject: string
    previewText?: string
    htmlBody: string
    textBody?: string
    audience?: string
  }) =>
    req<{ campaign: unknown }>('/api/marketing/campaigns', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  marketingSendCampaign: (id: string) =>
    req<{ campaign: unknown; simulated?: boolean; message?: string }>(
      `/api/marketing/campaigns/${encodeURIComponent(id)}/send`,
      { method: 'POST' },
    ),
  marketingRefreshCampaign: (id: string) =>
    req<{ campaign: unknown; message?: string }>(
      `/api/marketing/campaigns/${encodeURIComponent(id)}/refresh`,
      { method: 'POST' },
    ),
  logout: () => req<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  bootstrap: () =>
    req<
      Record<string, unknown> & {
        meta?: {
          lotsTotal?: number
          lotsReturned?: number
          lotsHasMore?: boolean
          lotsNextCursor?: string | null
          bidsTotal?: number
          bidsReturned?: number
          bidsHasMore?: boolean
        }
      }
    >('/api/commerce/bootstrap'),
  lotsPage: (opts?: { cursor?: string | null; limit?: number }) => {
    const q = new URLSearchParams()
    if (opts?.cursor) q.set('cursor', opts.cursor)
    if (opts?.limit) q.set('limit', String(opts.limit))
    const qs = q.toString()
    return req<{ lots: unknown[]; nextCursor: string | null }>(
      `/api/commerce/lots${qs ? `?${qs}` : ''}`,
    )
  },
  bidsPage: (opts?: { cursor?: string | null; limit?: number; lotId?: string }) => {
    const q = new URLSearchParams()
    if (opts?.cursor) q.set('cursor', opts.cursor)
    if (opts?.limit) q.set('limit', String(opts.limit))
    if (opts?.lotId) q.set('lotId', opts.lotId)
    const qs = q.toString()
    return req<{ bids: unknown[]; nextCursor: string | null }>(
      `/api/commerce/bids${qs ? `?${qs}` : ''}`,
    )
  },
  placeBid: (lotId: string, amount: number, qty: number, idempotencyKey?: string) => {
    const key = idempotencyKey || `bid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    return req<{
      bid: {
        lotId: string
        accountId: string
        amount: number
        qty: number
        at: number
      }
      lot?: { id: string; currentPrice: number; bidCount: number }
    }>('/api/commerce/bids', {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify({ lotId, amount, qty, idempotencyKey: key }),
    })
  },
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
  saveInvoice: (invoice: Record<string, unknown>, previousId?: string) =>
    req<{ invoice: unknown }>('/api/commerce/invoices', {
      method: 'PUT',
      body: JSON.stringify({ invoice, previousId }),
    }),
  deleteInvoice: (id: string) =>
    req<{ ok: boolean }>(`/api/commerce/invoices/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  issueInvoice: (id: string, side: 'admin' | 'super', decision: 'accepted' | 'declined') =>
    req<{ invoice: unknown }>(`/api/commerce/invoices/${encodeURIComponent(id)}/issue`, {
      method: 'POST',
      body: JSON.stringify({ side, decision }),
    }),
  submitInvoicePayment: (
    id: string,
    receiptName: string,
    receiptData: string,
    extra?: { payMethod?: 'bank' | 'usdt' | 'cash'; payRef?: string },
  ) =>
    req<{ invoice: unknown }>(`/api/commerce/invoices/${encodeURIComponent(id)}/pay`, {
      method: 'POST',
      body: JSON.stringify({
        receiptName,
        receiptData,
        payMethod: extra?.payMethod,
        payRef: extra?.payRef,
      }),
    }),
  reviewInvoicePayment: (id: string, side: 'admin' | 'super', decision: 'accepted' | 'declined') =>
    req<{ invoice: unknown }>(
      `/api/commerce/invoices/${encodeURIComponent(id)}/review-payment`,
      {
        method: 'POST',
        body: JSON.stringify({ side, decision }),
      },
    ),
  markInvoicePaid: (id: string) =>
    req<{ invoice: unknown }>(`/api/commerce/invoices/${encodeURIComponent(id)}/mark-paid`, {
      method: 'POST',
    }),
  clearInvoicePayment: (id: string) =>
    req<{ invoice: unknown }>(`/api/commerce/invoices/${encodeURIComponent(id)}/clear-payment`, {
      method: 'POST',
    }),
  markInvoiceOpened: (id: string) =>
    req<{ invoice: unknown }>(`/api/commerce/invoices/${encodeURIComponent(id)}/opened`, {
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
  syncAuctionClock: (body: {
    auctionType: string
    closesAt: number
    extraSealedMinutes?: number
  }) =>
    req<{ ok: boolean; updated: number; closesAt: number; extraSealedEndsAt: number | null }>(
      '/api/catalog/auction-clocks',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  publishLots: (lots: unknown[]) =>
    req<{ ok: boolean; lots: unknown[]; count: number }>('/api/catalog/lots/batch', {
      method: 'POST',
      body: JSON.stringify({ lots }),
    }),
  saveInventorySku: (sku: {
    id: string
    manufacturer: string
    model: string
    modelNumber: string
    capacity: string
    color: string
    grade: string
    battery: number
    origin?: string
    description: string
    operator?: string
    defaultMoq?: number
    lastPrice?: number
    onHand?: number
  }) =>
    req<{ inventory: unknown }>('/api/catalog/inventory', {
      method: 'POST',
      body: JSON.stringify(sku),
    }),
  stockReturns: () =>
    req<{ returns: { lotId: string; skuId: string; model: string; leftover: number }[] }>(
      '/api/catalog/returns',
    ),
  decideStockReturn: (lotId: string, decision: 'return' | 'leave') =>
    req<{ onHand: number; leftover: number }>('/api/catalog/returns', {
      method: 'POST',
      body: JSON.stringify({ lotId, decision }),
    }),
  companyResult: (query: string) => req<CompanyResultDto>(`/api/super/result?${query}`),
  companyCosts: () =>
    req<{
      skus: { id: string; model: string; spec: string; onHand: number; unitCost: number | null }[]
    }>('/api/super/costs'),
  saveCompanyCost: (id: string, unitCost: number | null) =>
    req<{ id: string; unitCost: number | null }>(`/api/super/costs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ unitCost }),
    }),
  moveInventoryToStore: (id: string, body: { qty: number; price: number }) =>
    req<{ onHand: number; productId: string; stock: number }>(
      `/api/catalog/inventory/${encodeURIComponent(id)}/to-store`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  lotPriceComps: (id: string) =>
    req<{ comps: PriceCompDto[]; median: number | null }>(
      `/api/catalog/lots/${encodeURIComponent(id)}/comps`,
    ),
  getFees: () =>
    req<{
      fees: {
        marketplaceFeePct: number
        invoiceFeePct: number
        offerFloorPct: number
        auctionTypeFees: Record<string, number>
        fulfillment?: import('../types').FulfillmentSettings
      }
    }>('/api/settings/fees'),
  saveFees: (fees: {
    marketplaceFeePct: number
    invoiceFeePct: number
    offerFloorPct: number
    auctionTypeFees: Record<string, number>
    fulfillment?: import('../types').FulfillmentSettings
  }) =>
    req<{ fees: typeof fees }>('/api/settings/fees', {
      method: 'PUT',
      body: JSON.stringify(fees),
    }),
  storeFulfillment: () =>
    req<{
      fulfillment: {
        modes: import('../types').FulfillmentMode[]
        defaultMode: import('../types').FulfillmentMode
        deliveryFeeFlat: number
        freeDeliveryMin: number
        deliveryPayer: import('../types').ShippingPayer
        pickupLabel: string
        pickupHours: string
        courierHints: string
        pickupSlots?: string[]
        pickupLeadDays?: number
        pickupSlotCap?: number
        earliestPickupDate?: string
      }
    }>('/api/store/fulfillment'),
  storePickupSlots: (date: string) =>
    req<{
      date: string
      pickupSlotCap: number
      slots: Array<{
        slot: string
        booked: number
        cap: number
        remaining: number | null
        full: boolean
      }>
    }>(`/api/store/fulfillment/slots?date=${encodeURIComponent(date)}`),
  askAboutItem: (body: {
    channel: 'store' | 'auction' | 'marketplace'
    itemId: string
    itemTitle: string
    itemHref?: string
    name: string
    email: string
    message: string
  }) =>
    req<{ enquiry: ProductEnquiryDto }>('/api/enquiry', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  productEnquiryCount: () => req<{ openCount: number }>('/api/enquiry/count'),
  productEnquiries: (status?: 'open' | 'done') => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : ''
    return req<{ enquiries: ProductEnquiryDto[]; openCount: number }>(
      `/api/enquiry${qs}`,
    )
  },
  updateProductEnquiry: (id: string, body: { status: 'open' | 'done' }) =>
    req<{ enquiry: ProductEnquiryDto }>(`/api/enquiry/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getLogistics: () =>
    req<{
      logistics: {
        preferredFulfillmentMode: import('../types').FulfillmentMode | null
        courierCarrier: string | null
        courierAccount: string | null
        address: string | null
      }
    }>('/api/account/logistics'),
  saveLogistics: (body: {
    preferredFulfillmentMode?: import('../types').FulfillmentMode | null
    courierCarrier?: string | null
    courierAccount?: string | null
    address?: string | null
  }) =>
    req<{
      logistics: {
        preferredFulfillmentMode: import('../types').FulfillmentMode | null
        courierCarrier: string | null
        courierAccount: string | null
        address: string | null
      }
    }>('/api/account/logistics', { method: 'PUT', body: JSON.stringify(body) }),
  setInvoiceFulfillment: (
    id: string,
    body: {
      fulfillmentMode: import('../types').FulfillmentMode
      courierCarrier?: string
      courierAccount?: string
      shipAddress?: string
      shipPhone?: string
      shippingFee?: number
      readyForCollect?: boolean
      pickupDate?: string
      pickupSlot?: string
    },
  ) =>
    req<{ invoice: Record<string, unknown>; shippingInvoiceId?: string | null }>(
      `/api/commerce/invoices/${encodeURIComponent(id)}/fulfillment`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  imeiPacks: () =>
    req<{
      packs: Array<{
        id: string
        title: string
        accountId: string | null
        invoiceId: string | null
        note: string | null
        createdBy: string
        createdAt: string
        rowCount: number
        company: string | null
      }>
    }>('/api/imei/packs'),
  imeiPack: (id: string) =>
    req<{
      pack: {
        id: string
        title: string
        accountId: string | null
        invoiceId: string | null
        note: string | null
        createdBy: string
        createdAt: string
        rowCount: number
        company: string | null
      }
      devices: Array<{
        id: string
        imei: string
        unlockCode: string
        model: string | null
        box: string | null
      }>
    }>(`/api/imei/packs/${encodeURIComponent(id)}`),
  createImeiPack: (body: {
    title: string
    accountId?: string | null
    invoiceId?: string | null
    note?: string | null
    rows?: Array<{ imei: string; unlockCode: string; model?: string; box?: string }>
  }) =>
    req<{ pack: { id: string; rowCount: number; title: string } }>('/api/imei/packs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateImeiDevice: (
    id: string,
    body: {
      imei?: string
      unlockCode?: string
      model?: string | null
      box?: string | null
    },
  ) =>
    req<{
      device: {
        id: string
        imei: string
        unlockCode: string
        model: string | null
        box: string | null
        packId: string
      }
    }>(`/api/imei/devices/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteImeiDevice: (id: string) =>
    req<{ ok: boolean; packId: string }>(`/api/imei/devices/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  updateImeiPack: (
    id: string,
    body: {
      title?: string
      accountId?: string | null
      invoiceId?: string | null
      note?: string | null
    },
  ) =>
    req<{ pack: { id: string; accountId: string | null; title: string; rowCount: number } }>(
      `/api/imei/packs/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  appendImeiRows: (
    id: string,
    rows: Array<{ imei: string; unlockCode: string; model?: string; box?: string }>,
  ) =>
    req<{ pack: { id: string; rowCount: number }; upserted: number }>(
      `/api/imei/packs/${encodeURIComponent(id)}/rows`,
      { method: 'POST', body: JSON.stringify({ rows }) },
    ),
  deleteImeiPack: (id: string) =>
    req<{ ok: boolean }>(`/api/imei/packs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  searchImei: (q: string) =>
    req<{
      query: string
      matches: Array<{
        id: string
        imei: string
        unlockCode: string
        model: string | null
        box: string | null
        packId: string
        packTitle: string
        invoiceId: string | null
        accountId: string | null
      }>
    }>(`/api/imei/search?q=${encodeURIComponent(q)}`),
  browseImeiDevices: (params: {
    q?: string
    accountId?: string
    packId?: string
    invoiceId?: string
    take?: number
    skip?: number
  }) => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.accountId) qs.set('accountId', params.accountId)
    if (params.packId) qs.set('packId', params.packId)
    if (params.invoiceId) qs.set('invoiceId', params.invoiceId)
    if (params.take != null) qs.set('take', String(params.take))
    if (params.skip != null) qs.set('skip', String(params.skip))
    const suffix = qs.toString() ? `?${qs}` : ''
    return req<{
      total: number
      take: number
      skip: number
      devices: Array<{
        id: string
        imei: string
        unlockCode: string
        model: string | null
        box: string | null
        packId: string
        packTitle: string
        invoiceId: string | null
        accountId: string | null
      }>
    }>(`/api/imei/devices${suffix}`)
  },
  storeProducts: (params?: { q?: string; category?: string; archive?: boolean }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.category) qs.set('category', params.category)
    if (params?.archive) qs.set('archive', '1')
    const suffix = qs.toString() ? `?${qs}` : ''
    return req<{ products: StoreProductDto[] }>(`/api/store/products${suffix}`)
  },
  storeProduct: (idOrSlug: string) =>
    req<{ product: StoreProductDto }>(`/api/store/products/${encodeURIComponent(idOrSlug)}`),
  createStoreProduct: (body: Partial<StoreProductDto> & { title: string; price: number; stock: number }) =>
    req<{ product: StoreProductDto }>('/api/store/products', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateStoreProduct: (id: string, body: Partial<StoreProductDto>) =>
    req<{ product: StoreProductDto }>(`/api/store/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteStoreProduct: (id: string) =>
    req<{ ok: boolean }>(`/api/store/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  uploadStoreImages: async (files: File[]) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    const res = await fetch('/api/store/upload', {
      method: 'POST',
      credentials: 'include',
      body: fd,
    })
    const data = (await res.json().catch(() => ({}))) as { urls?: string[]; error?: string }
    if (!res.ok) throw new ApiError(data.error || `Upload failed (${res.status})`)
    return { urls: data.urls || [] }
  },
  uploadBrandLogo: async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/settings/brand-logo', {
      method: 'POST',
      credentials: 'include',
      body: fd,
    })
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
    if (!res.ok) throw new ApiError(data.error || `Upload failed (${res.status})`)
    if (!data.url) throw new ApiError('Upload failed.')
    return { url: data.url }
  },
  placeStoreOrder: (body: {
    email: string
    name: string
    phone?: string
    address?: string
    note?: string
    paymentMethod: 'card' | 'paypal' | 'bank' | 'usdt' | 'cash'
    fulfillmentMode?: import('../types').FulfillmentMode
    courierCarrier?: string
    courierAccount?: string
    pickupDate?: string
    pickupSlot?: string
    lines: Array<{ productId: string; qty: number }>
  }) =>
    req<{ order: StoreOrderDto }>('/api/store/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  storeOrders: () => req<{ orders: StoreOrderDto[] }>('/api/store/orders'),
  storeOrder: (id: string) =>
    req<{ order: StoreOrderDto }>(`/api/store/orders/${encodeURIComponent(id)}`),
  updateStoreOrder: (
    id: string,
    body: {
      status?: 'pending_payment' | 'paid' | 'shipped' | 'cancelled'
      paymentRef?: string | null
      readyForCollect?: boolean
      shippingFee?: number
      shippingFeeQuoted?: boolean
      trackingNo?: string
      courierCarrier?: string
    },
  ) =>
    req<{ order: StoreOrderDto; shippingInvoiceId?: string | null }>(
      `/api/store/orders/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
    ),

  communityListings: (params?: { q?: string; category?: string; mine?: boolean; queue?: boolean }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.category) qs.set('category', params.category)
    if (params?.mine) qs.set('mine', '1')
    if (params?.queue) qs.set('queue', '1')
    const suffix = qs.toString() ? `?${qs}` : ''
    return req<{ listings: CommunityListingDto[] }>(`/api/community/listings${suffix}`)
  },
  communityListing: (id: string) =>
    req<{ listing: CommunityListingDto }>(`/api/community/listings/${encodeURIComponent(id)}`),
  createCommunityListing: (body: CommunityListingInput) =>
    req<{ listing: CommunityListingDto }>('/api/community/listings', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCommunityListing: (id: string, body: Partial<CommunityListingInput> & { status?: string }) =>
    req<{ listing: CommunityListingDto }>(`/api/community/listings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  moderateCommunityListing: (
    id: string,
    body: { status?: string; featured?: boolean; staffNote?: string },
  ) =>
    req<{ listing: CommunityListingDto }>(`/api/community/staff/listings/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  communityInterest: (id: string, body: { message: string; qtyWanted?: number }) =>
    req<{ interest: { id: string; listingId: string; status: string; createdAt: string } }>(
      `/api/community/listings/${encodeURIComponent(id)}/interest`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  communityInterests: () =>
    req<{
      interests: Array<{
        id: string
        listingId: string
        listingTitle: string
        listingStatus: string
        message: string
        qtyWanted: number | null
        status: string
        fromCompany: string
        fromAccountId?: string
        fromEmail?: string
        mine: boolean
        createdAt: string
      }>
    }>('/api/community/interests'),
}

export type StoreProductDto = {
  id: string
  title: string
  slug: string
  description: string
  price: number
  compareAt: number | null
  stock: number
  category: string
  brand?: string
  modelNumber?: string
  capacity?: string
  color?: string
  grade?: string
  /** 0 = unknown / hide on card. */
  battery?: number
  origin?: string
  simLocked?: boolean
  activationLocked?: boolean
  imageUrl: string | null
  /** Ordered gallery; first is cover. */
  images?: string[]
  active: boolean
  createdAt: string
  updatedAt: string
}

export type StoreOrderDto = {
  id: string
  accountId: string | null
  email: string
  name: string
  phone: string | null
  address: string
  fulfillmentMode?: import('../types').FulfillmentMode
  courierCarrier?: string | null
  courierAccount?: string | null
  readyForCollect?: boolean
  shippingFeeQuoted?: boolean
  pickupDate?: string | null
  pickupSlot?: string | null
  status: string
  paymentMethod: string
  paymentRef: string | null
  subtotal: number
  shippingFee: number
  total: number
  note: string | null
  createdAt: string
  paidAt: string | null
  shippedAt: string | null
  trackingNo?: string | null
  lines: Array<{
    id: string
    productId: string | null
    title: string
    unitPrice: number
    qty: number
  }>
}

export type ProductEnquiryDto = {
  id: string
  channel: 'store' | 'auction' | 'marketplace'
  itemId: string
  itemTitle: string
  itemHref: string
  name: string
  email: string
  accountId: string | null
  message: string
  status: 'open' | 'done'
  createdAt: number
  doneAt?: number
}

export type PriceCompDto = {
  lotId: string
  unitPrice: number
  at: number
  type: string
  grade: string
  capacity: string
  qty: number
}

export type CommunityListingDto = {
  id: string
  title: string
  description: string
  category: string
  manufacturer: string
  model: string
  capacity: string
  grade: string
  color: string
  qty: number
  price: number | null
  currency: string
  imageUrl: string | null
  status: string
  featured: boolean
  staffNote: string
  interestCount: number
  sellerName: string
  mine: boolean
  accountId?: string
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export type CommunityListingInput = {
  title: string
  description?: string
  category?: string
  manufacturer?: string
  model?: string
  capacity?: string
  grade?: string
  color?: string
  qty?: number
  price?: number | null
  currency?: string
  imageUrl?: string | null
}

let apiReady: boolean | null = null

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (v) => {
        window.clearTimeout(t)
        resolve(v)
      },
      (e) => {
        window.clearTimeout(t)
        reject(e)
      },
    )
  })
}

/** True when local Hono API is reachable (cached after first probe). */
export async function isApiAvailable() {
  if (apiReady != null) return apiReady
  try {
    // Hard cap — a hung proxy must not freeze the UI on “Loading session…”
    await withTimeout(api.health(), 2500, 'API health')
    apiReady = true
  } catch {
    apiReady = false
  }
  return apiReady
}

export function resetApiProbe() {
  apiReady = null
}
