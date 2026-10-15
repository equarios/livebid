/** Slug for a catalog list, e.g. live, sealed, dutch. Super admin can add more. */
export type AuctionType = string
/** How bids fill and what other buyers see. Custom types pick one of these engines. */
export type AuctionFillMode = 'live' | 'sealed' | 'hybrid'

export type AuctionTypeDef = {
  value: AuctionType
  label: string
  fillMode: AuctionFillMode
  intro?: string
  /** Shared close clock for every lot on this list (end of open / live phase). */
  closesAt?: number
  /** Used when closesAt is not set yet. */
  closeMinutes?: number
  /**
   * After the live clock, prior bidders only get this many more minutes (sealed).
   * 0 / unset = no Extra sealed phase.
   */
  extraSealedMinutes?: number
  /**
   * Optional system / auction fee % on winning goods for this list.
   * 0 = no fee. Undefined falls back to invoice.feePct.
   */
  feePct?: number
}

export type Channel = 'auction' | 'marketplace'
export type Grade = string

export type ThemeSettings = {
  navy: string
  navy2: string
  ink: string
  muted: string
  line: string
  bg: string
  card: string
  win: string
  lose: string
  live: string
  font: string
  /** Headings / display stack (CSS --display). */
  displayFont: string
  radius: string
  /** Base body size in px. */
  fontSize: number
  fontSizeTiny: number
  fontSizeLabel: number
  fontSizePrice: number
  fontSizeH1: number
  fontSizeH2: number
  fontWeightBody: number
  fontWeightBold: number
  fontWeightHeading: number
  /** Unitless line-heights. */
  lineHeight: number
  lineHeightTiny: number
  lineHeightHeading: number
  /** Letter-spacing in em. */
  letterSpacing: number
  letterSpacingLabel: number
  fontSizeButton: number
  fontWeightButton: number
  fontWeightLink: number
  /** Link underline: none | hover | always */
  linkUnderline: 'none' | 'hover' | 'always'
}

export type FeatureFlags = {
  bidding: boolean
  takeAll: boolean
  favourites: boolean
  confirmBid: boolean
  confirmTakeAll: boolean
  confirmCart: boolean
  confirmCheckout: boolean
  confirmPay: boolean
  cart: boolean
  offers: boolean
  bots: boolean
  register: boolean
  forgotPassword: boolean
  siteNotice: boolean
  endingSoon: boolean
}

export type CopySettings = {
  navAuctions: string
  navStore: string
  navFavourites: string
  navInvoices: string
  navAccount: string
  navAdmin: string
  navSuper: string
  navWholesale: string
  navBuyers: string
  navSellers: string
  navSupport: string
  navApply: string
  navApplyWholesale: string
  navOrders: string
  navCart: string
  navMenu: string
  navHelp: string
  navNotifications: string
  navTutorial: string
  navContact: string
  navLanguage: string
  searchGeneric: string
  ariaSearch: string
  ariaSubmitSearch: string
  footerVerified: string
  footerEmail: string
  footerMobile: string
  footerSocial: string
  footerNav: string
  signOut: string
  signInTitle: string
  signInButton: string
  signUpTitle: string
  signUpIntro: string
  signUpButton: string
  pendingApproval: string
  auctionsTitle: string
  auctionsIntro: string
  marketTitle: string
  marketIntro: string
  favouritesTitle: string
  favouritesIntro: string
  invoicesTitle: string
  invoicesIntro: string
  accountTitle: string
  accountIntro: string
  searchAuctions: string
  searchMarket: string
  emptyFilters: string
  emptyFavourites: string
  emptyCart: string
  emptyInvoices: string
  btnBid: string
  btnTakeAll: string
  btnAddCart: string
  btnBuy: string
  btnOffer: string
  btnCheckout: string
  btnPay: string
  btnAccept: string
  btnDecline: string
  btnResubmitPay: string
  btnRemove: string
  btnPhotos: string
  btnForgot: string
  btnConfirm: string
  btnCancel: string
  confirmBidTitle: string
  confirmBidBody: string
  confirmTakeAllTitle: string
  confirmTakeAllBody: string
  confirmCartTitle: string
  confirmCartBody: string
  confirmOfferTitle: string
  confirmOfferBody: string
  confirmAcceptOfferTitle: string
  confirmAcceptOfferBody: string
  confirmCheckoutTitle: string
  confirmCheckoutBody: string
  confirmAcceptCartTitle: string
  confirmAcceptCartBody: string
  confirmPayTitle: string
  confirmPayBody: string
  payAckLabel: string
  receiptLabel: string
  payWaiting: string
  payNeedAdmin: string
  payNeedSuper: string
  payDeclinedNote: string
  confirmForgotTitle: string
  confirmForgotBody: string
  favAdd: string
  favRemove: string
  closed: string
  noMoq: string
  cartTitle: string
  emptyMarket: string
  siteNotice: string
  endingSoon: string
  okAddedCart: string
  okOffer: string
  okOfferInvoiced: string
  okCheckout: string
  okBid: string
  okPaid: string
  okPaySubmitted: string
  warnReceipt: string
  warnPayAck: string
  warnMoq: string
  warnQty: string
  warnOverQty: string
  warnMinPrice: string
  warnOwnBidLower: string
  warnStartPrice: string
  warnNoBid: string
  warnPending: string
  warnDisabled: string
  warnClosed: string
  warnCart: string
  warnOffers: string
  warnOfferPrice: string
  warnOfferOpen: string
  warnLogin: string
  warnRegister: string
  warnAccountTaken: string
  warnLotMissing: string
  warnListingGone: string
}

