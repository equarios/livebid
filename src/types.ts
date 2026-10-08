/** Slug for a catalog list, e.g. live, sealed, dutch. Super admin can add more. */
export type AuctionType = string
/** How bids fill and what other buyers see. Custom types pick one of these engines. */
export type AuctionFillMode = 'live' | 'sealed' | 'hybrid'

export type AuctionTypeDef = {
  value: AuctionType
  label: string
  fillMode: AuctionFillMode
  intro?: string
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
  radius: string
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
  bots: boolean
  register: boolean
  forgotPassword: boolean
  siteNotice: boolean
  endingSoon: boolean
}

export type CopySettings = {
  navAuctions: string
  navFavourites: string
  navInvoices: string
  navAccount: string
  navAdmin: string
  navSuper: string
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
  confirmCheckoutTitle: string
  confirmCheckoutBody: string
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
  warnNoBid: string
  warnPending: string
  warnDisabled: string
  warnClosed: string
  warnCart: string
  warnLogin: string
  warnRegister: string
  warnAccountTaken: string
  warnLotMissing: string
  warnListingGone: string
}

export type IconSettings = {
  favourite: string
}

export type SiteSettings = {
  brandName: string
  brandMark: string
  brandLogo: string
  tagline: string
  marketplaceLabel: string
  showAuctions: boolean
  showMarketplace: boolean
  showFavourites: boolean
  filters: {
    type: boolean
    maker: boolean
    grade: boolean
    capacity: boolean
    price: boolean
  }
  grades: Grade[]
  auctionTypes: AuctionTypeDef[]
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
  description: string
  accent: string
  operator?: string
  simLocked?: boolean
  activationLocked?: boolean
  /** Market / ship-from region for international catalogs. */
  origin?: string
}

export type Bid = {
  lotId: string
  accountId: string
  amount: number
  qty: number
  at: number
}

export type InvoiceStatus = 'unpaid' | 'pending_review' | 'paid' | 'declined'
export type PayDecision = 'accepted' | 'declined'
export type PayReviewSide = 'admin' | 'super'

export type PayReview = {
  decision: PayDecision
  by: string
  at: number
}

export type Invoice = {
  id: string
  lotId: string
  channel: Channel
  amount: number
  qty: number
  unitPrice: number
  status: InvoiceStatus
  createdAt: number
  accountId?: string
  receiptName?: string
  receiptData?: string
  paidDeclaredAt?: number
  adminReview?: PayReview
  superReview?: PayReview
  trackingNo?: string
  shippedAt?: number
  remarks?: string
  poNumber?: string
  opened?: boolean
  auctionLabel?: string
}

export type NoticeKind = 'win' | 'invoice' | 'outbid' | 'closing' | 'fill'

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

export type Account = {
  accountId: string
  password: string
  company: string
  email: string
  role: AccountRole
  status: AccountStatus
}

export type User = {
  accountId: string
  company: string
  email: string
  role: AccountRole
  status: AccountStatus
}
