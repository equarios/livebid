import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_SETTINGS, SEED_ACCOUNTS, SEED_LOTS, SUPER_USER } from './data'
import {
  applyDropClocks,
  ensureAuctionClocks,
  isSealedLot,
  lotAuctionSlug,
  migrateLotAuctionType,
  normalizeAuctionTypes,
} from './lib/auctionLists'
import { inventoryFromLots, upsertInventory } from './lib/inventory'
import { liveLotFromDrop } from './lib/listingDrops'
import { buildInvoice, invoiceTotals, settleInvoice, settleInvoiceIssue } from './lib/invoices'
import { buyerCareNotices, settleClosedAuctions } from './lib/settle'
import { checkBidPrice, checkOrderQty, lotMoq } from './lib/moq'
import type {
  Account,
  Bid,
  CartItem,
  InventorySku,
  Invoice,
  ListingDrop,
  ListingDropItem,
  Lot,
  MarketOffer,
  Notice,
  PayDecision,
  PayReviewSide,
  SiteSettings,
  ThemeSettings,
  User,
} from './types'

type Store = {
  user: User | null
  lots: Lot[]
  bids: Bid[]
  watchlist: string[]
  invoices: Invoice[]
  notices: Notice[]
  cart: CartItem[]
  offers: MarketOffer[]
  listingDrops: ListingDrop[]
  inventory: InventorySku[]
  accounts: Account[]
  settings: SiteSettings
  isSuperAdmin: boolean
  isStaff: boolean
  login: (accountId: string, password: string) => string | null
  register: (accountId: string, company: string, email: string, password: string) => string | null
  requestPasswordReset: (ident: string) => { error: string } | { code: string; email: string }
  resetPassword: (ident: string, code: string, password: string) => string | null
  logout: () => void
  placeBid: (lotId: string, amount: number, qty: number) => string | null
  placeBids: (
    entries: Array<{ lotId: string; amount: number; qty: number }>,
  ) => { ok: number; errors: Array<{ lotId: string; message: string }> }
  buyNow: (lotId: string, qty?: number) => string | null
  addToCart: (lotId: string, qty: number) => string | null
  removeFromCart: (lotId: string) => void
  checkoutCart: () => string | null
  placeOffer: (lotId: string, qty: number, unitPrice: number) => string | null
  reviewOffer: (id: string, decision: 'accepted' | 'declined') => string | null
  confirmOffer: (id: string) => string | null
  cancelOffer: (id: string) => string | null
  toggleWatch: (lotId: string) => void
  submitPayment: (id: string, receiptName: string, receiptData: string) => string | null
  reviewPayment: (id: string, side: PayReviewSide, decision: PayDecision) => string | null
  reviewInvoiceIssue: (id: string, side: PayReviewSide, decision: PayDecision) => string | null
  saveInvoice: (invoice: Invoice, previousId?: string) => string | null
  removeInvoice: (id: string) => string | null
  clearPaymentConfirmation: (id: string) => string | null
  markInvoiceOpened: (id: string) => void
  markNoticesRead: () => void
  myBid: (lotId: string) => number | undefined
  myLastBid: (lotId: string) => Bid | undefined
  addLot: (lot: Lot) => void
  addLots: (lots: Lot[]) => void
  submitListingDrop: (items: ListingDropItem[]) => string | null
  withdrawListingDrop: (id: string) => string | null
  reviewListingDrop: (id: string, decision: 'approved' | 'declined') => string | null
  saveSku: (sku: InventorySku) => string | null
  removeSku: (id: string) => string | null
  updateLot: (lot: Lot) => void
  removeLot: (lotId: string) => void
  saveSettings: (next: SiteSettings) => void
  saveAccount: (account: Account, previousId?: string) => string | null
  removeAccount: (accountId: string) => string | null
  setAccountStatus: (accountId: string, status: Account['status']) => string | null
  extendLot: (lotId: string, minutes?: number) => void
  extendAuctionType: (slug: string, minutes?: number) => void
  reopenAuctions: (slug?: string) => void
}

const StoreContext = createContext<Store | null>(null)
const NowContext = createContext(0)

export function useNow() {
  return useContext(NowContext)
}
const AUTH_KEY = 'livebid-auth'
const DATA_KEY = 'livebid-data'

type Persisted = {
  lots: Lot[]
  bids: Bid[]
  watchlist: string[]
  invoices: Invoice[]
  notices: Notice[]
  cart: CartItem[]
  offers: MarketOffer[]
  listingDrops: ListingDrop[]
  inventory: InventorySku[]
  settings: SiteSettings
  accounts: Account[]
}

function sessionUser(account: Account): User {
  return {
    accountId: account.accountId,
    company: account.company,
    email: account.email,
    role: account.role,
    status: account.status,
  }
}

function mergeAccounts(stored?: Account[] | null): Account[] {
  let extra: Account[] = []
  try {
    const raw = localStorage.getItem('livebid-members')
    if (raw) {
      extra = (JSON.parse(raw) as Array<Partial<Account> & { accountId: string; password: string }>).map(
        (m) => ({
          accountId: m.accountId.toUpperCase(),
          password: m.password,
          company: m.company || '',
          email: m.email || '',
          address: m.address || '',
          role: m.role === 'admin' || m.role === 'superadmin' ? m.role : 'member',
          status: m.status === 'pending' || m.status === 'disabled' ? m.status : 'active',
        }),
      )
    }
  } catch {
    /* ignore */
  }
  const byId = new Map<string, Account>()
  for (const a of [...SEED_ACCOUNTS, ...extra, ...(stored || [])]) {
    const id = a.accountId.toUpperCase()
    const prev = byId.get(id)
    byId.set(id, {
      ...prev,
      ...a,
      accountId: id,
      address: a.address || prev?.address || '',
      role: a.role || prev?.role || 'member',
      status: a.status || prev?.status || 'active',
    })
  }
  const superAcc = byId.get(SUPER_USER.accountId) || SUPER_USER
  byId.set(SUPER_USER.accountId, {
    ...superAcc,
    role: 'superadmin',
    status: 'active',
    company: SUPER_USER.company,
  })
  return [...byId.values()]
}

const LEGACY_NAVY = new Set(['#164e78', '#0b2c4d', '#123a63', '#133a8a', '#0d2c6b'])
const LEGACY_LIVE = new Set(['#c4161c', '#d32f2f', '#e53935'])

function mergeTheme(partial?: Partial<ThemeSettings> | null): ThemeSettings {
  const navy = partial?.navy?.toLowerCase()
  const live = partial?.live?.toLowerCase()
  if (!navy || LEGACY_NAVY.has(navy) || (live && LEGACY_LIVE.has(live))) {
    return { ...DEFAULT_SETTINGS.theme }
  }
  return { ...DEFAULT_SETTINGS.theme, ...partial }
}

function mergeBrand(partial?: Partial<SiteSettings> | null) {
  const legacyName = !partial?.brandName || partial.brandName === 'LiveBid'
  return {
    brandName: (legacyName ? DEFAULT_SETTINGS.brandName : partial?.brandName || DEFAULT_SETTINGS.brandName).trim(),
    brandMark:
      legacyName || !partial?.brandMark || partial.brandMark === 'LB'
        ? DEFAULT_SETTINGS.brandMark
        : partial.brandMark,
    brandLogo:
      !partial?.brandLogo?.trim() || partial.brandLogo.includes('equarios-logo.jpg')
        ? DEFAULT_SETTINGS.brandLogo
        : partial.brandLogo.trim(),
    tagline:
      !partial?.tagline || partial.tagline === 'Wholesale auctions and marketplace'
        ? DEFAULT_SETTINGS.tagline
        : partial.tagline,
  }
}

