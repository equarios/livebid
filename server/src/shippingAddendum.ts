/** Create / refresh a pay-later shipping invoice after staff quotes delivery. */

import { prisma } from './db'
import { shippingAddendumId } from './fulfillment'
import { splitInvoiceRow } from './invoiceSettle'
import { notify } from './notify'

function money(n: number) {
  return `$${Math.round(n * 100) / 100}`
}

export type ShippingAddendumResult = {
  invoiceId: string | null
  created: boolean
  updated: boolean
}

/**
 * When delivery was TBD and staff quotes a fee > 0, open a separate unpaid
 * shipping invoice so the buyer can pay freight after goods.
 */
export async function ensureShippingAddendum(opts: {
  parentId: string
  accountId: string | null | undefined
  fee: number
  /** Was fee TBD before this quote? */
  wasUnquoted: boolean
  channel?: string
  lotId?: string
  shipAddress?: string
  shipEmail?: string
  shipPhone?: string
  shipCompany?: string
  /** Buyer-facing parent label (invoice or store order id). */
  parentLabel?: string
}): Promise<ShippingAddendumResult> {
  const fee = Math.round(Math.max(0, Number(opts.fee) || 0) * 100) / 100
  if (!opts.wasUnquoted || fee <= 0 || !opts.accountId) {
    return { invoiceId: null, created: false, updated: false }
  }

  const id = shippingAddendumId(opts.parentId)
  const now = Date.now()
  const parentLabel = opts.parentLabel || opts.parentId
  const channel = opts.channel || 'marketplace'
  const lotId = opts.lotId || 'SHIPPING'
  const payload = {
    id,
    lotId,
    channel,
    amount: fee,
    qty: 1,
    unitPrice: fee,
    status: 'unpaid',
    createdAt: now,
    accountId: opts.accountId,
    feePct: 0,
    issuedAt: now,
    shippingAddendum: true,
    parentInvoiceId: opts.parentId,
    fulfillmentMode: 'delivery',
    shippingFee: fee,
    shippingFeeQuoted: true,
    remarks: `Delivery for ${parentLabel}`,
    auctionLabel: `Shipping · ${parentLabel}`,
    shipAddress: opts.shipAddress,
    shipEmail: opts.shipEmail,
    shipPhone: opts.shipPhone,
    shipCompany: opts.shipCompany,
    lines: [
      {
        lotId: 'SHIPPING',
        qty: 1,
        unitPrice: fee,
        description: `Delivery freight for ${parentLabel}`,
      },
    ],
  }

  const existing = await prisma.invoice.findUnique({ where: { id } })
  const row = splitInvoiceRow(payload)

  if (existing) {
    const prev = (() => {
      try {
        return JSON.parse(existing.dataJson || '{}') as { shippingAddendum?: boolean }
      } catch {
        return {}
      }
    })()
    if (!prev.shippingAddendum && existing.status === 'paid') {
      return { invoiceId: existing.id, created: false, updated: false }
    }
    await prisma.invoice.update({
      where: { id },
      data: {
        amount: row.amount,
        qty: row.qty,
        unitPrice: row.unitPrice,
        status: existing.status === 'paid' ? 'paid' : 'unpaid',
        accountId: row.accountId,
        dataJson: row.dataJson,
      },
    })
    if (existing.status !== 'paid') {
      await notify({
        id: `N-${id}-UPD`,
        accountId: opts.accountId,
        kind: 'invoice',
        title: 'Shipping fee updated',
        body: `Delivery for ${parentLabel} is now ${money(fee)}. Pay invoice ${id}.`,
        href: '/account/invoices',
      })
    }
    return { invoiceId: id, created: false, updated: true }
  }

  await prisma.invoice.create({ data: row })
  await notify({
    id: `N-${id}`,
    accountId: opts.accountId,
    kind: 'invoice',
    title: 'Shipping due',
    body: `Delivery for ${parentLabel}: ${money(fee)}. Pay invoice ${id}.`,
    href: '/account/invoices',
  })
  return { invoiceId: id, created: true, updated: false }
}
