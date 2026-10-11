import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const path = new URL('./store-catalog.cjs', import.meta.url)
const rows = require('./store-catalog.cjs')

function brand(title) {
  const t = title.toLowerCase()
  if (/^(iphone|ipad|macbook|watch)/.test(t)) return 'Apple'
  if (/^galaxy/.test(t)) return 'Samsung'
  if (/^pixel/.test(t)) return 'Google'
  if (/^xperia/.test(t)) return 'Sony'
  return ''
}

const next = rows.map((r) => ({ ...r, brand: brand(r.title) }))
const body =
  '/** Shared retail demo catalog — used by seed + seed-store-demo. */\n' +
  'module.exports = ' +
  JSON.stringify(next, null, 2) +
  '\n'
fs.writeFileSync(path, body)
console.log('updated', next.length, [...new Set(next.map((r) => r.brand))])
