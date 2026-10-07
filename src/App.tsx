import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Account } from './pages/Account'
import { Admin } from './pages/Admin'
import { Auctions } from './pages/Auctions'
import { Invoices } from './pages/Invoices'
import { Login } from './pages/Login'
import { LotDetail } from './pages/LotDetail'
import { Marketplace } from './pages/Marketplace'
import { Register } from './pages/Register'
import { Watchlist } from './pages/Watchlist'
import { useStore } from './store'
import type { ReactNode } from 'react'

function Guard({ children }: { children: ReactNode }) {
  const { user } = useStore()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

function AdminGuard() {
  const { user } = useStore()
  if (user?.accountId !== 'ADMIN-0001') return <Navigate to="/auctions" replace />
  return <Admin />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route path="/auctions" element={<Auctions />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/account" element={<Account />} />
        <Route path="/admin" element={<AdminGuard />} />
        <Route path="/lots/:id" element={<LotDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/auctions" replace />} />
    </Routes>
  )
}
