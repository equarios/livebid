import { useCallback, useEffect, useState } from 'react'
import { api, type CompanyResultDto } from '../lib/api'
import { usd } from '../lib/format'
import { toastMsg } from '../lib/toast'

type Preset = 'today' | 'days7' | 'month' | 'quarter' | 'year' | 'lastyear' | 'all' | 'custom'

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'days7', label: '7 days' },
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'This quarter' },
  { id: 'year', label: 'This year' },
  { id: 'lastyear', label: 'Last year' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'From–to' },
]

type CostRow = { id: string; model: string; spec: string; onHand: number; unitCost: number | null }

export function ResultDesk() {
  const [preset, setPreset] = useState<Preset>('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [result, setResult] = useState<CompanyResultDto | null>(null)
  const [costs, setCosts] = useState<CostRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadResult = useCallback(async (next: Preset, fromDay: string, toDay: string) => {
    const q =
      next === 'custom' ? `preset=custom&from=${encodeURIComponent(fromDay)}&to=${encodeURIComponent(toDay)}` : `preset=${next}`
    const res = await api.companyResult(q)
    setResult(res)
  }, [])

  useEffect(() => {
    let gone = false
    api
      .companyCosts()
      .then((res) => {
        if (gone) return
        setCosts(res.skus)
        setDrafts(Object.fromEntries(res.skus.map((sku) => [sku.id, sku.unitCost == null ? '' : String(sku.unitCost)])))
      })
      .catch((e: unknown) => {
        if (!gone) setErr(e instanceof Error ? e.message : 'Could not load costs.')
      })
    return () => {
      gone = true
    }
  }, [])

  useEffect(() => {
    if (preset === 'custom' && (!from || !to)) return
    let gone = false
    void loadResult(preset, from, to).catch((e: unknown) => {
      if (!gone) setErr(e instanceof Error ? e.message : 'Could not load the result.')
    })
    return () => {
      gone = true
    }
  }, [preset, from, to, loadResult])

  async function saveCost(id: string, label: string) {
    const raw = (drafts[id] ?? '').trim()
    const unitCost = raw === '' ? null : Number(raw)
    if (unitCost != null && (!Number.isFinite(unitCost) || unitCost < 0)) {
      setErr('Cost must be zero or more.')
      return
    }
    setBusyId(id)
    setErr(null)
    try {
      const saved = await api.saveCompanyCost(id, unitCost)
      setCosts((list) => list.map((item) => (item.id === id ? { ...item, unitCost: saved.unitCost } : item)))
      toastMsg(saved.unitCost == null ? `Cleared cost for ${label}` : `Saved cost for ${label}`)
      if (preset !== 'custom' || (from && to)) await loadResult(preset, from, to)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save that cost.'
      setErr(message)
      toastMsg(message)
    }
    setBusyId(null)
  }

  return (
    <section className="mh-desk">
      <header className="mh-desk-head">
        <h2>Company result</h2>
        <p className="mh-desk-note">
          Gross profit uses original cost, which only Super can see. Sales with no cost stay out of profit.
          Still owed and stock on hand are the current position, not the selected range.
        </p>
      </header>
      <div className="result-range">
        <nav className="result-range-track" aria-label="Result range">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={preset === item.id ? 'active' : undefined}
              aria-pressed={preset === item.id}
              onClick={() => setPreset(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        {preset === 'custom' ? (
          <div className="result-range-dates">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
            <span aria-hidden="true">–</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
          </div>
        ) : null}
      </div>
      {err ? <p className="muted tiny">{err}</p> : null}
      {result ? (
        <table className="gbs-table mh-table">
          <tbody>
            <tr>
              <th>Collected goods</th>
              <td>{usd(result.collectedGoods)}</td>
            </tr>
            <tr>
              <th>Fees kept</th>
              <td>{usd(result.collectedFees)}</td>
            </tr>
            <tr>
              <th>Cost of goods</th>
              <td>{usd(result.costOfGoods)}</td>
            </tr>
            <tr>
              <th>Written off</th>
              <td>{usd(result.writtenOff)}</td>
            </tr>
            <tr>
              <th>Gross profit</th>
              <td>{usd(result.grossProfit)}</td>
            </tr>
            <tr>
              <th>Cost missing</th>
              <td>
                {usd(result.missingSales)}
                {result.missingPcs ? ` · ${result.missingPcs} pcs` : ''}
                {result.missingWriteoffPcs ? ` · write-off ${result.missingWriteoffPcs} pcs` : ''}
              </td>
            </tr>
            <tr>
              <th>Still owed now</th>
              <td>
                {usd(result.owedGoods)} goods
                {result.owedFees ? ` · ${usd(result.owedFees)} fees` : ''}
              </td>
            </tr>
            <tr>
              <th>Stock still owned</th>
              <td>
                {usd(result.stockValue)}
                {result.stockUncostedPcs ? ` · ${result.stockUncostedPcs} pcs with no cost` : ''}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="muted tiny">{preset === 'custom' && (!from || !to) ? 'Choose both dates.' : 'Loading result…'}</p>
      )}

      {result?.missing.length ? (
        <>
          <header className="mh-desk-head">
            <h2>Cost missing</h2>
            <p className="mh-desk-note">
              These pieces are in the range above and are left out of gross profit. Enter a cost where the device is known.
            </p>
          </header>
          <table className="gbs-table mh-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Pcs</th>
                <th>Amount</th>
                <th>Cost / pc</th>
              </tr>
            </thead>
            <tbody>
              {result.missing.map((row) => (
                <tr key={row.key}>
                  <td>
                    {row.label}
                    {row.kind === 'writeoff' ? <span className="muted tiny"> Write-off</span> : null}
                    {row.kind === 'unlinked' ? <span className="muted tiny"> Not linked</span> : null}
                  </td>
                  <td>{row.pcs}</td>
                  <td>{row.kind === 'writeoff' ? '—' : usd(row.amount)}</td>
                  <td>
                    {row.skuId ? (
                      <span className="result-gap-cost">
                        <input
                          inputMode="decimal"
                          aria-label={`Cost for ${row.label}`}
                          value={drafts[row.skuId] ?? ''}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [row.skuId!]: e.target.value }))}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === row.skuId}
                          onClick={() => void saveCost(row.skuId!, row.label)}
                        >
                          Save
                        </button>
                      </span>
                    ) : (
                      <span className="muted tiny">No warehouse device</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <header className="mh-desk-head">
        <h2>Original cost</h2>
        <p className="mh-desk-note">What the company paid per piece. Admin and buyers never receive this.</p>
      </header>
      {!costs.length ? (
        <div className="mh-empty">
          <p>No warehouse devices yet.</p>
        </div>
      ) : (
        <table className="gbs-table mh-table">
          <thead>
            <tr>
              <th>Device</th>
              <th>On hand</th>
              <th>Cost / pc</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {costs.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.model}
                  {row.spec ? <span className="muted tiny"> {row.spec}</span> : null}
                </td>
                <td>{row.onHand}</td>
                <td>
                  <input
                    inputMode="decimal"
                    aria-label={`Cost for ${row.model}`}
                    value={drafts[row.id] ?? ''}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  />
                </td>
                <td>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === row.id} onClick={() => void saveCost(row.id, row.model)}>
                    Save
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
