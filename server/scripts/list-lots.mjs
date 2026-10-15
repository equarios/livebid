import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const lots = await prisma.lot.findMany({
  select: { id: true, channel: true, auctionType: true, endsAt: true, extraSealedEndsAt: true },
})
console.log(JSON.stringify(lots, (_, v) => (typeof v === 'bigint' ? Number(v) : v), 2))
await prisma.$disconnect()
