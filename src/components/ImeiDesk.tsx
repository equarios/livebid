import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { downloadCsv, parseImeiCsv, type CsvImeiRow } from '../lib/csv'
import { useStore } from '../store'

type PackSummary = {
  id: string
  title: string
  accountId: string | null
  invoiceId: string | null
  note: string | null
  createdBy: string
  createdAt: string
  rowCount: number
  company: string | null
}

type Device = {
  id: string
  imei: string
  unlockCode: string
  model: string | null
  box: string | null
}

type SearchMatch = {
  id: string
  imei: string
  unlockCode: string
  model: string | null
  box: string | null
  packId: string
  packTitle: string
  invoiceId: string | null
  accountId: string | null
}

const emptyRow = { imei: '', unlockCode: '', model: '', box: '' }

export function ImeiDesk() {
  const { accounts, invoices } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [packs, setPacks] = useState<PackSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [accountId, setAccountId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [note, setNote] = useState('')
  const [pendingRows, setPendingRows] = useState<CsvImeiRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [appendTo, setAppendTo] = useState('')

  const [openId, setOpenId] = useState<string | null>(null)
  const [openPack, setOpenPack] = useState<PackSummary | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [deviceFilter, setDeviceFilter] = useState('')
  const [addRow, setAddRow] = useState(emptyRow)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState(emptyRow)
  const addImeiRef = useRef<HTMLInputElement>(null)

  const [searchQ, setSearchQ] = useState('')
  const [matches, setMatches] = useState<SearchMatch[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [browseQ, setBrowseQ] = useState('')
  const [browseBuyer, setBrowseBuyer] = useState('')
  const [browsePack, setBrowsePack] = useState('')
  const [browseInvoice, setBrowseInvoice] = useState('')
  const [browseRows, setBrowseRows] = useState<SearchMatch[]>([])
  const [browseTotal, setBrowseTotal] = useState(0)
  const [browsing, setBrowsing] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const buyers = accounts.filter((a) => a.role === 'member' && a.status === 'active')
  const buyerInvoices = invoices
    .filter((i) => !accountId || i.accountId === accountId)
    .slice(0, 80)

  function downloadDeviceCsv(filename: string, rows: SearchMatch[]) {
    downloadCsv(
      filename,
      ['imei', 'unlockCode', 'model', 'box', 'pack', 'accountId', 'invoiceId'],
      rows.map((d) => [
        d.imei,
        d.unlockCode,
        d.model || '',
        d.box || '',
        d.packTitle,
        d.accountId || '',
        d.invoiceId || '',
      ]),
    )
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await api.imeiPacks()
      setPacks(res.packs)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load packs.')
    } finally {
      setLoading(false)
    }
  }, [])

  async function loadBrowse(filters?: {
    q?: string
    accountId?: string
    packId?: string
    invoiceId?: string
  }) {
    const q = (filters?.q ?? browseQ).trim()
    const account = filters?.accountId ?? browseBuyer
    const pack = filters?.packId ?? browsePack
    const inv = filters?.invoiceId ?? browseInvoice
    setBrowsing(true)
    setErr(null)
    try {
      const res = await api.browseImeiDevices({
        q: q || undefined,
        accountId: account || undefined,
        packId: pack || undefined,
        invoiceId: inv || undefined,
        take: 500,
        skip: 0,
      })
      setBrowseRows(res.devices)
      setBrowseTotal(res.total)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Browse failed.')
    } finally {
      setBrowsing(false)
    }
  }

  const loadPack = useCallback(async (id: string) => {
    setBusy(true)
    setErr(null)
    try {
      const res = await api.imeiPack(id)
      setOpenId(id)
      setOpenPack(res.pack)
      setDevices(res.devices)
      setEditingId(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to open pack.')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    void loadBrowse({ q: '', accountId: '', packId: '', invoiceId: '' })
    // initial pack list + full device browse
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, [refresh])

  function onFile(file: File | null) {
    if (!file) return
    setErr(null)
    setMsg(null)
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseImeiCsv(String(reader.result || ''))
      if (parsed.error) {
        setPendingRows(null)
        setErr(parsed.error)
        return
      }
      setPendingRows(parsed.rows)
      setMsg(`Parsed ${parsed.rows.length} row(s) from ${file.name}.`)
      if (!title.trim()) {
        setTitle(file.name.replace(/\.csv$/i, '').slice(0, 80) || 'IMEI pack')
      }
    }
    reader.readAsText(file)
  }

  async function createPack(e: FormEvent) {
    e.preventDefault()
    const packTitle =
      title.trim() ||
      `Pack ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`
    if (appendTo && !pendingRows?.length) {
      setErr('Pick a CSV to merge into that pack, or clear “Append CSV to pack” to create a new one.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      if (appendTo && pendingRows?.length) {
        const res = await api.appendImeiRows(
          appendTo,
          pendingRows.map((r) => ({
            imei: r.imei,
            unlockCode: r.unlockCode,
            model: r.model,
            box: r.box,
          })),
        )
        setMsg(`Updated pack — ${res.upserted} row(s), ${res.pack.rowCount} total.`)
        await loadPack(appendTo)
      } else {
        const res = await api.createImeiPack({
          title: packTitle,
          accountId: accountId || null,
          invoiceId: invoiceId || null,
          note: note.trim() || null,
          rows: (pendingRows || []).map((r) => ({
            imei: r.imei,
            unlockCode: r.unlockCode,
            model: r.model,
            box: r.box,
          })),
        })
        const n = res.pack.rowCount
        setMsg(
          n
            ? `Created “${res.pack.title}” with ${n} device(s).`
            : `Created empty pack “${res.pack.title}”. Add devices below.`,
        )
        await loadPack(res.pack.id)
        void loadBrowse()
        queueMicrotask(() => addImeiRef.current?.focus())
      }
      setPendingRows(null)
      setTitle('')
      setNote('')
      setInvoiceId('')
      setAppendTo('')
      if (fileRef.current) fileRef.current.value = ''
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed.')
      titleRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  async function assign(pack: PackSummary, nextAccount: string) {
    setBusy(true)
    setErr(null)
    try {
      await api.updateImeiPack(pack.id, { accountId: nextAccount || null })
      setMsg(nextAccount ? `Assigned to ${nextAccount}.` : 'Unassigned pack.')
      await refresh()
      if (openId === pack.id) await loadPack(pack.id)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Assign failed.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(pack: PackSummary) {
    if (!confirm(`Delete pack “${pack.title}” (${pack.rowCount} devices)?`)) return
    setBusy(true)
    try {
      await api.deleteImeiPack(pack.id)
      setMsg(`Deleted ${pack.title}.`)
      if (openId === pack.id) {
        setOpenId(null)
        setOpenPack(null)
        setDevices([])
      }
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed.')
    } finally {
      setBusy(false)
    }
  }

  async function downloadPack(pack: PackSummary) {
    try {
      const res = openId === pack.id ? { devices } : (await api.imeiPack(pack.id))
      downloadCsv(
        `imei-${pack.id.slice(0, 8)}.csv`,
        ['imei', 'unlockCode', 'model', 'box'],
        res.devices.map((d) => [d.imei, d.unlockCode, d.model || '', d.box || '']),
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Download failed.')
    }
  }

  async function addDevice(e: FormEvent) {
    e.preventDefault()
    if (!openId) return
    setBusy(true)
    setErr(null)
    try {
      await api.appendImeiRows(openId, [
        {
          imei: addRow.imei,
          unlockCode: addRow.unlockCode,
          model: addRow.model || undefined,
          box: addRow.box || undefined,
        },
      ])
      setAddRow(emptyRow)
      setMsg('Device added.')
      await loadPack(openId)
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Add failed.')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(d: Device) {
    setEditingId(d.id)
    setEditRow({
      imei: d.imei,
      unlockCode: d.unlockCode,
      model: d.model || '',
      box: d.box || '',
    })
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editingId || !openId) return
    setBusy(true)
    setErr(null)
    try {
      await api.updateImeiDevice(editingId, {
        imei: editRow.imei,
        unlockCode: editRow.unlockCode,
        model: editRow.model || null,
        box: editRow.box || null,
      })
      setEditingId(null)
      setMsg('Device updated.')
      await loadPack(openId)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteDevice(d: Device) {
    if (!confirm(`Remove IMEI ${d.imei}?`)) return
    setBusy(true)
    setErr(null)
    try {
      await api.deleteImeiDevice(d.id)
      setMsg(`Removed ${d.imei}.`)
      if (openId) await loadPack(openId)
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed.')
    } finally {
      setBusy(false)
    }
  }

  async function onSearch(e: FormEvent) {
    e.preventDefault()
    const q = searchQ.trim()
    if (q.length < 2) {
      setErr('Enter at least 2 characters (IMEI, unlock, buyer, pack, or invoice).')
      setMatches(null)
      return
    }
    setSearching(true)
    setErr(null)
    try {
      const res = await api.searchImei(q)
      setMatches(res.matches)
      if (!res.matches.length) setErr('No match in any pack.')
    } catch (e) {
      setMatches(null)
      setErr(e instanceof Error ? e.message : 'Search failed.')
    } finally {
      setSearching(false)
    }
  }

  function downloadTemplate() {
    downloadCsv(
      'imei-unlock-template.csv',
      ['imei', 'unlockCode', 'model', 'box'],
      [
        ['356938035643809', '12345678', 'iPhone 13', 'B01'],
        ['356938035643817', '87654321', 'iPhone 13', 'B01'],
      ],
    )
  }

  const filteredDevices = deviceFilter.trim()
    ? devices.filter((d) => {
        const f = deviceFilter.replace(/[\s-]/g, '').toLowerCase()
        return (
          d.imei.includes(f) ||
          d.unlockCode.toLowerCase().includes(deviceFilter.toLowerCase()) ||
          (d.model || '').toLowerCase().includes(deviceFilter.toLowerCase()) ||
          (d.box || '').toLowerCase().includes(deviceFilter.toLowerCase())
        )
      })
    : devices

  return (
    <section className="mh-desk imei-desk">
      <header className="mh-desk-head">
        <h2>IMEI unlock packs</h2>
        <p className="mh-desk-note">
          Manage packs in the app or bulk-upload CSV. Clients only see packs assigned to them.
        </p>
      </header>

      <form className="imei-search imei-staff-search" onSubmit={(e) => void onSearch(e)}>
        <label className="field">
          <span>Quick search (all packs)</span>
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="IMEI, unlock code, buyer, pack, or invoice"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" className="btn btn-primary btn-sm" disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </button>
        {matches && matches.length > 0 ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => downloadDeviceCsv(`imei-search-${matches.length}.csv`, matches)}
          >
            Download results ({matches.length})
          </button>
        ) : null}
      </form>

      {matches && matches.length > 0 ? (
        <div className="table-wrap imei-results">
          <table className="auction-table">
            <thead>
              <tr>
                <th>IMEI</th>
                <th>Unlock</th>
                <th>Model</th>
                <th>Pack</th>
                <th>Buyer</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.id}>
                  <td className="mono">{m.imei}</td>
                  <td className="mono strong">{m.unlockCode}</td>
                  <td>{m.model || '—'}</td>
                  <td>
                    {m.packTitle}
                    {m.invoiceId ? <div className="muted tiny mono">{m.invoiceId}</div> : null}
                  </td>
                  <td className="mono tiny">{m.accountId || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void loadPack(m.packId)}
                    >
                      Open pack
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="imei-browse">
        <h3>Browse all devices</h3>
        <p className="muted tiny">
          Filter across every pack — unlock codes included. No need to open packs one by one.
        </p>
        <form
          className="imei-browse-filters"
          onSubmit={(e) => {
            e.preventDefault()
            void loadBrowse()
          }}
        >
          <label className="field">
            <span>Contains</span>
            <input
              value={browseQ}
              onChange={(e) => setBrowseQ(e.target.value)}
              placeholder="IMEI / unlock / model / pack…"
            />
          </label>
          <label className="field">
            <span>Buyer</span>
            <select value={browseBuyer} onChange={(e) => setBrowseBuyer(e.target.value)}>
              <option value="">All buyers</option>
              {buyers.map((a) => (
                <option key={a.accountId} value={a.accountId}>
                  {a.accountId}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Pack</span>
            <select value={browsePack} onChange={(e) => setBrowsePack(e.target.value)}>
              <option value="">All packs</option>
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.rowCount})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Invoice</span>
            <select value={browseInvoice} onChange={(e) => setBrowseInvoice(e.target.value)}>
              <option value="">All invoices</option>
              {invoices.slice(0, 100).map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.id}
                </option>
              ))}
            </select>
          </label>
          <div className="imei-browse-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={browsing}>
              {browsing ? 'Loading…' : 'Apply'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!browseRows.length}
              onClick={() =>
                downloadDeviceCsv(`imei-browse-${browseRows.length}.csv`, browseRows)
              }
            >
              Download CSV ({browseTotal})
            </button>
          </div>
        </form>
        <div className="table-wrap imei-results">
          <table className="auction-table">
            <thead>
              <tr>
                <th>IMEI</th>
                <th>Unlock</th>
                <th>Model</th>
                <th>Box</th>
                <th>Pack</th>
                <th>Buyer</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {browseRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    {browsing ? 'Loading…' : 'No devices match these filters.'}
                  </td>
                </tr>
              ) : (
                browseRows.map((m) => (
                  <tr key={m.id}>
                    <td className="mono">{m.imei}</td>
                    <td className="mono strong">{m.unlockCode}</td>
                    <td>{m.model || '—'}</td>
                    <td>{m.box || '—'}</td>
                    <td>
                      {m.packTitle}
                      {m.invoiceId ? <div className="muted tiny mono">{m.invoiceId}</div> : null}
                    </td>
                    <td className="mono tiny">{m.accountId || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => void loadPack(m.packId)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {browseTotal > browseRows.length ? (
          <p className="muted tiny">
            Showing {browseRows.length} of {browseTotal}. Narrow filters to download a full set, or
            open a pack for that pack’s complete CSV.
          </p>
        ) : null}
      </div>

      <div className="imei-desk-toolbar">
        <button type="button" className="btn btn-ghost btn-sm" onClick={downloadTemplate}>
          Template CSV
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
          Refresh
        </button>
      </div>

      <form className="imei-upload" onSubmit={(e) => void createPack(e)}>
        <label className="field">
          <span>CSV file (optional)</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => onFile(e.target.files?.[0] || null)}
          />
        </label>
        <label className="field">
          <span>Pack title</span>
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional — auto-named if empty"
          />
        </label>
        <label className="field">
          <span>Assign buyer</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Unassigned (staff only)</option>
            {buyers.map((a) => (
              <option key={a.accountId} value={a.accountId}>
                {a.accountId} — {a.company}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Invoice (optional)</span>
          <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
            <option value="">None</option>
            {buyerInvoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.id}
                {inv.accountId ? ` · ${inv.accountId}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Append CSV to pack</span>
          <select value={appendTo} onChange={(e) => setAppendTo(e.target.value)}>
            <option value="">Create new pack</option>
            {packs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.rowCount})
              </option>
            ))}
          </select>
        </label>
        <label className="field imei-note-field">
          <span>Note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional staff note" />
        </label>
        <div className="imei-upload-actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            {appendTo && pendingRows?.length
              ? 'Merge CSV into pack'
              : pendingRows?.length
                ? 'Create pack from CSV'
                : 'Create empty pack'}
          </button>
          {pendingRows ? (
            <span className="muted tiny">{pendingRows.length} CSV row(s) ready</span>
          ) : (
            <span className="muted tiny">No CSV needed — create empty, then add devices below</span>
          )}
        </div>
      </form>

      {msg ? <p className="tiny imei-msg">{msg}</p> : null}
      {err ? <p className="tiny imei-err">{err}</p> : null}

      <div className="table-wrap">
        <table className="auction-table">
          <thead>
            <tr>
              <th>Pack</th>
              <th>Buyer</th>
              <th>Invoice</th>
              <th className="num">Devices</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="muted">
                  Loading…
                </td>
              </tr>
            ) : packs.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No packs yet. Create one above.
                </td>
              </tr>
            ) : (
              packs.map((p) => (
                <tr key={p.id} className={openId === p.id ? 'is-open-pack' : undefined}>
                  <td>
                    <strong>{p.title}</strong>
                    {p.note ? <div className="muted tiny">{p.note}</div> : null}
                  </td>
                  <td>
                    <select
                      className="imei-assign"
                      value={p.accountId || ''}
                      disabled={busy}
                      onChange={(e) => void assign(p, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {buyers.map((a) => (
                        <option key={a.accountId} value={a.accountId}>
                          {a.accountId}
                        </option>
                      ))}
                    </select>
                    {p.company ? <div className="muted tiny">{p.company}</div> : null}
                  </td>
                  <td className="mono tiny">{p.invoiceId || '—'}</td>
                  <td className="num">{p.rowCount}</td>
                  <td className="imei-row-actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => void loadPack(p.id)}>
                      {openId === p.id ? 'Reload' : 'Open'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void downloadPack(p)}>
                      CSV
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove(p)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {openPack && openId ? (
        <div className="imei-pack-detail">
          <header className="imei-pack-detail-head">
            <div>
              <h3>{openPack.title}</h3>
              <p className="muted tiny">
                {devices.length} device{devices.length === 1 ? '' : 's'}
                {openPack.accountId ? ` · ${openPack.accountId}` : ' · unassigned'}
                {openPack.invoiceId ? ` · ${openPack.invoiceId}` : ''}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setOpenId(null)
                setOpenPack(null)
                setDevices([])
              }}
            >
              Close
            </button>
          </header>

          <form className="imei-add-row" onSubmit={(e) => void addDevice(e)}>
            <label className="field">
              <span>IMEI</span>
              <input
                ref={addImeiRef}
                value={addRow.imei}
                onChange={(e) => setAddRow((r) => ({ ...r, imei: e.target.value }))}
                placeholder="14–16 digits"
                required
                inputMode="numeric"
              />
            </label>
            <label className="field">
              <span>Unlock code</span>
              <input
                value={addRow.unlockCode}
                onChange={(e) => setAddRow((r) => ({ ...r, unlockCode: e.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>Model</span>
              <input
                value={addRow.model}
                onChange={(e) => setAddRow((r) => ({ ...r, model: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>Box</span>
              <input
                value={addRow.box}
                onChange={(e) => setAddRow((r) => ({ ...r, box: e.target.value }))}
              />
            </label>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              Add device
            </button>
          </form>

          <label className="field imei-filter-field">
            <span>Filter in pack</span>
            <input
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              placeholder="IMEI, code, model, box"
            />
          </label>

          <div className="table-wrap">
            <table className="auction-table">
              <thead>
                <tr>
                  <th>IMEI</th>
                  <th>Unlock code</th>
                  <th>Model</th>
                  <th>Box</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      {devices.length ? 'No rows match filter.' : 'No devices — add above or merge a CSV.'}
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((d) =>
                    editingId === d.id ? (
                      <tr key={d.id}>
                        <td colSpan={5}>
                          <form className="imei-edit-row" onSubmit={(e) => void saveEdit(e)}>
                            <input
                              value={editRow.imei}
                              onChange={(e) => setEditRow((r) => ({ ...r, imei: e.target.value }))}
                              aria-label="IMEI"
                              required
                            />
                            <input
                              value={editRow.unlockCode}
                              onChange={(e) => setEditRow((r) => ({ ...r, unlockCode: e.target.value }))}
                              aria-label="Unlock code"
                              required
                            />
                            <input
                              value={editRow.model}
                              onChange={(e) => setEditRow((r) => ({ ...r, model: e.target.value }))}
                              aria-label="Model"
                              placeholder="Model"
                            />
                            <input
                              value={editRow.box}
                              onChange={(e) => setEditRow((r) => ({ ...r, box: e.target.value }))}
                              aria-label="Box"
                              placeholder="Box"
                            />
                            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                          </form>
                        </td>
                      </tr>
                    ) : (
                      <tr key={d.id}>
                        <td className="mono">{d.imei}</td>
                        <td className="mono strong">{d.unlockCode}</td>
                        <td>{d.model || '—'}</td>
                        <td>{d.box || '—'}</td>
                        <td className="imei-row-actions">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(d)}>
                            Edit
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void deleteDevice(d)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  )
}