export type IconSettings = {
  favourite: string
}

export type InvoiceProfile = {
  legalName: string
  address: string
  tel: string
  /** Seller contact email on letterhead. */
  email: string
  /** Optional website on letterhead. */
  website?: string
  terms: string
  payDays: number
  feePct: number
  swift: string
  bankName: string
  branchName: string
  branchAddress: string
  accountNumber: string
  beneficiary: string
  /** Remittance box intro. */
  paymentLead: string
  paymentMethod: string
  /** Optional USDT wallet shown on wholesale pay dialog. */
  usdtWallet?: string
  /** e.g. TRC-20 / ERC-20 */
  usdtNetwork?: string
  bankFeesNote: string
  attachNote: string
  /** Shown under totals when fee applies. Supports {feePct}. */
  feeCalcNote: string
  /** Supports {payDays}. */
  paymentAdvanceNote: string
  /** Supports {feePct}. */
  feeRemark: string
  paymentNotice: string
  /** e.g. USD — printed after amounts. */
  currency: string
  /** Suggested invoice id prefix, e.g. HYB. */
  invoiceIdPrefix: string
}

/** Public site footer / contact strip (seeded from company email signature). */
export type SiteContact = {
  legalName: string
  verifiedMember: string
  webLabel: string
  webUrl: string
  emailBusiness: string
  emailEnquiry: string
  phone: string
  phoneDisplay: string
  wechatId: string
  linkedinHandle: string
  linkedinUrl: string
  whatsapp: string
  whatsappDisplay: string
  duns: string
  social: {
    facebook: string
    x: string
    instagram: string
    whatsapp: string
    linkedin: string
    google: string
  }
}

/** One store homepage hero slide. */
export type StoreHeroSlide = {
  kicker: string
  title: string
  body: string
  cta: string
  /** Full-bleed hero photo URL. */
  imageUrl?: string
}

/** Wholesale hub hero slide (CTA path e.g. /auctions). */
export type WholesaleHeroSlide = {
  kicker: string
  title: string
  body: string
  cta: string
  to: string
  /** Full-bleed hero photo URL. */
  imageUrl?: string
}

export type ContentCard = {
  title: string
  body: string
}

/** One slide in a compact workbench banner. */
export type DeskBannerSlide = {
  title: string
  body: string
  /** Background photo URL — empty uses curated default for that desk. */
  imageUrl?: string
}

/** @deprecated use DeskBannerSlide — kept for merge of older single-object saves. */
export type DeskBannerCopy = DeskBannerSlide

