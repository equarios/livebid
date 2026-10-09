import { useEffect, useState } from 'react'
import { useStore } from '../store'
import type { EmailPrefs } from '../types'

const PREF_ROWS: Array<{ key: keyof EmailPrefs; label: string; hint: string }> = [
  { key: 'win', label: 'Auction wins', hint: 'When you win units and an invoice is drafted' },
  { key: 'offer', label: 'Offer decisions', hint: 'Accepted or declined marketplace offers' },
  { key: 'cart', label: 'Cart decisions', hint: 'Accepted or declined cart reviews' },
  { key: 'invoice', label: 'Invoices', hint: 'Issued invoices ready to pay' },
  { key: 'payment', label: 'Payments', hint: 'Payment confirmed' },
  { key: 'shipping', label: 'Shipping', hint: 'Tracking updates' },
  { key: 'auth', label: 'Account security', hint: 'Signup and password changes' },
  { key: 'outbid', label: 'Outbid alerts', hint: 'When you lose fill on a live lot (can be noisy)' },
  { key: 'closing', label: 'Closing soon', hint: 'Watchlist lots ending within about an hour' },
  { key: 'fill', label: 'Fill updates', hint: 'Optional fill tips (usually off)' },
]

export function Account() {
  const {
    user,
    settings,
    accounts,
    apiMode,
    emailPrefs,
    loadEmailPrefs,
    saveEmailPrefs,
  } = useStore()
  const address = accounts.find((a) => a.accountId === user?.accountId)?.address
  const [prefs, setPrefs] = useState<EmailPrefs | null>(emailPrefs)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    void loadEmailPrefs().then((p) => setPrefs(p))
  }, [loadEmailPrefs])

  useEffect(() => {
    if (emailPrefs) setPrefs(emailPrefs)
  }, [emailPrefs])

  async function toggle(key: keyof EmailPrefs) {
    if (!prefs) return
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSaving(true)
    const err = await saveEmailPrefs({ [key]: next[key] })
    setSaving(false)
    setMsg(err || (apiMode ? 'Saved.' : 'Saved for this session (start API for persistence).'))
  }

  return (
    <div className="account-settings-page">
      <p className="muted tiny mypage-intro">{settings.copy.accountIntro}</p>
      <div className="card account-card">
        <dl className="specs">
          <div>
            <dt>Account ID</dt>
            <dd>{user?.accountId}</dd>
          </div>
          <div>
            <dt>Company</dt>
            <dd>{user?.company}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>Ship / bill to</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>
              {address || 'Set by Super admin'}
            </dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>
              {user?.role === 'superadmin'
                ? 'Super admin'
                : user?.role === 'admin'
                  ? 'Admin'
                  : 'Client'}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{user?.status || 'active'}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>USD</dd>
          </div>
          <div>
            <dt>Courier</dt>
            <dd>DHL · UPS · FedEx (demo)</dd>
          </div>
          <div>
            <dt>Time zone</dt>
            <dd>Asia/Tokyo (JST)</dd>
          </div>
        </dl>
      </div>

      <div className="card account-card" style={{ marginTop: '1rem' }}>
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.35rem' }}>Email notifications</h2>
        <p className="muted tiny" style={{ marginTop: 0 }}>
          In-app bell notices always fire. Email is optional — off by default for noisy events like
          outbid / closing soon. Without a mail provider key, the server logs email to the console.
        </p>
        {prefs ? (
          <ul className="pref-list" style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0' }}>
            {PREF_ROWS.map((row) => (
              <li key={row.key} style={{ marginBottom: '0.55rem' }}>
                <label className="check-inline" style={{ alignItems: 'flex-start', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={prefs[row.key]}
                    disabled={saving}
                    onChange={() => void toggle(row.key)}
                  />
                  <span>
                    <strong>{row.label}</strong>
                    <span className="muted tiny" style={{ display: 'block' }}>
                      {row.hint}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted tiny">Loading preferences…</p>
        )}
        {msg ? <p className={msg === 'Saved.' || msg.startsWith('Saved') ? 'ok' : 'error'}>{msg}</p> : null}
      </div>
    </div>
  )
}
