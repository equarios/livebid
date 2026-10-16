import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { FloatingContact } from './components/FloatingContact'
import { Layout } from './components/Layout'
import { useLangQuerySync } from './components/SeoHead'
import { ThemeApplier } from './components/ThemeApplier'
import { canUseWholesaleDesk, publicHome, wholesaleHome } from './lib/channelAccess'
import { guestLoginFrom } from './lib/safeReturnPath'
import { useStore } from './store'

const pageFallback = (
  <div className="page-fallback" role="status" aria-live="polite">
    <span className="page-fallback-pulse" />
    <p className="muted tiny">Loading page…</p>
  </div>
)

function lazyNamed<M>(loader: () => Promise<M>, exportName: keyof M & string) {
  return lazy(async () => {
    const mod = await loader()
    return { default: mod[exportName] as ComponentType }
  })
}

/* Route pages — keep the entry chunk thin; staff desks and channel pages load on demand. */
const Admin = lazyNamed(() => import('./pages/Admin'), 'Admin')
const Super = lazyNamed(() => import('./pages/Super'), 'Super')
const Home = lazyNamed(() => import('./pages/Home'), 'Home')
const Store = lazyNamed(() => import('./pages/Store'), 'Store')
const StoreSold = lazyNamed(() => import('./pages/StoreSold'), 'StoreSold')
const StoreCart = lazyNamed(() => import('./pages/StoreCart'), 'StoreCart')
const StoreOrders = lazyNamed(() => import('./pages/StoreOrders'), 'StoreOrders')
const StoreProductPage = lazyNamed(() => import('./pages/StoreProduct'), 'StoreProductPage')
const Login = lazyNamed(() => import('./pages/Login'), 'Login')
const Register = lazyNamed(() => import('./pages/Register'), 'Register')
const Auctions = lazyNamed(() => import('./pages/Auctions'), 'Auctions')
const Marketplace = lazyNamed(() => import('./pages/Marketplace'), 'Marketplace')
const Community = lazyNamed(() => import('./pages/Community'), 'Community')
const MyPage = lazyNamed(() => import('./pages/MyPage'), 'MyPage')
const AccountOverview = lazyNamed(() => import('./pages/AccountOverview'), 'AccountOverview')
const AccountDocuments = lazyNamed(() => import('./pages/AccountDocuments'), 'AccountDocuments')
const Account = lazyNamed(() => import('./pages/Account'), 'Account')
const BidHistory = lazyNamed(() => import('./pages/BidHistory'), 'BidHistory')
const MarketplaceHistory = lazyNamed(() => import('./pages/MarketplaceHistory'), 'MarketplaceHistory')
const Invoices = lazyNamed(() => import('./pages/Invoices'), 'Invoices')
const ImeiPage = lazyNamed(() => import('./pages/ImeiPage'), 'ImeiPage')
const Complaint = lazyNamed(() => import('./pages/Complaint'), 'Complaint')
const Watchlist = lazyNamed(() => import('./pages/Watchlist'), 'Watchlist')
const WholesaleApply = lazyNamed(() => import('./pages/WholesaleApply'), 'WholesaleApply')
const BuyersPage = lazyNamed(() => import('./pages/PublicInfo'), 'BuyersPage')
const SellersPage = lazyNamed(() => import('./pages/PublicInfo'), 'SellersPage')
const SupportPage = lazyNamed(() => import('./pages/PublicInfo'), 'SupportPage')
const WholesaleCategoryPage = lazyNamed(() => import('./pages/WholesaleCategory'), 'WholesaleCategoryPage')
const DeviceSpec = lazyNamed(() => import('./pages/InfoPages'), 'DeviceSpec')
const InfoPage = lazyNamed(() => import('./pages/InfoPages'), 'InfoPage')
const Tutorial = lazyNamed(() => import('./pages/InfoPages'), 'Tutorial')
const NotFound = lazyNamed(() => import('./pages/NotFound'), 'NotFound')

