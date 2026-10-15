/** Fill demo specs on store products that still lack capacity/grade. */
import { prisma } from '../src/db'

async function main() {
  const products = await prisma.storeProduct.findMany()
  let n = 0
  for (const p of products) {
    if (p.capacity && p.grade) continue
    const i = n % 3
    await prisma.storeProduct.update({
      where: { id: p.id },
      data: {
        modelNumber: p.modelNumber || ['A2882', 'SM-S911B', 'A2633'][i],
        capacity: p.capacity || ['128GB', '256GB', '128GB'][i],
        color: p.color || ['Midnight', 'Black', 'Blue'][i],
        grade: p.grade || ['A', 'A', 'B'][i],
        battery: p.battery > 0 ? p.battery : [92, 88, 85][i],
        origin: p.origin && p.origin !== 'INT' ? p.origin : ['USA', 'EUR', 'HKG'][i],
        simLocked: false,
        activationLocked: false,
      },
    })
    n++
  }
  console.log(JSON.stringify({ updated: n, total: products.length }))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
