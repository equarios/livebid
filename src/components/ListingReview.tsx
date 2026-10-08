import { useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { dropClockHint, groupDropItems } from '../lib/listingDrops'
import { formatDateTime, specLocks, usd } from '../lib/format'
import { useNow, useStore } from '../store'
import type { ListingDrop } from '../types'

export function ListingReview() {
  const { listingDrops, settings, reviewListingDrop } = useStore()
  const now = useNow()
  const pending = listingDrops.filter((d) => d.status === 'pending')
  const [confirm, setConfirm] = useState<ListingDrop | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  if (!pending.length) {
    return (
      <section className="card admin-section">
        <h2>Confirm listings</h2>
        <p className="muted tiny">Nothing waiting. Admin sends batches from Inventory; they go live only after you confirm here.</p>
      </section>
    )
  }

  return (
    <section className="card admin-section">
      <h2>Confirm listings ({pending.length})</h2>
      <p className="muted tiny">
        These items are not live. Confirm publishes each list together. Open auctions keep their current
        close; closed lists start a new clock from the hours Admin sent.
      </p>
      {pending.map((drop) => {
        const groups = groupDropItems(drop.items, settings)
        return (
          <div key={drop.id} className="listing-drop">
            <div className="listing-draft-bar">
              <h3>
                {drop.id}
                <em>{drop.items.length}</em>
              </h3>
              <p className="muted tiny">
                {drop.submittedBy} · {formatDateTime(drop.submittedAt)}
              </p>
            </div>
            <div className="staff-type-picks">
              {groups.map((g) => (
                <span key={g.key} className="auction-close-count">
                  {g.label} <strong>{g.items.length}</strong>
                  <em className="muted tiny">
                    {' '}
                    {dropClockHint(settings, g.key, g.items[0]?.durationMins || 1, now)}
                  </em>
                </span>
              ))}
            </div>
            <div className="listing-drop-lots">
              {groups.flatMap((g) =>
                g.items.map((item) => (
                  <div key={item.id} className="listing-drop-lot">
                    <strong>
                      {item.manufacturer} {item.model}
                      {item.modelNumber ? ` ${item.modelNumber}` : ''} {item.capacity}
                    </strong>
                    <p className="muted tiny item-specs">
                      {item.id} · {g.label} · {item.color} · Grade {item.grade} · {item.origin || 'INT'} · {item.battery}% ·{' '}
                      {specLocks(item)}
                      {item.operator ? ` · ${item.operator}` : ''} · {item.moq && item.moq > 1 ? `MOQ ${item.moq}` : 'No MOQ'} ·{' '}
                      {item.qty} pcs · {usd(item.currentPrice)}
                    </p>
                    {item.description ? <p className="muted tiny">{item.description}</p> : null}
                  </div>
                )),
              )}
            </div>
            <div className="listing-draft-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  const err = reviewListingDrop(drop.id, 'declined')
                  setMsg(err || `Declined ${drop.id}. Nothing went live.`)
                }}
              >
                Decline
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setConfirm(drop)}>
                Confirm &amp; publish
              </button>
            </div>
          </div>
        )
      })}
      {msg ? <p className="ok">{msg}</p> : null}
      {confirm ? (
        <ConfirmDialog
          title="Publish this catalog?"
          body={`${confirm.items.length} item${confirm.items.length === 1 ? ' goes' : 's go'} live together. Open lists keep their close time; closed lists start a new clock.`}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const err = reviewListingDrop(confirm.id, 'approved')
            setMsg(err || `Published ${confirm.items.length} items.`)
            setConfirm(null)
          }}
        >
          <ul className="listing-drop-summary">
            {groupDropItems(confirm.items, settings).map((g) => (
              <li key={g.key}>
                {g.label}: {g.items.length} · {dropClockHint(settings, g.key, g.items[0]?.durationMins || 1, now)}
              </li>
            ))}
          </ul>
        </ConfirmDialog>
      ) : null}
    </section>
  )
}
