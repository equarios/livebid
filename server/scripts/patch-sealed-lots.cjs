const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const res = await prisma.lot.updateMany({
    where: { auctionType: { in: ['sealed', 'hybrid'] } },
    data: { auctionType: 'offline' },
  })
  console.log('migrated lots to offline:', res.count)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
