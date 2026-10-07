import { useMemo, useState } from 'react'
import { AuctionTable } from '../components/AuctionTable'
import { useStore } from '../store'
import type { AuctionType, Grade } from '../types'

export function Auctions() {
  const { lots } = useStore()
  const [q, setQ] = useState('')
  const [type, setType] = useState<'all' | AuctionType>('all')
  const [grade, setGrade] = useState<'all' | Grade>('all')
  const [maker, setMaker] = useState('all')

  const makers = useMemo(
    () => ['all', ...new Set(lots.filter((l) => l.channel === 'auction').map((l) => l.manufacturer))],
    [lots],
  )

  const rows = lots.filter((l) => {
    if (l.channel !== 'auction') return false
    if (type !== 'all' && l.auctionType !== type) return false
    if (grade !== 'all' && l.grade !== grade) return false
    if (maker !== 'all' && l.manufacturer !== maker) return false
    const hay = `${l.id} ${l.manufacturer} ${l.model} ${l.capacity} ${l.color}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Live auctions</h1>
          <p className="muted">
            Take-all vs small qty: higher $/pc small bids can take some pcs. The bar shows who is winning how many.
          </p>
        </div>
      </div>
      <div className="filters">
        <input
          placeholder="Search model, maker, lot ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="all">All types</option>
          <option value="live">Real-time</option>
          <option value="sealed">Sealed bid</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <select value={maker} onChange={(e) => setMaker(e.target.value)}>
          {makers.map((m) => (
            <option key={m} value={m}>
              {m === 'all' ? 'All makers' : m}
            </option>
          ))}
        </select>
        <select value={grade} onChange={(e) => setGrade(e.target.value as typeof grade)}>
          <option value="all">All grades</option>
          <option value="S">S</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>
      </div>
      {rows.length ? <AuctionTable lots={rows} /> : <p className="empty">No lots match those filters.</p>}
    </div>
  )
}
