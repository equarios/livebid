import { sendMail } from './mail'

function siteOrigin() {
  return (process.env.APP_ORIGIN || process.env.SITE_URL || 'http://localhost:5173').replace(
    /\/$/,
    '',
  )
}

function shipToBlock() {
  const custom = process.env.TRADE_IN_SHIP_TO?.trim()
  if (custom) return custom
  return 'Equarios Trade-in\n(Address will be confirmed in a follow-up email — reply if you need it sooner.)'
}

const STATUS_COPY: Record<
  string,
  { subject: string; blurb: (credit: string) => string }
> = {
  pending_receive: {
    subject: 'Ship your trade-in device',
    blurb: () => 'We’re waiting for your device. Pack it safely and ship it to us.',
  },
  received: {
    subject: 'Trade-in received — inspecting',
    blurb: () => 'Your device arrived. We’ll inspect it and confirm your credit shortly.',
  },
  accepted: {
    subject: 'Trade-in accepted',
    blurb: (credit) =>
      credit
        ? `Your trade-in was accepted. Final credit: ${credit}.`
        : 'Your trade-in was accepted. Final credit will show on your order.',
  },
  adjusted: {
    subject: 'Trade-in credit adjusted',
    blurb: (credit) =>
      credit
        ? `After inspection we adjusted your credit to ${credit}.`
        : 'After inspection we adjusted your trade-in credit. Check your order for details.',
  },
  rejected: {
    subject: 'Trade-in not accepted',
    blurb: () =>
      'We couldn’t accept this trade-in after inspection. We’ll contact you about returning the device if needed.',
  },
}

function moneyUsd(n: number) {
  return `$${Math.round(n * 100) / 100}`
}

/** Email after checkout when a trade-in is attached — ship-in instructions (carrier label API can plug in later). */
export async function sendTradeInShipInEmail(opts: {
  to: string
  name: string
  orderId: string
  tradeInId: string
  label: string
  imei: string
  provisionalCredit: number
  estimateLow: number
  estimateHigh: number
}) {
  const ordersUrl = `${siteOrigin()}/store/orders`
  const creditLine =
    opts.provisionalCredit > 0
      ? `Provisional cart credit: ${moneyUsd(opts.provisionalCredit)} (final after inspection).`
      : opts.estimateHigh > 0
        ? `Estimate range: ${moneyUsd(opts.estimateLow)} – ${moneyUsd(opts.estimateHigh)} (final after inspection).`
        : 'Final credit will be set after we inspect your device.'

  const text = [
    `Hi ${opts.name || 'there'},`,
    '',
    `Thanks for trading in with Equarios (order ${opts.orderId}).`,
    `Device: ${opts.label}`,
    opts.imei ? `IMEI: ${opts.imei}` : null,
    `Trade-in ID: ${opts.tradeInId}`,
    creditLine,
    '',
    'How to ship your device',
    '1. Factory reset and remove your Apple ID / Google account and SIM.',
    '2. Pack the phone with padding (box or padded envelope). Include a note with your order ID.',
    '3. Ship to:',
    shipToBlock(),
    '',
    'We aim to inspect within 48 hours of arrival. Track status anytime:',
    ordersUrl,
    '',
    '— Equarios Trade-in',
  ]
    .filter((line) => line != null)
    .join('\n')

  return sendMail({
    to: opts.to,
    subject: `[Equarios] Trade-in ship-in — ${opts.orderId}`,
    text,
  })
}

/** Email when staff moves trade-in QC status. */
export async function sendTradeInStatusEmail(opts: {
  to: string
  name: string
  orderId: string
  tradeInId: string
  label: string
  status: string
  finalCredit: number | null
  provisionalCredit: number
  staffNote?: string | null
}) {
  const copy = STATUS_COPY[opts.status] || {
    subject: 'Trade-in update',
    blurb: () => `Your trade-in status is now: ${opts.status.replace(/_/g, ' ')}.`,
  }
  const credit =
    opts.finalCredit != null && opts.finalCredit > 0
      ? moneyUsd(opts.finalCredit)
      : opts.provisionalCredit > 0
        ? moneyUsd(opts.provisionalCredit)
        : ''
  const ordersUrl = `${siteOrigin()}/store/orders`

  const text = [
    `Hi ${opts.name || 'there'},`,
    '',
    copy.blurb(credit),
    `Device: ${opts.label}`,
    `Order: ${opts.orderId}`,
    `Trade-in: ${opts.tradeInId}`,
    opts.staffNote?.trim() ? `Note: ${opts.staffNote.trim()}` : null,
    '',
    `View your order: ${ordersUrl}`,
    '',
    '— Equarios Trade-in',
  ]
    .filter((line) => line != null)
    .join('\n')

  return sendMail({
    to: opts.to,
    subject: `[Equarios] ${copy.subject} — ${opts.orderId}`,
    text,
  })
}
