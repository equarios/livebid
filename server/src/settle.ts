import { allocate } from './allocate'
import { effectiveEndsAtMs, isInExtraSealed } from './auctionPhase'
import { runBuyerDigests } from './buyerDigest'
import { cacheDel, cacheSetNx } from './cache'
import { prisma } from './db'
import { feeForAuctionType, withFee } from './feeConfig'
import { trackCare } from './metrics'
import { notify, notifyStaff } from './notify'

const ENDING_SOON_MS = 60 * 60 * 1000 // 1 hour default
/** Only thank bidders on lots that closed recently (avoids backlog flood). */
const THANKS_WINDOW_MS = 48 * 60 * 60 * 1000

function isBotAccount(accountId: string) {
  return accountId.startsWith('BOT-')
}

async function bidderAccountIds(lotId: string): Promise<string[]> {
  const rows = await prisma.bid.findMany({
    where: { lotId },
    distinct: ['accountId'],
    select: { accountId: true },
  })
  return rows.map((r) => r.accountId).filter((id) => !isBotAccount(id))
}

function minsLeft(endsAtMs: number, now: number) {
  return Math.max(1, Math.round((endsAtMs - now) / 60_000))
}

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
  const nowBig = BigInt(now)
  const candidates = await prisma.lot.findMany({
    where: {
      channel: 'auction',
      endsAt: { lte: nowBig },
      OR: [{ extraSealedEndsAt: null }, { extraSealedEndsAt: { lte: nowBig } }],
    },
    orderBy: { endsAt: 'asc' },
    take: 500,
  })
  const closed = candidates.filter((l) => effectiveEndsAtMs(l) <= now)
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

      const raw = lot.auctionType || 'live'
      const slug = raw === 'sealed' || raw === 'hybrid' ? 'offline' : raw
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

    const items = [...new Set(group.models)].slice(0, 4).join(', ')
    const more = group.models.length > 4 ? ` +${group.models.length - 4} more` : ''
    await notify({
      id: `N-${id}`,
      accountId: group.accountId,
      kind: 'win',
      title: 'You won an auction',
      body: `${qty} pcs · ${money(priced.total)} USD · ${items}${more}. Invoice ${id} — open for line details.`,
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

  await notifyAuctionThanks(closed, bids, now)
}

/** Thank-you notice/email for every prior bidder when a lot fully closes. */
async function notifyAuctionThanks(
  closed: Array<{
    id: string
    manufacturer: string
    model: string
    auctionType: string | null
    endsAt: bigint | number
    extraSealedEndsAt?: bigint | number | null
  }>,
  bids: Array<{ lotId: string; accountId: string }>,
  now: number,
) {
  const recent = closed.filter((lot) => effectiveEndsAtMs(lot) > now - THANKS_WINDOW_MS)
  if (!recent.length) return

  const byLot = new Map<string, Set<string>>()
  for (const b of bids) {
    if (isBotAccount(b.accountId)) continue
    let set = byLot.get(b.lotId)
    if (!set) {
      set = new Set()
      byLot.set(b.lotId, set)
    }
    set.add(b.accountId)
  }

  for (const lot of recent) {
    const accounts = byLot.get(lot.id)
    if (!accounts?.size) continue
    const label = `${lot.manufacturer} ${lot.model}`
    for (const accountId of accounts) {
      await notify({
        id: `N-THANKS-${lot.id}-${accountId}`,
        accountId,
        kind: 'thanks',
        title: 'Thanks for joining',
        body: `${label} has closed. Thanks for bidding — check wins and invoices in your account.`,
        href: '/account/bids',
      })
    }
  }
}

/** Prior bidders when live → Extra sealed overtime starts (soft ping; email if sealed pref on). */
export async function notifySealedStarted() {
  const now = Date.now()
  const lots = await prisma.lot.findMany({
    where: {
      channel: 'auction',
      endsAt: { lte: BigInt(now) },
      extraSealedEndsAt: { gt: BigInt(now) },
    },
    take: 500,
  })
  for (const lot of lots) {
    if (!isInExtraSealed(lot, now)) continue
    const extraEnd = Number(lot.extraSealedEndsAt)
    const accounts = await bidderAccountIds(lot.id)
    const left = minsLeft(extraEnd, now)
    for (const accountId of accounts) {
      await notify({
        id: `N-SEALED-START-${lot.id}-${accountId}`,
        accountId,
        kind: 'sealed',
        title: 'Extra sealed is open — you can still bid',
        body: `${lot.manufacturer} ${lot.model} · ~${left}m left · prior bidders only`,
        href: '/wholesale?pulse=sealed',
      })
    }
  }
}

/**
 * Closing-soon notices (in-app always; email if pref on).
 * Live: watchlist. Sealed end: prior bidders only (separate notice id).
 */
export async function notifyClosingSoon() {
  const now = Date.now()
  const horizon = now + ENDING_SOON_MS

  const liveSoon = await prisma.lot.findMany({
    where: {
      channel: 'auction',
      endsAt: { gt: BigInt(now), lte: BigInt(horizon) },
    },
    take: 500,
  })
  for (const lot of liveSoon) {
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

  const sealedSoon = await prisma.lot.findMany({
    where: {
      channel: 'auction',
      endsAt: { lte: BigInt(now) },
      extraSealedEndsAt: { gt: BigInt(now), lte: BigInt(horizon) },
    },
    take: 500,
  })
  for (const lot of sealedSoon) {
    const accounts = await bidderAccountIds(lot.id)
    for (const accountId of accounts) {
      await notify({
        id: `N-SEALED-CLOSE-${lot.id}-${accountId}`,
        accountId,
        kind: 'closing',
        title: 'Sealed closing soon',
        body: `${lot.manufacturer} ${lot.model} · ${lot.id}`,
        href: `/auctions#${lot.auctionType || 'live'}`,
      })
    }
  }
}

/** Settle + Sealed / closing-soon / daily desk digest. Uses a short lock so API + worker never double-run. */
export async function runCareJobs() {
  const locked = await cacheSetNx('lock:care', String(Date.now()), 25)
  if (!locked) return
  try {
    await settleClosedAuctions()
    await notifySealedStarted()
    await notifyClosingSoon()
    await runBuyerDigests()
    trackCare(true)
  } catch (err) {
    trackCare(false)
    console.error('Care jobs failed', err)
  } finally {
    await cacheDel('lock:care').catch(() => undefined)
  }
}
