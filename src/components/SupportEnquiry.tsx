import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_SETTINGS } from '../data'
import { useStore } from '../store'

const TOPICS = [
  { id: 'store', label: 'Store order' },
  { id: 'wholesale', label: 'Wholesale / auctions' },
  { id: 'invoice', label: 'Invoice / payment' },
  { id: 'account', label: 'Account' },
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

/** Topic-first support enquiry — mailto until Brevo; same form on Support page + floating Support. */
export function SupportEnquiry({
  variant = 'page',
}: {
  variant?: 'page' | 'panel'
}) {
  const { settings, user } = useStore()
  const [params] = useSearchParams()
  const orderRef = (params.get('order') || '').trim()
  const brand = settings.brandName || 'eQuarios'
  const contact = {
    ...DEFAULT_SETTINGS.contact,
    ...settings.contact,
  }
  const to = (contact.emailEnquiry || contact.emailBusiness || '').trim()
  const panel = variant === 'panel'

  const [name, setName] = useState(() => displayName(user))
  const [email, setEmail] = useState(() => user?.email || '')
  const [topic, setTopic] = useState<TopicId>('store')
  const [message, setMessage] = useState(() =>
    orderRef ? `Regarding store order ${orderRef}:\n` : '',
  )
  const [status, setStatus] = useState<'idle' | 'ready' | 'copied' | 'missing'>('idle')

  useEffect(() => {
    if (!user) return
    setName((prev) => prev || displayName(user))
    setEmail((prev) => prev || user.email || '')
  }, [user])

  useEffect(() => {
    if (!orderRef) return
    setTopic('store')
    setMessage((prev) =>
      prev.includes(orderRef) ? prev : `Regarding store order ${orderRef}:\n${prev}`,
    )
  }, [orderRef])

  const topicLabel = useMemo(
    () => TOPICS.find((t) => t.id === topic)?.label || 'Other',
    [topic],
  )

  const composed = useMemo(() => {
    const lines = [
      `Name: ${name.trim() || '—'}`,
      `Email: ${email.trim() || '—'}`,
      `Topic: ${topicLabel}`,
      user?.accountId ? `Account: ${user.accountId}` : null,
      '',
      message.trim(),
    ].filter((line): line is string => line !== null)
    return lines.join('\n')
  }, [name, email, topicLabel, message, user?.accountId])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!to) {
      setStatus('missing')
      return
    }
    if (!name.trim() || !email.trim() || !message.trim()) return

    const subject = encodeURIComponent(`${brand} support — ${topicLabel}`)
    const body = encodeURIComponent(composed)
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
    setStatus('ready')
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(
        `To: ${to || '—'}\nSubject: ${brand} support — ${topicLabel}\n\n${composed}`,
      )
      setStatus('copied')
    } catch {
      setStatus('ready')
    }
  }

  const form = (
    <form
      className={`support-enquiry-form${panel ? ' is-panel' : ''}`}
      onSubmit={onSubmit}
    >
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
        <span>Message</span>
        <textarea
          rows={panel ? 3 : 5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Order #, lot ID, invoice #, or what you need…"
          required
        />
      </label>

      <div className="support-enquiry-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={!to}>
          Send enquiry
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyMessage()}>
          Copy
        </button>
      </div>

      {status === 'ready' ? (
        <p className="tiny ok" role="status">
          {panel
            ? 'Mail app should open — use Copy if it doesn’t.'
            : `Your mail app should open with this enquiry. If it doesn’t, use Copy or email ${to} directly.`}
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

  if (panel) {
    return (
      <div className="support-enquiry is-panel" aria-label="Quick enquiry">
        <p className="support-enquiry-lead is-panel">
          Tell us the topic — reply usually within one business day.
        </p>
        {form}
      </div>
    )
  }

  return (
    <section className="how-strip support-enquiry" id="enquiry" aria-label="Quick enquiry">
      <h2>Quick enquiry</h2>
      <p className="support-enquiry-lead">
        Tell us the topic — we usually reply within one business day.
        {to ? (
          <>
            {' '}
            Or email <a href={`mailto:${to}`}>{to}</a> directly.
          </>
        ) : null}
      </p>
      {form}
    </section>
  )
}
