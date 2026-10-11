const { PrismaClient } = require('@prisma/client')
const CATALOG = require('./store-catalog.cjs')

const p = new PrismaClient()

async function main() {
  let created = 0
  let updated = 0
  for (const row of CATALOG) {
    const existing = await p.storeProduct.findUnique({ where: { slug: row.slug } })
    if (existing) {
      await p.storeProduct.update({
        where: { slug: row.slug },
        data: {
          title: row.title,
          description: row.description,
          price: row.price,
          compareAt: row.compareAt,
          stock: row.stock,
          category: row.category,
          active: true,
        },
      })
      updated += 1
    } else {
      await p.storeProduct.create({
        data: { ...row, active: true },
      })
      created += 1
    }
  }
  const total = await p.storeProduct.count({ where: { active: true } })
  console.log(`store catalog: +${created} new, ${updated} refreshed, ${total} active`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => p.$disconnect())
