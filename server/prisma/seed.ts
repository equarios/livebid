/**
 * Fresh local catalog for feature testing.
 * ~20 brands, mixed 500–1000 pcs/model, ≈50k warehouse pcs + auction/market/store demos.
 * Run: npm run db:seed | npm run db:reset (from server/)
 */
import '../src/loadEnv'
import { PrismaClient } from '@prisma/client'
import { createHash, randomBytes } from 'node:crypto'

const prisma = new PrismaClient()

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256').update(`${salt}:${password}`).digest('hex')
  return `${salt}$${hash}`
}

/** Deterministic RNG so re-seeds match. */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
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

const BRAND_LINES: Array<{
  manufacturer: string
  models: Array<{ model: string; modelNumber: string; capacity: string; color: string }>
}> = [
  {
    manufacturer: 'Apple',
    models: [
      { model: 'iPhone 15', modelNumber: 'A3090', capacity: '128GB', color: 'Black' },
      { model: 'iPhone 14', modelNumber: 'A2882', capacity: '128GB', color: 'Midnight' },
      { model: 'iPhone 13', modelNumber: 'A2633', capacity: '128GB', color: 'Starlight' },
      { model: 'iPhone 12', modelNumber: 'A2403', capacity: '64GB', color: 'Blue' },
    ],
  },
  {
    manufacturer: 'Samsung',
    models: [
      { model: 'Galaxy S24', modelNumber: 'SM-S921B', capacity: '256GB', color: 'Onyx Black' },
      { model: 'Galaxy S23', modelNumber: 'SM-S911B', capacity: '256GB', color: 'Phantom Black' },
      { model: 'Galaxy A54', modelNumber: 'SM-A546B', capacity: '128GB', color: 'Awesome Lime' },
      { model: 'Galaxy A34', modelNumber: 'SM-A346B', capacity: '128GB', color: 'Awesome Graphite' },
    ],
  },
  {
    manufacturer: 'Google',
    models: [
      { model: 'Pixel 8', modelNumber: 'GKWS6', capacity: '128GB', color: 'Obsidian' },
      { model: 'Pixel 7', modelNumber: 'GVU6C', capacity: '128GB', color: 'Snow' },
      { model: 'Pixel 7a', modelNumber: 'G0DZQ', capacity: '128GB', color: 'Charcoal' },
    ],
  },
  {
    manufacturer: 'Xiaomi',
    models: [
      { model: '14', modelNumber: '23127PN0CG', capacity: '256GB', color: 'Black' },
      { model: '13T', modelNumber: '2306EPN60G', capacity: '256GB', color: 'Meadow Green' },
      { model: 'Redmi Note 13', modelNumber: '2312DRA50G', capacity: '128GB', color: 'Midnight Black' },
    ],
  },
  {
    manufacturer: 'Oppo',
    models: [
      { model: 'Find X6', modelNumber: 'CPH2451', capacity: '256GB', color: 'Black' },
      { model: 'Reno 11', modelNumber: 'CPH2607', capacity: '256GB', color: 'Wave Green' },
      { model: 'A78', modelNumber: 'CPH2565', capacity: '128GB', color: 'Glowing Black' },
    ],
  },
  {
    manufacturer: 'Vivo',
    models: [
      { model: 'X100', modelNumber: 'V2309', capacity: '256GB', color: 'Asteroid Black' },
      { model: 'V29', modelNumber: 'V2250', capacity: '256GB', color: 'Space Black' },
      { model: 'Y36', modelNumber: 'V2247', capacity: '128GB', color: 'Meteor Black' },
    ],
  },
  {
    manufacturer: 'Huawei',
    models: [
      { model: 'P60 Pro', modelNumber: 'MNA-LX9', capacity: '256GB', color: 'Rococo Pearl' },
      { model: 'nova 11', modelNumber: 'GOA-LX9', capacity: '256GB', color: 'Black' },
      { model: 'Mate 50', modelNumber: 'CET-LX9', capacity: '256GB', color: 'Orange' },
    ],
  },
  {
    manufacturer: 'OnePlus',
    models: [
      { model: '12', modelNumber: 'CPH2573', capacity: '256GB', color: 'Silky Black' },
      { model: '11', modelNumber: 'CPH2449', capacity: '256GB', color: 'Titan Black' },
      { model: 'Nord 3', modelNumber: 'CPH2493', capacity: '128GB', color: 'Misty Green' },
    ],
  },
  {
    manufacturer: 'Sony',
    models: [
      { model: 'Xperia 1 V', modelNumber: 'XQ-DQ72', capacity: '256GB', color: 'Black' },
      { model: 'Xperia 5 V', modelNumber: 'XQ-DE72', capacity: '128GB', color: 'Blue' },
      { model: 'Xperia 10 V', modelNumber: 'XQ-DC72', capacity: '128GB', color: 'Black' },
    ],
  },
  {
    manufacturer: 'Motorola',
    models: [
      { model: 'Edge 40', modelNumber: 'XT2303-2', capacity: '256GB', color: 'Eclipse Black' },
      { model: 'G84', modelNumber: 'XT2347-2', capacity: '256GB', color: 'Midnight Blue' },
      { model: 'G54', modelNumber: 'XT2343-2', capacity: '128GB', color: 'Mint Green' },
    ],
  },
  {
    manufacturer: 'Nokia',
    models: [
      { model: 'G42', modelNumber: 'TA-1581', capacity: '128GB', color: 'So Purple' },
      { model: 'X30', modelNumber: 'TA-1450', capacity: '256GB', color: 'Cloudy Blue' },
      { model: 'C32', modelNumber: 'TA-1548', capacity: '64GB', color: 'Charcoal' },
    ],
  },
  {
    manufacturer: 'Realme',
    models: [
      { model: '12 Pro+', modelNumber: 'RMX3840', capacity: '256GB', color: 'Submarine Blue' },
      { model: '11 Pro', modelNumber: 'RMX3771', capacity: '256GB', color: 'Sunrise Beige' },
      { model: 'C67', modelNumber: 'RMX3775', capacity: '128GB', color: 'Black' },
    ],
  },
  {
    manufacturer: 'Honor',
    models: [
      { model: 'Magic6', modelNumber: 'BVL-N49', capacity: '256GB', color: 'Black' },
      { model: '90', modelNumber: 'REA-NX9', capacity: '256GB', color: 'Midnight Black' },
      { model: 'X9b', modelNumber: 'ANY-LX1', capacity: '256GB', color: 'Sunrise Orange' },
    ],
  },
  {
    manufacturer: 'Asus',
    models: [
      { model: 'Zenfone 10', modelNumber: 'AI2302', capacity: '256GB', color: 'Comet White' },
      { model: 'ROG Phone 7', modelNumber: 'AI2205', capacity: '256GB', color: 'Phantom Black' },
      { model: 'Zenfone 9', modelNumber: 'AI2202', capacity: '128GB', color: 'Midnight Black' },
    ],
  },
  {
    manufacturer: 'Nothing',
    models: [
      { model: 'Phone (2)', modelNumber: 'A065', capacity: '256GB', color: 'White' },
      { model: 'Phone (1)', modelNumber: 'A063', capacity: '128GB', color: 'Black' },
      { model: 'Phone (2a)', modelNumber: 'A142', capacity: '128GB', color: 'Milk' },
    ],
  },
  {
    manufacturer: 'Fairphone',
    models: [
      { model: '5', modelNumber: 'FP5', capacity: '256GB', color: 'Sky Blue' },
      { model: '4', modelNumber: 'FP4', capacity: '128GB', color: 'Grey' },
      { model: '3+', modelNumber: 'FP3+', capacity: '64GB', color: 'Black' },
    ],
  },
  {
    manufacturer: 'TCL',
    models: [
      { model: '40 NXTPAP', modelNumber: 'T612B', capacity: '128GB', color: 'Midnight Blue' },
      { model: '30 SE', modelNumber: 'T676H', capacity: '128GB', color: 'Space Grey' },
      { model: '20L', modelNumber: 'T770H', capacity: '64GB', color: 'Eclipse Black' },
    ],
  },
  {
    manufacturer: 'Lenovo',
    models: [
      { model: 'ThinkPhone', modelNumber: 'XT2309-2', capacity: '256GB', color: 'Carbon Black' },
      { model: 'K14 Plus', modelNumber: 'XT2215-4', capacity: '128GB', color: 'Polar Blue' },
      { model: 'A8', modelNumber: 'TAB4-8504', capacity: '32GB', color: 'Black' },
    ],
  },
  {
    manufacturer: 'LG',
    models: [
      { model: 'Wing', modelNumber: 'LM-F100N', capacity: '256GB', color: 'Aurora Black' },
      { model: 'V60', modelNumber: 'LM-V600', capacity: '128GB', color: 'Classy Blue' },
      { model: 'G8', modelNumber: 'LM-G820', capacity: '128GB', color: 'Aurora Black' },
    ],
  },
  {
    manufacturer: 'ZTE',
    models: [
      { model: 'Axon 50', modelNumber: 'A2023P', capacity: '256GB', color: 'Black' },
      { model: 'Blade V50', modelNumber: 'A7050', capacity: '128GB', color: 'Space Grey' },
      { model: 'Blade A35', modelNumber: 'A7030', capacity: '64GB', color: 'Green' },
    ],
  },
]

