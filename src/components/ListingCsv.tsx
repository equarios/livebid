import { useRef, useState, type ChangeEvent } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { ModalShell } from './ModalShell'
import { ORIGINS, slugAuctionType } from '../lib/auctionLists'
import { csvAuctionMatches, csvTypeKey, downloadCsv, parseListingCsv, type CsvListingRow } from '../lib/csv'
import { listingMinutes } from '../lib/duration'
import { usd } from '../lib/format'
import { useStore } from '../store'
import type { Channel, ListingDropItem } from '../types'

type ListKind = string

const LISTING_HEADER = [
  'lotId',
  'channel',
  'auctionType',
  'auctionName',
  'manufacturer',
  'model',
  'modelNumber',
  'capacity',
  'color',
  'origin',
  'grade',
  'battery',
  'qty',
  'moq',
  'price',
  'description',
] as const

function kindMeta(
  kind: ListKind,
  settings: { marketplaceLabel: string; auctionTypes: Array<{ value: string; label: string }> },
) {
  if (kind === 'marketplace') {
    return { channel: 'marketplace' as Channel, slug: 'marketplace', label: settings.marketplaceLabel }
  }
  const t = settings.auctionTypes.find((row) => row.value === kind)
  return {
    channel: 'auction' as Channel,
    slug: t?.value || kind,
    label: t?.label || kind,
  }
}

