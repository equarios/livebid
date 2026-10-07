import { Link } from 'react-router-dom'
import { usd } from '../lib/format'
import { useStore } from '../store'

export function Invoices() {
  const { invoices, lots, payInvoice } = useStore()

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Invoices</h1>
          <p className="muted">Won auctions and marketplace purchases. Demo payments stay in this browser.</p>
        </div>
      </div>
      <div className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Lot</th>
              <th>Pcs</th>
              <th>Unit</th>
              <th>Total</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const lot = lots.find((l) => l.id === inv.lotId)
              return (
                <tr key={inv.id}>
                  <td>{inv.id}</td>
                  <td>
                    {lot ? (
                      <Link to={`/lots/${lot.id}`}>{lot.model}</Link>
                    ) : (
                      inv.lotId
                    )}
                  </td>
                  <td>{inv.qty} pcs</td>
                  <td>{usd(inv.unitPrice)}</td>
                  <td>{usd(inv.amount)}</td>
                  <td>
                    <span className={`pill ${inv.status === 'paid' ? 'pill-live' : 'pill-sealed'}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td>
                    {inv.status === 'unpaid' ? (
                      <button className="btn btn-primary" type="button" onClick={() => payInvoice(inv.id)}>
                        Mark paid
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!invoices.length ? <p className="empty">No invoices yet. Buy a marketplace lot to generate one.</p> : null}
      </div>
    </div>
  )
}