const GRADES = ['S', 'A', 'A', 'B', 'B', 'C'] as const
const ORIGINS = ['USA', 'EUR', 'HKG', 'CHN', 'ARE', 'TWN', 'JPN', 'KOR'] as const
const TARGET_PCS = 50_000

type SkuSeed = {
  id: string
  manufacturer: string
  model: string
  modelNumber: string
  capacity: string
  color: string
  grade: string
  battery: number
  origin: string
  description: string
  defaultMoq: number
  lastPrice: number
  onHand: number
  unitCost: number
}

function buildSkus(rng: () => number): SkuSeed[] {
  const rows: SkuSeed[] = []
  let n = 0
  for (const brand of BRAND_LINES) {
    for (const m of brand.models) {
      n += 1
      const grade = GRADES[Math.floor(rng() * GRADES.length)]!
      const battery = grade === 'S' ? 95 + Math.floor(rng() * 5) : 78 + Math.floor(rng() * 18)
      const lastPrice = Math.round(80 + rng() * 420)
      const unitCost = Math.round(lastPrice * (0.55 + rng() * 0.25) * 100) / 100
      rows.push({
        id: `SKU-${String(n).padStart(3, '0')}`,
        manufacturer: brand.manufacturer,
        model: m.model,
        modelNumber: m.modelNumber,
        capacity: m.capacity,
        color: m.color,
        grade,
        battery,
        origin: ORIGINS[Math.floor(rng() * ORIGINS.length)]!,
        description: `${brand.manufacturer} ${m.model} · test warehouse stock`,
        defaultMoq: 5 + Math.floor(rng() * 20),
        lastPrice,
        onHand: 500 + Math.floor(rng() * 501),
        unitCost,
      })
    }
  }
  const sum = rows.reduce((s, r) => s + r.onHand, 0)
  let scaled = rows.map((r) => ({
    ...r,
    onHand: Math.max(500, Math.min(1000, Math.round((r.onHand * TARGET_PCS) / sum))),
  }))
  let total = scaled.reduce((s, r) => s + r.onHand, 0)
  let i = 0
  while (total > TARGET_PCS && i < 10_000) {
    const row = scaled[i % scaled.length]!
    if (row.onHand > 500) {
      row.onHand -= 1
      total -= 1
    }
    i += 1
  }
  i = 0
  while (total < TARGET_PCS && i < 10_000) {
    const row = scaled[i % scaled.length]!
    if (row.onHand < 1000) {
      row.onHand += 1
      total += 1
    }
    i += 1
  }
  return scaled
}

