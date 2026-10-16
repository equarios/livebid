import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type ProductEnquiryDto } from '../lib/api'
import { gbsDate } from '../lib/format'
import { toastMsg } from '../lib/toast'

/** Staff inbox for product questions from store / auction / marketplace. */
export function ProductEnquiryDesk() {
  const [rows, setRows] = useState<ProductEnquiryDto[]>([])
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open')
  const [busy, setBusy] = useState(false)
  const [msg, setMsgState] = useState<string | null>(null)
  function setMsg(next: string | null) {
    setMsgState(next)
    toastMsg(next)
  }

  const refresh = useCallback(async () => {
    const res = await api.productEnquiries(filter === 'all' ? undefined : filter)
    setRows(res.enquiries)
  }, [filter])

  useEffect(() => {
    void refresh().catch((e) =>
      setMsg(e instanceof Error ? e.message : 'Could not load enquiries.'),
    )
  }, [refresh])

  async function markDone(id: string) {
    setBusy(true)
    setMsg(null)
    try {
      await api.updateProductEnquiry(id, { status: 'done' })
      setMsg(`${id} marked done`)
      await refresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mh-desk">
      <header className="mh-desk-head">
        <h2>
          Product questions
          <em>{rows.length}</em>
        </h2>
        <p className="mh-desk-note">
          Buyers asking about a store item, auction lot, or marketplace listing.
        </p>
        <div className="mh-desk-actions">
          {(['open', 'done', 'all'] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={`btn btn-ghost btn-sm ${filter === id ? 'on' : ''}`}
              onClick={() => setFilter(id)}
            >
              {id === 'open' ? 'Open' : id === 'done' ? 'Done' : 'All'}
            </button>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </header>
      {msg ? <p className="tiny imei-msg">{msg}</p> : null}
      {!rows.length ? (
        <p className="muted tiny">No questions in this view.</p>
      ) : (
        <div className="store-orders-list">
          {rows.map((row) => (
            <article
              key={row.id}
              className={`store-order-card ${row.status === 'open' ? 'is-open' : ''}`}
            >
              <div className="store-order-summary" style={{ cursor: 'default' }}>
                <span className="mono store-order-id">{row.id}</span>
                <span className="store-order-badge">{row.channel}</span>
                <span className="muted tiny">{gbsDate(row.createdAt)}</span>
                <strong className="store-order-total">{row.status}</strong>
              </div>
              <div className="store-order-detail">
                <p>
                  <strong>{row.itemTitle}</strong>{' '}
                  <span className="mono muted tiny">{row.itemId}</span>
                </p>
                <p className="tiny muted">
                  {row.name} · {row.email}
                  {row.accountId ? ` · ${row.accountId}` : ''}
                </p>
                <p className="tiny" style={{ whiteSpace: 'pre-wrap' }}>
                  {row.message}
                </p>
                <div className="imei-row-actions">
                  {row.itemHref ? (
                    <Link className="btn btn-ghost btn-sm" to={row.itemHref}>
                      Open item
                    </Link>
                  ) : null}
                  <a className="btn btn-ghost btn-sm" href={`mailto:${row.email}`}>
                    Reply
                  </a>
                  {row.status === 'open' ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => void markDone(row.id)}
                    >
                      Mark done
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
