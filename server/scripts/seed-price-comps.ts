/** Seed 3 closed auction comps for the first open live lot (demo Past 3 UI). */
import { prisma } from '../src/db'

async function main() {
  const now = Date.now()
  const open = await prisma.lot.findFirst({
    where: {
      channel: 'auction',
      endsAt: { gt: BigInt(now) },
    },
    orderBy: { endsAt: 'asc' },
  })
  if (!open) {
    console.error('No open auction lot found.')
    process.exit(1)
  }

  const type = open.auctionType || 'live'
  const baseId = `COMP-${open.model.replace(/\s+/g, '').slice(0, 10).toUpperCase()}`
  const prices = [312, 305, 298]
  const daysAgo = [12, 19, 31]

  for (let i = 0; i < 3; i++) {
    const id = `${baseId}-${i + 1}`
    const ends = now - daysAgo[i] * 86400000
    await prisma.lot.upsert({
      where: { id },
      create: {
        id,
        channel: 'auction',
        auctionType: type,
        manufacturer: open.manufacturer,
        model: open.model,
        modelNumber: open.modelNumber || '',
        capacity: open.capacity,
        color: open.color,
        grade: open.grade,
        battery: open.battery,
        qty: open.qty,
        moq: open.moq,
        startPrice: prices[i] - 20,
        currentPrice: prices[i],
        buyNowPrice: null,
        bidCount: 4 + i,
        endsAt: BigInt(ends),
        extraSealedEndsAt: null,
        description: `Past clearing demo for ${open.model}`,
        accent: open.accent || '#2a6f7c',
        operator: open.operator,
        simLocked: open.simLocked,
        activationLocked: open.activationLocked,
        origin: open.origin,
      },
      update: {
        auctionType: type,
        manufacturer: open.manufacturer,
        model: open.model,
        capacity: open.capacity,
        grade: open.grade,
        currentPrice: prices[i],
        bidCount: 4 + i,
        endsAt: BigInt(ends),
        extraSealedEndsAt: null,
        description: `Past clearing demo for ${open.model}`,
      },
    })
  }

  const comps = await prisma.lot.findMany({
    where: { id: { startsWith: baseId } },
    select: { id: true, currentPrice: true, endsAt: true, auctionType: true, model: true },
  })
  console.log(
    JSON.stringify(
      {
        openLotId: open.id,
        model: open.model,
        auctionType: type,
        comps: comps.map((c) => ({
          id: c.id,
          price: c.currentPrice,
          endsAt: Number(c.endsAt),
        })),
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
