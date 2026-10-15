/** Product / lot questions from store, auction, marketplace. */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type EnquiryChannel = 'store' | 'auction' | 'marketplace'
export type EnquiryStatus = 'open' | 'done'

export type ProductEnquiry = {
  id: string
  channel: EnquiryChannel
  itemId: string
  itemTitle: string
  itemHref: string
  name: string
  email: string
  accountId: string | null
  message: string
  status: EnquiryStatus
  createdAt: number
  doneAt?: number
}

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data')
const FILE = path.join(DIR, 'product-enquiries.json')
const MAX = 500

function readAll(): ProductEnquiry[] {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')) as unknown
    if (!Array.isArray(raw)) return []
    return raw.filter((row) => row && typeof row === 'object' && typeof (row as ProductEnquiry).id === 'string') as ProductEnquiry[]
  } catch {
    return []
  }
}

function writeAll(rows: ProductEnquiry[]) {
  fs.mkdirSync(DIR, { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(rows.slice(0, MAX), null, 2))
}

export function listProductEnquiries(opts?: { status?: EnquiryStatus }) {
  const rows = readAll().sort((a, b) => b.createdAt - a.createdAt)
  if (opts?.status) return rows.filter((r) => r.status === opts.status)
  return rows
}

export function countOpenProductEnquiries() {
  return readAll().filter((r) => r.status === 'open').length
}

export function createProductEnquiry(
  input: Omit<ProductEnquiry, 'id' | 'status' | 'createdAt'>,
): ProductEnquiry {
  const row: ProductEnquiry = {
    ...input,
    id: `ASK-${Date.now().toString(36).toUpperCase()}`,
    status: 'open',
    createdAt: Date.now(),
  }
  const rows = readAll()
  rows.unshift(row)
  writeAll(rows)
  return row
}

export function setProductEnquiryStatus(id: string, status: EnquiryStatus): ProductEnquiry | null {
  const rows = readAll()
  const i = rows.findIndex((r) => r.id === id)
  if (i < 0) return null
  const next: ProductEnquiry = {
    ...rows[i],
    status,
    doneAt: status === 'done' ? Date.now() : undefined,
  }
  rows[i] = next
  writeAll(rows)
  return next
}
