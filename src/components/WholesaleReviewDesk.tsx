import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'

type AppRow = {
  id: string
  accountId: string
  company: string
  email: string
  status: string
  wholesaleStatus: string
  staffNote: string
  submittedAt: string | null
  payload: Record<string, unknown>
}

type StuckRow = {
  accountId: string
  company: string
  email: string
  approvedAt: string
  lastNudgeAt: string | null
  nudgeCount: number
  lastBidAt: string | null
  bidAfterNudge: boolean
}

function stuckMeta(s: StuckRow) {
  const bits = [`approved ${new Date(s.approvedAt).toLocaleDateString()}`]
  if (s.lastNudgeAt) {
    bits.push(
      `nudged ${new Date(s.lastNudgeAt).toLocaleDateString()}${
        s.nudgeCount > 1 ? ` ×${s.nudgeCount}` : ''
      }`,
    )
    bits.push(s.bidAfterNudge ? 'bid after nudge' : 'no bid since nudge')
  } else {
    bits.push('never nudged')
  }
  if (s.lastBidAt && !s.bidAfterNudge) {
    bits.push(`last bid ${new Date(s.lastBidAt).toLocaleDateString()}`)
  }
  return bits.join(' · ')
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const i = result.indexOf(',')
      resolve(i >= 0 ? result.slice(i + 1) : result)
    }
    reader.onerror = () => reject(new Error('Could not read file.'))
    reader.readAsDataURL(file)
  })
}

type RecoveredRow = {
  accountId: string
  company: string
  email: string
  nudgedAt: string
  bidAt: string
  thanked: boolean
}