function mergeSettings(partial?: Partial<SiteSettings> | null): SiteSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    ...mergeBrand(partial),
    filters: { ...DEFAULT_SETTINGS.filters, ...partial?.filters },
    grades: partial?.grades?.length ? partial.grades : DEFAULT_SETTINGS.grades,
    auctionTypes: (() => {
      const next = normalizeAuctionTypes(partial?.auctionTypes)
      if (!next.length) return DEFAULT_SETTINGS.auctionTypes
      const stock = new Set(['live', 'sealed', 'hybrid'])
      const hasOld = next.some((t) => t.value === 'sealed' || t.value === 'hybrid')
      const hasOffline = next.some((t) => t.value === 'offline')
      if (!hasOld && hasOffline) {
        return next.map((t) =>
          t.value === 'live' && (t.label === 'Real-time' || t.label === 'Live')
            ? { ...t, label: 'Live Auctions' }
            : t,
        )
      }
      const custom = next.filter((t) => !stock.has(t.value) && t.value !== 'offline')
      const liveDef = DEFAULT_SETTINGS.auctionTypes.find((t) => t.value === 'live')!
      const offlineDef = DEFAULT_SETTINGS.auctionTypes.find((t) => t.value === 'offline')!
      const existingLive = next.find((t) => t.value === 'live')
      const existingOffline = next.find((t) => t.value === 'offline')
      return [
        existingLive
          ? {
              ...liveDef,
              label:
                existingLive.label === 'Real-time' || existingLive.label === 'Live'
                  ? 'Live Auctions'
                  : existingLive.label,
              fillMode: existingLive.fillMode || 'live',
              intro: existingLive.intro || liveDef.intro,
              closesAt: existingLive.closesAt || liveDef.closesAt,
              closeMinutes: existingLive.closeMinutes || liveDef.closeMinutes,
            }
          : liveDef,
        existingOffline
          ? {
              ...offlineDef,
              label: existingOffline.label,
              intro:
                existingOffline.intro && existingOffline.intro.includes('fill bar')
                  ? existingOffline.intro
                  : offlineDef.intro,
              fillMode: 'sealed',
              closesAt: existingOffline.closesAt || offlineDef.closesAt,
              closeMinutes: existingOffline.closeMinutes || offlineDef.closeMinutes,
            }
          : offlineDef,
        ...custom,
      ]
    })(),
    theme: mergeTheme(partial?.theme),
    features: { ...DEFAULT_SETTINGS.features, ...partial?.features },
    copy: (() => {
      const copy = { ...DEFAULT_SETTINGS.copy, ...partial?.copy }
      if (copy.navAuctions === 'Auction') copy.navAuctions = DEFAULT_SETTINGS.copy.navAuctions
      if (/under \{?n\}? min/i.test(copy.endingSoon)) copy.endingSoon = DEFAULT_SETTINGS.copy.endingSoon
      if (/48 hours/i.test(copy.siteNotice)) copy.siteNotice = DEFAULT_SETTINGS.copy.siteNotice
      return copy
    })(),
    icons: { ...DEFAULT_SETTINGS.icons, ...partial?.icons },
    invoice: { ...DEFAULT_SETTINGS.invoice, ...partial?.invoice },
    reopenMinutes: Math.max(
      1,
      Math.round(partial?.reopenMinutes ?? (partial?.reopenHours ?? DEFAULT_SETTINGS.reopenHours) * 60),
    ),
    extendMinutes: Math.max(
      1,
      Math.round(partial?.extendMinutes ?? (partial?.extendHours ?? DEFAULT_SETTINGS.extendHours) * 60),
    ),
  }
}

function demoInvoices(): Invoice[] {
  const accounts = ['DEMO-1001', 'SUPER-0001', 'ADMIN-0001']
  const day = (n: number) => Date.now() - n * 86400000
  const rows: Omit<Invoice, 'accountId'>[] = [
    {
      id: 'KDP-26-284-018',
      lotId: 'LB-24081',
      channel: 'auction',
      qty: 1,
      unitPrice: 837.42,
      amount: 837.42,
      status: 'unpaid',
      createdAt: day(2),
      opened: false,
      auctionLabel: 'JPN SIM Unlocked iPhone (KDP-26-284)',
    },
    {
      id: 'KDP-26-282-009',
      lotId: 'LB-24082',
      channel: 'auction',
      qty: 70,
      unitPrice: 1147.93,
      amount: 80355.3,
      status: 'unpaid',
      createdAt: day(2),
      opened: false,
      auctionLabel: 'JPN SIM Unlocked Android (KDP-26-282)',
    },
    {
      id: 'HYB-26-288-039',
      lotId: 'LB-24085',
      channel: 'auction',
      qty: 40,
      unitPrice: 1928.33,
      amount: 77133.42,
      status: 'pending_review',
      createdAt: day(2),
      opened: false,
      auctionLabel: 'JPN SIM Unlocked iPhone and Android (HYB-26-288)',
    },
    {
      id: 'KDP-26-269-003',
      lotId: 'LB-24088',
      channel: 'auction',
      qty: 22,
      unitPrice: 318.52,
      amount: 7007.4,
      status: 'paid',
      createdAt: day(16),
      shippedAt: day(7),
      trackingNo: '877859012190',
      opened: true,
      auctionLabel: 'JPN SIM Unlocked iPhone & Earphone (KDP-26-269)',
    },
    {
      id: 'KDP-26-268-008',
      lotId: 'LB-24091',
      channel: 'auction',
      qty: 40,
      unitPrice: 194.31,
      amount: 7772.4,
      status: 'paid',
      createdAt: day(16),
      shippedAt: day(7),
      trackingNo: '877859012190',
      opened: true,
      poNumber: 'PO-4401',
      auctionLabel: 'JPN SIM Unlocked Android (KDP-26-268)',
    },
    {
      id: 'KDP-26-260-010',
      lotId: 'LB-24083',
      channel: 'marketplace',
      qty: 20,
      unitPrice: 319.02,
      amount: 6380.3,
      status: 'paid',
      createdAt: day(23),
      shippedAt: day(8),
      trackingNo: '877804200901',
      opened: true,
      auctionLabel: 'JPN SIM Unlocked Android (KDP-26-260)',
    },
    {
      id: 'KDP-26-203-018',
      lotId: 'LB-24086',
      channel: 'auction',
      qty: 1,
      unitPrice: 27737.88,
      amount: 27737.88,
      status: 'paid',
      createdAt: day(23),
      shippedAt: day(22),
      trackingNo: '877213823034',
      opened: true,
      auctionLabel: 'JPN SIM Unlocked iPhone (KDP-26-203)',
    },
    {
      id: 'KDP-26-254-010',
      lotId: 'LB-24090',
      channel: 'auction',
      qty: 1,
      unitPrice: 21752.52,
      amount: 21752.52,
      status: 'paid',
      createdAt: day(30),
      shippedAt: day(22),
      trackingNo: '877213823034',
      opened: true,
      auctionLabel: 'JPN SIM Unlocked Android (KDP-26-254)',
    },
  ]
  return accounts.flatMap((accountId) =>
    rows.map((row) => ({ ...row, id: `${row.id}-${accountId.slice(-4)}`, accountId })),
  )
}

function mergeDemoInvoices(invoices: Invoice[]): Invoice[] {
  const seed = demoInvoices()
  const have = new Set(invoices.map((i) => i.id))
  const extra = seed.filter((i) => !have.has(i.id))
  return extra.length ? [...invoices, ...extra] : invoices
}

function mergeHistoryBids(bids: Bid[]): Bid[] {
  const seed = demoFillBids()
  const have = new Set(bids.map((b) => `${b.lotId}:${b.accountId}`))
  const extra = seed.filter((b) => !have.has(`${b.lotId}:${b.accountId}`))
  return extra.length ? [...bids, ...extra] : bids
}

function staffIssueNotices(accounts: Account[], invoices: Invoice[], at: number): Notice[] {
  const staff = accounts.filter((a) => a.role === 'admin' || a.role === 'superadmin')
  return invoices.flatMap((inv) =>
    staff.map((a) => ({
      id: `N-ISSUE-${inv.id}-${a.accountId}`,
      accountId: a.accountId,
      kind: 'invoice' as const,
      title: 'Invoice waiting to be issued',
      body: `${inv.id} · ${inv.qty} pcs. Admin then Super must stamp it before the buyer can pay.`,
      href: a.role === 'superadmin' ? '/super' : '/admin',
      at,
    })),
  )
}

