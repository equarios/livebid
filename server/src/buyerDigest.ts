import { myPcs } from './allocate'
import { prisma } from './db'
import { notify, parseEmailPrefs } from './notify'
import { isQuietHours } from './quietHours'
import { lotMatchesFilter, parseWatchFilters } from './watchFilters'

function effectiveEndsAt(lot: { endsAt: bigint; extraSealedEndsAt: bigint | null }) {
  const extra = lot.extraSealedEndsAt != null ? Number(lot.extraSealedEndsAt) : 0
  const ends = Number(lot.endsAt)
  return extra > ends ? extra : ends
}

/** Once-daily desk summary email for approved buyers (outbid · invoices · watch hits). */
export async function runBuyerDigests() {
  const hour = Number(process.env.CARE_DIGEST_HOUR)
  const targetHour = Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : 8
  const now = new Date()
  if (now.getUTCHours() !== targetHour) return
  if (isQuietHours(now)) return

  const dayKey = now.toISOString().slice(0, 10)
  const metaKey = 'buyer-digest-day'
  const meta = await prisma.appMeta.findUnique({ where: { key: metaKey } })
  if (meta?.value === dayKey) return

  await prisma.appMeta.upsert({
    where: { key: metaKey },
    create: { key: metaKey, value: dayKey },
    update: { value: dayKey },
  })

  const nowMs = Date.now()
  const accounts = await prisma.account.findMany({
    where: { wholesaleStatus: 'approved', status: 'active' },
    select: { accountId: true, emailPrefsJson: true, watchFiltersJson: true },
  })

  const openLots = await prisma.lot.findMany({
    where: {
      OR: [
        { channel: 'auction', endsAt: { gt: BigInt(nowMs) } },
        { channel: 'auction', extraSealedEndsAt: { gt: BigInt(nowMs) } },
        { channel: 'marketplace' },
      ],
    },
  })
  const openAuction = openLots.filter(
    (l) => l.channel === 'auction' && effectiveEndsAt(l) > nowMs,
  )
  const lotIds = openAuction.map((l) => l.id)
  const bidRows =
    lotIds.length > 0
      ? await prisma.bid.findMany({ where: { lotId: { in: lotIds } } })
      : []
  const bids = bidRows.map((b) => ({
    lotId: b.lotId,
    accountId: b.accountId,
    amount: b.amount,
    qty: b.qty,
    at: Number(b.at),
  }))
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ['unpaid', 'pending_review'] } },
    select: { accountId: true },
  })

  for (const acc of accounts) {
    const prefs = parseEmailPrefs(acc.emailPrefsJson)
    if (!prefs.digest) continue

    const mineLotIds = new Set(
      bids.filter((b) => b.accountId === acc.accountId).map((b) => b.lotId),
    )
    let outbid = 0
    for (const lot of openAuction) {
      if (!mineLotIds.has(lot.id)) continue
      const extra = lot.extraSealedEndsAt != null ? Number(lot.extraSealedEndsAt) : 0
      const ends = Number(lot.endsAt)
      if (extra > ends && nowMs > ends) continue
      const pcs = myPcs({ id: lot.id, qty: lot.qty }, bids, acc.accountId)
      if (pcs <= 0) outbid += 1
    }

    const invoicesDue = invoices.filter((i) => i.accountId === acc.accountId).length

    const filters = parseWatchFilters(acc.watchFiltersJson)
    const hitIds = new Set<string>()
    if (filters.length) {
      for (const lot of openLots) {
        if (lot.channel === 'auction' && effectiveEndsAt(lot) <= nowMs) continue
        if (filters.some((f) => lotMatchesFilter(lot, f))) hitIds.add(lot.id)
      }
    }
    const watchNew = await prisma.notice.count({
      where: {
        accountId: acc.accountId,
        kind: 'watch',
        at: { gte: BigInt(nowMs - 24 * 60 * 60 * 1000) },
      },
    })
    const watchHits = Math.max(watchNew, hitIds.size)

    if (!outbid && !invoicesDue && !watchHits) continue

    const origin = (process.env.APP_ORIGIN || 'http://localhost:5173').replace(/\/$/, '')
    const lines: string[] = []
    if (outbid) {
      lines.push(`${outbid} outbid → ${origin}/wholesale?pulse=outbid`)
    }
    if (invoicesDue) {
      lines.push(
        `${invoicesDue} invoice${invoicesDue === 1 ? '' : 's'} due → ${origin}/wholesale?pulse=invoice`,
      )
    }
    if (watchHits) {
      const label = watchNew
        ? `${watchNew} new watch match${watchNew === 1 ? '' : 'es'}`
        : `${watchHits} watch hit${watchHits === 1 ? '' : 's'}`
      lines.push(`${label} → ${origin}/wholesale?pulse=watch`)
    }

    const href = outbid
      ? '/wholesale?pulse=outbid'
      : invoicesDue
        ? '/wholesale?pulse=invoice'
        : '/wholesale?pulse=watch'

    await notify({
      id: `digest:${dayKey}:${acc.accountId}`,
      accountId: acc.accountId,
      kind: 'digest',
      title: 'Your Equarios desk today',
      body: lines.join('\n'),
      href,
    })
  }
}
