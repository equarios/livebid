import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_SETTINGS, SEED_ACCOUNTS, SEED_LOTS, SUPER_USER } from './data'
import {
  applyDocumentLocale,
  readStoredLocale,
  resolveCopy,
  writeStoredLocale,
  type AppLocale,
} from './i18n'
import {
  applyLaunchClocks,
  ensureAuctionClocks,
  filterExtraSealedLots,
  isAuctionOpen,
  isInExtraSealed,
  isSealedLot,
  lotAuctionSlug,
  migrateLotAuctionType,
  normalizeAuctionTypes,
} from './lib/auctionLists'
import { inventoryFromLots, reserveInventory, upsertInventory } from './lib/inventory'
import {
  dropListKey,
  liveLotFromDrop,
  previewDropClocks,
  type DropListClockPlan,
} from './lib/listingDrops'
import {
  placeMarketplaceInvoice,
  invoiceTotals,
  normalizeInvoiceLines,
  settleInvoice,
  settleInvoiceIssue,
} from './lib/invoices'
import { api, isApiAvailable, resetApiProbe, type ApiUser } from './lib/api'
import { pushToast } from './lib/toast'
import { pullWatchFiltersFromServer } from './lib/watchFilters'
import { onLotTick, startRealtime, stopRealtime } from './lib/realtime'
import { buyerCareNotices, settleClosedAuctions } from './lib/settle'
import { mergeDeskBanners } from './lib/deskBanner'
import { checkBidPrice, checkOfferPrice, checkOrderQty, lotMoq } from './lib/moq'
import type {
  Account,
  Bid,
  CartItem,
  CartOrder,
  EmailPrefs,
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
  WholesalePayMethod,
} from './types'

const BUYER_NEXT: Record<string, { href: string; label: string }> = {
  'Bid placed': { href: '/account/bids', label: 'View bids' },
  'Added to cart': { href: '/account/marketplace-history#cart', label: 'View cart' },
  'Cart sent for review': { href: '/account/marketplace-history#cart', label: 'View cart' },
  'Cart confirmed — invoice created': { href: '/account/invoices', label: 'View invoices' },
  'Purchase recorded': { href: '/account/invoices', label: 'View invoices' },
  'Offer sent': { href: '/account/marketplace-history#offers', label: 'View offers' },
  'Invoice created from your offer': { href: '/account/invoices', label: 'View invoices' },
  'Payment submitted for review': { href: '/account/invoices', label: 'View invoices' },
}

function buyerNote(err: string | null, ok: string): string | null {
  pushToast(err ?? ok, err ? 'err' : 'ok', err ? undefined : BUYER_NEXT[ok])
  return err
}

const DEFAULT_EMAIL_PREFS: EmailPrefs = {
  win: true,
  offer: true,
  cart: true,
  invoice: true,
  payment: true,
  shipping: true,
  auth: true,
  outbid: true,
  closing: false,
  thanks: true,
  fill: false,
  watch: true,
  digest: true,
  sealed: true,
}

