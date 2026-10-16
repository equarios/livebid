import { useMemo, useState, type FormEvent } from 'react'
import { ListingCsv } from './ListingCsv'
import { NumberField } from './NumberField'
import { numStr, parseNonNegInt } from '../lib/numberInput'
import { ORIGINS } from '../lib/auctionLists'
import { listingMinutes } from '../lib/duration'
import { skuSpecLine, skuTitle } from '../lib/inventory'
import { dropClockHint, dropListKey, groupDropItems } from '../lib/listingDrops'
import { usd } from '../lib/format'
import { TimeLeft } from './TimeLeft'
import { toastMsg } from '../lib/toast'
import { useNow, useStore } from '../store'
import type { AuctionType, Channel, Grade, InventorySku, ListingDropItem } from '../types'

type DeskTab = 'warehouse' | 'list'

type QueueRow = {
  key: string
  skuId: string
  qty: string
  price: string
}

function emptySku(): InventorySku {
  return {
    id: '',
    manufacturer: 'Apple',
    model: '',
    modelNumber: '',
    capacity: '128GB',
    color: 'Black',
    grade: 'A',
    battery: 90,
    origin: 'INT',
    operator: '',
    simLocked: false,
    activationLocked: false,
    description: '',
    onHand: 0,
  }
}

function onHandOf(sku: InventorySku) {
  return Math.max(0, Math.floor(Number(sku.onHand) || 0))
}

function defaultListQty(sku: InventorySku) {
  const stock = onHandOf(sku)
  const moq = sku.defaultMoq && sku.defaultMoq > 1 ? sku.defaultMoq : 1
  if (stock <= 0) return String(moq)
  return String(Math.min(moq, stock))
}

function newLotId() {
  return `LB-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 90 + 10)}`
}

function parseList(value: string): { channel: Channel; auctionType?: AuctionType } {
  if (value === 'marketplace') return { channel: 'marketplace' }
  return { channel: 'auction', auctionType: value }
}

