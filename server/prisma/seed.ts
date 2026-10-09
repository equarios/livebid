/**
 * Seeds demo accounts + a slice of catalog lots for local full-stack testing.
 * Run: npm run db:seed (from server/)
 */
import { PrismaClient } from '@prisma/client'
import { createHash, randomBytes } from 'node:crypto'

const prisma = new PrismaClient()

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256').update(`${salt}:${password}`).digest('hex')
  return `${salt}$${hash}`
}

const ACCOUNTS = [
  {
    accountId: 'SUPER-0001',
    password: 'super',
    company: 'equarios corporation limited',
    email: 'super@livebid.example',
    role: 'superadmin',
    status: 'active',
  },
  {
    accountId: 'ADMIN-0001',
    password: 'admin',
    company: 'Equarios Ops',
    email: 'ops@livebid.example',
    role: 'admin',
    status: 'active',
  },
  {
    accountId: 'DEMO-1001',
    password: 'livebid',
    company: 'equarios corporation limited',
    email: 'buyer@northstar.example',
    phone: '+852 9123 4567',
    address: 'Rm/Flat 801, 8/F, WaiKee IND BLDG, 25 Hung To Road\nKwun Tong Hong Kong',
    role: 'member',
    status: 'active',
  },
] as const

function lot(
  partial: {
    id: string
    channel: 'auction' | 'marketplace'
    auctionType?: string
    manufacturer: string
    model: string
    modelNumber: string
    capacity: string
    color: string
    grade: string
    battery: number
    qty: number
    moq?: number
    startPrice: number
    currentPrice: number
    buyNowPrice?: number
    endsAt: number
    description: string
    origin?: string
  },
) {
  return {
    ...partial,
    bidCount: 0,
    accent: '#2a6f7c',
    endsAt: BigInt(partial.endsAt),
  }
}

async function main() {
  await prisma.notice.deleteMany()
  await prisma.watchItem.deleteMany()
  await prisma.bid.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.cartOrder.deleteMany()
  await prisma.marketOffer.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.session.deleteMany()
  await prisma.lot.deleteMany()
  await prisma.inventorySku.deleteMany()
  await prisma.account.deleteMany()

  for (const a of ACCOUNTS) {
    await prisma.account.create({
      data: {
        accountId: a.accountId,
        passwordHash: hashPassword(a.password),
        company: a.company,
        email: a.email,
        address: 'address' in a ? a.address : null,
        phone: 'phone' in a ? a.phone : null,
        role: a.role,
        status: a.status,
      },
    })
  }

  const now = Date.now()
  const day = 86400000
  const lots = [
    lot({
      id: 'LOT-1001',
      channel: 'auction',
      auctionType: 'live',
      manufacturer: 'Apple',
      model: 'iPhone 14',
      modelNumber: 'A2882',
      capacity: '128GB',
      color: 'Midnight',
      grade: 'A',
      battery: 90,
      qty: 40,
      moq: 5,
      startPrice: 280,
      currentPrice: 295,
      endsAt: now + 3 * day,
      description: 'Demo auction lot',
      origin: 'US',
    }),
    lot({
      id: 'LOT-1002',
      channel: 'auction',
      auctionType: 'sealed',
      manufacturer: 'Samsung',
      model: 'Galaxy S23',
      modelNumber: 'SM-S911B',
      capacity: '256GB',
      color: 'Phantom Black',
      grade: 'B',
      battery: 88,
      qty: 20,
      moq: 2,
      startPrice: 310,
      currentPrice: 310,
      endsAt: now + 2 * day,
      description: 'Sealed demo lot',
      origin: 'EU',
    }),
    lot({
      id: 'MP-11021',
      channel: 'marketplace',
      manufacturer: 'Apple',
      model: 'iPhone 13',
      modelNumber: 'A2633',
      capacity: '128GB',
      color: 'Starlight',
      grade: 'A',
      battery: 90,
      qty: 120,
      moq: 20,
      startPrice: 245,
      currentPrice: 245,
      buyNowPrice: 245,
      endsAt: now + 30 * day,
      description: 'Marketplace demo listing',
      origin: 'AE',
    }),
    lot({
      id: 'MP-11022',
      channel: 'marketplace',
      manufacturer: 'Samsung',
      model: 'Galaxy A54',
      modelNumber: 'SM-A546B',
      capacity: '128GB',
      color: 'Awesome Lime',
      grade: 'B',
      battery: 87,
      qty: 80,
      moq: 30,
      startPrice: 98,
      currentPrice: 98,
      buyNowPrice: 98,
      endsAt: now + 30 * day,
      description: 'Marketplace demo listing',
      origin: 'TW',
    }),
  ]

  for (const l of lots) {
    await prisma.lot.create({ data: l })
    await prisma.inventorySku.create({
      data: {
        id: `SKU-${l.id}`,
        manufacturer: l.manufacturer,
        model: l.model,
        modelNumber: l.modelNumber,
        capacity: l.capacity,
        color: l.color,
        grade: l.grade,
        battery: l.battery,
        origin: l.origin || '',
        description: l.description,
        defaultMoq: l.moq ?? undefined,
        lastPrice: l.buyNowPrice ?? l.currentPrice,
      },
    })
  }

  console.log(`Seeded ${ACCOUNTS.length} accounts and ${lots.length} lots.`)
  console.log('Logins: SUPER-0001/super · ADMIN-0001/admin · DEMO-1001/livebid')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