export type DeskBannerKey = 'auctions' | 'marketplace' | 'myPage' | 'admin' | 'super'

/** Per-desk slide lists (crossfade like store/wholesale heroes). */
export type DeskBanners = Record<DeskBannerKey, DeskBannerSlide[]>

/**
 * Marketing / auth page copy editable from Super.
 * Body lines: use `Title|Detail` for stepped lists, `- item` for bullets, else paragraphs.
 */
export type MarketingPageCopy = {
  kicker: string
  title: string
  lead: string
  body: string
  primaryCta: string
  secondaryCta: string
}

/** Editable page surfaces that were previously hardcoded in the UI. */
export type SitePages = {
  footerCopyright: string
  authBrand: string
  authTitle: string
  authLead: string
  /** Hero auto-advance seconds (store + wholesale). Min 5. */
  heroIntervalSec: number
  storeHeroes: StoreHeroSlide[]
  wholesaleHeroes: WholesaleHeroSlide[]
  /** Compact lander-style banners on signed-in desks. */
  deskBanners: DeskBanners
  wholesaleHowTitle: string
  wholesaleHowSteps: ContentCard[]
  wholesaleTrust: ContentCard[]
  wholesaleDealsTitle: string
  wholesaleBrandsTitle: string
  wholesaleEmptyDeals: string
  wholesaleEmptyMarket: string
  /** Use `{brand}` for the site brand name. */
  wholesaleSeoTitle: string
  /** Use `{brand}` for the site brand name. */
  wholesaleSeoDescription: string
  wholesaleEndingSoonTitle: string
  wholesaleEndingSoonViewAll: string
  wholesaleMyDeskLabel: string
  wholesaleMyDeskGo: string
  wholesaleCatDeviceLabel: string
  wholesaleCatConditionLabel: string
  wholesaleCatAllLabel: string
  wholesaleEmptyHub: string
  wholesaleBrowseMarketCta: string
  wholesaleOpenAuctionsCta: string
  wholesaleViewAllAuctions: string
  wholesaleViewAllMarket: string
  buyers: MarketingPageCopy
  sellers: MarketingPageCopy
  support: MarketingPageCopy
}

export type SiteSettings = {
  brandName: string
  brandMark: string
  brandLogo: string
  tagline: string
  marketplaceLabel: string
  storeLabel: string
  showAuctions: boolean
  showMarketplace: boolean
  showStore: boolean
  /** Community under My Page — wholesale buyers + staff/sellers only. */
  showCommunity: boolean
  showFavourites: boolean
  filters: {
    type: boolean
    maker: boolean
    grade: boolean
    capacity: boolean
    origin: boolean
    price: boolean
  }
  grades: Grade[]
  auctionTypes: AuctionTypeDef[]
  /**
   * Fee % on marketplace cart / buy-now / offer goods.
   * 0 = no fee. Undefined falls back to invoice.feePct.
   */
  marketplaceFeePct?: number
  /**
   * Lowest marketplace offer as % of list price (Super-editable).
   * Default 30. 0 = $1 floor only.
   */
  offerFloorPct?: number
  /** Pickup / delivery / buyer-owned courier policy (Super). */
  fulfillment?: FulfillmentSettings
  defaultMoq: number
  reopenHours: number
  extendHours: number
  /** Listing / reopen length. Minimum 1 minute. */
  reopenMinutes?: number
  /** Extra time when extending a live lot. Minimum 1 minute. */
  extendMinutes?: number
  endingSoonMinutes: number
  theme: ThemeSettings
  features: FeatureFlags
  copy: CopySettings
  icons: IconSettings
  invoice: InvoiceProfile
  contact: SiteContact
  pages: SitePages
}

