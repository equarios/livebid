import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_SETTINGS } from '../data'
import { useStore } from '../store'

function displayName(user: {
  firstName?: string
  lastName?: string
  company?: string
} | null) {
  if (!user) return ''
  const person = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return person || user.company || ''
}

/** Wholesale sell-inventory intake — mailto until Brevo; not consumer trade-in. */
export function SellToUsEnquiry() {
  const { settings, user } = useStore()
  const brand = settings.brandName || 'eQuarios'
  const contact = {
    ...DEFAULT_SETTINGS.contact,
    ...settings.contact,
  }
  const to = (contact.emailEnquiry || contact.emailBusiness || '').trim()

  const [company, setCompany] = useState(() => user?.company || '')
  const [name, setName] = useState(() => displayName(user))
  const [email, setEmail] = useState(() => user?.email || '')
  const [phone, setPhone] = useState('')
  const [lotSummary, setLotSummary] = useState('')
  const [qty, setQty] = useState('')
  const [origin, setOrigin] = useState('')
  const [asking, setAsking] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'idle' | 'ready' | 'copied' | 'missing'>('idle')

  useEffect(() => {
    if (!user) return
    setCompany((prev) => prev || user.company || '')
    setName((prev) => prev || displayName(user))
    setEmail((prev) => prev || user.email || '')
  }, [user])

  const composed = useMemo(() => {
    const lines = [
      'Topic: Sell inventory (B2B)',
      `Company: ${company.trim() || '—'}`,
      `Contact: ${name.trim() || '—'}`,
      `Email: ${email.trim() || '—'}`,
      `Phone / WhatsApp: ${phone.trim() || '—'}`,
      user?.accountId ? `Account: ${user.accountId}` : null,
      '',
      `Lot summary: ${lotSummary.trim() || '—'}`,
      `Approx qty: ${qty.trim() || '—'}`,
      `Origin: ${origin.trim() || '—'}`,
      `Asking / target: ${asking.trim() || '—'}`,
      '',
      notes.trim() || null,
    ].filter((line): line is string => line !== null)
    return lines.join('\n')
  }, [company, name, email, phone, lotSummary, qty, origin, asking, notes, user?.accountId])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!to) {
      setStatus('missing')
      return
    }
    if (!company.trim() || !name.trim() || !email.trim() || !lotSummary.trim()) return

    const subject = encodeURIComponent(`${brand} sell inventory — ${company.trim()}`)
    const body = encodeURIComponent(composed)
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
    setStatus('ready')
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(
        `To: ${to || '—'}\nSubject: ${brand} sell inventory — ${company.trim() || 'supplier'}\n\n${composed}`,
      )
      setStatus('copied')
    } catch {
      setStatus('ready')
    }
  }

  return (
    <form className="support-enquiry-form sell-to-us-form" onSubmit={onSubmit}>
      <div className="support-enquiry-row">
        <label className="field">
          <span>Company</span>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="organization"
            required
          />
        </label>
        <label className="field">
          <span>Contact name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </label>
      </div>
      <div className="support-enquiry-row">
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="field">
          <span>Phone / WhatsApp</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="Optional"
          />
        </label>
      </div>
      <label className="field">
        <span>Lot summary</span>
        <textarea
          rows={3}
          value={lotSummary}
          onChange={(e) => setLotSummary(e.target.value)}
          placeholder="Models, grades, capacity mix…"
          required
        />
      </label>
      <div className="support-enquiry-row">
        <label className="field">
          <span>Approx qty</span>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="e.g. 200 pcs"
          />
        </label>
        <label className="field">
          <span>Origin</span>
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="e.g. USA / EU / HK"
          />
        </label>
      </div>
      <label className="field">
        <span>Asking / target (optional)</span>
        <input
          value={asking}
          onChange={(e) => setAsking(e.target.value)}
          placeholder="Per unit or lot total"
        />
      </label>
      <label className="field">
        <span>Notes</span>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Links to photos, CSV, timing…"
        />
      </label>
      <div className="support-enquiry-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={!to}>
          Send to buying desk
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyMessage()}>
          Copy
        </button>
        <Link to="/store/trade-in" className="btn btn-ghost btn-sm">
          Consumer trade-in
        </Link>
      </div>
      {status === 'ready' ? (
        <p className="tiny ok" role="status">
          Mail app should open with this offer request. If it doesn’t, use Copy or email {to}{' '}
          directly.
        </p>
      ) : null}
      {status === 'copied' ? (
        <p className="tiny ok" role="status">
          Copied — paste into your email to {to || 'the desk'}.
        </p>
      ) : null}
      {status === 'missing' || !to ? (
        <p className="tiny imei-err" role="alert">
          Enquiry email isn’t set yet. Super can add it under Footer &amp; contact.
        </p>
      ) : null}
    </form>
  )
}
