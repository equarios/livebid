import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

function checkDigit(body14) {
  let sum = 0
  let dbl = true
  for (let i = 13; i >= 0; i--) {
    let n = Number(body14[i])
    if (dbl) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    dbl = !dbl
  }
  return String((10 - (sum % 10)) % 10)
}

const samples = await p.storeImeiTac.findMany({
  where: {
    OR: [
      { model: { contains: 'iPhone 15', mode: 'insensitive' } },
      { model: { contains: 'iPhone 13', mode: 'insensitive' } },
      { model: { contains: 'Galaxy S24', mode: 'insensitive' } },
    ],
  },
  take: 10,
})
console.log(
  'samples',
  samples.map((s) => `${s.tac} ${s.brand} ${s.model}`),
)

const row =
  samples.find((s) => /iphone 15/i.test(s.model)) ||
  samples.find((s) => /iphone 13/i.test(s.model)) ||
  samples[0]
if (!row) {
  console.error('no sample TAC')
  process.exit(1)
}
const body = `${row.tac}000001`
const imei = body + checkDigit(body)
console.log('test imei', imei)

await p.$disconnect()

const res = await fetch('http://127.0.0.1:8787/api/store/trade-in/imei-lookup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ imei }),
})
console.log(await res.json())
