import { useEffect, useLayoutEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { InvoiceDesk } from '../components/InvoiceDesk'
import { ListingReview } from '../components/ListingReview'
import { ModalShell } from '../components/ModalShell'
import { OpsShell, type OpsSection } from '../components/OpsShell'
import { OpsToday } from '../components/OpsToday'
import { StoreDesk } from '../components/StoreDesk'
import { FulfillmentQueue } from '../components/FulfillmentQueue'
import { ProductEnquiryDesk } from '../components/ProductEnquiryDesk'
import { ClientsDesk } from '../components/ClientsDesk'
import { WholesaleReviewDesk } from '../components/WholesaleReviewDesk'
import { NumberField } from '../components/NumberField'
import { TimeLeft } from '../components/TimeLeft'
import { DEFAULT_SETTINGS } from '../data'
import { api } from '../lib/api'
import { isInExtraSealed, RESERVED_LIST_SLUGS, slugAuctionType } from '../lib/auctionLists'
import { BODY_FONT_PRESETS, DISPLAY_FONT_PRESETS } from '../lib/fontPresets'
import {
  DESK_BANNER_KEYS,
  DESK_BANNER_LABELS,
  mergeDeskBanners,
} from '../lib/deskBanner'
import { opsQueueCounts } from '../lib/opsQueues'
import { useNow, useStore } from '../store'
import type {
  Account,
  AccountRole,
  AccountStatus,
  AuctionFillMode,
  AuctionTypeDef,
  DeskBannerKey,
  DeskBannerSlide,
  FeatureFlags,
  ContentCard,
  MarketingPageCopy,
  SiteContact,
  SitePages,
  SiteSettings,
  StoreHeroSlide,
  WholesaleHeroSlide,
} from '../types'

const ROLE_LABEL: Record<AccountRole, string> = {
  superadmin: 'Super admin',
  admin: 'Admin',
  member: 'Client',
}

const COPY_LABEL: Record<keyof typeof DEFAULT_SETTINGS.copy, string> = {
  navAuctions: 'Nav · Auctions',
  navStore: 'Nav · Store',
  navFavourites: 'Nav · Favourites',
  navInvoices: 'Nav · Invoices',
  navAccount: 'Nav · Account',
  navAdmin: 'Nav · Admin',
  navSuper: 'Nav · Super admin',
  navWholesale: 'Nav · Wholesale',
  navBuyers: 'Nav · For buyers',
  navSellers: 'Nav · For sellers',
  navSupport: 'Nav · Support',
  navApply: 'Nav · Apply',
  navApplyWholesale: 'Nav · Apply wholesale',
  navOrders: 'Nav · Orders',
  navCart: 'Nav · Cart',
  navMenu: 'Nav · Menu',
  navHelp: 'Nav · Help',
  navNotifications: 'Nav · Notifications',
  navTutorial: 'Nav · How it works',
  navContact: 'Nav · Contact us',
  navLanguage: 'Nav · Language',
  searchGeneric: 'Public search placeholder',
  ariaSearch: 'Aria · Search',
  ariaSubmitSearch: 'Aria · Submit search',
  footerVerified: 'Footer · Verified',
  footerEmail: 'Footer · Email',
  footerMobile: 'Footer · Mobile',
  footerSocial: 'Footer · Social',
  footerNav: 'Footer · Nav label',
  signOut: 'Sign out button',
  signInTitle: 'Sign in title',
  signInButton: 'Sign in button',
  signUpTitle: 'Sign up title',
  signUpIntro: 'Sign up intro',
  signUpButton: 'Sign up button',
  pendingApproval: 'Pending-approval message',
  auctionsTitle: 'Auctions title',
  auctionsIntro: 'Auctions intro',
  marketTitle: 'Marketplace title',
  marketIntro: 'Marketplace intro',
  favouritesTitle: 'Favourites title',
  favouritesIntro: 'Favourites intro',
  invoicesTitle: 'Invoices title',
  invoicesIntro: 'Invoices intro',
  accountTitle: 'Account title',
  accountIntro: 'Account intro',
  searchAuctions: 'Auction search placeholder',
  searchMarket: 'Marketplace search placeholder',
  emptyFilters: 'Empty filters',
  emptyFavourites: 'Empty favourites',
  emptyCart: 'Empty cart',
  emptyInvoices: 'Empty invoices',
  btnBid: 'Bid button',
  btnTakeAll: 'Take all button',
  btnAddCart: 'Buy / cart button',
  btnBuy: 'Buy button',
  btnOffer: 'Offer button',
  btnCheckout: 'Checkout button',
  btnPay: 'I have paid button',
  btnAccept: 'Accept payment',
  btnDecline: 'Decline payment',
  btnResubmitPay: 'Upload new receipt',
  btnRemove: 'Remove button',
  btnPhotos: 'Photos button',
  btnForgot: 'Forgot-password button',
  btnConfirm: 'Confirm button',
  btnCancel: 'Cancel button',
  confirmBidTitle: 'Popup · bid title',
  confirmBidBody: 'Popup · bid body',
  confirmTakeAllTitle: 'Popup · take-all title',
  confirmTakeAllBody: 'Popup · take-all body ({n} = pcs)',
  confirmCartTitle: 'Popup · buy title',
  confirmCartBody: 'Popup · buy body ({n} = pcs)',
  confirmOfferTitle: 'Popup · send offer title',
  confirmOfferBody: 'Popup · send offer body',
  confirmAcceptOfferTitle: 'Popup · confirm accepted offer',
  confirmAcceptOfferBody: 'Popup · confirm accepted offer body',
  confirmCheckoutTitle: 'Popup · checkout title',
  confirmCheckoutBody: 'Popup · checkout body',
  confirmAcceptCartTitle: 'Popup · confirm accepted cart',
  confirmAcceptCartBody: 'Popup · confirm accepted cart body',
  confirmPayTitle: 'Popup · pay title',
  confirmPayBody: 'Popup · pay body',
  payAckLabel: 'Pay confirm checkbox',
  receiptLabel: 'Receipt upload label',
  payWaiting: 'Waiting dual approval',
  payNeedAdmin: 'Waiting for admin',
  payNeedSuper: 'Waiting for super admin',
  payDeclinedNote: 'Payment declined note',
  confirmForgotTitle: 'Popup · forgot title',
  confirmForgotBody: 'Popup · forgot body',
  favAdd: 'Favourite (off)',
  favRemove: 'Favourite (on)',
  closed: 'Closed label',
  noMoq: 'No-MOQ label',
  cartTitle: 'Cart heading',
  emptyMarket: 'Empty marketplace',
  siteNotice: 'Site-wide notice banner',
  endingSoon: 'Ending-soon warning ({n} = minutes)',
  okAddedCart: 'Success · added to cart ({n})',
  okOffer: 'Success · offer sent',
  okOfferInvoiced: 'Success · offer invoiced',
  okCheckout: 'Success · checkout',
  okBid: 'Success · bid ({qty} {price})',
  okPaid: 'Success · paid',
  okPaySubmitted: 'Success · receipt submitted',
  warnReceipt: 'Warning · receipt required',
  warnPayAck: 'Warning · confirm paid checkbox',
  warnMoq: 'Warning · MOQ ({n} = qty)',
  warnQty: 'Warning · invalid qty',
  warnOverQty: 'Warning · over stock ({n} = qty)',
  warnMinPrice: 'Warning · min price ({price})',
  warnOwnBidLower: 'Warning · cannot reduce own bid ({price})',
  warnStartPrice: 'Warning · offline start price ({price})',
  warnNoBid: 'Warning · bidding off',
  warnPending: 'Warning · pending account',
  warnDisabled: 'Warning · disabled account',
  warnClosed: 'Warning · closed lot',
  warnCart: 'Warning · cart off',
  warnOffers: 'Warning · offers off',
  warnOfferPrice: 'Warning · offer below floor % of list',
  warnOfferOpen: 'Warning · accepted offer already open',
  warnLogin: 'Warning · bad login',
  warnRegister: 'Warning · sign-up fields',
  warnAccountTaken: 'Warning · account ID taken',
  warnLotMissing: 'Warning · lot missing',
  warnListingGone: 'Warning · listing gone ({id})',
}

function AddAuctionTypeDialog({
  existing,
  onClose,
  onCreate,
}: {
  existing: string[]
  onClose: () => void
  onCreate: (row: AuctionTypeDef) => void
}) {
  const [label, setLabel] = useState('')
  const [slug, setSlug] = useState('')
  const [fillMode, setFillMode] = useState<AuctionFillMode>('live')
  const [closeMinutes, setCloseMinutes] = useState(48 * 60)
  const [extraSealedMinutes, setExtraSealedMinutes] = useState(6 * 60)
  const [feePct, setFeePct] = useState(2)
  const [error, setError] = useState<string | null>(null)
  const value = slugAuctionType(slug || label)

  function submit() {
    const name = label.trim() || value.replace(/-/g, ' ')
    if (!value) {
      setError('Enter a name for this auction type.')
      return
    }
    if (RESERVED_LIST_SLUGS.has(value)) {
      setError(`“${value}” is reserved. Use another name.`)
      return
    }
    if (existing.includes(value)) {
      setError(`“${value}” already exists.`)
      return
    }
    const mins = Math.max(1, Math.floor(closeMinutes) || 240)
    const extra = Math.max(0, Math.floor(extraSealedMinutes) || 0)
    const fee = Math.max(0, Number(feePct) || 0)
    onCreate({
      value,
      label: name,
      fillMode,
      closeMinutes: mins,
      extraSealedMinutes: extra || undefined,
      closesAt: Date.now() + mins * 60 * 1000,
      feePct: fee,
    })
  }

  return (
    <ModalShell onClose={onClose}>
      <div
        className="modal card type-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-auction-type-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-auction-type-title">Add auction type</h2>
        <p className="muted">Creates its own inventory list. Buyers open it from Auctions like Live Auctions or Offline Auctions.</p>
        <label>
          Type name
          <input
            autoFocus
            value={label}
            placeholder="Dutch auction"
            onChange={(e) => {
              setLabel(e.target.value)
              setError(null)
            }}
          />
        </label>
        <label>
          List id (URL)
          <input
            value={slug}
            placeholder={value || 'dutch'}
            onChange={(e) => {
              setSlug(e.target.value)
              setError(null)
            }}
          />
        </label>
        <p className="muted tiny">Section on auctions: /auctions#{value || '…'}</p>
        <label>
          Fill mode
          <select value={fillMode} onChange={(e) => setFillMode(e.target.value as AuctionFillMode)}>
            <option value="live">Live fill</option>
            <option value="sealed">Sealed (hidden fill)</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </label>
        <label>
          Live close (minutes)
          <input
            type="number"
            min={1}
            value={closeMinutes}
            onChange={(e) => setCloseMinutes(Number(e.target.value))}
          />
        </label>
        <label>
          Extra sealed (minutes)
          <input
            type="number"
            min={0}
            value={extraSealedMinutes}
            onChange={(e) => setExtraSealedMinutes(Number(e.target.value))}
          />
        </label>
        <p className="muted tiny">
          After live ends, only prior bidders see those lots and keep bidding (sealed). 0 = off.
        </p>
        <label>
          Fee % on wins
          <input
            type="number"
            min={0}
            step={0.1}
            value={feePct}
            onChange={(e) => setFeePct(Number(e.target.value))}
          />
        </label>
        <p className="muted tiny">
          Buyers see this % in bid totals. 0 = no fee. First session starts now for the close minutes above.
        </p>
        {error ? <p className="error">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={submit}>
            Add auction type
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

type SuperSection = 'today' | 'catalog' | 'money' | 'store' | 'people' | 'clients' | 'settings'
type SuperSettingsDesk =
  | 'guide'
  | 'site'
  | 'contact'
  | 'pages'
  | 'appearance'
  | 'types'
  | 'copy'
  | 'features'

const SUPER_SECTIONS = new Set<SuperSection>([
  'today',
  'catalog',
  'money',
  'store',
  'people',
  'clients',
  'settings',
])
const SETTINGS_DESKS = new Set<SuperSettingsDesk>([
  'guide',
  'site',
  'contact',
  'pages',
  'appearance',
  'types',
  'copy',
  'features',
])

function mergePagesDraft(partial?: Partial<SitePages> | null): SitePages {
  const p = partial || {}
  return {
    ...DEFAULT_SETTINGS.pages,
    ...p,
    storeHeroes: p.storeHeroes?.length ? p.storeHeroes : [...DEFAULT_SETTINGS.pages.storeHeroes],
    wholesaleHeroes: p.wholesaleHeroes?.length
      ? p.wholesaleHeroes
      : [...DEFAULT_SETTINGS.pages.wholesaleHeroes],
    wholesaleHowSteps: p.wholesaleHowSteps?.length
      ? p.wholesaleHowSteps
      : [...DEFAULT_SETTINGS.pages.wholesaleHowSteps],
    wholesaleTrust: p.wholesaleTrust?.length
      ? p.wholesaleTrust
      : [...DEFAULT_SETTINGS.pages.wholesaleTrust],
    deskBanners: mergeDeskBanners(p.deskBanners),
    buyers: { ...DEFAULT_SETTINGS.pages.buyers, ...p.buyers },
    sellers: { ...DEFAULT_SETTINGS.pages.sellers, ...p.sellers },
    support: { ...DEFAULT_SETTINGS.pages.support, ...p.support },
  }
}

const SOCIAL_LABELS: Record<keyof SiteContact['social'], string> = {
  facebook: 'Facebook URL',
  x: 'X (Twitter) URL',
  instagram: 'Instagram URL',
  whatsapp: 'WhatsApp URL',
  linkedin: 'LinkedIn URL',
  google: 'Google URL',
}

function legacyTabToNav(tab: string | null): { section: SuperSection; desk?: SuperSettingsDesk } | null {
  if (!tab) return null
  if (tab === 'confirm') return { section: 'catalog' }
  if (tab === 'payments') return { section: 'money' }
  if (tab === 'people') return { section: 'people' }
  if (SETTINGS_DESKS.has(tab as SuperSettingsDesk)) return { section: 'settings', desk: tab as SuperSettingsDesk }
  if (SUPER_SECTIONS.has(tab as SuperSection)) return { section: tab as SuperSection }
  return null
}

export function Super() {
  const {
    accounts,
    invoices,
    lots,
    listingDrops,
    cartOrders,
    offers,
    settingsSource,
    saveSettings,
    saveAccount,
    removeAccount,
    setAccountStatus,
  } = useStore()
  /** Super edits English source only — UI locale packs do not affect this desk. */
  const settings = settingsSource
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState<SiteSettings>(() => ({
    ...settings,
    invoice: { ...DEFAULT_SETTINGS.invoice, ...settings.invoice },
    contact: {
      ...DEFAULT_SETTINGS.contact,
      ...settings.contact,
      social: {
        ...DEFAULT_SETTINGS.contact.social,
        ...(settings.contact?.social || {}),
      },
    },
    pages: mergePagesDraft(settings.pages),
  }))
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null)
  const invoiceDraft = { ...DEFAULT_SETTINGS.invoice, ...draft.invoice }
  const contactDraft: SiteContact = {
    ...DEFAULT_SETTINGS.contact,
    ...draft.contact,
    social: {
      ...DEFAULT_SETTINGS.contact.social,
      ...(draft.contact?.social || {}),
    },
  }
  const pagesDraft = mergePagesDraft(draft.pages)

  function patchInvoice(patch: Partial<SiteSettings['invoice']>) {
    setDraft((prev) => ({
      ...prev,
      invoice: { ...DEFAULT_SETTINGS.invoice, ...prev.invoice, ...patch },
    }))
  }

  function patchContact(patch: Partial<SiteContact>) {
    setDraft((prev) => {
      const base = {
        ...DEFAULT_SETTINGS.contact,
        ...prev.contact,
        social: {
          ...DEFAULT_SETTINGS.contact.social,
          ...(prev.contact?.social || {}),
        },
      }
      return {
        ...prev,
        contact: {
          ...base,
          ...patch,
          social: patch.social ? { ...base.social, ...patch.social } : base.social,
        },
      }
    })
  }

  function patchPages(patch: Partial<SitePages>) {
    setDraft((prev) => ({
      ...prev,
      pages: { ...mergePagesDraft(prev.pages), ...patch },
    }))
  }

  function patchMarketingPage(key: 'buyers' | 'sellers' | 'support', patch: Partial<MarketingPageCopy>) {
    setDraft((prev) => {
      const base = mergePagesDraft(prev.pages)
      return {
        ...prev,
        pages: { ...base, [key]: { ...base[key], ...patch } },
      }
    })
  }

  function patchHero(index: number, patch: Partial<StoreHeroSlide>) {
    setDraft((prev) => {
      const base = mergePagesDraft(prev.pages)
      const heroes = [...base.storeHeroes]
      while (heroes.length <= index) heroes.push({ kicker: '', title: '', body: '', cta: '' })
      heroes[index] = { ...heroes[index], ...patch }
      return { ...prev, pages: { ...base, storeHeroes: heroes } }
    })
  }

  function patchWholesaleHero(index: number, patch: Partial<WholesaleHeroSlide>) {
    setDraft((prev) => {
      const base = mergePagesDraft(prev.pages)
      const heroes = [...base.wholesaleHeroes]
      while (heroes.length <= index) {
        heroes.push({ kicker: '', title: '', body: '', cta: '', to: '/wholesale' })
      }
      heroes[index] = { ...heroes[index], ...patch }
      return { ...prev, pages: { ...base, wholesaleHeroes: heroes } }
    })
  }

  function patchDeskBannerSlide(
    key: DeskBannerKey,
    index: number,
    patch: Partial<DeskBannerSlide>,
  ) {
    setDraft((prev) => {
      const base = mergePagesDraft(prev.pages)
      const slides = [...base.deskBanners[key]]
      while (slides.length <= index) slides.push({ title: '', body: '', imageUrl: '' })
      slides[index] = { ...slides[index], ...patch }
      return {
        ...prev,
        pages: {
          ...base,
          deskBanners: { ...base.deskBanners, [key]: slides },
        },
      }
    })
  }

  function addDeskBannerSlide(key: DeskBannerKey) {
    setDraft((prev) => {
      const base = mergePagesDraft(prev.pages)
      return {
        ...prev,
        pages: {
          ...base,
          deskBanners: {
            ...base.deskBanners,
            [key]: [...base.deskBanners[key], { title: '', body: '', imageUrl: '' }],
          },
        },
      }
    })
  }

  function removeDeskBannerSlide(key: DeskBannerKey) {
    setDraft((prev) => {
      const base = mergePagesDraft(prev.pages)
      const slides = base.deskBanners[key]
      if (slides.length <= 1) return prev
      return {
        ...prev,
        pages: {
          ...base,
          deskBanners: { ...base.deskBanners, [key]: slides.slice(0, -1) },
        },
      }
    })
  }

  function patchContentCard(
    key: 'wholesaleHowSteps' | 'wholesaleTrust',
    index: number,
    patch: Partial<ContentCard>,
  ) {
    setDraft((prev) => {
      const base = mergePagesDraft(prev.pages)
      const rows = [...base[key]]
      while (rows.length <= index) rows.push({ title: '', body: '' })
      rows[index] = { ...rows[index], ...patch }
      return { ...prev, pages: { ...base, [key]: rows } }
    })
  }
  const [addTypeOpen, setAddTypeOpen] = useState(false)
  const [accountMsg, setAccountMsg] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState('')
  const [company, setCompany] = useState('')
  const [address, setAddress] = useState('')
  const [buyerNo, setBuyerNo] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<AccountRole>('member')
  const [status, setStatus] = useState<AccountStatus>('active')

  const [wholesaleStuck, setWholesaleStuck] = useState(0)
  const [productAsks, setProductAsks] = useState(0)
  useEffect(() => {
    void api
      .staffWholesaleStuck()
      .then((r) => setWholesaleStuck(r.stuck.length))
      .catch(() => undefined)
  }, [])
  useEffect(() => {
    void api
      .productEnquiryCount()
      .then((r) => setProductAsks(r.openCount))
      .catch(() => undefined)
  }, [])
  const queues = opsQueueCounts({
    listingDrops,
    invoices,
    accounts,
    offers,
    cartOrders,
    wholesaleStuck,
    productAsks,
  })
  const liveLots = lots.filter((l) => l.channel === 'auction' && l.endsAt > now).length
  const sealedLots = lots.filter((l) => isInExtraSealed(l, now)).length

  const legacy = legacyTabToNav(params.get('tab'))
  const sectionParam = params.get('section') || legacy?.section || ''
  const deskParam = params.get('desk') || legacy?.desk || ''
  const defaultSection: SuperSection =
    queues.catalogWaitItems || queues.money || queues.pendingAccounts || queues.wholesaleApps
      ? 'today'
      : 'people'
  const section: SuperSection = SUPER_SECTIONS.has(sectionParam as SuperSection)
    ? (sectionParam as SuperSection)
    : defaultSection
  const desk: SuperSettingsDesk = SETTINGS_DESKS.has(deskParam as SuperSettingsDesk)
    ? (deskParam as SuperSettingsDesk)
    : 'guide'

  function go(nextSection: string, nextDesk?: string) {
    const next = new URLSearchParams()
    next.set('section', nextSection)
    if (nextDesk) next.set('desk', nextDesk)
    setParams(next, { replace: true })
  }

  function setTab(next: string) {
    if (SETTINGS_DESKS.has(next as SuperSettingsDesk)) go('settings', next)
    else if (next === 'confirm') go('catalog')
    else if (next === 'payments') go('money')
    else go(next)
  }

  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--auction-desk-h', '0px')
    return () => {
      document.documentElement.style.removeProperty('--auction-desk-h')
    }
  }, [])

  useEffect(() => {
    let alive = true
    void api
      .getFees()
      .then((res) => {
        if (!alive || !res.fees) return
        setDraft((prev) => ({
          ...prev,
          marketplaceFeePct: res.fees.marketplaceFeePct,
          offerFloorPct: res.fees.offerFloorPct,
          fulfillment: {
            ...DEFAULT_SETTINGS.fulfillment!,
            ...(res.fees.fulfillment || {}),
            storeModes:
              res.fees.fulfillment?.storeModes?.length
                ? res.fees.fulfillment.storeModes
                : DEFAULT_SETTINGS.fulfillment!.storeModes,
            wholesaleModes:
              res.fees.fulfillment?.wholesaleModes?.length
                ? res.fees.fulfillment.wholesaleModes
                : DEFAULT_SETTINGS.fulfillment!.wholesaleModes,
          },
          auctionTypes: prev.auctionTypes.map((t) => ({
            ...t,
            feePct:
              res.fees.auctionTypeFees?.[t.value] === 0 ||
              Number.isFinite(res.fees.auctionTypeFees?.[t.value])
                ? Number(res.fees.auctionTypeFees[t.value]) || 0
                : t.feePct,
          })),
        }))
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      auctionTypes: settings.auctionTypes.map((live) => {
        const d = prev.auctionTypes.find((x) => x.value === live.value)
        if (!d) return live
        return {
          ...live,
          label: d.label,
          fillMode: d.fillMode,
          intro: d.intro,
          closeMinutes: d.closeMinutes,
          extraSealedMinutes:
            d.extraSealedMinutes === 0 || Number.isFinite(d.extraSealedMinutes)
              ? d.extraSealedMinutes
              : live.extraSealedMinutes,
          feePct: d.feePct === 0 || Number.isFinite(d.feePct) ? d.feePct : live.feePct,
        }
      }),
      marketplaceFeePct:
        prev.marketplaceFeePct === 0 || Number.isFinite(prev.marketplaceFeePct)
          ? prev.marketplaceFeePct
          : settings.marketplaceFeePct,
      offerFloorPct:
        prev.offerFloorPct === 0 || Number.isFinite(prev.offerFloorPct)
          ? prev.offerFloorPct
          : settings.offerFloorPct,
      fulfillment: {
        ...DEFAULT_SETTINGS.fulfillment!,
        ...(settings.fulfillment || {}),
        ...(prev.fulfillment || {}),
        storeModes:
          prev.fulfillment?.storeModes?.length ||
          settings.fulfillment?.storeModes?.length ||
          DEFAULT_SETTINGS.fulfillment!.storeModes
            ? prev.fulfillment?.storeModes?.length
              ? prev.fulfillment.storeModes
              : settings.fulfillment?.storeModes?.length
                ? settings.fulfillment.storeModes
                : DEFAULT_SETTINGS.fulfillment!.storeModes
            : DEFAULT_SETTINGS.fulfillment!.storeModes,
        wholesaleModes: prev.fulfillment?.wholesaleModes?.length
          ? prev.fulfillment.wholesaleModes
          : settings.fulfillment?.wholesaleModes?.length
            ? settings.fulfillment.wholesaleModes
            : DEFAULT_SETTINGS.fulfillment!.wholesaleModes,
      },
      invoice: { ...DEFAULT_SETTINGS.invoice, ...settings.invoice, ...prev.invoice },
    }))
  }, [settings.auctionTypes, settings.invoice, settings.marketplaceFeePct, settings.offerFloorPct, settings.fulfillment])

  function publishAuctionType(row: AuctionTypeDef) {
    const auctionTypes = [...settings.auctionTypes.filter((t) => t.value !== row.value), row]
    saveSettings({ ...settings, auctionTypes })
    setDraft((prev) => ({ ...prev, auctionTypes }))
    setAddTypeOpen(false)
    setTab('types')
    setSettingsMsg(`${row.label} is live. Buyers see it under Auctions.`)
  }

  function resetAccountForm() {
    setEditingId(null)
    setAccountId('')
    setCompany('')
    setAddress('')
    setBuyerNo('')
    setEmail('')
    setPhone('')
    setPassword('')
    setRole('member')
    setStatus('active')
  }

  function loadAccount(a: Account) {
    setEditingId(a.accountId)
    setAccountId(a.accountId)
    setCompany(a.company)
    setAddress(a.address || '')
    setBuyerNo(a.buyerNumber || '')
    setEmail(a.email)
    setPhone(a.phone || '')
    setPassword('')
    setRole(a.role === 'superadmin' ? 'superadmin' : a.role)
    setStatus(a.status)
    setAccountMsg(`Editing ${a.accountId}`)
  }

  function onSaveAccount(e: FormEvent) {
    e.preventDefault()
    const err = saveAccount({
      accountId: editingId || accountId,
      company,
      address,
      phone: phone.trim() || undefined,
      buyerNumber: buyerNo.trim() || undefined,
      email,
      password,
      role: editingId === 'SUPER-0001' ? 'superadmin' : role === 'admin' ? 'admin' : 'member',
      status,
    })
    if (err) {
      setAccountMsg(err)
      return
    }
    setAccountMsg(editingId ? `Saved ${editingId}` : `Created ${accountId.toUpperCase()}`)
    resetAccountForm()
  }

  function onSaveSettings(e: FormEvent, clocks: 'keep' | 'draft' = 'keep') {
    e.preventDefault()
    const grades = draft.grades.map((g) => g.trim()).filter(Boolean)
    if (!draft.brandName.trim() || !grades.length) {
      setSettingsMsg('Brand name and at least one grade are required.')
      return
    }
    if (!draft.auctionTypes.length) {
      setSettingsMsg('Keep at least one auction type.')
      return
    }
    const brandName = draft.brandName.trim()
    const prevBrand = settings.brandName
    const pagesForSave = (() => {
      const p = mergePagesDraft(draft.pages)
      let authBrand = p.authBrand.trim() || DEFAULT_SETTINGS.pages.authBrand
      if (
        authBrand === prevBrand ||
        authBrand === 'Equarios' ||
        authBrand === DEFAULT_SETTINGS.pages.authBrand
      ) {
        authBrand = brandName
      }
      const trimPage = (page: MarketingPageCopy): MarketingPageCopy => ({
        kicker: page.kicker.trim(),
        title: page.title.trim(),
        lead: page.lead.trim(),
        body: page.body.trim(),
        primaryCta: page.primaryCta.trim(),
        secondaryCta: page.secondaryCta.trim(),
      })
      const trimCard = (c: ContentCard): ContentCard => ({
        title: c.title.trim(),
        body: c.body.trim(),
      })
      const deskBanners = mergeDeskBanners(p.deskBanners)
      for (const key of DESK_BANNER_KEYS) {
        const def = DEFAULT_SETTINGS.pages.deskBanners[key]
        const rows = deskBanners[key]
        deskBanners[key] = rows
          .map((row, i) => {
            const pad = def[i % def.length] || def[0]!
            return {
              title: (row.title || '').trim() || pad.title,
              body: (row.body || '').trim() || pad.body,
              imageUrl: (row.imageUrl || '').trim() || pad.imageUrl,
            }
          })
          .filter((row) => row.title || row.body || row.imageUrl)
        if (!deskBanners[key].length) {
          deskBanners[key] = def.map((s) => ({ ...s }))
        }
      }
      return {
        footerCopyright: p.footerCopyright.trim() || DEFAULT_SETTINGS.pages.footerCopyright,
        authBrand,
        authTitle: p.authTitle.trim() || DEFAULT_SETTINGS.pages.authTitle,
        authLead: p.authLead.trim() || DEFAULT_SETTINGS.pages.authLead,
        heroIntervalSec: Math.max(5, Math.floor(Number(p.heroIntervalSec) || 30)),
        storeHeroes: p.storeHeroes
          .map((h) => ({
            kicker: (h.kicker || '').trim(),
            title: (h.title || '').trim(),
            body: (h.body || '').trim(),
            cta: (h.cta || '').trim(),
            imageUrl: (h.imageUrl || '').trim(),
          }))
          .filter((h) => h.title || h.body || h.kicker),
        wholesaleHeroes: p.wholesaleHeroes
          .map((h) => ({
            kicker: (h.kicker || '').trim(),
            title: (h.title || '').trim(),
            body: (h.body || '').trim(),
            cta: (h.cta || '').trim(),
            to: (h.to || '/auctions').trim() || '/auctions',
            imageUrl: (h.imageUrl || '').trim(),
          }))
          .filter((h) => h.title || h.body || h.kicker),
        deskBanners,
        wholesaleHowTitle: p.wholesaleHowTitle.trim() || DEFAULT_SETTINGS.pages.wholesaleHowTitle,
        wholesaleHowSteps: p.wholesaleHowSteps.map(trimCard).filter((c) => c.title || c.body),
        wholesaleTrust: p.wholesaleTrust.map(trimCard).filter((c) => c.title || c.body),
        wholesaleDealsTitle:
          p.wholesaleDealsTitle.trim() || DEFAULT_SETTINGS.pages.wholesaleDealsTitle,
        wholesaleBrandsTitle:
          p.wholesaleBrandsTitle.trim() || DEFAULT_SETTINGS.pages.wholesaleBrandsTitle,
        wholesaleEmptyDeals:
          p.wholesaleEmptyDeals.trim() || DEFAULT_SETTINGS.pages.wholesaleEmptyDeals,
        wholesaleEmptyMarket:
          p.wholesaleEmptyMarket.trim() || DEFAULT_SETTINGS.pages.wholesaleEmptyMarket,
        wholesaleSeoTitle:
          p.wholesaleSeoTitle.trim() || DEFAULT_SETTINGS.pages.wholesaleSeoTitle,
        wholesaleSeoDescription:
          p.wholesaleSeoDescription.trim() || DEFAULT_SETTINGS.pages.wholesaleSeoDescription,
        wholesaleEndingSoonTitle:
          p.wholesaleEndingSoonTitle.trim() || DEFAULT_SETTINGS.pages.wholesaleEndingSoonTitle,
        wholesaleEndingSoonViewAll:
          p.wholesaleEndingSoonViewAll.trim() || DEFAULT_SETTINGS.pages.wholesaleEndingSoonViewAll,
        wholesaleMyDeskLabel:
          p.wholesaleMyDeskLabel.trim() || DEFAULT_SETTINGS.pages.wholesaleMyDeskLabel,
        wholesaleMyDeskGo: p.wholesaleMyDeskGo.trim() || DEFAULT_SETTINGS.pages.wholesaleMyDeskGo,
        wholesaleCatDeviceLabel:
          p.wholesaleCatDeviceLabel.trim() || DEFAULT_SETTINGS.pages.wholesaleCatDeviceLabel,
        wholesaleCatConditionLabel:
          p.wholesaleCatConditionLabel.trim() || DEFAULT_SETTINGS.pages.wholesaleCatConditionLabel,
        wholesaleCatAllLabel:
          p.wholesaleCatAllLabel.trim() || DEFAULT_SETTINGS.pages.wholesaleCatAllLabel,
        wholesaleEmptyHub:
          p.wholesaleEmptyHub.trim() || DEFAULT_SETTINGS.pages.wholesaleEmptyHub,
        wholesaleBrowseMarketCta:
          p.wholesaleBrowseMarketCta.trim() || DEFAULT_SETTINGS.pages.wholesaleBrowseMarketCta,
        wholesaleOpenAuctionsCta:
          p.wholesaleOpenAuctionsCta.trim() || DEFAULT_SETTINGS.pages.wholesaleOpenAuctionsCta,
        wholesaleViewAllAuctions:
          p.wholesaleViewAllAuctions.trim() || DEFAULT_SETTINGS.pages.wholesaleViewAllAuctions,
        wholesaleViewAllMarket:
          p.wholesaleViewAllMarket.trim() || DEFAULT_SETTINGS.pages.wholesaleViewAllMarket,
        buyers: trimPage(p.buyers),
        sellers: trimPage(p.sellers),
        support: trimPage(p.support),
      }
    })()

    saveSettings({
      ...draft,
      brandName,
      brandMark: draft.brandMark.trim() || 'EQ',
      brandLogo: draft.brandLogo.trim() || DEFAULT_SETTINGS.brandLogo,
      tagline: draft.tagline.trim(),
      marketplaceLabel: draft.marketplaceLabel.trim() || 'Marketplace',
      storeLabel: (draft.storeLabel || 'Store').trim() || 'Store',
      showStore: draft.showStore !== false,
      showCommunity: draft.showCommunity !== false,
      grades,
      copy: {
        ...draft.copy,
        auctionsTitle: pagesForSave.deskBanners.auctions[0]?.title || draft.copy.auctionsTitle,
        auctionsIntro: pagesForSave.deskBanners.auctions[0]?.body || draft.copy.auctionsIntro,
        marketTitle: pagesForSave.deskBanners.marketplace[0]?.title || draft.copy.marketTitle,
        marketIntro: pagesForSave.deskBanners.marketplace[0]?.body || draft.copy.marketIntro,
        accountTitle: pagesForSave.deskBanners.myPage[0]?.title || draft.copy.accountTitle,
        accountIntro: pagesForSave.deskBanners.myPage[0]?.body || draft.copy.accountIntro,
      },
      invoice: { ...DEFAULT_SETTINGS.invoice, ...draft.invoice },
      contact: (() => {
        const c = {
          ...DEFAULT_SETTINGS.contact,
          ...draft.contact,
          social: { ...DEFAULT_SETTINGS.contact.social, ...draft.contact?.social },
        }
        const trim = (s: string) => s.trim()
        return {
          ...c,
          legalName: trim(c.legalName),
          verifiedMember: trim(c.verifiedMember),
          webLabel: trim(c.webLabel),
          webUrl: trim(c.webUrl),
          emailBusiness: trim(c.emailBusiness),
          emailEnquiry: trim(c.emailEnquiry),
          phone: trim(c.phone).replace(/\s+/g, ''),
          phoneDisplay: trim(c.phoneDisplay),
          wechatId: trim(c.wechatId),
          linkedinHandle: trim(c.linkedinHandle),
          linkedinUrl: trim(c.linkedinUrl),
          whatsapp: trim(c.whatsapp).replace(/\s+/g, ''),
          whatsappDisplay: trim(c.whatsappDisplay),
          duns: trim(c.duns),
          social: {
            facebook: trim(c.social.facebook),
            x: trim(c.social.x),
            instagram: trim(c.social.instagram),
            whatsapp: trim(c.social.whatsapp),
            linkedin: trim(c.social.linkedin),
            google: trim(c.social.google),
          },
        }
      })(),
      pages: pagesForSave,
      auctionTypes: clocks === 'keep' ? settings.auctionTypes : draft.auctionTypes,
      defaultMoq: Math.max(0, Math.floor(Number(draft.defaultMoq) || 0)),
      reopenMinutes: Math.max(1, Math.floor(Number(draft.reopenMinutes ?? (draft.reopenHours || 4) * 60) || 1)),
      extendMinutes: Math.max(1, Math.floor(Number(draft.extendMinutes ?? (draft.extendHours || 2) * 60) || 1)),
      reopenHours: Math.max(1 / 60, Number(draft.reopenMinutes ?? (draft.reopenHours || 4) * 60) / 60),
      extendHours: Math.max(1 / 60, Number(draft.extendMinutes ?? (draft.extendHours || 2) * 60) / 60),
      endingSoonMinutes: Math.max(1, Math.floor(Number(draft.endingSoonMinutes) || 15)),
    })
    setSettingsMsg(
      clocks === 'draft'
        ? 'Auction types saved. Open lists keep their current close unless you started a new clock.'
        : 'Settings saved. Auction close times were left unchanged.',
    )
  }

  const sections: OpsSection[] = useMemo(
    () => [
      { id: 'today', label: 'Today', count: queues.total || undefined },
      {
        id: 'catalog',
        label: 'Catalog',
        count: queues.catalogWaitItems || undefined,
      },
      { id: 'money', label: 'Money', count: queues.money || undefined },
      {
        id: 'store',
        label: 'Store',
        count: queues.fulfillment || undefined,
        desks: [
          { id: 'catalog', label: 'Catalog' },
          { id: 'fulfill', label: 'Fulfillment', count: queues.fulfillment || undefined },
          { id: 'asks', label: 'Asks', count: queues.productAsks || undefined },
        ],
      },
      {
        id: 'people',
        label: 'People',
        count: (queues.pendingAccounts + queues.wholesaleApps) || undefined,
      },
      { id: 'clients', label: 'Clients' },
      {
        id: 'settings',
        label: 'Settings',
        desks: [
          { id: 'guide', label: 'Guide' },
          { id: 'site', label: 'Site' },
          { id: 'contact', label: 'Footer' },
          { id: 'pages', label: 'Pages' },
          { id: 'appearance', label: 'Look' },
          { id: 'types', label: 'Auction types' },
          { id: 'copy', label: 'Text' },
          { id: 'features', label: 'Functions' },
        ],
      },
    ],
    [queues],
  )

  const settingsActions =
    section === 'settings' && desk === 'types' ? (
      <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddTypeOpen(true)}>
        Add auction type
      </button>
    ) : null

  // IMEI desk lives on Admin only — keep old Super links working
  if (sectionParam === 'imei' || params.get('tab') === 'imei') {
    return <Navigate to="/admin?section=imei" replace />
  }

  return (
    <OpsShell
      deskKey="super"
      title="Super admin"
      blurb="Approve catalogs, issue invoices, manage people, and edit site-wide text, look, and features under Settings → Guide. Day-to-day listing and IMEI live under Admin."
      sections={sections}
      section={section}
      desk={desk}
      onSection={(id) => go(id)}
      onDesk={(id) => go('settings', id)}
      actions={settingsActions}
    >
      {section === 'today' ? (
        <OpsToday
          role="super"
          queues={queues}
          liveLots={liveLots}
          sealedLots={sealedLots}
          inventoryCount={0}
          onGo={go}
        />
      ) : null}

      {section === 'people' ? <section className="card admin-section">
        <h2>{editingId ? `Edit ${editingId}` : 'Add admin or client'}</h2>
        <form className="admin-form" onSubmit={onSaveAccount}>
          <label>
            Account ID
            <input
              value={accountId}
              disabled={Boolean(editingId)}
              onChange={(e) => setAccountId(e.target.value)}
            />
          </label>
          <label>
            Company
            <input value={company} onChange={(e) => setCompany(e.target.value)} />
          </label>
          <label className="admin-span">
            Ship / bill address
            <textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label>
            Buyer # (invoice)
            <input
              value={buyerNo}
              onChange={(e) => setBuyerNo(e.target.value)}
              placeholder="Optional · e.g. 90001116001"
            />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+852 …"
            />
          </label>
          <label>
            Password {editingId ? '(blank = keep)' : ''}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label>
            Role
            <select
              value={role === 'superadmin' ? 'superadmin' : role}
              disabled={role === 'superadmin'}
              onChange={(e) => setRole(e.target.value as AccountRole)}
            >
              <option value="member">Client</option>
              <option value="admin">Admin</option>
              {role === 'superadmin' ? <option value="superadmin">Super admin</option> : null}
            </select>
          </label>
          <label>
            Status
            <select
              value={status}
              disabled={role === 'superadmin'}
              onChange={(e) => setStatus(e.target.value as AccountStatus)}
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <button className="btn btn-primary btn-sm" type="submit">
            {editingId ? 'Save account' : 'Add account'}
          </button>
          {editingId ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetAccountForm}>
              Cancel
            </button>
          ) : null}
        </form>
        {accountMsg ? <p className={accountMsg.includes('Only') || accountMsg.includes('cannot') || accountMsg.includes('Fill') || accountMsg.includes('Password') ? 'error' : 'ok'}>{accountMsg}</p> : null}
      </section> : null}

      {section === 'people' ? <WholesaleReviewDesk /> : null}
      {section === 'clients' ? <ClientsDesk /> : null}

      {section === 'people' ? <section className="table-wrap card admin-section">
        <h2>All accounts</h2>
        <table className="auction-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Role</th>
              <th>Status</th>
              <th>Wholesale</th>
              <th>Company</th>
              <th>Buyer #</th>
              <th>Email</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.accountId}>
                <td className="mono">{a.accountId}</td>
                <td>{ROLE_LABEL[a.role]}</td>
                <td>
                  <span className={`pill ${a.status === 'active' ? 'pill-market' : a.status === 'pending' ? 'pill-hybrid' : 'pill-sealed'}`}>
                    {a.status}
                  </span>
                </td>
                <td className="tiny">{(a.wholesaleStatus || '—').replace(/_/g, ' ')}</td>
                <td>{a.company}</td>
                <td className="mono tiny">{a.buyerNumber || '—'}</td>
                <td>{a.email}</td>
                <td className="row-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadAccount(a)}>
                    Edit
                  </button>
                  {a.status === 'pending' ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setAccountStatus(a.accountId, 'active')}
                    >
                      Approve
                    </button>
                  ) : null}
                  {a.role !== 'superadmin' ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        if (window.confirm(`Remove ${a.accountId}?`)) {
                          const err = removeAccount(a.accountId)
                          if (err) setAccountMsg(err)
                        }
                      }}
                    >
                      Remove
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section> : null}

      {section === 'catalog' ? <ListingReview /> : null}

      {section === 'store' && deskParam === 'fulfill' ? <FulfillmentQueue /> : null}
      {section === 'store' && deskParam === 'asks' ? <ProductEnquiryDesk /> : null}
      {section === 'store' && deskParam !== 'fulfill' && deskParam !== 'asks' ? (
        <StoreDesk />
      ) : null}

      {section === 'money' ? (
        <section className="mh-desk pay-queue-card invoice-super-panel">
          <header className="mh-desk-head">
            <h2>Money</h2>
            <p className="mh-desk-note">
              Issue drafts, stamp receipts with Admin, then final Super payment confirm.
            </p>
          </header>
          <InvoiceDesk canAdmin canSuper allowCreate />
        </section>
      ) : null}

      {section === 'settings' && desk === 'site' ? (
        <section className="card admin-section">
          <h2>Site</h2>
          <form className="admin-form" onSubmit={(e) => onSaveSettings(e, 'keep')}>
            <label>
              Brand name
              <input
                value={draft.brandName}
                onChange={(e) => setDraft({ ...draft, brandName: e.target.value })}
              />
            </label>
            <p className="muted tiny admin-span" style={{ marginTop: -8 }}>
              Site title &amp; hero text use this. Upload a PNG with a transparent background for the mark —
              flat white/black boxes are stripped automatically.
            </p>
            <label>
              Brand mark
              <input
                value={draft.brandMark}
                onChange={(e) => setDraft({ ...draft, brandMark: e.target.value })}
              />
            </label>
            <div className="admin-span brand-logo-field">
              <span className="label-text">Brand logo</span>
              <div className="brand-logo-upload-row">
                <div className="brand-logo-preview" aria-hidden>
                  {draft.brandLogo ? (
                    <img src={draft.brandLogo} alt="" />
                  ) : (
                    <span className="muted tiny">No logo</span>
                  )}
                </div>
                <div className="brand-logo-upload-actions">
                  <label className="btn btn-ghost brand-logo-file">
                    Upload logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      hidden
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (!file) return
                        setSettingsMsg(null)
                        try {
                          const { url } = await api.uploadBrandLogo(file)
                          const next = { ...draft, brandLogo: url }
                          setDraft(next)
                          saveSettings({
                            ...next,
                            brandName: next.brandName.trim() || DEFAULT_SETTINGS.brandName,
                            brandMark: next.brandMark.trim() || 'EQ',
                            brandLogo: url,
                          })
                          setSettingsMsg('Logo applied everywhere.')
                        } catch (err) {
                          setSettingsMsg(err instanceof Error ? err.message : 'Logo upload failed.')
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      const next = { ...draft, brandLogo: DEFAULT_SETTINGS.brandLogo }
                      setDraft(next)
                      saveSettings({
                        ...next,
                        brandName: next.brandName.trim() || DEFAULT_SETTINGS.brandName,
                        brandMark: next.brandMark.trim() || 'EQ',
                        brandLogo: DEFAULT_SETTINGS.brandLogo,
                      })
                      setSettingsMsg('Default logo restored.')
                    }}
                  >
                    Use default
                  </button>
                </div>
              </div>
              <label className="brand-logo-path">
                Path
                <input
                  value={draft.brandLogo}
                  onChange={(e) => setDraft({ ...draft, brandLogo: e.target.value })}
                />
              </label>
            </div>
            <label>
              Tagline
              <input
                value={draft.tagline}
                onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
              />
            </label>
            <label>
              Marketplace label
              <input
                value={draft.marketplaceLabel}
                onChange={(e) => setDraft({ ...draft, marketplaceLabel: e.target.value })}
              />
            </label>
            <label>
              Store label
              <input
                value={draft.storeLabel || 'Store'}
                onChange={(e) => setDraft({ ...draft, storeLabel: e.target.value })}
              />
            </label>
            <label>
              Grades (comma separated)
              <input
                value={draft.grades.join(', ')}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    grades: e.target.value.split(',').map((g) => g.trim()).filter(Boolean),
                  })
                }
              />
            </label>
            <label>
              Default MOQ (0 = none)
              <input
                type="number"
                min={0}
                value={draft.defaultMoq}
                onChange={(e) => setDraft({ ...draft, defaultMoq: Number(e.target.value) })}
              />
            </label>
            <label>
              Reopen minutes
              <input
                type="number"
                min={1}
                step={1}
                value={draft.reopenMinutes ?? Math.round((draft.reopenHours || 4) * 60)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    reopenMinutes: Number(e.target.value),
                    reopenHours: Number(e.target.value) / 60,
                  })
                }
              />
            </label>
            <label>
              Extend minutes
              <input
                type="number"
                min={1}
                step={1}
                value={draft.extendMinutes ?? Math.round((draft.extendHours || 2) * 60)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    extendMinutes: Number(e.target.value),
                    extendHours: Number(e.target.value) / 60,
                  })
                }
              />
            </label>
            <label>
              Ending-soon minutes
              <input
                type="number"
                min={1}
                value={draft.endingSoonMinutes}
                onChange={(e) => setDraft({ ...draft, endingSoonMinutes: Number(e.target.value) })}
              />
            </label>

            <div className="invoice-profile-panel admin-span">
              <h3>Invoice profile</h3>
              <p className="muted tiny">
                Letterhead, bank remittance, and notice wording printed on every commercial invoice PDF.
                Use {'{payDays}'} and {'{feePct}'} in notice templates.
              </p>
              <div className="admin-form invoice-profile-fields">
                <label className="admin-span">
                  Legal name
                  <input
                    value={invoiceDraft.legalName}
                    onChange={(e) => patchInvoice({ legalName: e.target.value })}
                  />
                </label>
                <label className="admin-span">
                  Address
                  <textarea
                    rows={3}
                    value={invoiceDraft.address}
                    onChange={(e) => patchInvoice({ address: e.target.value })}
                  />
                </label>
                <label>
                  Tel
                  <input value={invoiceDraft.tel} onChange={(e) => patchInvoice({ tel: e.target.value })} />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={invoiceDraft.email || ''}
                    onChange={(e) => patchInvoice({ email: e.target.value })}
                    placeholder="accounts@…"
                  />
                </label>
                <label>
                  Website
                  <input
                    value={invoiceDraft.website || ''}
                    onChange={(e) => patchInvoice({ website: e.target.value })}
                    placeholder="www.…"
                  />
                </label>
                <label>
                  Terms
                  <input
                    value={invoiceDraft.terms}
                    onChange={(e) => patchInvoice({ terms: e.target.value })}
                  />
                </label>
                <label>
                  Currency
                  <input
                    value={invoiceDraft.currency}
                    onChange={(e) => patchInvoice({ currency: e.target.value })}
                  />
                </label>
                <label>
                  Invoice ID prefix
                  <input
                    value={invoiceDraft.invoiceIdPrefix}
                    onChange={(e) => patchInvoice({ invoiceIdPrefix: e.target.value })}
                  />
                </label>
                <label>
                  Pay days
                  <input
                    type="number"
                    min={1}
                    value={invoiceDraft.payDays}
                    onChange={(e) => patchInvoice({ payDays: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Fallback fee %
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={invoiceDraft.feePct}
                    onChange={(e) => patchInvoice({ feePct: Number(e.target.value) })}
                  />
                </label>
                <p className="muted tiny admin-span">
                  Used when an auction type or marketplace fee is not set. Prefer fee % on Auction types.
                </p>
                <label>
                  SWIFT
                  <input
                    value={invoiceDraft.swift}
                    onChange={(e) => patchInvoice({ swift: e.target.value })}
                  />
                </label>
                <label className="admin-span">
                  Bank name
                  <input
                    value={invoiceDraft.bankName}
                    onChange={(e) => patchInvoice({ bankName: e.target.value })}
                  />
                </label>
                <label>
                  Branch
                  <input
                    value={invoiceDraft.branchName}
                    onChange={(e) => patchInvoice({ branchName: e.target.value })}
                  />
                </label>
                <label className="admin-span">
                  Branch address
                  <input
                    value={invoiceDraft.branchAddress}
                    onChange={(e) => patchInvoice({ branchAddress: e.target.value })}
                  />
                </label>
                <label>
                  Account number
                  <input
                    value={invoiceDraft.accountNumber}
                    onChange={(e) => patchInvoice({ accountNumber: e.target.value })}
                  />
                </label>
                <label className="admin-span">
                  Beneficiary
                  <input
                    value={invoiceDraft.beneficiary}
                    onChange={(e) => patchInvoice({ beneficiary: e.target.value })}
                  />
                </label>
                <label className="admin-span">
                  Payment lead
                  <textarea
                    rows={2}
                    value={invoiceDraft.paymentLead}
                    onChange={(e) => patchInvoice({ paymentLead: e.target.value })}
                  />
                </label>
                <label>
                  Payment method
                  <input
                    value={invoiceDraft.paymentMethod}
                    onChange={(e) => patchInvoice({ paymentMethod: e.target.value })}
                  />
                </label>
                <label>
                  USDT network
                  <input
                    value={invoiceDraft.usdtNetwork || ''}
                    onChange={(e) => patchInvoice({ usdtNetwork: e.target.value })}
                    placeholder="TRC-20"
                  />
                </label>
                <label className="admin-span">
                  USDT wallet
                  <input
                    value={invoiceDraft.usdtWallet || ''}
                    onChange={(e) => patchInvoice({ usdtWallet: e.target.value })}
                    placeholder="Shown to buyers on pay dialog"
                  />
                </label>
                <label className="admin-span">
                  Bank fees note
                  <input
                    value={invoiceDraft.bankFeesNote}
                    onChange={(e) => patchInvoice({ bankFeesNote: e.target.value })}
                  />
                </label>
                <label className="admin-span">
                  Attach note
                  <input
                    value={invoiceDraft.attachNote}
                    onChange={(e) => patchInvoice({ attachNote: e.target.value })}
                  />
                </label>
                <label className="admin-span">
                  Fee calc note
                  <input
                    value={invoiceDraft.feeCalcNote}
                    onChange={(e) => patchInvoice({ feeCalcNote: e.target.value })}
                  />
                </label>
                <label className="admin-span">
                  Payment advance note
                  <input
                    value={invoiceDraft.paymentAdvanceNote}
                    onChange={(e) => patchInvoice({ paymentAdvanceNote: e.target.value })}
                  />
                </label>
                <label className="admin-span">
                  Fee remark
                  <input
                    value={invoiceDraft.feeRemark}
                    onChange={(e) => patchInvoice({ feeRemark: e.target.value })}
                  />
                </label>
                <label className="admin-span">
                  Payment notice
                  <input
                    value={invoiceDraft.paymentNotice}
                    onChange={(e) => patchInvoice({ paymentNotice: e.target.value })}
                  />
                </label>
              </div>
              <div className="invoice-profile-preview">
                <strong>Preview</strong>
                <p className="tiny">{invoiceDraft.paymentLead}</p>
                <p className="tiny">
                  Method: {invoiceDraft.paymentMethod} · SWIFT {invoiceDraft.swift}
                </p>
                <p className="tiny">
                  {invoiceDraft.bankName} · {invoiceDraft.branchName}
                </p>
                <p className="tiny">
                  Acct {invoiceDraft.accountNumber} · {invoiceDraft.beneficiary}
                </p>
                <p className="tiny">{invoiceDraft.bankFeesNote}</p>
                <p className="tiny">
                  {invoiceDraft.paymentAdvanceNote
                    .replace(/\{payDays\}/g, String(invoiceDraft.payDays))
                    .replace(/\{feePct\}/g, String(invoiceDraft.feePct))}
                </p>
                <p className="tiny">
                  {invoiceDraft.feeRemark
                    .replace(/\{payDays\}/g, String(invoiceDraft.payDays))
                    .replace(/\{feePct\}/g, String(invoiceDraft.feePct))}
                </p>
                <p className="tiny">{invoiceDraft.paymentNotice}</p>
              </div>
            </div>
            <fieldset className="admin-toggles">
              <legend>Pages</legend>
              <label>
                <input
                  type="checkbox"
                  checked={draft.showAuctions}
                  onChange={(e) => setDraft({ ...draft, showAuctions: e.target.checked })}
                />
                Auctions
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.showMarketplace}
                  onChange={(e) => setDraft({ ...draft, showMarketplace: e.target.checked })}
                />
                Marketplace
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.showStore ?? true}
                  onChange={(e) => setDraft({ ...draft, showStore: e.target.checked })}
                />
                Retail store
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.showCommunity ?? true}
                  onChange={(e) => setDraft({ ...draft, showCommunity: e.target.checked })}
                />
                Community (My Page)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.showFavourites}
                  onChange={(e) => setDraft({ ...draft, showFavourites: e.target.checked })}
                />
                Favourites
              </label>
            </fieldset>
            <fieldset className="admin-toggles">
              <legend>Filters clients see</legend>
              {(['maker', 'grade', 'capacity', 'origin'] as const).map((key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={draft.filters[key]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        filters: { ...draft.filters, [key]: e.target.checked },
                      })
                    }
                  />
                  {key[0].toUpperCase() + key.slice(1)}
                </label>
              ))}
            </fieldset>
            <button className="btn btn-primary btn-sm" type="submit">
              Save site
            </button>
          </form>
          {settingsMsg ? <p className="ok">{settingsMsg}</p> : null}
        </section>
      ) : null}

      {section === 'settings' && desk === 'appearance' ? (
        <section className="card admin-section">
          <h2>Look &amp; theme</h2>
          <p className="muted tiny" style={{ marginTop: 0 }}>
            Colors, type, and corner radius applied site-wide via CSS variables.
          </p>
          <form className="admin-form" onSubmit={(e) => onSaveSettings(e, 'keep')}>
            {(
              [
                ['navy', 'Primary'],
                ['navy2', 'Primary dark'],
                ['ink', 'Text'],
                ['muted', 'Muted text'],
                ['line', 'Lines'],
                ['bg', 'Background'],
                ['card', 'Cards'],
                ['win', 'Win / paid'],
                ['lose', 'Error / unpaid'],
                ['live', 'Brand teal / live'],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="color"
                  value={draft.theme[key]}
                  onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, [key]: e.target.value } })}
                />
              </label>
            ))}
            <label>
              Body font preset
              <select
                value={
                  BODY_FONT_PRESETS.find((p) => p.stack === draft.theme.font)?.id || 'custom'
                }
                onChange={(e) => {
                  const preset = BODY_FONT_PRESETS.find((p) => p.id === e.target.value)
                  if (!preset) return
                  setDraft({ ...draft, theme: { ...draft.theme, font: preset.stack } })
                }}
              >
                {BODY_FONT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">Custom stack…</option>
              </select>
            </label>
            <label className="admin-span">
              Body font stack
              <input
                value={draft.theme.font}
                onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, font: e.target.value } })}
              />
            </label>
            <label>
              Display font preset
              <select
                value={
                  DISPLAY_FONT_PRESETS.find((p) => {
                    if (p.id === 'match-body') {
                      return (
                        (draft.theme.displayFont || '') === draft.theme.font ||
                        draft.theme.displayFont === ''
                      )
                    }
                    return p.stack === (draft.theme.displayFont ?? DEFAULT_SETTINGS.theme.displayFont)
                  })?.id || 'custom'
                }
                onChange={(e) => {
                  const preset = DISPLAY_FONT_PRESETS.find((p) => p.id === e.target.value)
                  if (!preset) return
                  setDraft({
                    ...draft,
                    theme: {
                      ...draft.theme,
                      displayFont: preset.id === 'match-body' ? draft.theme.font : preset.stack,
                    },
                  })
                }}
              >
                {DISPLAY_FONT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">Custom stack…</option>
              </select>
            </label>
            <label className="admin-span">
              Display / heading font
              <input
                value={draft.theme.displayFont ?? DEFAULT_SETTINGS.theme.displayFont}
                onChange={(e) =>
                  setDraft({ ...draft, theme: { ...draft.theme, displayFont: e.target.value } })
                }
              />
            </label>
            <label>
              Corner radius
              <input
                value={draft.theme.radius}
                onChange={(e) => setDraft({ ...draft, theme: { ...draft.theme, radius: e.target.value } })}
              />
            </label>
            <label>
              Favourite icon
              <input
                value={draft.icons.favourite}
                onChange={(e) => setDraft({ ...draft, icons: { favourite: e.target.value } })}
              />
            </label>

            <p className="admin-form-legend">Typography (site-wide)</p>
            <p className="muted tiny admin-span" style={{ marginTop: -4 }}>
              Sizes, weights, line-height, letter-spacing, buttons, and links — CSS variables site-wide.
            </p>
            {(
              [
                ['fontSize', 'Body size (px)'],
                ['fontSizeTiny', 'Tiny / hints (px)'],
                ['fontSizeLabel', 'Label size (px)'],
                ['fontSizePrice', 'Price size (px)'],
                ['fontSizeH1', 'H1 size (px)'],
                ['fontSizeH2', 'H2 size (px)'],
                ['fontSizeButton', 'Button size (px)'],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <NumberField
                  min={10}
                  max={36}
                  step={1}
                  value={draft.theme[key] ?? DEFAULT_SETTINGS.theme[key]}
                  onCommit={(n) =>
                    setDraft({
                      ...draft,
                      theme: { ...draft.theme, [key]: Math.min(36, Math.max(10, Math.round(n))) },
                    })
                  }
                />
              </label>
            ))}
            {(
              [
                ['fontWeightBody', 'Body weight'],
                ['fontWeightBold', 'Bold weight'],
                ['fontWeightHeading', 'Heading weight'],
                ['fontWeightButton', 'Button weight'],
                ['fontWeightLink', 'Link weight'],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <select
                  value={String(draft.theme[key] ?? DEFAULT_SETTINGS.theme[key])}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      theme: { ...draft.theme, [key]: Number(e.target.value) },
                    })
                  }
                >
                  {[400, 500, 600, 650, 700].map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {(
              [
                ['lineHeight', 'Body line-height', 1.1, 2, 0.05],
                ['lineHeightTiny', 'Tiny line-height', 1.1, 2, 0.05],
                ['lineHeightHeading', 'Heading line-height', 1, 1.6, 0.05],
                ['letterSpacing', 'Body letter-spacing (em)', -0.05, 0.2, 0.01],
                ['letterSpacingLabel', 'Label letter-spacing (em)', 0, 0.2, 0.01],
              ] as const
            ).map(([key, label, min, max, step]) => (
              <label key={key}>
                {label}
                <NumberField
                  min={min}
                  max={max}
                  step={step}
                  value={draft.theme[key] ?? DEFAULT_SETTINGS.theme[key]}
                  onCommit={(n) =>
                    setDraft({
                      ...draft,
                      theme: {
                        ...draft.theme,
                        [key]: Math.min(max, Math.max(min, Math.round(n * 1000) / 1000)),
                      },
                    })
                  }
                />
              </label>
            ))}
            <label>
              Link underline
              <select
                value={draft.theme.linkUnderline ?? DEFAULT_SETTINGS.theme.linkUnderline}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    theme: {
                      ...draft.theme,
                      linkUnderline: e.target.value as 'none' | 'hover' | 'always',
                    },
                  })
                }
              >
                <option value="none">None</option>
                <option value="hover">On hover</option>
                <option value="always">Always</option>
              </select>
            </label>
            <div
              className="admin-span type-preview card"
              style={{
                padding: 12,
                marginBottom: 8,
                fontFamily: draft.theme.font,
                fontSize: `${draft.theme.fontSize ?? DEFAULT_SETTINGS.theme.fontSize}px`,
                fontWeight: draft.theme.fontWeightBody ?? DEFAULT_SETTINGS.theme.fontWeightBody,
                lineHeight: draft.theme.lineHeight ?? DEFAULT_SETTINGS.theme.lineHeight,
                letterSpacing: `${draft.theme.letterSpacing ?? DEFAULT_SETTINGS.theme.letterSpacing}em`,
              }}
            >
              <div
                className="label"
                style={{
                  fontSize: `${draft.theme.fontSizeLabel ?? DEFAULT_SETTINGS.theme.fontSizeLabel}px`,
                  letterSpacing: `${draft.theme.letterSpacingLabel ?? DEFAULT_SETTINGS.theme.letterSpacingLabel}em`,
                }}
              >
                Preview
              </div>
              <h2
                style={{
                  marginBottom: 6,
                  fontFamily: draft.theme.displayFont ?? DEFAULT_SETTINGS.theme.displayFont,
                  fontSize: `${draft.theme.fontSizeH2 ?? DEFAULT_SETTINGS.theme.fontSizeH2}px`,
                  fontWeight:
                    draft.theme.fontWeightHeading ?? DEFAULT_SETTINGS.theme.fontWeightHeading,
                  lineHeight:
                    draft.theme.lineHeightHeading ?? DEFAULT_SETTINGS.theme.lineHeightHeading,
                }}
              >
                Heading sample
              </h2>
              <p style={{ marginBottom: 4 }}>Body copy uses the body size and weight.</p>
              <p
                className="price"
                style={{
                  margin: '4px 0',
                  fontSize: `${draft.theme.fontSizePrice ?? DEFAULT_SETTINGS.theme.fontSizePrice}px`,
                  fontWeight: draft.theme.fontWeightBold ?? DEFAULT_SETTINGS.theme.fontWeightBold,
                }}
              >
                $128
              </p>
              <div
                className="muted bid-cost-hint"
                style={{
                  fontSize: `${draft.theme.fontSizeTiny ?? DEFAULT_SETTINGS.theme.fontSizeTiny}px`,
                  lineHeight: draft.theme.lineHeightTiny ?? DEFAULT_SETTINGS.theme.lineHeightTiny,
                }}
              >
                Buy est. $4,998.00 (incl. 2% fee) · Offer est. $4,998.00
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{
                    fontSize: `${draft.theme.fontSizeButton ?? DEFAULT_SETTINGS.theme.fontSizeButton}px`,
                    fontWeight:
                      draft.theme.fontWeightButton ?? DEFAULT_SETTINGS.theme.fontWeightButton,
                  }}
                >
                  Button
                </button>
                <a
                  href="#preview-link"
                  onClick={(e) => e.preventDefault()}
                  style={{
                    fontWeight: draft.theme.fontWeightLink ?? DEFAULT_SETTINGS.theme.fontWeightLink,
                    textDecoration:
                      (draft.theme.linkUnderline ?? DEFAULT_SETTINGS.theme.linkUnderline) === 'always'
                        ? 'underline'
                        : 'none',
                  }}
                >
                  Sample link
                </a>
              </div>
            </div>

            <button className="btn btn-primary btn-sm" type="submit">
              Save look
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() =>
                setDraft({
                  ...draft,
                  theme: { ...DEFAULT_SETTINGS.theme },
                  icons: { ...DEFAULT_SETTINGS.icons },
                })
              }
            >
              Reset to defaults
            </button>
          </form>
          {settingsMsg ? <p className="ok">{settingsMsg}</p> : null}
        </section>
      ) : null}

      {section === 'settings' && desk === 'guide' ? (
        <section className="card admin-section">
          <h2>Edit the whole app from here</h2>
          <p className="muted tiny" style={{ marginTop: 0 }}>
            Super Settings controls public text, look, features, and commerce rules. Open a desk below (or use
            the Settings sub-nav).
          </p>
          <div className="admin-form">
            <div className="invoice-profile-panel admin-span">
              <h3>Where to edit what</h3>
              <ul className="pub-help-list" style={{ margin: 0 }}>
                <li>
                  <strong>Site</strong> — brand name, logo, tagline, channel toggles, grades, clocks, invoice
                  letterhead
                </li>
                <li>
                  <strong>Footer</strong> — Verified, email, mobile, WeChat, D-U-N-S, social links
                </li>
                <li>
                  <strong>Pages</strong> — store &amp; wholesale heroes, workbench banners, how/trust strips,
                  login aside, buyers / sellers / support, copyright, hero auto-slide seconds
                </li>
                <li>
                  <strong>Look</strong> — colors, font, corner radius (live CSS theme)
                </li>
                <li>
                  <strong>Auction types</strong> — list names, fees, close minutes
                </li>
                <li>
                  <strong>Text</strong> — every button, nav label, warning, and confirmation popup string
                </li>
                <li>
                  <strong>Functions</strong> — turn bidding, cart, register, bots, notices, etc. on/off
                </li>
                <li>
                  <strong>Store</strong> (main Super nav) — retail products, multi photos, orders
                </li>
              </ul>
            </div>
            <p className="muted tiny admin-span">
              Tip: change copy → Save on that desk → hard-refresh the public page. Desk ops (Admin catalog /
              money) stay under Admin; Super owns site-wide brand and rules.
            </p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => go('settings', 'pages')}>
              Open Pages editor
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('settings', 'copy')}>
              Open Text editor
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('settings', 'appearance')}>
              Open Look editor
            </button>
          </div>
        </section>
      ) : null}

      {section === 'settings' && desk === 'pages' ? (
        <section className="card admin-section">
          <h2>Pages &amp; marketing copy</h2>
          <p className="muted tiny" style={{ marginTop: 0 }}>
            Store + wholesale heroes, workbench banners, hub strips, login aside, buyers / sellers / support.
            Body tips: use{' '}
            <code>Title|Detail</code> for steps, or <code>- item</code> for bullets.
          </p>
          <form className="admin-form" onSubmit={(e) => onSaveSettings(e, 'keep')}>
            <label>
              Hero auto-slide (seconds)
              <input
                type="number"
                min={5}
                value={pagesDraft.heroIntervalSec}
                onChange={(e) => patchPages({ heroIntervalSec: Number(e.target.value) || 30 })}
              />
            </label>
            <label className="admin-span">
              Footer copyright
              <input
                value={pagesDraft.footerCopyright}
                onChange={(e) => patchPages({ footerCopyright: e.target.value })}
              />
            </label>

            <div className="invoice-profile-panel admin-span">
              <h3>Login / register aside</h3>
              <div className="admin-form invoice-profile-fields">
                <label>
                  Brand line
                  <input
                    value={pagesDraft.authBrand}
                    onChange={(e) => patchPages({ authBrand: e.target.value })}
                  />
                </label>
                <label className="admin-span">
                  Title
                  <input
                    value={pagesDraft.authTitle}
                    onChange={(e) => patchPages({ authTitle: e.target.value })}
                  />
                </label>
                <label className="admin-span">
                  Lead
                  <textarea
                    rows={3}
                    value={pagesDraft.authLead}
                    onChange={(e) => patchPages({ authLead: e.target.value })}
                  />
                </label>
              </div>
            </div>

            <div className="invoice-profile-panel admin-span">
              <h3>Store hero slides</h3>
              {pagesDraft.storeHeroes.map((hero, i) => (
                <div key={i} className="admin-form invoice-profile-fields" style={{ marginBottom: 12 }}>
                  <p className="tiny muted admin-span" style={{ margin: 0 }}>
                    Slide {i + 1}
                  </p>
                  <label>
                    Kicker
                    <input value={hero.kicker} onChange={(e) => patchHero(i, { kicker: e.target.value })} />
                  </label>
                  <label>
                    CTA
                    <input value={hero.cta} onChange={(e) => patchHero(i, { cta: e.target.value })} />
                  </label>
                  <label className="admin-span">
                    Title
                    <input value={hero.title} onChange={(e) => patchHero(i, { title: e.target.value })} />
                  </label>
                  <label className="admin-span">
                    Body
                    <textarea
                      rows={2}
                      value={hero.body}
                      onChange={(e) => patchHero(i, { body: e.target.value })}
                    />
                  </label>
                  <label className="admin-span">
                    Image URL
                    <input
                      value={hero.imageUrl || ''}
                      onChange={(e) => patchHero(i, { imageUrl: e.target.value })}
                      placeholder="https://…"
                    />
                  </label>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  patchPages({
                    storeHeroes: [
                      ...pagesDraft.storeHeroes,
                      { kicker: '', title: '', body: '', cta: 'Shop', imageUrl: '' },
                    ],
                  })
                }
              >
                Add slide
              </button>
              {pagesDraft.storeHeroes.length > 1 ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    patchPages({ storeHeroes: pagesDraft.storeHeroes.slice(0, -1) })
                  }
                >
                  Remove last slide
                </button>
              ) : null}
            </div>

            <div className="invoice-profile-panel admin-span">
              <h3>Wholesale hero slides</h3>
              {pagesDraft.wholesaleHeroes.map((hero, i) => (
                <div key={i} className="admin-form invoice-profile-fields" style={{ marginBottom: 12 }}>
                  <p className="tiny muted admin-span" style={{ margin: 0 }}>
                    Slide {i + 1}
                  </p>
                  <label>
                    Kicker
                    <input
                      value={hero.kicker}
                      onChange={(e) => patchWholesaleHero(i, { kicker: e.target.value })}
                    />
                  </label>
                  <label>
                    CTA
                    <input
                      value={hero.cta}
                      onChange={(e) => patchWholesaleHero(i, { cta: e.target.value })}
                    />
                  </label>
                  <label>
                    Link path
                    <input
                      value={hero.to}
                      onChange={(e) => patchWholesaleHero(i, { to: e.target.value })}
                      placeholder="/wholesale"
                    />
                  </label>
                  <label className="admin-span">
                    Title
                    <input
                      value={hero.title}
                      onChange={(e) => patchWholesaleHero(i, { title: e.target.value })}
                    />
                  </label>
                  <label className="admin-span">
                    Body
                    <textarea
                      rows={2}
                      value={hero.body}
                      onChange={(e) => patchWholesaleHero(i, { body: e.target.value })}
                    />
                  </label>
                  <label className="admin-span">
                    Image URL
                    <input
                      value={hero.imageUrl || ''}
                      onChange={(e) => patchWholesaleHero(i, { imageUrl: e.target.value })}
                      placeholder="https://…"
                    />
                  </label>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  patchPages({
                    wholesaleHeroes: [
                      ...pagesDraft.wholesaleHeroes,
                      { kicker: '', title: '', body: '', cta: 'Enter', to: '/wholesale', imageUrl: '' },
                    ],
                  })
                }
              >
                Add wholesale slide
              </button>
              {pagesDraft.wholesaleHeroes.length > 1 ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    patchPages({ wholesaleHeroes: pagesDraft.wholesaleHeroes.slice(0, -1) })
                  }
                >
                  Remove last slide
                </button>
              ) : null}
            </div>

            <div className="invoice-profile-panel admin-span">
              <h3>Workbench banners</h3>
              <p className="tiny muted admin-span" style={{ margin: '0 0 10px' }}>
                Compact sliding strip on Auctions, Marketplace, My Page, Admin, and Super — same
                auto-slide seconds as store/wholesale heroes. Leave Image URL blank for the curated
                default.
              </p>
              {DESK_BANNER_KEYS.map((key) => {
                const slides = pagesDraft.deskBanners[key]
                return (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <p className="tiny muted admin-span" style={{ margin: '0 0 8px', fontWeight: 650 }}>
                      {DESK_BANNER_LABELS[key]}
                    </p>
                    {slides.map((slide, i) => (
                      <div
                        key={`${key}-${i}`}
                        className="admin-form invoice-profile-fields"
                        style={{ marginBottom: 12 }}
                      >
                        <p className="tiny muted admin-span" style={{ margin: 0 }}>
                          Slide {i + 1}
                        </p>
                        <label className="admin-span">
                          Title
                          <input
                            value={slide.title}
                            onChange={(e) =>
                              patchDeskBannerSlide(key, i, { title: e.target.value })
                            }
                          />
                        </label>
                        <label className="admin-span">
                          Body
                          <textarea
                            rows={2}
                            value={slide.body}
                            onChange={(e) =>
                              patchDeskBannerSlide(key, i, { body: e.target.value })
                            }
                          />
                        </label>
                        <label className="admin-span">
                          Image URL
                          <input
                            value={slide.imageUrl || ''}
                            onChange={(e) =>
                              patchDeskBannerSlide(key, i, { imageUrl: e.target.value })
                            }
                            placeholder="https://…"
                          />
                        </label>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => addDeskBannerSlide(key)}
                    >
                      Add {DESK_BANNER_LABELS[key]} slide
                    </button>
                    {slides.length > 1 ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeDeskBannerSlide(key)}
                      >
                        Remove last slide
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>

            <div className="invoice-profile-panel admin-span">
              <h3>Wholesale hub strips</h3>
              <label className="admin-span">
                SEO title <span className="tiny muted">use {'{brand}'}</span>
                <input
                  value={pagesDraft.wholesaleSeoTitle}
                  onChange={(e) => patchPages({ wholesaleSeoTitle: e.target.value })}
                />
              </label>
              <label className="admin-span">
                SEO description <span className="tiny muted">use {'{brand}'}</span>
                <textarea
                  rows={3}
                  value={pagesDraft.wholesaleSeoDescription}
                  onChange={(e) => patchPages({ wholesaleSeoDescription: e.target.value })}
                />
              </label>
              <label>
                Ending soon title
                <input
                  value={pagesDraft.wholesaleEndingSoonTitle}
                  onChange={(e) => patchPages({ wholesaleEndingSoonTitle: e.target.value })}
                />
              </label>
              <label>
                Ending soon · View all
                <input
                  value={pagesDraft.wholesaleEndingSoonViewAll}
                  onChange={(e) => patchPages({ wholesaleEndingSoonViewAll: e.target.value })}
                />
              </label>
              <label>
                Your desk label
                <input
                  value={pagesDraft.wholesaleMyDeskLabel}
                  onChange={(e) => patchPages({ wholesaleMyDeskLabel: e.target.value })}
                />
              </label>
              <label>
                Your desk · go
                <input
                  value={pagesDraft.wholesaleMyDeskGo}
                  onChange={(e) => patchPages({ wholesaleMyDeskGo: e.target.value })}
                />
              </label>
              <label>
                Header · Device
                <input
                  value={pagesDraft.wholesaleCatDeviceLabel}
                  onChange={(e) => patchPages({ wholesaleCatDeviceLabel: e.target.value })}
                />
              </label>
              <label>
                Header · Condition
                <input
                  value={pagesDraft.wholesaleCatConditionLabel}
                  onChange={(e) => patchPages({ wholesaleCatConditionLabel: e.target.value })}
                />
              </label>
              <label>
                Header · All
                <input
                  value={pagesDraft.wholesaleCatAllLabel}
                  onChange={(e) => patchPages({ wholesaleCatAllLabel: e.target.value })}
                />
              </label>
              <label className="admin-span">
                Empty hub message
                <input
                  value={pagesDraft.wholesaleEmptyHub}
                  onChange={(e) => patchPages({ wholesaleEmptyHub: e.target.value })}
                />
              </label>
              <label>
                Browse marketplace CTA
                <input
                  value={pagesDraft.wholesaleBrowseMarketCta}
                  onChange={(e) => patchPages({ wholesaleBrowseMarketCta: e.target.value })}
                />
              </label>
              <label>
                Open auctions CTA
                <input
                  value={pagesDraft.wholesaleOpenAuctionsCta}
                  onChange={(e) => patchPages({ wholesaleOpenAuctionsCta: e.target.value })}
                />
              </label>
              <label>
                View all auctions
                <input
                  value={pagesDraft.wholesaleViewAllAuctions}
                  onChange={(e) => patchPages({ wholesaleViewAllAuctions: e.target.value })}
                />
              </label>
              <label>
                View all marketplace
                <input
                  value={pagesDraft.wholesaleViewAllMarket}
                  onChange={(e) => patchPages({ wholesaleViewAllMarket: e.target.value })}
                />
              </label>
              <label className="admin-span">
                How-it-works title
                <input
                  value={pagesDraft.wholesaleHowTitle}
                  onChange={(e) => patchPages({ wholesaleHowTitle: e.target.value })}
                />
              </label>
              {pagesDraft.wholesaleHowSteps.map((step, i) => (
                <div key={`how-${i}`} className="admin-form invoice-profile-fields">
                  <label>
                    Step {i + 1} title
                    <input
                      value={step.title}
                      onChange={(e) => patchContentCard('wholesaleHowSteps', i, { title: e.target.value })}
                    />
                  </label>
                  <label className="admin-span">
                    Step body
                    <input
                      value={step.body}
                      onChange={(e) => patchContentCard('wholesaleHowSteps', i, { body: e.target.value })}
                    />
                  </label>
                </div>
              ))}
              {pagesDraft.wholesaleTrust.map((item, i) => (
                <div key={`trust-${i}`} className="admin-form invoice-profile-fields">
                  <label>
                    Trust {i + 1} title
                    <input
                      value={item.title}
                      onChange={(e) => patchContentCard('wholesaleTrust', i, { title: e.target.value })}
                    />
                  </label>
                  <label className="admin-span">
                    Trust body
                    <input
                      value={item.body}
                      onChange={(e) => patchContentCard('wholesaleTrust', i, { body: e.target.value })}
                    />
                  </label>
                </div>
              ))}
              <label>
                Deals section title
                <input
                  value={pagesDraft.wholesaleDealsTitle}
                  onChange={(e) => patchPages({ wholesaleDealsTitle: e.target.value })}
                />
              </label>
              <label>
                Brands section title
                <input
                  value={pagesDraft.wholesaleBrandsTitle}
                  onChange={(e) => patchPages({ wholesaleBrandsTitle: e.target.value })}
                />
              </label>
              <label className="admin-span">
                Empty deals message
                <input
                  value={pagesDraft.wholesaleEmptyDeals}
                  onChange={(e) => patchPages({ wholesaleEmptyDeals: e.target.value })}
                />
              </label>
              <label className="admin-span">
                Empty marketplace message
                <input
                  value={pagesDraft.wholesaleEmptyMarket}
                  onChange={(e) => patchPages({ wholesaleEmptyMarket: e.target.value })}
                />
              </label>
            </div>

            {(['buyers', 'sellers', 'support'] as const).map((key) => {
              const page = pagesDraft[key]
              const titles = { buyers: 'For buyers', sellers: 'For sellers', support: 'Support' }
              return (
                <div key={key} className="invoice-profile-panel admin-span">
                  <h3>{titles[key]}</h3>
                  <div className="admin-form invoice-profile-fields">
                    <label>
                      Kicker
                      <input
                        value={page.kicker}
                        onChange={(e) => patchMarketingPage(key, { kicker: e.target.value })}
                      />
                    </label>
                    <label>
                      Primary CTA
                      <input
                        value={page.primaryCta}
                        onChange={(e) => patchMarketingPage(key, { primaryCta: e.target.value })}
                      />
                    </label>
                    <label>
                      Secondary CTA
                      <input
                        value={page.secondaryCta}
                        onChange={(e) => patchMarketingPage(key, { secondaryCta: e.target.value })}
                      />
                    </label>
                    <label className="admin-span">
                      Title
                      <input
                        value={page.title}
                        onChange={(e) => patchMarketingPage(key, { title: e.target.value })}
                      />
                    </label>
                    <label className="admin-span">
                      Lead
                      <textarea
                        rows={2}
                        value={page.lead}
                        onChange={(e) => patchMarketingPage(key, { lead: e.target.value })}
                      />
                    </label>
                    <label className="admin-span">
                      Body
                      <textarea
                        rows={5}
                        value={page.body}
                        onChange={(e) => patchMarketingPage(key, { body: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
              )
            })}

            <button className="btn btn-primary btn-sm" type="submit">
              Save pages
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  pages: mergePagesDraft(DEFAULT_SETTINGS.pages),
                }))
              }
            >
              Reset to defaults
            </button>
          </form>
          {settingsMsg ? <p className="ok">{settingsMsg}</p> : null}
        </section>
      ) : null}

      {section === 'settings' && desk === 'contact' ? (
        <section className="card admin-section">
          <h2>Footer &amp; contact</h2>
          <p className="muted tiny" style={{ marginTop: 0 }}>
            Shown on the site-wide footer (store, auth, and desk). Verified text is shortened in the bar when
            long — hover shows the full line.
          </p>
          <form className="admin-form" onSubmit={(e) => onSaveSettings(e, 'keep')}>
            <label className="admin-span">
              Verified
              <input
                value={contactDraft.verifiedMember}
                onChange={(e) => patchContact({ verifiedMember: e.target.value })}
                placeholder="GsmExchange, ITAD, Kadorf & Other Leading B2B Networks"
              />
            </label>
            <label className="admin-span">
              Legal name
              <input
                value={contactDraft.legalName}
                onChange={(e) => patchContact({ legalName: e.target.value })}
              />
            </label>
            <label>
              Email (enquiry)
              <input
                type="email"
                value={contactDraft.emailEnquiry}
                onChange={(e) => patchContact({ emailEnquiry: e.target.value })}
              />
            </label>
            <label>
              Email (business)
              <input
                type="email"
                value={contactDraft.emailBusiness}
                onChange={(e) => patchContact({ emailBusiness: e.target.value })}
              />
            </label>
            <label>
              Mobile display
              <input
                value={contactDraft.phoneDisplay}
                onChange={(e) => patchContact({ phoneDisplay: e.target.value })}
                placeholder="+852 6156 1800"
              />
            </label>
            <label>
              Mobile tel link
              <input
                value={contactDraft.phone}
                onChange={(e) => patchContact({ phone: e.target.value })}
                placeholder="+85261561800"
              />
            </label>
            <label>
              WeChat
              <input
                value={contactDraft.wechatId}
                onChange={(e) => patchContact({ wechatId: e.target.value })}
              />
            </label>
            <label>
              D-U-N-S
              <input
                value={contactDraft.duns}
                onChange={(e) => patchContact({ duns: e.target.value })}
              />
            </label>
            <label>
              Web label
              <input
                value={contactDraft.webLabel}
                onChange={(e) => patchContact({ webLabel: e.target.value })}
              />
            </label>
            <label>
              Web URL
              <input
                value={contactDraft.webUrl}
                onChange={(e) => patchContact({ webUrl: e.target.value })}
              />
            </label>
            <label>
              LinkedIn handle
              <input
                value={contactDraft.linkedinHandle}
                onChange={(e) => patchContact({ linkedinHandle: e.target.value })}
              />
            </label>
            <label>
              LinkedIn URL
              <input
                value={contactDraft.linkedinUrl}
                onChange={(e) => patchContact({ linkedinUrl: e.target.value })}
              />
            </label>
            <label>
              WhatsApp number
              <input
                value={contactDraft.whatsapp}
                onChange={(e) => patchContact({ whatsapp: e.target.value })}
                placeholder="85261561800"
              />
            </label>
            <label>
              WhatsApp display
              <input
                value={contactDraft.whatsappDisplay}
                onChange={(e) => patchContact({ whatsappDisplay: e.target.value })}
              />
            </label>

            <div className="invoice-profile-panel admin-span">
              <h3>Social links</h3>
              <p className="muted tiny">Empty URL hides that icon in the footer.</p>
              <div className="admin-form invoice-profile-fields">
                {(Object.keys(SOCIAL_LABELS) as Array<keyof SiteContact['social']>).map((key) => (
                  <label key={key} className="admin-span">
                    {SOCIAL_LABELS[key]}
                    <input
                      value={contactDraft.social[key]}
                      onChange={(e) =>
                        patchContact({ social: { ...contactDraft.social, [key]: e.target.value } })
                      }
                      placeholder="https://…"
                    />
                  </label>
                ))}
              </div>
            </div>

            <button className="btn btn-primary btn-sm" type="submit">
              Save footer
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  contact: {
                    ...DEFAULT_SETTINGS.contact,
                    social: { ...DEFAULT_SETTINGS.contact.social },
                  },
                }))
              }
            >
              Reset to defaults
            </button>
          </form>
          {settingsMsg ? <p className="ok">{settingsMsg}</p> : null}
        </section>
      ) : null}

      {section === 'settings' && desk === 'copy' ? (
        <section className="card admin-section">
          <h2>Text, buttons &amp; warnings</h2>
          <form className="admin-form" onSubmit={(e) => onSaveSettings(e, 'keep')}>
            {(Object.keys(DEFAULT_SETTINGS.copy) as Array<keyof typeof DEFAULT_SETTINGS.copy>).map((key) => (
              <label key={key} className={draft.copy[key].length > 48 ? 'admin-span' : undefined}>
                {COPY_LABEL[key]}
                <input
                  value={draft.copy[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, copy: { ...draft.copy, [key]: e.target.value } })
                  }
                />
              </label>
            ))}
            <button className="btn btn-primary btn-sm" type="submit">
              Save text
            </button>
          </form>
          {settingsMsg ? <p className="ok">{settingsMsg}</p> : null}
        </section>
      ) : null}

      {section === 'settings' && desk === 'features' ? (
        <section className="card admin-section">
          <h2>Functions clients can use</h2>
          <form
            className="admin-form"
            onSubmit={(e) => onSaveSettings(e, 'keep')}
          >
            <fieldset className="admin-toggles">
              <legend>Client actions</legend>
              {(
                [
                  ['bidding', 'Bidding'],
                  ['takeAll', 'Take all'],
                  ['favourites', 'Favourites'],
                  ['cart', 'Marketplace cart'],
                  ['offers', 'Marketplace offers'],
                  ['register', 'Public sign-up'],
                  ['forgotPassword', 'Forgot-password popup'],
                  ['bots', 'Live bid bots (demo)'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={draft.features[key]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        features: { ...draft.features, [key]: e.target.checked } as FeatureFlags,
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <fieldset className="admin-toggles">
              <legend>Pop-ups before money / qty</legend>
              {(
                [
                  ['confirmBid', 'Confirm bid'],
                  ['confirmTakeAll', 'Confirm take all'],
                  ['confirmCart', 'Confirm add to cart'],
                  ['confirmCheckout', 'Confirm checkout'],
                  ['confirmPay', 'Confirm mark paid'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={draft.features[key]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        features: { ...draft.features, [key]: e.target.checked } as FeatureFlags,
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <fieldset className="admin-toggles">
              <legend>Warnings</legend>
              {(
                [
                  ['siteNotice', 'Site notice banner'],
                  ['endingSoon', 'Ending-soon warning'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={draft.features[key]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        features: { ...draft.features, [key]: e.target.checked } as FeatureFlags,
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <button className="btn btn-primary btn-sm" type="submit">
              Save functions
            </button>
          </form>
          {settingsMsg ? <p className="ok">{settingsMsg}</p> : null}
        </section>
      ) : null}

      {section === 'settings' && desk === 'types' ? (
        <section className="card admin-section">
          <h2>Auction types</h2>
          <p className="muted tiny">Each type is a list on Auctions. This is the only place to add or edit types.</p>
          <form className="admin-form" onSubmit={(e) => onSaveSettings(e, 'draft')}>
          <div className="type-manager admin-span">
            <p className="muted tiny">
              Live Auctions and Offline Auctions are the main lists. Optional fee % is charged on winning goods
              and shown to buyers before they bid. Default minutes apply when a closed list is published again.
            </p>
            <label style={{ maxWidth: 220, marginBottom: 12 }}>
              Marketplace fee %
              <NumberField
                min={0}
                step={0.1}
                value={draft.marketplaceFeePct ?? settings.invoice.feePct ?? 2}
                onCommit={(marketplaceFeePct) => setDraft({ ...draft, marketplaceFeePct })}
              />
            </label>
            <p className="muted tiny" style={{ marginTop: -6 }}>
              Applies to cart, buy-now, and offers. 0 = no marketplace fee.
            </p>
            <label style={{ maxWidth: 220, marginBottom: 12 }}>
              Offer floor % of list
              <NumberField
                min={0}
                max={100}
                step={1}
                value={draft.offerFloorPct ?? 30}
                onCommit={(offerFloorPct) =>
                  setDraft({ ...draft, offerFloorPct: Math.min(100, Math.max(0, offerFloorPct)) })
                }
              />
            </label>
            <p className="muted tiny" style={{ marginTop: -6 }}>
              Buyers can offer down to this % of list price (e.g. 30 → min is 30% of list). 0 = $1
              floor only.
            </p>
            <fieldset className="admin-span" style={{ margin: '16px 0', border: '1px solid var(--line)', padding: 12, borderRadius: 8 }}>
              <legend>
                <strong>Fulfillment</strong>
              </legend>
              <p className="muted tiny">
                Pickup, platform delivery, or buyer-owned FedEx / UPS / DHL accounts (wholesale).
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <p className="tiny">
                    <strong>Store modes</strong>
                  </p>
                  {(['pickup', 'delivery', 'buyer_courier'] as const).map((m) => (
                    <label key={`store-${m}`} className="check-inline" style={{ display: 'block' }}>
                      <input
                        type="checkbox"
                        checked={(draft.fulfillment?.storeModes || []).includes(m)}
                        onChange={(e) => {
                          const cur = draft.fulfillment || settings.fulfillment!
                          const storeModes = e.target.checked
                            ? [...new Set([...(cur.storeModes || []), m])]
                            : (cur.storeModes || []).filter((x) => x !== m)
                          setDraft({
                            ...draft,
                            fulfillment: { ...cur, storeModes },
                          })
                        }}
                      />
                      {m === 'pickup' ? 'Pickup' : m === 'delivery' ? 'Delivery' : 'Own courier'}
                    </label>
                  ))}
                </div>
                <div>
                  <p className="tiny">
                    <strong>Wholesale modes</strong>
                  </p>
                  {(['pickup', 'delivery', 'buyer_courier'] as const).map((m) => (
                    <label key={`ws-${m}`} className="check-inline" style={{ display: 'block' }}>
                      <input
                        type="checkbox"
                        checked={(draft.fulfillment?.wholesaleModes || []).includes(m)}
                        onChange={(e) => {
                          const cur = draft.fulfillment || settings.fulfillment!
                          const wholesaleModes = e.target.checked
                            ? [...new Set([...(cur.wholesaleModes || []), m])]
                            : (cur.wholesaleModes || []).filter((x) => x !== m)
                          setDraft({
                            ...draft,
                            fulfillment: { ...cur, wholesaleModes },
                          })
                        }}
                      />
                      {m === 'pickup' ? 'Pickup' : m === 'delivery' ? 'Delivery' : 'Own courier'}
                    </label>
                  ))}
                </div>
                <label style={{ maxWidth: 160 }}>
                  Delivery fee $
                  <NumberField
                    min={0}
                    step={0.1}
                    value={draft.fulfillment?.deliveryFeeFlat ?? 12}
                    onCommit={(deliveryFeeFlat) =>
                      setDraft({
                        ...draft,
                        fulfillment: {
                          ...(draft.fulfillment || settings.fulfillment!),
                          deliveryFeeFlat,
                        },
                      })
                    }
                  />
                </label>
                <label style={{ maxWidth: 160 }}>
                  Free over $
                  <NumberField
                    min={0}
                    step={1}
                    value={draft.fulfillment?.freeDeliveryMin ?? 200}
                    onCommit={(freeDeliveryMin) =>
                      setDraft({
                        ...draft,
                        fulfillment: {
                          ...(draft.fulfillment || settings.fulfillment!),
                          freeDeliveryMin,
                        },
                      })
                    }
                  />
                </label>
                <label style={{ maxWidth: 200 }}>
                  Who pays delivery
                  <select
                    value={draft.fulfillment?.deliveryPayer || 'buyer'}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        fulfillment: {
                          ...(draft.fulfillment || settings.fulfillment!),
                          deliveryPayer: e.target.value as
                            | 'buyer'
                            | 'seller'
                            | 'platform'
                            | 'admin_decide',
                        },
                      })
                    }
                  >
                    <option value="buyer">Buyer</option>
                    <option value="seller">Seller</option>
                    <option value="platform">Platform</option>
                    <option value="admin_decide">Staff decide</option>
                  </select>
                </label>
                <label style={{ minWidth: 200 }}>
                  Pickup label
                  <input
                    value={draft.fulfillment?.pickupLabel || ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        fulfillment: {
                          ...(draft.fulfillment || settings.fulfillment!),
                          pickupLabel: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label style={{ minWidth: 200 }}>
                  Pickup hours
                  <input
                    value={draft.fulfillment?.pickupHours || ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        fulfillment: {
                          ...(draft.fulfillment || settings.fulfillment!),
                          pickupHours: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label style={{ minWidth: 280 }}>
                  Pickup slots (comma-separated)
                  <input
                    value={(draft.fulfillment?.pickupSlots || []).join(', ')}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        fulfillment: {
                          ...(draft.fulfillment || settings.fulfillment!),
                          pickupSlots: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      })
                    }
                    placeholder="10:00-12:00, 12:00-14:00"
                  />
                </label>
                <label style={{ maxWidth: 140 }}>
                  Lead days
                  <NumberField
                    min={0}
                    max={14}
                    value={draft.fulfillment?.pickupLeadDays ?? 0}
                    onCommit={(pickupLeadDays) =>
                      setDraft({
                        ...draft,
                        fulfillment: {
                          ...(draft.fulfillment || settings.fulfillment!),
                          pickupLeadDays,
                        },
                      })
                    }
                  />
                </label>
                <label style={{ maxWidth: 160 }}>
                  Max / slot (0=∞)
                  <NumberField
                    min={0}
                    max={200}
                    value={draft.fulfillment?.pickupSlotCap ?? 8}
                    onCommit={(pickupSlotCap) =>
                      setDraft({
                        ...draft,
                        fulfillment: {
                          ...(draft.fulfillment || settings.fulfillment!),
                          pickupSlotCap,
                        },
                      })
                    }
                  />
                </label>
              </div>
            </fieldset>
            <div className="type-rows">
              {draft.auctionTypes.map((t, i) => {
                const inUse = lots.some((l) => l.channel === 'auction' && (l.auctionType || 'live') === t.value)
                return (
                  <div className="type-row" key={t.value}>
                    <label>
                      List id
                      <input value={t.value} readOnly title="Id is the URL slug and cannot change after create" />
                    </label>
                    <label>
                      Label
                      <input
                        value={t.label}
                        onChange={(e) => {
                          const auctionTypes = draft.auctionTypes.map((row, idx) =>
                            idx === i ? { ...row, label: e.target.value } : row,
                          )
                          setDraft({ ...draft, auctionTypes })
                        }}
                      />
                    </label>
                    <label>
                      Live close (min)
                      <input
                        type="number"
                        min={1}
                        value={t.closeMinutes || 240}
                        onChange={(e) => {
                          const mins = Math.max(1, Math.floor(Number(e.target.value) || 1))
                          const auctionTypes = draft.auctionTypes.map((row, idx) =>
                            idx === i ? { ...row, closeMinutes: mins } : row,
                          )
                          setDraft({ ...draft, auctionTypes })
                        }}
                      />
                    </label>
                    <label>
                      Extra sealed (min)
                      <NumberField
                        min={0}
                        value={t.extraSealedMinutes || 0}
                        onCommit={(mins) => {
                          const auctionTypes = draft.auctionTypes.map((row, idx) =>
                            idx === i
                              ? { ...row, extraSealedMinutes: mins || undefined }
                              : row,
                          )
                          setDraft({ ...draft, auctionTypes })
                        }}
                      />
                    </label>
                    <div>
                      <span className="muted tiny">Live clock</span>
                      <div className="type-row-actions">
                        {t.closesAt && t.closesAt > now ? (
                          <TimeLeft endsAt={t.closesAt} closedLabel="Closed" />
                        ) : t.closesAt && (t.extraSealedMinutes || 0) > 0 ? (
                          <span className="pill pill-sealed">Extra sealed</span>
                        ) : (
                          <span className="muted tiny">Closed</span>
                        )}
                        {(t.extraSealedMinutes || 0) > 0 && t.closesAt ? (
                          <span className="muted tiny">
                            +{t.extraSealedMinutes}m sealed
                            {t.closesAt <= now && t.closesAt + t.extraSealedMinutes! * 60 * 1000 > now ? (
                              <>
                                {' '}
                                · <TimeLeft endsAt={t.closesAt + t.extraSealedMinutes! * 60 * 1000} closedLabel="Done" />
                              </>
                            ) : null}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            const mins = Math.max(1, t.closeMinutes || 240)
                            const auctionTypes = draft.auctionTypes.map((row, idx) =>
                              idx === i
                                ? { ...row, closeMinutes: mins, closesAt: Date.now() + mins * 60 * 1000 }
                                : row,
                            )
                            setDraft({ ...draft, auctionTypes })
                          }}
                        >
                          Start clock now
                        </button>
                      </div>
                    </div>
                    <label>
                      Fill mode
                      <select
                        value={t.fillMode || 'live'}
                        onChange={(e) => {
                          const fillMode = e.target.value as AuctionFillMode
                          const auctionTypes = draft.auctionTypes.map((row, idx) =>
                            idx === i ? { ...row, fillMode } : row,
                          )
                          setDraft({ ...draft, auctionTypes })
                        }}
                      >
                        <option value="live">Live fill</option>
                        <option value="sealed">Sealed (hidden fill)</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </label>
                    <label>
                      Fee %
                      <NumberField
                        min={0}
                        step={0.1}
                        value={t.feePct ?? settings.invoice.feePct ?? 2}
                        onCommit={(fee) => {
                          const auctionTypes = draft.auctionTypes.map((row, idx) =>
                            idx === i ? { ...row, feePct: fee } : row,
                          )
                          setDraft({ ...draft, auctionTypes })
                        }}
                      />
                    </label>
                    <div className="type-row-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={i === 0}
                        onClick={() => {
                          const auctionTypes = [...draft.auctionTypes]
                          ;[auctionTypes[i - 1], auctionTypes[i]] = [auctionTypes[i], auctionTypes[i - 1]]
                          setDraft({ ...draft, auctionTypes })
                        }}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={i === draft.auctionTypes.length - 1}
                        onClick={() => {
                          const auctionTypes = [...draft.auctionTypes]
                          ;[auctionTypes[i + 1], auctionTypes[i]] = [auctionTypes[i], auctionTypes[i + 1]]
                          setDraft({ ...draft, auctionTypes })
                        }}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={draft.auctionTypes.length < 2 || inUse}
                        title={inUse ? 'Lots still use this type' : 'Remove type'}
                        onClick={() => {
                          if (draft.auctionTypes.length < 2 || inUse) return
                          setDraft({
                            ...draft,
                            auctionTypes: draft.auctionTypes.filter((_, idx) => idx !== i),
                          })
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    <label className="admin-span">
                      List intro
                      <input
                        value={t.intro || ''}
                        placeholder="Shown under the list title"
                        onChange={(e) => {
                          const auctionTypes = draft.auctionTypes.map((row, idx) =>
                            idx === i ? { ...row, intro: e.target.value } : row,
                          )
                          setDraft({ ...draft, auctionTypes })
                        }}
                      />
                    </label>
                  </div>
                )
              })}
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddTypeOpen(true)}>
              Add auction type
            </button>
          </div>
            <button className="btn btn-primary btn-sm" type="submit">Save types</button>
          </form>
          {settingsMsg ? <p className="ok">{settingsMsg}</p> : null}
        </section>
      ) : null}

      {addTypeOpen ? (
        <AddAuctionTypeDialog
          existing={settings.auctionTypes.map((t) => t.value)}
          onClose={() => setAddTypeOpen(false)}
          onCreate={publishAuctionType}
        />
      ) : null}
    </OpsShell>
  )
}
