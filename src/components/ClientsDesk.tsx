import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'

type Client = {
  id: string
  email: string
  firstName: string
  lastName: string
  company: string
  phone: string
  tags: string[]
  status: string
  source: string
  lastSyncedAt: string | null
}

type Campaign = {
  id: string
  name: string
  subject: string
  previewText: string
  htmlBody: string
  audience: string
  status: string
  errorMessage: string
  stats: Record<string, unknown>
  recipientCount: number
  sentAt: string | null
  createdAt: string
  brevoCampaignId: string | null
}

type Status = {
  brevoConfigured: boolean
  total: number
  subscribed: number
  unsubscribed: number
  bounced: number
}

const SAMPLE_HTML = `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#122">
  <h1 style="font-size:22px;margin:0 0 12px">Equarios inventory update</h1>
  <p style="line-height:1.5;margin:0 0 12px">Hi {{ contact.FIRSTNAME }},</p>
  <p style="line-height:1.5;margin:0 0 12px">New wholesale lots just landed. Sign in to bid or buy.</p>
  <p style="margin:20px 0"><a href="https://equarios.com/auctions" style="background:#0b2b3a;color:#fff;padding:10px 16px;text-decoration:none">View auctions</a></p>
</div>`

export function ClientsDesk() {
  const [status, setStatus] = useState<Status | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [q, setQ] = useState('')
  const [csv, setCsv] = useState('email,firstName,lastName,company,tags\n')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [company, setCompany] = useState('')
  const [tags, setTags] = useState('')

  const [campName, setCampName] = useState('Client newsletter')
  const [campSubject, setCampSubject] = useState('')
  const [campPreview, setCampPreview] = useState('')
  const [campHtml, setCampHtml] = useState(SAMPLE_HTML)
  const [campAudience, setCampAudience] = useState('all_subscribed')
  const [selected, setSelected] = useState<Campaign | null>(null)

  async function reload() {
    const [st, cl, cp] = await Promise.all([
      api.marketingStatus(),
      api.marketingClients({ q, limit: 100 }),
      api.marketingCampaigns(),
    ])
    setStatus(st)
    setClients(cl.clients as Client[])
    setCampaigns(cp.campaigns as Campaign[])
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await reload()
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load clients desk.')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      await api.marketingUpsertClient({
        email,
        firstName,
        lastName,
        company,
        tags: tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean),
        consent: true,
      })
      setEmail('')
      setFirstName('')
      setLastName('')
      setCompany('')
      setTags('')
      setOk('Client saved.')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  async function onImport(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      const res = await api.marketingImportCsv(csv)
      setOk(`Import: ${res.created} created, ${res.updated} updated, ${res.skipped} skipped.`)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  async function onSync() {
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      const res = await api.marketingSyncBrevo()
      setOk(
        res.simulated
          ? `Simulated sync · ${res.synced} contacts (set BREVO_API_KEY for live Brevo).`
          : `Synced ${res.synced} contacts to Brevo list ${res.listId}.`,
      )
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.')
    } finally {
      setBusy(false)
    }
  }

  async function onCreateCampaign(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      const res = await api.marketingCreateCampaign({
        name: campName,
        subject: campSubject,
        previewText: campPreview,
        htmlBody: campHtml,
        audience: campAudience,
      })
      setSelected(res.campaign as Campaign)
      setOk(`Campaign draft created · ${(res.campaign as Campaign).recipientCount} recipients.`)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed.')
    } finally {
      setBusy(false)
    }
  }

  async function onSend(id: string) {
    if (!window.confirm('Send this campaign now via Brevo?')) return
    setBusy(true)
    setError(null)
    setOk(null)
    try {
      const res = await api.marketingSendCampaign(id)
      setSelected(res.campaign as Campaign)
      setOk(
        res.simulated
          ? 'Simulated send complete — add BREVO_API_KEY to deliver for real.'
          : 'Campaign sent via Brevo.',
      )
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed.')
    } finally {
      setBusy(false)
    }
  }

  async function onRefresh(id: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await api.marketingRefreshCampaign(id)
      setSelected(res.campaign as Campaign)
      setOk('Report refreshed from Brevo.')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed.')
    } finally {
      setBusy(false)
    }
  }

  const stats = selected?.stats || {}

  return (
    <div className="clients-desk">
      <section className="mh-desk">
        <header className="mh-desk-head">
          <h2>
            Clients
            <em>{status ? status.total : '…'}</em>
          </h2>
          <p className="mh-desk-note">
            Local list + Brevo sync — deliverability stays with the ESP; reports mirror here.
          </p>
          <div className="mh-desk-actions">
            {status ? (
              <div className="mh-desk-sum clients-kpi-sum">
                <strong>
                  {status.subscribed} sub · {status.unsubscribed} unsub · {status.bounced} bounce
                </strong>
                <span className={status.brevoConfigured ? 'ok tiny' : 'muted tiny'}>
                  Brevo: {status.brevoConfigured ? 'connected' : 'simulated'}
                </span>
              </div>
            ) : null}
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void onSync()}>
              Sync → Brevo
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() => void reload().then(() => setOk('Refreshed.'))}
            >
              Refresh
            </button>
          </div>
        </header>

        {error ? <p className="error tiny">{error}</p> : null}
        {ok ? <p className="ok tiny">{ok}</p> : null}

        <header className="mh-desk-head is-sub">
          <h2>Add client</h2>
          <p className="mh-desk-note">Save one contact, or import CSV below.</p>
        </header>
        <form className="admin-form" onSubmit={onAdd}>
          <label>
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            First name
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </label>
          <label>
            Last name
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>
          <label>
            Company
            <input value={company} onChange={(e) => setCompany(e.target.value)} />
          </label>
          <label>
            Tags
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="wholesale, hk" />
          </label>
          <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
            Save client
          </button>
        </form>

        <header className="mh-desk-head is-sub">
          <h2>Import CSV</h2>
          <p className="mh-desk-note">Header: email,firstName,lastName,company,phone,tags,status</p>
        </header>
        <form className="clients-import" onSubmit={onImport}>
          <textarea rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} className="clients-csv" />
          <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
            Import CSV
          </button>
        </form>

        <header className="mh-desk-head is-sub">
          <h2>
            Client list
            <em>{clients.length}</em>
          </h2>
          <p className="mh-desk-note">Search email, name, or company.</p>
          <div className="mh-desk-actions">
            <form
              className="clients-search"
              onSubmit={(e) => {
                e.preventDefault()
                void reload()
              }}
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search email, name, company"
                aria-label="Search clients"
              />
              <button className="btn btn-ghost btn-sm" type="submit">
                Search
              </button>
            </form>
          </div>
        </header>

        {!clients.length ? (
          <div className="mh-empty">
            <p>No clients yet — add one or import CSV.</p>
          </div>
        ) : (
          <div className="mh-table-wrap desk-list-scroll">
            <table className="gbs-table mh-table clients-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Tags</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((cl) => (
                  <tr key={cl.id}>
                    <td className="tiny">{cl.email}</td>
                    <td className="tiny">
                      {cl.firstName} {cl.lastName}
                    </td>
                    <td className="tiny">{cl.company || '—'}</td>
                    <td className="tiny">{cl.tags.join(', ') || '—'}</td>
                    <td className="tiny">{cl.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mh-desk">
        <header className="mh-desk-head">
          <h2>
            Campaigns
            <em>{campaigns.length}</em>
          </h2>
          <p className="mh-desk-note">Draft, send, and mirror Brevo reports.</p>
        </header>

        <header className="mh-desk-head is-sub">
          <h2>New campaign</h2>
          <p className="mh-desk-note">Save a draft, then send from the list below.</p>
        </header>
        <form className="admin-form" onSubmit={onCreateCampaign}>
          <label>
            Internal name
            <input value={campName} onChange={(e) => setCampName(e.target.value)} required />
          </label>
          <label>
            Subject
            <input value={campSubject} onChange={(e) => setCampSubject(e.target.value)} required />
          </label>
          <label>
            Preview text
            <input value={campPreview} onChange={(e) => setCampPreview(e.target.value)} />
          </label>
          <label>
            Audience
            <select value={campAudience} onChange={(e) => setCampAudience(e.target.value)}>
              <option value="all_subscribed">All subscribed</option>
              <option value="tag:wholesale">Tag: wholesale</option>
              <option value="tag:retail">Tag: retail</option>
            </select>
          </label>
          <label className="admin-span">
            HTML body
            <textarea rows={8} value={campHtml} onChange={(e) => setCampHtml(e.target.value)} required />
          </label>
          <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
            Save draft
          </button>
        </form>

        <header className="mh-desk-head is-sub">
          <h2>Campaigns &amp; reports</h2>
          <p className="mh-desk-note">Send drafts or refresh stats from Brevo.</p>
        </header>

        {!campaigns.length ? (
          <div className="mh-empty">
            <p>No campaigns yet.</p>
          </div>
        ) : (
          <ul className="campaign-list">
            {campaigns.map((camp) => (
              <li key={camp.id}>
                <header>
                  <strong>{camp.name}</strong>
                  <span className="muted tiny">
                    {camp.status} · {camp.recipientCount} recipients
                    {camp.sentAt ? ` · sent ${new Date(camp.sentAt).toLocaleString()}` : ''}
                  </span>
                </header>
                <p className="tiny">{camp.subject}</p>
                {camp.errorMessage ? <p className="error tiny">{camp.errorMessage}</p> : null}
                <div className="row-actions">
                  {(camp.status === 'draft' || camp.status === 'failed') && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => void onSend(camp.id)}
                    >
                      Send now
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => {
                      setSelected(camp)
                      if (camp.brevoCampaignId) void onRefresh(camp.id)
                    }}
                  >
                    View report
                  </button>
                  {camp.brevoCampaignId ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => void onRefresh(camp.id)}
                    >
                      Refresh from Brevo
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {selected ? (
          <div className="campaign-report">
            <h3>Report · {selected.name}</h3>
            <div className="clients-kpis">
              <span>
                <strong>{Number(stats.sent ?? selected.recipientCount) || 0}</strong> sent
              </span>
              <span>
                <strong>{Number(stats.delivered ?? 0)}</strong> delivered
              </span>
              <span>
                <strong>{Number(stats.uniqueOpens ?? 0)}</strong> opens
              </span>
              <span>
                <strong>{Number(stats.uniqueClicks ?? 0)}</strong> clicks
              </span>
              <span>
                <strong>{Number(stats.hardBounces ?? 0)}</strong> hard bounces
              </span>
              <span>
                <strong>{Number(stats.unsubscriptions ?? 0)}</strong> unsubs
              </span>
              <span>
                <strong>{Number(stats.complaints ?? 0)}</strong> spam complaints
              </span>
            </div>
            {stats.note ? <p className="muted tiny">{String(stats.note)}</p> : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}
