import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ADMIN_USER, DEMO_USER, SEED_LOTS } from './data'
import type { Bid, CartItem, Invoice, Lot, User } from './types'

type Store = {
  user: User | null
  lots: Lot[]
  bids: Bid[]
  watchlist: string[]
  invoices: Invoice[]
  cart: CartItem[]
  now: number
  login: (accountId: string, password: string) => string | null
  register: (accountId: string, company: string, email: string, password: string) => string | null
  logout: () => void
  placeBid: (lotId: string, amount: number, qty: number) => string | null
  buyNow: (lotId: string, qty?: number) => string | null
  addToCart: (lotId: string, qty: number) => string | null
  removeFromCart: (lotId: string) => void
  checkoutCart: () => string | null
  toggleWatch: (lotId: string) => void
  payInvoice: (id: string) => void
  myBid: (lotId: string) => number | undefined
  myLastBid: (lotId: string) => Bid | undefined
  addLot: (lot: Lot) => void
  extendLot: (lotId: string, hours: number) => void
  reopenAuctions: () => void
}

const StoreContext = createContext<Store | null>(null)
const AUTH_KEY = 'livebid-auth'
const DATA_KEY = 'livebid-data'

type Persisted = {
  lots: Lot[]
  bids: Bid[]
  watchlist: string[]
  invoices: Invoice[]
  cart: CartItem[]
}