function Guard({ children }: { children: ReactNode }) {
  const { user, authReady } = useStore()
  const location = useLocation()
  if (!authReady) {
    return <p className="muted tiny" style={{ padding: 16 }}>Loading session…</p>
  }
  if (!user)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: guestLoginFrom(location.pathname, location.search, location.hash) }}
      />
    )
  return children
}

/** Auctions / marketplace desk — approved buyers and staff only. */
function WholesaleDeskGate({ children }: { children: ReactNode }) {
  const { user, isStaff, settings } = useStore()
  if (!canUseWholesaleDesk(user, isStaff)) {
    return <Navigate to={user ? '/account' : '/buyers'} replace />
  }
  if (!settings.showAuctions && !settings.showMarketplace && !isStaff) {
    return <Navigate to="/wholesale" replace />
  }
  return children
}

/** Community (My Page) — wholesale-approved buyers + staff/sellers only (not retail). */
function CommunityGate({ children }: { children: ReactNode }) {
  const { user, isStaff, authReady } = useStore()
  if (!authReady) {
    return <p className="muted tiny" style={{ padding: 16 }}>Loading session…</p>
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: '/account/community' }} />
  }
  if (!canUseWholesaleDesk(user, isStaff)) {
    return <Navigate to="/account/wholesale" replace />
  }
  return children
}

function ChannelGate({
  flag,
  children,
}: {
  flag: 'showAuctions' | 'showMarketplace' | 'showFavourites' | 'showStore' | 'showCommunity'
  children: ReactNode
}) {
  const { settings, isSuperAdmin } = useStore()
  if (!settings[flag] && !isSuperAdmin) return <HomeRedirect />
  return children
}

function HomeRedirect() {
  const { settings, user, isStaff } = useStore()
  if (canUseWholesaleDesk(user, isStaff)) {
    return <Navigate to={wholesaleHome(settings)} replace />
  }
  return <Navigate to={publicHome(settings)} replace />
}

/** Retail for visitors; approved wholesale buyers go to the B2B desk. */
function RootPage() {
  const { settings, user, isStaff, authReady } = useStore()
  if (!authReady) {
    return <p className="muted tiny" style={{ padding: 16 }}>Loading session…</p>
  }
  if (canUseWholesaleDesk(user, isStaff) && !isStaff) {
    return <Navigate to={wholesaleHome(settings)} replace />
  }
  if (settings.showStore) return <Store />
  if (canUseWholesaleDesk(user, isStaff)) return <Home />
  return <Navigate to="/buyers" replace />
}

/** Wholesale hub — guests apply; pending wait on My Page; active see hub. */
function WholesaleHubPage() {
  const { user, isStaff, authReady } = useStore()
  if (!authReady) {
    return <p className="muted tiny" style={{ padding: 16 }}>Loading session…</p>
  }
  /* Guests can browse the deal board (prices locked); approved buyers/staff get the full hub. */
  if (!user) return <Home />
  if (!canUseWholesaleDesk(user, isStaff)) return <Navigate to="/account" replace />
  return <Home />
}

function SuperGuard() {
  const { isSuperAdmin, settings, user, isStaff } = useStore()
  if (!isSuperAdmin) {
    return (
      <Navigate
        to={canUseWholesaleDesk(user, isStaff) ? wholesaleHome(settings) : publicHome(settings)}
        replace
      />
    )
  }
  return <Super />
}

function AdminGuard() {
  const { isStaff, settings, user } = useStore()
  if (!isStaff) {
    return (
      <Navigate
        to={canUseWholesaleDesk(user, isStaff) ? wholesaleHome(settings) : publicHome(settings)}
        replace
      />
    )
  }
  return <Admin />
}

function LangQueryBridge() {
  useLangQuerySync()
  return null
}

