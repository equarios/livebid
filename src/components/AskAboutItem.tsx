import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useStore } from '../store'
import { ModalShell } from './ModalShell'

export type AskChannel = 'store' | 'auction' | 'marketplace'

type Props = {
  channel: AskChannel
  itemId: string
  itemTitle: string
  itemHref?: string
  /** Compact ghost button under buy actions / lot modal. */
  className?: string
  /** Button label (default: Ask about this item). */
  label?: string
  /** Prefill the message (e.g. restock notify). */
  presetMessage?: string
  /** Dialog heading. */
  dialogTitle?: string
}

function displayName(user: {
  firstName?: string
  lastName?: string
  company?: string
} | null) {
  if (!user) return ''
  const person = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return person || user.company || ''
}

/** Product-linked question — store PDP, auction & marketplace lot preview. */
export function AskAboutItem({
  channel,
  itemId,
  itemTitle,
  itemHref,
  className,
  label,
  presetMessage,
  dialogTitle,
}: Props) {
  const { user } = useStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(() => displayName(user))
  const [email, setEmail] = useState(() => user?.email || '')
  const [message, setMessage] = useState(() => presetMessage || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!user) return
    setName((prev) => prev || displayName(user))
    setEmail((prev) => prev || user.email || '')
  }, [user])

  function openDialog() {
    setMessage(presetMessage || '')
    setErr(null)
    setDone(false)
    setOpen(true)
  }

  function close() {
    setOpen(false)
    setErr(null)
    setDone(false)
    setMessage(presetMessage || '')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const text = message.trim()
    if (!name.trim() || !email.trim()) return
    if (text.length < 8 || text.length > 2000) {
      setErr('Write at least a short question (8–2000 characters).')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await api.askAboutItem({
        channel,
        itemId,
        itemTitle,
        itemHref,
        name: name.trim(),
        email: email.trim(),
        message: text,
      })
      setDone(true)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Could not send — try again.')
    } finally {
      setBusy(false)
    }
  }

  const channelLabel =
    channel === 'store' ? 'store' : channel === 'auction' ? 'auction' : 'marketplace'

  return (
    <>
      <button
        type="button"
        className={className || 'btn btn-ghost btn-sm'}
        onClick={openDialog}
      >
        {label || 'Ask about this item'}
      </button>
      {open ? (
        <ModalShell onClose={close}>
          <div
            className="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ask-item-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 id="ask-item-title">{dialogTitle || 'Ask about this item'}</h2>
            <p className="muted tiny">
              {itemTitle}
              <span className="mono"> · {itemId}</span>
              <span> · {channelLabel}</span>
            </p>
            {done ? (
              <>
                <p className="tiny ok" role="status">
                  {presetMessage
                    ? 'Got it — we will email you if this comes back in stock.'
                    : 'Sent — we usually reply within one business day.'}
                </p>
                <div className="modal-actions">
                  <button type="button" className="btn btn-primary" onClick={close}>
                    Close
                  </button>
                </div>
              </>
            ) : (
              <form className="support-enquiry-form" onSubmit={(ev) => void onSubmit(ev)}>
                <div className="support-enquiry-row">
                  <label className="field">
                    <span>Name</span>
                    <input
                      value={name}
                      onChange={(ev) => setName(ev.target.value)}
                      autoComplete="name"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(ev) => setEmail(ev.target.value)}
                      autoComplete="email"
                      required
                    />
                  </label>
                </div>
                <label className="field">
                  <span>{presetMessage ? 'Note (optional edit)' : 'Your question'}</span>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(ev) => setMessage(ev.target.value)}
                    placeholder="Condition, qty, shipping, compatibility…"
                    required
                    minLength={8}
                    maxLength={2000}
                  />
                </label>
                {err ? (
                  <p className="error" role="alert">
                    {err}
                  </p>
                ) : null}
                <div className="modal-actions">
                  <button type="button" className="btn" onClick={close} disabled={busy}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    {busy ? 'Sending…' : presetMessage ? 'Notify me' : 'Send question'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </ModalShell>
      ) : null}
    </>
  )
}
