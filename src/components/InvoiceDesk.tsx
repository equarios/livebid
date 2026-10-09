import { useMemo, useState, type FormEvent } from 'react'
import { InvoicePreview } from './InvoicePreview'
import {
  appliedFeePct,
  boxNoForLot,
  buyerNumber,
  invoiceDueLabel,
  invoiceLines,
  invoicePill,
  invoiceRatePct,
  invoiceStatusLabel,
  invoiceTotals,
  itemDescription,
  suggestInvoiceId,
} from '../lib/invoices'
import { isoDate, moneyUsd, usd } from '../lib/format'
import { useStore } from '../store'
import type { Invoice, InvoiceLine, InvoiceStatus, Lot, PayReview } from '../types'

function stampMark(review?: PayReview) {
  if (!review) return '·'
  return review.decision === 'accepted' ? '✓' : '✗'
}

const MAX_BYTES = 3 * 1024 * 1024
const GRADES = ['S', 'A', 'B', 'C', '—'] as const
const SIMS = ['Unlocked', 'Locked'] as const

type DraftLine = {
  key: string
  lotId: string
  description: string
  boxNo: string
  sim: string
  grade: string
  qty: string
  unitPrice: string
}

function lineKey() {
  return `L-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function priceFromLot(lot: Lot | undefined) {
  if (!lot) return '100'
  return String(lot.buyNowPrice ?? lot.currentPrice ?? lot.startPrice ?? 100)
}

function draftFromLot(lot: Lot | undefined): DraftLine {
  return {
    key: lineKey(),
    lotId: lot?.id || 'CUSTOM',
    description: lot ? itemDescription(lot, lot.id) : '',
    boxNo: lot ? boxNoForLot(lot.id) : '',
    sim: lot?.simLocked ? 'Locked' : 'Unlocked',
    grade: lot?.grade || 'A',
    qty: '1',
    unitPrice: priceFromLot(lot),
  }
}

function draftFromInvoiceLine(line: InvoiceLine, lots: Lot[]): DraftLine {
  const lot = lots.find((l) => l.id === line.lotId)
  return {
    key: lineKey(),
    lotId: line.lotId || 'CUSTOM',
    description: line.description || itemDescription(lot, line.lotId),
    boxNo: line.boxNo || boxNoForLot(line.lotId, line.boxNo),
    sim: line.sim || (lot?.simLocked ? 'Locked' : 'Unlocked'),
    grade: line.grade || lot?.grade || 'A',
    qty: String(line.qty),
    unitPrice: String(line.unitPrice),
  }
}

function readFile(file: File): Promise<{ name: string; data: string }> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_BYTES) {
      reject(new Error('Receipt must be an image or PDF under 3 MB.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve({ name: file.name, data: String(reader.result || '') })
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

export function InvoiceDesk({
  canAdmin,
  canSuper,
  allowCreate = true,
}: {
  canAdmin?: boolean
  canSuper?: boolean
  allowCreate?: boolean
}) {
  const {
    invoices,
    lots,
    accounts,
    settings,
    saveInvoice,
    removeInvoice,
    clearPaymentConfirmation,
    reviewPayment,
    reviewInvoiceIssue,
  } = useStore()
  const copy = settings.copy
  const currency = settings.invoice.currency || 'USD'
  const clients = accounts.filter((a) => a.role === 'member')
  const feeRate = invoiceRatePct(settings)
  const money = (n: number) => moneyUsd(n, currency)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [id, setId] = useState(() => suggestInvoiceId(invoices, settings))
  const [accountId, setAccountId] = useState(clients[0]?.accountId || '')
  const [status, setStatus] = useState<InvoiceStatus>('draft')
  const [lines, setLines] = useState<DraftLine[]>(() => [draftFromLot(lots[0])])
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [file, setFile] = useState<{ name: string; data: string } | null>(null)
  const [keepReceipt, setKeepReceipt] = useState(true)
  const [trackingNo, setTrackingNo] = useState('')
  const [shippedDate, setShippedDate] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [remarks, setRemarks] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [auctionLabel, setAuctionLabel] = useState('')
  const [feePct, setFeePct] = useState('0')
  const [terms, setTerms] = useState('')
  const [shipCompany, setShipCompany] = useState(() => clients[0]?.company || '')
  const [shipAddress, setShipAddress] = useState(() => clients[0]?.address || '')
  const [billCompany, setBillCompany] = useState(() => clients[0]?.company || '')
  const [billAddress, setBillAddress] = useState(() => clients[0]?.address || '')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const selectedClient = clients.find((a) => a.accountId === accountId)

  const selected = invoices.find((i) => i.id === editingId)

  const draftTotals = useMemo(() => {
    const parsed: InvoiceLine[] = lines.map((row) => ({
      lotId: row.lotId || 'CUSTOM',
      qty: Math.max(1, Math.floor(Number(row.qty) || 0)),
      unitPrice: Math.max(0, Number(row.unitPrice) || 0),
      boxNo: row.boxNo.trim() || undefined,
      description: row.description.trim() || undefined,
      sim: row.sim.trim() || undefined,
      grade: row.grade.trim() || undefined,
    }))
    const fee = Math.max(0, Number(feePct) || 0)
    return invoiceTotals(
      {
        id: 'DRAFT',
        lotId: parsed[0]?.lotId || 'CUSTOM',
        channel: 'marketplace',
        amount: 0,
        qty: 0,
        unitPrice: 0,
        status: 'draft',
        createdAt: Date.now(),
        feePct: fee,
        lines: parsed,
      },
      settings,
    )
  }, [lines, feePct, settings])

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function setLineLot(key: string, lotId: string) {
    if (lotId === 'CUSTOM') {
      updateLine(key, { lotId: 'CUSTOM' })
      return
    }
    const lot = lots.find((l) => l.id === lotId)
    if (!lot) return
    updateLine(key, {
      lotId: lot.id,
      description: itemDescription(lot, lot.id),
      boxNo: boxNoForLot(lot.id),
      sim: lot.simLocked ? 'Locked' : 'Unlocked',
      grade: lot.grade,
      unitPrice: priceFromLot(lot),
    })
  }

  function addLine(fromLot?: Lot) {
    setLines((prev) => [...prev, draftFromLot(fromLot)])
  }

  function addCustomLine() {
    setLines((prev) => [
      ...prev,
      {
        key: lineKey(),
        lotId: 'CUSTOM',
        description: '',
        boxNo: '',
        sim: 'Unlocked',
        grade: 'A',
        qty: '1',
        unitPrice: '0',
      },
    ])
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.key !== key)))
  }

  function applyClientParties(nextAccountId: string, force = false) {
    const client = clients.find((a) => a.accountId === nextAccountId)
    if (!client) return
    if (force || !shipCompany.trim()) setShipCompany(client.company)
    if (force || !shipAddress.trim()) setShipAddress(client.address || '')
    if (force || !billCompany.trim()) setBillCompany(client.company)
    if (force || !billAddress.trim()) setBillAddress(client.address || '')
  }

  function resetForm() {
    const nextClient = clients[0]?.accountId || ''
    setEditingId(null)
    setId(suggestInvoiceId(invoices, settings))
    setAccountId(nextClient)
    setStatus('draft')
    setLines([draftFromLot(lots[0])])
    setFile(null)
    setKeepReceipt(true)
    setTrackingNo('')
    setShippedDate('')
    setIssueDate('')
    setRemarks('')
    setPoNumber('')
    setAuctionLabel('')
    setFeePct('0')
    setTerms('')
    const client = clients[0]
    setShipCompany(client?.company || '')
    setShipAddress(client?.address || '')
    setBillCompany(client?.company || '')
    setBillAddress(client?.address || '')
    setMsg(null)
    setErr(null)
  }

  function load(inv: Invoice) {
    const invLines = invoiceLines(inv)
    const client = accounts.find((a) => a.accountId === inv.accountId)
    setEditingId(inv.id)
    setId(inv.id)
    setAccountId(inv.accountId || '')
    setStatus(inv.status)
    setLines(invLines.map((line) => draftFromInvoiceLine(line, lots)))
    setFile(null)
    setKeepReceipt(true)
    setTrackingNo(inv.trackingNo || '')
    setShippedDate(inv.shippedAt ? isoDate(inv.shippedAt) : '')
    setIssueDate(inv.issuedAt ? isoDate(inv.issuedAt) : inv.createdAt ? isoDate(inv.createdAt) : '')
    setRemarks(inv.remarks || '')
    setPoNumber(inv.poNumber || '')
    setAuctionLabel(inv.auctionLabel || '')
    setFeePct(String(appliedFeePct(inv) || 0))
    setTerms(inv.terms || '')
    setShipCompany(inv.shipCompany || client?.company || '')
    setShipAddress(inv.shipAddress || client?.address || '')
    setBillCompany(inv.billCompany || client?.company || '')
    setBillAddress(inv.billAddress || client?.address || '')
    setMsg(`Editing ${inv.id}`)
    setErr(null)
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    const parsedLines: InvoiceLine[] = lines.map((row) => ({
      lotId: row.lotId || 'CUSTOM',
      qty: Math.max(1, Math.floor(Number(row.qty) || 0)),
      unitPrice: Math.max(0, Number(row.unitPrice) || 0),
      boxNo: row.boxNo.trim() || undefined,
      description: row.description.trim() || undefined,
      sim: row.sim.trim() || undefined,
      grade: row.grade.trim() || undefined,
    }))
    if (!parsedLines.length) {
      setErr('Add at least one line item.')
      return
    }
    const existing = editingId ? invoices.find((i) => i.id === editingId) : undefined
    let receiptName = keepReceipt ? existing?.receiptName : undefined
    let receiptData = keepReceipt ? existing?.receiptData : undefined
    if (file) {
      receiptName = file.name
      receiptData = file.data
    }
    let nextStatus = status
    if (receiptData && nextStatus === 'unpaid') nextStatus = 'pending_review'
    const primary = parsedLines[0]
    const lot = lots.find((l) => l.id === primary.lotId)
    const fee = Math.max(0, Number(feePct) || 0)
    const createdAt = existing?.createdAt || Date.now()
    const issuedAt = issueDate
      ? Date.parse(`${issueDate}T12:00:00`)
      : existing?.issuedAt
    const invoice: Invoice = {
      id,
      lotId: primary.lotId,
      channel: lot?.channel || existing?.channel || 'marketplace',
      qty: parsedLines.reduce((s, line) => s + line.qty, 0),
      unitPrice: primary.unitPrice,
      amount: 0,
      status: nextStatus,
      createdAt,
      accountId: accountId || undefined,
      receiptName,
      receiptData,
      paidDeclaredAt: receiptData ? existing?.paidDeclaredAt || Date.now() : undefined,
      adminReview: receiptData && keepReceipt && !file ? existing?.adminReview : undefined,
      superReview: receiptData && keepReceipt && !file ? existing?.superReview : undefined,
      trackingNo: trackingNo.trim() || undefined,
      shippedAt: shippedDate ? Date.parse(`${shippedDate}T12:00:00`) : undefined,
      remarks: remarks.trim() || undefined,
      poNumber: poNumber.trim() || undefined,
      feePct: fee,
      auctionLabel: auctionLabel.trim() || undefined,
      terms: terms.trim() || undefined,
      shipCompany: shipCompany.trim() || undefined,
      shipAddress: shipAddress.trim() || undefined,
      billCompany: billCompany.trim() || undefined,
      billAddress: billAddress.trim() || undefined,
      opened: existing?.opened,
      issueAdmin: existing?.issueAdmin,
      issueSuper: existing?.issueSuper,
      issuedAt: Number.isFinite(issuedAt) ? issuedAt : existing?.issuedAt,
      lines: parsedLines,
    }
    const saveErr = saveInvoice(invoice, editingId || undefined)
    if (saveErr) {
      setErr(saveErr)
      setMsg(null)
      return
    }
    setErr(null)
    setMsg(editingId ? `Saved ${invoice.id}` : `Created ${invoice.id}`)
    resetForm()
  }

  async function onPick(list: FileList | null) {
    const picked = list?.[0]
    if (!picked) {
      setFile(null)
      return
    }
    try {
      const next = await readFile(picked)
      setFile(next)
      setKeepReceipt(true)
      setErr(null)
    } catch (e) {
      setFile(null)
      setErr(e instanceof Error ? e.message : copy.warnReceipt)
    }
  }

  async function replaceReceipt(inv: Invoice, list: FileList | null) {
    const picked = list?.[0]
    if (!picked) return
    try {
      const next = await readFile(picked)
      const saveErr = saveInvoice({
        ...inv,
        receiptName: next.name,
        receiptData: next.data,
        paidDeclaredAt: Date.now(),
        adminReview: undefined,
        superReview: undefined,
        status: inv.status === 'draft' ? 'draft' : 'pending_review',
      })
      setErr(saveErr)
      setMsg(saveErr ? null : `Receipt saved on ${inv.id}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : copy.warnReceipt)
    }
  }

  function invoiceActions(inv: Invoice) {
    const issueOpen = inv.status === 'draft' || (inv.status === 'declined' && !inv.issuedAt)
    return (
      <div className="row-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreviewId(inv.id)}>
          Preview
        </button>
        {issueOpen ? (
          <>
            {canAdmin ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => reviewInvoiceIssue(inv.id, 'admin', 'accepted')}
                >
                  Issue (admin)
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => reviewInvoiceIssue(inv.id, 'admin', 'declined')}
                >
                  Decline issue (admin)
                </button>
              </>
            ) : null}
            {canSuper ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => reviewInvoiceIssue(inv.id, 'super', 'accepted')}
                >
                  Issue (super)
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => reviewInvoiceIssue(inv.id, 'super', 'declined')}
                >
                  Decline issue (super)
                </button>
              </>
            ) : null}
          </>
        ) : null}
        {inv.receiptData && inv.status !== 'paid' && inv.status !== 'draft' ? (
          <>
            {canAdmin ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => reviewPayment(inv.id, 'admin', 'accepted')}
                >
                  {copy.btnAccept} (admin)
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => reviewPayment(inv.id, 'admin', 'declined')}
                >
                  {copy.btnDecline} (admin)
                </button>
              </>
            ) : null}
            {canSuper ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => reviewPayment(inv.id, 'super', 'accepted')}
                >
                  {copy.btnAccept} (super)
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => reviewPayment(inv.id, 'super', 'declined')}
                >
                  {copy.btnDecline} (super)
                </button>
              </>
            ) : null}
          </>
        ) : null}
        {(canAdmin || canSuper) && feeRate > 0 ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const on = appliedFeePct(inv) > 0
              const saveErr = saveInvoice({ ...inv, feePct: on ? 0 : feeRate }, inv.id)
              setErr(saveErr)
              setMsg(saveErr ? null : on ? `Removed fee on ${inv.id}` : `Applied ${feeRate}% fee on ${inv.id}`)
            }}
          >
            {appliedFeePct(inv) > 0 ? 'Remove fee' : `Apply ${feeRate}% fee`}
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => load(inv)}>
          Edit
        </button>
        {inv.receiptData ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const clearErr = clearPaymentConfirmation(inv.id)
              setErr(clearErr)
              setMsg(clearErr ? null : `Removed receipt on ${inv.id}`)
            }}
          >
            Delete receipt
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (!window.confirm(`Delete invoice ${inv.id}?`)) return
            const delErr = removeInvoice(inv.id)
            setErr(delErr)
            setMsg(delErr ? null : `Deleted ${inv.id}`)
            if (editingId === inv.id) resetForm()
          }}
        >
          Delete invoice
        </button>
      </div>
    )
  }

  const rows = [...invoices].sort((a, b) => {
    const rank = (s: Invoice['status']) =>
      s === 'draft' ? 0 : s === 'pending_review' ? 1 : s === 'declined' ? 2 : s === 'unpaid' ? 3 : 4
    return rank(a.status) - rank(b.status) || b.createdAt - a.createdAt
  })

  const showForm = allowCreate || editingId

  return (
    <div className="invoice-desk">
      {showForm ? (
        <form className="invoice-editor" onSubmit={onSave}>
          <div className="invoice-editor-head">
            <h3>{editingId ? `Edit ${editingId}` : 'Create invoice'}</h3>
            <p className="muted tiny">
              Add catalog lots or custom rows. Every field prints on the commercial invoice PDF.
            </p>
          </div>

          <div className="invoice-editor-meta">
            <label>
              Invoice ID
              <input value={id} onChange={(e) => setId(e.target.value)} disabled={Boolean(editingId)} />
            </label>
            <label>
              Client
              <select
                value={accountId}
                onChange={(e) => {
                  const next = e.target.value
                  setAccountId(next)
                  applyClientParties(next, true)
                }}
              >
                <option value="">—</option>
                {clients.map((a) => (
                  <option key={a.accountId} value={a.accountId}>
                    {a.accountId} · {a.company}
                    {a.buyerNumber ? ` · #${a.buyerNumber}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {selectedClient ? (
              <p className="muted tiny admin-span">
                Buyer # {buyerNumber(selectedClient.accountId, selectedClient.buyerNumber)}
              </p>
            ) : null}
            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus)}>
                <option value="draft">Awaiting issue</option>
                <option value="unpaid">Unpaid</option>
                <option value="pending_review">Pending approval</option>
                <option value="paid">Paid / shipped</option>
                <option value="declined">Declined</option>
              </select>
            </label>
            <label>
              Invoice date
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </label>
            <label>
              PO number
              <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Optional" />
            </label>
            <label>
              Terms
              <input
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder={settings.invoice.terms || 'EX Works'}
              />
            </label>
            <label>
              Auction / label
              <input
                value={auctionLabel}
                onChange={(e) => setAuctionLabel(e.target.value)}
                placeholder="Optional auction title"
              />
            </label>
            <label>
              Auction fee %
              <input
                type="number"
                min={0}
                step={0.01}
                value={feePct}
                onChange={(e) => setFeePct(e.target.value)}
              />
            </label>
            <label>
              Tracking no
              <input value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} />
            </label>
            <label>
              Shipping date
              <input type="date" value={shippedDate} onChange={(e) => setShippedDate(e.target.value)} />
            </label>
          </div>

          <div className="invoice-parties">
            <div className="invoice-party">
              <strong>Ship to</strong>
              <label>
                Company
                <input value={shipCompany} onChange={(e) => setShipCompany(e.target.value)} />
              </label>
              <label>
                Address
                <textarea
                  rows={3}
                  value={shipAddress}
                  onChange={(e) => setShipAddress(e.target.value)}
                  placeholder="Leave blank to use account address"
                />
              </label>
            </div>
            <div className="invoice-party">
              <strong>Bill to</strong>
              <label>
                Company
                <input value={billCompany} onChange={(e) => setBillCompany(e.target.value)} />
              </label>
              <label>
                Address
                <textarea
                  rows={3}
                  value={billAddress}
                  onChange={(e) => setBillAddress(e.target.value)}
                  placeholder="Leave blank to use account address"
                />
              </label>
            </div>
          </div>

          <div className="invoice-lines-block">
            <div className="invoice-lines-toolbar">
              <strong>Line items ({lines.length})</strong>
              <div className="row-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => addLine(lots[0])}>
                  + Catalog lot
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={addCustomLine}>
                  + Custom item
                </button>
              </div>
            </div>
            <div className="invoice-line-cards">
              {lines.map((row, index) => {
                const qty = Math.max(0, Number(row.qty) || 0)
                const price = Math.max(0, Number(row.unitPrice) || 0)
                return (
                  <article key={row.key} className="invoice-line-card">
                    <div className="invoice-line-card-top">
                      <span className="invoice-line-num">#{index + 1}</span>
                      <strong className="invoice-line-total">{money(qty * price)}</strong>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={lines.length <= 1}
                        onClick={() => removeLine(row.key)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="invoice-line-grid">
                      <label className="invoice-line-catalog">
                        Catalog / custom
                        <select
                          value={row.lotId}
                          onChange={(e) => setLineLot(row.key, e.target.value)}
                          aria-label={`Lot for line ${index + 1}`}
                        >
                          <option value="CUSTOM">Custom item</option>
                          {lots.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.id} · {l.model} {l.capacity}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="invoice-line-desc">
                        Description of Item
                        <input
                          value={row.description}
                          onChange={(e) => updateLine(row.key, { description: e.target.value })}
                          placeholder="e.g. SCG29_Galaxy Z Flip6 256GB"
                          aria-label={`Description line ${index + 1}`}
                        />
                      </label>
                      <label>
                        Box-No
                        <input
                          value={row.boxNo}
                          onChange={(e) => updateLine(row.key, { boxNo: e.target.value })}
                          placeholder="BOX-…"
                          aria-label={`Box no line ${index + 1}`}
                        />
                      </label>
                      <label>
                        SIM
                        <select
                          value={row.sim}
                          onChange={(e) => updateLine(row.key, { sim: e.target.value })}
                          aria-label={`SIM line ${index + 1}`}
                        >
                          {SIMS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Grade
                        <select
                          value={row.grade}
                          onChange={(e) => updateLine(row.key, { grade: e.target.value })}
                          aria-label={`Grade line ${index + 1}`}
                        >
                          {GRADES.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Q&apos;ty
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={row.qty}
                          onChange={(e) => updateLine(row.key, { qty: e.target.value })}
                          aria-label={`Qty line ${index + 1}`}
                        />
                      </label>
                      <label>
                        Unit price (USD)
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={row.unitPrice}
                          onChange={(e) => updateLine(row.key, { unitPrice: e.target.value })}
                          aria-label={`Unit price line ${index + 1}`}
                        />
                      </label>
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="invoice-lines-sums">
              <span>Goods {money(draftTotals.goods)}</span>
              <span>
                Fee {draftTotals.feePct}% · {money(draftTotals.fee)}
              </span>
              <strong>Invoice total {money(draftTotals.total)}</strong>
              <span>{draftTotals.qty.toLocaleString()} pcs</span>
            </div>
          </div>

          <div className="invoice-editor-meta">
            <label className="admin-span">
              Remarks (printed on invoice)
              <input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </label>
            {editingId && selected?.receiptName ? (
              <label className="admin-toggles">
                <input type="checkbox" checked={keepReceipt} onChange={(e) => setKeepReceipt(e.target.checked)} />
                Keep current receipt ({selected.receiptName})
              </label>
            ) : null}
          </div>

          <div className="invoice-editor-actions">
            <button className="btn btn-primary btn-sm" type="submit">
              {editingId ? 'Save invoice' : 'Create invoice'}
            </button>
            <label className="btn btn-ghost invoice-receipt-btn">
              Payment receipt
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                hidden
                onChange={(e) => void onPick(e.target.files)}
              />
            </label>
            {file ? <span className="muted tiny invoice-receipt-name">{file.name}</span> : null}
            {editingId ? (
              <button className="btn btn-ghost" type="button" onClick={resetForm}>
                Cancel
              </button>
            ) : (
              <button className="btn btn-ghost" type="button" onClick={resetForm}>
                Clear form
              </button>
            )}
            {editingId ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPreviewId(editingId)}
              >
                Preview PDF
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {err ? <p className="error">{err}</p> : null}
      {msg ? <p className="ok">{msg}</p> : null}

      <div className="invoice-queue">
        <div className="invoice-queue-head">
          <div>
            <h3 className="pay-queue-title">All invoices ({rows.length})</h3>
            <p className="muted tiny">
              Issue needs Admin + Super. Payment needs dual accept after a receipt.
            </p>
          </div>
        </div>
        <div className="table-wrap pay-queue">
          <table className="auction-table invoice-queue-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Buyer #</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Due</th>
                <th>Status</th>
                <th>Stamps</th>
                <th>Receipt</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const lineCount = invoiceLines(inv).length
                const client = accounts.find((a) => a.accountId === inv.accountId)
                const totals = invoiceTotals(inv, settings)
                const fee = appliedFeePct(inv)
                return (
                  <tr
                    key={inv.id}
                    className={
                      inv.status === 'draft' || inv.status === 'pending_review' ? 'pay-request-row' : undefined
                    }
                  >
                    <td>
                      <div className="mono inv-q-id">{inv.id}</div>
                      <div className="muted tiny">
                        {lineCount} line{lineCount === 1 ? '' : 's'}
                        {fee > 0 ? ` · ${fee}% fee` : ''}
                      </div>
                    </td>
                    <td>
                      <div className="inv-q-client">{client?.company || inv.accountId || '—'}</div>
                      {client?.company && inv.accountId ? (
                        <div className="mono muted tiny">{inv.accountId}</div>
                      ) : null}
                    </td>
                    <td className="mono tiny">
                      {client || inv.accountId
                        ? buyerNumber(client?.accountId || inv.accountId || '', client?.buyerNumber)
                        : '—'}
                    </td>
                    <td className="mono">{totals.qty.toLocaleString()}</td>
                    <td className="price-cell">{usd(totals.total)}</td>
                    <td className="tiny inv-q-due">{invoiceDueLabel(inv, Date.now(), settings) || '—'}</td>
                    <td>
                      <span className={`pill ${invoicePill(inv.status)}`}>{invoiceStatusLabel(inv.status)}</span>
                    </td>
                    <td className="inv-q-stamps">
                      <div>
                        <span className="inv-q-stamp-lab">Issue</span>
                        <span className={inv.issueAdmin ? 'inv-q-mark' : 'inv-q-mark is-empty'} title={inv.issueAdmin ? `${inv.issueAdmin.decision} · ${inv.issueAdmin.by}` : 'Admin pending'}>
                          A{stampMark(inv.issueAdmin)}
                        </span>
                        <span className={inv.issueSuper ? 'inv-q-mark' : 'inv-q-mark is-empty'} title={inv.issueSuper ? `${inv.issueSuper.decision} · ${inv.issueSuper.by}` : 'Super pending'}>
                          S{stampMark(inv.issueSuper)}
                        </span>
                      </div>
                      <div>
                        <span className="inv-q-stamp-lab">Pay</span>
                        <span className={inv.adminReview ? 'inv-q-mark' : 'inv-q-mark is-empty'} title={inv.adminReview ? `${inv.adminReview.decision} · ${inv.adminReview.by}` : 'Admin pending'}>
                          A{stampMark(inv.adminReview)}
                        </span>
                        <span className={inv.superReview ? 'inv-q-mark' : 'inv-q-mark is-empty'} title={inv.superReview ? `${inv.superReview.decision} · ${inv.superReview.by}` : 'Super pending'}>
                          S{stampMark(inv.superReview)}
                        </span>
                      </div>
                    </td>
                    <td className="inv-q-receipt">
                      {inv.receiptData ? (
                        <>
                          <a
                            href={inv.receiptData}
                            target="_blank"
                            rel="noreferrer"
                            download={inv.receiptData.startsWith('data:image') ? undefined : inv.receiptName || 'receipt.pdf'}
                            className="inv-q-receipt-link"
                            title={inv.receiptName || 'Receipt'}
                          >
                            {inv.receiptData.startsWith('data:image') ? (
                              <img className="receipt-thumb sm" src={inv.receiptData} alt="" />
                            ) : (
                              <span className="tiny">PDF</span>
                            )}
                          </a>
                          <label className="btn btn-ghost btn-sm inv-q-replace">
                            Replace
                            <input
                              type="file"
                              accept="image/*,.pdf,application/pdf"
                              hidden
                              onChange={(e) => void replaceReceipt(inv, e.target.files)}
                            />
                          </label>
                        </>
                      ) : (
                        <label className="btn btn-ghost btn-sm inv-q-replace">
                          Upload
                          <input
                            type="file"
                            accept="image/*,.pdf,application/pdf"
                            hidden
                            onChange={(e) => void replaceReceipt(inv, e.target.files)}
                          />
                        </label>
                      )}
                    </td>
                    <td className="inv-q-actions">{invoiceActions(inv)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!rows.length ? <p className="empty">No invoices yet. Create one above.</p> : null}
        </div>
      </div>
      <div className="auction-cards pay-cards">
        {rows.map((inv) => (
          <article key={inv.id} className="auction-card">
            <strong>{inv.id}</strong>
            <div className="muted tiny">{inv.accountId || '—'}</div>
            <div>
              {invoiceLines(inv).length} lines · {inv.qty} pcs
            </div>
            <div className="inv-card-meta">
              <span>{usd(invoiceTotals(inv, settings).total)}</span>
              <span className={`pill ${invoicePill(inv.status)}`}>{invoiceStatusLabel(inv.status)}</span>
            </div>
            {invoiceActions(inv)}
          </article>
        ))}
      </div>
      {previewId && invoices.some((i) => i.id === previewId) ? (
        <InvoicePreview invoice={invoices.find((i) => i.id === previewId)!} onClose={() => setPreviewId(null)} />
      ) : null}
    </div>
  )
}
