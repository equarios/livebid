import { useState, type FormEvent } from 'react'
import { InventoryDesk } from '../components/InventoryDesk'
import { ItemLink } from '../components/ItemLink'
import { InvoiceDesk } from '../components/InvoiceDesk'
import { OfferDesk } from '../components/OfferDesk'
import { TimeLeft } from '../components/TimeLeft'
import { ORIGINS, typePillClass } from '../lib/auctionLists'
import { listingLabel, listingMinutes } from '../lib/duration'
import { lotTypeLabel, usd } from '../lib/format'
import { useNow, useStore } from '../store'
import type { AuctionType, Channel, Grade, Lot } from '../types'

type ListingDraft = {
  key: string
  id: string
  channel: Channel
  auctionType: AuctionType
  manufacturer: string
  model: string
  modelNumber: string
  capacity: string
  color: string
  grade: Grade
  battery: string
  qty: string
  moq: string
  price: string
  hours: string
  minutes: string
  origin: string
  operator: string
  simLocked: string
  actLocked: string
  description: string
  skuId: string
  skuQuery: string
  openSpecs: boolean
  openPick: boolean
}

function draftSpecLine(draft: ListingDraft) {
  const sim = draft.simLocked === '1' ? 'SIM locked' : 'SIM unlocked'
  const act = draft.actLocked === '1' ? 'Act locked' : 'Act open'
  const moqN = Number(draft.moq)
  const moq = draft.moq.trim() && Number.isInteger(moqN) && moqN > 1 ? `MOQ ${moqN}` : 'No MOQ'
  return `${draft.color || 'Color'} · Grade ${draft.grade} · ${draft.origin || 'INT'} · ${draft.battery || '—'}% · ${sim} · ${act}${draft.operator.trim() ? ` · ${draft.operator.trim()}` : ''} · ${moq}`
}

function newLotId() {
  return `LB-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 90 + 10)}`
}

function blankDraft(
  settings: { grades: Grade[]; defaultMoq: number; auctionTypes: Array<{ value: string }> },
  seed?: Partial<ListingDraft>,
): ListingDraft {
  return {
    key: seed?.key || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    id: seed?.id || newLotId(),
    channel: seed?.channel || 'auction',
    auctionType: seed?.auctionType || settings.auctionTypes[0]?.value || 'live',
    manufacturer: seed?.manufacturer || 'Apple',
    model: seed?.model || '',
    modelNumber: seed?.modelNumber || '',
    capacity: seed?.capacity || '128GB',
    color: seed?.color || 'Black',
    grade: seed?.grade || settings.grades[0] || 'A',
    battery: seed?.battery || '90',
    qty: seed?.qty || '1',
    moq: seed?.moq ?? (settings.defaultMoq > 1 ? String(settings.defaultMoq) : ''),
    price: seed?.price || '100',
    hours: seed?.hours || '4',
    minutes: seed?.minutes || '0',
    origin: seed?.origin || 'INT',
    operator: seed?.operator || '',
    simLocked: seed?.simLocked || '0',
    actLocked: seed?.actLocked || '0',
    description: seed?.description || '',
    skuId: seed?.skuId || '',
    skuQuery: seed?.skuQuery || '',
    openSpecs: seed?.openSpecs ?? false,
    openPick: seed?.openPick ?? false,
  }
}