export function ListingCsv() {
  const { lots, settings, listingDrops, submitListingDrop } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pick, setPick] = useState<'download' | 'upload' | null>(null)
  const [uploadKind, setUploadKind] = useState<ListKind | null>(null)
  const [pending, setPending] = useState<CsvListingRow[] | null>(null)
  const [acked, setAcked] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [fail, setFail] = useState<Array<{ lotId: string; message: string }>>([])

  const typeChoices = [
    ...settings.auctionTypes.map((t) => ({
      kind: t.value,
      label: t.label,
      count: lots.filter((l) => l.channel === 'auction' && (l.auctionType || 'live') === t.value).length,
    })),
    {
      kind: 'marketplace',
      label: settings.marketplaceLabel,
      count: lots.filter((l) => l.channel === 'marketplace').length,
    },
  ]
  const reviewName = uploadKind ? kindMeta(uploadKind, settings).label : 'listings'

  function lotsForKind(kind: ListKind) {
    if (kind === 'marketplace') return lots.filter((l) => l.channel === 'marketplace')
    return lots.filter((l) => l.channel === 'auction' && (l.auctionType || 'live') === kind)
  }

  function downloadTemplate(kind: ListKind) {
    const meta = kindMeta(kind, settings)
    const rows = lotsForKind(kind)
    const fileSlug = slugAuctionType(kind) || 'listings'
    const channel = meta.channel
    const body: Array<Array<string | number>> = rows.map((lot) => [
      lot.id,
      channel,
      meta.slug,
      meta.label,
      lot.manufacturer,
      lot.model,
      lot.modelNumber,
      lot.capacity,
      lot.color,
      lot.origin || 'INT',
      lot.grade,
      lot.battery,
      lot.qty,
      lot.moq && lot.moq > 1 ? lot.moq : '',
      lot.buyNowPrice ?? lot.currentPrice,
      lot.description || '',
    ])
    for (let i = 0; i < 5; i++) {
      body.push(['', channel, meta.slug, meta.label, '', '', '', '', '', '', '', '', '', '', '', ''])
    }
    downloadCsv(`equarios-listings-${fileSlug}.csv`, [...LISTING_HEADER], body)
    setPick(null)
    setFail([])
    setResult(
      `Downloaded ${meta.label} (${rows.length} listed · 5 empty rows). Fill new rows, keep auctionType/auctionName, then upload that same list’s file.`,
    )
  }

  function startUpload(kind: ListKind) {
    setUploadKind(kind)
    setPick(null)
    window.setTimeout(() => fileRef.current?.click(), 0)
  }

  function collect(rows: CsvListingRow[], kind: ListKind) {
    const meta = kindMeta(kind, settings)
    const ready: CsvListingRow[] = []
    const errors: Array<{ lotId: string; message: string }> = []
    const used = new Set(lots.map((l) => l.id.toUpperCase()))
    for (const drop of listingDrops || []) {
      if (drop.status !== 'pending') continue
      for (const item of drop.items) used.add(item.id.toUpperCase())
    }
    for (const row of rows) {
      const tag = row.lotId || `line ${row.line}`
      const looksMarket =
        csvTypeKey(row.channel) === 'marketplace' ||
        csvTypeKey(row.auctionType) === 'marketplace' ||
        csvTypeKey(row.auctionName) === csvTypeKey(settings.marketplaceLabel)
      const matches =
        meta.channel === 'marketplace'
          ? looksMarket || csvAuctionMatches(meta.slug, meta.label, row.auctionType, row.auctionName)
          : csvAuctionMatches(meta.slug, meta.label, row.auctionType, row.auctionName)
      if (!matches) {
        const said = [row.auctionName, row.auctionType, row.channel].filter(Boolean).join(' / ') || 'no auction type'
        errors.push({
          lotId: tag,
          message: `CSV says ${said}. You chose ${meta.label}. Do not mix lists.`,
        })
        continue
      }
      if (!row.model.trim()) continue
      const id = (row.lotId || '').trim().toUpperCase()
      if (id && used.has(id)) {
        errors.push({ lotId: id, message: `${id} is already listed. Leave lotId blank for new stock, or use a new ID.` })
        continue
      }
      ready.push({
        ...row,
        channel: meta.channel,
        auctionType: meta.slug,
        auctionName: meta.label,
      })
    }
    return { ready, errors }
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    const kind = uploadKind
    if (!file) return
    if (!kind) {
      setResult('Choose an auction type first, then upload that list’s file.')
      setFail([])
      return
    }
    const name = kindMeta(kind, settings).label
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseListingCsv(String(reader.result || ''))
      if (parsed.error) {
        setResult(parsed.error)
        setFail([])
        setPending(null)
        return
      }
      if (!parsed.rows.length) {
        setResult('No listing rows found. Fill model, qty, and price on new rows. Leave auctionType as downloaded.')
        setFail([])
        setPending(null)
        return
      }
      const { ready, errors } = collect(parsed.rows, kind)
      setFail(errors)
      if (!ready.length) {
        setPending(null)
        setResult(`No lots were sent on ${name}. Check the warnings below.`)
        return
      }
      setResult(
        errors.length
          ? `${ready.length} row${ready.length === 1 ? '' : 's'} ready to send to Super. ${errors.length} skipped.`
          : null,
      )
      setAcked(false)
      setPending(ready)
    }
    reader.readAsText(file)
  }

  function patchRow(line: number, patch: Partial<Pick<CsvListingRow, 'qty' | 'price' | 'model'>>) {
    setPending((rows) => rows?.map((row) => (row.line === line ? { ...row, ...patch } : row)) ?? null)
    setAcked(false)
  }

  function dropRow(line: number) {
    setPending((rows) => {
      const next = (rows || []).filter((row) => row.line !== line)
      return next.length ? next : null
    })
    setAcked(false)
  }

  function commit(rows: CsvListingRow[]) {
    const kind = uploadKind
    if (!kind) return
    const meta = kindMeta(kind, settings)
    const used = new Set(lots.map((l) => l.id.toUpperCase()))
    for (const drop of listingDrops || []) {
      if (drop.status !== 'pending') continue
      for (const item of drop.items) used.add(item.id.toUpperCase())
    }
    const built: ListingDropItem[] = []
    const errors: Array<{ lotId: string; message: string }> = []
    const typeRow = kind === 'marketplace' ? undefined : settings.auctionTypes.find((t) => t.value === kind)
    const mins =
      typeRow?.closesAt && typeRow.closesAt > Date.now()
        ? Math.max(1, Math.round((typeRow.closesAt - Date.now()) / 60000))
        : typeRow?.closeMinutes || listingMinutes(settings, 'reopen')
    const now = Date.now()
    rows.forEach((row, i) => {
      const tag = row.lotId || `line ${row.line}`
      if (!row.model.trim() || !Number.isInteger(row.qty) || row.qty < 1 || !Number.isFinite(row.price) || row.price < 1) {
        errors.push({ lotId: tag, message: 'Fill model, qty, and a valid price.' })
        return
      }
      const grade = row.grade.trim() || settings.grades[0] || 'A'
      if (settings.grades.length && !settings.grades.includes(grade)) {
        errors.push({ lotId: tag, message: `Grade ${grade} is not in the catalog grades.` })
        return
      }
      if (row.moq != null && (row.moq < 1 || row.moq > row.qty)) {
        errors.push({ lotId: tag, message: 'MOQ must be empty or between 1 and qty.' })
        return
      }
      let id = (row.lotId || '').trim().toUpperCase()
      if (!id) id = `LB-${now.toString().slice(-6)}-${String(i + 1).padStart(3, '0')}`
      if (used.has(id) || built.some((l) => l.id === id)) {
        errors.push({ lotId: id, message: `${id} is already used.` })
        return
      }
      used.add(id)
      const origin = ORIGINS.includes(row.origin as (typeof ORIGINS)[number]) ? row.origin : 'INT'
      built.push({
        id,
        channel: meta.channel,
        auctionType: meta.channel === 'auction' ? meta.slug : undefined,
        manufacturer: row.manufacturer.trim() || 'Apple',
        model: row.model.trim(),
        modelNumber: row.modelNumber.trim(),
        capacity: row.capacity.trim() || '128GB',
        color: row.color.trim() || 'Black',
        grade,
        battery: Number.isFinite(row.battery) ? row.battery : 90,
        qty: row.qty,
        moq: row.moq && row.moq > 1 ? row.moq : undefined,
        startPrice: row.price,
        currentPrice: row.price,
        buyNowPrice: meta.channel === 'marketplace' ? row.price : undefined,
        bidCount: 0,
        endsAt: 0,
        durationMins: mins,
        description: row.description.trim() || 'Added from listing CSV.',
        accent: '#1d3348',
        origin,
      })
    })
    if (built.length) {
      const err = submitListingDrop(built)
      if (err) {
        setFail([{ lotId: 'drop', message: err }, ...errors])
        setResult(err)
        return
      }
    }
    setPending(null)
    setAcked(false)
    setFail(errors)
    setResult(
      built.length
        ? `Sent ${built.length} listing${built.length === 1 ? '' : 's'} on ${meta.label} to Super. Nothing is live until Super confirms.${errors.length ? ` ${errors.length} row${errors.length === 1 ? '' : 's'} skipped.` : ''}`
        : `No lots were sent on ${meta.label}.`,
    )
  }

  const blocked = (pending || []).some(
    (row) => !row.model.trim() || !Number.isInteger(row.qty) || row.qty < 1 || !Number.isFinite(row.price) || row.price < 1,
  )

  return (
    <div className="bid-csv listing-csv">
      <div className="bid-csv-actions">
        <button
          type="button"
          className={`filter-trigger bid-csv-pill${pick === 'download' ? ' is-active' : ''}`}
          onClick={() => setPick('download')}
        >
          <span className="filter-trigger-title">CSV</span>
          <span className="filter-trigger-value">Download</span>
        </button>
        <button
          type="button"
          className={`filter-trigger bid-csv-pill${pick === 'upload' ? ' is-active' : ''}`}
          onClick={() => setPick('upload')}
        >
          <span className="filter-trigger-title">CSV</span>
          <span className="filter-trigger-value">Upload</span>
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
      </div>
      {pick ? (
        <ModalShell onClose={() => setPick(null)}>
          <div
            className="modal card type-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="listing-csv-list-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="listing-csv-list-title">{pick === 'download' ? 'Download which list?' : 'Upload which list?'}</h2>
            <p className="muted">
              {pick === 'download'
                ? 'Pick one auction type. Each list is a separate listing sheet.'
                : 'Pick the same auction type as the file you filled. A different list will be rejected.'}
            </p>
            <ul className="type-list">
              {typeChoices.map((choice) => (
                <li key={choice.kind}>
                  <div>
                    <strong>{choice.label}</strong>
                    <div className="muted tiny">
                      {choice.count} listed lot{choice.count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      pick === 'download' ? downloadTemplate(choice.kind) : startUpload(choice.kind)
                    }
                  >
                    {pick === 'download' ? 'Download' : 'Upload'}
                  </button>
                </li>
              ))}
            </ul>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setPick(null)}>
                {settings.copy.btnCancel}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
      {result ? (
        <p className={fail.length && !result.startsWith('Sent') && !result.includes('ready to send') ? 'error' : 'ok'}>
          {result}
        </p>
      ) : null}
      {fail.length ? (
        <ul className="bid-csv-errors">
          {fail.map((row, i) => (
            <li key={`${row.lotId}-${i}`}>
              {row.lotId}: {row.message}
            </li>
          ))}
        </ul>
      ) : null}
      {pending ? (
        <ConfirmDialog
          className="csv-review"
          title={`Send CSV lots to Super · ${reviewName}`}
          body={`Fix model, qty, and price, then confirm. ${pending.length} listing${pending.length === 1 ? '' : 's'} go to Super on ${reviewName}. If that auction is still open they join its close; if it is closed, Super’s confirm starts a new clock. They stay off the floor until Super publishes.`}
          onCancel={() => {
            setPending(null)
            setAcked(false)
          }}
          onConfirm={() => commit(pending)}
          confirmDisabled={!acked || blocked}
        >
          <div className="table-wrap csv-review-table">
            <table className="gbs-table csv-edit-table">
              <thead>
                <tr>
                  <th>Auction</th>
                  <th>Lot</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price / pc</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((row) => {
                  const issue =
                    !row.model.trim() || !Number.isInteger(row.qty) || row.qty < 1 || !Number.isFinite(row.price) || row.price < 1
                      ? 'Fill model, qty, and a valid price.'
                      : null
                  return (
                    <tr key={row.line} className={issue ? 'is-warn' : ''}>
                      <td>{row.auctionName || reviewName}</td>
                      <td className="mono">{row.lotId || 'new'}</td>
                      <td>
                        <input
                          aria-label={`Model for row ${row.line}`}
                          value={row.model}
                          onChange={(e) => patchRow(row.line, { model: e.target.value })}
                        />
                        <div className="muted tiny">
                          {row.manufacturer} {row.capacity}
                        </div>
                        {issue ? <div className="error tiny">{issue}</div> : null}
                      </td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          aria-label={`Qty for row ${row.line}`}
                          value={Number.isFinite(row.qty) ? row.qty : ''}
                          onChange={(e) =>
                            patchRow(row.line, {
                              qty: e.target.value === '' ? Number.NaN : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          aria-label={`Price for row ${row.line}`}
                          value={Number.isFinite(row.price) ? row.price : ''}
                          onChange={(e) =>
                            patchRow(row.line, {
                              price: e.target.value === '' ? Number.NaN : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => dropRow(row.line)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="csv-review-sum">
            {pending.length} lot{pending.length === 1 ? '' : 's'} ·{' '}
            {pending.reduce((n, r) => n + (Number.isInteger(r.qty) ? r.qty : 0), 0).toLocaleString()} pcs ·{' '}
            {usd(
              pending.reduce(
                (n, r) => n + (Number.isInteger(r.qty) && Number.isFinite(r.price) ? r.qty * r.price : 0),
                0,
              ),
            )}
            {blocked ? <span className="error"> · Fix highlighted rows before submit</span> : null}
          </p>
          <label className="ack">
            <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} />
            I checked auction type, qty, and price on every row.
          </label>
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
