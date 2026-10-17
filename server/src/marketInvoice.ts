import type { Prisma } from '@prisma/client'
import { feeForMarketplace, withFee } from './feeConfig'

type Line = { lotId: string; qty: number; unitPrice: number }

const HK_OFFSET = 8 * 60 * 60 * 1000

export function marketDayStart(stamp: number) {
  const shifted = new Date(stamp + HK_OFFSET)
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - HK_OFFSET
}

function marketDayId(accountId: string, stamp: number) {
  const shifted = new Date(stamp + HK_OFFSET)
  const yy = String(shifted.getUTCFullYear()).slice(-2)
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(shifted.getUTCDate()).padStart(2, '0')
  const who = accountId.replace(/[^A-Za-z0-9]/g, '').slice(0, 16) || 'BUYER'
  return `MKT-${yy}${mm}${dd}-${who}`
}

/** Add purchase lines to today's draft marketplace invoice, or open that draft. */
export async function addMarketplaceLines(
  tx: Prisma.TransactionClient,
  accountId: string,
  lines: Line[],
  stamp: number,
  note: string,
) {
  const start = marketDayStart(stamp)
  const existing = await tx.invoice.findFirst({
    where: {
      accountId,
      channel: 'marketplace',
      status: 'draft',
      createdAt: { gte: BigInt(start), lt: BigInt(start + 86_400_000) },
    },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) {
    const extra = JSON.parse(existing.dataJson || '{}') as {
      lines?: Line[]
      remarks?: string
      feePct?: number
    }
    const previous = extra.lines?.length
      ? extra.lines
      : [{ lotId: existing.lotId, qty: existing.qty, unitPrice: existing.unitPrice }]
    const merged = [...previous, ...lines]
    const goods = merged.reduce((n, line) => n + line.qty * line.unitPrice, 0)
    const qty = merged.reduce((n, line) => n + line.qty, 0)
    const feePct = Number.isFinite(extra.feePct) ? Number(extra.feePct) : feeForMarketplace()
    const priced = withFee(goods, feePct)
    const updated = await tx.invoice.update({
      where: { id: existing.id },
      data: {
        amount: priced.total,
        qty,
        unitPrice: merged[0]?.unitPrice || existing.unitPrice,
        dataJson: JSON.stringify({
          ...extra,
          lines: merged,
          remarks: [extra.remarks, note].filter(Boolean).join(' · '),
          feePct: priced.feePct,
        }),
      },
    })
    return { invoice: updated, created: false }
  }

  const goods = lines.reduce((n, line) => n + line.qty * line.unitPrice, 0)
  const qty = lines.reduce((n, line) => n + line.qty, 0)
  const priced = withFee(goods, feeForMarketplace())
  let id = marketDayId(accountId, stamp)
  const clash = await tx.invoice.findUnique({ where: { id } })
  if (clash) id = `${id}-${stamp.toString().slice(-4)}`
  const created = await tx.invoice.create({
    data: {
      id,
      lotId: lines[0].lotId,
      channel: 'marketplace',
      amount: priced.total,
      qty,
      unitPrice: lines[0].unitPrice,
      status: 'draft',
      createdAt: BigInt(stamp),
      accountId,
      dataJson: JSON.stringify({ lines, remarks: note, feePct: priced.feePct }),
    },
  })
  return { invoice: created, created: true }
}
