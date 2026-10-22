import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const rows = [
  { id: 'iphone-15-128', brand: 'Apple', model: 'iPhone 15', capacity: '128GB', baseUsd: 420, sortOrder: 10 },
  { id: 'iphone-15-256', brand: 'Apple', model: 'iPhone 15', capacity: '256GB', baseUsd: 460, sortOrder: 20 },
  { id: 'iphone-14-128', brand: 'Apple', model: 'iPhone 14', capacity: '128GB', baseUsd: 310, sortOrder: 30 },
  { id: 'iphone-13-128', brand: 'Apple', model: 'iPhone 13', capacity: '128GB', baseUsd: 240, sortOrder: 40 },
  { id: 'iphone-12-64', brand: 'Apple', model: 'iPhone 12', capacity: '64GB', baseUsd: 160, sortOrder: 50 },
  { id: 's24-256', brand: 'Samsung', model: 'Galaxy S24', capacity: '256GB', baseUsd: 380, sortOrder: 60 },
  { id: 's23-256', brand: 'Samsung', model: 'Galaxy S23', capacity: '256GB', baseUsd: 280, sortOrder: 70 },
  { id: 'a54-128', brand: 'Samsung', model: 'Galaxy A54', capacity: '128GB', baseUsd: 120, sortOrder: 80 },
  { id: 'pixel-8-128', brand: 'Google', model: 'Pixel 8', capacity: '128GB', baseUsd: 260, sortOrder: 90 },
  { id: 'pixel-7-128', brand: 'Google', model: 'Pixel 7', capacity: '128GB', baseUsd: 170, sortOrder: 100 },
]

for (const d of rows) {
  await prisma.storeTradeInDevice.upsert({
    where: { id: d.id },
    create: { ...d, active: true },
    update: {
      brand: d.brand,
      model: d.model,
      capacity: d.capacity,
      baseUsd: d.baseUsd,
      sortOrder: d.sortOrder,
      active: true,
    },
  })
}
console.log('seeded', await prisma.storeTradeInDevice.count())
await prisma.$disconnect()
