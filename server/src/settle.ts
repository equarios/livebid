import { prisma } from './db'
import { allocate } from './allocate'
import { feeForAuctionType, withFee } from './feeConfig'
import { notify, notifyStaff } from './notify'

const ENDING_SOON_MS = 60 * 60 * 1000 // 1 hour default

function money(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function kdpInvoiceId(nowTs: number, accountId: string, slug: string) {
  const d = new Date(nowTs)
  const yy = String(d.getFullYear()).slice(-2)
  const start = Date.UTC(d.getFullYear(), 0, 0)
  const doy = String(Math.floor((nowTs - start) / 86400000)).padStart(3, '0')
  const tail = accountId.replace(/[^A-Z0-9]/gi, '').slice(-3).padStart(3, '0')
  const list = slug.replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase() || 'KDP'
  return `${list}-${yy}-${doy}-${tail}`
}

/** Create win invoices + notices for newly closed auctions. */
export async function settleClosedAuctions() {
  const now = Date.now()
  const lots = await prisma.lot.findMany({ where: { channel: 'auction' } })
  const closed = lots.filter((l) => Number(l.endsAt) <= now)
  if (!closed.length) return

  const bids = await prisma.bid.findMany({
    where: { lotId: { in: closed.map((l) => l.id) } },
  })
  const bidRows = bids.map((b) => ({
    lotId: b.lotId,
    accountId: b.accountId,
    amount: b.amount,
    qty: b.qty,
    at: Number(b.at),
  }))

  type Group = {
    accountId: string
    slug: string
    lines: Array<{ lotId: string; qty: number; unitPrice: number }>
    models: string[]
  }
  const groups = new Map<string, Group>()

  for (const lot of closed) {
    const slices = allocate({ id: lot.id, qty: lot.qty }, bidRows)
    for (const slice of slices) {
      if (!slice.qty || slice.accountId.startsWith('BOT-')) continue
      const existing = await prisma.invoice.findFirst({
        where: {
          accountId: slice.accountId,
          channel: 'auction',
          OR: [
            { lotId: lot.id },
            { dataJson: { contains: `"lotId":"${lot.id}"` } },
          ],
        },
      })
      if (existing) continue

      const slug = lot.auctionType || 'live'
      const key = `${slice.accountId}::${slug}`
      const row = groups.get(key) || { accountId: slice.accountId, slug, lines: [], models: [] }
      row.lines.push({ lotId: lot.id, qty: slice.qty, unitPrice: slice.unitPrice })
      row.models.push(lot.model)
      groups.set(key, row)
    }
  }

  for (const group of groups.values()) {
    let id = kdpInvoiceId(now, group.accountId, group.slug)
    const clash = await prisma.invoice.findUnique({ where: { id } })
    if (clash) id = `${id}-${group.lines[0].lotId.slice(-3)}`

    const goods = group.lines.reduce((n, l) => n + l.qty * l.unitPrice, 0)
    const qty = group.lines.reduce((n, l) => n + l.qty, 0)
    const feePct = feeForAuctionType(group.slug)
    const priced = withFee(goods, feePct)
    await prisma.invoice.create({
      data: {
        id,
        lotId: group.lines[0].lotId,
        channel: 'auction',
        amount: priced.total,
        qty,
        unitPrice: group.lines[0].unitPrice,
        status: 'draft',
        createdAt: BigInt(now),
        accountId: group.accountId,
        dataJson: JSON.stringify({
          lines: group.lines,
          auctionLabel: `JPN SIM Unlocked ${[...new Set(group.models)].slice(0, 3).join(' / ')} (${id})`,
          feePct: priced.feePct,
        }),
      },
    })

    await notify({
      id: `N-${id}`,
      accountId: group.accountId,
      kind: 'win',
      title: 'You won an auction',
      body: `${qty} pcs · ${money(priced.total)} USD. Invoice ${id} is with staff to issue.`,
      href: '/account/invoices',
    })

    await notifyStaff(
      'invoice',
      'Invoice waiting to be issued',
      `${id} · ${qty} pcs. Admin then Super must stamp it.`,
      '/admin',
      `N-ISSUE-${id}`,
    )
  }
}

/** Watchlist closing-soon notices (in-app always; email if pref on). */
export async function notifyClosingSoon() {
  const now = Date.now()
  const horizon = now + ENDING_SOON_MS
  const lots = await prisma.lot.findMany({
    where: { channel: 'auction' },
  })
  const soon = lots.filter((l) => {
    const ends = Number(l.endsAt)
    return ends > now && ends <= horizon
  })
  if (!soon.length) return

  for (const lot of soon) {
    const watchers = await prisma.watchItem.findMany({ where: { lotId: lot.id } })
    for (const w of watchers) {
      await notify({
        id: `N-CLOSE-${lot.id}-${w.accountId}`,
        accountId: w.accountId,
        kind: 'closing',
        title: 'Watchlist lot closing soon',
        body: `${lot.manufacturer} ${lot.model} · ${lot.id}`,
        href: `/auctions#${lot.auctionType || 'live'}`,
      })
    }
  }
}

export async function runCareJobs() {
  try {
    await settleClosedAuctions()
    await notifyClosingSoon()
  } catch (err) {
    console.error('Care jobs failed', err)
  }
}