function demoFillBids(): Bid[] {
  return [
    { lotId: 'LB-24089', accountId: 'BOT-SMALL', amount: 400, qty: 3, at: Date.now() - 8000 },
    { lotId: 'LB-24089', accountId: 'BOT-ALL', amount: 350, qty: 15, at: Date.now() - 4000 },
    { lotId: 'LB-24085', accountId: 'BOT-SMALL', amount: 640, qty: 2, at: Date.now() - 6000 },
    { lotId: 'LB-24085', accountId: 'BOT-ALL', amount: 590, qty: 8, at: Date.now() - 3000 },
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
      return {
        ...parsed,
        bids: bids.some((b) => b.accountId === 'BOT-SMALL' || b.accountId === 'BOT-ALL')
          ? bids
          : [...bids, ...demoFillBids()],
        invoices: (parsed.invoices || []).map((inv) => ({
          ...inv,
          qty: inv.qty || 1,
          unitPrice: inv.unitPrice || inv.amount,
        })),
        cart: parsed.cart || [],
      }
    }
  } catch {
    /* ignore */
  }
  return { lots: SEED_LOTS, bids: demoFillBids(), watchlist: [], invoices: [], cart: [] }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as User
      return {
        ...parsed,
        role: parsed.accountId === ADMIN_USER.accountId ? 'admin' : 'member',
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
    localStorage.setItem(DATA_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    const t = setInterval(() => {
      setData((prev) => {
        const nowTs = Date.now()
        const extraInvoices: Invoice[] = []
        const extraBids: Bid[] = []
        const lots = prev.lots.map((lot) => {
          if (lot.channel !== 'auction') return lot
          if (lot.endsAt <= nowTs) return lot
          if (lot.auctionType === 'sealed') return lot
          if (Math.random() > 0.4) return lot
          const takeAll = lot.qty > 1 && Math.random() > 0.55
          const qty = takeAll ? lot.qty : Math.max(1, Math.min(lot.qty, 1 + Math.floor(Math.random() * 3)))
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
        lots.forEach((lot) => {
          if (lot.channel !== 'auction' || lot.endsAt > nowTs) return
          const mine = prev.bids.filter((b) => b.lotId === lot.id)
          if (!mine.length) return
          const last = mine.reduce((a, b) => (a.at > b.at ? a : b))
          const stillWinning = lot.auctionType === 'sealed' || last.amount >= lot.currentPrice
          const already = prev.invoices.some((inv) => inv.lotId === lot.id)
          if (stillWinning && !already) {
            extraInvoices.push({
              id: `INV-${lot.id.slice(-5)}`,
              lotId: lot.id,
              qty: last.qty,
              unitPrice: last.amount,
              amount: last.amount * last.qty,
              status: 'unpaid',
              createdAt: nowTs,
            })
          }
        })
        if (!extraBids.length && !extraInvoices.length) return prev
        return {
          ...prev,
          lots,
          bids: extraBids.length ? [...prev.bids, ...extraBids] : prev.bids,
          invoices: extraInvoices.length ? [...extraInvoices, ...prev.invoices] : prev.invoices,
        }
      })
    }, 4500)
    return () => clearInterval(t)
  }, [])

  const login = useCallback((accountId: string, password: string) => {
    const id = accountId.trim().toUpperCase()
    if (id === ADMIN_USER.accountId && password === ADMIN_USER.password) {
      const next = {
        accountId: ADMIN_USER.accountId,
        company: ADMIN_USER.company,
        email: ADMIN_USER.email,
        role: 'admin' as const,
      }
      setUser(next)
      localStorage.setItem(AUTH_KEY, JSON.stringify(next))
      return null
    }
    if (id === DEMO_USER.accountId && password === DEMO_USER.password) {
      const next = {
        accountId: DEMO_USER.accountId,
        company: DEMO_USER.company,
        email: DEMO_USER.email,
        role: 'member' as const,
      }
      setUser(next)
      localStorage.setItem(AUTH_KEY, JSON.stringify(next))
      return null
    }
    try {
      const extra = JSON.parse(localStorage.getItem('livebid-members') || '[]') as Array<{
        accountId: string
        password: string
        company: string
        email: string
      }>
      const found = extra.find(
        (m) => m.accountId.toUpperCase() === id && m.password === password,
      )
      if (found) {
        const next = {
          accountId: found.accountId.toUpperCase(),
          company: found.company,
          email: found.email,
          role: 'member' as const,
        }
        setUser(next)
        localStorage.setItem(AUTH_KEY, JSON.stringify(next))
        return null
      }
    } catch {
      /* ignore */
    }
    return 'Invalid account ID or password.'
  }, [])

  const register = useCallback(
    (accountId: string, company: string, email: string, password: string) => {
      if (!accountId.trim() || !company.trim() || !email.trim() || password.length < 6) {
        return 'Fill all fields. Password must be at least 6 characters.'
      }
      const members = JSON.parse(localStorage.getItem('livebid-members') || '[]') as Array<{
        accountId: string
        password: string
        company: string
        email: string
      }>
      const id = accountId.trim().toUpperCase()
      if (
        id === DEMO_USER.accountId ||
        id === ADMIN_USER.accountId ||
        members.some((m) => m.accountId.toUpperCase() === id)
      ) {
        return 'That account ID is already registered.'
      }
      members.push({ accountId: id, password, company: company.trim(), email: email.trim() })
      localStorage.setItem('livebid-members', JSON.stringify(members))
      const next = {
        accountId: id,
        company: company.trim(),
        email: email.trim(),
        role: 'member' as const,
      }
      setUser(next)
      localStorage.setItem(AUTH_KEY, JSON.stringify(next))
      return null
    },
    [],
  )

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
      if (!lot || lot.channel !== 'auction') return 'Lot not found.'
      if (lot.endsAt <= Date.now()) return 'This auction has closed.'
      if (!Number.isInteger(qty) || qty < 1) return 'Desired qty must be a whole number of 1 or more.'
      if (qty > lot.qty) return `Desired qty cannot exceed total pcs (${lot.qty}).`
      const min = lot.startPrice
      if (amount < min) return `Minimum price per pc is ${min}.`
      const accountId = user?.accountId || 'DEMO-1001'
      setData((prev) => ({
        ...prev,
        lots: prev.lots.map((l) =>
          l.id === lotId
            ? {
                ...l,
                currentPrice: Math.max(l.currentPrice, amount),
                bidCount: l.bidCount + 1,
              }
            : l,
        ),
        bids: [...prev.bids, { lotId, accountId, amount, qty, at: Date.now() }],
      }))
      return null
    },
    [data.lots, user],
  )

  const buyNow = useCallback(
    (lotId: string, qty?: number) => {
      const lot = data.lots.find((l) => l.id === lotId)
      if (!lot || lot.channel !== 'marketplace' || !lot.buyNowPrice) {
        return 'Listing not available.'
      }
      const pcs = qty ?? lot.qty
      if (!Number.isInteger(pcs) || pcs < 1) return 'Desired qty must be a whole number of 1 or more.'
      if (pcs > lot.qty) return `Desired qty cannot exceed total pcs (${lot.qty}).`
      const invoice: Invoice = {
        id: `INV-${Date.now().toString().slice(-6)}`,
        lotId,
        qty: pcs,
        unitPrice: lot.buyNowPrice,
        amount: lot.buyNowPrice * pcs,
        status: 'unpaid',
        createdAt: Date.now(),
      }
      setData((prev) => ({
        ...prev,
        lots: prev.lots
          .map((l) => {
            if (l.id !== lotId) return l
            return { ...l, qty: l.qty - pcs }
          })
          .filter((l) => l.channel !== 'marketplace' || l.qty > 0),
        invoices: [invoice, ...prev.invoices],
      }))
      return null
    },
    [data.lots],
  )

  const addToCart = useCallback(
    (lotId: string, qty: number) => {
      const lot = data.lots.find((l) => l.id === lotId)
      if (!lot || lot.channel !== 'marketplace' || !lot.buyNowPrice) {
        return 'Listing not available.'
      }
      if (!Number.isInteger(qty) || qty < 1) return 'Desired qty must be a whole number of 1 or more.'
      const already = data.cart.find((c) => c.lotId === lotId)?.qty ?? 0
      const nextQty = already + qty
      if (nextQty > lot.qty) return `Cart cannot exceed total pcs (${lot.qty}).`
      setData((prev) => {
        const exists = prev.cart.some((c) => c.lotId === lotId)
        const cart = exists
          ? prev.cart.map((c) => (c.lotId === lotId ? { ...c, qty: nextQty } : c))
          : [...prev.cart, { lotId, qty }]
        return { ...prev, cart }
      })
      return null
    },
    [data.lots, data.cart],
  )

  const removeFromCart = useCallback((lotId: string) => {
    setData((prev) => ({ ...prev, cart: prev.cart.filter((c) => c.lotId !== lotId) }))
  }, [])

  const checkoutCart = useCallback(() => {
    if (!data.cart.length) return 'Cart is empty.'
    const invoices: Invoice[] = []
    for (const item of data.cart) {
      const lot = data.lots.find((l) => l.id === item.lotId)
      if (!lot || lot.channel !== 'marketplace' || !lot.buyNowPrice) {
        return `Listing ${item.lotId} is no longer available.`
      }
      if (item.qty > lot.qty) return `${lot.model}: only ${lot.qty} pcs left.`
      invoices.push({
        id: `INV-${Date.now().toString().slice(-6)}-${item.lotId.slice(-3)}`,
        lotId: item.lotId,
        qty: item.qty,
        unitPrice: lot.buyNowPrice,
        amount: lot.buyNowPrice * item.qty,
        status: 'unpaid',
        createdAt: Date.now(),
      })
    }
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
    }))
    return null
  }, [data.cart, data.lots])

  const toggleWatch = useCallback((lotId: string) => {
    setData((prev) => ({
      ...prev,
      watchlist: prev.watchlist.includes(lotId)
        ? prev.watchlist.filter((id) => id !== lotId)
        : [...prev.watchlist, lotId],
    }))
  }, [])

  const addLot = useCallback((lot: Lot) => {
    setData((prev) => ({ ...prev, lots: [lot, ...prev.lots] }))
  }, [])

  const extendLot = useCallback((lotId: string, hours: number) => {
    setData((prev) => ({
      ...prev,
      lots: prev.lots.map((l) =>
        l.id === lotId ? { ...l, endsAt: Math.max(l.endsAt, Date.now()) + hours * 60 * 60 * 1000 } : l,
      ),
    }))
  }, [])

  const reopenAuctions = useCallback(() => {
    const hour = 60 * 60 * 1000
    setData((prev) => ({
      ...prev,
      lots: prev.lots.map((l) =>
        l.channel === 'auction' ? { ...l, endsAt: Date.now() + 4 * hour } : l,
      ),
    }))
  }, [])

  const payInvoice = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      invoices: prev.invoices.map((inv) =>
        inv.id === id ? { ...inv, status: 'paid' } : inv,
      ),
    }))
  }, [])

  const value = useMemo(
    () => ({
      user,
      lots: data.lots,
      bids: data.bids,
      watchlist: data.watchlist,
      invoices: data.invoices,
      cart: data.cart,
      now,
      login,
      register,
      logout,
      placeBid,
      buyNow,
      addToCart,
      removeFromCart,
      checkoutCart,
      toggleWatch,
      payInvoice,
      myBid,
      myLastBid,
      addLot,
      extendLot,
      reopenAuctions,
    }),
    [
      user,
      data,
      now,
      login,
      register,
      logout,
      placeBid,
      buyNow,
      addToCart,
      removeFromCart,
      checkoutCart,
      toggleWatch,
      payInvoice,
      myBid,
      myLastBid,
      addLot,
      extendLot,
      reopenAuctions,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
