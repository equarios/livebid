/**
 * Seeds demo accounts + a slice of catalog lots for local full-stack testing.
 * Run: npm run db:seed (from server/)
 */
import '../src/loadEnv'
import { PrismaClient } from '@prisma/client'
import { createHash, randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const STORE_CATALOG = require('../scripts/store-catalog.cjs') as Array<{
  title: string
  slug: string
  description: string
  price: number
  compareAt: number | null
  stock: number
  category: string
  brand?: string
}>

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
    firstName: 'Super',
    lastName: 'Admin',
    role: 'superadmin',
    status: 'active',
    emailVerified: true,
    wholesaleStatus: 'approved',
  },
  {
    accountId: 'ADMIN-0001',
    password: 'admin',
    company: 'Equarios Ops',
    email: 'ops@livebid.example',
    firstName: 'Ops',
    lastName: 'Admin',
    role: 'admin',
    status: 'active',
    emailVerified: true,
    wholesaleStatus: 'approved',
  },
  {
    accountId: 'DEMO-1001',
    password: 'livebid',
    company: 'equarios corporation limited',
    email: 'buyer@northstar.example',
    firstName: 'North',
    lastName: 'Star',
    phone: '+852 9123 4567',
    address: 'Rm/Flat 801, 8/F, WaiKee IND BLDG, 25 Hung To Road\nKwun Tong Hong Kong',
    role: 'member',
    status: 'active',
    emailVerified: true,
    wholesaleStatus: 'approved',
  },
  {
    accountId: 'RETAIL-1001',
    password: 'retail',
    company: 'Retail Demo Shopper',
    email: 'retail@livebid.example',
    firstName: 'Rita',
    lastName: 'Lee',
    role: 'member',
    status: 'active',
    emailVerified: true,
    wholesaleStatus: 'none',
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
    extraSealedEndsAt?: number
    description: string
    origin?: string
  },
) {
  const { extraSealedEndsAt, ...rest } = partial
  return {
    ...rest,
    bidCount: 0,
    accent: '#2a6f7c',
    endsAt: BigInt(partial.endsAt),
    extraSealedEndsAt:
      extraSealedEndsAt != null ? BigInt(extraSealedEndsAt) : undefined,
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
  await prisma.passwordReset.deleteMany().catch(() => {})
  await prisma.emailVerify.deleteMany().catch(() => {})
  await prisma.accountDocument.deleteMany().catch(() => {})
  await prisma.wholesaleApplication.deleteMany().catch(() => {})
  await prisma.storeOrderLine.deleteMany().catch(() => {})
  await prisma.storeOrder.deleteMany().catch(() => {})
  await prisma.storeProduct.deleteMany().catch(() => {})
  await prisma.emailCampaign.deleteMany().catch(() => {})
  await prisma.marketingClient.deleteMany().catch(() => {})
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
        firstName: a.firstName,
        lastName: a.lastName,
        address: 'address' in a ? a.address : null,
        phone: 'phone' in a ? a.phone : null,
        role: a.role,
        status: a.status,
        emailVerified: a.emailVerified,
        wholesaleStatus: a.wholesaleStatus,
      },
    })
  }

  await prisma.wholesaleApplication.create({
    data: {
      accountId: 'DEMO-1001',
      status: 'approved',
      payloadJson: JSON.stringify({
        companyLegal: 'equarios corporation limited',
        businessType: 'Reseller / Refurbisher',
        taxId: 'DEMO-TAX-1001',
      }),
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: 'SUPER-0001',
    },
  })

  const consentAt = new Date()
  await prisma.marketingClient.createMany({
    data: [
      {
        email: 'buyer@northstar.example',
        firstName: 'North',
        lastName: 'Star',
        company: 'equarios corporation limited',
        tags: 'wholesale,vip',
        status: 'subscribed',
        source: 'seed',
        accountId: 'DEMO-1001',
        consentAt,
      },
      {
        email: 'retail@livebid.example',
        firstName: 'Rita',
        lastName: 'Lee',
        company: 'Retail Demo Shopper',
        tags: 'retail',
        status: 'subscribed',
        source: 'seed',
        accountId: 'RETAIL-1001',
        consentAt,
      },
      {
        email: 'prospect1@example.com',
        firstName: 'Alex',
        lastName: 'Chan',
        company: 'Pacific Phones',
        tags: 'wholesale,hk',
        status: 'subscribed',
        source: 'seed',
        consentAt,
      },
      {
        email: 'prospect2@example.com',
        firstName: 'Sam',
        lastName: 'Ng',
        company: 'City Gadgets',
        tags: 'retail',
        status: 'subscribed',
        source: 'seed',
        consentAt,
      },
      {
        email: 'old@example.com',
        firstName: 'Unsub',
        lastName: 'User',
        company: '',
        tags: '',
        status: 'unsubscribed',
        source: 'seed',
        consentAt: null,
      },
    ],
  })

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
      origin: 'USA',
    }),
    lot({
      id: 'LOT-1002',
      channel: 'auction',
      auctionType: 'offline',
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
      origin: 'EUR',
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
      origin: 'ARE',
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
      origin: 'TWN',
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

  await prisma.imeiPack.create({
    data: {
      title: 'Demo shipment — DEMO-1001',
      accountId: 'DEMO-1001',
      note: 'Sample unlock codes for local testing',
      createdBy: 'ADMIN-0001',
      devices: {
        create: [
          {
            imei: '356938035643809',
            unlockCode: '12345678',
            model: 'iPhone 13',
            box: 'B01',
          },
          {
            imei: '356938035643817',
            unlockCode: '87654321',
            model: 'iPhone 13',
            box: 'B01',
          },
          {
            imei: '353282103847291',
            unlockCode: '11223344',
            model: 'Galaxy S22',
            box: 'B02',
          },
        ],
      },
    },
  })

  await prisma.storeProduct.createMany({
    data: STORE_CATALOG.map((row) => ({ ...row, active: true })),
  })

  await prisma.communityListing.createMany({
    data: [
      {
        accountId: 'DEMO-1001',
        title: '12x iPhone 12 64GB Grade B - mixed colors',
        description: 'Unlocked units, light wear. Happy to work with Equarios on buyer match.',
        category: 'Phones',
        manufacturer: 'Apple',
        model: 'iPhone 12',
        capacity: '64GB',
        grade: 'B',
        qty: 12,
        price: 145,
        currency: 'USD',
        imageUrl:
          'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=800&q=70',
        status: 'live',
        featured: true,
        publishedAt: new Date(),
      },
      {
        accountId: 'RETAIL-1001',
        title: '8x Galaxy Tab A8 - ask for best offer',
        description: 'Retail overstock. Prefer bulk pickup Hong Kong.',
        category: 'Tablets',
        manufacturer: 'Samsung',
        model: 'Tab A8',
        capacity: '64GB',
        grade: 'A',
        qty: 8,
        price: null,
        currency: 'USD',
        status: 'live',
        featured: false,
        publishedAt: new Date(),
      },
      {
        accountId: 'DEMO-1001',
        title: '5x Pixel 7 128GB pending review',
        description: 'Sample pending listing for staff queue.',
        category: 'Phones',
        manufacturer: 'Google',
        model: 'Pixel 7',
        capacity: '128GB',
        grade: 'A',
        qty: 5,
        price: 210,
        status: 'pending',
      },
    ],
  })

  console.log(
    `Seeded ${ACCOUNTS.length} accounts, ${lots.length} lots, 1 IMEI pack, ${STORE_CATALOG.length} store products, 3 member-market listings.`,
  )
  console.log(
    'Logins: SUPER-0001/super · ADMIN-0001/admin · DEMO-1001/livebid (wholesale) · RETAIL-1001/retail (store only)',
  )
  console.log('Marketing: 5 sample clients (Admin → Clients). Set BREVO_API_KEY for live sends.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