type Store = {
  user: User | null
  lots: Lot[]
  bids: Bid[]
  watchlist: string[]
  invoices: Invoice[]
  notices: Notice[]
  cart: CartItem[]
  cartOrders: CartOrder[]
  offers: MarketOffer[]
  listingDrops: ListingDrop[]
  inventory: InventorySku[]
  accounts: Account[]
  /** Localized settings for UI (copy follows `locale`). */
  settings: SiteSettings
  /** English settings source — Super Copy edits and persistence use this. */
  settingsSource: SiteSettings
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  isSuperAdmin: boolean
  isStaff: boolean
  apiMode: boolean
  /** False until first session probe finishes (avoids Guard bounce to /login). */
  authReady: boolean
  login: (
    accountId: string,
    password: string,
  ) => Promise<
    | string
    | null
    | { needsVerify: true; accountId: string; email: string; code?: string }
  >
  register: (
    input: import('./types').RegisterInput,
  ) => Promise<
    | string
    | { needsVerify: true; code?: string; accountId: string; email: string }
  >
  verifyEmail: (ident: string, code: string) => Promise<string | null>
  resendVerifyEmail: (
    ident: string,
  ) => Promise<{ error: string } | { code?: string; email?: string; message?: string }>
  requestPasswordReset: (
    ident: string,
  ) => Promise<{ error: string } | { code?: string; email?: string; message?: string }>
  resetPassword: (ident: string, code: string, password: string) => Promise<string | null>
  refreshNotices: () => Promise<void>
  emailPrefs: EmailPrefs | null
  loadEmailPrefs: () => Promise<EmailPrefs | null>
  saveEmailPrefs: (prefs: Partial<EmailPrefs>) => Promise<string | null>
  logout: () => Promise<void>
  placeBid: (lotId: string, amount: number, qty: number) => Promise<string | null>
  placeBids: (
    entries: Array<{ lotId: string; amount: number; qty: number }>,
  ) => { ok: number; errors: Array<{ lotId: string; message: string }> }
  buyNow: (lotId: string, qty?: number) => string | null
  addToCart: (lotId: string, qty: number) => Promise<string | null>
  removeFromCart: (lotId: string) => Promise<void>
  checkoutCart: () => Promise<string | null>
  reviewCartOrder: (id: string, decision: 'accepted' | 'declined') => Promise<string | null>
  confirmCartOrder: (id: string) => Promise<string | null>
  cancelCartOrder: (id: string) => string | null
  placeOffer: (lotId: string, qty: number, unitPrice: number) => Promise<string | null>
  reviewOffer: (id: string, decision: 'accepted' | 'declined') => Promise<string | null>
  confirmOffer: (id: string) => Promise<string | null>
  cancelOffer: (id: string) => string | null
  toggleWatch: (lotId: string) => Promise<void>
  submitPayment: (
    id: string,
    receiptName: string,
    receiptData: string,
    extra?: { payMethod?: WholesalePayMethod; payRef?: string },
  ) => Promise<string | null>
  reviewPayment: (id: string, side: PayReviewSide, decision: PayDecision) => Promise<string | null>
  markInvoicePaid: (id: string) => Promise<string | null>
  reviewInvoiceIssue: (id: string, side: PayReviewSide, decision: PayDecision) => Promise<string | null>
  saveInvoice: (invoice: Invoice, previousId?: string) => Promise<string | null>
  removeInvoice: (id: string) => Promise<string | null>
  clearPaymentConfirmation: (id: string) => Promise<string | null>
  markInvoiceOpened: (id: string) => void
  markNoticesRead: () => void
  /** Client-only notices (e.g. watch-filter matches). */
  appendLocalNotices: (rows: Notice[]) => void
  myBid: (lotId: string) => number | undefined
  myLastBid: (lotId: string) => Bid | undefined
  addLot: (lot: Lot) => void
  addLots: (lots: Lot[]) => void
  submitListingDrop: (items: ListingDropItem[]) => string | null
  withdrawListingDrop: (id: string) => string | null
  reviewListingDrop: (
    id: string,
    decision: 'approved' | 'declined',
    launchPlans?: DropListClockPlan[],
  ) => Promise<string | null>
  /** Super: edit a pending drop item before publish. */
  patchListingDropItem: (
    dropId: string,
    itemId: string,
    patch: Partial<ListingDropItem>,
  ) => string | null
  /** Super: set live + Extra sealed minutes for every item on a list in a pending drop. */
  patchListingDropGroupClock: (
    dropId: string,
    listKey: string,
    clock: { durationMins: number; extraSealedMinutes?: number },
  ) => string | null
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
  cartOrders: CartOrder[]
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
    firstName: account.firstName,
    lastName: account.lastName,
    role: account.role,
    status: account.status,
    emailVerified: account.emailVerified !== false,
    wholesaleStatus: account.wholesaleStatus ?? (account.status === 'active' ? 'approved' : 'none'),
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
          phone: m.phone || undefined,
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
      phone: a.phone || prev?.phone || undefined,
      email: a.email || prev?.email || '',
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
  const raw = (partial?.brandName || '').trim()
  const legacyName = !raw || raw === 'LiveBid' || raw === 'Equarios'
  return {
    brandName: (legacyName ? DEFAULT_SETTINGS.brandName : raw).trim(),
    brandMark:
      legacyName || !partial?.brandMark || partial.brandMark === 'LB'
        ? DEFAULT_SETTINGS.brandMark
        : partial.brandMark,
    brandLogo: (() => {
      const logo = partial?.brandLogo?.trim() || ''
      if (
        !logo ||
        logo.includes('equarios-logo.jpg') ||
        logo === '/equarios-logo.png' ||
        logo.startsWith('/equarios-logo.png?')
      ) {
        return DEFAULT_SETTINGS.brandLogo
      }
      return logo
    })(),
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
              extraSealedMinutes:
                existingLive.extraSealedMinutes === 0 ||
                Number.isFinite(existingLive.extraSealedMinutes)
                  ? existingLive.extraSealedMinutes
                  : liveDef.extraSealedMinutes,
              feePct:
                existingLive.feePct === 0 || Number.isFinite(existingLive.feePct)
                  ? existingLive.feePct
                  : liveDef.feePct,
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
              extraSealedMinutes:
                existingOffline.extraSealedMinutes === 0 ||
                Number.isFinite(existingOffline.extraSealedMinutes)
                  ? existingOffline.extraSealedMinutes
                  : offlineDef.extraSealedMinutes,
              feePct:
                existingOffline.feePct === 0 || Number.isFinite(existingOffline.feePct)
                  ? existingOffline.feePct
                  : offlineDef.feePct,
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
      if (copy.btnCheckout === 'Checkout' || copy.btnCheckout === 'Send for review') {
        copy.btnCheckout = DEFAULT_SETTINGS.copy.btnCheckout
      }
      if (/creates unpaid invoices for every item/i.test(copy.confirmCheckoutBody)) {
        copy.confirmCheckoutTitle = DEFAULT_SETTINGS.copy.confirmCheckoutTitle
        copy.confirmCheckoutBody = DEFAULT_SETTINGS.copy.confirmCheckoutBody
      }
      if (!copy.confirmAcceptCartTitle) {
        copy.confirmAcceptCartTitle = DEFAULT_SETTINGS.copy.confirmAcceptCartTitle
      }
      if (!copy.confirmAcceptCartBody) {
        copy.confirmAcceptCartBody = DEFAULT_SETTINGS.copy.confirmAcceptCartBody
      }
      return copy
    })(),
    icons: { ...DEFAULT_SETTINGS.icons, ...partial?.icons },
    invoice: { ...DEFAULT_SETTINGS.invoice, ...partial?.invoice },
    contact: {
      ...DEFAULT_SETTINGS.contact,
      ...(partial?.contact && typeof partial.contact === 'object' ? partial.contact : {}),
      social: {
        ...DEFAULT_SETTINGS.contact.social,
        ...(partial?.contact?.social && typeof partial.contact.social === 'object'
          ? partial.contact.social
          : {}),
      },
    },
    pages: (() => {
      const p = partial?.pages
      const base = DEFAULT_SETTINGS.pages
      if (!p || typeof p !== 'object') {
        return {
          ...base,
          storeHeroes: [...base.storeHeroes],
          wholesaleHeroes: [...base.wholesaleHeroes],
          wholesaleHowSteps: [...base.wholesaleHowSteps],
          wholesaleTrust: [...base.wholesaleTrust],
          deskBanners: { ...base.deskBanners },
        }
      }
      const mergePage = (
        def: typeof base.buyers,
        next?: Partial<typeof base.buyers> | null,
      ) => ({
        ...def,
        ...(next && typeof next === 'object' ? next : {}),
      })
      const mergeCards = <T extends { title: string; body: string }>(
        def: T[],
        next: unknown,
        pad: T,
      ): T[] => {
        if (!Array.isArray(next) || !next.length) return [...def]
        return next.map((row, i) => ({
          ...((def[i] || pad) as T),
          ...(row && typeof row === 'object' ? row : {}),
        }))
      }
      const storeHeroes =
        Array.isArray(p.storeHeroes) && p.storeHeroes.length
          ? p.storeHeroes.map((h, i) => ({
              ...base.storeHeroes[i % base.storeHeroes.length],
              ...(h && typeof h === 'object' ? h : {}),
            }))
          : [...base.storeHeroes]
      const wholesaleHeroes =
        Array.isArray(p.wholesaleHeroes) && p.wholesaleHeroes.length
          ? p.wholesaleHeroes.map((h, i) => ({
              ...base.wholesaleHeroes[i % base.wholesaleHeroes.length],
              ...(h && typeof h === 'object' ? h : {}),
            }))
          : [...base.wholesaleHeroes]
      const interval = Math.max(5, Math.floor(Number(p.heroIntervalSec) || base.heroIntervalSec))
      return {
        footerCopyright: (p.footerCopyright || base.footerCopyright).trim() || base.footerCopyright,
        authBrand: (() => {
          const a = (p.authBrand || base.authBrand).trim() || base.authBrand
          return a === 'Equarios' ? base.authBrand : a
        })(),
        authTitle: (p.authTitle || base.authTitle).trim() || base.authTitle,
        authLead: (p.authLead || base.authLead).trim() || base.authLead,
        heroIntervalSec: interval,
        storeHeroes,
        wholesaleHeroes,
        wholesaleHowTitle:
          (p.wholesaleHowTitle || base.wholesaleHowTitle).trim() || base.wholesaleHowTitle,
        wholesaleHowSteps: mergeCards(base.wholesaleHowSteps, p.wholesaleHowSteps, {
          title: '',
          body: '',
        }),
        wholesaleTrust: mergeCards(base.wholesaleTrust, p.wholesaleTrust, { title: '', body: '' }),
        wholesaleDealsTitle:
          (p.wholesaleDealsTitle || base.wholesaleDealsTitle).trim() || base.wholesaleDealsTitle,
        wholesaleBrandsTitle:
          (p.wholesaleBrandsTitle || base.wholesaleBrandsTitle).trim() || base.wholesaleBrandsTitle,
        wholesaleEmptyDeals:
          (p.wholesaleEmptyDeals || base.wholesaleEmptyDeals).trim() || base.wholesaleEmptyDeals,
        wholesaleEmptyMarket:
          (p.wholesaleEmptyMarket || base.wholesaleEmptyMarket).trim() || base.wholesaleEmptyMarket,
        wholesaleSeoTitle:
          (p.wholesaleSeoTitle || base.wholesaleSeoTitle).trim() || base.wholesaleSeoTitle,
        wholesaleSeoDescription:
          (p.wholesaleSeoDescription || base.wholesaleSeoDescription).trim() ||
          base.wholesaleSeoDescription,
        wholesaleEndingSoonTitle:
          (p.wholesaleEndingSoonTitle || base.wholesaleEndingSoonTitle).trim() ||
          base.wholesaleEndingSoonTitle,
        wholesaleEndingSoonViewAll:
          (p.wholesaleEndingSoonViewAll || base.wholesaleEndingSoonViewAll).trim() ||
          base.wholesaleEndingSoonViewAll,
        wholesaleMyDeskLabel:
          (p.wholesaleMyDeskLabel || base.wholesaleMyDeskLabel).trim() || base.wholesaleMyDeskLabel,
        wholesaleMyDeskGo:
          (p.wholesaleMyDeskGo || base.wholesaleMyDeskGo).trim() || base.wholesaleMyDeskGo,
        wholesaleCatDeviceLabel:
          (p.wholesaleCatDeviceLabel || base.wholesaleCatDeviceLabel).trim() ||
          base.wholesaleCatDeviceLabel,
        wholesaleCatConditionLabel:
          (p.wholesaleCatConditionLabel || base.wholesaleCatConditionLabel).trim() ||
          base.wholesaleCatConditionLabel,
        wholesaleCatAllLabel:
          (p.wholesaleCatAllLabel || base.wholesaleCatAllLabel).trim() || base.wholesaleCatAllLabel,
        wholesaleEmptyHub:
          (p.wholesaleEmptyHub || base.wholesaleEmptyHub).trim() || base.wholesaleEmptyHub,
        wholesaleBrowseMarketCta:
          (p.wholesaleBrowseMarketCta || base.wholesaleBrowseMarketCta).trim() ||
          base.wholesaleBrowseMarketCta,
        wholesaleOpenAuctionsCta:
          (p.wholesaleOpenAuctionsCta || base.wholesaleOpenAuctionsCta).trim() ||
          base.wholesaleOpenAuctionsCta,
        wholesaleViewAllAuctions:
          (p.wholesaleViewAllAuctions || base.wholesaleViewAllAuctions).trim() ||
          base.wholesaleViewAllAuctions,
        wholesaleViewAllMarket:
          (p.wholesaleViewAllMarket || base.wholesaleViewAllMarket).trim() ||
          base.wholesaleViewAllMarket,
        buyers: mergePage(base.buyers, p.buyers),
        sellers: mergePage(base.sellers, p.sellers),
        support: mergePage(base.support, p.support),
        deskBanners: mergeDeskBanners(p.deskBanners),
      }
    })(),
    marketplaceFeePct: (() => {
      const m = partial?.marketplaceFeePct
      if (m === 0) return 0
      if (Number.isFinite(m) && (m as number) >= 0) return m as number
      return DEFAULT_SETTINGS.marketplaceFeePct
    })(),
    offerFloorPct: (() => {
      const m = partial?.offerFloorPct
      if (m === 0) return 0
      if (Number.isFinite(m) && (m as number) >= 0 && (m as number) <= 100) return m as number
      return DEFAULT_SETTINGS.offerFloorPct
    })(),
    fulfillment: {
      ...DEFAULT_SETTINGS.fulfillment!,
      ...(partial?.fulfillment || {}),
      storeModes:
        partial?.fulfillment?.storeModes?.length
          ? partial.fulfillment.storeModes
          : DEFAULT_SETTINGS.fulfillment!.storeModes,
      wholesaleModes:
        partial?.fulfillment?.wholesaleModes?.length
          ? partial.fulfillment.wholesaleModes
          : DEFAULT_SETTINGS.fulfillment!.wholesaleModes,
      pickupSlots:
        partial?.fulfillment?.pickupSlots?.length
          ? partial.fulfillment.pickupSlots
          : DEFAULT_SETTINGS.fulfillment!.pickupSlots,
      pickupSlotCap:
        Number.isFinite(partial?.fulfillment?.pickupSlotCap) &&
        (partial!.fulfillment!.pickupSlotCap as number) >= 0
          ? Math.min(200, Math.floor(partial!.fulfillment!.pickupSlotCap as number))
          : DEFAULT_SETTINGS.fulfillment!.pickupSlotCap,
    },
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
        cartOrders: Array.isArray(parsed.cartOrders) ? parsed.cartOrders : [],
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
    cartOrders: [],
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

function persistData(data: Persisted) {
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
}