export type Lot = {
  id: string
  channel: Channel
  auctionType?: AuctionType
  manufacturer: string
  model: string
  /** Country / region SKU — same marketing model can have different numbers. */
  modelNumber: string
  capacity: string
  color: string
  grade: Grade
  battery: number
  qty: number
  /** Minimum order qty. Omit or 1 = no MOQ (clients can take 1 pc). */
  moq?: number
  startPrice: number
  currentPrice: number
  buyNowPrice?: number
  bidCount: number
  endsAt: number
  /** Final close when Extra sealed is enabled; after endsAt only prior bidders may see/bid. */
  extraSealedEndsAt?: number
  description: string
  accent: string
  operator?: string
  simLocked?: boolean
  activationLocked?: boolean
  /** Market / ship-from region for international catalogs. */
  origin?: string
  /** SEO / filter taxonomy — optional; inferred from model text when omitted. */
  deviceClass?: string
  /** new | used | refurbished | recycled | scrap — separate from cosmetic grade. */
  condition?: string
  /** ios | android | other-os */
  osFamily?: string
}

/** Master device record. Auction lots copy specs from here; listing only needs qty and price. */
export type InventorySku = {
  id: string
  manufacturer: string
  model: string
  modelNumber: string
  capacity: string
  color: string
  grade: Grade
  battery: number
  origin: string
  operator?: string
  simLocked?: boolean
  activationLocked?: boolean
  description: string
  defaultMoq?: number
  lastPrice?: number
  /** Warehouse stock (pcs on hand). */
  onHand?: number
}

export type ListingDropStatus = 'pending' | 'approved' | 'declined'

/** Admin-built lots waiting Super confirmation. Clock starts on approve. */
export type ListingDropItem = Lot & {
  durationMins: number
  /** Optional Extra sealed overtime for this item’s list when the drop starts a new clock. */
  extraSealedMinutes?: number
}

export type ListingDrop = {
  id: string
  submittedAt: number
  submittedBy: string
  status: ListingDropStatus
  reviewedAt?: number
  reviewedBy?: string
  items: ListingDropItem[]
}

export type Bid = {
  lotId: string
  accountId: string
  amount: number
  qty: number
  at: number
}

export type InvoiceStatus = 'draft' | 'unpaid' | 'pending_review' | 'paid' | 'declined'
export type WholesalePayMethod = 'bank' | 'usdt' | 'cash'
export type PayDecision = 'accepted' | 'declined'
export type PayReviewSide = 'admin' | 'super'

export type PayReview = {
  decision: PayDecision
  by: string
  at: number
}

export type InvoiceLine = {
  /** Catalog lot id, or CUSTOM / blank for a freeform row. */
  lotId: string
  qty: number
  unitPrice: number
  boxNo?: string
  /** Overrides catalog description on the printed invoice. */
  description?: string
  /** e.g. Unlocked / Locked */
  sim?: string
  grade?: string
}

export type Invoice = {
  id: string
  lotId: string
  channel: Channel
  amount: number
  qty: number
  unitPrice: number
  lines?: InvoiceLine[]
  /** 0 or omitted = no auction / system fee. Admin sets this per invoice. */
  feePct?: number
  status: InvoiceStatus
  createdAt: number
  accountId?: string
  receiptName?: string
  receiptData?: string
  /** How the buyer intends to pay (bank / USDT / cash). */
  payMethod?: WholesalePayMethod
  /** Optional USDT TX hash or bank remittance ref. */
  payRef?: string
  paidDeclaredAt?: number
  adminReview?: PayReview
  superReview?: PayReview
  issueAdmin?: PayReview
  issueSuper?: PayReview
  issuedAt?: number
  trackingNo?: string
  shippedAt?: number
  remarks?: string
  poNumber?: string
  opened?: boolean
  auctionLabel?: string
  /** Per-invoice Incoterms; falls back to Super profile. */
  terms?: string
  shipCompany?: string
  shipAddress?: string
  shipEmail?: string
  shipPhone?: string
  shipAttn?: string
  billCompany?: string
  billAddress?: string
  billEmail?: string
  billPhone?: string
  billAttn?: string
  /** pickup | delivery | buyer_courier */
  fulfillmentMode?: FulfillmentMode
  courierCarrier?: string
  courierAccount?: string
  shippingFee?: number
  /** False when delivery fee is TBD (staff must quote). */
  shippingFeeQuoted?: boolean
  shippingPayer?: ShippingPayer
  /** Staff: goods ready for pickup / buyer courier collect */
  readyForCollect?: boolean
  /** Buyer pickup appointment YYYY-MM-DD */
  pickupDate?: string
  /** e.g. 10:00-12:00 */
  pickupSlot?: string
  /** Separate unpaid freight invoice created after TBD quote. */
  shippingAddendum?: boolean
  parentInvoiceId?: string
  shippingAddendumId?: string
}

