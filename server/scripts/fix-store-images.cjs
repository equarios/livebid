const { PrismaClient } = require('@prisma/client')

const p = new PrismaClient()

async function main() {
  const all = await p.$queryRawUnsafe('SELECT id, images, imageUrl FROM StoreProduct')
  console.log('rows', all.length)
  let fixed = 0
  for (const r of all) {
    let ok = true
    const raw = r.images
    try {
      if (raw == null || raw === '') ok = false
      else if (typeof raw === 'string') JSON.parse(raw)
    } catch {
      ok = false
    }
    if (!ok) {
      const imgs = r.imageUrl ? JSON.stringify([r.imageUrl]) : '[]'
      await p.$executeRawUnsafe('UPDATE StoreProduct SET images = ? WHERE id = ?', imgs, r.id)
      fixed += 1
      console.log('fixed', r.id)
    } else if (r.imageUrl && typeof raw === 'string' && raw === '[]') {
      await p.$executeRawUnsafe(
        'UPDATE StoreProduct SET images = ? WHERE id = ?',
        JSON.stringify([r.imageUrl]),
        r.id,
      )
      fixed += 1
      console.log('seeded cover', r.id)
    }
  }
  const probe = await p.storeProduct.findMany({ take: 3 })
  console.log('fixed', fixed, 'sample', probe.map((x) => ({ title: x.title, images: x.images })))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => p.$disconnect())
