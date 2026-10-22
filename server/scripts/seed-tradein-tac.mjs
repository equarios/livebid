import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const root = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(root, '../data/tradein-tac-seed.json')
const rows = JSON.parse(readFileSync(file, 'utf8'))

let n = 0
for (const r of rows) {
  const tac = String(r.tac || '').replace(/\D/g, '').slice(0, 8)
  if (tac.length !== 8) continue
  await prisma.storeImeiTac.upsert({
    where: { tac },
    create: {
      tac,
      brand: String(r.brand).trim(),
      model: String(r.model).trim(),
      name: String(r.name || r.model || '').trim(),
    },
    update: {
      brand: String(r.brand).trim(),
      model: String(r.model).trim(),
      name: String(r.name || r.model || '').trim(),
    },
  })
  n++
}
console.log('seeded TACs', n)
await prisma.$disconnect()
