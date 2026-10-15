import { prisma } from '../src/db'
import { normalizeOrigin } from '../src/origins'

async function main() {
  const lots = await prisma.lot.findMany({ select: { id: true, origin: true } })
  let lotsUpdated = 0
  for (const l of lots) {
    const next = normalizeOrigin(l.origin)
    if (l.origin !== next) {
      await prisma.lot.update({ where: { id: l.id }, data: { origin: next } })
      lotsUpdated++
    }
  }
  const skus = await prisma.inventorySku.findMany({ select: { id: true, origin: true } })
  let skusUpdated = 0
  for (const k of skus) {
    const next = normalizeOrigin(k.origin)
    if (k.origin !== next) {
      await prisma.inventorySku.update({ where: { id: k.id }, data: { origin: next } })
      skusUpdated++
    }
  }
  console.log(JSON.stringify({ lotsUpdated, skusUpdated }))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
