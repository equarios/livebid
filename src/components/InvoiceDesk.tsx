import { useMemo, useState, type FormEvent } from 'react'
import { InvoicePreview } from './InvoicePreview'
import {
  appliedFeePct,
  boxNoForLot,
  buyerNumber,
  feePctForLot,
  invoiceDueLabel,
  invoiceLines,
  invoicePill,
  invoiceStatusLabel,
  invoiceTotals,
  itemDescription,
  suggestedFeePct,
  suggestInvoiceId,
} from '../lib/invoices'
import { isoDate, moneyUsd, usd } from '../lib/format'
import { useStore } from '../store'
import type { CartOrder, Invoice, InvoiceLine, Lot, MarketOffer, PayReview } from '../types'

function stampMark(review?: PayReview) {
  if (!review) return '·'
  return review.decision === 'accepted' ? '✓' : '✗'
}

const MAX_BYTES = 3 * 1024 * 1024
const GRADES = ['S', 'A', 'B', 'C', '—'] as const
const SIMS = ['Unlocked', 'Locked'] as const
const STEPS = [
  { id: 'buyer', label: 'Buyer' },
  { id: 'lines', label: 'Lines' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'review', label: 'Review' },
] as const
type StepId = (typeof STEPS)[number]['id']
type QueueFilter = 'all' | 'draft' | 'unpaid' | 'pending_review' | 'paid'

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

