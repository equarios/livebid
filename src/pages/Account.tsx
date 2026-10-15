import { useEffect, useMemo, useState } from 'react'
import { buildDigestPreviewLines } from '../lib/digestPreview'
import { useNow, useStore } from '../store'
import type { EmailPrefs } from '../types'

const PREF_ROWS: Array<{ key: keyof EmailPrefs; label: string; hint: string }> = [
  { key: 'win', label: 'Auction wins', hint: 'When you win units and an invoice is drafted' },
  { key: 'thanks', label: 'Auction closed', hint: 'Thanks for joining when a list you bid on ends' },
  { key: 'offer', label: 'Offer decisions', hint: 'Accepted or declined marketplace offers' },
  { key: 'cart', label: 'Cart decisions', hint: 'Accepted or declined cart reviews' },
  { key: 'invoice', label: 'Invoices', hint: 'Issued invoices ready to pay' },
  { key: 'payment', label: 'Payments', hint: 'Payment confirmed' },
  { key: 'shipping', label: 'Shipping', hint: 'Tracking updates' },
  { key: 'auth', label: 'Account security', hint: 'Signup and password changes' },
  {
    key: 'outbid',
    label: 'Close-to-fill alerts',
    hint: 'Only when +$1 would get you units again (not every outbid)',
  },
  { key: 'closing', label: 'Closing soon', hint: 'Watchlist lots ending within about an hour' },
  {
    key: 'sealed',
    label: 'Extra sealed started',
    hint: 'When overtime opens on a lot you already bid (prior bidders only)',
  },
  {
    key: 'watch',
    label: 'Watch filters',
    hint: 'In-app when a lot matches; emailed in the daily digest if digest is on',
  },
  {
    key: 'digest',
    label: 'Daily desk digest',
    hint: 'Once a day: outbid, invoices due, and batched watch matches',
  },
  { key: 'fill', label: 'Fill updates', hint: 'Optional fill tips (usually off)' },
]

export function Account() {
  const {
    user,
    accounts,
    apiMode,
    emailPrefs,
    loadEmailPrefs,
    saveEmailPrefs,
    lots,
    bids,
    invoices,
  } = useStore()
  const now = useNow()
  const address = accounts.find((a) => a.accountId === user?.accountId)?.address
  const [prefs, setPrefs] = useState<EmailPrefs | null>(emailPrefs)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const digestPreview = useMemo(() => {
    if (!user) return []
    return buildDigestPreviewLines({
      accountId: user.accountId,
      lots,
      bids: bids || [],
      invoices: invoices || [],
      now,
    })
  }, [user, lots, bids, invoices, now])

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

  const roleLabel =
    user?.role === 'superadmin'
      ? 'Super admin'
      : user?.role === 'admin'
        ? 'Admin'
        : 'Client'

  return (
    <div className="account-settings-page">
      <div className="mypage-meta">
        <span className="mypage-meta-label">{user?.company || user?.accountId}</span>
        <em>{roleLabel}</em>
        <em>{user?.status || 'active'}</em>
      </div>
      <div className="account-settings-grid">
        <section className="account-desk-block">
          <h3>Profile</h3>
          <dl className="specs account-specs">
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
              <dd className="account-address">{address || 'Set by Super admin'}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{roleLabel}</dd>
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
              <dd>DHL · UPS · FedEx</dd>
            </div>
            <div>
              <dt>Time zone</dt>
              <dd>Asia/Tokyo (JST)</dd>
            </div>
          </dl>
        </section>

        <section className="account-desk-block">
          <h3>Email notifications</h3>
          <p className="muted tiny">
            In-app bell notices always fire. Email is optional — noisy events stay off by default.
            Quiet hours (UTC 22:00–07:00): outbid / watch / digest / closing skip email; invoices and
            sealed still send.
          </p>
          {prefs ? (
            <ul className="pref-list">
              {PREF_ROWS.map((row) => (
                <li key={row.key}>
                  <label className="check-inline pref-row">
                    <input
                      type="checkbox"
                      checked={prefs[row.key]}
                      disabled={saving}
                      onChange={() => void toggle(row.key)}
                    />
                    <span>
                      <strong>{row.label}</strong>
                      <span className="muted tiny">{row.hint}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted tiny">Loading preferences…</p>
          )}
          {prefs?.digest ? (
            <div className="digest-preview" aria-live="polite">
              <strong className="tiny">Digest preview (right now)</strong>
              {digestPreview.length ? (
                <p className="muted tiny">{digestPreview.join(' · ')}</p>
              ) : (
                <p className="muted tiny">
                  Nothing to send — watch matches, outbid lots, and due invoices show up here.
                </p>
              )}
            </div>
          ) : null}
          {msg ? (
            <p className={msg === 'Saved.' || msg.startsWith('Saved') ? 'ok' : 'error'}>{msg}</p>
          ) : null}
        </section>
      </div>
    </div>
  )
}
