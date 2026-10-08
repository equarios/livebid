import { usd } from '../lib/format'

export function InvoiceSummary({
  total,
  paid,
  unpaid,
  paidCount,
  unpaidCount,
}: {
  total: number
  paid: number
  unpaid: number
  paidCount: number
  unpaidCount: number
}) {
  return (
    <div className="auction-desk-kpis">
      <div className="auction-desk-stat">
        <span className="label">Total amount</span>
        <strong>{usd(total)}</strong>
        <span className="muted tiny">Paid + unpaid invoices on this page</span>
      </div>
      <div className="auction-desk-stat is-win">
        <span className="label">Paid</span>
        <strong>{usd(paid)}</strong>
        <span className="muted tiny">{paidCount} invoice{paidCount === 1 ? '' : 's'}</span>
      </div>
      <div className="auction-desk-stat is-lose">
        <span className="label">Unpaid</span>
        <strong>{usd(unpaid)}</strong>
        <span className="muted tiny">{unpaidCount} invoice{unpaidCount === 1 ? '' : 's'}</span>
      </div>
    </div>
  )
}
