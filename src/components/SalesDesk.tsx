import { useEffect, useMemo, useState } from 'react'
import { allocate, lastBidsForLot } from '../lib/allocate'
import { isAuctionOpen } from '../lib/auctionLists'
import { api, type StoreOrderDto } from '../lib/api'
import { usd } from '../lib/format'
import { invoiceChannel, invoiceLines } from '../lib/invoices'
import { useNow, useStore } from '../store'

type SalesTab = 'wholesale' | 'store'

type SalesRow = {
  key: string
  model: string
  pcs: number
  amount: number
  missed: number
}

function pcs(n: number) {
  return n.toLocaleString('en-US')
}

export function SalesDesk({ tab }: { tab: SalesTab }) {
  const { lots, bids, invoices } = useStore()
  const now = useNow()
  const [orders, setOrders] = useState<StoreOrderDto[]>([])
  const [orderErr, setOrderErr] = useState<string | null>(null)

  useEffect(() => {
    let gone = false
    api
      .storeOrders()
      .then((res) => {
        if (!gone) setOrders(res.orders)
      })
      .catch((e: unknown) => {
        if (!gone) setOrderErr(e instanceof Error ? e.message : 'Could not load store orders.')
      })
    return () => {
      gone = true
    }
  }, [])

  const wholesale = useMemo(() => {
    const map = new Map<string, SalesRow>()
    for (const inv of invoices) {
      if (inv.status !== 'paid') continue
      const channel = invoiceChannel(inv, lots)
      if (channel !== 'auction' && channel !== 'marketplace') continue
      for (const line of invoiceLines(inv)) {
        const lot = lots.find((row) => row.id === line.lotId)
        const key = lot ? `${lot.manufacturer} ${lot.model}`.trim() : line.lotId
        const row = map.get(key) || { key, model: key, pcs: 0, amount: 0, missed: 0 }
        row.pcs += line.qty
        row.amount += line.qty * line.unitPrice
        map.set(key, row)
      }
    }
    for (const lot of lots) {
      if (lot.channel !== 'auction' || isAuctionOpen(lot, now)) continue
      const won = new Map(allocate(lot, bids).map((slice) => [slice.accountId, slice.qty]))
      const key = `${lot.manufacturer} ${lot.model}`.trim()
      let missed = 0
      for (const bid of lastBidsForLot(bids, lot.id)) {
        if (bid.accountId.startsWith('BOT-')) continue
        missed += Math.max(0, bid.qty - (won.get(bid.accountId) || 0))
      }
      if (!missed) continue
      const row = map.get(key) || { key, model: key, pcs: 0, amount: 0, missed: 0 }
      row.missed += missed
      map.set(key, row)
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount || b.missed - a.missed)
  }, [bids, invoices, lots, now])

  const storeRows = useMemo(() => {
    const map = new Map<string, SalesRow>()
    for (const order of orders) {
      if (order.status !== 'paid' && order.status !== 'shipped') continue
      for (const line of order.lines) {
        const key = line.title.trim() || 'Store item'
        const row = map.get(key) || { key, model: key, pcs: 0, amount: 0, missed: 0 }
        row.pcs += line.qty
        row.amount += line.qty * line.unitPrice
        map.set(key, row)
      }
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount)
  }, [orders])

  const wholesaleAmount = wholesale.reduce((n, row) => n + row.amount, 0)
  const storeAmount = storeRows.reduce((n, row) => n + row.amount, 0)
  const rows = tab === 'wholesale' ? wholesale : storeRows

  return (
    <section className="mh-desk">
      <header className="mh-desk-head">
        <h2>{tab === 'wholesale' ? 'Wholesale sales' : 'Store sales'}</h2>
        <p className="mh-desk-note">
          Wholesale {usd(wholesaleAmount)} · Store {usd(storeAmount)}. Each table stays on its own channel.
          Paid invoices and paid or shipped store orders only.
        </p>
        {orderErr ? <p className="muted tiny">{orderErr}</p> : null}
      </header>
      {!rows.length ? (
        <div className="mh-empty">
          <p>{tab === 'wholesale' ? 'No paid wholesale invoices yet.' : 'No paid store orders yet.'}</p>
        </div>
      ) : (
        <table className="gbs-table mh-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Pcs sold</th>
              <th>Amount</th>
              {tab === 'wholesale' ? <th>Missed</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.model}</td>
                <td>{pcs(row.pcs)}</td>
                <td>{usd(row.amount)}</td>
                {tab === 'wholesale' ? <td>{pcs(row.missed)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
