const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
p.account
  .update({
    where: { accountId: 'DEMO-1001' },
    data: {
      phone: '+852 9123 4567',
      address: 'Rm/Flat 801, 8/F, WaiKee IND BLDG, 25 Hung To Road\nKwun Tong Hong Kong',
    },
  })
  .then((a) => {
    console.log('patched', a.accountId, a.phone)
    return p.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await p.$disconnect()
    process.exit(1)
  })
