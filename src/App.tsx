import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ThemeApplier } from './components/ThemeApplier'
import { Account } from './pages/Account'
import { Auctions } from './pages/Auctions'
import { BidHistory } from './pages/BidHistory'
import { Complaint } from './pages/Complaint'
import { Home } from './pages/Home'
import { DeviceSpec, InfoPage, Tutorial } from './pages/InfoPages'
import { Invoices } from './pages/Invoices'
import { Login } from './pages/Login'
import { Marketplace } from './pages/Marketplace'
import { MarketplaceHistory } from './pages/MarketplaceHistory'
import { MyPage } from './pages/MyPage'
import { BuyersPage, SellersPage, SupportPage } from './pages/PublicInfo'
import { Register } from './pages/Register'
import { Watchlist } from './pages/Watchlist'
import { useStore } from './store'

const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })))
const Super = lazy(() => import('./pages/Super').then((m) => ({ default: m.Super })))

function Guard({ children }: { children: ReactNode }) {
  const { user } = useStore()
  const location = useLocation()
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

function ChannelGate({
  flag,
  children,
}: {
  flag: 'showAuctions' | 'showMarketplace' | 'showFavourites'
  children: ReactNode
}) {
  const { settings, isSuperAdmin } = useStore()
  if (!settings[flag] && !isSuperAdmin) return <HomeRedirect />
  return children
}

function HomeRedirect() {
  const { settings } = useStore()
  return <Navigate to={settings.showAuctions ? '/auctions' : '/marketplace'} replace />
}

function SuperGuard() {
  const { isSuperAdmin, settings } = useStore()
  const home = settings.showAuctions ? '/auctions' : '/marketplace'
  if (!isSuperAdmin) return <Navigate to={home} replace />
  return (
    <Suspense fallback={<p className="muted tiny" style={{ padding: 16 }}>Loading…</p>}>
      <Super />
    </Suspense>
  )
}

function AdminGuard() {
  const { isStaff, settings } = useStore()
  const home = settings.showAuctions ? '/auctions' : '/marketplace'
  if (!isStaff) return <Navigate to={home} replace />
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
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/buyers" element={<BuyersPage />} />
        <Route path="/sellers" element={<SellersPage />} />
        <Route path="/support" element={<SupportPage />} />
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
              <ChannelGate flag="showAuctions">
                <Auctions />
              </ChannelGate>
            }
          />
          <Route
            path="/auctions/:type"
            element={
              <ChannelGate flag="showAuctions">
                <Auctions />
              </ChannelGate>
            }
          />
          <Route
            path="/marketplace"
            element={
              <ChannelGate flag="showMarketplace">
                <Marketplace />
              </ChannelGate>
            }
          />
          <Route path="/device-spec" element={<DeviceSpec />} />
          <Route path="/info" element={<InfoPage />} />
          <Route path="/tutorial" element={<Tutorial />} />
          <Route path="/account" element={<MyPage />}>
            <Route index element={<BidHistory />} />
            <Route path="marketplace-history" element={<MarketplaceHistory />} />
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
            <Route path="complaint" element={<Complaint />} />
          </Route>
          <Route path="/watchlist" element={<Navigate to="/account/favourites" replace />} />
          <Route path="/favourites" element={<Navigate to="/account/favourites" replace />} />
          <Route path="/invoices" element={<Navigate to="/account/invoices" replace />} />
          <Route path="/admin" element={<AdminGuard />} />
          <Route path="/admin/invoices" element={<Navigate to="/admin?section=money" replace />} />
          <Route path="/super" element={<SuperGuard />} />
          <Route path="/super/invoices" element={<Navigate to="/super?section=money" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
