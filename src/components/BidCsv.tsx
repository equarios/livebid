import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { ModalShell } from './ModalShell'
import { csvAuctionMatches, downloadCsv, parseBidCsv, type CsvBidRow } from '../lib/csv'
import { isoDate, lotTypeLabel, usd } from '../lib/format'
import { isSealedLot, listLabel, slugAuctionType, type AuctionListKind } from '../lib/auctionLists'
import { checkBidPrice, checkOrderQty, minBidPrice } from '../lib/moq'
import { useNow, useStore } from '../store'
import type { Lot } from '../types'

type PreparedRow = CsvBidRow & { lot: Lot; typeName: string }

type RowIssue = PreparedRow & { issue: string | null; minPrice: number }

export function BidCsv({ lots, listKind = 'all' }: { lots: Lot[]; listKind?: AuctionListKind }) {
  const now = useNow()
  const { lots: allLots, placeBids, settings, myLastBid } = useStore()
  const [pending, setPending] = useState<PreparedRow[] | null>(null)
  const [acked, setAcked] = useState(false)
  const [pick, setPick] = useState<'download' | 'upload' | null>(null)
  const [uploadKind, setUploadKind] = useState<AuctionListKind | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [fail, setFail] = useState<Array<{ lotId: string; message: string }>>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const live = lots.filter((l) => l.channel === 'auction' && l.endsAt > now)
  const reviewName = listLabel(uploadKind || listKind, settings)
  const typeChoices = settings.auctionTypes.map((t) => ({
    kind: t.value,
    label: t.label,
    count: live.filter((l) => (l.auctionType || 'live') === t.value).length,
  }))

  function lotsForKind(kind: AuctionListKind) {
    if (kind === 'all' || kind === 'ongoing') return live
    return live.filter((l) => (l.auctionType || 'live') === kind)
  }

  function priceCtx(lot: Lot, lastOwnAmount?: number) {
    return {
      independent: isSealedLot(lot, settings),
      lastOwnAmount,
    }
  }

  function annotate(rows: PreparedRow[]): RowIssue[] {
    const lastSeen = new Map<string, number>()
    return rows.map((row) => {
      const lastOwn = lastSeen.has(row.lot.id) ? lastSeen.get(row.lot.id) : myLastBid(row.lot.id)?.amount
      const ctx = priceCtx(row.lot, lastOwn)
      const min = minBidPrice(row.lot, ctx)
      const qtyErr = checkOrderQty(row.lot, row.qty, settings.copy)
      const priceErr = checkBidPrice(row.lot, row.amount, settings.copy, ctx)
      const issue = qtyErr || priceErr
      if (!issue) lastSeen.set(row.lot.id, row.amount)
      return { ...row, issue, minPrice: min }
    })
  }

  const reviewed = useMemo(() => (pending ? annotate(pending) : []), [pending, myLastBid, settings])
  const blocked = reviewed.some((row) => row.issue)

  function downloadTemplate(kind: AuctionListKind) {
    const rows = lotsForKind(kind)
    const name = listLabel(kind, settings)
    if (!rows.length) {
      setResult(`No open lots on ${name} to download.`)
      setPick(null)
      return
    }
    const fileSlug = slugAuctionType(kind === 'all' ? 'all-auctions' : kind) || 'auctions'
    downloadCsv(
      `equarios-bids-${fileSlug}.csv`,
      ['lotId', 'auctionType', 'auctionName', 'model', 'origin', 'totalQty', 'desiredQty', 'price'],
      rows.map((lot) => [
        lot.id,
        lot.auctionType || 'live',
        lotTypeLabel(lot, settings),
        `${lot.manufacturer} ${lot.model} ${lot.capacity}`,
        lot.origin || 'INT',
        lot.qty,
        '',
        '',
      ]),
    )
    setPick(null)
    setResult(
      `Downloaded ${name} (${rows.length} lot${rows.length === 1 ? '' : 's'}). totalQty is the lot size. Fill desiredQty and price, then upload that same file.`,
    )
    setFail([])
  }

  function downloadPlaced(rows: PreparedRow[], kind: AuctionListKind) {
    const name = listLabel(kind, settings)
    const fileSlug = slugAuctionType(kind === 'all' ? 'all-auctions' : kind) || 'auctions'
    downloadCsv(
      `equarios-bids-${fileSlug}-placed-${isoDate(Date.now())}.csv`,
      [
        'lotId',
        'auctionType',
        'auctionName',
        'model',
        'origin',
        'totalQty',
        'desiredQty',
        'price',
        'bidTotal',
      ],
      rows.map((row) => [
        row.lot.id,
        row.lot.auctionType || 'live',
        row.typeName,
        `${row.lot.manufacturer} ${row.lot.model} ${row.lot.capacity}`,
        row.lot.origin || 'INT',
        row.lot.qty,
        row.qty,
        row.amount,
        row.qty * row.amount,
      ]),
    )
    return name
  }

  function collect(rows: CsvBidRow[], kind: AuctionListKind) {
    const ready: PreparedRow[] = []
    const errors: Array<{ lotId: string; message: string }> = []
    const catalog = lotsForKind(kind)
    const catalogIds = new Set(catalog.map((l) => l.id))
    const name = listLabel(kind, settings)
    for (const row of rows) {
      const lot = catalog.find((l) => l.id === row.lotId) || allLots.find((l) => l.id === row.lotId)
      const tag = row.lotId || `line ${row.line}`
      if (!lot) {
        errors.push({ lotId: tag, message: `Unknown lot. Check lotId on the ${name} list.` })
        continue
      }
      const typeName = lotTypeLabel(lot, settings)
      const slug = lot.auctionType || 'live'
      if (lot.channel !== 'auction') {
        errors.push({ lotId: tag, message: `${lot.id} is marketplace stock, not an auction bid.` })
        continue
      }
      if (slug !== kind) {
        errors.push({
          lotId: tag,
          message: `${lot.id} is ${typeName}. You chose ${name}. Upload the ${typeName} file instead.`,
        })
        continue
      }
      if (!catalogIds.has(lot.id)) {
        errors.push({
          lotId: tag,
          message: `${lot.id} is on ${typeName}, not this ${name} CSV. Download that list and upload its file.`,
        })
        continue
      }
      if (!csvAuctionMatches(slug, typeName, row.auctionType, row.auctionName)) {
        const said = [row.auctionName, row.auctionType].filter(Boolean).join(' / ') || 'no auction type'
        errors.push({
          lotId: tag,
          message: `${lot.id} is ${typeName} (${slug}). CSV says ${said}. Do not mix lists.`,
        })
        continue
      }
      if (lot.endsAt <= now) {
        errors.push({ lotId: lot.id, message: settings.copy.warnClosed })
        continue
      }
      ready.push({ ...row, lot, typeName })
    }
    return { ready, errors }
  }

  function startUpload(kind: AuctionListKind) {
    setUploadKind(kind)
    setPick(null)
    window.setTimeout(() => fileRef.current?.click(), 0)
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
    const name = listLabel(kind, settings)
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseBidCsv(String(reader.result || ''))
      if (parsed.error) {
        setResult(parsed.error)
        setFail([])
        setPending(null)
        return
      }
      if (!parsed.rows.length) {
        setResult('No bid rows found. Fill desiredQty and price on the lots you want. Leave totalQty as downloaded.')
        setFail([])
        setPending(null)
        return
      }
      const { ready, errors } = collect(parsed.rows, kind)
      setFail(errors)
      if (!ready.length) {
        setPending(null)
        setResult(`No bids were placed on ${name}. Check the warnings below.`)
        return
      }
      setResult(
        errors.length
          ? `${ready.length} row${ready.length === 1 ? '' : 's'} ready to edit. ${errors.length} skipped.`
          : null,
      )
      setAcked(false)
      setPending(ready)
    }
    reader.readAsText(file)
  }

  function patchRow(line: number, patch: Partial<Pick<PreparedRow, 'qty' | 'amount'>>) {
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

  function commit(rows: PreparedRow[]) {
    const issues = annotate(rows)
    if (issues.some((row) => row.issue)) return
    const kind = uploadKind || listKind
    const out = placeBids(rows.map((r) => ({ lotId: r.lotId, amount: r.amount, qty: r.qty })))
    const failed = new Set(out.errors.map((e) => e.lotId))
    const placed = rows.filter((r) => !failed.has(r.lot.id))
    setPending(null)
    setAcked(false)
    setFail(out.errors)
    if (placed.length) downloadPlaced(placed, kind)
    if (out.ok && out.errors.length) {
      setResult(
        `Placed ${out.ok} bid${out.ok === 1 ? '' : 's'} on ${reviewName}. Downloaded your placed CSV. ${out.errors.length} row${out.errors.length === 1 ? '' : 's'} skipped.`,
      )
    } else if (out.ok) {
      setResult(`Placed ${out.ok} bid${out.ok === 1 ? '' : 's'} on ${reviewName}. Downloaded a CSV of qty and prices you submitted.`)
    } else {
      setResult('No bids were placed.')
    }
  }

  const csvReady = settings.features.bidding && live.length > 0

  return (
    <div className="bid-csv">
      <div className="bid-csv-actions">
        <button
          type="button"
          className={`filter-trigger bid-csv-pill${pick === 'download' ? ' is-active' : ''}`}
          onClick={() => setPick('download')}
          disabled={!csvReady}
        >
          <span className="filter-trigger-title">CSV</span>
          <span className="filter-trigger-value">Download</span>
        </button>
        <button
          type="button"
          className={`filter-trigger bid-csv-pill${pick === 'upload' ? ' is-active' : ''}`}
          onClick={() => setPick('upload')}
          disabled={!csvReady}
        >
          <span className="filter-trigger-title">CSV</span>
          <span className="filter-trigger-value">Upload</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          disabled={!csvReady}
          onChange={onFile}
        />
      </div>
      {pick ? (
        <ModalShell onClose={() => setPick(null)}>
          <div
            className="modal card type-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="csv-list-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="csv-list-title">{pick === 'download' ? 'Download which list?' : 'Upload which list?'}</h2>
            <p className="muted">
              {pick === 'download'
                ? 'Pick one auction type. Each list is a separate bid sheet.'
                : 'Pick the same auction type as the file you filled. A different list will be rejected.'}
            </p>
            <ul className="type-list">
              {typeChoices.map((choice) => (
                <li key={choice.kind}>
                  <div>
                    <strong>{choice.label}</strong>
                    <div className="muted tiny">
                      {choice.count} open lot{choice.count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={pick === 'download' && !choice.count}
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
        <p className={fail.length && !result.startsWith('Placed') && !result.includes('ready to edit') ? 'error' : 'ok'}>
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
          title={`Edit and submit CSV bids · ${reviewName}`}
          body={`Fix any low prices or qty, then confirm. ${pending.length} bid${pending.length === 1 ? '' : 's'} will be placed. After submit, a CSV of these qty and prices downloads.`}
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
                  <th>Total pcs</th>
                  <th>Desired qty</th>
                  <th>Min / pc</th>
                  <th>Price / pc</th>
                  <th>Bid total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reviewed.map((row) => (
                  <tr key={`${row.line}-${row.lotId}`} className={row.issue ? 'is-warn' : ''}>
                    <td>{row.typeName}</td>
                    <td className="mono">{row.lotId}</td>
                    <td>
                      {row.lot.manufacturer} {row.lot.model}
                      <div className="muted tiny">{row.lot.capacity}</div>
                      {row.issue ? <div className="error tiny">{row.issue}</div> : null}
                    </td>
                    <td>{row.lot.qty.toLocaleString()}</td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        aria-label={`Desired qty for ${row.lotId}`}
                        value={Number.isFinite(row.qty) ? row.qty : ''}
                        onChange={(e) =>
                          patchRow(row.line, {
                            qty: e.target.value === '' ? Number.NaN : Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="price-cell">{usd(row.minPrice)}</td>
                    <td>
                      <input
                        type="number"
                        min={row.minPrice}
                        step={1}
                        aria-label={`Price for ${row.lotId}`}
                        value={Number.isFinite(row.amount) ? row.amount : ''}
                        onChange={(e) =>
                          patchRow(row.line, {
                            amount: e.target.value === '' ? Number.NaN : Number(e.target.value),
                          })
                        }
                      />
                      <div className="price-steps">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => patchRow(row.line, { amount: row.minPrice })}
                        >
                          Min {usd(row.minPrice)}
                        </button>
                        {[1, 3, 5].map((delta) => (
                          <button
                            key={delta}
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              patchRow(row.line, {
                                amount: Math.max(
                                  row.minPrice,
                                  Math.round((Number.isFinite(row.amount) ? row.amount : row.minPrice) + delta),
                                ),
                              })
                            }
                          >
                            +${delta}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="price-cell">
                      {Number.isFinite(row.qty) && Number.isFinite(row.amount)
                        ? usd(row.qty * row.amount)
                        : '—'}
                    </td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => dropRow(row.line)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="csv-review-sum">
            {pending.length} lot{pending.length === 1 ? '' : 's'} ·{' '}
            {reviewed.reduce((n, r) => n + (Number.isFinite(r.qty) ? r.qty : 0), 0).toLocaleString()} pcs ·{' '}
            {usd(
              reviewed.reduce(
                (n, r) => n + (Number.isFinite(r.qty) && Number.isFinite(r.amount) ? r.qty * r.amount : 0),
                0,
              ),
            )}
            {blocked ? <span className="error"> · Fix highlighted rows before submit</span> : null}
          </p>
          <label className="ack">
            <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} />
            I checked total pcs, desired qty, and price on every row.
          </label>
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
