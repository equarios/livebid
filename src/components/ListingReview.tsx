import { useMemo, useState } from 'react'
import { lotItemSub, lotItemTitle } from '../lib/itemLine'
import {
  groupDropItems,
  previewDropClocks,
  type DropClockOverrides,
  type DropListClockPlan,
} from '../lib/listingDrops'
import { formatDateTime, usd } from '../lib/format'
import { toastMsg } from '../lib/toast'
import { useNow, useStore } from '../store'
import type { ListingDrop } from '../types'
import { NumberField } from './NumberField'

function patchOverride(
  prev: DropClockOverrides,
  listKey: string,
  patch: DropClockOverrides[string],
): DropClockOverrides {
  return { ...prev, [listKey]: { ...prev[listKey], ...patch } }
}

export function ListingReview() {
  const {
    listingDrops,
    settings,
    reviewListingDrop,
    patchListingDropItem,
  } = useStore()
  const now = useNow()
  const pending = listingDrops.filter((d) => d.status === 'pending')
  const [preview, setPreview] = useState<ListingDrop | null>(null)
  const [clockOverrides, setClockOverrides] = useState<DropClockOverrides>({})
  const [msg, setMsgState] = useState<string | null>(null)
  function setMsg(next: string | null) {
    setMsgState(next)
    toastMsg(next)
  }
  const [openId, setOpenId] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)

  const liveTypes = useMemo(
    () => settings.auctionTypes.filter((t) => t.value),
    [settings.auctionTypes],
  )

  const previewDrop =
    preview && (listingDrops.find((d) => d.id === preview.id && d.status === 'pending') || preview)

  const launchPlans: DropListClockPlan[] = useMemo(() => {
    if (!previewDrop) return []
    return previewDropClocks(settings, previewDrop.items, now, clockOverrides)
  }, [previewDrop, settings, now, clockOverrides])

  if (!pending.length && !previewDrop) {
    return (
      <section className="card admin-section">
        <h2>Confirm listings</h2>
        <p className="muted tiny">
          Nothing waiting. Admin sends batches from Inventory; edit lot details here, then open Launch
          Preview to set one clock per list and go live.
        </p>
      </section>
    )
  }

  if (previewDrop) {
    const groups = groupDropItems(previewDrop.items, settings)
    return (
      <section className="card admin-section launch-preview">
        <header className="launch-preview-head">
          <h2>Launch Preview · {previewDrop.id}</h2>
          <p className="muted tiny">
            One clock per list. Check how lots and times will look together, then Launch.
          </p>
        </header>

        <div className="launch-preview-clocks">
          {launchPlans.map((plan) => (
            <div key={plan.listKey} className="launch-clock-card">
              <div className="launch-clock-card-top">
                <strong>
                  {plan.label} <em>{plan.count}</em>
                </strong>
                {plan.mode === 'marketplace' ? (
                  <p className="muted tiny">Marketplace — no auction clock.</p>
                ) : (
                  <p className="muted tiny">
                    Live ends {formatDateTime(plan.liveEndsAt)}
                    {plan.extraSealedEndsAt
                      ? ` · Extra sealed ends ${formatDateTime(plan.extraSealedEndsAt)}`
                      : ' · No Extra sealed'}
                  </p>
                )}
              </div>
              {plan.mode === 'marketplace' ? null : (
                <div className="listing-draft-clocks">
                  {plan.canJoin ? (
                    <label>
                      Clock
                      <select
                        value={plan.mode}
                        onChange={(e) =>
                          setClockOverrides((prev) =>
                            patchOverride(prev, plan.listKey, {
                              mode: e.target.value === 'join' ? 'join' : 'new',
                            }),
                          )
                        }
                      >
                        <option value="join">Join current close</option>
                        <option value="new">Start new clock</option>
                      </select>
                    </label>
                  ) : (
                    <span className="muted tiny">List closed — starting a new clock.</span>
                  )}
                  {plan.mode === 'new' ? (
                    <label>
                      Live (min)
                      <NumberField
                        min={1}
                        value={plan.durationMins}
                        onCommit={(mins) =>
                          setClockOverrides((prev) =>
                            patchOverride(prev, plan.listKey, {
                              mode: 'new',
                              durationMins: mins,
                            }),
                          )
                        }
                      />
                    </label>
                  ) : null}
                  <label>
                    Extra sealed (min)
                    <NumberField
                      min={0}
                      value={plan.extraMins}
                      onCommit={(mins) =>
                        setClockOverrides((prev) =>
                          patchOverride(prev, plan.listKey, { extraSealedMinutes: mins }),
                        )
                      }
                    />
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mh-table-wrap launch-preview-table-wrap">
          <table className="gbs-table mh-table">
            <thead>
              <tr>
                <th>Lot</th>
                <th>List</th>
                <th>Device</th>
                <th className="num">Qty</th>
                <th className="num">Start</th>
                <th>Live ends</th>
                <th>Extra sealed</th>
              </tr>
            </thead>
            <tbody>
              {groups.flatMap((g) => {
                const plan = launchPlans.find((p) => p.listKey === g.key)
                return g.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.id}</strong>
                    </td>
                    <td>{g.label}</td>
                    <td>
                      {lotItemTitle(item)}
                      <p className="muted tiny item-specs">{lotItemSub(item)} · Grade {item.grade}</p>
                    </td>
                    <td className="num">{item.qty}</td>
                    <td className="num">{usd(item.startPrice)}</td>
                    <td>
                      {plan?.mode === 'marketplace'
                        ? '—'
                        : plan
                          ? formatDateTime(plan.liveEndsAt)
                          : '—'}
                    </td>
                    <td>
                      {plan?.extraSealedEndsAt ? formatDateTime(plan.extraSealedEndsAt) : '—'}
                    </td>
                  </tr>
                ))
              })}
            </tbody>
          </table>
        </div>

        <div className="listing-draft-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={launching}
            onClick={() => {
              setPreview(null)
              setClockOverrides({})
            }}
          >
            Back to draft
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={launching}
            onClick={() => {
              const drop = previewDrop
              setPreview(null)
              setClockOverrides({})
              void reviewListingDrop(drop.id, 'declined').then((err) => {
                setMsg(err || `Declined ${drop.id}. Nothing went live.`)
              })
            }}
          >
            Decline
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={launching}
            onClick={() => {
              const drop = previewDrop
              const plans = launchPlans
              setLaunching(true)
              void reviewListingDrop(drop.id, 'approved', plans).then((err) => {
                setLaunching(false)
                if (err) {
                  setMsg(err)
                  return
                }
                setPreview(null)
                setClockOverrides({})
                setMsg(`Launched ${drop.items.length} items.`)
              })
            }}
          >
            {launching ? 'Launching…' : 'Launch'}
          </button>
        </div>
        {msg ? <p className="ok">{msg}</p> : null}
      </section>
    )
  }

  return (
    <section className="card admin-section">
      <h2>Confirm listings ({pending.length})</h2>
      <p className="muted tiny">
        Draft only — not on Live Auctions yet. Edit item details, then open Launch Preview for one clock
        per list and a final look before going live.
      </p>
      {pending.map((drop) => {
        const groups = groupDropItems(drop.items, settings)
        const expanded = openId === drop.id || pending.length === 1
        const plans = previewDropClocks(settings, drop.items, now)
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
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setOpenId(expanded && pending.length > 1 ? null : drop.id)}
              >
                {expanded ? 'Collapse' : 'Edit draft'}
              </button>
            </div>

            {groups.map((g) => {
              const plan = plans.find((p) => p.listKey === g.key)
              return (
                <div key={g.key} className="listing-drop-group">
                  <div className="staff-type-picks">
                    <span className="auction-close-count">
                      {g.label} <strong>{g.items.length}</strong>
                      <em className="muted tiny">
                        {' '}
                        {plan?.mode === 'marketplace'
                          ? 'No auction clock'
                          : plan?.mode === 'join'
                            ? `Will join close ${formatDateTime(plan.liveEndsAt)}`
                            : plan
                              ? `Will start clock ending ${formatDateTime(plan.liveEndsAt)}`
                              : ''}
                        {plan?.extraSealedEndsAt
                          ? ` · Extra sealed → ${formatDateTime(plan.extraSealedEndsAt)}`
                          : ''}
                      </em>
                    </span>
                  </div>

                  <div className="listing-drop-lots">
                    {g.items.map((item) =>
                      expanded ? (
                        <div key={item.id} className="listing-drop-lot is-edit">
                          <div className="listing-draft-fields">
                            <label>
                              Lot ID
                              <input value={item.id} disabled />
                            </label>
                            <label>
                              List
                              <select
                                value={
                                  item.channel === 'marketplace'
                                    ? 'marketplace'
                                    : item.auctionType || 'live'
                                }
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (v === 'marketplace') {
                                    patchListingDropItem(drop.id, item.id, {
                                      channel: 'marketplace',
                                      auctionType: undefined,
                                    })
                                  } else {
                                    patchListingDropItem(drop.id, item.id, {
                                      channel: 'auction',
                                      auctionType: v,
                                    })
                                  }
                                }}
                              >
                                {liveTypes.map((t) => (
                                  <option key={t.value} value={t.value}>
                                    {t.label}
                                  </option>
                                ))}
                                <option value="marketplace">{settings.marketplaceLabel}</option>
                              </select>
                            </label>
                            <label>
                              Maker
                              <input
                                value={item.manufacturer}
                                onChange={(e) =>
                                  patchListingDropItem(drop.id, item.id, {
                                    manufacturer: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              Model
                              <input
                                value={item.model}
                                onChange={(e) =>
                                  patchListingDropItem(drop.id, item.id, { model: e.target.value })
                                }
                              />
                            </label>
                            <label>
                              Model #
                              <input
                                value={item.modelNumber}
                                onChange={(e) =>
                                  patchListingDropItem(drop.id, item.id, {
                                    modelNumber: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              Capacity
                              <input
                                value={item.capacity}
                                onChange={(e) =>
                                  patchListingDropItem(drop.id, item.id, {
                                    capacity: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              Color
                              <input
                                value={item.color}
                                onChange={(e) =>
                                  patchListingDropItem(drop.id, item.id, { color: e.target.value })
                                }
                              />
                            </label>
                            <label>
                              Grade
                              <input
                                value={item.grade}
                                onChange={(e) =>
                                  patchListingDropItem(drop.id, item.id, { grade: e.target.value })
                                }
                              />
                            </label>
                            <label>
                              Origin
                              <input
                                value={item.origin || ''}
                                onChange={(e) =>
                                  patchListingDropItem(drop.id, item.id, {
                                    origin: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              Battery %
                              <NumberField
                                min={0}
                                max={100}
                                value={item.battery}
                                onCommit={(battery) =>
                                  patchListingDropItem(drop.id, item.id, { battery })
                                }
                              />
                            </label>
                            <label>
                              Qty
                              <NumberField
                                min={1}
                                value={item.qty}
                                onCommit={(qty) => patchListingDropItem(drop.id, item.id, { qty })}
                              />
                            </label>
                            <label>
                              MOQ
                              <NumberField
                                min={0}
                                value={item.moq ?? 0}
                                onCommit={(n) =>
                                  patchListingDropItem(drop.id, item.id, {
                                    moq: n > 1 ? n : undefined,
                                  })
                                }
                              />
                            </label>
                            <label>
                              Start $
                              <NumberField
                                min={0}
                                step={0.01}
                                value={item.startPrice}
                                onCommit={(n) =>
                                  patchListingDropItem(drop.id, item.id, {
                                    startPrice: n,
                                    currentPrice: Math.max(n, item.currentPrice),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Current $
                              <NumberField
                                min={0}
                                step={0.01}
                                value={item.currentPrice}
                                onCommit={(n) =>
                                  patchListingDropItem(drop.id, item.id, {
                                    currentPrice: n,
                                    startPrice: Math.min(item.startPrice, n) || n,
                                  })
                                }
                              />
                            </label>
                          </div>
                          <label className="listing-draft-desc">
                            Description
                            <textarea
                              rows={2}
                              value={item.description || ''}
                              onChange={(e) =>
                                patchListingDropItem(drop.id, item.id, {
                                  description: e.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                      ) : (
                        <div key={item.id} className="listing-drop-lot">
                          <strong>{lotItemTitle(item)}</strong>
                          <p className="muted tiny item-specs">
                            {item.id} · {g.label} · {lotItemSub(item)} · Grade {item.grade} · {item.qty} pcs · {usd(item.currentPrice)}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )
            })}

            <div className="listing-draft-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  void reviewListingDrop(drop.id, 'declined').then((err) => {
                    setMsg(err || `Declined ${drop.id}. Nothing went live.`)
                  })
                }}
              >
                Decline
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  // Refresh preview from latest drop state
                  const fresh = listingDrops.find((d) => d.id === drop.id) || drop
                  setClockOverrides({})
                  setPreview(fresh)
                  setMsg(null)
                }}
              >
                Launch Preview
              </button>
            </div>
          </div>
        )
      })}
      {msg ? <p className="ok">{msg}</p> : null}
    </section>
  )
}