function lotRow(
  partial: {
    id: string
    channel: string
    auctionType?: string | null
    manufacturer: string
    model: string
    modelNumber: string
    capacity: string
    color: string
    grade: string
    battery: number
    qty: number
    moq: number
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
    auctionType: partial.auctionType ?? null,
    buyNowPrice: partial.buyNowPrice ?? null,
    bidCount: 0,
    accent: '#2a6f7c',
    endsAt: BigInt(partial.endsAt),
    origin: partial.origin ?? '',
  }
}

async function main() {
  const rng = mulberry32(20261023)

  await prisma.notice.deleteMany()
  await prisma.watchItem.deleteMany()
  await prisma.bid.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.cartOrder.deleteMany()
  await prisma.marketOffer.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.session.deleteMany()
  await prisma.passwordReset.deleteMany().catch(() => undefined)
  await prisma.emailVerify.deleteMany().catch(() => undefined)
  await prisma.accountDocument.deleteMany().catch(() => undefined)
  await prisma.wholesaleApplication.deleteMany().catch(() => undefined)
  await prisma.storeOrderLine.deleteMany().catch(() => undefined)
  await prisma.storeOrder.deleteMany().catch(() => undefined)
  await prisma.storeProduct.deleteMany().catch(() => undefined)
  await prisma.communityInterest.deleteMany().catch(() => undefined)
  await prisma.communityListing.deleteMany().catch(() => undefined)
  await prisma.imeiDevice.deleteMany().catch(() => undefined)
  await prisma.imeiPack.deleteMany().catch(() => undefined)
  await prisma.stockHold.deleteMany().catch(() => undefined)
  await prisma.stockMove.deleteMany().catch(() => undefined)
  await prisma.emailCampaign.deleteMany().catch(() => undefined)
  await prisma.marketingClient.deleteMany().catch(() => undefined)
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

  const skus = buildSkus(rng)
  await prisma.inventorySku.createMany({
    data: skus.map((s) => ({
      id: s.id,
      manufacturer: s.manufacturer,
      model: s.model,
      modelNumber: s.modelNumber,
      capacity: s.capacity,
      color: s.color,
      grade: s.grade,
      battery: s.battery,
      origin: s.origin,
      description: s.description,
      defaultMoq: s.defaultMoq,
      lastPrice: s.lastPrice,
      onHand: s.onHand,
      unitCost: s.unitCost,
    })),
  })

  const now = Date.now()
  const day = 86_400_000
  const auctionTypes = ['live', 'offline', 'live', 'offline'] as const
  const listPlans: Array<{
    sku: SkuSeed
    channel: 'auction' | 'marketplace'
    auctionType: string | null
    qty: number
    endsAt: number
  }> = []

  // 12 auction + 10 marketplace listings drawn from warehouse.
  for (let i = 0; i < 12; i++) {
    const sku = skus[i]!
    const qty = Math.min(40 + Math.floor(rng() * 80), Math.floor(sku.onHand * 0.15))
    listPlans.push({
      sku,
      channel: 'auction',
      auctionType: auctionTypes[i % auctionTypes.length]!,
      qty: Math.max(10, qty),
      endsAt: now + (1 + (i % 5)) * day,
    })
  }
  for (let i = 12; i < 22; i++) {
    const sku = skus[i]!
    const qty = Math.min(60 + Math.floor(rng() * 100), Math.floor(sku.onHand * 0.2))
    listPlans.push({
      sku,
      channel: 'marketplace',
      auctionType: null,
      qty: Math.max(20, qty),
      endsAt: now + 30 * day,
    })
  }

  let lotN = 0
  for (const plan of listPlans) {
    lotN += 1
    const id =
      plan.channel === 'auction'
        ? `LOT-${String(1000 + lotN)}`
        : `MP-${String(11000 + lotN)}`
    const price = plan.sku.lastPrice
    const row = lotRow({
      id,
      channel: plan.channel,
      auctionType: plan.auctionType,
      manufacturer: plan.sku.manufacturer,
      model: plan.sku.model,
      modelNumber: plan.sku.modelNumber,
      capacity: plan.sku.capacity,
      color: plan.sku.color,
      grade: plan.sku.grade,
      battery: plan.sku.battery,
      qty: plan.qty,
      moq: plan.sku.defaultMoq,
      startPrice: price,
      currentPrice: plan.channel === 'auction' ? Math.round(price * 1.02) : price,
      buyNowPrice: plan.channel === 'marketplace' ? price : undefined,
      endsAt: plan.endsAt,
      description:
        plan.channel === 'auction' ? 'Seed auction lot for testing' : 'Seed marketplace listing',
      origin: plan.sku.origin,
    })

    await prisma.$transaction(async (tx) => {
      const taken = await tx.inventorySku.updateMany({
        where: { id: plan.sku.id, onHand: { gte: plan.qty } },
        data: { onHand: { decrement: plan.qty } },
      })
      if (!taken.count) throw new Error(`Could not reserve ${plan.qty} from ${plan.sku.id}`)
      await tx.lot.create({ data: row })
      await tx.stockHold.create({
        data: { lotId: id, skuId: plan.sku.id, qty: plan.qty },
      })
    })
  }

  // Retail store — sibling color/GB variants (cart chips) + filler SKUs.
  const variantFamilies: Array<{
    brand: string
    model: string
    modelNumber: string
    grade: string
    battery: number
    origin: string
    basePrice: number
    variants: Array<{ capacity: string; color: string; stock: number }>
  }> = [
    {
      brand: 'Apple',
      model: 'iPhone 15',
      modelNumber: 'A3090',
      grade: 'A',
      battery: 92,
      origin: 'ARE',
      basePrice: 520,
      variants: [
        { capacity: '128GB', color: 'Black', stock: 14 },
        { capacity: '128GB', color: 'Blue', stock: 9 },
        { capacity: '128GB', color: 'Pink', stock: 0 },
        { capacity: '256GB', color: 'Black', stock: 7 },
        { capacity: '256GB', color: 'Blue', stock: 5 },
        { capacity: '512GB', color: 'Black', stock: 3 },
      ],
    },
    {
      brand: 'Samsung',
      model: 'Galaxy S24',
      modelNumber: 'SM-S921B',
      grade: 'A',
      battery: 90,
      origin: 'EUR',
      basePrice: 480,
      variants: [
        { capacity: '128GB', color: 'Onyx Black', stock: 11 },
        { capacity: '128GB', color: 'Marble Gray', stock: 6 },
        { capacity: '256GB', color: 'Onyx Black', stock: 8 },
        { capacity: '256GB', color: 'Cobalt Violet', stock: 0 },
        { capacity: '512GB', color: 'Onyx Black', stock: 2 },
      ],
    },
  ]

  const familyModelNos = new Set(variantFamilies.map((f) => f.modelNumber))
  const storeRows: Array<{
    title: string
    slug: string
    description: string
    price: number
    compareAt: number
    stock: number
    category: string
    brand: string
    modelNumber: string
    capacity: string
    color: string
    grade: string
    battery: number
    origin: string
    simLocked?: boolean
    activationLocked?: boolean
    active: boolean
  }> = []

  let storeIdx = 0
  for (const fam of variantFamilies) {
    for (const v of fam.variants) {
      storeIdx += 1
      const capBump =
        v.capacity.startsWith('512') ? 90 : v.capacity.startsWith('256') ? 45 : 0
      const price = fam.basePrice + capBump
      const slug = `${fam.brand}-${fam.model}-${v.capacity}-${v.color}-${fam.grade}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 72)
      storeRows.push({
        title: `${fam.brand} ${fam.model} ${v.capacity}`,
        slug: `${slug}-${storeIdx}`,
        description: `${fam.grade} grade · ${v.color} · retail demo unit`,
        price,
        compareAt: Math.round(price * 1.12),
        stock: v.stock,
        category: 'Phones',
        brand: fam.brand,
        modelNumber: fam.modelNumber,
        capacity: v.capacity,
        color: v.color,
        grade: fam.grade,
        battery: fam.battery,
        origin: fam.origin,
        active: true,
      })
    }
  }

  for (const s of skus.slice(0, 20)) {
    if (familyModelNos.has(s.modelNumber)) continue
    storeIdx += 1
    const slug = `${s.manufacturer}-${s.model}-${s.capacity}-${s.grade}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 72)
    const simLocked = storeIdx % 7 === 0
    const activationLocked = storeIdx % 11 === 0
    const asIs = storeIdx % 9 === 0
    const grade = asIs ? 'C' : s.grade
    const price = Math.round(
      s.lastPrice * (1.15 + rng() * 0.2) * (simLocked || activationLocked || asIs ? 0.72 : 1),
    )
    storeRows.push({
      title: `${s.manufacturer} ${s.model} ${s.capacity}`,
      slug: `${slug}-${storeIdx}`,
      description: asIs
        ? `${grade} grade · ${s.color} · sold as-is — possible faults or heavy wear`
        : simLocked
          ? `${grade} grade · ${s.color} · SIM locked — may not work on all carriers`
          : `${grade} grade · ${s.color} · retail demo unit`,
      price,
      compareAt: Math.round(price * 1.12),
      stock: 8 + Math.floor(rng() * 28),
      category:
        s.model.toLowerCase().includes('tab') || s.capacity === '32GB' ? 'Tablets' : 'Phones',
      brand: s.manufacturer,
      modelNumber: s.modelNumber,
      capacity: s.capacity,
      color: s.color,
      grade,
      battery: s.battery,
      origin: s.origin,
      simLocked,
      activationLocked,
      active: true,
    })
  }
  await prisma.storeProduct.createMany({ data: storeRows })

  const tradeInDevices = [
    { id: 'iphone-15-128', brand: 'Apple', model: 'iPhone 15', modelNumber: 'A3090', capacity: '128GB', baseUsd: 420, sortOrder: 10 },
    { id: 'iphone-15-256', brand: 'Apple', model: 'iPhone 15', modelNumber: 'A3090', capacity: '256GB', baseUsd: 460, sortOrder: 20 },
    { id: 'iphone-14-128', brand: 'Apple', model: 'iPhone 14', modelNumber: 'A2882', capacity: '128GB', baseUsd: 310, sortOrder: 30 },
    { id: 'iphone-13-128', brand: 'Apple', model: 'iPhone 13', modelNumber: 'A2482', capacity: '128GB', baseUsd: 240, sortOrder: 40 },
    { id: 'iphone-12-64', brand: 'Apple', model: 'iPhone 12', modelNumber: 'A2403', capacity: '64GB', baseUsd: 160, sortOrder: 50 },
    { id: 's24-256', brand: 'Samsung', model: 'Galaxy S24', modelNumber: 'SM-S921B', capacity: '256GB', baseUsd: 380, sortOrder: 60 },
    { id: 's23-256', brand: 'Samsung', model: 'Galaxy S23', modelNumber: 'SM-S911B', capacity: '256GB', baseUsd: 280, sortOrder: 70 },
    { id: 'a54-128', brand: 'Samsung', model: 'Galaxy A54', modelNumber: 'SM-A546B', capacity: '128GB', baseUsd: 120, sortOrder: 80 },
    { id: 'pixel-8-128', brand: 'Google', model: 'Pixel 8', modelNumber: 'GKWS6', capacity: '128GB', baseUsd: 260, sortOrder: 90 },
    { id: 'pixel-7-128', brand: 'Google', model: 'Pixel 7', modelNumber: 'GVU6C', capacity: '128GB', baseUsd: 170, sortOrder: 100 },
  ]
  await prisma.storeTradeInDevice.deleteMany().catch(() => undefined)
  await prisma.storeTradeInDevice.createMany({
    data: tradeInDevices.map((d) => ({ ...d, active: true })),
  })

  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  try {
    const tacPath = join(process.cwd(), 'data', 'tradein-tac-seed.json')
    const tacRows = JSON.parse(readFileSync(tacPath, 'utf8')) as Array<{
      tac: string
      brand: string
      model: string
      name?: string
    }>
    await prisma.storeImeiTac.deleteMany().catch(() => undefined)
    await prisma.storeImeiTac.createMany({
      data: tacRows
        .map((r) => ({
          tac: String(r.tac).replace(/\D/g, '').slice(0, 8),
          brand: r.brand.trim(),
          model: r.model.trim(),
          name: (r.name || r.model).trim(),
        }))
        .filter((r) => r.tac.length === 8),
    })
  } catch {
    /* optional file */
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
            model: 'iPhone 14',
            box: 'B01',
          },
          {
            imei: '356938035643817',
            unlockCode: '87654321',
            model: 'iPhone 14',
            box: 'B01',
          },
          {
            imei: '353282103847291',
            unlockCode: '11223344',
            model: 'Galaxy S23',
            box: 'B02',
          },
        ],
      },
    },
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

  const warehouseLeft = await prisma.inventorySku.aggregate({ _sum: { onHand: true } })
  const listed = listPlans.reduce((s, p) => s + p.qty, 0)
  const brands = new Set(skus.map((s) => s.manufacturer)).size

  console.log(
    `Seeded ${ACCOUNTS.length} accounts · ${skus.length} SKUs (${brands} brands) · warehouse on-hand ${warehouseLeft._sum.onHand ?? 0} pcs · ${listed} pcs on open lots · ${listPlans.filter((p) => p.channel === 'auction').length} auctions · ${listPlans.filter((p) => p.channel === 'marketplace').length} marketplace · ${storeRows.length} store products · 1 IMEI pack · 3 community listings.`,
  )
  console.log(
    'Logins: SUPER-0001/super · ADMIN-0001/admin · DEMO-1001/livebid (wholesale) · RETAIL-1001/retail (store only)',
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
