const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const n = await p.imeiPack.count()
  if (n) {
    console.log('packs already:', n)
    return
  }
  await p.imeiPack.create({
    data: {
      title: 'Demo shipment — DEMO-1001',
      accountId: 'DEMO-1001',
      note: 'Sample unlock codes',
      createdBy: 'ADMIN-0001',
      devices: {
        create: [
          { imei: '356938035643809', unlockCode: '12345678', model: 'iPhone 13', box: 'B01' },
          { imei: '356938035643817', unlockCode: '87654321', model: 'iPhone 13', box: 'B01' },
          { imei: '353282103847291', unlockCode: '11223344', model: 'Galaxy S22', box: 'B02' },
        ],
      },
    },
  })
  console.log('seeded demo IMEI pack')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => p.$disconnect())
