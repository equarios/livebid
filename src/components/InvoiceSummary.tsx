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
    <div className="auction-desk-chips" aria-label="Invoice totals">
      <div
        className="filter-trigger is-static is-bid-chip"
        title="Paid + unpaid invoices on this page"
      >
        <span className="filter-trigger-title">Total amount</span>
        <span className="filter-trigger-value">{usd(total)}</span>
      </div>
      <div
        className="filter-trigger is-static is-win-chip"
        title={`${paidCount} paid invoice${paidCount === 1 ? '' : 's'}`}
      >
        <span className="filter-trigger-title">Paid</span>
        <span className="filter-trigger-value">{usd(paid)}</span>
      </div>
      <div
        className="filter-trigger is-static is-unpaid-chip"
        title={`${unpaidCount} unpaid invoice${unpaidCount === 1 ? '' : 's'}`}
      >
        <span className="filter-trigger-title">Unpaid</span>
        <span className="filter-trigger-value">{usd(unpaid)}</span>
      </div>
    </div>
  )
}
