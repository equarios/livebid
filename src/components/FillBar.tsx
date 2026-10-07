import { usd } from '../lib/format'
import type { FillStats } from '../lib/allocate'

export function FillBar({
  total,
  stats,
  sealed,
  me,
}: {
  total: number
  stats: FillStats
  sealed?: boolean
  me?: string
}) {
  if (sealed) {
    return <span className="muted tiny">Hidden until close</span>
  }

  const takePct = (stats.takeAllPcs / total) * 100
  const smallPct = (stats.smallPcs / total) * 100
  const openPct = (stats.openPcs / total) * 100
  const lostToSmall = stats.myTakeAll ? stats.smallPcs : 0

  return (
    <div className="fill-bar">
      <div className="fill-track" title={`${stats.takeAllPcs} take-all · ${stats.smallPcs} small · ${stats.openPcs} open`}>
        {stats.takeAllPcs > 0 ? (
          <span className="fill-take" style={{ width: `${takePct}%` }} />
        ) : null}
        {stats.smallPcs > 0 ? (
          <span className="fill-small" style={{ width: `${smallPct}%` }} />
        ) : null}
        {stats.openPcs > 0 ? (
          <span className="fill-open" style={{ width: `${openPct}%` }} />
        ) : null}
      </div>
      <div className="fill-legend">
        <span>
          Take-all <strong>{stats.takeAllPcs}</strong>
          {stats.takeAllPrice ? <em> @ {usd(stats.takeAllPrice)}</em> : null}
        </span>
        <span>
          Small <strong>{stats.smallPcs}</strong>
          {stats.smallHighPrice ? <em> @ {usd(stats.smallHighPrice)}</em> : null}
        </span>
        <span>
          Open <strong>{stats.openPcs}</strong>
        </span>
      </div>
      {me && stats.myPcs > 0 ? (
        <div className={`tiny ${stats.myTakeAll && lostToSmall ? 'warn-tiny' : 'ok'}`}>
          You winning {stats.myPcs}/{total} pcs
          {stats.myTakeAll && lostToSmall > 0
            ? ` · ${lostToSmall} pcs taken by higher small bids`
            : ''}
        </div>
      ) : null}
    </div>
  )
}