function draftFromLot(lot: Lot | undefined, qty = 1, unitPrice?: number): DraftLine {
  return {
    key: lineKey(),
    lotId: lot?.id || 'CUSTOM',
    description: lot ? itemDescription(lot, lot.id) : '',
    boxNo: lot ? boxNoForLot(lot.id) : '',
    sim: lot?.simLocked ? 'Locked' : 'Unlocked',
    grade: lot?.grade || 'A',
    qty: String(qty),
    unitPrice: unitPrice != null ? String(unitPrice) : priceFromLot(lot),
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
    cartOrders,
    offers,
    saveInvoice,
    removeInvoice,
    clearPaymentConfirmation,
    reviewPayment,
    reviewInvoiceIssue,
  } = useStore()
  const copy = settings.copy
  const currency = settings.invoice.currency || 'USD'
  const clients = accounts.filter((a) => a.role === 'member')
  const money = (n: number) => moneyUsd(n, currency)

  const [mode, setMode] = useState<'queue' | 'compose'>('queue')
  const [step, setStep] = useState<StepId>('buyer')
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all')
  const [lotQuery, setLotQuery] = useState('')
  const [billSameAsShip, setBillSameAsShip] = useState(true)
  const [showShipMeta, setShowShipMeta] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [id, setId] = useState(() => suggestInvoiceId(invoices, settings))
  const [accountId, setAccountId] = useState(clients[0]?.accountId || '')
  const [lines, setLines] = useState<DraftLine[]>(() => [draftFromLot(lots[0])])
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [draftPreviewOpen, setDraftPreviewOpen] = useState(false)
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
  const [shipEmail, setShipEmail] = useState(() => clients[0]?.email || '')
  const [shipPhone, setShipPhone] = useState(() => clients[0]?.phone || '')
  const [shipAttn, setShipAttn] = useState('')
  const [billCompany, setBillCompany] = useState(() => clients[0]?.company || '')
  const [billAddress, setBillAddress] = useState(() => clients[0]?.address || '')
  const [billEmail, setBillEmail] = useState(() => clients[0]?.email || '')
  const [billPhone, setBillPhone] = useState(() => clients[0]?.phone || '')
  const [billAttn, setBillAttn] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const selectedClient = clients.find((a) => a.accountId === accountId)
  const selected = invoices.find((i) => i.id === editingId)

  const sourceCarts = useMemo(
    () =>
      (cartOrders || []).filter((o) => o.status === 'confirmed' || o.status === 'accepted').slice(0, 8),
    [cartOrders],
  )
  const sourceOffers = useMemo(
    () =>
      (offers || []).filter((o) => o.status === 'confirmed' || o.status === 'accepted').slice(0, 8),
    [offers],
  )
  const winDrafts = useMemo(
    () => invoices.filter((i) => i.status === 'draft' && i.channel === 'auction').slice(0, 8),
    [invoices],
  )

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

  const reviewInvoice = useMemo((): Invoice => {
    const parsedLines: InvoiceLine[] = lines.map((row) => ({
      lotId: row.lotId || 'CUSTOM',
      qty: Math.max(1, Math.floor(Number(row.qty) || 0)),
      unitPrice: Math.max(0, Number(row.unitPrice) || 0),
      boxNo: row.boxNo.trim() || undefined,
      description: row.description.trim() || undefined,
      sim: row.sim.trim() || undefined,
      grade: row.grade.trim() || undefined,
    }))
    const primary = parsedLines[0]
    const lot = lots.find((l) => l.id === primary?.lotId)
    const existing = editingId ? invoices.find((i) => i.id === editingId) : undefined
    const fee = Math.max(0, Number(feePct) || 0)
    const issuedAt = issueDate ? Date.parse(`${issueDate}T12:00:00`) : existing?.issuedAt
    return {
      id: id || 'DRAFT',
      lotId: primary?.lotId || 'CUSTOM',
      channel: lot?.channel || existing?.channel || 'marketplace',
      qty: parsedLines.reduce((s, line) => s + line.qty, 0),
      unitPrice: primary?.unitPrice || 0,
      amount: 0,
      status: 'draft',
      createdAt: existing?.createdAt || Date.now(),
      accountId: accountId || undefined,
      trackingNo: trackingNo.trim() || undefined,
      shippedAt: shippedDate ? Date.parse(`${shippedDate}T12:00:00`) : undefined,
      remarks: remarks.trim() || undefined,
      poNumber: poNumber.trim() || undefined,
      feePct: fee,
      auctionLabel: auctionLabel.trim() || undefined,
      terms: terms.trim() || undefined,
      shipCompany: shipCompany.trim() || undefined,
      shipAddress: shipAddress.trim() || undefined,
      shipEmail: shipEmail.trim() || undefined,
      shipPhone: shipPhone.trim() || undefined,
      shipAttn: shipAttn.trim() || undefined,
      billCompany: (billSameAsShip ? shipCompany : billCompany).trim() || undefined,
      billAddress: (billSameAsShip ? shipAddress : billAddress).trim() || undefined,
      billEmail: (billSameAsShip ? shipEmail : billEmail).trim() || undefined,
      billPhone: (billSameAsShip ? shipPhone : billPhone).trim() || undefined,
      billAttn: (billSameAsShip ? shipAttn : billAttn).trim() || undefined,
      issuedAt: Number.isFinite(issuedAt) ? issuedAt : existing?.issuedAt,
      lines: parsedLines,
    }
  }, [
    lines,
    lots,
    invoices,
    editingId,
    feePct,
    issueDate,
    id,
    accountId,
    trackingNo,
    shippedDate,
    remarks,
    poNumber,
    auctionLabel,
    terms,
    shipCompany,
    shipAddress,
    shipEmail,
    shipPhone,
    shipAttn,
    billCompany,
    billAddress,
    billEmail,
    billPhone,
    billAttn,
    billSameAsShip,
  ])

  const filteredLots = useMemo(() => {
    const q = lotQuery.trim().toLowerCase()
    if (!q) return lots.slice(0, 40)
    return lots
      .filter((l) =>
        `${l.id} ${l.manufacturer} ${l.model} ${l.modelNumber} ${l.capacity} ${l.color}`
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 40)
  }, [lots, lotQuery])

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
    if (force || !shipEmail.trim()) setShipEmail(client.email || '')
    if (force || !shipPhone.trim()) setShipPhone(client.phone || '')
    if (force || !billCompany.trim()) setBillCompany(client.company)
    if (force || !billAddress.trim()) setBillAddress(client.address || '')
    if (force || !billEmail.trim()) setBillEmail(client.email || '')
    if (force || !billPhone.trim()) setBillPhone(client.phone || '')
  }

  function closeComposer() {
    setMode('queue')
    setStep('buyer')
    setDraftPreviewOpen(false)
  }

  function resetForm() {
    const nextClient = clients[0]?.accountId || ''
    setEditingId(null)
    setId(suggestInvoiceId(invoices, settings))
    setAccountId(nextClient)
    setLines([draftFromLot(lots[0])])
    setFile(null)
    setKeepReceipt(true)
    setTrackingNo('')
    setShippedDate('')
    setIssueDate('')
    setRemarks('')
    setPoNumber('')
    setAuctionLabel('')
    setFeePct(String(feePctForLot(lots[0] || { channel: 'auction', auctionType: 'live' }, settings)))
    setTerms(settings.invoice.terms || '')
    const client = clients[0]
    setShipCompany(client?.company || '')
    setShipAddress(client?.address || '')
    setShipEmail(client?.email || '')
    setShipPhone(client?.phone || '')
    setShipAttn('')
    setBillCompany(client?.company || '')
    setBillAddress(client?.address || '')
    setBillEmail(client?.email || '')
    setBillPhone(client?.phone || '')
    setBillAttn('')
    setBillSameAsShip(true)
    setShowShipMeta(false)
    setLotQuery('')
    setMsg(null)
    setErr(null)
  }

  function openCreate() {
    resetForm()
    setMode('compose')
    setStep('buyer')
  }

  function load(inv: Invoice) {
    const invLines = invoiceLines(inv)
    const client = accounts.find((a) => a.accountId === inv.accountId)
    setEditingId(inv.id)
    setId(inv.id)
    setAccountId(inv.accountId || '')
    setLines(invLines.map((line) => draftFromInvoiceLine(line, lots)))
    setFile(null)
    setKeepReceipt(true)
    setTrackingNo(inv.trackingNo || '')
    setShippedDate(inv.shippedAt ? isoDate(inv.shippedAt) : '')
    setIssueDate(inv.issuedAt ? isoDate(inv.issuedAt) : inv.createdAt ? isoDate(inv.createdAt) : '')
    setRemarks(inv.remarks || '')
    setPoNumber(inv.poNumber || '')
    setAuctionLabel(inv.auctionLabel || '')
    setFeePct(String(suggestedFeePct(inv, lots, settings)))
    setTerms(inv.terms || settings.invoice.terms || '')
    setShipCompany(inv.shipCompany || client?.company || '')
    setShipAddress(inv.shipAddress || client?.address || '')
    setShipEmail(inv.shipEmail || client?.email || '')
    setShipPhone(inv.shipPhone || client?.phone || '')
    setShipAttn(inv.shipAttn || '')
    setBillCompany(inv.billCompany || client?.company || '')
    setBillAddress(inv.billAddress || client?.address || '')
    setBillEmail(inv.billEmail || client?.email || '')
    setBillPhone(inv.billPhone || client?.phone || '')
    setBillAttn(inv.billAttn || '')
    setBillSameAsShip(
      !inv.billCompany ||
        (inv.billCompany === (inv.shipCompany || client?.company) &&
          (inv.billAddress || '') === (inv.shipAddress || client?.address || '') &&
          (inv.billEmail || client?.email || '') === (inv.shipEmail || client?.email || '') &&
          (inv.billPhone || client?.phone || '') === (inv.shipPhone || client?.phone || '')),
    )
    setShowShipMeta(Boolean(inv.trackingNo || inv.shippedAt))
    setMsg(`Editing ${inv.id}`)
    setErr(null)
    setMode('compose')
    setStep('buyer')
  }

  function duplicate(inv: Invoice) {
    load({
      ...inv,
      id: suggestInvoiceId(invoices, settings),
      status: 'draft',
      issuedAt: undefined,
      issueAdmin: undefined,
      issueSuper: undefined,
      receiptName: undefined,
      receiptData: undefined,
      paidDeclaredAt: undefined,
      adminReview: undefined,
      superReview: undefined,
      trackingNo: undefined,
      shippedAt: undefined,
      createdAt: Date.now(),
    })
    setEditingId(null)
    setMsg(`Duplicated from ${inv.id}`)
  }

  function fromCart(order: CartOrder) {
    resetForm()
    setAccountId(order.accountId)
    applyClientParties(order.accountId, true)
    setLines(
      order.lines.map((line) => {
        const lot = lots.find((l) => l.id === line.lotId)
        return draftFromLot(lot, line.qty, line.unitPrice)
      }),
    )
    setRemarks(`From cart ${order.id}`)
    setAuctionLabel(`Cart ${order.id}`)
    setMode('compose')
    setStep('lines')
    setMsg(`Prefill from cart ${order.id}`)
  }

  function fromOffer(offer: MarketOffer) {
    resetForm()
    setAccountId(offer.accountId)
    applyClientParties(offer.accountId, true)
    const lot = lots.find((l) => l.id === offer.lotId)
    setLines([draftFromLot(lot, offer.qty, offer.unitPrice)])
    setRemarks(`From offer ${offer.id}`)
    setAuctionLabel(`Offer ${offer.id}`)
    setMode('compose')
    setStep('lines')
    setMsg(`Prefill from offer ${offer.id}`)
  }

  function validateStep(current: StepId): string | null {
    if (current === 'buyer') {
      if (!accountId) return 'Pick a client before continuing.'
      if (!shipCompany.trim()) return 'Ship-to company is required.'
    }
    if (current === 'lines') {
      if (!lines.length) return 'Add at least one line item.'
      for (const row of lines) {
        if (!row.description.trim() && row.lotId === 'CUSTOM') {
          return 'Each custom line needs a description.'
        }
        if (!(Number(row.qty) > 0)) return 'Every line needs a quantity.'
      }
    }
    return null
  }

  function goNext() {
    const errMsg = validateStep(step)
    if (errMsg) {
      setErr(errMsg)
      return
    }
    setErr(null)
    const idx = STEPS.findIndex((s) => s.id === step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].id)
  }

  function goBack() {
    setErr(null)
    const idx = STEPS.findIndex((s) => s.id === step)
    if (idx > 0) setStep(STEPS[idx - 1].id)
  }

  async function onSave(e?: FormEvent) {
    e?.preventDefault()
    for (const s of STEPS) {
      const stepErr = validateStep(s.id)
      if (stepErr) {
        setErr(stepErr)
        setStep(s.id)
        return
      }
    }
    const parsedLines: InvoiceLine[] = lines.map((row) => ({
      lotId: row.lotId || 'CUSTOM',
      qty: Math.max(1, Math.floor(Number(row.qty) || 0)),
      unitPrice: Math.max(0, Number(row.unitPrice) || 0),
      boxNo: row.boxNo.trim() || undefined,
      description: row.description.trim() || undefined,
      sim: row.sim.trim() || undefined,
      grade: row.grade.trim() || undefined,
    }))
    const existing = editingId ? invoices.find((i) => i.id === editingId) : undefined
    let receiptName = keepReceipt ? existing?.receiptName : undefined
    let receiptData = keepReceipt ? existing?.receiptData : undefined
    if (file) {
      receiptName = file.name
      receiptData = file.data
    }
    let nextStatus = existing?.status || 'draft'
    if (receiptData && nextStatus === 'unpaid') nextStatus = 'pending_review'
    const primary = parsedLines[0]
    const lot = lots.find((l) => l.id === primary.lotId)
    const fee = Math.max(0, Number(feePct) || 0)
    const createdAt = existing?.createdAt || Date.now()
    const issuedAt = issueDate ? Date.parse(`${issueDate}T12:00:00`) : existing?.issuedAt
    const invoice: Invoice = {
      id,
      lotId: primary.lotId,
      channel: lot?.channel || existing?.channel || 'marketplace',
      qty: parsedLines.reduce((s, line) => s + line.qty, 0),
      unitPrice: primary.unitPrice,
      amount: 0,
      status: nextStatus === 'paid' || nextStatus === 'pending_review' || nextStatus === 'unpaid' || nextStatus === 'declined'
        ? nextStatus
        : 'draft',
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
      shipEmail: shipEmail.trim() || undefined,
      shipPhone: shipPhone.trim() || undefined,
      shipAttn: shipAttn.trim() || undefined,
      billCompany: (billSameAsShip ? shipCompany : billCompany).trim() || undefined,
      billAddress: (billSameAsShip ? shipAddress : billAddress).trim() || undefined,
      billEmail: (billSameAsShip ? shipEmail : billEmail).trim() || undefined,
      billPhone: (billSameAsShip ? shipPhone : billPhone).trim() || undefined,
      billAttn: (billSameAsShip ? shipAttn : billAttn).trim() || undefined,
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
    closeComposer()
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
                  Decline issue
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
                  Decline issue
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
                  {copy.btnDecline}
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
                  {copy.btnDecline}
                </button>
              </>
            ) : null}
          </>
        ) : null}
        {canAdmin || canSuper ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const on = appliedFeePct(inv) > 0
              const rate = suggestedFeePct({ ...inv, feePct: undefined }, lots, settings)
              if (!on && rate <= 0) {
                setMsg('No fee configured for this list / marketplace.')
                return
              }
              const saveErr = saveInvoice({ ...inv, feePct: on ? 0 : rate }, inv.id)
              setErr(saveErr)
              setMsg(saveErr ? null : on ? `Removed fee on ${inv.id}` : `Applied ${rate}% fee on ${inv.id}`)
            }}
          >
            {appliedFeePct(inv) > 0
              ? 'Remove fee'
              : `Apply ${suggestedFeePct({ ...inv, feePct: undefined }, lots, settings)}% fee`}
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => load(inv)}>
          Edit
        </button>
        {allowCreate ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => duplicate(inv)}>
            Duplicate
          </button>
        ) : null}
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
            if (editingId === inv.id) {
              resetForm()
              closeComposer()
            }
          }}
        >
          Delete
        </button>
      </div>
    )
  }

  const rows = [...invoices]
    .filter((inv) => (queueFilter === 'all' ? true : inv.status === queueFilter))
    .sort((a, b) => {
      const rank = (s: Invoice['status']) =>
        s === 'draft' ? 0 : s === 'pending_review' ? 1 : s === 'declined' ? 2 : s === 'unpaid' ? 3 : 4
      return rank(a.status) - rank(b.status) || b.createdAt - a.createdAt
    })

  const queueCounts = {
    all: invoices.length,
    draft: invoices.filter((i) => i.status === 'draft').length,
    unpaid: invoices.filter((i) => i.status === 'unpaid').length,
    pending_review: invoices.filter((i) => i.status === 'pending_review').length,
    paid: invoices.filter((i) => i.status === 'paid').length,
  }

  if (mode === 'compose') {
    const stepIndex = STEPS.findIndex((s) => s.id === step)
    return (
      <div className="invoice-desk is-composer">
        <form
          className="invoice-composer"
          onSubmit={(e) => {
            e.preventDefault()
            if (step === 'review') void onSave()
            else goNext()
          }}
        >
          <header className="invoice-composer-head">
            <div>
              <p className="muted tiny invoice-composer-kicker">Commercial invoice</p>
              <h3>{editingId ? `Edit ${editingId}` : 'Create invoice'}</h3>
              <p className="muted tiny">
                {selectedClient
                  ? `${selectedClient.company} · ${selectedClient.accountId}`
                  : 'Buyer → lines → commercial details → review'}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                resetForm()
                closeComposer()
              }}
            >
              Back to queue
            </button>
          </header>

          <nav className="invoice-steps" aria-label="Invoice steps">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`invoice-step ${step === s.id ? 'on' : ''} ${i < stepIndex ? 'done' : ''}`}
                onClick={() => {
                  if (i <= stepIndex) {
                    setErr(null)
                    setStep(s.id)
                    return
                  }
                  for (let j = 0; j < i; j++) {
                    const block = validateStep(STEPS[j].id)
                    if (block) {
                      setErr(block)
                      setStep(STEPS[j].id)
                      return
                    }
                  }
                  setErr(null)
                  setStep(s.id)
                }}
              >
                <em>{i + 1}</em>
                {s.label}
              </button>
            ))}
          </nav>

          {step === 'buyer' ? (
            <section className="invoice-step-panel">
              <h4>Buyer & parties</h4>
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
                    <option value="">Select client…</option>
                    {clients.map((a) => (
                      <option key={a.accountId} value={a.accountId}>
                        {a.accountId} · {a.company}
                        {a.buyerNumber ? ` · #${a.buyerNumber}` : ''}
                      </option>
                    ))}
                  </select>
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
              </div>
              {selectedClient ? (
                <p className="muted tiny">
                  Buyer # {buyerNumber(selectedClient.accountId, selectedClient.buyerNumber)}
                </p>
              ) : null}
              <div className="invoice-parties">
                <div className="invoice-party">
                  <strong>Ship to</strong>
                  <label>
                    Company
                    <input value={shipCompany} onChange={(e) => setShipCompany(e.target.value)} />
                  </label>
                  <label>
                    Attn
                    <input
                      value={shipAttn}
                      onChange={(e) => setShipAttn(e.target.value)}
                      placeholder="Optional contact name"
                    />
                  </label>
                  <label>
                    Address
                    <textarea
                      rows={3}
                      value={shipAddress}
                      onChange={(e) => setShipAddress(e.target.value)}
                      placeholder="Street, city, country"
                    />
                  </label>
                  <div className="invoice-party-contact">
                    <label>
                      Tel
                      <input
                        value={shipPhone}
                        onChange={(e) => setShipPhone(e.target.value)}
                        placeholder="+852 …"
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        value={shipEmail}
                        onChange={(e) => setShipEmail(e.target.value)}
                      />
                    </label>
                  </div>
                </div>
                <div className="invoice-party">
                  <div className="invoice-party-head">
                    <strong>Bill to</strong>
                    <label className="check-inline">
                      <input
                        type="checkbox"
                        checked={billSameAsShip}
                        onChange={(e) => setBillSameAsShip(e.target.checked)}
                      />
                      Same as ship
                    </label>
                  </div>
                  {billSameAsShip ? (
                    <p className="muted tiny">Uses ship-to company, address, tel, and email.</p>
                  ) : (
                    <>
                      <label>
                        Company
                        <input value={billCompany} onChange={(e) => setBillCompany(e.target.value)} />
                      </label>
                      <label>
                        Attn
                        <input
                          value={billAttn}
                          onChange={(e) => setBillAttn(e.target.value)}
                          placeholder="Optional contact name"
                        />
                      </label>
                      <label>
                        Address
                        <textarea
                          rows={3}
                          value={billAddress}
                          onChange={(e) => setBillAddress(e.target.value)}
                        />
                      </label>
                      <div className="invoice-party-contact">
                        <label>
                          Tel
                          <input
                            value={billPhone}
                            onChange={(e) => setBillPhone(e.target.value)}
                            placeholder="+852 …"
                          />
                        </label>
                        <label>
                          Email
                          <input
                            type="email"
                            value={billEmail}
                            onChange={(e) => setBillEmail(e.target.value)}
                          />
                        </label>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          {step === 'lines' ? (
            <section className="invoice-step-panel">
              <h4>Line items</h4>
              <label className="invoice-lot-search">
                Add from catalog
                <div className="invoice-lot-search-row">
                  <input
                    value={lotQuery}
                    onChange={(e) => setLotQuery(e.target.value)}
                    placeholder="Search model, ID, capacity…"
                  />
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const lotId = e.target.value
                      if (!lotId) return
                      const lot = lots.find((l) => l.id === lotId)
                      if (lot) addLine(lot)
                      e.target.value = ''
                    }}
                  >
                    <option value="">Pick lot…</option>
                    {filteredLots.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.id} · {l.model} {l.capacity} · {usd(l.buyNowPrice ?? l.currentPrice)}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              <div className="invoice-line-cards">
                {lines.map((row, index) => {
                  const qty = Math.max(0, Number(row.qty) || 0)
                  const price = Math.max(0, Number(row.unitPrice) || 0)
                  return (
                    <article key={row.key} className="invoice-line-card is-row">
                      <span className="invoice-line-num" aria-hidden>
                        {index + 1}
                      </span>
                      <div className="invoice-line-row" aria-label={`Line ${index + 1}`}>
                        <label className="invoice-line-catalog">
                          Catalog
                          <select value={row.lotId} onChange={(e) => setLineLot(row.key, e.target.value)}>
                            <option value="CUSTOM">Custom</option>
                            {lots.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.id} · {l.model} {l.capacity}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="invoice-line-desc">
                          Description
                          <input
                            value={row.description}
                            onChange={(e) => updateLine(row.key, { description: e.target.value })}
                            placeholder="Item"
                          />
                        </label>
                        <label className="invoice-line-box">
                          Box
                          <input
                            value={row.boxNo}
                            onChange={(e) => updateLine(row.key, { boxNo: e.target.value })}
                          />
                        </label>
                        <label className="invoice-line-sim">
                          SIM
                          <select value={row.sim} onChange={(e) => updateLine(row.key, { sim: e.target.value })}>
                            {SIMS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="invoice-line-grade">
                          Grade
                          <select
                            value={row.grade}
                            onChange={(e) => updateLine(row.key, { grade: e.target.value })}
                          >
                            {GRADES.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="invoice-line-qty">
                          Qty
                          <input
                            id={`line-qty-${row.key}`}
                            type="number"
                            min={1}
                            step={1}
                            value={row.qty}
                            onChange={(e) => updateLine(row.key, { qty: e.target.value })}
                          />
                        </label>
                        <label className="invoice-line-unit">
                          Unit
                          <input
                            id={`line-price-${row.key}`}
                            type="number"
                            min={0}
                            step={0.01}
                            value={row.unitPrice}
                            onChange={(e) => updateLine(row.key, { unitPrice: e.target.value })}
                          />
                        </label>
                        <div className="invoice-line-amount">
                          <span className="invoice-line-amount-lab">Amount</span>
                          <output
                            className="invoice-line-amount-value"
                            aria-label={`Line ${index + 1} amount`}
                          >
                            {money(qty * price)}
                          </output>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm invoice-line-remove"
                          disabled={lines.length <= 1}
                          onClick={() => removeLine(row.key)}
                          aria-label={`Remove line ${index + 1}`}
                        >
                          ×
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
              <div className="invoice-line-add">
                <button type="button" className="btn btn-ghost btn-sm" onClick={addCustomLine}>
                  Add
                </button>
              </div>
            </section>
          ) : null}

          {step === 'commercial' ? (
            <section className="invoice-step-panel">
              <h4>Commercial details</h4>
              <div className="invoice-editor-meta">
                <label>
                  Invoice date
                  <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                </label>
                <label>
                  Auction / label
                  <input
                    value={auctionLabel}
                    onChange={(e) => setAuctionLabel(e.target.value)}
                    placeholder="Optional title on PDF"
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
                <label className="admin-span">
                  Remarks (printed)
                  <input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                </label>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowShipMeta((v) => !v)}
              >
                {showShipMeta ? 'Hide shipping fields' : 'Shipping / tracking (optional)'}
              </button>
              {showShipMeta ? (
                <div className="invoice-editor-meta" style={{ marginTop: 10 }}>
                  <label>
                    Tracking no
                    <input value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} />
                  </label>
                  <label>
                    Shipping date
                    <input type="date" value={shippedDate} onChange={(e) => setShippedDate(e.target.value)} />
                  </label>
                </div>
              ) : null}
              {editingId && selected?.receiptName ? (
                <label className="check-inline" style={{ marginTop: 12 }}>
                  <input
                    type="checkbox"
                    checked={keepReceipt}
                    onChange={(e) => setKeepReceipt(e.target.checked)}
                  />
                  Keep current receipt ({selected.receiptName})
                </label>
              ) : null}
              <label className="btn btn-ghost invoice-receipt-btn" style={{ marginTop: 10 }}>
                Attach payment receipt
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  hidden
                  onChange={(e) => void onPick(e.target.files)}
                />
              </label>
              {file ? <span className="muted tiny"> {file.name}</span> : null}
            </section>
          ) : null}

          {step === 'review' ? (
            <section className="invoice-step-panel invoice-review-panel">
              <h4>Review before save</h4>
              <dl className="invoice-review-summary">
                <div>
                  <dt>Invoice</dt>
                  <dd className="mono">{id}</dd>
                </div>
                <div>
                  <dt>Client</dt>
                  <dd>
                    {selectedClient?.company || '—'}
                    <span className="muted tiny"> {accountId}</span>
                  </dd>
                </div>
                <div>
                  <dt>Lines</dt>
                  <dd>
                    {lines.length} · {draftTotals.qty.toLocaleString()} pcs
                  </dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd className="price-cell">{money(draftTotals.total)}</dd>
                </div>
                <div>
                  <dt>Status after save</dt>
                  <dd>Draft (issue from queue with Admin + Super stamps)</dd>
                </div>
              </dl>
              <ul className="invoice-review-lines">
                {lines.map((row) => {
                  const q = Number(row.qty) || 0
                  const p = Number(row.unitPrice) || 0
                  return (
                    <li key={row.key}>
                      <span>
                        {row.description || row.lotId}
                        <span className="muted tiny">
                          {' '}
                          · {q} × {money(p)}
                        </span>
                      </span>
                      <strong className="invoice-line-amount-value">{money(q * p)}</strong>
                    </li>
                  )
                })}
              </ul>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setDraftPreviewOpen(true)}
              >
                Open PDF preview
              </button>
            </section>
          ) : null}

          <footer className="invoice-composer-foot">
            <div className="invoice-sticky-totals">
              <span>Goods {money(draftTotals.goods)}</span>
              <span>
                Fee {draftTotals.feePct}% · {money(draftTotals.fee)}
              </span>
              <strong>{money(draftTotals.total)}</strong>
            </div>
            <div className="invoice-composer-actions">
              {step !== 'buyer' ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={goBack}>
                  Back
                </button>
              ) : null}
              {step !== 'review' ? (
                <button type="submit" className="btn btn-primary btn-sm">
                  Continue
                </button>
              ) : (
                <button type="submit" className="btn btn-primary btn-sm">
                  {editingId ? 'Save invoice' : 'Save draft'}
                </button>
              )}
            </div>
          </footer>
        </form>
        {err ? <p className="error">{err}</p> : null}
        {msg ? <p className="ok">{msg}</p> : null}
        {draftPreviewOpen ? (
          <InvoicePreview invoice={reviewInvoice} onClose={() => setDraftPreviewOpen(false)} />
        ) : null}
      </div>
    )
  }

  return (
    <div className="invoice-desk">
      <div className="invoice-queue-head">
        <div>
          <h3 className="pay-queue-title">Invoice queue</h3>
          <p className="muted tiny">
            Create drafts here. Issue needs Admin + Super. Payment needs dual accept after a receipt.
          </p>
        </div>
        {allowCreate ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            Create invoice
          </button>
        ) : null}
      </div>

      {allowCreate && (sourceCarts.length || sourceOffers.length || winDrafts.length) ? (
        <div className="invoice-smart-create">
          <strong>Smart create</strong>
          <div className="invoice-smart-chips">
            {sourceCarts.map((o) => (
              <button key={o.id} type="button" className="btn btn-ghost btn-sm" onClick={() => fromCart(o)}>
                Cart {o.id}
              </button>
            ))}
            {sourceOffers.map((o) => (
              <button key={o.id} type="button" className="btn btn-ghost btn-sm" onClick={() => fromOffer(o)}>
                Offer {o.id}
              </button>
            ))}
            {winDrafts.map((inv) => (
              <button key={inv.id} type="button" className="btn btn-ghost btn-sm" onClick={() => load(inv)}>
                Win draft {inv.id}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="invoice-queue-filters" role="tablist" aria-label="Filter invoices">
        {(
          [
            ['all', 'All'],
            ['draft', 'Drafts'],
            ['unpaid', 'Unpaid'],
            ['pending_review', 'Pay review'],
            ['paid', 'Paid'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`btn btn-ghost btn-sm ${queueFilter === id ? 'on' : ''}`}
            onClick={() => setQueueFilter(id)}
          >
            {label}
            {queueCounts[id] ? <em>{queueCounts[id]}</em> : null}
          </button>
        ))}
      </div>

      {err ? <p className="error">{err}</p> : null}
      {msg ? <p className="ok">{msg}</p> : null}

      <div className="table-wrap pay-queue">
        <table className="auction-table invoice-queue-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Client</th>
              <th>Buyer #</th>
              <th>Quantity</th>
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
                      <span
                        className={inv.issueAdmin ? 'inv-q-mark' : 'inv-q-mark is-empty'}
                        title={inv.issueAdmin ? `${inv.issueAdmin.decision} · ${inv.issueAdmin.by}` : 'Admin pending'}
                      >
                        A{stampMark(inv.issueAdmin)}
                      </span>
                      <span
                        className={inv.issueSuper ? 'inv-q-mark' : 'inv-q-mark is-empty'}
                        title={inv.issueSuper ? `${inv.issueSuper.decision} · ${inv.issueSuper.by}` : 'Super pending'}
                      >
                        S{stampMark(inv.issueSuper)}
                      </span>
                    </div>
                    <div>
                      <span className="inv-q-stamp-lab">Pay</span>
                      <span
                        className={inv.adminReview ? 'inv-q-mark' : 'inv-q-mark is-empty'}
                        title={inv.adminReview ? `${inv.adminReview.decision} · ${inv.adminReview.by}` : 'Admin pending'}
                      >
                        A{stampMark(inv.adminReview)}
                      </span>
                      <span
                        className={inv.superReview ? 'inv-q-mark' : 'inv-q-mark is-empty'}
                        title={
                          inv.superReview ? `${inv.superReview.decision} · ${inv.superReview.by}` : 'Super pending'
                        }
                      >
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
                          download={
                            inv.receiptData.startsWith('data:image')
                              ? undefined
                              : inv.receiptName || 'receipt.pdf'
                          }
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
        {!rows.length ? (
          <p className="empty">
            {queueFilter === 'all'
              ? 'No invoices yet. Create one or prefill from a cart / offer.'
              : 'Nothing in this filter.'}
          </p>
        ) : null}
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
