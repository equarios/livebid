import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { toastMsg } from '../lib/toast'
import { useStore } from '../store'

type ReturnRow = {
  lotId: string
  skuId: string
  model: string
  leftover: number
}

export function ReturnsDesk() {
  const { inventory, saveSku } = useStore()
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    let gone = false
    api
      .stockReturns()
      .then((res) => {
        if (!gone) setRows(res.returns)
      })
      .catch((e: unknown) => {
        if (!gone) setErr(e instanceof Error ? e.message : 'Could not load leftovers.')
      })
    return () => {
      gone = true
    }
  }, [])

  useEffect(() => load(), [load])

  async function decide(row: ReturnRow, decision: 'return' | 'leave') {
    setBusyId(row.lotId)
    setErr(null)
    try {
      const result = await api.decideStockReturn(row.lotId, decision)
      if (decision === 'return') {
        const sku = inventory.find((item) => item.id === row.skuId)
        if (sku) saveSku({ ...sku, onHand: result.onHand })
      }
      setRows((list) => list.filter((item) => item.lotId !== row.lotId))
      toastMsg(
        decision === 'return'
          ? `Returned ${result.leftover} pcs of ${row.model} to the warehouse.`
          : `Left ${row.leftover} pcs of ${row.model} out of the warehouse.`,
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save that decision.'
      setErr(message)
      toastMsg(message)
    }
    setBusyId(null)
  }

  return (
    <section className="mh-desk">
      <header className="mh-desk-head">
        <h2>
          Returns
          <em>{rows.length}</em>
        </h2>
        <p className="mh-desk-note">
          Leftover pieces from auctions that already took warehouse stock. Return adds them back once. Leave out keeps them out.
        </p>
        {err ? <p className="muted tiny">{err}</p> : null}
      </header>
      {!rows.length ? (
        <div className="mh-empty">
          <p>No leftovers waiting. Pieces show here after a launch took them from the warehouse and the auction has closed.</p>
        </div>
      ) : (
        <table className="gbs-table mh-table">
          <thead>
            <tr>
              <th>Lot</th>
              <th>Model</th>
              <th>Leftover</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.lotId}>
                <td>{row.lotId}</td>
                <td>{row.model}</td>
                <td>{row.leftover.toLocaleString('en-US')}</td>
                <td className="inv-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busyId === row.lotId}
                    onClick={() => void decide(row, 'return')}
                  >
                    Return to warehouse
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busyId === row.lotId}
                    onClick={() => void decide(row, 'leave')}
                  >
                    Leave out
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
