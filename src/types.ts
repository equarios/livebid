export type AuctionType = 'live' | 'sealed' | 'hybrid'
export type Channel = 'auction' | 'marketplace'
export type Grade = 'S' | 'A' | 'B' | 'C'

export type Lot = {
  id: string
  channel: Channel
  auctionType?: AuctionType
  manufacturer: string
  model: string
  capacity: string
  color: string
  grade: Grade
  battery: number
  qty: number
  startPrice: number
  currentPrice: number
  buyNowPrice?: number
  bidCount: number
  endsAt: number
  description: string
  accent: string
}

export type Bid = {
  lotId: string
  accountId: string
  amount: number
  qty: number
  at: number
}

export type Invoice = {
  id: string
  lotId: string
  amount: number
  qty: number
  unitPrice: number
  status: 'unpaid' | 'paid'
  createdAt: number
}

export type CartItem = {
  lotId: string
  qty: number
}

export type User = {
  accountId: string
  company: string
  email: string
  role: 'admin' | 'member'
}
