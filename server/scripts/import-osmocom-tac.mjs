/**
 * Import Osmocom TAC DB into StoreImeiTac (CC-BY-SA 3.0).
 * Source: http://tacdb.osmocom.org/export/tacdb.csv
 *
 * Usage: node scripts/import-osmocom-tac.mjs
 * Env: OSMOCOM_TAC_URL, OSMOCOM_TAC_FILE (local path override)
 */
import { createWriteStream, existsSync, readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const prisma = new PrismaClient()
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'data')
const defaultFile = path.join(dataDir, 'osmocom-tacdb.csv')
const url = process.env.OSMOCOM_TAC_URL || 'http://tacdb.osmocom.org/export/tacdb.csv'
const file = process.env.OSMOCOM_TAC_FILE || defaultFile

/** Minimal CSV line parser (handles quotes). */
function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = false
      } else cur += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

function clean(s) {
  return String(s || '')
    .replace(/\u0000/g, '')
    .trim()
}

async function ensureCsv() {
  if (existsSync(file) && !process.env.OSMOCOM_TAC_FORCE) {
    console.log('using local', file)
    return
  }
  await mkdir(dataDir, { recursive: true })
  console.log('downloading', url)
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file))
  console.log('saved', file)
}

function loadRows() {
  const text = readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const rows = []
  for (const line of lines) {
    if (line.startsWith('Osmocom TAC')) continue
    if (line.startsWith('tac,')) continue
    const cols = parseCsvLine(line)
    const tac = clean(cols[0]).replace(/\D/g, '').slice(0, 8)
    if (tac.length !== 8) continue
    const brand = clean(cols[1])
    const model = clean(cols[2])
    if (!brand || !model) continue
    const aka = clean(cols[7])
    const name = aka ? `${model} (${aka.split(',')[0].trim()})` : model
    rows.push({
      tac,
      brand: brand.slice(0, 80),
      model: model.slice(0, 120),
      name: name.slice(0, 160),
    })
  }
  return rows
}

const BATCH = 500

async function main() {
  await ensureCsv()
  const raw = loadRows()
  const byTac = new Map()
  for (const r of raw) byTac.set(r.tac, r)
  const rows = [...byTac.values()]
  console.log('parsed', raw.length, 'lines →', rows.length, 'unique TACs')
  if (!rows.length) throw new Error('No TAC rows parsed')

  // Replace table so Osmocom is source of truth.
  await prisma.storeImeiTac.deleteMany()
  let n = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    await prisma.storeImeiTac.createMany({ data: chunk, skipDuplicates: true })
    n += chunk.length
    console.log('imported', n, '/', rows.length)
  }
  // Overlay curated buy-list TACs (newer models Osmocom may lack).
  const overlayPath = path.join(dataDir, 'tradein-tac-seed.json')
  if (existsSync(overlayPath)) {
    const overlay = JSON.parse(readFileSync(overlayPath, 'utf8'))
    let o = 0
    for (const r of overlay) {
      const tac = String(r.tac || '').replace(/\D/g, '').slice(0, 8)
      if (tac.length !== 8 || !r.brand || !r.model) continue
      await prisma.storeImeiTac.upsert({
        where: { tac },
        create: {
          tac,
          brand: String(r.brand).trim().slice(0, 80),
          model: String(r.model).trim().slice(0, 120),
          name: String(r.name || r.model).trim().slice(0, 160),
        },
        update: {
          brand: String(r.brand).trim().slice(0, 80),
          model: String(r.model).trim().slice(0, 120),
          name: String(r.name || r.model).trim().slice(0, 160),
        },
      })
      o++
    }
    console.log('overlay curated TACs', o)
  }

  console.log('done', await prisma.storeImeiTac.count(), 'rows in StoreImeiTac')
  console.log('Attribution: Osmocom TAC database, CC-BY-SA 3.0 — http://tacdb.osmocom.org/')
  console.log('Note: Osmocom lags newest models — curated overlay + future paid API fill gaps.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
