import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { FloatingContact } from './components/FloatingContact'
import { Layout } from './components/Layout'
import { ThemeApplier } from './components/ThemeApplier'
import { Account } from './pages/Account'
import { Auctions } from './pages/Auctions'
import { BidHistory } from './pages/BidHistory'
import { Complaint } from './pages/Complaint'
import { Home } from './pages/Home'
import { DeviceSpec, InfoPage, Tutorial } from './pages/InfoPages'
import { ImeiPage } from './pages/ImeiPage'
import { Invoices } from './pages/Invoices'
import { Login } from './pages/Login'
import { Marketplace } from './pages/Marketplace'
import { Community } from './pages/Community'
import { Store } from './pages/Store'
import { StoreCart } from './pages/StoreCart'
import { StoreOrders } from './pages/StoreOrders'
import { StoreProductPage } from './pages/StoreProduct'
import { MarketplaceHistory } from './pages/MarketplaceHistory'
import { AccountDocuments } from './pages/AccountDocuments'
import { AccountOverview } from './pages/AccountOverview'
import { MyPage } from './pages/MyPage'
import { BuyersPage, SellersPage, SupportPage } from './pages/PublicInfo'
import { Register } from './pages/Register'
import { Watchlist } from './pages/Watchlist'
import { WholesaleApply } from './pages/WholesaleApply'
import { canUseWholesaleDesk, publicHome, wholesaleHome } from './lib/channelAccess'
import { useStore } from './store'

const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })))
const Super = lazy(() => import('./pages/Super').then((m) => ({ default: m.Super })))

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
        state={{ from: location.pathname + location.search + location.hash }}
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
  if (!user) return <Navigate to="/buyers" replace />
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
  return (
    <Suspense fallback={<p className="muted tiny" style={{ padding: 16 }}>Loading…</p>}>
      <Super />
    </Suspense>
  )
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
  return (
    <Suspense fallback={<p className="muted tiny" style={{ padding: 16 }}>Loading…</p>}>
      <Admin />
    </Suspense>
  )
}

export default function App() {
  return (
    <>
      <ThemeApplier />
      <FloatingContact />
      <Routes>
        <Route path="/" element={<RootPage />} />
        <Route path="/wholesale" element={<WholesaleHubPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/buyers" element={<BuyersPage />} />
        <Route path="/sellers" element={<SellersPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/community" element={<Navigate to="/account/community" replace />} />
        <Route path="/store" element={<Navigate to="/" replace />} />
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
          <Route path="/device-spec" element={<DeviceSpec />} />
          <Route path="/info" element={<InfoPage />} />
          <Route path="/tutorial" element={<Tutorial />} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