export function InventoryDesk() {
  const { inventory, settings, listingDrops, saveSku, removeSku, submitListingDrop, withdrawListingDrop } =
    useStore()
  const now = useNow()
  const waitingSuper = (listingDrops || []).filter((d) => d.status === 'pending')
  const [tab, setTab] = useState<DeskTab>('warehouse')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<InventorySku>(emptySku)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsgState] = useState<string | null>(null)
  function setMsg(next: string | null) {
    setMsgState(next)
    toastMsg(next)
  }
  const [list, setList] = useState(settings.auctionTypes[0]?.value || 'live')
  const [hours, setHours] = useState('4')
  const [minutes, setMinutes] = useState('0')
  const [qtyBySku, setQtyBySku] = useState<Record<string, string>>({})
  const [priceBySku, setPriceBySku] = useState<Record<string, string>>({})
  const [queue, setQueue] = useState<QueueRow[]>([])

  const shown = inventory.filter((sku) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return `${skuTitle(sku)} ${skuSpecLine(sku)}`.toLowerCase().includes(q)
  })

  const queued = useMemo(
    () =>
      queue
        .map((row) => ({ row, sku: inventory.find((s) => s.id === row.skuId) }))
        .filter((x): x is { row: QueueRow; sku: InventorySku } => Boolean(x.sku)),
    [queue, inventory],
  )

  const target = parseList(list)
  const targetType = settings.auctionTypes.find((t) => t.value === target.auctionType)
  const targetLabel =
    target.channel === 'marketplace'
      ? settings.marketplaceLabel
      : targetType?.label || target.auctionType || 'Auction'
  const targetOpen = Boolean(targetType?.closesAt && targetType.closesAt > now)

  function skuQty(sku: InventorySku) {
    return qtyBySku[sku.id] ?? defaultListQty(sku)
  }

  function skuPrice(sku: InventorySku) {
    return priceBySku[sku.id] ?? String(sku.lastPrice || 100)
  }

  function addToQueue(sku: InventorySku) {
    const qty = skuQty(sku)
    const price = skuPrice(sku)
    const q = Number(qty)
    const p = Number(price)
    const stock = onHandOf(sku)
    if (!Number.isInteger(q) || q < 1 || !Number.isFinite(p) || p < 1) {
      setMsg('List qty and price must be valid before adding.')
      return
    }
    if (stock <= 0) {
      setMsg(`${skuTitle(sku)} has no warehouse stock (On hand 0). Set stock in Warehouse first.`)
      return
    }
    if (q > stock) {
      setMsg(`List qty ${q} exceeds On hand ${stock} for ${skuTitle(sku)}.`)
      return
    }
    setQueue((rows) => [
      ...rows,
      { key: `${sku.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, skuId: sku.id, qty, price },
    ])
    setMsg(`Added ${skuTitle(sku)} to ${targetLabel}.`)
  }

  function sendQueue() {
    const h = Number(hours)
    const min = Number(minutes)
    const durationMins = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(min) ? min : 0)
    const mins = list === 'marketplace' ? listingMinutes(settings, 'reopen') : durationMins
    if (!Number.isFinite(mins) || mins < 1) {
      setMsg('If this auction is closed, set hours/minutes of at least 1 minute to start a new clock.')
      return
    }
    if (!queued.length) {
      setMsg('Add devices from the List picker first.')
      return
    }
    const items: ListingDropItem[] = []
    for (const [i, { row, sku }] of queued.entries()) {
      const q = Number(row.qty)
      const p = Number(row.price)
      const stock = onHandOf(sku)
      if (!Number.isInteger(q) || q < 1 || !Number.isFinite(p) || p < 1) {
        setMsg(`Fill list qty and price for ${skuTitle(sku)}.`)
        return
      }
      if (q > stock) {
        setMsg(`List qty ${q} exceeds On hand ${stock} for ${skuTitle(sku)}.`)
        return
      }
      const moq = sku.defaultMoq && sku.defaultMoq > 1 && sku.defaultMoq <= q ? sku.defaultMoq : undefined
      items.push({
        id: `${newLotId()}-${i}`,
        channel: target.channel,
        auctionType: target.channel === 'auction' ? target.auctionType : undefined,
        manufacturer: sku.manufacturer,
        model: sku.model,
        modelNumber: sku.modelNumber,
        capacity: sku.capacity,
        color: sku.color,
        grade: sku.grade,
        battery: sku.battery,
        qty: q,
        moq,
        startPrice: p,
        currentPrice: p,
        buyNowPrice: target.channel === 'marketplace' ? p : undefined,
        bidCount: 0,
        endsAt: 0,
        durationMins: mins,
        description: sku.description || 'Listed from inventory.',
        accent: '#1d3348',
        origin: sku.origin,
        operator: sku.operator,
        simLocked: sku.simLocked,
        activationLocked: sku.activationLocked,
      })
    }
    const err = submitListingDrop(items)
    if (err) {
      setMsg(err)
      return
    }
    const groups = groupDropItems(items, settings)
    setMsg(
      `Sent ${items.length} item${items.length === 1 ? '' : 's'} to Super for ${targetLabel} (${groups
        .map((g) => `${g.label} ${g.items.length}`)
        .join(', ')}). Nothing is live until Super Launch Preview.`,
    )
    setQueue([])
  }

  function onSave(e: FormEvent) {
    e.preventDefault()
    const err = saveSku(form)
    if (err) {
      setMsg(err)
      return
    }
    setMsg(form.id ? `Saved ${skuTitle(form)}` : `Added ${form.manufacturer} ${form.model} to warehouse.`)
    setForm(emptySku())
    setShowForm(false)
  }

  return (
    <section className="mh-desk inv-desk">
      <header className="mh-desk-head">
        <h2>
          Inventory
          <em>{inventory.length}</em>
        </h2>
        <p className="mh-desk-note">
          Warehouse = stock on hand. List = send to auction for Super. Specs stay on the SKU.
        </p>
        <div className="mh-desk-actions">
          <nav className="mypage-tabs inv-desk-tabs" aria-label="Inventory sections">
            <button
              type="button"
              className={tab === 'warehouse' ? 'active' : undefined}
              onClick={() => setTab('warehouse')}
            >
              Warehouse
            </button>
            <button
              type="button"
              className={tab === 'list' ? 'active' : undefined}
              onClick={() => setTab('list')}
            >
              List
              {queued.length ? <em>{queued.length}</em> : null}
            </button>
          </nav>
          <input
            className="inv-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search devices"
            aria-label="Search inventory"
          />
          {tab === 'warehouse' ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm((v) => !v)}>
              {showForm || form.id ? 'Hide form' : 'New device'}
            </button>
          ) : null}
        </div>
      </header>

      {msg ? <p className="ok tiny">{msg}</p> : null}

      {tab === 'warehouse' ? (
        <>
          <div className="inventory-csv">
            <ListingCsv />
          </div>

          {showForm || form.id ? (
            <form className="listing-item-grid inv-sku-form" onSubmit={onSave}>
              <label>
                Maker
                <input
                  value={form.manufacturer}
                  onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                />
              </label>
              <label className="span-2">
                Model
                <input
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="iPhone 14"
                />
              </label>
              <label>
                Model #
                <input
                  value={form.modelNumber}
                  onChange={(e) => setForm({ ...form, modelNumber: e.target.value })}
                />
              </label>
              <label>
                Capacity
                <input value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              </label>
              <label>
                Color
                <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </label>
              <label>
                Origin
                <select value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })}>
                  {ORIGINS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label>
                Grade
                <select
                  value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value as Grade })}
                >
                  {settings.grades.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </label>
              <label>
                Battery %
                <NumberField
                  value={form.battery}
                  min={0}
                  max={100}
                  onCommit={(battery) => setForm({ ...form, battery })}
                />
              </label>
              <label>
                On hand
                <input
                  type="number"
                  min={0}
                  value={numStr(form.onHand)}
                  onChange={(e) => setForm({ ...form, onHand: parseNonNegInt(e.target.value) })}
                />
              </label>
              <label>
                SIM
                <select
                  value={form.simLocked ? '1' : '0'}
                  onChange={(e) => setForm({ ...form, simLocked: e.target.value === '1' })}
                >
                  <option value="0">Unlocked</option>
                  <option value="1">Locked</option>
                </select>
              </label>
              <label>
                Activation
                <select
                  value={form.activationLocked ? '1' : '0'}
                  onChange={(e) => setForm({ ...form, activationLocked: e.target.value === '1' })}
                >
                  <option value="0">Open</option>
                  <option value="1">Locked</option>
                </select>
              </label>
              <label>
                Operator
                <input
                  value={form.operator || ''}
                  onChange={(e) => setForm({ ...form, operator: e.target.value })}
                />
              </label>
              <label>
                Default MOQ
                <input
                  type="number"
                  min={1}
                  placeholder="None"
                  value={numStr(form.defaultMoq && form.defaultMoq > 1 ? form.defaultMoq : undefined)}
                  onChange={(e) => setForm({ ...form, defaultMoq: parseNonNegInt(e.target.value) })}
                />
              </label>
              <label>
                Last price
                <input
                  type="number"
                  min={1}
                  value={numStr(form.lastPrice)}
                  onChange={(e) => {
                    const t = e.target.value.trim()
                    setForm({
                      ...form,
                      lastPrice: t === '' ? undefined : Number(t) || undefined,
                    })
                  }}
                />
              </label>
              <label className="span-2">
                Condition notes
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
              <div className="listing-draft-actions span-2">
                <button className="btn btn-primary btn-sm" type="submit">
                  {form.id ? 'Save device' : 'Add to warehouse'}
                </button>
                {form.id ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(emptySku())}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}

          <header className="mh-desk-head is-sub">
            <h2>
              Devices
              <em>{shown.length}</em>
            </h2>
            <p className="mh-desk-note">What you have in the warehouse — set On hand here.</p>
          </header>

          {!shown.length ? (
            <div className="mh-empty">
              <p>{query.trim() ? 'No devices match that search.' : 'No warehouse SKUs yet.'}</p>
            </div>
          ) : (
            <div className="mh-table-wrap desk-list-scroll">
              <table className="gbs-table mh-table inv-sku-table inv-warehouse-table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th className="num">On hand</th>
                    <th className="num">Last price</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((sku) => (
                    <tr key={sku.id}>
                      <td>
                        <strong>{skuTitle(sku)}</strong>
                        <p className="muted tiny item-specs">{skuSpecLine(sku)}</p>
                      </td>
                      <td className="num">
                        <NumberField
                          className="inv-cell-input"
                          value={onHandOf(sku)}
                          min={0}
                          aria-label={`On hand ${skuTitle(sku)}`}
                          onCommit={(onHand) => {
                            const err = saveSku({ ...sku, onHand })
                            if (err) setMsg(err)
                          }}
                        />
                      </td>
                      <td className="num">{sku.lastPrice ? usd(sku.lastPrice) : '—'}</td>
                      <td className="inv-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setForm(sku)
                            setShowForm(true)
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            const err = removeSku(sku.id)
                            setMsg(err || `Removed ${skuTitle(sku)}.`)
                            if (form.id === sku.id) setForm(emptySku())
                            setQueue((rows) => rows.filter((r) => r.skuId !== sku.id))
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
          )}
        </>
      ) : (
        <>
          {waitingSuper.length ? (
            <div className="inv-pending">
              <header className="mh-desk-head is-sub">
                <h2>
                  Waiting Super
                  <em>{waitingSuper.length}</em>
                </h2>
                <p className="mh-desk-note">Not live yet — withdraw if the batch is wrong.</p>
              </header>
              {waitingSuper.map((drop) => (
                <div key={drop.id} className="inv-pending-row">
                  <strong>
                    {drop.id} · {drop.items.length} item{drop.items.length === 1 ? '' : 's'} ·{' '}
                    {groupDropItems(drop.items, settings)
                      .map((g) => `${g.label} ${g.items.length}`)
                      .join(' · ')}
                  </strong>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const err = withdrawListingDrop(drop.id)
                      setMsg(err || `Withdrew ${drop.id}.`)
                    }}
                  >
                    Withdraw
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <header className="mh-desk-head is-sub">
            <h2>
              Send queue
              <em className={queued.length ? 'is-open' : undefined}>{queued.length}</em>
            </h2>
            <p className="mh-desk-note">
              {dropClockHint(
                settings,
                dropListKey({ channel: target.channel, auctionType: target.auctionType }),
                (Number(hours) || 0) * 60 + (Number(minutes) || 0) || 1,
                now,
              )}
              {targetOpen && targetType?.closesAt ? (
                <>
                  {' '}
                  <TimeLeft endsAt={targetType.closesAt} closedLabel="Closed" />
                </>
              ) : null}
            </p>
            <div className="mh-desk-actions inv-target-actions">
              <label className="inv-target-field">
                <span className="sr-only">Send to</span>
                <select value={list} onChange={(e) => setList(e.target.value)} aria-label="Preferred auction">
                  {settings.auctionTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                  <option value="marketplace">{settings.marketplaceLabel}</option>
                </select>
              </label>
              {list === 'marketplace' ? null : (
                <>
                  <label className="inv-target-field">
                    <span className="sr-only">Hours</span>
                    <input
                      type="number"
                      min={0}
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      aria-label="Hours"
                      placeholder="Hrs"
                    />
                  </label>
                  <label className="inv-target-field">
                    <span className="sr-only">Minutes</span>
                    <input
                      type="number"
                      min={0}
                      value={minutes}
                      onChange={(e) => setMinutes(e.target.value)}
                      aria-label="Minutes"
                      placeholder="Min"
                    />
                  </label>
                </>
              )}
              <button type="button" className="btn btn-primary btn-sm" disabled={!queued.length} onClick={sendQueue}>
                Send {queued.length || ''} to Super
              </button>
              {queued.length ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQueue([])}>
                  Clear
                </button>
              ) : null}
            </div>
          </header>

          {queued.length ? (
            <div className="mh-table-wrap inv-queue-wrap">
              <table className="gbs-table mh-table inv-sku-table">
                <thead>
                  <tr>
                    <th>Queued for {targetLabel}</th>
                    <th className="num">List qty</th>
                    <th className="num">Price</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {queued.map(({ row, sku }) => (
                    <tr key={row.key}>
                      <td>
                        <strong>{skuTitle(sku)}</strong>
                        <p className="muted tiny item-specs">{skuSpecLine(sku)}</p>
                        <p className="muted tiny">On hand {onHandOf(sku)}</p>
                      </td>
                      <td className="num">
                        <input
                          type="number"
                          min={1}
                          max={onHandOf(sku) || undefined}
                          className="inv-cell-input"
                          value={row.qty}
                          onChange={(e) =>
                            setQueue((rows) =>
                              rows.map((r) => (r.key === row.key ? { ...r, qty: e.target.value } : r)),
                            )
                          }
                          aria-label={`List qty ${skuTitle(sku)}`}
                        />
                      </td>
                      <td className="num">
                        <input
                          type="number"
                          min={1}
                          className="inv-cell-input"
                          value={row.price}
                          onChange={(e) =>
                            setQueue((rows) =>
                              rows.map((r) => (r.key === row.key ? { ...r, price: e.target.value } : r)),
                            )
                          }
                          aria-label={`Price ${skuTitle(sku)}`}
                        />
                      </td>
                      <td className="inv-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setQueue((rows) => rows.filter((r) => r.key !== row.key))}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <header className="mh-desk-head is-sub">
            <h2>
              Pick devices
              <em>{shown.length}</em>
            </h2>
            <p className="mh-desk-note">Set list qty and price (cannot exceed On hand), then add to the send queue.</p>
          </header>

          {!shown.length ? (
            <div className="mh-empty">
              <p>{query.trim() ? 'No devices match that search.' : 'No warehouse SKUs yet — add stock in Warehouse.'}</p>
            </div>
          ) : (
            <div className="mh-table-wrap desk-list-scroll">
              <table className="gbs-table mh-table inv-sku-table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th className="num">List qty</th>
                    <th className="num">Price</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((sku) => {
                    const stock = onHandOf(sku)
                    return (
                      <tr key={sku.id}>
                        <td>
                          <strong>{skuTitle(sku)}</strong>
                          <p className="muted tiny item-specs">{skuSpecLine(sku)}</p>
                          <p className="muted tiny">On hand {stock}</p>
                        </td>
                        <td className="num">
                          <input
                            type="number"
                            min={1}
                            max={stock || undefined}
                            className="inv-cell-input"
                            value={skuQty(sku)}
                            onChange={(e) => setQtyBySku((m) => ({ ...m, [sku.id]: e.target.value }))}
                            aria-label={`List qty ${skuTitle(sku)}`}
                          />
                        </td>
                        <td className="num">
                          <input
                            type="number"
                            min={1}
                            className="inv-cell-input"
                            value={skuPrice(sku)}
                            onChange={(e) => setPriceBySku((m) => ({ ...m, [sku.id]: e.target.value }))}
                            aria-label={`Price ${skuTitle(sku)}`}
                          />
                        </td>
                        <td className="inv-actions">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={stock <= 0}
                            onClick={() => addToQueue(sku)}
                          >
                            Add to {targetLabel}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
