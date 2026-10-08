import { useState, type FormEvent } from 'react'
import { invoicePill, invoiceStatusLabel } from '../lib/invoices'
import { isoDate, usd } from '../lib/format'
import { useStore } from '../store'
import type { Invoice, InvoiceStatus } from '../types'

const MAX_BYTES = 3 * 1024 * 1024

function newId() {
  return `INV-${Date.now().toString().slice(-6)}`
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
}: {
  canAdmin?: boolean
  canSuper?: boolean
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
  } = useStore()
  const copy = settings.copy
  const clients = accounts.filter((a) => a.role === 'member')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [id, setId] = useState(newId())
  const [accountId, setAccountId] = useState(clients[0]?.accountId || '')
  const [lotId, setLotId] = useState(lots[0]?.id || '')
  const [qty, setQty] = useState('1')
  const [unitPrice, setUnitPrice] = useState(String(lots[0]?.buyNowPrice || lots[0]?.currentPrice || 100))
  const [status, setStatus] = useState<InvoiceStatus>('unpaid')
  const [file, setFile] = useState<{ name: string; data: string } | null>(null)
  const [keepReceipt, setKeepReceipt] = useState(true)
  const [trackingNo, setTrackingNo] = useState('')
  const [shippedDate, setShippedDate] = useState('')
  const [remarks, setRemarks] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const selected = invoices.find((i) => i.id === editingId)

  function invoiceActions(inv: Invoice) {
    return (
      <div className="row-actions">
        {inv.receiptData && inv.status !== 'paid' ? (
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

  function resetForm() {
    setEditingId(null)
    setId(newId())
    setAccountId(clients[0]?.accountId || '')
    const lot = lots[0]
    setLotId(lot?.id || '')
    setQty('1')
    setUnitPrice(String(lot?.buyNowPrice || lot?.currentPrice || 100))
    setStatus('unpaid')
    setFile(null)
    setKeepReceipt(true)
    setTrackingNo('')
    setShippedDate('')
    setRemarks('')
    setPoNumber('')
  }

  function load(inv: Invoice) {
    setEditingId(inv.id)
    setId(inv.id)
    setAccountId(inv.accountId || '')
    setLotId(inv.lotId)
    setQty(String(inv.qty))
    setUnitPrice(String(inv.unitPrice))
    setStatus(inv.status)
    setFile(null)
    setKeepReceipt(true)
    setTrackingNo(inv.trackingNo || '')
    setShippedDate(inv.shippedAt ? isoDate(inv.shippedAt) : '')
    setRemarks(inv.remarks || '')
    setPoNumber(inv.poNumber || '')
    setMsg(`Editing ${inv.id}`)
    setErr(null)
  }

  function onLot(nextId: string) {
    setLotId(nextId)
    const lot = lots.find((l) => l.id === nextId)
    if (lot) setUnitPrice(String(lot.buyNowPrice ?? lot.currentPrice))
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    const q = Number(qty)
    const p = Number(unitPrice)
    const lot = lots.find((l) => l.id === lotId)
    const existing = editingId ? invoices.find((i) => i.id === editingId) : undefined
    let receiptName = keepReceipt ? existing?.receiptName : undefined
    let receiptData = keepReceipt ? existing?.receiptData : undefined
    if (file) {
      receiptName = file.name
      receiptData = file.data
    }
    let nextStatus = status
    if (receiptData && nextStatus === 'unpaid') nextStatus = 'pending_review'
    const invoice: Invoice = {
      id,
      lotId,
      channel: lot?.channel || existing?.channel || 'marketplace',
      qty: q,
      unitPrice: p,
      amount: q * p,
      status: nextStatus,
      createdAt: existing?.createdAt || Date.now(),
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
      auctionLabel: existing?.auctionLabel,
      opened: existing?.opened,
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
        status: 'pending_review',
      })
      setErr(saveErr)
      setMsg(saveErr ? null : `Receipt saved on ${inv.id}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : copy.warnReceipt)
    }
  }

  const rows = [...invoices].sort((a, b) => {
    const rank = (s: Invoice['status']) =>
      s === 'pending_review' ? 0 : s === 'declined' ? 1 : s === 'unpaid' ? 2 : 3
    return rank(a.status) - rank(b.status) || b.createdAt - a.createdAt
  })

  return (
    <div>
      <form className="admin-form" onSubmit={onSave}>
        <label>
          Invoice ID
          <input value={id} onChange={(e) => setId(e.target.value)} disabled={Boolean(editingId)} />
        </label>
        <label>
          Client
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">—</option>
            {clients.map((a) => (
              <option key={a.accountId} value={a.accountId}>
                {a.accountId} · {a.company}
              </option>
            ))}
          </select>
        </label>
        <label>
          Lot
          <select value={lotId} onChange={(e) => onLot(e.target.value)}>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id} · {l.model}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pcs
          <input type="number" min={1} step={1} value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <label>
          Price / pc
          <input type="number" min={1} step={1} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus)}>
            <option value="unpaid">Unpaid</option>
            <option value="pending_review">Pending approval</option>
            <option value="paid">Paid / shipped</option>
            <option value="declined">Declined</option>
          </select>
        </label>
        <label>
          Tracking no
          <input value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} />
        </label>
        <label>
          Shipping date
          <input type="date" value={shippedDate} onChange={(e) => setShippedDate(e.target.value)} />
        </label>
        <label>
          PO number
          <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
        </label>
        <label className="admin-span">
          Remarks
          <input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </label>
        <label className="admin-span">
          Payment receipt
          <input type="file" accept="image/*,.pdf,application/pdf" onChange={(e) => void onPick(e.target.files)} />
        </label>
        {editingId && selected?.receiptName ? (
          <label className="admin-toggles">
            <input type="checkbox" checked={keepReceipt} onChange={(e) => setKeepReceipt(e.target.checked)} />
            Keep current receipt ({selected.receiptName})
          </label>
        ) : null}
        {file ? <p className="muted tiny">{file.name}</p> : null}
        <button className="btn btn-primary" type="submit">
          {editingId ? 'Save invoice' : 'Add invoice'}
        </button>
        {editingId ? (
          <button className="btn btn-ghost" type="button" onClick={resetForm}>
            Cancel
          </button>
        ) : null}
      </form>
      {err ? <p className="error">{err}</p> : null}
      {msg ? <p className="ok">{msg}</p> : null}

      <h3 className="pay-queue-title">All invoices ({rows.length})</h3>
      <p className="muted">
        Add, edit, or delete invoices. Replace or remove a receipt. Accept or decline only if payment has arrived.
        Both admin and super admin must accept for a client receipt to become paid.
      </p>
      <div className="table-wrap pay-queue">
        <table className="auction-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Client</th>
              <th>Lot</th>
              <th>Pcs</th>
              <th>Total</th>
              <th>Receipt</th>
              <th>Admin</th>
              <th>Super</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => {
              const lot = lots.find((l) => l.id === inv.lotId)
              return (
                <tr key={inv.id} className={inv.status === 'pending_review' ? 'pay-request-row' : undefined}>
                  <td className="mono">{inv.id}</td>
                  <td className="mono">{inv.accountId || '—'}</td>
                  <td>{lot ? `${lot.model} ${lot.modelNumber || ''}`.trim() : inv.lotId}</td>
                  <td>{inv.qty}</td>
                  <td className="price-cell">{usd(inv.amount)}</td>
                  <td>
                    {inv.receiptData ? (
                      inv.receiptData.startsWith('data:image') ? (
                        <a href={inv.receiptData} target="_blank" rel="noreferrer">
                          <img className="receipt-thumb" src={inv.receiptData} alt={inv.receiptName || 'Receipt'} />
                        </a>
                      ) : (
                        <a href={inv.receiptData} download={inv.receiptName || 'receipt.pdf'}>
                          {inv.receiptName || 'Receipt'}
                        </a>
                      )
                    ) : (
                      <span className="muted">None</span>
                    )}
                    <label className="tiny">
                      Replace
                      <input
                        type="file"
                        accept="image/*,.pdf,application/pdf"
                        onChange={(e) => void replaceReceipt(inv, e.target.files)}
                      />
                    </label>
                  </td>
                  <td className="tiny">{inv.adminReview ? `${inv.adminReview.decision} · ${inv.adminReview.by}` : '—'}</td>
                  <td className="tiny">{inv.superReview ? `${inv.superReview.decision} · ${inv.superReview.by}` : '—'}</td>
                  <td>
                    <span className={`pill ${invoicePill(inv.status)}`}>{invoiceStatusLabel(inv.status)}</span>
                  </td>
                  <td>{invoiceActions(inv)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!rows.length ? <p className="empty">No invoices yet. Add one above.</p> : null}
      </div>
      <div className="auction-cards pay-cards">
        {rows.map((inv) => {
          const lot = lots.find((l) => l.id === inv.lotId)
          return (
            <article key={inv.id} className="auction-card">
              <strong>{inv.id}</strong>
              <div className="muted tiny">{inv.accountId || '—'}</div>
              <div>
                {lot ? `${lot.model} ${lot.modelNumber || ''}`.trim() : inv.lotId} · {inv.qty} pcs
              </div>
              <div className="inv-card-meta">
                <span>{usd(inv.amount)}</span>
                <span className={`pill ${invoicePill(inv.status)}`}>{invoiceStatusLabel(inv.status)}</span>
              </div>
              {invoiceActions(inv)}
            </article>
          )
        })}
      </div>
    </div>
  )
}
