import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { MyPageHead } from '../components/MyPageHead'
import { api } from '../lib/api'
import { downloadCsv } from '../lib/csv'

type PackSummary = {
  id: string
  title: string
  accountId: string | null
  invoiceId: string | null
  note: string | null
  createdAt: string
  rowCount: number
}

type Match = {
  imei: string
  unlockCode: string
  model: string | null
  box: string | null
  packId: string
  packTitle: string
  invoiceId: string | null
}

export function ImeiPage() {
  const [packs, setPacks] = useState<PackSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await api.imeiPacks()
      setPacks(res.packs)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load IMEI packs.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function onSearch(e: FormEvent) {
    e.preventDefault()
    const query = q.replace(/[\s-]/g, '').trim()
    if (query.length < 8) {
      setErr('Enter at least 8 digits of the IMEI.')
      setMatches(null)
      return
    }
    setSearching(true)
    setErr(null)
    try {
      const res = await api.searchImei(query)
      setMatches(res.matches)
      if (!res.matches.length) setErr('No match in your packs.')
    } catch (e) {
      setMatches(null)
      setErr(e instanceof Error ? e.message : 'Search failed.')
    } finally {
      setSearching(false)
    }
  }

  async function downloadPack(pack: PackSummary) {
    setErr(null)
    try {
      const res = await api.imeiPack(pack.id)
      const slug = pack.invoiceId || pack.id.slice(0, 8)
      downloadCsv(
        `imei-${slug}.csv`,
        ['imei', 'unlockCode', 'model', 'box'],
        res.devices.map((d) => [d.imei, d.unlockCode, d.model || '', d.box || '']),
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Download failed.')
    }
  }

  return (
    <div className="imei-page">
      <MyPageHead
        title="IMEI"
        count={loading ? '…' : packs.length}
        note="Search one device or download a pack CSV."
        trust={[
          { to: '/account/invoices', label: 'Invoice' },
          { to: '/account/documents', label: 'Documents' },
        ]}
      />

      <form className="imei-search help-panel" onSubmit={(e) => void onSearch(e)}>
        <h3 className="mypage-panel-label">Look up</h3>
        <div className="imei-search-row">
          <label className="imei-search-field">
            <span className="sr-only">IMEI</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Paste IMEI (14–16 digits)"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {err ? <p className="tiny imei-err">{err}</p> : null}

      {matches && matches.length > 0 ? (
        <div className="table-wrap imei-results help-panel">
          <h3 className="mypage-panel-label">Match</h3>
          <table className="gbs-table auction-table">
            <thead>
              <tr>
                <th>IMEI</th>
                <th>Unlock code</th>
                <th>Model</th>
                <th>Box</th>
                <th>Pack</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={`${m.packId}-${m.imei}`}>
                  <td className="mono">{m.imei}</td>
                  <td className="mono strong">{m.unlockCode}</td>
                  <td>{m.model || '—'}</td>
                  <td>{m.box || '—'}</td>
                  <td>
                    {m.packTitle}
                    {m.invoiceId ? <div className="muted tiny mono">{m.invoiceId}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <section className="imei-packs help-panel" aria-label="Your packs">
        <h3 className="mypage-panel-label">Your packs</h3>
        {loading ? (
          <p className="muted tiny">Loading…</p>
        ) : packs.length === 0 ? (
          <div className="mh-empty shop-empty">
            <p>No IMEI packs assigned yet. Staff upload and assign after shipping.</p>
          </div>
        ) : (
          <ul className="imei-pack-list">
            {packs.map((p) => (
              <li key={p.id}>
                <div className="imei-pack-copy">
                  <strong>{p.title}</strong>
                  <span className="muted tiny">
                    {p.rowCount} device{p.rowCount === 1 ? '' : 's'}
                    {p.invoiceId ? ` · ${p.invoiceId}` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void downloadPack(p)}
                >
                  Download CSV
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