export function Admin() {
  const {
    lots,
    bids,
    invoices,
    offers,
    settings,
    listingDrops,
    inventory,
    updateLot,
    removeLot,
    extendLot,
    extendAuctionType,
    reopenAuctions,
  } = useStore()
  const now = useNow()
  const live = lots.filter((l) => l.channel === 'auction' && l.endsAt > now)
  const unpaid = invoices.filter((i) => i.status !== 'paid')
  const pendingOffers = (offers || []).filter((o) => o.status === 'pending')
  const waitingSuper = (listingDrops || []).filter((d) => d.status === 'pending')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<ListingDraft[]>(() => [blankDraft(settings)])
  const [msg, setMsg] = useState<string | null>(null)
  const [tab, setTab] = useState<'work' | 'lots' | 'inventory' | 'bids'>('inventory')

  function patchDraft(key: string, patch: Partial<ListingDraft>) {
    setDrafts((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function loadLot(lot: Lot) {
    const left = Math.max(1, Math.round((lot.endsAt - Date.now()) / 60000))
    setEditingId(lot.id)
    setDrafts([
      blankDraft(settings, {
        key: 'edit',
        id: lot.id,
        channel: lot.channel,
        auctionType: lot.auctionType || 'live',
        manufacturer: lot.manufacturer,
        model: lot.model,
        modelNumber: lot.modelNumber,
        capacity: lot.capacity,
        color: lot.color,
        grade: lot.grade,
        battery: String(lot.battery),
        qty: String(lot.qty),
        moq: lot.moq && lot.moq > 1 ? String(lot.moq) : '',
        price: String(lot.buyNowPrice ?? lot.currentPrice),
        hours: String(Math.floor(left / 60)),
        minutes: String(left % 60),
        origin: lot.origin || 'INT',
        operator: lot.operator || '',
        simLocked: lot.simLocked ? '1' : '0',
        actLocked: lot.activationLocked ? '1' : '0',
        description: lot.description,
        skuQuery: `${lot.manufacturer} ${lot.model} ${lot.modelNumber} ${lot.capacity}`.trim(),
        openSpecs: true,
      }),
    ])
    setMsg(`Editing ${lot.id}`)
    setTab('lots')
  }

  function buildLot(draft: ListingDraft, existing?: Lot): Lot | string {
    const q = Number(draft.qty)
    const p = Number(draft.price)
    const b = Number(draft.battery)
    const h = Number(draft.hours)
    const min = Number(draft.minutes)
    const totalMins = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(min) ? min : 0)
    if (!draft.model.trim() || !Number.isInteger(q) || q < 1 || !Number.isFinite(p) || p < 1) {
      return 'Fill model, qty, and a valid price on every item you want to publish.'
    }
    if (draft.channel === 'marketplace' && !existing && (!Number.isFinite(totalMins) || totalMins < 1)) {
      return 'Listing duration must be at least 1 minute.'
    }
    const m = draft.moq.trim() === '' ? undefined : Number(draft.moq)
    if (m != null && (!Number.isInteger(m) || m < 1 || m > q)) {
      return 'MOQ must be empty (no MOQ) or a whole number between 1 and total pcs.'
    }
    return {
      id: (editingId || draft.id).trim() || newLotId(),
      channel: draft.channel,
      auctionType: draft.channel === 'auction' ? draft.auctionType : undefined,
      manufacturer: draft.manufacturer,
      model: draft.model.trim(),
      modelNumber: draft.modelNumber.trim(),
      capacity: draft.capacity,
      color: draft.color,
      grade: draft.grade,
      battery: Number.isFinite(b) ? b : 90,
      qty: q,
      moq: m && m > 1 ? m : undefined,
      startPrice: existing?.startPrice ?? p,
      currentPrice: p,
      buyNowPrice: draft.channel === 'marketplace' ? p : undefined,
      bidCount: existing?.bidCount ?? 0,
      endsAt:
        draft.channel === 'marketplace'
          ? existing?.endsAt || Date.now() + 365 * 24 * 60 * 60 * 1000
          : existing?.endsAt || Date.now() + Math.max(1, totalMins) * 60 * 1000,
      description: draft.description.trim() || existing?.description || 'Added from admin.',
      accent: existing?.accent ?? '#1d3348',
      origin: draft.origin,
      operator: draft.operator.trim() || existing?.operator,
      simLocked: draft.simLocked === '1',
      activationLocked: draft.actLocked === '1',
    }
  }

  function onSaveLot(e: FormEvent) {
    e.preventDefault()
    if (editingId) {
      const existing = lots.find((l) => l.id === editingId)
      const lot = buildLot(drafts[0], existing)
      if (typeof lot === 'string') {
        setMsg(lot)
        return
      }
      updateLot(lot)
      setMsg(`Saved ${lot.id}`)
      setEditingId(null)
      setDrafts([blankDraft(settings)])
      return
    }
    setMsg('New listings go out from Inventory. This tab only edits lots that are already live.')
  }

  return (
    <div className="staff-page">
      <div className="auction-desk">
        <div className="auction-desk-head">
          <div>
            <strong>Admin</strong>
            <p className="muted tiny auction-desk-recap">
              Operations desk: inventory, live lots, offers, and admin payment stamp. Super confirms catalogs,
              payments, accounts, and site settings.
            </p>
          </div>
          {tab === 'lots' ? (
            <div className="auction-desk-head-actions">
              {settings.auctionTypes.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className="btn btn-ghost"
                  title={`Reopen only ${t.label}`}
                  onClick={() => reopenAuctions(t.value)}
                >
                  Reopen {t.label.replace(/ Auctions$/i, '')} ({listingLabel(listingMinutes(settings, 'reopen'))})
                </button>
              ))}
              <button type="button" className="btn btn-primary" onClick={() => reopenAuctions()}>
                Reopen all
              </button>
            </div>
          ) : null}
        </div>
        <div className="super-tabs staff-tabs">
          {(
            [
              ['inventory', `Inventory (${inventory.length}${waitingSuper.length ? ` · ${waitingSuper.reduce((n, d) => n + d.items.length, 0)} wait` : ''})`],
              ['lots', `Lots (${live.length} live)`],
              ['work', `Work${pendingOffers.length + unpaid.length ? ` (${pendingOffers.length + unpaid.length})` : ''}`],
              ['bids', `Bids (${bids.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn btn-ghost ${tab === id ? 'on' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'work' ? (
        <>
      <section className="card admin-section">
        <h2>Marketplace offers</h2>
        <p className="muted tiny">Accept a buyer’s price. They confirm, then an invoice is created at the offered rate.</p>
        <OfferDesk staff />
      </section>

      <section className="card admin-section">
        <h2>Invoice issue &amp; payment confirmations</h2>
        <InvoiceDesk canAdmin />
      </section>
        </>
      ) : null}

      {tab === 'inventory' ? <InventoryDesk /> : null}

      {tab === 'lots' ? (
        <>
      {editingId ? (
      <section className="card admin-section">
        <div className="listing-draft-bar">
          <h2>Edit listing {editingId}</h2>
        </div>
        <form onSubmit={onSaveLot}>
          {drafts.map((draft) => {
            return (
            <div key={draft.key} className="listing-item">
              <div className="listing-item-head">
                <div>
                  <p className="item-name listing-item-name">
                    {`${draft.manufacturer} ${draft.model}${draft.modelNumber ? ` ${draft.modelNumber}` : ''} ${draft.capacity}`}
                  </p>
                  <p className="muted tiny item-specs">{draftSpecLine(draft)}</p>
                </div>
              </div>
              <div className="listing-item-grid">
                <label>
                  List
                  <select
                    value={draft.channel === 'marketplace' ? 'marketplace' : draft.auctionType}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === 'marketplace') patchDraft(draft.key, { channel: 'marketplace' })
                      else patchDraft(draft.key, { channel: 'auction', auctionType: v })
                    }}
                  >
                    {settings.auctionTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                    <option value="marketplace">{settings.marketplaceLabel}</option>
                  </select>
                </label>
                <label>
                  Lot ID
                  <input
                    value={draft.id}
                    onChange={(e) => patchDraft(draft.key, { id: e.target.value })}
                    disabled={Boolean(editingId)}
                  />
                </label>
                <label>
                  Maker
                  <input
                    value={draft.manufacturer}
                    onChange={(e) => patchDraft(draft.key, { manufacturer: e.target.value })}
                  />
                </label>
                <label className="span-2">
                  Model
                  <input
                    value={draft.model}
                    onChange={(e) => patchDraft(draft.key, { model: e.target.value })}
                    placeholder="iPhone 14"
                  />
                </label>
                <label>
                  Model #
                  <input
                    value={draft.modelNumber}
                    onChange={(e) => patchDraft(draft.key, { modelNumber: e.target.value })}
                    placeholder="A2882"
                  />
                </label>
                <label>
                  Capacity
                  <input
                    value={draft.capacity}
                    onChange={(e) => patchDraft(draft.key, { capacity: e.target.value })}
                  />
                </label>
                <label>
                  Color
                  <input
                    value={draft.color}
                    onChange={(e) => patchDraft(draft.key, { color: e.target.value })}
                  />
                </label>
                <label>
                  Origin
                  <select value={draft.origin} onChange={(e) => patchDraft(draft.key, { origin: e.target.value })}>
                    {ORIGINS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Grade
                  <select value={draft.grade} onChange={(e) => patchDraft(draft.key, { grade: e.target.value })}>
                    {settings.grades.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Battery %
                  <input
                    type="number"
                    value={draft.battery}
                    onChange={(e) => patchDraft(draft.key, { battery: e.target.value })}
                  />
                </label>
                <label>
                  SIM
                  <select
                    value={draft.simLocked}
                    onChange={(e) => patchDraft(draft.key, { simLocked: e.target.value })}
                  >
                    <option value="0">Unlocked</option>
                    <option value="1">Locked</option>
                  </select>
                </label>
                <label>
                  Activation
                  <select
                    value={draft.actLocked}
                    onChange={(e) => patchDraft(draft.key, { actLocked: e.target.value })}
                  >
                    <option value="0">Open</option>
                    <option value="1">Locked</option>
                  </select>
                </label>
                <label>
                  Operator
                  <input
                    value={draft.operator}
                    onChange={(e) => patchDraft(draft.key, { operator: e.target.value })}
                    placeholder="Unlocked"
                  />
                </label>
                <label>
                  Total pcs
                  <input
                    type="number"
                    min={1}
                    value={draft.qty}
                    onChange={(e) => patchDraft(draft.key, { qty: e.target.value })}
                  />
                </label>
                <label>
                  MOQ
                  <input
                    type="number"
                    min={1}
                    placeholder="None"
                    value={draft.moq}
                    onChange={(e) => patchDraft(draft.key, { moq: e.target.value })}
                  />
                </label>
                <label>
                  Price / pc (USD)
                  <input
                    type="number"
                    min={1}
                    value={draft.price}
                    onChange={(e) => patchDraft(draft.key, { price: e.target.value })}
                  />
                </label>
                {draft.channel === 'marketplace' ? (
                  <>
                    <label>
                      Hours open
                      <input
                        type="number"
                        min={0}
                        value={draft.hours}
                        onChange={(e) => patchDraft(draft.key, { hours: e.target.value })}
                      />
                    </label>
                    <label>
                      Minutes open
                      <input
                        type="number"
                        min={0}
                        value={draft.minutes}
                        onChange={(e) => patchDraft(draft.key, { minutes: e.target.value })}
                      />
                    </label>
                  </>
                ) : (
                  <p className="muted tiny span-2">
                    Auction close is the shared list clock. Use Reopen / Extend list — not a per-item timer.
                    {lots.find((l) => l.id === editingId) ? (
                      <>
                        {' '}
                        This list:{' '}
                        <TimeLeft endsAt={lots.find((l) => l.id === editingId)!.endsAt} closedLabel="Closed" />.
                      </>
                    ) : null}
                  </p>
                )}
                <label className="span-2">
                  Condition notes
                  <input
                    value={draft.description}
                    onChange={(e) => patchDraft(draft.key, { description: e.target.value })}
                    placeholder="Same notes buyers see on the lot"
                  />
                </label>
              </div>
            </div>
            )
          })}
          <div className="listing-draft-actions">
            <button className="btn btn-primary" type="submit">
              Save listing
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setEditingId(null)
                setDrafts([blankDraft(settings)])
                setMsg(null)
              }}
            >
              Cancel edit
            </button>
          </div>
        </form>
        {msg ? <p className="ok">{msg}</p> : null}
      </section>
      ) : (
        <p className="muted tiny staff-hint">New lots: Inventory tab. This list is live stock only — edit, extend, or remove.</p>
      )}

      <section className="card admin-section">
        <h2>Live lots</h2>
        <div className="staff-type-picks">
          {settings.auctionTypes.map((t) => (
            <span key={t.value} className="auction-close-count">
              {t.label}{' '}
              <strong>
                {t.closesAt && t.closesAt > now ? (
                  <TimeLeft endsAt={t.closesAt} closedLabel="Closed" />
                ) : (
                  'Closed'
                )}
              </strong>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => extendAuctionType(t.value)}
              >
                +{listingLabel(listingMinutes(settings, 'extend'))}
              </button>
            </span>
          ))}
        </div>
        <div className="table-wrap auction-table-wrap">
        <table className="auction-table">
          <thead>
            <tr>
              <th>Lot</th>
              <th>Channel</th>
              <th>Item</th>
              <th>Pcs</th>
              <th>MOQ</th>
              <th>Price / pc</th>
              <th>Time left</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.id} className={lot.endsAt <= now && lot.channel === 'auction' ? 'is-closed' : ''}>
                <td className="mono">{lot.id}</td>
                <td>
                  <span className={`pill pill-${typePillClass(lot, settings)}`}>
                    {lotTypeLabel(lot, settings)}
                  </span>
                </td>
                <td>
                  <ItemLink lot={lot} />
                </td>
                <td>{lot.qty.toLocaleString()}</td>
                <td>{lot.moq && lot.moq > 1 ? lot.moq : '—'}</td>
                <td className="price-cell">{usd(lot.buyNowPrice ?? lot.currentPrice)}</td>
                <td>
                  {lot.channel === 'auction' ? <TimeLeft endsAt={lot.endsAt} closedLabel="Closed" /> : '—'}
                </td>
                <td className="row-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadLot(lot)}>
                    Edit
                  </button>
                  {lot.channel === 'auction' ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      title={`Extends the whole ${lotTypeLabel(lot, settings)} clock`}
                      onClick={() => extendLot(lot.id)}
                    >
                      +{listingLabel(listingMinutes(settings, 'extend'))} list
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (window.confirm(`Remove ${lot.id}?`)) removeLot(lot.id)
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="auction-cards">
          {lots.map((lot) => (
            <article
              key={lot.id}
              className={`auction-card ${lot.endsAt <= now && lot.channel === 'auction' ? 'is-closed' : ''}`}
            >
              <ItemLink lot={lot} />
              <div className="auction-card-meta">
                <span className={`pill pill-${typePillClass(lot, settings)}`}>
                  {lotTypeLabel(lot, settings)}
                </span>
                <span>{lot.qty.toLocaleString()} pcs</span>
                <span>{usd(lot.buyNowPrice ?? lot.currentPrice)}</span>
              </div>
              <div className="row-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadLot(lot)}>
                  Edit
                </button>
                {lot.channel === 'auction' ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    title={`Extends the whole ${lotTypeLabel(lot, settings)} clock`}
                    onClick={() => extendLot(lot.id)}
                  >
                    +{listingLabel(listingMinutes(settings, 'extend'))} list
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    if (window.confirm(`Remove ${lot.id}?`)) removeLot(lot.id)
                  }}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
        </>
      ) : null}

      {tab === 'bids' ? (
      <section className="table-wrap card admin-section">
        <h2>Recent bids</h2>
        <table className="auction-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Lot</th>
              <th>Pcs</th>
              <th>Price / pc</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {[...bids].reverse().slice(0, 20).map((b, i) => (
              <tr key={`${b.lotId}-${b.at}-${i}`}>
                <td>{new Date(b.at).toLocaleString()}</td>
                <td className="mono">{b.lotId}</td>
                <td>{b.qty}</td>
                <td>{usd(b.amount)}</td>
                <td className="price-cell">{usd(b.qty * b.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!bids.length ? <p className="empty">No bids yet.</p> : null}
      </section>
      ) : null}
    </div>
  )
}
