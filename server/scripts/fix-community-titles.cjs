const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  await p.communityListing.update({
    where: { id: (await p.communityListing.findFirst({ where: { title: { contains: 'iPhone 12' } } })).id },
    data: { title: '12x iPhone 12 64GB Grade B - mixed colors' },
  })
  await p.communityListing.update({
    where: { id: (await p.communityListing.findFirst({ where: { title: { contains: 'Galaxy' } } })).id },
    data: { title: '8x Galaxy Tab A8 - ask for best offer' },
  })
  const pending = await p.communityListing.findFirst({ where: { title: { contains: 'Pixel' } } })
  if (pending) {
    await p.communityListing.update({
      where: { id: pending.id },
      data: { title: '5x Pixel 7 128GB pending review' },
    })
  }
  const rows = await p.communityListing.findMany({ select: { title: true, status: true } })
  console.log(rows)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => p.$disconnect())
