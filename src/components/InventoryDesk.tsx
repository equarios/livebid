import { useMemo, useState, type FormEvent } from 'react'
import { ListingCsv } from './ListingCsv'
import { ORIGINS } from '../lib/auctionLists'
import { listingMinutes } from '../lib/duration'
import { skuSpecLine, skuTitle } from '../lib/inventory'
import { dropClockHint, dropListKey, groupDropItems } from '../lib/listingDrops'
import { usd } from '../lib/format'
import { TimeLeft } from './TimeLeft'
import { useNow, useStore } from '../store'
import type { AuctionType, Channel, InventorySku, ListingDropItem } from '../types'

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
  }
}

function newLotId() {
  return `LB-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 90 + 10)}`
}

function parseList(value: string): { channel: Channel; auctionType?: AuctionType } {
  if (value === 'marketplace') return { channel: 'marketplace' }
  return { channel: 'auction', auctionType: value }
}

export function InventoryDesk() {
  const { inventory, settings, listingDrops, saveSku, removeSku, submitListingDrop, withdrawListingDrop } = useStore()
  const now = useNow()
  const waitingSuper = (listingDrops || []).filter((d) => d.status === 'pending')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<InventorySku>(emptySku)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [list, setList] = useState(settings.auctionTypes[0]?.value || 'live')
  const reopen = listingMinutes(settings, 'reopen')
  const [hours, setHours] = useState(String(Math.floor(reopen / 60) || 4))
  const [minutes, setMinutes] = useState(String(reopen % 60))
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
    return qtyBySku[sku.id] ?? String(sku.defaultMoq && sku.defaultMoq > 1 ? sku.defaultMoq : 1)
  }

  function skuPrice(sku: InventorySku) {
    return priceBySku[sku.id] ?? String(sku.lastPrice || 100)
  }

  function addToQueue(sku: InventorySku) {
    const qty = skuQty(sku)
    const price = skuPrice(sku)
    const q = Number(qty)
    const p = Number(price)
    if (!Number.isInteger(q) || q < 1 || !Number.isFinite(p) || p < 1) {
      setMsg('Qty and price must be valid before adding to the auction.')
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
      setMsg('Add devices from inventory first.')
      return
    }
    const items: ListingDropItem[] = []
    for (const [i, { row, sku }] of queued.entries()) {
      const q = Number(row.qty)
      const p = Number(row.price)
      if (!Number.isInteger(q) || q < 1 || !Number.isFinite(p) || p < 1) {
        setMsg(`Fill qty and price for ${skuTitle(sku)}.`)
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
        .join(', ')}). Nothing is live until Super confirms.`,
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
    setMsg(form.id ? `Saved ${skuTitle(form)}` : `Added ${form.manufacturer} ${form.model} to inventory.`)
    setForm(emptySku())
    setShowForm(false)
  }

  return (
    <section className="card admin-section">
      <div className="listing-draft-bar">
        <h2>
          Inventory
          <em>{inventory.length}</em>
        </h2>
        <div className="listing-draft-add">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search devices"
            aria-label="Search inventory"
          />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm || form.id ? 'Hide new device' : 'New device'}
          </button>
        </div>
      </div>
      <p className="muted tiny">
        Pick devices, send them to an auction, Super confirms. Specs stay on the SKU — qty and price only. CSV is the
        bulk path for the same queue.
      </p>
      <div className="inventory-csv">
        <ListingCsv />
      </div>
      {waitingSuper.length ? (
        <div className="inventory-queue">
          <p className="muted tiny">Waiting Super — not live yet. Withdraw here if the batch is wrong.</p>
          {waitingSuper.map((drop) => (
            <div key={drop.id} className="listing-draft-bar">
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

      <div className="inventory-target">
        <label>
          Send to
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
            <label>
              Hours
              <input type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} />
            </label>
            <label>
              Minutes
              <input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </label>
          </>
        )}
        <div className="listing-draft-actions">
          <button type="button" className="btn btn-primary btn-sm" disabled={!queued.length} onClick={sendQueue}>
            Send {queued.length || ''} to Super
          </button>
          {queued.length ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQueue([])}>
              Clear
            </button>
          ) : null}
        </div>
        <p className="muted tiny">
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
      </div>

      {queued.length ? (
        <div className="inventory-queue">
          <p className="muted tiny">
            Ready for {targetLabel}: {queued.length} item{queued.length === 1 ? '' : 's'}
          </p>
          {queued.map(({ row, sku }) => (
            <div key={row.key} className="inventory-queue-row">
              <div>
                <strong>{skuTitle(sku)}</strong>
                <p className="muted tiny item-specs">{skuSpecLine(sku)}</p>
              </div>
              <label>
                Qty
                <input
                  type="number"
                  min={1}
                  value={row.qty}
                  onChange={(e) =>
                    setQueue((rows) => rows.map((r) => (r.key === row.key ? { ...r, qty: e.target.value } : r)))
                  }
                />
              </label>
              <label>
                Price
                <input
                  type="number"
                  min={1}
                  value={row.price}
                  onChange={(e) =>
                    setQueue((rows) => rows.map((r) => (r.key === row.key ? { ...r, price: e.target.value } : r)))
                  }
                />
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setQueue((rows) => rows.filter((r) => r.key !== row.key))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {showForm || form.id ? (
        <form className="listing-item-grid" onSubmit={onSave}>
          <label>
            Maker
            <input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
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
            <input value={form.modelNumber} onChange={(e) => setForm({ ...form, modelNumber: e.target.value })} />
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
            <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
              {settings.grades.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            Battery %
            <input
              type="number"
              value={form.battery}
              onChange={(e) => setForm({ ...form, battery: Number(e.target.value) })}
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
            <input value={form.operator || ''} onChange={(e) => setForm({ ...form, operator: e.target.value })} />
          </label>
          <label>
            Default MOQ
            <input
              type="number"
              min={1}
              placeholder="None"
              value={form.defaultMoq && form.defaultMoq > 1 ? form.defaultMoq : ''}
              onChange={(e) => setForm({ ...form, defaultMoq: Number(e.target.value) || undefined })}
            />
          </label>
          <label>
            Last price
            <input
              type="number"
              min={1}
              value={form.lastPrice || ''}
              onChange={(e) => setForm({ ...form, lastPrice: Number(e.target.value) || undefined })}
            />
          </label>
          <label className="span-2">
            Condition notes
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <div className="listing-draft-actions span-2">
            <button className="btn btn-primary btn-sm" type="submit">
              {form.id ? 'Save device' : 'Add to inventory'}
            </button>
            {form.id ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(emptySku())}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {msg ? <p className="ok">{msg}</p> : null}

      <div className="listing-drop-lots" style={{ marginTop: 12 }}>
        {shown.map((sku) => (
          <div key={sku.id} className="listing-drop-lot">
            <div className="inventory-sku-row">
              <div>
                <strong>{skuTitle(sku)}</strong>
                <p className="muted tiny item-specs">{skuSpecLine(sku)}</p>
                {sku.lastPrice ? <p className="muted tiny">Last {usd(sku.lastPrice)}</p> : null}
              </div>
              <label>
                Qty
                <input
                  type="number"
                  min={1}
                  value={skuQty(sku)}
                  onChange={(e) => setQtyBySku((m) => ({ ...m, [sku.id]: e.target.value }))}
                />
              </label>
              <label>
                Price
                <input
                  type="number"
                  min={1}
                  value={skuPrice(sku)}
                  onChange={(e) => setPriceBySku((m) => ({ ...m, [sku.id]: e.target.value }))}
                />
              </label>
              <div className="listing-draft-add">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => addToQueue(sku)}>
                  Add to {targetLabel}
                </button>
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
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