function demoFillBids(): Bid[] {
  const at = Date.now()
  const clients = ['DEMO-1001', 'SUPER-0001', 'ADMIN-0001']
  const clientBids: Bid[] = clients.flatMap((accountId, i) => [
    { lotId: 'LB-24083', accountId, amount: 320, qty: 80, at: at - 86400000 * 2 - i },
    { lotId: 'LB-24084', accountId, amount: 355, qty: 60, at: at - 86400000 - i },
    { lotId: 'LB-24085', accountId, amount: 340, qty: 70, at: at - 7200000 - i },
    { lotId: 'LB-24087', accountId, amount: 230, qty: 82, at: at - 3600000 - i },
    { lotId: 'LB-24088', accountId, amount: 401, qty: 22, at: at - 1800000 - i },
    { lotId: 'LB-24089', accountId, amount: 120, qty: 72, at: at - 900000 - i },
    { lotId: 'LB-24091', accountId, amount: 640, qty: 40, at: at - 600000 - i },
    { lotId: 'LB-24086', accountId, amount: 655, qty: 1, at: at - 400000 - i },
  ])
  return [
    { lotId: 'LB-24089', accountId: 'BOT-SMALL', amount: 400, qty: 40, at: Date.now() - 8000 },
    { lotId: 'LB-24089', accountId: 'BOT-ALL', amount: 350, qty: 400, at: Date.now() - 4000 },
    { lotId: 'LB-24085', accountId: 'BOT-SMALL', amount: 640, qty: 40, at: Date.now() - 6000 },
    { lotId: 'LB-24085', accountId: 'BOT-ALL', amount: 590, qty: 200, at: Date.now() - 3000 },
    ...clientBids,
  ]
}

function loadData(): Persisted {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted
      const bids = (parsed.bids || []).map((b) => ({
        ...b,
        qty: b.qty || 1,
        accountId: b.accountId || 'UNKNOWN',
      }))
      return clockedPersisted({
        ...parsed,
        lots: (() => {
          const existing = parsed.lots || []
          const byId = new Map(existing.map((l) => [l.id, l]))
          const fromSeed = SEED_LOTS.map((s) => {
            const cur = byId.get(s.id)
            if (!cur) return s
            return {
              ...cur,
              auctionType: migrateLotAuctionType(cur.auctionType || s.auctionType),
              modelNumber: cur.modelNumber || s.modelNumber,
              origin: cur.origin || s.origin,
              moq: 'moq' in cur ? cur.moq : s.moq,
              qty: cur.qty < 100 && s.qty >= 100 ? s.qty : cur.qty,
            }
          })
          const extras = existing
            .filter((l) => !SEED_LOTS.some((s) => s.id === l.id))
            .map((l) => ({ ...l, auctionType: migrateLotAuctionType(l.auctionType) }))
          return [...fromSeed, ...extras]
        })(),
        bids: mergeHistoryBids(
          bids.some((b) => b.accountId === 'BOT-SMALL' || b.accountId === 'BOT-ALL')
            ? bids
            : [...bids, ...demoFillBids()],
        ),
        invoices: mergeDemoInvoices(
          (parsed.invoices || []).map((inv) => ({
            ...inv,
            qty: inv.qty || 1,
            unitPrice: inv.unitPrice || inv.amount,
            channel:
              inv.channel ||
              parsed.lots.find((x) => x.id === inv.lotId)?.channel ||
              'marketplace',
            status:
              inv.status === 'paid' ||
              inv.status === 'pending_review' ||
              inv.status === 'declined' ||
              inv.status === 'draft'
                ? inv.status
                : 'unpaid',
          })),
        ),
        cart: parsed.cart || [],
        offers: Array.isArray(parsed.offers) ? parsed.offers : [],
        listingDrops: Array.isArray(parsed.listingDrops) ? parsed.listingDrops : [],
        inventory:
          Array.isArray(parsed.inventory) && parsed.inventory.length
            ? parsed.inventory
            : inventoryFromLots([...(parsed.lots || []), ...SEED_LOTS]),
        notices: parsed.notices || [],
        settings: mergeSettings(parsed.settings),
        accounts: mergeAccounts(parsed.accounts),
      })
    }
  } catch {
    /* ignore */
  }
  const fresh = {
    lots: SEED_LOTS,
    bids: demoFillBids(),
    watchlist: [],
    invoices: demoInvoices(),
    notices: [],
    cart: [],
    offers: [],
    listingDrops: [],
    inventory: inventoryFromLots(SEED_LOTS),
    settings: DEFAULT_SETTINGS,
    accounts: mergeAccounts([]),
  }
  return clockedPersisted(fresh)
}

