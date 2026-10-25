import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { MyPageHead } from '../components/MyPageHead'
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
  const [formError, setFormError] = useState<string | null>(null)

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
    const text = message.trim()
    if (!name.trim() || !email.trim() || text.length < 12) {
      setFormError('Describe what went wrong in at least a short sentence.')
      return
    }
    if (text.length > 2000) {
      setFormError('Keep the complaint under 2000 characters.')
      return
    }
    setFormError(null)

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
      <MyPageHead
        title="Complaint"
        note="Lot, invoice, or shipping issue — staff review from Admin."
        trust={[
          { to: '/support#enquiry', label: 'Support enquiry' },
          { to: '/account/documents', label: 'Documents' },
        ]}
      />

      <form className="complaint-form help-panel" noValidate onSubmit={onSubmit}>
        <h3 className="mypage-panel-label">File a complaint</h3>

        <fieldset className="complaint-topic">
          <legend className="filter-trigger-title">Topic</legend>
          <div className="ti-chips" role="radiogroup" aria-label="Topic">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={topic === t.id}
                className={`btn btn-sm ti-chip${topic === t.id ? ' is-active' : ''}`}
                onClick={() => setTopic(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="complaint-row">
          <label className="complaint-field">
            <span className="filter-trigger-title">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>
          <label className="complaint-field">
            <span className="filter-trigger-title">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
        </div>

        <label className="complaint-field">
          <span className="filter-trigger-title">Reference</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Lot ID, invoice #, order #"
          />
        </label>

        <label className="complaint-field">
          <span className="filter-trigger-title">What went wrong</span>
          <textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What happened, when, and what you need…"
            required
            minLength={12}
            maxLength={2000}
          />
        </label>

        {formError ? (
          <p className="error tiny" role="alert">
            {formError}
          </p>
        ) : null}
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

        <div className="ti-bar complaint-bar">
          <div className="ti-bar-estimate">
            <span className="muted tiny">To</span>
            <strong className="complaint-bar-to">{to || 'Not set'}</strong>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyMessage()}>
            Copy message
          </button>
          <button type="submit" className="btn btn-primary" disabled={!to}>
            Send complaint
          </button>
        </div>
      </form>
    </div>
  )
}