export default function App() {
  return (
    <>
      <ThemeApplier />
      <LangQueryBridge />
      <FloatingContact />
      <Suspense fallback={pageFallback}>
        <Routes>
          <Route path="/" element={<RootPage />} />
          <Route path="/wholesale" element={<WholesaleHubPage />} />
          <Route path="/wholesale/c" element={<WholesaleCategoryPage />} />
          <Route path="/wholesale/c/:a" element={<WholesaleCategoryPage />} />
          <Route path="/wholesale/c/:a/:b" element={<WholesaleCategoryPage />} />
          <Route path="/wholesale/c/:a/:b/:c" element={<WholesaleCategoryPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/buyers" element={<BuyersPage />} />
          <Route path="/sellers" element={<SellersPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/device-spec" element={<DeviceSpec />} />
          <Route path="/info" element={<InfoPage />} />
          <Route path="/tutorial" element={<Tutorial />} />
          <Route path="/community" element={<Navigate to="/account/community" replace />} />
          <Route
            path="/store"
            element={
              <ChannelGate flag="showStore">
                <Store />
              </ChannelGate>
            }
          />
          <Route
            path="/store/sold"
            element={
              <ChannelGate flag="showStore">
                <StoreSold />
              </ChannelGate>
            }
          />
          <Route
            path="/store/p/:slug"
            element={
              <ChannelGate flag="showStore">
                <StoreProductPage />
              </ChannelGate>
            }
          />
          <Route
            path="/store/cart"
            element={
              <ChannelGate flag="showStore">
                <StoreCart />
              </ChannelGate>
            }
          />
          <Route
            path="/store/orders"
            element={
              <ChannelGate flag="showStore">
                <StoreOrders />
              </ChannelGate>
            }
          />
          <Route
            element={
              <Guard>
                <Layout />
              </Guard>
            }
          >
            <Route path="/top" element={<Navigate to="/account" replace />} />
            <Route
              path="/auctions"
              element={
                <WholesaleDeskGate>
                  <ChannelGate flag="showAuctions">
                    <Auctions />
                  </ChannelGate>
                </WholesaleDeskGate>
              }
            />
            <Route
              path="/auctions/:type"
              element={
                <WholesaleDeskGate>
                  <ChannelGate flag="showAuctions">
                    <Auctions />
                  </ChannelGate>
                </WholesaleDeskGate>
              }
            />
            <Route
              path="/marketplace"
              element={
                <WholesaleDeskGate>
                  <ChannelGate flag="showMarketplace">
                    <Marketplace />
                  </ChannelGate>
                </WholesaleDeskGate>
              }
            />
            <Route path="/account" element={<MyPage />}>
              <Route index element={<AccountOverview />} />
              <Route path="wholesale" element={<WholesaleApply />} />
              <Route path="documents" element={<AccountDocuments />} />
              <Route path="bids" element={<BidHistory />} />
              <Route path="marketplace-history" element={<MarketplaceHistory />} />
              <Route
                path="community"
                element={
                  <ChannelGate flag="showCommunity">
                    <CommunityGate>
                      <Community />
                    </CommunityGate>
                  </ChannelGate>
                }
              />
              <Route path="settings" element={<Account />} />
              <Route
                path="favourites"
                element={
                  <ChannelGate flag="showFavourites">
                    <Watchlist />
                  </ChannelGate>
                }
              />
              <Route path="invoices" element={<Invoices />} />
              <Route path="imei" element={<ImeiPage />} />
              <Route path="complaint" element={<Complaint />} />
            </Route>
            <Route path="/watchlist" element={<Navigate to="/account/favourites" replace />} />
            <Route path="/favourites" element={<Navigate to="/account/favourites" replace />} />
            <Route path="/invoices" element={<Navigate to="/account/invoices" replace />} />
            <Route path="/admin" element={<AdminGuard />} />
            <Route path="/admin/invoices" element={<Navigate to="/admin?section=money" replace />} />
            <Route path="/admin/imei" element={<Navigate to="/admin?section=imei" replace />} />
            <Route path="/super" element={<SuperGuard />} />
            <Route path="/super/invoices" element={<Navigate to="/super?section=money" replace />} />
            <Route path="/super/imei" element={<Navigate to="/admin?section=imei" replace />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  )
}