export type FulfillmentMode = 'pickup' | 'delivery' | 'buyer_courier'
export type ShippingPayer = 'buyer' | 'seller' | 'platform' | 'admin_decide'

export type FulfillmentSettings = {
  storeModes: FulfillmentMode[]
  wholesaleModes: FulfillmentMode[]
  defaultStoreMode: FulfillmentMode
  defaultWholesaleMode: FulfillmentMode
  deliveryFeeFlat: number
  freeDeliveryMin: number
  deliveryPayer: ShippingPayer
  pickupLabel: string
  pickupHours: string
  courierHints: string
  pickupSlots: string[]
  pickupLeadDays: number
  /** Max collects per date+slot. 0 = unlimited. */
  pickupSlotCap: number
}

export type NoticeKind =
  | 'win'
  | 'invoice'
  | 'outbid'
  | 'closing'
  | 'thanks'
  | 'fill'
  | 'offer'
  | 'cart'
  | 'payment'
  | 'shipping'
  | 'auth'
  | 'watch'
  | 'digest'
  | 'sealed'

export type EmailPrefs = {
  win: boolean
  offer: boolean
  cart: boolean
  invoice: boolean
  payment: boolean
  shipping: boolean
  auth: boolean
  outbid: boolean
  closing: boolean
  thanks: boolean
  fill: boolean
  /** Saved category filter matches a new open lot. */
  watch: boolean
  /** Once-daily desk summary (outbid · invoices · watch hits). */
  digest: boolean
  /** Extra sealed overtime started on a lot you already bid. */
  sealed: boolean
}

export type MarketOfferStatus = 'pending' | 'accepted' | 'declined' | 'confirmed' | 'cancelled'

export type MarketOffer = {
  id: string
  lotId: string
  accountId: string
  qty: number
  unitPrice: number
  listedPrice: number
  status: MarketOfferStatus
  createdAt: number
  reviewedAt?: number
  reviewedBy?: string
}

export type CartOrderStatus = 'pending' | 'accepted' | 'declined' | 'confirmed' | 'cancelled'

export type CartOrderLine = {
  lotId: string
  qty: number
  unitPrice: number
}

export type CartOrder = {
  id: string
  accountId: string
  lines: CartOrderLine[]
  status: CartOrderStatus
  createdAt: number
  reviewedAt?: number
  reviewedBy?: string
}

export type Notice = {
  id: string
  accountId: string
  kind: NoticeKind
  title: string
  body: string
  href: string
  at: number
  read?: boolean
}

export type CartItem = {
  lotId: string
  qty: number
}

export type AccountRole = 'superadmin' | 'admin' | 'member'
export type AccountStatus = 'pending' | 'active' | 'disabled'
export type WholesaleStatus =
  | 'none'
  | 'submitted'
  | 'needs_docs'
  | 'under_review'
  | 'approved'
  | 'rejected'

export type Account = {
  accountId: string
  password: string
  company: string
  email: string
  firstName?: string
  lastName?: string
  address?: string
  phone?: string
  /** Printed Buyer # on invoices; derived from accountId when omitted. */
  buyerNumber?: string
  /** Default pickup / delivery / own courier for wholesale. */
  preferredFulfillmentMode?: FulfillmentMode
  courierCarrier?: string
  courierAccount?: string
  role: AccountRole
  status: AccountStatus
  emailVerified?: boolean
  wholesaleStatus?: WholesaleStatus
}

export type User = {
  accountId: string
  company: string
  email: string
  firstName?: string
  lastName?: string
  role: AccountRole
  status: AccountStatus
  emailVerified?: boolean
  wholesaleStatus?: WholesaleStatus
}

export type RegisterInput = {
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
}
