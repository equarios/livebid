import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
console.log('count', await p.storeImeiTac.count())
console.log(
  'apple sample',
  await p.storeImeiTac.findMany({
    where: { brand: { contains: 'Apple', mode: 'insensitive' } },
    take: 12,
  }),
)
console.log(
  'iphone count',
  await p.storeImeiTac.count({ where: { model: { contains: 'iPhone', mode: 'insensitive' } } }),
)
console.log(
  'samsung s',
  await p.storeImeiTac.findMany({
    where: { model: { contains: 'S24', mode: 'insensitive' } },
    take: 5,
  }),
)
console.log(
  'any recent',
  await p.storeImeiTac.findMany({
    where: { model: { contains: 'iPhone 1', mode: 'insensitive' } },
    take: 10,
  }),
)
await p.$disconnect()
