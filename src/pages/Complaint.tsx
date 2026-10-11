import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_SETTINGS } from '../data'
import { useStore } from '../store'

const TOPICS = [
  { id: 'lot', label: 'Lot / auction' },
  { id: 'invoice', label: 'Invoice / payment' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'other', label: 'Other' },
] as const

type TopicId = (typeof TOPICS)[number]['id']

function displayName(user: {
  firstName?: string
  lastName?: string
  company?: string
} | null) {
  if (!user) return ''
  const person = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return person || user.company || ''
}

/** Structured dispute handoff — mailto/copy to Super enquiry until Brevo. */
export function Complaint() {
  const { settings, user } = useStore()
  const brand = settings.brandName || 'eQuarios'
  const contact = {
    ...DEFAULT_SETTINGS.contact,
    ...settings.contact,
  }
  const to = (contact.emailEnquiry || contact.emailBusiness || '').trim()

  const [name, setName] = useState(() => displayName(user))
  const [email, setEmail] = useState(() => user?.email || '')
  const [topic, setTopic] = useState<TopicId>('lot')
  const [reference, setReference] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'ready' | 'copied' | 'missing'>('idle')

  useEffect(() => {
    if (!user) return
    setName((prev) => prev || displayName(user))
    setEmail((prev) => prev || user.email || '')
  }, [user])

  const topicLabel = useMemo(
    () => TOPICS.find((t) => t.id === topic)?.label || 'Other',
    [topic],
  )

  const composed = useMemo(() => {
    const lines = [
      `Name: ${name.trim() || '—'}`,
      `Email: ${email.trim() || '—'}`,
      `Topic: ${topicLabel}`,
      `Reference: ${reference.trim() || '—'}`,
      user?.accountId ? `Account: ${user.accountId}` : null,
      '',
      message.trim(),
    ].filter((line): line is string => line !== null)
    return lines.join('\n')
  }, [name, email, topicLabel, reference, message, user?.accountId])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!to) {
      setStatus('missing')
      return
    }
    if (!name.trim() || !email.trim() || !message.trim()) return

    const subject = encodeURIComponent(`${brand} complaint — ${topicLabel}`)
    const body = encodeURIComponent(composed)
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
    setStatus('ready')
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(
        `To: ${to || '—'}\nSubject: ${brand} complaint — ${topicLabel}\n\n${composed}`,
      )
      setStatus('copied')
    } catch {
      setStatus('ready')
    }
  }

  return (
    <div className="complaint-page">
      <h2 className="complaint-title">Complaint</h2>
      <p className="muted tiny mypage-intro">
        Lot, invoice, or shipping issue — staff review from Admin. For general questions use{' '}
        <Link to="/support#enquiry">Support enquiry</Link>.
      </p>

      <form className="complaint-form support-enquiry-form" onSubmit={onSubmit}>
        <div className="support-enquiry-row">
          <label className="field">
            <span>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>
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
        </div>

        <div className="support-enquiry-row">
          <label className="field">
            <span>Topic</span>
            <select value={topic} onChange={(e) => setTopic(e.target.value as TopicId)} required>
              {TOPICS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Reference</span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Lot ID, invoice #, order #"
            />
          </label>
        </div>

        <label className="field">
          <span>What went wrong</span>
          <textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What happened, when, and what you need…"
            required
          />
        </label>

        <div className="support-enquiry-actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={!to}>
            Send complaint
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyMessage()}>
            Copy message
          </button>
        </div>

        {status === 'ready' ? (
          <p className="ok tiny" role="status">
            Your mail app should open with this complaint. If it doesn’t, use Copy message.
          </p>
        ) : null}
        {status === 'copied' ? (
          <p className="ok tiny" role="status">
            Copied — paste into your email to {to || 'the desk'}.
          </p>
        ) : null}
        {status === 'missing' || !to ? (
          <p className="tiny imei-err" role="alert">
            Enquiry email isn’t set yet. Super can add it under Footer &amp; contact.
          </p>
        ) : null}
      </form>
    </div>
  )
}