function clockedPersisted(data: Persisted): Persisted {
  const next = ensureAuctionClocks(data.settings, data.lots)
  return { ...data, settings: next.settings, lots: next.lots }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as User
      if (parsed.accountId === SUPER_USER.accountId) {
        return { ...parsed, role: 'superadmin', status: 'active' }
      }
      return {
        ...parsed,
        role: parsed.role === 'superadmin' ? 'member' : parsed.role || 'member',
        status: parsed.status || 'active',
      }
    } catch {
      return null
    }
  })
  const [data, setData] = useState<Persisted>(loadData)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(data))
    } catch {
      try {
        const slim = {
          ...data,
          invoices: data.invoices.map((inv) => ({
            ...inv,
            receiptData: inv.receiptData && inv.receiptData.length > 120000 ? undefined : inv.receiptData,
          })),
        }
        localStorage.setItem(DATA_KEY, JSON.stringify(slim))
      } catch {
        /* quota — keep in-memory invoices so admin can still review this session */
      }
    }
  }, [data])

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== DATA_KEY || !e.newValue) return
      try {
        const parsed = JSON.parse(e.newValue) as Persisted
        if (!parsed.invoices) return
        setData((prev) => {
          if (prev.invoices === parsed.invoices) return prev
          return { ...prev, invoices: parsed.invoices }
        })
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      setData((prev) => {
        const nowTs = Date.now()
        const extraBids: Bid[] = []
        if (!prev.settings.features.bots) return prev
        const lots = prev.lots.map((lot) => {
          if (lot.channel !== 'auction') return lot
          if (lot.endsAt <= nowTs) return lot
          if (lot.endsAt - nowTs < 2 * 60 * 1000) return lot
          if (isSealedLot(lot, prev.settings)) return lot
          if (Math.random() > 0.4) return lot
          const takeAll = lot.qty > 1 && Math.random() > 0.55
          const minQty = lotMoq(lot)
          const qty = takeAll
            ? lot.qty
            : Math.max(minQty, Math.min(lot.qty, minQty + Math.floor(Math.random() * 10)))
          const bump = takeAll ? 1 : 2 + Math.floor(Math.random() * 8)
          const amount = lot.currentPrice + bump
          extraBids.push({
            lotId: lot.id,
            accountId: takeAll ? 'BOT-ALL' : 'BOT-SMALL',
            amount,
            qty,
            at: nowTs,
          })
          return {
            ...lot,
            currentPrice: Math.max(lot.currentPrice, amount),
            bidCount: lot.bidCount + 1,
          }
        })
        if (!extraBids.length) return prev
        return {
          ...prev,
          lots,
          bids: [...prev.bids, ...extraBids],
        }
      })
    }, 12000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const tick = () => {
      setData((prev) => {
        const settled = settleClosedAuctions(
          prev.lots,
          prev.bids,
          prev.invoices,
          prev.notices || [],
          Date.now(),
          prev.accounts.filter((a) => a.role === 'admin' || a.role === 'superadmin'),
          prev.settings,
        )
        const notices = buyerCareNotices(
          prev.lots,
          prev.bids,
          prev.watchlist,
          user?.accountId,
          settled.notices,
          Date.now(),
          prev.settings.endingSoonMinutes,
          prev.settings,
        )
        if (settled.invoices === prev.invoices && notices === (prev.notices || [])) return prev
        return { ...prev, invoices: settled.invoices, notices }
      })
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [user?.accountId])

  const login = useCallback((accountId: string, password: string) => {
    const key = accountId.trim()
    const found = data.accounts.find(
      (a) =>
        a.accountId === key.toUpperCase() || a.email.toLowerCase() === key.toLowerCase(),
    )
    if (!found || found.password !== password) return data.settings.copy.warnLogin
    if (found.status === 'pending') return data.settings.copy.warnPending
    if (found.status === 'disabled') return data.settings.copy.warnDisabled
    const next = sessionUser(found)
    setUser(next)
    localStorage.setItem(AUTH_KEY, JSON.stringify(next))
    return null
  }, [data.accounts, data.settings.copy])

  const register = useCallback(
    (accountId: string, company: string, email: string, password: string) => {
      if (!accountId.trim() || !company.trim() || !email.trim() || password.length < 6) {
        return data.settings.copy.warnRegister
      }
      const id = accountId.trim().toUpperCase()
      if (data.accounts.some((a) => a.accountId === id)) {
        return data.settings.copy.warnAccountTaken
      }
      setData((prev) => ({
        ...prev,
        accounts: [
          ...prev.accounts,
          {
            accountId: id,
            password,
            company: company.trim(),
            email: email.trim(),
            role: 'member',
            status: 'pending',
          },
        ],
      }))
      return null
    },
    [data.accounts, data.settings.copy],
  )

  const RESET_KEY = 'equarios-reset'

  const requestPasswordReset = useCallback((ident: string) => {
    const key = ident.trim()
    const found = data.accounts.find(
      (a) =>
        a.accountId === key.toUpperCase() || a.email.toLowerCase() === key.toLowerCase(),
    )
    if (!found) return { error: data.settings.copy.warnLogin }
    if (found.status === 'disabled') return { error: data.settings.copy.warnDisabled }
    const code = String(1000 + Math.floor(Math.random() * 9000))
    try {
      localStorage.setItem(
        RESET_KEY,
        JSON.stringify({ accountId: found.accountId, code, at: Date.now() }),
      )
    } catch {
      return { error: 'Could not start a reset on this device.' }
    }
    return { code, email: found.email }
  }, [data.accounts, data.settings.copy])

  const resetPassword = useCallback((ident: string, code: string, password: string) => {
    if (password.length < 6) return data.settings.copy.warnRegister
    let packed: { accountId: string; code: string; at: number } | null = null
    try {
      packed = JSON.parse(localStorage.getItem(RESET_KEY) || 'null')
    } catch {
      packed = null
    }
    if (!packed?.code) return 'Request a reset code first.'
    if (Date.now() - packed.at > 30 * 60 * 1000) return 'That reset code expired. Request a new one.'
    if (packed.code !== code.trim()) return 'That reset code does not match.'
    const key = ident.trim()
    const found = data.accounts.find(
      (a) =>
        a.accountId === packed.accountId &&
        (a.accountId === key.toUpperCase() || a.email.toLowerCase() === key.toLowerCase()),
    )
    if (!found) return data.settings.copy.warnLogin
    setData((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) =>
        a.accountId === found.accountId ? { ...a, password } : a,
      ),
    }))
    localStorage.removeItem(RESET_KEY)
    return null
  }, [data.accounts, data.settings.copy])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(AUTH_KEY)
  }, [])

  const myBid = useCallback(
    (lotId: string) => {
      const id = user?.accountId
      const mine = data.bids.filter((b) => b.lotId === lotId && (!id || b.accountId === id))
      if (!mine.length) return undefined
      return Math.max(...mine.map((b) => b.amount))
    },
    [data.bids, user],
  )

  const myLastBid = useCallback(
    (lotId: string) => {
      const id = user?.accountId
      const mine = data.bids.filter((b) => b.lotId === lotId && (!id || b.accountId === id))
      if (!mine.length) return undefined
      return mine.reduce((a, b) => (a.at > b.at ? a : b))
    },
    [data.bids, user],
  )

  const placeBid = useCallback(
    (lotId: string, amount: number, qty: number) => {
      const lot = data.lots.find((l) => l.id === lotId)
      if (!data.settings.features.bidding) return data.settings.copy.warnNoBid
      if (!user) return data.settings.copy.warnLogin
      if (!lot || lot.channel !== 'auction') return data.settings.copy.warnLotMissing
      if (lot.endsAt <= Date.now()) return data.settings.copy.warnClosed
      const qtyErr = checkOrderQty(lot, qty, data.settings.copy)
      if (qtyErr) return qtyErr
      const accountId = user.accountId
      const independent = isSealedLot(lot, data.settings)
      const mine = data.bids.filter((b) => b.lotId === lotId && b.accountId === accountId)
      const lastOwn = mine.length
        ? mine.reduce((a, b) => (a.at > b.at ? a : b)).amount
        : undefined
      const priceErr = checkBidPrice(lot, amount, data.settings.copy, {
        independent,
        lastOwnAmount: lastOwn,
      })
      if (priceErr) return priceErr
      setData((prev) => ({
        ...prev,
        lots: prev.lots.map((l) =>
          l.id === lotId
            ? {
                ...l,
                currentPrice: independent ? l.currentPrice : Math.max(l.currentPrice, amount),
                bidCount: l.bidCount + 1,
              }
            : l,
        ),
        bids: [...prev.bids, { lotId, accountId, amount, qty, at: Date.now() }],
      }))
      return null
    },
    [data.lots, data.bids, data.settings, user],
  )

  const placeBids = useCallback(
    (entries: Array<{ lotId: string; amount: number; qty: number }>) => {
      const copy = data.settings.copy
      const accountId = user?.accountId
      const errors: Array<{ lotId: string; message: string }> = []
      const ok: Array<{ lotId: string; amount: number; qty: number; independent: boolean }> = []
      if (!data.settings.features.bidding) {
        return { ok: 0, errors: [{ lotId: '—', message: copy.warnNoBid }] }
      }
      if (!accountId) {
        return { ok: 0, errors: [{ lotId: '—', message: copy.warnLogin }] }
      }
      const now = Date.now()
      const lastSeen = new Map<string, number>()
      for (const entry of entries) {
        const lot = data.lots.find((l) => l.id.toUpperCase() === entry.lotId.trim().toUpperCase())
        if (!lot || lot.channel !== 'auction') {
          errors.push({ lotId: entry.lotId || '—', message: copy.warnLotMissing })
          continue
        }
        if (lot.endsAt <= now) {
          errors.push({ lotId: lot.id, message: copy.warnClosed })
          continue
        }
        const qtyErr = checkOrderQty(lot, entry.qty, copy)
        if (qtyErr) {
          errors.push({ lotId: lot.id, message: qtyErr })
          continue
        }
        const independent = isSealedLot(lot, data.settings)
        const mine = data.bids.filter((b) => b.lotId === lot.id && b.accountId === accountId)
        const storedLast = mine.length
          ? mine.reduce((a, b) => (a.at > b.at ? a : b)).amount
          : undefined
        const lastOwn = lastSeen.has(lot.id) ? lastSeen.get(lot.id) : storedLast
        const priceErr = checkBidPrice(lot, entry.amount, copy, {
          independent,
          lastOwnAmount: lastOwn,
        })
        if (priceErr) {
          errors.push({ lotId: lot.id, message: priceErr })
          continue
        }
        lastSeen.set(lot.id, entry.amount)
        ok.push({ lotId: lot.id, amount: entry.amount, qty: entry.qty, independent })
      }
      if (!ok.length) return { ok: 0, errors }
      const at = Date.now()
      setData((prev) => {
        let lots = prev.lots
        let bids = prev.bids
        for (const entry of ok) {
          lots = lots.map((l) =>
            l.id === entry.lotId
              ? {
                  ...l,
                  currentPrice: entry.independent
                    ? l.currentPrice
                    : Math.max(l.currentPrice, entry.amount),
                  bidCount: l.bidCount + 1,
                }
              : l,
          )
          bids = [...bids, { lotId: entry.lotId, accountId, amount: entry.amount, qty: entry.qty, at }]
        }
        return { ...prev, lots, bids }
      })
      return { ok: ok.length, errors }
    },
    [data.lots, data.bids, data.settings, user],
  )

  const buyNow = useCallback(
    (lotId: string, qty?: number) => {
      const lot = data.lots.find((l) => l.id === lotId)
      if (!lot || lot.channel !== 'marketplace' || !lot.buyNowPrice) {
        return data.settings.copy.warnListingGone.replace('{id}', lotId)
      }
      const pcs = qty ?? lot.qty
      const qtyErr = checkOrderQty(lot, pcs, data.settings.copy)
      if (qtyErr) return qtyErr
      const invoice = buildInvoice(
        {
          id: `INV-${Date.now().toString().slice(-6)}`,
          lotId,
          channel: 'marketplace',
          createdAt: Date.now(),
          accountId: user?.accountId,
          lines: [{ lotId, qty: pcs, unitPrice: lot.buyNowPrice }],
        },
        data.settings,
      )
      setData((prev) => ({
        ...prev,
        lots: prev.lots
          .map((l) => {
            if (l.id !== lotId) return l
            return { ...l, qty: l.qty - pcs }
          })
          .filter((l) => l.channel !== 'marketplace' || l.qty > 0),
        invoices: [invoice, ...prev.invoices],
        notices: [
          ...staffIssueNotices(prev.accounts, [invoice], invoice.createdAt),
          ...(user?.accountId
            ? [
                {
                  id: `N-DRAFT-${invoice.id}`,
                  accountId: user.accountId,
                  kind: 'invoice' as const,
                  title: 'Purchase recorded',
                  body: `Invoice ${invoice.id} will appear after Admin and Super issue it.`,
                  href: '/account',
                  at: invoice.createdAt,
                },
              ]
            : []),
          ...(prev.notices || []),
        ],
      }))
      return null
    },
    [data.lots, data.settings, user],
  )

  const addToCart = useCallback(
    (lotId: string, qty: number) => {
      const lot = data.lots.find((l) => l.id === lotId)
      if (!data.settings.features.cart) return data.settings.copy.warnCart
      if (!lot || lot.channel !== 'marketplace' || !lot.buyNowPrice) {
        return data.settings.copy.warnListingGone.replace('{id}', lotId)
      }
      if (!Number.isInteger(qty) || qty < 1) return data.settings.copy.warnQty
      const already = data.cart.find((c) => c.lotId === lotId)?.qty ?? 0
      const nextQty = already + qty
      const qtyErr = checkOrderQty(lot, nextQty, data.settings.copy)
      if (qtyErr) return qtyErr
      setData((prev) => {
        const exists = prev.cart.some((c) => c.lotId === lotId)
        const cart = exists
          ? prev.cart.map((c) => (c.lotId === lotId ? { ...c, qty: nextQty } : c))
          : [...prev.cart, { lotId, qty }]
        return { ...prev, cart }
      })
      return null
    },
    [data.lots, data.cart, data.settings],
  )

  const removeFromCart = useCallback((lotId: string) => {
    setData((prev) => ({ ...prev, cart: prev.cart.filter((c) => c.lotId !== lotId) }))
  }, [])

  const checkoutCart = useCallback(() => {
    if (!data.cart.length) return data.settings.copy.emptyCart
    const stamp = Date.now()
    const lines = []
    for (const item of data.cart) {
      const lot = data.lots.find((l) => l.id === item.lotId)
      if (!lot || lot.channel !== 'marketplace' || !lot.buyNowPrice) {
        return data.settings.copy.warnListingGone.replace('{id}', item.lotId)
      }
      const qtyErr = checkOrderQty(lot, item.qty, data.settings.copy)
      if (qtyErr) return `${lot.model}: ${qtyErr}`
      lines.push({ lotId: item.lotId, qty: item.qty, unitPrice: lot.buyNowPrice })
    }
    const d = new Date(stamp)
    const yy = String(d.getFullYear()).slice(-2)
    const doy = String(
      Math.floor((stamp - Date.UTC(d.getFullYear(), 0, 0)) / 86400000),
    ).padStart(3, '0')
    const invoices: Invoice[] = [
      buildInvoice(
        {
          id: `MKT-${yy}-${doy}-${stamp.toString().slice(-3)}`,
          lotId: lines[0].lotId,
          channel: 'marketplace',
          createdAt: stamp,
          accountId: user?.accountId,
          lines,
        },
        data.settings,
      ),
    ]
    const byId = new Map(data.cart.map((c) => [c.lotId, c.qty]))
    setData((prev) => ({
      ...prev,
      cart: [],
      lots: prev.lots
        .map((l) => {
          const take = byId.get(l.id)
          if (!take) return l
          return { ...l, qty: l.qty - take }
        })
        .filter((l) => l.channel !== 'marketplace' || l.qty > 0),
      invoices: [...invoices, ...prev.invoices],
      notices: [
        ...staffIssueNotices(prev.accounts, invoices, stamp),
        ...(user?.accountId
          ? [
              {
                id: `N-DRAFT-CART-${stamp}`,
                accountId: user.accountId,
                kind: 'invoice' as const,
                title: 'Checkout recorded',
                body: `${invoices.length} invoice${invoices.length === 1 ? '' : 's'} will appear after Admin and Super issue ${invoices.length === 1 ? 'it' : 'them'}.`,
                href: '/account',
                at: stamp,
              },
            ]
          : []),
        ...(prev.notices || []),
      ],
    }))
    return null
  }, [data.cart, data.lots, data.settings, user])

  const placeOffer = useCallback(
    (lotId: string, qty: number, unitPrice: number) => {
      if (!user) return data.settings.copy.warnLogin
      if (!data.settings.features.offers) return data.settings.copy.warnOffers
      const lot = data.lots.find((l) => l.id === lotId)
      if (!lot || lot.channel !== 'marketplace' || !lot.buyNowPrice) {
        return data.settings.copy.warnListingGone.replace('{id}', lotId)
      }
      const qtyErr = checkOrderQty(lot, qty, data.settings.copy)
      if (qtyErr) return qtyErr
      if (!Number.isFinite(unitPrice) || unitPrice < 1) return data.settings.copy.warnMinPrice.replace('{price}', '$1')
      if (unitPrice >= lot.buyNowPrice) {
        return data.settings.copy.warnOfferPrice.replace('{price}', String(lot.buyNowPrice))
      }
      const open = (data.offers || []).find(
        (o) => o.lotId === lotId && o.accountId === user.accountId && o.status === 'accepted',
      )
      if (open) return data.settings.copy.warnOfferOpen
      const offer: MarketOffer = {
        id: `OFF-${Date.now().toString().slice(-8)}`,
        lotId,
        accountId: user.accountId,
        qty,
        unitPrice: Math.round(unitPrice),
        listedPrice: lot.buyNowPrice,
        status: 'pending',
        createdAt: Date.now(),
      }
      setData((prev) => {
        const rest = (prev.offers || []).filter(
          (o) => !(o.lotId === lotId && o.accountId === user.accountId && o.status === 'pending'),
        )
        const staff = prev.accounts.filter((a) => a.role === 'admin' || a.role === 'superadmin')
        const notices: Notice[] = [
          ...staff.map((a) => ({
            id: `N-OFFR-${offer.id}-${a.accountId}`,
            accountId: a.accountId,
            kind: 'offer' as const,
            title: 'New marketplace offer',
            body: `${user.company} · ${lot.manufacturer} ${lot.model} · ${qty} pcs @ ${offer.unitPrice}`,
            href: '/admin',
            at: Date.now(),
          })),
          ...(prev.notices || []),
        ]
        return { ...prev, offers: [offer, ...rest], notices }
      })
      return null
    },
    [data.lots, data.offers, data.settings, user],
  )

  const reviewOffer = useCallback(
    (id: string, decision: 'accepted' | 'declined') => {
      if (user?.role !== 'admin' && user?.role !== 'superadmin') return 'Only staff can review offers.'
      const offer = (data.offers || []).find((o) => o.id === id)
      if (!offer || offer.status !== 'pending') return 'That offer is not waiting for review.'
      setData((prev) => ({
        ...prev,
        offers: (prev.offers || []).map((o) =>
          o.id === id
            ? { ...o, status: decision, reviewedAt: Date.now(), reviewedBy: user.accountId }
            : o,
        ),
        notices: [
          {
            id: `N-OFF-${id}-${decision}`,
            accountId: offer.accountId,
            kind: 'offer' as const,
            title: decision === 'accepted' ? 'Offer accepted' : 'Offer declined',
            body:
              decision === 'accepted'
                ? 'Confirm the offer on Marketplace to create an invoice.'
                : 'Your marketplace offer was declined.',
            href: '/marketplace',
            at: Date.now(),
          },
          ...(prev.notices || []),
        ],
      }))
      return null
    },
    [data.offers, user],
  )

  const confirmOffer = useCallback(
    (id: string) => {
      if (!user) return data.settings.copy.warnLogin
      const offer = (data.offers || []).find((o) => o.id === id)
      if (!offer || offer.accountId !== user.accountId) return 'Offer not found.'
      if (offer.status !== 'accepted') return 'This offer is not accepted yet.'
      const lot = data.lots.find((l) => l.id === offer.lotId)
      if (!lot || lot.channel !== 'marketplace') {
        return data.settings.copy.warnListingGone.replace('{id}', offer.lotId)
      }
      const qtyErr = checkOrderQty(lot, offer.qty, data.settings.copy)
      if (qtyErr) return qtyErr
      const invoice = buildInvoice(
        {
          id: `INV-${Date.now().toString().slice(-6)}-${offer.lotId.slice(-3)}`,
          lotId: offer.lotId,
          channel: 'marketplace',
          createdAt: Date.now(),
          accountId: user.accountId,
          remarks: `Accepted offer ${offer.id}`,
          lines: [{ lotId: offer.lotId, qty: offer.qty, unitPrice: offer.unitPrice }],
        },
        data.settings,
      )
      setData((prev) => ({
        ...prev,
        offers: (prev.offers || []).map((o) => (o.id === id ? { ...o, status: 'confirmed' as const } : o)),
        invoices: [invoice, ...prev.invoices],
        lots: prev.lots
          .map((l) => (l.id === offer.lotId ? { ...l, qty: l.qty - offer.qty } : l))
          .filter((l) => l.channel !== 'marketplace' || l.qty > 0),
        notices: [
          ...staffIssueNotices(prev.accounts, [invoice], invoice.createdAt),
          {
            id: `N-OFFINV-${id}`,
            accountId: user.accountId,
            kind: 'invoice' as const,
            title: 'Offer confirmed',
            body: `Invoice ${invoice.id} will appear after Admin and Super issue it.`,
            href: '/account',
            at: invoice.createdAt,
          },
          ...(prev.notices || []),
        ],
      }))
      return null
    },
    [data.lots, data.offers, data.settings, user],
  )

  const cancelOffer = useCallback(
    (id: string) => {
      if (!user) return data.settings.copy.warnLogin
      const offer = (data.offers || []).find((o) => o.id === id)
      if (!offer) return 'Offer not found.'
      const mine = offer.accountId === user.accountId
      const staff = user.role === 'admin' || user.role === 'superadmin'
      if (!mine && !staff) return 'Offer not found.'
      if (offer.status !== 'pending' && offer.status !== 'accepted') return 'This offer cannot be cancelled.'
      setData((prev) => ({
        ...prev,
        offers: (prev.offers || []).map((o) => (o.id === id ? { ...o, status: 'cancelled' as const } : o)),
      }))
      return null
    },
    [data.offers, user],
  )

  const toggleWatch = useCallback((lotId: string) => {
    setData((prev) => ({
      ...prev,
      watchlist: prev.watchlist.includes(lotId)
        ? prev.watchlist.filter((id) => id !== lotId)
        : [...prev.watchlist, lotId],
    }))
  }, [])

  const addLot = useCallback((lot: Lot) => {
    setData((prev) => {
      const next = ensureAuctionClocks(prev.settings, [lot, ...prev.lots])
      return { ...prev, settings: next.settings, lots: next.lots }
    })
  }, [])

  const addLots = useCallback((lots: Lot[]) => {
    if (!lots.length) return
    setData((prev) => {
      const next = ensureAuctionClocks(prev.settings, [...lots, ...prev.lots])
      return { ...prev, settings: next.settings, lots: next.lots }
    })
  }, [])

  const submitListingDrop = useCallback(
    (items: ListingDropItem[]) => {
      if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return 'Only staff can send listings for confirmation.'
      }
      if (!items.length) return 'Add at least one item.'
      const used = new Set(data.lots.map((l) => l.id.toUpperCase()))
      for (const drop of data.listingDrops || []) {
        if (drop.status !== 'pending') continue
        for (const item of drop.items) used.add(item.id.toUpperCase())
      }
      const seen = new Set<string>()
      for (const item of items) {
        const id = item.id.trim().toUpperCase()
        if (!id) return 'Every item needs a lot ID.'
        if (seen.has(id) || used.has(id)) return `Lot ID ${item.id} is already used.`
        seen.add(id)
        if (!item.model.trim()) return 'Every item needs a model.'
        if (!Number.isInteger(item.qty) || item.qty < 1) return 'Every item needs qty of at least 1.'
        if (!Number.isFinite(item.currentPrice) || item.currentPrice < 1) return 'Every item needs a valid price.'
        if (!Number.isFinite(item.durationMins) || item.durationMins < 1) {
          return 'Listing duration must be at least 1 minute.'
        }
      }
      const drop: ListingDrop = {
        id: `DROP-${Date.now().toString().slice(-6)}`,
        submittedAt: Date.now(),
        submittedBy: user.accountId,
        status: 'pending',
        items,
      }
      setData((prev) => ({
        ...prev,
        listingDrops: [drop, ...(prev.listingDrops || [])],
        inventory: upsertInventory(prev.inventory || [], items),
      }))
      return null
    },
    [user, data.lots, data.listingDrops],
  )

  const withdrawListingDrop = useCallback(
    (id: string) => {
      if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return 'Only staff can withdraw a catalog.'
      }
      const drop = (data.listingDrops || []).find((d) => d.id === id)
      if (!drop || drop.status !== 'pending') return 'That catalog is no longer waiting.'
      setData((prev) => ({
        ...prev,
        listingDrops: (prev.listingDrops || []).map((d) =>
          d.id === id ? { ...d, status: 'declined' as const, reviewedAt: Date.now(), reviewedBy: user.accountId } : d,
        ),
      }))
      return null
    },
    [user, data.listingDrops],
  )

  const reviewListingDrop = useCallback(
    (id: string, decision: 'approved' | 'declined') => {
      if (!user || user.role !== 'superadmin') return 'Only Super admin can confirm catalogs.'
      const drop = (data.listingDrops || []).find((d) => d.id === id)
      if (!drop || drop.status !== 'pending') return 'That catalog is no longer waiting.'
      if (decision === 'declined') {
        setData((prev) => ({
          ...prev,
          listingDrops: (prev.listingDrops || []).map((d) =>
            d.id === id ? { ...d, status: 'declined' as const, reviewedAt: Date.now(), reviewedBy: user.accountId } : d,
          ),
        }))
        return null
      }
      const now = Date.now()
      const used = new Set(data.lots.map((l) => l.id.toUpperCase()))
      const lots: Lot[] = []
      for (const item of drop.items) {
        const key = item.id.toUpperCase()
        if (used.has(key)) return `Lot ID ${item.id} is already live. Decline this drop and send a new sheet.`
        used.add(key)
        lots.push(liveLotFromDrop(item, now))
      }
      setData((prev) => {
        const next = applyDropClocks(prev.settings, prev.lots, lots, drop.items, now)
        return {
          ...prev,
          settings: next.settings,
          lots: next.lots,
          inventory: upsertInventory(prev.inventory || [], lots),
          listingDrops: (prev.listingDrops || []).map((d) =>
            d.id === id ? { ...d, status: 'approved' as const, reviewedAt: now, reviewedBy: user.accountId } : d,
          ),
        }
      })
      return null
    },
    [user, data.lots, data.listingDrops],
  )

  const saveSku = useCallback(
    (sku: InventorySku) => {
      if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return 'Only staff can edit inventory.'
      }
      if (!sku.model.trim() || !sku.manufacturer.trim()) return 'Maker and model are required.'
      const id = sku.id.trim() || `SKU-${Date.now().toString(36)}`
      const next: InventorySku = { ...sku, id, model: sku.model.trim(), manufacturer: sku.manufacturer.trim() }
      setData((prev) => {
        const list = prev.inventory || []
        const exists = list.some((s) => s.id === id)
        return { ...prev, inventory: exists ? list.map((s) => (s.id === id ? next : s)) : [next, ...list] }
      })
      return null
    },
    [user],
  )

  const removeSku = useCallback(
    (id: string) => {
      if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return 'Only staff can edit inventory.'
      }
      setData((prev) => ({ ...prev, inventory: (prev.inventory || []).filter((s) => s.id !== id) }))
      return null
    },
    [user],
  )

  const updateLot = useCallback((lot: Lot) => {
    setData((prev) => {
      const lots = prev.lots.map((l) => (l.id === lot.id ? { ...l, ...lot } : l))
      const next = ensureAuctionClocks(prev.settings, lots)
      return { ...prev, settings: next.settings, lots: next.lots }
    })
  }, [])

  const removeLot = useCallback((lotId: string) => {
    setData((prev) => ({
      ...prev,
      lots: prev.lots.filter((l) => l.id !== lotId),
      cart: prev.cart.filter((c) => c.lotId !== lotId),
      watchlist: prev.watchlist.filter((id) => id !== lotId),
    }))
  }, [])

  const saveSettings = useCallback((next: SiteSettings) => {
    if (user?.role !== 'superadmin') return
    setData((prev) => {
      const settings = mergeSettings(next)
      const clocked = ensureAuctionClocks(settings, prev.lots)
      return { ...prev, settings: clocked.settings, lots: clocked.lots }
    })
  }, [user])

  const saveAccount = useCallback(
    (account: Account) => {
      if (user?.role !== 'superadmin') return 'Only super admin can manage accounts.'
      const id = account.accountId.trim().toUpperCase()
      if (!id || !account.company.trim() || !account.email.trim()) return 'Fill account ID, company, and email.'
      if (account.role === 'superadmin' && id !== SUPER_USER.accountId) {
        return 'You cannot create another super admin.'
      }
      const existing = data.accounts.find((a) => a.accountId === id)
      if (!existing && account.password.length < 6) return 'Password must be at least 6 characters.'
      const password = account.password || existing?.password
      if (!password || password.length < 6) return 'Password must be at least 6 characters.'
      const next: Account = {
        accountId: id,
        password,
        company: account.company.trim(),
        email: account.email.trim(),
        address: account.address?.trim() || existing?.address || '',
        role: id === SUPER_USER.accountId ? 'superadmin' : account.role === 'admin' ? 'admin' : 'member',
        status: id === SUPER_USER.accountId ? 'active' : account.status,
      }
      setData((prev) => ({
        ...prev,
        accounts: existing
          ? prev.accounts.map((a) => (a.accountId === id ? next : a))
          : [...prev.accounts, next],
      }))
      if (user.accountId === id) {
        const session = sessionUser(next)
        setUser(session)
        localStorage.setItem(AUTH_KEY, JSON.stringify(session))
      }
      return null
    },
    [user, data.accounts],
  )

  const removeAccount = useCallback(
    (accountId: string) => {
      if (user?.role !== 'superadmin') return 'Only super admin can manage accounts.'
      const id = accountId.toUpperCase()
      if (id === SUPER_USER.accountId) return 'The super admin account cannot be removed.'
      if (id === user.accountId) return 'You cannot remove your own account.'
      setData((prev) => ({
        ...prev,
        accounts: prev.accounts.filter((a) => a.accountId !== id),
      }))
      return null
    },
    [user],
  )

  const setAccountStatus = useCallback(
    (accountId: string, status: Account['status']) => {
      if (user?.role !== 'superadmin') return 'Only super admin can manage accounts.'
      const id = accountId.toUpperCase()
      if (id === SUPER_USER.accountId) return 'The super admin account stays active.'
      setData((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => (a.accountId === id ? { ...a, status } : a)),
      }))
      return null
    },
    [user],
  )

  const applyTypeClock = (prev: Persisted, slug: string | undefined, minutes: number) => {
    const closesAt = Date.now() + minutes * 60 * 1000
    const auctionTypes = prev.settings.auctionTypes.map((t) =>
      !slug || t.value === slug ? { ...t, closesAt, closeMinutes: minutes } : t,
    )
    const next = ensureAuctionClocks({ ...prev.settings, auctionTypes }, prev.lots)
    return { ...prev, settings: next.settings, lots: next.lots }
  }

  const extendLot = useCallback((lotId: string, minutes?: number) => {
    setData((prev) => {
      const lot = prev.lots.find((l) => l.id === lotId)
      if (!lot || lot.channel !== 'auction') return prev
      const mins = Math.max(1, minutes ?? prev.settings.extendMinutes ?? (prev.settings.extendHours || 2) * 60)
      return applyTypeClock(prev, lotAuctionSlug(lot), mins)
    })
  }, [])

  const extendAuctionType = useCallback((slug: string, minutes?: number) => {
    setData((prev) => {
      const mins = Math.max(1, minutes ?? prev.settings.extendMinutes ?? (prev.settings.extendHours || 2) * 60)
      return applyTypeClock(prev, slug, mins)
    })
  }, [])

  const reopenAuctions = useCallback((slug?: string) => {
    setData((prev) => {
      const mins = Math.max(1, prev.settings.reopenMinutes ?? (prev.settings.reopenHours || 4) * 60)
      return applyTypeClock(prev, slug, mins)
    })
  }, [])

  const submitPayment = useCallback(
    (id: string, receiptName: string, receiptData: string) => {
      const copy = data.settings.copy
      const inv = data.invoices.find((i) => i.id === id)
      if (!inv) return copy.warnLotMissing
      if (inv.status === 'paid') return copy.okPaid
      if (inv.status === 'draft') return 'This invoice is not issued yet. Admin and Super must stamp it first.'
      if (inv.status === 'pending_review' && user?.role === 'member') return copy.payWaiting
      if (user?.role === 'member' && inv.accountId && inv.accountId !== user.accountId) {
        return copy.warnLotMissing
      }
      if (!receiptData || !receiptName) return copy.warnReceipt
      setData((prev) => ({
        ...prev,
        invoices: prev.invoices.map((row) =>
          row.id === id
            ? settleInvoice({
                ...row,
                receiptName,
                receiptData,
                paidDeclaredAt: Date.now(),
                adminReview: undefined,
                superReview: undefined,
              })
            : row,
        ),
      }))
      return null
    },
    [data.invoices, data.settings.copy, user],
  )

  const reviewPayment = useCallback(
    (id: string, side: PayReviewSide, decision: PayDecision) => {
      if (user?.role !== 'admin' && user?.role !== 'superadmin') {
        return 'Only admin or super admin can review payments.'
      }
      if (side === 'super' && user.role !== 'superadmin') {
        return 'Only super admin can give the super-admin decision.'
      }
      if (side === 'admin' && user.role !== 'admin' && user.role !== 'superadmin') {
        return 'Only admin can give the admin decision.'
      }
      const inv = data.invoices.find((i) => i.id === id)
      if (!inv) return data.settings.copy.warnLotMissing
      if (inv.status === 'draft') return 'Issue this invoice first, then review payment.'
      if (!inv.receiptData) return data.settings.copy.warnReceipt
      const review = { decision, by: user.accountId, at: Date.now() }
      setData((prev) => ({
        ...prev,
        invoices: prev.invoices.map((row) => {
          if (row.id !== id) return row
          const next = {
            ...row,
            adminReview: side === 'admin' ? review : row.adminReview,
            superReview: side === 'super' ? review : row.superReview,
          }
          return settleInvoice(next)
        }),
      }))
      return null
    },
    [data.invoices, data.settings.copy, user],
  )

  const reviewInvoiceIssue = useCallback(
    (id: string, side: PayReviewSide, decision: PayDecision) => {
      if (user?.role !== 'admin' && user?.role !== 'superadmin') {
        return 'Only admin or super admin can issue invoices.'
      }
      if (side === 'super' && user.role !== 'superadmin') {
        return 'Only super admin can give the super-admin issue stamp.'
      }
      const inv = data.invoices.find((i) => i.id === id)
      if (!inv) return data.settings.copy.warnLotMissing
      if (inv.status !== 'draft' && !(inv.status === 'declined' && !inv.issuedAt)) {
        return 'That invoice is already issued.'
      }
      const review = { decision, by: user.accountId, at: Date.now() }
      setData((prev) => {
        let issued: Invoice | undefined
        const invoices = prev.invoices.map((row) => {
          if (row.id !== id) return row
          const next = settleInvoiceIssue({
            ...row,
            issueAdmin: side === 'admin' ? review : row.issueAdmin,
            issueSuper: side === 'super' ? review : row.issueSuper,
          })
          if (row.status === 'draft' && next.status === 'unpaid') issued = next
          return next
        })
        const notices =
          issued && issued.accountId
            ? [
                {
                  id: `N-ISSUED-${issued.id}`,
                  accountId: issued.accountId,
                  kind: 'invoice' as const,
                  title: 'Invoice issued',
                  body: `${issued.id} is ready. Pay within 7 days of issue and upload the receipt.`,
                  href: '/account/invoices',
                  at: Date.now(),
                },
                ...(prev.notices || []),
              ]
            : prev.notices
        return { ...prev, invoices, notices }
      })
      return null
    },
    [data.invoices, data.settings.copy, user],
  )

  const saveInvoice = useCallback(
    (invoice: Invoice, previousId?: string) => {
      if (user?.role !== 'admin' && user?.role !== 'superadmin') {
        return 'Only admin or super admin can edit invoices.'
      }
      const id = invoice.id.trim().toUpperCase()
      if (!id) return 'Invoice ID is required.'
      if (!invoice.lotId) return 'Choose a lot.'
      if (!Number.isInteger(invoice.qty) || invoice.qty < 1) return 'Qty must be a whole number of 1 or more.'
      if (!Number.isFinite(invoice.unitPrice) || invoice.unitPrice < 1) return 'Enter a valid unit price.'
      const lot = data.lots.find((l) => l.id === invoice.lotId)
      const existing = data.invoices.find((row) => row.id === (previousId || id).toUpperCase())
      const lines = invoice.lines?.length
        ? invoice.lines
        : [{ lotId: invoice.lotId, qty: invoice.qty, unitPrice: invoice.unitPrice }]
      const feePct = Number.isFinite(invoice.feePct)
        ? Math.max(0, invoice.feePct as number)
        : existing?.feePct || 0
      const next: Invoice = {
        ...invoice,
        id,
        lotId: invoice.lotId,
        channel: lot?.channel || invoice.channel || 'marketplace',
        qty: invoice.qty,
        unitPrice: invoice.unitPrice,
        feePct,
        lines,
        amount: invoiceTotals({ ...invoice, feePct, lines }, data.settings).total,
        accountId: invoice.accountId?.trim().toUpperCase() || undefined,
        createdAt: invoice.createdAt || Date.now(),
        status: existing ? invoice.status : 'draft',
        issueAdmin: invoice.issueAdmin ?? existing?.issueAdmin,
        issueSuper: invoice.issueSuper ?? existing?.issueSuper,
        issuedAt: invoice.issuedAt ?? existing?.issuedAt,
      }
      const replaceId = (previousId || id).toUpperCase()
      setData((prev) => ({
        ...prev,
        invoices: [
          next,
          ...prev.invoices.filter((row) => row.id !== replaceId && row.id !== id),
        ],
        notices: existing
          ? prev.notices
          : [...staffIssueNotices(prev.accounts, [next], Date.now()), ...(prev.notices || [])],
      }))
      return null
    },
    [data.lots, data.invoices, data.settings, user],
  )

  const removeInvoice = useCallback(
    (id: string) => {
      if (user?.role !== 'admin' && user?.role !== 'superadmin') {
        return 'Only admin or super admin can delete invoices.'
      }
      setData((prev) => ({ ...prev, invoices: prev.invoices.filter((row) => row.id !== id) }))
      return null
    },
    [user],
  )

  const clearPaymentConfirmation = useCallback(
    (id: string) => {
      if (user?.role !== 'admin' && user?.role !== 'superadmin') {
        return 'Only admin or super admin can edit payment confirmations.'
      }
      setData((prev) => ({
        ...prev,
        invoices: prev.invoices.map((row) => {
          if (row.id !== id) return row
          return settleInvoice({
            ...row,
            receiptName: undefined,
            receiptData: undefined,
            paidDeclaredAt: undefined,
            adminReview: undefined,
            superReview: undefined,
          })
        }),
      }))
      return null
    },
    [user],
  )

  const markInvoiceOpened = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      invoices: prev.invoices.map((row) => (row.id === id ? { ...row, opened: true } : row)),
    }))
  }, [])

  const markNoticesRead = useCallback(() => {
    setData((prev) => {
      const mine = user?.accountId
      if (!mine) return prev
      const list = prev.notices || []
      if (!list.some((n) => n.accountId === mine && !n.read)) return prev
      return {
        ...prev,
        notices: list.map((n) => (n.accountId === mine && !n.read ? { ...n, read: true } : n)),
      }
    })
  }, [user])

  const value = useMemo(
    () => ({
      user,
      lots: data.lots,
      bids: data.bids,
      watchlist: data.watchlist,
      invoices: data.invoices,
      notices: data.notices || [],
      cart: data.cart,
      offers: data.offers || [],
      listingDrops: data.listingDrops || [],
      inventory: data.inventory || [],
      accounts: data.accounts,
      settings: data.settings,
      isSuperAdmin: user?.role === 'superadmin',
      isStaff: user?.role === 'admin' || user?.role === 'superadmin',
      login,
      register,
      requestPasswordReset,
      resetPassword,
      logout,
      placeBid,
      placeBids,
      buyNow,
      addToCart,
      removeFromCart,
      checkoutCart,
      placeOffer,
      reviewOffer,
      confirmOffer,
      cancelOffer,
      toggleWatch,
      submitPayment,
      reviewPayment,
      reviewInvoiceIssue,
      saveInvoice,
      removeInvoice,
      clearPaymentConfirmation,
      markInvoiceOpened,
      markNoticesRead,
      myBid,
      myLastBid,
      addLot,
      addLots,
      submitListingDrop,
      withdrawListingDrop,
      reviewListingDrop,
      saveSku,
      removeSku,
      updateLot,
      removeLot,
      saveSettings,
      saveAccount,
      removeAccount,
      setAccountStatus,
      extendLot,
      extendAuctionType,
      reopenAuctions,
    }),
    [
      user,
      data,
      login,
      register,
      requestPasswordReset,
      resetPassword,
      logout,
      placeBid,
      placeBids,
      buyNow,
      addToCart,
      removeFromCart,
      checkoutCart,
      placeOffer,
      reviewOffer,
      confirmOffer,
      cancelOffer,
      toggleWatch,
      submitPayment,
      reviewPayment,
      reviewInvoiceIssue,
      saveInvoice,
      removeInvoice,
      clearPaymentConfirmation,
      markInvoiceOpened,
      markNoticesRead,
      myBid,
      myLastBid,
      addLot,
      addLots,
      submitListingDrop,
      withdrawListingDrop,
      reviewListingDrop,
      saveSku,
      removeSku,
      updateLot,
      removeLot,
      saveSettings,
      saveAccount,
      removeAccount,
      setAccountStatus,
      extendLot,
      extendAuctionType,
      reopenAuctions,
    ],
  )

  return (
    <StoreContext.Provider value={value}>
      <NowContext.Provider value={now}>{children}</NowContext.Provider>
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
