/** Count active pickup bookings for a date+slot (store orders + wholesale invoices). */

import { prisma } from './db'
import type { FulfillmentConfig } from './fulfillment'

export type SlotOccupancy = {
  slot: string
  booked: number
  cap: number
  remaining: number | null
  full: boolean
}

function parseExtra(dataJson: string | null | undefined): Record<string, unknown> {
  try {
    return JSON.parse(dataJson || '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

/** Active bookings for one date+slot. excludeOrderId / excludeInvoiceId ignore self on rebook. */
export async function countPickupBookings(opts: {
  date: string
  slot: string
  excludeOrderId?: string
  excludeInvoiceId?: string
}): Promise<number> {
  const { date, slot } = opts
  if (!date || !slot) return 0

  const storeCount = await prisma.storeOrder.count({
    where: {
      pickupDate: date,
      pickupSlot: slot,
      status: { notIn: ['cancelled', 'shipped'] },
      ...(opts.excludeOrderId ? { id: { not: opts.excludeOrderId } } : {}),
    },
  })

  const invRows = await prisma.invoice.findMany({
    where: {
      status: { not: 'declined' },
      dataJson: { contains: `"pickupDate":"${date}"` },
      ...(opts.excludeInvoiceId ? { id: { not: opts.excludeInvoiceId } } : {}),
    },
    select: { id: true, dataJson: true },
    take: 500,
  })
  const invCount = invRows.filter((row) => {
    const extra = parseExtra(row.dataJson)
    if (extra.shippingAddendum) return false
    return String(extra.pickupSlot || '') === slot && String(extra.pickupDate || '') === date
  }).length

  return storeCount + invCount
}

export async function slotOccupancyForDate(
  date: string,
  cfg: FulfillmentConfig,
): Promise<SlotOccupancy[]> {
  const cap = cfg.pickupSlotCap
  const out: SlotOccupancy[] = []
  for (const slot of cfg.pickupSlots) {
    const booked = await countPickupBookings({ date, slot })
    const remaining = cap > 0 ? Math.max(0, cap - booked) : null
    out.push({
      slot,
      booked,
      cap,
      remaining,
      full: cap > 0 && booked >= cap,
    })
  }
  return out
}

export async function assertPickupSlotOpen(opts: {
  date: string
  slot: string
  cfg: FulfillmentConfig
  excludeOrderId?: string
  excludeInvoiceId?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const cap = opts.cfg.pickupSlotCap
  if (cap <= 0) return { ok: true }
  const booked = await countPickupBookings({
    date: opts.date,
    slot: opts.slot,
    excludeOrderId: opts.excludeOrderId,
    excludeInvoiceId: opts.excludeInvoiceId,
  })
  if (booked >= cap) {
    return {
      ok: false,
      error: `That pickup window is full (${cap} max). Pick another time or day.`,
    }
  }
  return { ok: true }
}