/** Settle closed lots + buyer-care notices; no-op when nothing changed. */
function applySettleCare(prev: Persisted, accountId?: string | null): Persisted {
  const stamp = Date.now()
  const settled = settleClosedAuctions(
    prev.lots,
    prev.bids,
    prev.invoices,
    prev.notices || [],
    stamp,
    prev.accounts.filter((a) => a.role === 'admin' || a.role === 'superadmin'),
    prev.settings,
  )
  const notices = buyerCareNotices(
    prev.lots,
    prev.bids,
    prev.watchlist,
    accountId || undefined,
    settled.notices,
    stamp,
    prev.settings.endingSoonMinutes,
    prev.settings,
  )
  if (settled.invoices === prev.invoices && notices === (prev.notices || [])) return prev
  return { ...prev, invoices: settled.invoices, notices }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [apiMode, setApiMode] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [emailPrefs, setEmailPrefs] = useState<EmailPrefs | null>(null)
  const [data, setData] = useState<Persisted>(loadData)
  const [locale, setLocaleState] = useState<AppLocale>(() =>
    typeof window !== 'undefined' ? readStoredLocale() : 'en',
  )
  const [now, setNow] = useState(Date.now())
  const dataRef = useRef(data)
  dataRef.current = data
  const userIdRef = useRef(user?.accountId)
  userIdRef.current = user?.accountId
  const apiModeRef = useRef(false)
  apiModeRef.current = apiMode

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next)
    writeStoredLocale(next)
    applyDocumentLocale(next)
  }, [])

  useEffect(() => {
    applyDocumentLocale(locale)
  }, [locale])

  const localizedSettings = useMemo(
    () => ({
      ...data.settings,
      copy: resolveCopy(locale, data.settings.copy),
    }),
    [data.settings, locale],
  )

  const pushServerNotice = useCallback(
    async (input: {
      accountId: string
      kind: Notice['kind']
      title: string
      body: string
      href: string
      id?: string
    }) => {
      if (!apiModeRef.current) return
      try {
        await api.pushNotice(input)
      } catch {
        /* best-effort */
      }
    },
    [],
  )

  const applyBootstrap = useCallback(async (sessionUser?: ApiUser | User | null) => {
    // Drop demo/localStorage lots immediately so bids never hit ghost LB-* ids.
    setData((prev) => ({ ...prev, lots: [], bids: [] }))
    const boot = await api.bootstrap()
    let lots = ((boot.lots as Lot[]) || []).slice()
    let bids = ((boot.bids as Bid[]) || []).slice()

    // Phase 1: pull remaining active-lot pages if bootstrap was capped.
    let cursor = boot.meta?.lotsNextCursor || null
    let guard = 0
    while (cursor && boot.meta?.lotsHasMore && guard < 40) {
      guard += 1
      const page = await api.lotsPage({ cursor, limit: 200 })
      const more = (page.lots as Lot[]) || []
      if (!more.length) break
      lots = lots.concat(more)
      cursor = page.nextCursor
      if (!cursor) break
    }

    setData((prev) => {
      const rawLots = lots.map((l) => ({
        ...l,
        auctionType: migrateLotAuctionType(l.auctionType),
      }))
      const settings = mergeSettings(prev.settings)
      // Prefer server clock fields; only fill missing type closesAt for UI chrome.
      const auctionTypes = settings.auctionTypes.map((t) => {
        if (t.closesAt && t.closesAt > Date.now()) return t
        const group = rawLots.filter(
          (l) => l.channel === 'auction' && (l.auctionType || 'live') === t.value,
        )
        if (!group.length) return t
        const ends = Math.max(...group.map((l) => l.endsAt))
        if (ends <= Date.now()) return t
        return { ...t, closesAt: ends }
      })
      return {
        ...prev,
        lots: rawLots,
        bids,
        cart: (boot.cart as CartItem[]) || [],
        cartOrders: (boot.cartOrders as CartOrder[]) || [],
        offers: (boot.offers as MarketOffer[]) || [],
        invoices: (boot.invoices as Invoice[]) || [],
        watchlist: (boot.watchlist as string[]) || [],
        notices: (boot.notices as Notice[]) || prev.notices,
        accounts: (boot.accounts as Account[])?.length
          ? (boot.accounts as Account[])
          : prev.accounts,
        inventory: (boot.inventory as InventorySku[])?.length
          ? (boot.inventory as InventorySku[])
          : prev.inventory,
        settings: { ...settings, auctionTypes },
        listingDrops: prev.listingDrops,
      }
    })
    if (sessionUser) {
      setUser(sessionUser as User)
      void pullWatchFiltersFromServer(sessionUser.accountId).catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    // Re-probe each boot — a prior failed/hanging check must not stick forever.
    resetApiProbe()
    const safety = window.setTimeout(() => {
      if (!cancelled) setAuthReady(true)
    }, 3500)
    ;(async () => {
      try {
        const ok = await isApiAvailable()
        if (cancelled) return
        if (!ok) {
          // Offline / no server: fall back to legacy localStorage session (demo only).
          try {
            const raw = localStorage.getItem(AUTH_KEY)
            if (raw) {
              const parsed = JSON.parse(raw) as User
              setUser({
                ...parsed,
                role:
                  parsed.accountId === SUPER_USER.accountId
                    ? 'superadmin'
                    : parsed.role === 'superadmin'
                      ? 'member'
                      : parsed.role || 'member',
                status: parsed.status || 'active',
              })
            }
          } catch {
            /* ignore */
          }
          setData((prev) => {
            const stamp = Date.now()
            const settings = mergeSettings(prev.settings)
            const next = ensureAuctionClocks(settings, prev.lots, stamp)
            return { ...prev, settings: next.settings, lots: next.lots }
          })
          return
        }
        setApiMode(true)
        localStorage.removeItem(AUTH_KEY)
        try {
          const { user: session } = await api.me()
          if (cancelled) return
          if (session) await applyBootstrap(session)
          else setUser(null)
        } catch {
          if (!cancelled) setUser(null)
        }
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        window.clearTimeout(safety)
        if (!cancelled) setAuthReady(true)
      }
    })()
    return () => {
      cancelled = true
      window.clearTimeout(safety)
    }
  }, [applyBootstrap])

  // Coarse clock for list filters / badges — countdowns use local timers in TimeLeft.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    // In API mode the server is source of truth — only keep settings locally.
    if (apiMode) {
      const id = window.setTimeout(() => {
        try {
          const raw = localStorage.getItem(DATA_KEY)
          const prev = raw ? JSON.parse(raw) : {}
          localStorage.setItem(
            DATA_KEY,
            JSON.stringify({ ...prev, settings: data.settings }),
          )
        } catch {
          /* ignore */
        }
      }, 400)
      return () => clearTimeout(id)
    }
    const id = window.setTimeout(() => persistData(data), 400)
    return () => clearTimeout(id)
  }, [data, apiMode])

  useEffect(() => {
    function flush() {
      persistData(dataRef.current)
    }
    function onVis() {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

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
    if (apiMode) return
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
  }, [apiMode])

  const runSettleCare = useCallback(() => {
    if (apiModeRef.current) return
    setData((prev) => applySettleCare(prev, userIdRef.current))
  }, [])

  useEffect(() => {
    if (apiMode) return
    runSettleCare()
    const t = setInterval(runSettleCare, 5000)
    return () => clearInterval(t)
  }, [runSettleCare, user?.accountId, apiMode])

  const login = useCallback(async (accountId: string, password: string) => {
    if (apiModeRef.current || (await isApiAvailable())) {
      setApiMode(true)
      try {
        const { user: session } = await api.login(accountId, password)
        localStorage.removeItem(AUTH_KEY)
        await applyBootstrap(session)
        return null
      } catch (e) {
        if (e && typeof e === 'object' && 'needsVerify' in e && (e as { needsVerify?: boolean }).needsVerify) {
          const err = e as { message?: string; accountId?: string; email?: string; code?: string }
          return {
            needsVerify: true as const,
            accountId: err.accountId || accountId.trim(),
            email: err.email || accountId.trim(),
            code: err.code,
          }
        }
        return e instanceof Error ? e.message : data.settings.copy.warnLogin
      }
    }
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
  }, [applyBootstrap, data.accounts, data.settings.copy])

  const register = useCallback(
    async (input: import('./types').RegisterInput) => {
      if (apiModeRef.current || (await isApiAvailable())) {
        setApiMode(true)
        try {
          const res = await api.register(input)
          return {
            needsVerify: true as const,
            code: res.code,
            accountId: res.account.accountId,
            email: res.email || input.email.trim(),
          }
        } catch (e) {
          return e instanceof Error ? e.message : data.settings.copy.warnRegister
        }
      }
      if (
        !input.firstName.trim() ||
        !input.lastName.trim() ||
        !input.email.trim() ||
        input.password.length < 6 ||
        input.email !== input.emailConfirm ||
        input.password !== input.passwordConfirm
      ) {
        return data.settings.copy.warnRegister
      }
      const email = input.email.trim().toLowerCase()
      const id =
        (input.accountId || `LB-${email.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 8)}`)
          .trim()
          .toUpperCase()
      if (data.accounts.some((a) => a.accountId === id || a.email.toLowerCase() === email)) {
        return data.settings.copy.warnAccountTaken
      }
      setData((prev) => ({
        ...prev,
        accounts: [
          ...prev.accounts,
          {
            accountId: id,
            password: input.password,
            company: input.company?.trim() || `${input.firstName} ${input.lastName}`.trim(),
            email,
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            role: 'member',
            status: 'active',
            emailVerified: true,
            wholesaleStatus: 'none',
          },
        ],
      }))
      return { needsVerify: true as const, accountId: id, email, code: '0000' }
    },
    [data.accounts, data.settings.copy],
  )

  const verifyEmail = useCallback(
    async (ident: string, code: string) => {
      if (apiModeRef.current || (await isApiAvailable())) {
        setApiMode(true)
        try {
          const { user: session } = await api.verifyEmail(ident, code)
          await applyBootstrap(session)
          return null
        } catch (e) {
          return e instanceof Error ? e.message : 'Verification failed.'
        }
      }
      if (code.trim() !== '0000') return 'That verification code does not match.'
      const key = ident.trim()
      const found = data.accounts.find(
        (a) =>
          a.accountId === key.toUpperCase() || a.email.toLowerCase() === key.toLowerCase(),
      )
      if (!found) return 'Invalid account or code.'
      const next = sessionUser({ ...found, emailVerified: true })
      setUser(next)
      localStorage.setItem(AUTH_KEY, JSON.stringify(next))
      return null
    },
    [applyBootstrap, data.accounts],
  )

  const resendVerifyEmail = useCallback(
    async (ident: string) => {
      if (apiModeRef.current || (await isApiAvailable())) {
        setApiMode(true)
        try {
          const res = await api.resendVerifyEmail(ident)
          return { code: res.code, email: res.email, message: res.message }
        } catch (e) {
          return { error: e instanceof Error ? e.message : 'Could not resend code.' }
        }
      }
      return { code: '0000', message: 'Offline demo code is 0000.' }
    },
    [],
  )

  const RESET_KEY = 'equarios-reset'

  const requestPasswordReset = useCallback(
    async (ident: string) => {
      if (apiModeRef.current || (await isApiAvailable())) {
        setApiMode(true)
        try {
          const res = await api.requestPasswordReset(ident)
          return {
            code: res.code,
            email: res.email,
            message: res.message,
          }
        } catch (e) {
          return { error: e instanceof Error ? e.message : data.settings.copy.warnLogin }
        }
      }
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
    },
    [data.accounts, data.settings.copy],
  )

  const resetPassword = useCallback(
    async (ident: string, code: string, password: string) => {
      if (password.length < 6) return data.settings.copy.warnRegister
      if (apiModeRef.current || (await isApiAvailable())) {
        setApiMode(true)
        try {
          await api.confirmPasswordReset(ident, code, password)
          return null
        } catch (e) {
          return e instanceof Error ? e.message : 'Could not reset password.'
        }
      }
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
    },
    [data.accounts, data.settings.copy],
  )

  const refreshNotices = useCallback(async () => {
    if (!apiModeRef.current) return
    try {
      const res = await api.notices()
      setData((prev) => ({ ...prev, notices: (res.notices as Notice[]) || [] }))
    } catch {
      /* ignore */
    }
  }, [])

  const loadEmailPrefs = useCallback(async () => {
    if (!apiModeRef.current) {
      setEmailPrefs(DEFAULT_EMAIL_PREFS)
      return DEFAULT_EMAIL_PREFS
    }
    try {
      const res = await api.emailPrefs()
      const prefs = { ...DEFAULT_EMAIL_PREFS, ...(res.prefs as EmailPrefs) }
      setEmailPrefs(prefs)
      return prefs
    } catch {
      setEmailPrefs(DEFAULT_EMAIL_PREFS)
      return DEFAULT_EMAIL_PREFS
    }
  }, [])

  const saveEmailPrefs = useCallback(async (prefs: Partial<EmailPrefs>) => {
    if (!apiModeRef.current) {
      setEmailPrefs((prev) => ({ ...(prev || DEFAULT_EMAIL_PREFS), ...prefs }))
      return null
    }
    try {
      const res = await api.saveEmailPrefs(prefs)
      const next = { ...DEFAULT_EMAIL_PREFS, ...(res.prefs as EmailPrefs) }
      setEmailPrefs(next)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not save email preferences.'
    }
  }, [])

  const logout = useCallback(async () => {
    if (apiModeRef.current) {
      try {
        await api.logout()
      } catch {
        /* ignore */
      }
    }
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
    async (lotId: string, amount: number, qty: number) => {
      if (apiModeRef.current) {
        try {
          const res = await api.placeBid(lotId, amount, qty)
          setData((prev) => {
            const bid = res.bid
              ? {
                  lotId: res.bid.lotId,
                  accountId: res.bid.accountId,
                  amount: res.bid.amount,
                  qty: res.bid.qty,
                  at: res.bid.at,
                }
              : {
                  lotId,
                  accountId: user?.accountId || '',
                  amount,
                  qty,
                  at: Date.now(),
                }
            const lots = res.lot
              ? prev.lots.map((l) =>
                  l.id === res.lot!.id
                    ? {
                        ...l,
                        currentPrice: res.lot!.currentPrice,
                        bidCount: res.lot!.bidCount,
                      }
                    : l,
                )
              : prev.lots.map((l) =>
                  l.id === lotId
                    ? {
                        ...l,
                        currentPrice: Math.max(l.currentPrice, amount),
                        bidCount: l.bidCount + 1,
                      }
                    : l,
                )
            const bids = [
              ...prev.bids.filter(
                (b) => !(b.lotId === bid.lotId && b.at === bid.at && b.accountId === bid.accountId),
              ),
              bid,
            ]
            return { ...prev, lots, bids }
          })
          return buyerNote(null, 'Bid placed')
        } catch (e) {
          const msg = e instanceof Error ? e.message : data.settings.copy.warnNoBid
          if (/lot not found/i.test(msg)) {
            void applyBootstrap(user)
            return buyerNote(
              'That lot is not on the server. Refreshing the desk — publish the catalog from Super if it was only a local draft.',
              '',
            )
          }
          return buyerNote(msg, '')
        }
      }
      const lot = data.lots.find((l) => l.id === lotId)
      if (!data.settings.features.bidding) return buyerNote(data.settings.copy.warnNoBid, '')
      if (!user) return buyerNote(data.settings.copy.warnLogin, '')
      if (!lot || lot.channel !== 'auction') return buyerNote(data.settings.copy.warnLotMissing, '')
      const nowTs = Date.now()
      if (!isAuctionOpen(lot, nowTs)) return buyerNote(data.settings.copy.warnClosed, '')
      const accountId = user.accountId
      const mine = data.bids.filter((b) => b.lotId === lotId && b.accountId === accountId)
      if (isInExtraSealed(lot, nowTs) && !mine.length) {
        return buyerNote('Extra sealed: only prior bidders can bid on this lot.', '')
      }
      const independent = isSealedLot(lot, data.settings, nowTs)
      const lastBid = mine.length ? mine.reduce((a, b) => (a.at > b.at ? a : b)) : undefined
      const qtyErr = checkOrderQty(lot, qty, data.settings.copy, {
        lastOwnQty: lastBid?.qty,
        lastOwnAmount: lastBid?.amount,
        amount,
      })
      if (qtyErr) return buyerNote(qtyErr, '')
      const priceErr = checkBidPrice(lot, amount, data.settings.copy, {
        independent,
        lastOwnAmount: lastBid?.amount,
        lastOwnQty: lastBid?.qty,
      })
      if (priceErr) return buyerNote(priceErr, '')
      setData((prev) =>
        applySettleCare(
          {
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
          },
          accountId,
        ),
      )
      return buyerNote(null, 'Bid placed')
    },
    [data.lots, data.bids, data.settings, user, applyBootstrap],
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
      const lastSeen = new Map<string, { amount: number; qty: number }>()
      for (const entry of entries) {
        const lot = data.lots.find((l) => l.id.toUpperCase() === entry.lotId.trim().toUpperCase())
        if (!lot || lot.channel !== 'auction') {
          errors.push({ lotId: entry.lotId || '—', message: copy.warnLotMissing })
          continue
        }
        if (!isAuctionOpen(lot, now)) {
          errors.push({ lotId: lot.id, message: copy.warnClosed })
          continue
        }
        const mine = data.bids.filter((b) => b.lotId === lot.id && b.accountId === accountId)
        if (isInExtraSealed(lot, now) && !mine.length) {
          errors.push({
            lotId: lot.id,
            message: 'Extra sealed: only prior bidders can bid on this lot.',
          })
          continue
        }
        const independent = isSealedLot(lot, data.settings, now)
        const storedLast = mine.length
          ? mine.reduce((a, b) => (a.at > b.at ? a : b))
          : undefined
        const lastOwn = lastSeen.get(lot.id) ??
          (storedLast ? { amount: storedLast.amount, qty: storedLast.qty } : undefined)
        const qtyErr = checkOrderQty(lot, entry.qty, copy, {
          lastOwnQty: lastOwn?.qty,
          lastOwnAmount: lastOwn?.amount,
          amount: entry.amount,
        })
        if (qtyErr) {
          errors.push({ lotId: lot.id, message: qtyErr })
          continue
        }
        const priceErr = checkBidPrice(lot, entry.amount, copy, {
          independent,
          lastOwnAmount: lastOwn?.amount,
          lastOwnQty: lastOwn?.qty,
        })
        if (priceErr) {
          errors.push({ lotId: lot.id, message: priceErr })
          continue
        }
        lastSeen.set(lot.id, { amount: entry.amount, qty: entry.qty })
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
        return applySettleCare({ ...prev, lots, bids }, accountId)
      })
      if (ok.length) pushToast(errors.length ? `Placed ${ok.length} bids · ${errors.length} skipped` : `Placed ${ok.length} bids`)
      else if (errors[0]) pushToast(errors[0].message, 'err')
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
      if (!user?.accountId) return data.settings.copy.warnLogin
      const invoice = placeMarketplaceInvoice(
        data.invoices,
        {
          accountId: user.accountId,
          createdAt: Date.now(),
          remarks: `Buy now ${lotId}`,
          lines: [{ lotId, qty: pcs, unitPrice: lot.buyNowPrice }],
        },
        data.settings,
        [lot],
      )
      setData((prev) => ({
        ...prev,
        lots: prev.lots
          .map((l) => {
            if (l.id !== lotId) return l
            return { ...l, qty: l.qty - pcs }
          })
          .filter((l) => l.channel !== 'marketplace' || l.qty > 0),
        invoices: prev.invoices.some((row) => row.id === invoice.id)
          ? prev.invoices.map((row) => (row.id === invoice.id ? invoice : row))
          : [invoice, ...prev.invoices],
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
      return buyerNote(null, 'Purchase recorded')
    },
    [data.invoices, data.lots, data.settings, user],
  )

  const addToCart = useCallback(
    async (lotId: string, qty: number) => {
      if (apiModeRef.current) {
        try {
          const already = data.cart.find((c) => c.lotId === lotId)?.qty ?? 0
          await api.addToCart(lotId, already + qty)
          await applyBootstrap()
          return buyerNote(null, 'Added to cart')
        } catch (e) {
          return buyerNote(e instanceof Error ? e.message : data.settings.copy.warnCart, '')
        }
      }
      const lot = data.lots.find((l) => l.id === lotId)
      if (!data.settings.features.cart) return buyerNote(data.settings.copy.warnCart, '')
      if (!lot || lot.channel !== 'marketplace' || !lot.buyNowPrice) {
        return buyerNote(data.settings.copy.warnListingGone.replace('{id}', lotId), '')
      }
      if (!Number.isInteger(qty) || qty < 1) return buyerNote(data.settings.copy.warnQty, '')
      const already = data.cart.find((c) => c.lotId === lotId)?.qty ?? 0
      const nextQty = already + qty
      const qtyErr = checkOrderQty(lot, nextQty, data.settings.copy)
      if (qtyErr) return buyerNote(qtyErr, '')
      setData((prev) => {
        const exists = prev.cart.some((c) => c.lotId === lotId)
        const cart = exists
          ? prev.cart.map((c) => (c.lotId === lotId ? { ...c, qty: nextQty } : c))
          : [...prev.cart, { lotId, qty }]
        return { ...prev, cart }
      })
      return buyerNote(null, 'Added to cart')
    },
    [applyBootstrap, data.lots, data.cart, data.settings],
  )

  const removeFromCart = useCallback(async (lotId: string) => {
    if (apiModeRef.current) {
      try {
        await api.removeFromCart(lotId)
        await applyBootstrap()
        pushToast('Removed from cart')
      } catch {
        pushToast('Could not remove that item.', 'err')
      }
      return
    }
    setData((prev) => ({ ...prev, cart: prev.cart.filter((c) => c.lotId !== lotId) }))
    pushToast('Removed from cart')
  }, [applyBootstrap])

  const checkoutCart = useCallback(async () => {
    if (apiModeRef.current) {
      try {
        await api.checkoutCart()
        await applyBootstrap()
        return buyerNote(null, 'Cart sent for review')
      } catch (e) {
        return buyerNote(e instanceof Error ? e.message : data.settings.copy.emptyCart, '')
      }
    }
    if (!user) return data.settings.copy.warnLogin
    if (!data.settings.features.cart) return data.settings.copy.warnCart
    if (!data.cart.length) return data.settings.copy.emptyCart
    const stamp = Date.now()
    const lines: CartOrder['lines'] = []
    for (const item of data.cart) {
      const lot = data.lots.find((l) => l.id === item.lotId)
      if (!lot || lot.channel !== 'marketplace' || !lot.buyNowPrice) {
        return data.settings.copy.warnListingGone.replace('{id}', item.lotId)
      }
      const qtyErr = checkOrderQty(lot, item.qty, data.settings.copy)
      if (qtyErr) return `${lot.model}: ${qtyErr}`
      lines.push({ lotId: item.lotId, qty: item.qty, unitPrice: lot.buyNowPrice })
    }
    const order: CartOrder = {
      id: `CART-${stamp.toString().slice(-8)}`,
      accountId: user.accountId,
      lines,
      status: 'pending',
      createdAt: stamp,
    }
    const pcs = lines.reduce((n, l) => n + l.qty, 0)
    setData((prev) => {
      const staff = prev.accounts.filter((a) => a.role === 'admin' || a.role === 'superadmin')
      const notices: Notice[] = [
        ...staff.map((a) => ({
          id: `N-CART-${order.id}-${a.accountId}`,
          accountId: a.accountId,
          kind: 'cart' as const,
          title: 'New cart checkout',
          body: `${user.company} · ${lines.length} item${lines.length === 1 ? '' : 's'} · ${pcs.toLocaleString()} pcs`,
          href: '/admin',
          at: stamp,
        })),
        {
          id: `N-CART-SENT-${order.id}`,
          accountId: user.accountId,
          kind: 'cart' as const,
          title: 'Cart sent for review',
          body: 'Admin will check availability. If accepted, confirm on Marketplace to create an invoice.',
          href: '/account/marketplace-history#cart',
          at: stamp,
        },
        ...(prev.notices || []),
      ]
      return {
        ...prev,
        cart: [],
        cartOrders: [order, ...(prev.cartOrders || [])],
        notices,
      }
    })
    return buyerNote(null, 'Cart sent for review')
  }, [applyBootstrap, data.cart, data.lots, data.settings, user])

  const reviewCartOrder = useCallback(
    async (id: string, decision: 'accepted' | 'declined') => {
      if (apiModeRef.current) {
        try {
          await api.reviewCartOrder(id, decision)
          await applyBootstrap()
          return buyerNote(null, decision === 'accepted' ? 'Cart accepted' : 'Cart declined')
        } catch (e) {
          return buyerNote(e instanceof Error ? e.message : 'Review failed.', '')
        }
      }
      if (user?.role !== 'admin' && user?.role !== 'superadmin') {
        return 'Only staff can review cart checkouts.'
      }
      const order = (data.cartOrders || []).find((o) => o.id === id)
      if (!order || order.status !== 'pending') return 'That cart is not waiting for review.'
      if (decision === 'accepted') {
        for (const line of order.lines) {
          const lot = data.lots.find((l) => l.id === line.lotId)
          if (!lot || lot.channel !== 'marketplace' || !lot.buyNowPrice) {
            return data.settings.copy.warnListingGone.replace('{id}', line.lotId)
          }
          const qtyErr = checkOrderQty(lot, line.qty, data.settings.copy)
          if (qtyErr) return `${lot.model}: ${qtyErr}`
        }
      }
      setData((prev) => ({
        ...prev,
        cartOrders: (prev.cartOrders || []).map((o) =>
          o.id === id
            ? { ...o, status: decision, reviewedAt: Date.now(), reviewedBy: user.accountId }
            : o,
        ),
        notices: [
          {
            id: `N-CART-${id}-${decision}`,
            accountId: order.accountId,
            kind: 'cart' as const,
            title: decision === 'accepted' ? 'Cart accepted' : 'Cart declined',
            body:
              decision === 'accepted'
                ? 'Confirm the cart on Marketplace to create an invoice at listed prices.'
                : 'Your cart checkout was declined. Items were not reserved.',
            href: '/account/marketplace-history#cart',
            at: Date.now(),
          },
          ...(prev.notices || []),
        ],
      }))
      return buyerNote(null, decision === 'accepted' ? 'Cart accepted' : 'Cart declined')
    },
    [applyBootstrap, data.cartOrders, data.lots, data.settings, user],
  )

  const confirmCartOrder = useCallback(
    async (id: string) => {
      if (apiModeRef.current) {
        try {
          await api.confirmCartOrder(id)
          await applyBootstrap()
          return buyerNote(null, "Added to today's marketplace invoice")
        } catch (e) {
          return e instanceof Error ? e.message : 'Confirm failed.'
        }
      }
      if (!user) return data.settings.copy.warnLogin
      const order = (data.cartOrders || []).find((o) => o.id === id)
      if (!order || order.accountId !== user.accountId) return 'Cart order not found.'
      if (order.status !== 'accepted') return 'This cart is not accepted yet.'
      const stamp = Date.now()
      const lines = []
      for (const line of order.lines) {
        const lot = data.lots.find((l) => l.id === line.lotId)
        if (!lot || lot.channel !== 'marketplace' || !lot.buyNowPrice) {
          return data.settings.copy.warnListingGone.replace('{id}', line.lotId)
        }
        const qtyErr = checkOrderQty(lot, line.qty, data.settings.copy)
        if (qtyErr) return `${lot.model}: ${qtyErr}`
        lines.push({
          lotId: line.lotId,
          qty: line.qty,
          unitPrice: lot.buyNowPrice,
        })
      }
      const invoice = placeMarketplaceInvoice(
        data.invoices,
        {
          accountId: user.accountId,
          createdAt: stamp,
          remarks: `Accepted cart ${order.id}`,
          lines,
        },
        data.settings,
        data.lots,
      )
      const byId = new Map(lines.map((l) => [l.lotId, l.qty]))
      setData((prev) => ({
        ...prev,
        cartOrders: (prev.cartOrders || []).map((o) =>
          o.id === id ? { ...o, status: 'confirmed' as const } : o,
        ),
        invoices: prev.invoices.some((row) => row.id === invoice.id)
          ? prev.invoices.map((row) => (row.id === invoice.id ? invoice : row))
          : [invoice, ...prev.invoices],
        lots: prev.lots
          .map((l) => {
            const take = byId.get(l.id)
            if (!take) return l
            return { ...l, qty: l.qty - take }
          })
          .filter((l) => l.channel !== 'marketplace' || l.qty > 0),
        notices: [
          ...staffIssueNotices(prev.accounts, [invoice], stamp),
          {
            id: `N-CARTINV-${id}`,
            accountId: user.accountId,
            kind: 'invoice' as const,
            title: 'Cart confirmed',
            body: `Invoice ${invoice.id} will appear after Admin and Super issue it.`,
            href: '/account/invoices',
            at: stamp,
          },
          ...(prev.notices || []),
        ],
      }))
      return buyerNote(null, "Added to today's marketplace invoice")
    },
    [applyBootstrap, data.cartOrders, data.invoices, data.lots, data.settings, user],
  )

  const cancelCartOrder = useCallback(
    (id: string) => {
      if (!user) return data.settings.copy.warnLogin
      const order = (data.cartOrders || []).find((o) => o.id === id)
      if (!order) return 'Cart order not found.'
      const mine = order.accountId === user.accountId
      const staff = user.role === 'admin' || user.role === 'superadmin'
      if (!mine && !staff) return 'Cart order not found.'
      if (order.status !== 'pending' && order.status !== 'accepted') {
        return 'This cart cannot be cancelled.'
      }
      setData((prev) => ({
        ...prev,
        cartOrders: (prev.cartOrders || []).map((o) =>
          o.id === id ? { ...o, status: 'cancelled' as const } : o,
        ),
      }))
      return buyerNote(null, 'Cart cancelled')
    },
    [data.cartOrders, data.settings, user],
  )

  const placeOffer = useCallback(
    async (lotId: string, qty: number, unitPrice: number) => {
      if (apiModeRef.current) {
        try {
          await api.placeOffer(lotId, qty, unitPrice)
          await applyBootstrap()
          return buyerNote(null, 'Offer sent')
        } catch (e) {
          return buyerNote(e instanceof Error ? e.message : data.settings.copy.warnOffers, '')
        }
      }
      if (!user) return data.settings.copy.warnLogin
      if (!data.settings.features.offers) return data.settings.copy.warnOffers
      const lot = data.lots.find((l) => l.id === lotId)
      if (!lot || lot.channel !== 'marketplace' || !lot.buyNowPrice) {
        return data.settings.copy.warnListingGone.replace('{id}', lotId)
      }
      const accepted = (data.offers || []).find(
        (o) => o.lotId === lotId && o.accountId === user.accountId && o.status === 'accepted',
      )
      if (accepted) return data.settings.copy.warnOfferOpen
      const pending = (data.offers || []).find(
        (o) => o.lotId === lotId && o.accountId === user.accountId && o.status === 'pending',
      )
      const rounded = Math.round(unitPrice)
      const qtyErr = checkOrderQty(lot, qty, data.settings.copy, {
        lastOwnQty: pending?.qty,
        lastOwnAmount: pending?.unitPrice,
        amount: rounded,
      })
      if (qtyErr) return qtyErr
      const priceErr = checkOfferPrice(
        lot.buyNowPrice,
        rounded,
        data.settings.copy,
        pending?.unitPrice,
        data.settings.offerFloorPct,
      )
      if (priceErr) return priceErr
      const offer: MarketOffer = {
        id: pending?.id || `OFF-${Date.now().toString().slice(-8)}`,
        lotId,
        accountId: user.accountId,
        qty,
        unitPrice: rounded,
        listedPrice: lot.buyNowPrice,
        status: 'pending',
        createdAt: pending?.createdAt ?? Date.now(),
      }
      setData((prev) => {
        const rest = (prev.offers || []).filter(
          (o) => !(o.lotId === lotId && o.accountId === user.accountId && o.status === 'pending'),
        )
        const staff = prev.accounts.filter((a) => a.role === 'admin' || a.role === 'superadmin')
        const notices: Notice[] = pending
          ? prev.notices || []
          : [
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
      return buyerNote(null, 'Offer sent')
    },
    [applyBootstrap, data.lots, data.offers, data.settings, user],
  )

  const reviewOffer = useCallback(
    async (id: string, decision: 'accepted' | 'declined') => {
      if (apiModeRef.current) {
        try {
          await api.reviewOffer(id, decision)
          await applyBootstrap()
          return buyerNote(null, decision === 'accepted' ? 'Offer accepted' : 'Offer declined')
        } catch (e) {
          return buyerNote(e instanceof Error ? e.message : 'Review failed.', '')
        }
      }
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
                ? 'Confirm the offer under My Page → Marketplace to create an invoice.'
                : 'Your marketplace offer was declined.',
            href: '/account/marketplace-history#offers',
            at: Date.now(),
          },
          ...(prev.notices || []),
        ],
      }))
      return buyerNote(null, decision === 'accepted' ? 'Offer accepted' : 'Offer declined')
    },
    [applyBootstrap, data.offers, user],
  )

  const confirmOffer = useCallback(
    async (id: string) => {
      if (apiModeRef.current) {
        try {
          await api.confirmOffer(id)
          await applyBootstrap()
          return buyerNote(null, "Added to today's marketplace invoice")
        } catch (e) {
          return buyerNote(e instanceof Error ? e.message : 'Confirm failed.', '')
        }
      }
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
      const invoice = placeMarketplaceInvoice(
        data.invoices,
        {
          accountId: user.accountId,
          createdAt: Date.now(),
          remarks: `Accepted offer ${offer.id}`,
          lines: [{ lotId: offer.lotId, qty: offer.qty, unitPrice: offer.unitPrice }],
        },
        data.settings,
        [lot],
      )
      setData((prev) => ({
        ...prev,
        offers: (prev.offers || []).map((o) => (o.id === id ? { ...o, status: 'confirmed' as const } : o)),
        invoices: prev.invoices.some((row) => row.id === invoice.id)
          ? prev.invoices.map((row) => (row.id === invoice.id ? invoice : row))
          : [invoice, ...prev.invoices],
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
      return buyerNote(null, "Added to today's marketplace invoice")
    },
    [applyBootstrap, data.invoices, data.lots, data.offers, data.settings, user],
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
      return buyerNote(null, 'Offer cancelled')
    },
    [data.offers, user],
  )

  const toggleWatch = useCallback(async (lotId: string) => {
    const watching = data.watchlist.includes(lotId)
    const label = watching ? 'Removed from favourites' : 'Saved to favourites'
    const go = { href: '/account/favourites', label: 'View favourites' }
    if (apiModeRef.current) {
      try {
        await api.toggleWatch(lotId)
        await applyBootstrap()
        pushToast(label, 'ok', go)
      } catch {
        pushToast('Could not update favourites.', 'err')
      }
      return
    }
    setData((prev) => ({
      ...prev,
      watchlist: prev.watchlist.includes(lotId)
        ? prev.watchlist.filter((id) => id !== lotId)
        : [...prev.watchlist, lotId],
    }))
    pushToast(label, 'ok', go)
  }, [applyBootstrap, data.watchlist])

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
    async (id: string, decision: 'approved' | 'declined', launchPlans?: DropListClockPlan[]) => {
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
      const plans =
        launchPlans && launchPlans.length
          ? launchPlans
          : previewDropClocks(data.settings, drop.items, now)
      const planByKey = new Map(plans.map((p) => [p.listKey, p]))
      const stampedItems = drop.items.map((item) => {
        const key = dropListKey(item)
        const plan = planByKey.get(key)
        if (!plan || plan.mode === 'marketplace') return item
        return {
          ...item,
          durationMins: plan.durationMins,
          extraSealedMinutes: plan.extraMins || undefined,
        }
      })
      const used = new Set(data.lots.map((l) => l.id.toUpperCase()))
      const lots: Lot[] = []
      for (const item of stampedItems) {
        const key = item.id.toUpperCase()
        if (used.has(key)) return `Lot ID ${item.id} is already live. Decline this drop and send a new sheet.`
        used.add(key)
        lots.push(liveLotFromDrop(item, now, data.settings))
      }
      const next = applyLaunchClocks(data.settings, data.lots, lots, plans, now)
      const publishedIds = new Set(lots.map((l) => l.id))
      const toPublish = next.lots.filter((l) => publishedIds.has(l.id))

      if (apiModeRef.current) {
        try {
          await api.publishLots(
            toPublish.map((l) => ({
              id: l.id,
              channel: l.channel,
              auctionType: l.auctionType || null,
              manufacturer: l.manufacturer,
              model: l.model,
              modelNumber: l.modelNumber,
              capacity: l.capacity,
              color: l.color,
              grade: l.grade,
              battery: l.battery,
              qty: l.qty,
              moq: l.moq ?? null,
              startPrice: l.startPrice,
              currentPrice: l.currentPrice,
              buyNowPrice: l.buyNowPrice ?? null,
              endsAt: l.endsAt,
              extraSealedEndsAt: l.extraSealedEndsAt ?? null,
              description: l.description || '',
              accent: l.accent,
              operator: l.operator ?? null,
              simLocked: l.simLocked ?? null,
              activationLocked: l.activationLocked ?? null,
              origin: l.origin ?? null,
            })),
          )
          pushAuctionClocks(next.settings)
          setData((prev) => ({
            ...prev,
            settings: next.settings,
            listingDrops: (prev.listingDrops || []).map((d) =>
              d.id === id
                ? {
                    ...d,
                    items: stampedItems,
                    status: 'approved' as const,
                    reviewedAt: now,
                    reviewedBy: user.accountId,
                  }
                : d,
            ),
          }))
          await applyBootstrap(user)
          return null
        } catch (e) {
          return e instanceof Error ? e.message : 'Could not publish lots to the server.'
        }
      }

      const reserved = reserveInventory(data.inventory || [], lots)
      if (reserved.error) return reserved.error
      setData((prev) => ({
        ...prev,
        settings: next.settings,
        lots: next.lots,
        inventory: upsertInventory(reserved.inventory, lots),
        listingDrops: (prev.listingDrops || []).map((d) =>
          d.id === id
            ? {
                ...d,
                items: stampedItems,
                status: 'approved' as const,
                reviewedAt: now,
                reviewedBy: user.accountId,
              }
            : d,
        ),
      }))
      return null
    },
    [user, data.lots, data.listingDrops, data.settings, data.inventory, applyBootstrap],
  )

  const patchListingDropItem = useCallback(
    (dropId: string, itemId: string, patch: Partial<ListingDropItem>) => {
      if (!user || user.role !== 'superadmin') return 'Only Super admin can edit pending catalogs.'
      const drop = (data.listingDrops || []).find((d) => d.id === dropId)
      if (!drop || drop.status !== 'pending') return 'That catalog is no longer waiting.'
      setData((prev) => ({
        ...prev,
        listingDrops: (prev.listingDrops || []).map((d) => {
          if (d.id !== dropId) return d
          return {
            ...d,
            items: d.items.map((item) => (item.id === itemId ? { ...item, ...patch, id: item.id } : item)),
          }
        }),
      }))
      return null
    },
    [user, data.listingDrops],
  )

  const patchListingDropGroupClock = useCallback(
    (
      dropId: string,
      listKey: string,
      clock: { durationMins: number; extraSealedMinutes?: number },
    ) => {
      if (!user || user.role !== 'superadmin') return 'Only Super admin can edit pending catalogs.'
      const drop = (data.listingDrops || []).find((d) => d.id === dropId)
      if (!drop || drop.status !== 'pending') return 'That catalog is no longer waiting.'
      const mins = Math.max(1, Math.floor(clock.durationMins) || 1)
      const extra =
        clock.extraSealedMinutes === undefined
          ? undefined
          : Math.max(0, Math.floor(clock.extraSealedMinutes) || 0)
      setData((prev) => ({
        ...prev,
        listingDrops: (prev.listingDrops || []).map((d) => {
          if (d.id !== dropId) return d
          return {
            ...d,
            items: d.items.map((item) => {
              if (dropListKey(item) !== listKey) return item
              return {
                ...item,
                durationMins: mins,
                ...(extra === undefined ? {} : { extraSealedMinutes: extra || undefined }),
              }
            }),
          }
        }),
      }))
      return null
    },
    [user, data.listingDrops],
  )

  const saveSku = useCallback(
    (sku: InventorySku) => {
      if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        return 'Only staff can edit inventory.'
      }
      if (!sku.model.trim() || !sku.manufacturer.trim()) return 'Maker and model are required.'
      const id = sku.id.trim() || `SKU-${Date.now().toString(36)}`
      const onHand = Math.max(0, Math.floor(Number(sku.onHand) || 0))
      const next: InventorySku = {
        ...sku,
        id,
        model: sku.model.trim(),
        manufacturer: sku.manufacturer.trim(),
        onHand,
      }
      setData((prev) => {
        const list = prev.inventory || []
        const exists = list.some((s) => s.id === id)
        return { ...prev, inventory: exists ? list.map((s) => (s.id === id ? next : s)) : [next, ...list] }
      })
      void api
        .saveInventorySku({
          id: next.id,
          manufacturer: next.manufacturer,
          model: next.model,
          modelNumber: next.modelNumber,
          capacity: next.capacity,
          color: next.color,
          grade: next.grade,
          battery: next.battery,
          origin: next.origin,
          description: next.description,
          operator: next.operator,
          defaultMoq: next.defaultMoq,
          lastPrice: next.lastPrice,
          onHand: next.onHand,
        })
        .catch(() => undefined)
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

  const pushAuctionClocks = (settings: SiteSettings, slug?: string) => {
    if (!apiModeRef.current) return
    for (const t of settings.auctionTypes) {
      if (slug && t.value !== slug) continue
      if (!t.closesAt) continue
      void api
        .syncAuctionClock({
          auctionType: t.value,
          closesAt: t.closesAt,
          extraSealedMinutes: t.extraSealedMinutes || 0,
        })
        .catch(() => undefined)
    }
  }

  const saveSettings = useCallback((next: SiteSettings) => {
    if (user?.role !== 'superadmin') return
    setData((prev) => {
      const settings = mergeSettings(next)
      const clocked = ensureAuctionClocks(settings, prev.lots)
      pushAuctionClocks(clocked.settings)
      return { ...prev, settings: clocked.settings, lots: clocked.lots }
    })
    if (apiModeRef.current) {
      const auctionTypeFees: Record<string, number> = {}
      for (const t of next.auctionTypes || []) {
        if (t.feePct === 0 || Number.isFinite(t.feePct)) {
          auctionTypeFees[t.value] = Number(t.feePct) || 0
        }
      }
      void api
        .saveFees({
          marketplaceFeePct:
            next.marketplaceFeePct === 0 || Number.isFinite(next.marketplaceFeePct)
              ? Number(next.marketplaceFeePct) || 0
              : next.invoice?.feePct ?? 2,
          invoiceFeePct: next.invoice?.feePct ?? 2,
          offerFloorPct:
            next.offerFloorPct === 0 || Number.isFinite(next.offerFloorPct)
              ? Math.min(100, Math.max(0, Number(next.offerFloorPct) || 0))
              : 30,
          auctionTypeFees,
          fulfillment: next.fulfillment,
        })
        .catch(() => undefined)
    }
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
        phone: account.phone?.trim() || existing?.phone || undefined,
        buyerNumber: account.buyerNumber?.trim() || undefined,
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
      if (apiModeRef.current) {
        void api.patchAccount(id, { status }).then(() => applyBootstrap(user)).catch(() => {})
      }
      setData((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => (a.accountId === id ? { ...a, status } : a)),
      }))
      return null
    },
    [user, applyBootstrap],
  )

  const applyTypeClock = (prev: Persisted, slug: string | undefined, minutes: number) => {
    const closesAt = Date.now() + minutes * 60 * 1000
    const auctionTypes = prev.settings.auctionTypes.map((t) =>
      !slug || t.value === slug ? { ...t, closesAt, closeMinutes: minutes } : t,
    )
    const next = ensureAuctionClocks({ ...prev.settings, auctionTypes }, prev.lots)
    pushAuctionClocks(next.settings, slug)
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
    async (
      id: string,
      receiptName: string,
      receiptData: string,
      extra?: { payMethod?: WholesalePayMethod; payRef?: string },
    ) => {
      if (apiModeRef.current) {
        try {
          await api.submitInvoicePayment(id, receiptName, receiptData, extra)
          await applyBootstrap()
          return buyerNote(null, 'Payment submitted for review')
        } catch (e) {
          return buyerNote(e instanceof Error ? e.message : 'Payment submit failed.', '')
        }
      }
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
                payMethod: extra?.payMethod || row.payMethod,
                payRef: extra?.payRef ?? row.payRef,
                paidDeclaredAt: Date.now(),
                adminReview: undefined,
                superReview: undefined,
              })
            : row,
        ),
      }))
      return buyerNote(null, 'Payment submitted for review')
    },
    [applyBootstrap, data.invoices, data.settings.copy, user],
  )

  const reviewPayment = useCallback(
    async (id: string, side: PayReviewSide, decision: PayDecision) => {
      if (apiModeRef.current) {
        try {
          await api.reviewInvoicePayment(id, side, decision)
          await applyBootstrap()
          return null
        } catch (e) {
          return e instanceof Error ? e.message : 'Payment review failed.'
        }
      }
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
      setData((prev) => {
        let paid: Invoice | undefined
        const invoices = prev.invoices.map((row) => {
          if (row.id !== id) return row
          const next = settleInvoice({
            ...row,
            adminReview: side === 'admin' ? review : row.adminReview,
            superReview: side === 'super' ? review : row.superReview,
          })
          if (row.status !== 'paid' && next.status === 'paid') paid = next
          return next
        })
        if (paid?.accountId) {
          void pushServerNotice({
            id: `N-PAID-${paid.id}`,
            accountId: paid.accountId,
            kind: 'payment',
            title: 'Payment confirmed',
            body: `${paid.id} is marked paid. Shipping updates will follow.`,
            href: '/account/invoices',
          })
        }
        return { ...prev, invoices }
      })
      return null
    },
    [applyBootstrap, data.invoices, data.settings.copy, user, pushServerNotice],
  )

  const markInvoicePaid = useCallback(
    async (id: string) => {
      if (apiModeRef.current) {
        try {
          await api.markInvoicePaid(id)
          await applyBootstrap()
          return null
        } catch (e) {
          return e instanceof Error ? e.message : 'Could not mark paid.'
        }
      }
      if (user?.role !== 'admin' && user?.role !== 'superadmin') {
        return 'Only staff can mark an invoice paid.'
      }
      const inv = data.invoices.find((i) => i.id === id)
      if (!inv) return data.settings.copy.warnLotMissing
      if (inv.status === 'draft') return 'Issue this invoice first, then mark it paid.'
      if (inv.status === 'paid') return 'Already paid.'
      if (inv.payMethod !== 'cash' && inv.payMethod !== 'usdt') {
        return 'Mark paid is for cash and USDT. Bank still needs both stamps.'
      }
      if (inv.payMethod === 'usdt' && !inv.payRef?.trim() && !inv.receiptData) {
        return 'USDT needs a TX hash or screenshot before you mark it paid.'
      }
      const review = { decision: 'accepted' as const, by: user.accountId, at: Date.now() }
      setData((prev) => {
        let paid: Invoice | undefined
        const invoices = prev.invoices.map((row) => {
          if (row.id !== id) return row
          const next = settleInvoice({ ...row, adminReview: review, superReview: review })
          if (row.status !== 'paid' && next.status === 'paid') paid = next
          return next
        })
        if (paid?.accountId) {
          void pushServerNotice({
            id: `N-PAID-${paid.id}`,
            accountId: paid.accountId,
            kind: 'payment',
            title: 'Payment confirmed',
            body: paid.payRef
              ? `${paid.id} is marked paid (${paid.payMethod} ${paid.payRef}).`
              : `${paid.id} is marked paid (${paid.payMethod}).`,
            href: '/account/invoices',
          })
        }
        return { ...prev, invoices }
      })
      return null
    },
    [applyBootstrap, data.invoices, data.settings.copy, user, pushServerNotice],
  )

  const reviewInvoiceIssue = useCallback(
    async (id: string, side: PayReviewSide, decision: PayDecision) => {
      if (apiModeRef.current) {
        try {
          await api.issueInvoice(id, side, decision)
          await applyBootstrap()
          return null
        } catch (e) {
          return e instanceof Error ? e.message : 'Issue review failed.'
        }
      }
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
        if (issued?.accountId) {
          void pushServerNotice({
            id: `N-ISSUED-${issued.id}`,
            accountId: issued.accountId,
            kind: 'invoice',
            title: 'Invoice issued',
            body: `${issued.id} is ready. Pay within 7 days of issue and upload the receipt.`,
            href: '/account/invoices',
          })
        }
        return { ...prev, invoices, notices }
      })
      return null
    },
    [applyBootstrap, data.invoices, data.settings.copy, user, pushServerNotice],
  )

  const saveInvoice = useCallback(
    async (invoice: Invoice, previousId?: string) => {
      if (user?.role !== 'admin' && user?.role !== 'superadmin') {
        return 'Only admin or super admin can edit invoices.'
      }
      const id = invoice.id.trim().toUpperCase()
      if (!id) return 'Invoice ID is required.'
      const lines = normalizeInvoiceLines(
        invoice.lines,
        invoice.lotId
          ? { lotId: invoice.lotId, qty: invoice.qty, unitPrice: invoice.unitPrice }
          : undefined,
      )
      if (!lines.length) return 'Add at least one line item.'
      for (const line of lines) {
        if (!line.description?.trim() && (!line.lotId || line.lotId === 'CUSTOM')) {
          return 'Each custom line needs a description (or pick a catalog lot).'
        }
        if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
          return 'Enter a valid unit price on every line.'
        }
      }
      const primary = lines[0]
      const lot = data.lots.find((l) => l.id === primary.lotId)
      const existing = data.invoices.find((row) => row.id === (previousId || id).toUpperCase())
      const qty = lines.reduce((s, line) => s + line.qty, 0)
      const feePct = Number.isFinite(invoice.feePct)
        ? Math.max(0, invoice.feePct as number)
        : existing?.feePct || 0
      const next: Invoice = {
        ...invoice,
        id,
        lotId: primary.lotId,
        channel: lot?.channel || invoice.channel || 'marketplace',
        qty,
        unitPrice: primary.unitPrice,
        feePct,
        lines,
        amount: invoiceTotals({ ...invoice, feePct, lines }, data.settings).total,
        accountId: invoice.accountId?.trim().toUpperCase() || undefined,
        createdAt: invoice.createdAt || Date.now(),
        status: existing ? invoice.status : invoice.status || 'draft',
        issueAdmin: invoice.issueAdmin ?? existing?.issueAdmin,
        issueSuper: invoice.issueSuper ?? existing?.issueSuper,
        issuedAt: invoice.issuedAt ?? existing?.issuedAt,
        auctionLabel: invoice.auctionLabel?.trim() || existing?.auctionLabel,
        poNumber: invoice.poNumber?.trim() || undefined,
        remarks: invoice.remarks?.trim() || undefined,
        trackingNo: invoice.trackingNo?.trim() || undefined,
      }
      const replaceId = (previousId || id).toUpperCase()
      if (apiModeRef.current) {
        try {
          await api.saveInvoice(next as unknown as Record<string, unknown>, previousId)
          await applyBootstrap()
          return null
        } catch (e) {
          return e instanceof Error ? e.message : 'Save invoice failed.'
        }
      }
      const trackingJustSet =
        Boolean(next.trackingNo) &&
        next.trackingNo !== existing?.trackingNo &&
        Boolean(next.accountId)
      setData((prev) => ({
        ...prev,
        invoices: [
          next,
          ...prev.invoices.filter((row) => row.id !== replaceId && row.id !== id),
        ],
        notices: existing
          ? trackingJustSet && next.accountId
            ? [
                {
                  id: `N-SHIP-${next.id}-${next.trackingNo}`,
                  accountId: next.accountId,
                  kind: 'shipping' as const,
                  title: 'Shipment update',
                  body: `${next.id} · tracking ${next.trackingNo}`,
                  href: '/account/invoices',
                  at: Date.now(),
                },
                ...(prev.notices || []),
              ]
            : prev.notices
          : [...staffIssueNotices(prev.accounts, [next], Date.now()), ...(prev.notices || [])],
      }))
      if (trackingJustSet && next.accountId) {
        void pushServerNotice({
          id: `N-SHIP-${next.id}-${next.trackingNo}`,
          accountId: next.accountId,
          kind: 'shipping',
          title: 'Shipment update',
          body: `${next.id} · tracking ${next.trackingNo}`,
          href: '/account/invoices',
        })
      }
      return null
    },
    [applyBootstrap, data.lots, data.invoices, data.settings, user, pushServerNotice],
  )

  const removeInvoice = useCallback(
    async (id: string) => {
      if (user?.role !== 'admin' && user?.role !== 'superadmin') {
        return 'Only admin or super admin can delete invoices.'
      }
      if (apiModeRef.current) {
        try {
          await api.deleteInvoice(id)
          await applyBootstrap()
          return null
        } catch (e) {
          return e instanceof Error ? e.message : 'Delete failed.'
        }
      }
      setData((prev) => ({ ...prev, invoices: prev.invoices.filter((row) => row.id !== id) }))
      return null
    },
    [applyBootstrap, user],
  )

  const clearPaymentConfirmation = useCallback(
    async (id: string) => {
      if (user?.role !== 'admin' && user?.role !== 'superadmin') {
        return 'Only admin or super admin can edit payment confirmations.'
      }
      if (apiModeRef.current) {
        try {
          await api.clearInvoicePayment(id)
          await applyBootstrap()
          return null
        } catch (e) {
          return e instanceof Error ? e.message : 'Clear receipt failed.'
        }
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
    [applyBootstrap, user],
  )

  const markInvoiceOpened = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      invoices: prev.invoices.map((row) => (row.id === id ? { ...row, opened: true } : row)),
    }))
    if (apiModeRef.current) {
      void api.markInvoiceOpened(id).catch(() => undefined)
    }
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
    if (apiModeRef.current) {
      void api.markNoticesRead().catch(() => undefined)
    }
  }, [user])

  const appendLocalNotices = useCallback((rows: Notice[]) => {
    if (!rows.length) return
    setData((prev) => {
      const have = new Set((prev.notices || []).map((n) => n.id))
      const add = rows.filter((n) => n?.id && !have.has(n.id))
      if (!add.length) return prev
      return { ...prev, notices: [...add, ...(prev.notices || [])] }
    })
  }, [])

  useEffect(() => {
    if (!apiMode || !user) {
      stopRealtime()
      return
    }
    void loadEmailPrefs()
    startRealtime()
    const off = onLotTick((tick) => {
      setData((prev) => {
        const lots = prev.lots.map((l) =>
          l.id === tick.lotId
            ? { ...l, currentPrice: tick.currentPrice, bidCount: tick.bidCount }
            : l,
        )
        let bids = prev.bids
        if (tick.bid) {
          const b = tick.bid
          const exists = bids.some(
            (row) => row.lotId === b.lotId && row.accountId === b.accountId && row.at === b.at,
          )
          if (!exists) bids = [...bids, b]
        }
        return { ...prev, lots, bids }
      })
    })
    // Soft poll notices; lot ticks come over WebSocket when connected.
    const t = setInterval(() => void refreshNotices(), 60_000)
    return () => {
      off()
      stopRealtime()
      clearInterval(t)
    }
  }, [apiMode, user, loadEmailPrefs, refreshNotices])

  const staff = user?.role === 'admin' || user?.role === 'superadmin'
  const visibleLots = useMemo(
    () => filterExtraSealedLots(data.lots, data.bids, user?.accountId, Boolean(staff), now),
    [data.lots, data.bids, user?.accountId, staff, now],
  )

  const value = useMemo(
    () => ({
      apiMode,
      authReady,
      user,
      lots: visibleLots,
      bids: data.bids,
      watchlist: data.watchlist,
      invoices: data.invoices,
      notices: data.notices || [],
      cart: data.cart,
      cartOrders: data.cartOrders || [],
      offers: data.offers || [],
      listingDrops: data.listingDrops || [],
      inventory: data.inventory || [],
      accounts: data.accounts,
      settings: localizedSettings,
      settingsSource: data.settings,
      locale,
      setLocale,
      isSuperAdmin: user?.role === 'superadmin',
      isStaff: user?.role === 'admin' || user?.role === 'superadmin',
      login,
      register,
      verifyEmail,
      resendVerifyEmail,
      requestPasswordReset,
      resetPassword,
      refreshNotices,
      emailPrefs,
      loadEmailPrefs,
      saveEmailPrefs,
      logout,
      placeBid,
      placeBids,
      buyNow,
      addToCart,
      removeFromCart,
      checkoutCart,
      reviewCartOrder,
      confirmCartOrder,
      cancelCartOrder,
      placeOffer,
      reviewOffer,
      confirmOffer,
      cancelOffer,
      toggleWatch,
      submitPayment,
      reviewPayment,
      markInvoicePaid,
      reviewInvoiceIssue,
      saveInvoice,
      removeInvoice,
      clearPaymentConfirmation,
      markInvoiceOpened,
      markNoticesRead,
      appendLocalNotices,
      myBid,
      myLastBid,
      addLot,
      addLots,
      submitListingDrop,
      withdrawListingDrop,
      reviewListingDrop,
      patchListingDropItem,
      patchListingDropGroupClock,
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
      apiMode,
      authReady,
      user,
      data,
      localizedSettings,
      locale,
      setLocale,
      emailPrefs,
      login,
      register,
      verifyEmail,
      resendVerifyEmail,
      requestPasswordReset,
      resetPassword,
      refreshNotices,
      loadEmailPrefs,
      saveEmailPrefs,
      logout,
      placeBid,
      placeBids,
      buyNow,
      addToCart,
      removeFromCart,
      checkoutCart,
      reviewCartOrder,
      confirmCartOrder,
      cancelCartOrder,
      placeOffer,
      reviewOffer,
      confirmOffer,
      cancelOffer,
      toggleWatch,
      submitPayment,
      reviewPayment,
      markInvoicePaid,
      reviewInvoiceIssue,
      saveInvoice,
      removeInvoice,
      clearPaymentConfirmation,
      markInvoiceOpened,
      markNoticesRead,
      appendLocalNotices,
      myBid,
      myLastBid,
      addLot,
      addLots,
      submitListingDrop,
      withdrawListingDrop,
      reviewListingDrop,
      patchListingDropItem,
      patchListingDropGroupClock,
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
      visibleLots,
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
