import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function brand(title) {
  const t = title.toLowerCase()
  if (/^(iphone|ipad|macbook|watch)/.test(t)) return 'Apple'
  if (/^galaxy/.test(t)) return 'Samsung'
  if (/^pixel/.test(t)) return 'Google'
  if (/^xperia/.test(t)) return 'Sony'
  return ''
}

const rows = await prisma.storeProduct.findMany()
let n = 0
for (const r of rows) {
  const b = brand(r.title)
  if (b && r.brand !== b) {
    await prisma.storeProduct.update({ where: { id: r.id }, data: { brand: b } })
    n++
  }
}
console.log('backfilled', n, 'of', rows.length)
await prisma.$disconnect()