export function WholesaleReviewDesk() {
  const [rows, setRows] = useState<AppRow[]>([])
  const [stuck, setStuck] = useState<StuckRow[]>([])
  const [recovered, setRecovered] = useState<RecoveredRow[]>([])
  const [idleDays, setIdleDays] = useState(7)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [note, setNote] = useState<Record<string, string>>({})
  const [noticeBody, setNoticeBody] = useState<Record<string, string>>({})
  const [docTitle, setDocTitle] = useState<Record<string, string>>({})
  const [docCategory, setDocCategory] = useState<Record<string, string>>({})
  const [docFile, setDocFile] = useState<Record<string, File | null>>({})
  const [busy, setBusy] = useState<string | null>(null)

  /** Quick send when no application row (or for any account ID). */
  const [quickId, setQuickId] = useState('')
  const [quickTitle, setQuickTitle] = useState('Buyer form')
  const [quickCategory, setQuickCategory] = useState('staff_form')
  const [quickFile, setQuickFile] = useState<File | null>(null)
  const [quickNotice, setQuickNotice] = useState('')

  async function reload() {
    const [apps, idle, back] = await Promise.all([
      api.staffWholesaleApplications(),
      api.staffWholesaleStuck().catch(() => ({ stuck: [] as StuckRow[], idleDays: 7 })),
      api.staffWholesaleRecovered().catch(() => ({ recovered: [] as RecoveredRow[] })),
    ])
    setRows(apps.applications)
    setStuck(idle.stuck)
    setIdleDays(idle.idleDays || 7)
    setRecovered(back.recovered)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await reload()
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load applications.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function sendDoc(
    accountId: string,
    title: string,
    category: string,
    file: File,
    noteText?: string,
  ) {
    const dataBase64 = await fileToBase64(file)
    await api.staffSendDocument({
      accountId,
      title: title.trim() || file.name,
      category: category || 'staff_form',
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      dataBase64,
      note: noteText?.trim() || undefined,
    })
  }

  async function act(
    accountId: string,
    action:
      | 'approve'
      | 'reject'
      | 'needs_docs'
      | 'under_review'
      | 'note'
      | 'send_notice'
      | 'nudge_idle'
      | 'thanks_recover',
  ) {
    setBusy(accountId + action)
    setError(null)
    setOk(null)
    try {
      const file = docFile[accountId]
      if (file && (action === 'needs_docs' || action === 'send_notice')) {
        await sendDoc(
          accountId,
          docTitle[accountId] || file.name,
          docCategory[accountId] || 'staff_form',
          file,
          note[accountId],
        )
        setDocFile((f) => ({ ...f, [accountId]: null }))
      }
      const res = await api.staffWholesaleAction(accountId, {
        action,
        staffNote: note[accountId],
        noticeBody:
          noticeBody[accountId] ||
          (action === 'needs_docs'
            ? 'Please upload the requested documents on My Page → Documents.'
            : action === 'approve'
              ? 'Your wholesale desk is active. Next: save a watch filter, place a first bid, and confirm your ship/bill address.'
              : undefined),
        noticeTitle:
          action === 'needs_docs'
            ? 'Documents needed'
            : action === 'approve'
              ? 'Desk unlocked — wholesale approved'
              : action === 'nudge_idle'
                ? 'Your wholesale desk is waiting'
                : action === 'thanks_recover'
                  ? 'Good to see you back on the desk'
                  : 'Message from Equarios',
        noticeHref:
          action === 'approve' || action === 'nudge_idle' || action === 'thanks_recover'
            ? '/wholesale?onboard=1'
            : '/account/documents',
      })
      setOk(
        action === 'thanks_recover'
          ? res.already
            ? `${accountId}: already thanked today.`
            : `${accountId}: thanks emailed.`
          : action === 'nudge_idle'
            ? res.already
              ? `${accountId}: already nudged today.`
              : `${accountId}: idle nudge emailed.`
            : action === 'needs_docs'
              ? `${accountId}: marked needs docs${file ? ' · form sent' : ''}.`
              : action === 'approve'
                ? `${accountId}: approved · buyer notified (hub link).`
                : `${accountId}: ${action.replace(/_/g, ' ')}.`,
      )
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.')
    } finally {
      setBusy(null)
    }
  }

  async function onSendFormOnly(accountId: string) {
    const file = docFile[accountId]
    if (!file) {
      setError('Choose a file to send.')
      return
    }
    setBusy(accountId + 'senddoc')
    setError(null)
    setOk(null)
    try {
      await sendDoc(
        accountId,
        docTitle[accountId] || file.name,
        docCategory[accountId] || 'staff_form',
        file,
        note[accountId],
      )
      if (noticeBody[accountId]?.trim()) {
        await api.staffWholesaleAction(accountId, {
          action: 'send_notice',
          noticeTitle: 'New document from Equarios',
          noticeBody: noticeBody[accountId],
          noticeHref: '/account/documents',
        })
      }
      setDocFile((f) => ({ ...f, [accountId]: null }))
      setOk(`${accountId}: document sent to My Page → Documents.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed.')
    } finally {
      setBusy(null)
    }
  }

  async function onQuickSend(e: FormEvent) {
    e.preventDefault()
    if (!quickId.trim() || !quickFile) {
      setError('Account ID and file required.')
      return
    }
    setBusy('quick')
    setError(null)
    setOk(null)
    try {
      const id = quickId.trim().toUpperCase()
      await sendDoc(id, quickTitle, quickCategory, quickFile, quickNotice)
      if (quickNotice.trim()) {
        await api.staffWholesaleAction(id, {
          action: 'send_notice',
          noticeTitle: 'New document from Equarios',
          noticeBody: quickNotice,
          noticeHref: '/account/documents',
        }).catch(() => {
          /* account may have no wholesale app; document notify already fired server-side */
        })
      }
      setQuickFile(null)
      setOk(`${id}: document sent.`)
      await reload().catch(() => {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed.')
    } finally {
      setBusy(null)
    }
  }

  const inReview = rows.filter(
    (r) => r.wholesaleStatus === 'submitted' || r.wholesaleStatus === 'under_review',
  ).length
  const needsDocs = rows.filter((r) => r.wholesaleStatus === 'needs_docs').length
  const waiting = inReview + needsDocs

  return (
    <section className="mh-desk">
      <header className="mh-desk-head">
        <h2>Wholesale applications</h2>
        <p className="mh-desk-note">
          Review forms, request docs, send files to My Page → Documents, then approve desk access.
        </p>
        <p className="tiny wholesale-apps-queue" aria-live="polite">
          {waiting
            ? `${waiting} waiting · ${inReview} in review · ${needsDocs} needs docs`
            : 'No applications waiting on staff'}
          {stuck.length
            ? ` · ${stuck.length} approved idle (${idleDays}d, no bids)`
            : ''}
          {recovered.length
            ? ` · ${recovered.length} bid after nudge (48h)`
            : ''}
        </p>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {ok ? <p className="ok">{ok}</p> : null}

      {recovered.length ? (
        <div className="wholesale-stuck-panel wholesale-recovered-panel">
          <h3>Bid after nudge (48h)</h3>
          <p className="muted tiny">
            Idle nudge worked — send a short thanks / keep-going note (once per day).
          </p>
          <ul className="wholesale-stuck-list">
            {recovered.map((r) => (
              <li key={r.accountId}>
                <div>
                  <strong>
                    {r.accountId} · {r.company}
                  </strong>
                  <span className="muted tiny">
                    {r.email} · nudged {new Date(r.nudgedAt).toLocaleString()} · bid{' '}
                    {new Date(r.bidAt).toLocaleString()}
                    {r.thanked ? ' · thanked' : ''}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy != null || r.thanked}
                  onClick={() => void act(r.accountId, 'thanks_recover')}
                >
                  {r.thanked ? 'Thanked' : 'Thanks'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {stuck.length ? (
        <div className="wholesale-stuck-panel">
          <h3>Stuck approved — no bids in {idleDays}d</h3>
          <p className="muted tiny">
            One-click email (once per day). Skip buyers already nudged who still have not bid —
            or nudge again tomorrow.
          </p>
          <ul className="wholesale-stuck-list">
            {stuck.map((s) => (
              <li key={s.accountId}>
                <div>
                  <strong>
                    {s.accountId} · {s.company}
                  </strong>
                  <span className="muted tiny">
                    {s.email} · {stuckMeta(s)}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy != null}
                  title={
                    s.lastNudgeAt && !s.bidAfterNudge
                      ? 'Already nudged — no bid since'
                      : 'Send idle nudge email'
                  }
                  onClick={() => void act(s.accountId, 'nudge_idle')}
                >
                  {s.lastNudgeAt ? 'Nudge again' : 'Nudge'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form className="staff-quick-send" onSubmit={onQuickSend}>
        <h3>Send form / file to any account</h3>
        <label>
          Account ID
          <input
            value={quickId}
            onChange={(e) => setQuickId(e.target.value)}
            placeholder="DEMO-1001"
            className="mono"
          />
        </label>
        <label>
          Title
          <input value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} />
        </label>
        <label>
          Category
          <select value={quickCategory} onChange={(e) => setQuickCategory(e.target.value)}>
            <option value="staff_form">Staff form</option>
            <option value="tax">Tax</option>
            <option value="resale">Resale</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          File
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
            onChange={(e) => setQuickFile(e.target.files?.[0] || null)}
          />
        </label>
        <label className="staff-quick-send-span">
          Optional notice
          <input
            value={quickNotice}
            onChange={(e) => setQuickNotice(e.target.value)}
            placeholder="Please complete and re-upload…"
          />
        </label>
        <button className="btn btn-primary btn-sm" type="submit" disabled={busy != null}>
          Send to Documents
        </button>
      </form>

      {!rows.length ? (
        <p className="muted tiny">No submitted applications yet. Use the send form above for any account.</p>
      ) : (
        <ul className="wholesale-review-list">
          {rows.map((r) => (
            <li key={r.id}>
              <header>
                <strong>
                  {r.accountId} · {r.company}
                </strong>
                <span className="muted tiny">
                  {r.email} · {r.wholesaleStatus.replace(/_/g, ' ')}
                  {r.submittedAt ? ` · ${new Date(r.submittedAt).toLocaleString()}` : ''}
                </span>
              </header>
              <details>
                <summary>Application fields</summary>
                <pre className="tiny">{JSON.stringify(r.payload, null, 2)}</pre>
              </details>
              <label>
                Staff note
                <input
                  value={note[r.accountId] ?? r.staffNote}
                  onChange={(e) => setNote((n) => ({ ...n, [r.accountId]: e.target.value }))}
                />
              </label>
              <label>
                Notice to buyer
                <input
                  value={noticeBody[r.accountId] || ''}
                  onChange={(e) => setNoticeBody((n) => ({ ...n, [r.accountId]: e.target.value }))}
                  placeholder="Optional message…"
                />
              </label>

              <div className="staff-send-doc">
                <strong className="tiny">Send form / file</strong>
                <div className="staff-send-doc-grid">
                  <label>
                    Title
                    <input
                      value={docTitle[r.accountId] || ''}
                      onChange={(e) => setDocTitle((t) => ({ ...t, [r.accountId]: e.target.value }))}
                      placeholder="Resale certificate template"
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={docCategory[r.accountId] || 'staff_form'}
                      onChange={(e) => setDocCategory((c) => ({ ...c, [r.accountId]: e.target.value }))}
                    >
                      <option value="staff_form">Staff form</option>
                      <option value="tax">Tax</option>
                      <option value="resale">Resale</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    File
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                      onChange={(e) =>
                        setDocFile((f) => ({ ...f, [r.accountId]: e.target.files?.[0] || null }))
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy != null}
                  title="Approves desk access and emails the buyer with a hub link"
                  onClick={() => void act(r.accountId, 'approve')}
                >
                  Approve &amp; notify
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy != null}
                  title="Marks needs docs; attaches file if selected"
                  onClick={() => void act(r.accountId, 'needs_docs')}
                >
                  Needs docs{docFile[r.accountId] ? ' + file' : ''}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy != null || !docFile[r.accountId]}
                  onClick={() => void onSendFormOnly(r.accountId)}
                >
                  Send file only
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy != null}
                  onClick={() => void act(r.accountId, 'under_review')}
                >
                  Under review
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy != null}
                  onClick={() => void act(r.accountId, 'reject')}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy != null}
                  onClick={() => void act(r.accountId, 'note')}
                >
                  Save note
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy != null || !noticeBody[r.accountId]?.trim()}
                  onClick={() => void act(r.accountId, 'send_notice')}
                >
                  Send notice
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
