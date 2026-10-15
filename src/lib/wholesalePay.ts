import type { Invoice, InvoiceProfile, WholesalePayMethod } from '../types'

export const WHOLESALE_PAY_METHODS: WholesalePayMethod[] = ['bank', 'usdt', 'cash']

export const WHOLESALE_PAY_LABEL: Record<WholesalePayMethod, string> = {
  bank: 'Bank transfer',
  usdt: 'USDT',
  cash: 'Cash',
}

export const CASH_RECEIPT_MARKER = 'cash:on-collect'

export function isCashReceipt(data?: string | null) {
  return Boolean(data && data.startsWith('cash:'))
}

export function payMethodsForInvoice(inv: Invoice): WholesalePayMethod[] {
  const cashOk = (inv.fulfillmentMode || 'delivery') === 'pickup'
  return WHOLESALE_PAY_METHODS.filter((m) => (m === 'cash' ? cashOk : true))
}

export function defaultPayMethod(inv: Invoice): WholesalePayMethod {
  if (inv.payMethod && payMethodsForInvoice(inv).includes(inv.payMethod)) return inv.payMethod
  return 'bank'
}

/** Deep link that opens the buyer pay dialog for this invoice. */
export function wholesalePayLink(invoiceId: string, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const id = invoiceId.trim().toUpperCase()
  return `${origin}/account/invoices?pay=${encodeURIComponent(id)}`
}

export function wholesalePayMailto(opts: {
  to?: string
  invoiceId: string
  amountLabel?: string
  origin?: string
}) {
  const link = wholesalePayLink(opts.invoiceId, opts.origin)
  const subject = `Payment link · invoice ${opts.invoiceId}`
  const body = [
    `Please pay invoice ${opts.invoiceId}${opts.amountLabel ? ` (${opts.amountLabel})` : ''} using this link:`,
    '',
    link,
    '',
    'Sign in with your buyer account, then choose Bank / USDT / Cash and submit proof.',
  ].join('\n')
  return `mailto:${opts.to || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function payMethodHint(method: WholesalePayMethod, inv: Invoice, profile: InvoiceProfile) {
  const notice = profile.paymentNotice
  if (method === 'bank') {
    return [
      profile.paymentLead,
      `${profile.bankName} · ${profile.branchName}`,
      `SWIFT ${profile.swift} · Acct ${profile.accountNumber}`,
      `Beneficiary: ${profile.beneficiary}`,
      profile.bankFeesNote,
      notice,
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (method === 'usdt') {
    const wallet = (profile.usdtWallet || '').trim()
    const network = (profile.usdtNetwork || 'TRC-20').trim()
    const lines = [
      wallet
        ? `Send USDT (${network}) to ${wallet}`
        : `Ask ${profile.email || 'accounts'} for the USDT wallet + network (e.g. TRC-20).`,
      `Put invoice ${inv.id}${inv.accountId ? ` and buyer ${inv.accountId}` : ''} in the memo / note.`,
      'Upload the TX screenshot or paste the TX hash below.',
      notice,
    ]
    return lines.filter(Boolean).join('\n')
  }
  return [
    'Pay cash when you collect at the warehouse.',
    `Bring exact amount for invoice ${inv.id}.`,
    'Staff will mark paid on receipt — no bank slip needed.',
  ].join('\n')
}
