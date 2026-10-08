import { useState, type ChangeEvent } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { csvAuctionMatches, downloadCsv, parseBidCsv, type CsvBidRow } from '../lib/csv'
import { lotTypeLabel, usd } from '../lib/format'
import { listLabel, slugAuctionType, type AuctionListKind } from '../lib/auctionLists'
import { useStore } from '../store'
import type { Lot } from '../types'

type PreparedRow = CsvBidRow & { lot: Lot; typeName: string }

export function BidCsv({ lots, listKind = 'all' }: { lots: Lot[]; listKind?: AuctionListKind }) {
  const { lots: allLots, placeBids, settings } = useStore()
  const [pending, setPending] = useState<PreparedRow[] | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [fail, setFail] = useState<Array<{ lotId: string; message: string }>>([])

  const live = lots.filter((l) => l.channel === 'auction' && l.endsAt > Date.now())
  const listName = listLabel(listKind, settings)
  const fileSlug = slugAuctionType(listKind === 'all' ? 'all-auctions' : listKind) || 'auctions'

  function downloadTemplate() {
    downloadCsv(
      `equarios-bids-${fileSlug}.csv`,
      ['lotId', 'auctionType', 'auctionName', 'model', 'origin', 'qty', 'price'],
      live.map((lot) => [
        lot.id,
        lot.auctionType || 'live',
        lotTypeLabel(lot, settings),
        `${lot.manufacturer} ${lot.model} ${lot.capacity}`,
        lot.origin || 'INT',
        '',
        '',
      ]),
    )
  }

  function prepare(rows: CsvBidRow[]) {
    const ok: PreparedRow[] = []
    const errors: Array<{ lotId: string; message: string }> = []
    const catalogIds = new Set(live.map((l) => l.id))
    for (const row of rows) {
      const lot = live.find((l) => l.id === row.lotId) || allLots.find((l) => l.id === row.lotId)
      const tag = row.lotId || `line ${row.line}`
      if (!lot) {
        errors.push({ lotId: tag, message: `Unknown lot. Check lotId on the ${listName} list.` })
        continue
      }
      const typeName = lotTypeLabel(lot, settings)
      const slug = lot.auctionType || 'live'
      if (lot.channel !== 'auction') {
        errors.push({ lotId: tag, message: `${lot.id} is marketplace stock, not an auction bid.` })
        continue
      }
      if (!catalogIds.has(lot.id)) {
        errors.push({
          lotId: tag,
          message: `${lot.id} is on ${typeName}, not this ${listName} CSV. Open that list and download its file.`,
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
      ok.push({ ...row, lot, typeName })
    }
    return { ok, errors }
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
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
        setResult('No bid rows found. Fill lotId, qty, and price. Leave auctionType / auctionName as downloaded.')
        setFail([])
        setPending(null)
        return
      }
      const { ok, errors } = prepare(parsed.rows)
      setFail(errors)
      if (!ok.length) {
        setPending(null)
        setResult('No bids were placed. Auction type / list did not match this CSV.')
        return
      }
      setResult(null)
      setPending(ok)
    }
    reader.readAsText(file)
  }

  function commit(rows: PreparedRow[]) {
    const out = placeBids(rows.map((r) => ({ lotId: r.lotId, amount: r.amount, qty: r.qty })))
    setPending(null)
    setFail(out.errors)
    if (out.ok && out.errors.length) {
      setResult(`Placed ${out.ok} bid${out.ok === 1 ? '' : 's'} on ${listName}. ${out.errors.length} row${out.errors.length === 1 ? '' : 's'} skipped.`)
    } else if (out.ok) {
      setResult(`Placed ${out.ok} bid${out.ok === 1 ? '' : 's'} on ${listName} from CSV.`)
    } else {
      setResult('No bids were placed.')
    }
  }

  return (
    <div className="bid-csv">
      <div className="bid-csv-actions">
        <button type="button" className="btn btn-ghost" onClick={downloadTemplate} disabled={!settings.features.bidding}>
          Download bid CSV
        </button>
        <label className={`btn btn-ghost ${settings.features.bidding ? '' : 'is-disabled'}`}>
          Upload bid CSV
          <input type="file" accept=".csv,text/csv" hidden disabled={!settings.features.bidding} onChange={onFile} />
        </label>
      </div>
      <p className="muted tiny">
        File is for <strong>{listName}</strong> only. Columns include <code>auctionType</code> and{' '}
        <code>auctionName</code> — do not change them. Fill <code>qty</code> and <code>price</code> (per pc).
        Uploading a different list’s file will be rejected.
      </p>
      {result ? <p className={fail.length && !result.startsWith('Placed') ? 'error' : 'ok'}>{result}</p> : null}
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
          title={`Confirm CSV bids · ${listName}`}
          body={`Place ${pending.length} bid${pending.length === 1 ? '' : 's'} on ${listName}? Last bid per lot still wins fill. Check auction type on every row.`}
          onCancel={() => setPending(null)}
          onConfirm={() => commit(pending)}
        >
          <div className="table-wrap">
            <table className="gbs-table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Auction</th>
                  <th>Lot</th>
                  <th>Qty</th>
                  <th>Price / pc</th>
                </tr>
              </thead>
              <tbody>
                {pending.slice(0, 12).map((row) => (
                  <tr key={`${row.line}-${row.lotId}`}>
                    <td>{row.line}</td>
                    <td>
                      {row.typeName}
                      <div className="muted tiny">{row.lot.auctionType || 'live'}</div>
                    </td>
                    <td className="mono">{row.lotId}</td>
                    <td>{row.qty}</td>
                    <td>{Number.isFinite(row.amount) ? usd(row.amount) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pending.length > 12 ? <p className="muted tiny">Showing first 12 of {pending.length} rows.</p> : null}
          </div>
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
