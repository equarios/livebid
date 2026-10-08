import { FillBar } from './FillBar'
import { InlineBid } from './InlineBid'
import { ItemLink } from './ItemLink'
import { bidStatus, fillStats } from '../lib/allocate'
import { isSealedLot, typePillClass } from '../lib/auctionLists'
import { lotTypeLabel, usd } from '../lib/format'
import { moqLabel } from '../lib/moq'
import { useStore } from '../store'
import type { Lot } from '../types'
import { TimeLeft } from './TimeLeft'

export function AuctionTable({
  lots,
  compareIds,
  onToggleCompare,
}: {
  lots: Lot[]
  compareIds?: string[]
  onToggleCompare?: (id: string) => void
}) {
  const { myLastBid, bids, user, settings } = useStore()
  const me = user?.accountId

  let alreadyBid = 0
  let winningAmount = 0
  for (const lot of lots) {
    const last = myLastBid(lot.id)
    if (!last) continue
    alreadyBid += last.qty * last.amount
    const stats = fillStats(lot, bids, me)
    if (!isSealedLot(lot, settings) && stats.myPcs > 0) {
      winningAmount += stats.myPcs * last.amount
    }
  }

  return (
    <>
      <div className="bid-totals">
        <div className="bid-total-card">
          <span className="label">Total already bid</span>
          <strong>{usd(alreadyBid)}</strong>
          <span className="muted tiny">Your qty × your price on these lots</span>
        </div>
        <div className="bid-total-card win-card">
          <span className="label">Winning amount</span>
          <strong>{usd(winningAmount)}</strong>
          <span className="muted tiny">Pcs you are currently allocated × your price</span>
        </div>
      </div>
      <div className="table-wrap card auction-table-wrap">
        <table className="auction-table">
          <thead>
            <tr>
              {onToggleCompare ? <th>Cmp</th> : null}
              <th>Lot</th>
              <th>Item</th>
              <th>Grade</th>
              <th>Total pcs</th>
              <th>You</th>
              <th>High / pc</th>
              <th>Your bid total</th>
              <th>Winning amount</th>
              <th>Time left</th>
              <th>Your order</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => {
              const last = myLastBid(lot.id)
              const stats = fillStats(lot, bids, me)
              const closed = lot.endsAt <= Date.now()
              const st = bidStatus(lot, stats.myPcs, last?.qty, Date.now(), settings)
              const yourTotal = last ? last.qty * last.amount : null
              const winTotal =
                isSealedLot(lot, settings) ? null : stats.myPcs > 0 && last ? stats.myPcs * last.amount : 0
              return (
                <tr key={lot.id} className={closed ? 'is-closed' : ''}>
                  {onToggleCompare ? (
                    <td>
                      <input
                        type="checkbox"
                        checked={compareIds?.includes(lot.id) || false}
                        aria-label={`Compare ${lot.id}`}
                        onChange={() => onToggleCompare(lot.id)}
                      />
                    </td>
                  ) : null}
                  <td className="mono">{lot.id}</td>
                  <td>
                    <ItemLink lot={lot} />
                  </td>
                  <td>
                    <span className={`grade-inline grade-${lot.grade}`}>{lot.grade}</span>
                  </td>
                <td>
                  {lot.qty.toLocaleString()}
                  <div className="muted tiny">{moqLabel(lot, settings.copy.noMoq)}</div>
                </td>
                <td className="fill-cell">
                  <FillBar
                    total={lot.qty}
                    myPcs={stats.myPcs}
                    sealed={isSealedLot(lot, settings)}
                    status={st}
                    kind={lotTypeLabel(lot, settings)}
                    kindClass={typePillClass(lot, settings)}
                  />
                </td>
                <td className="price-cell">{usd(lot.currentPrice)}</td>
                <td className="price-cell">
                    {yourTotal != null && last ? (
                      <>
                        {usd(yourTotal)}
                        <div className="muted tiny">
                          {last.qty} pcs × {usd(last.amount)}
                          {last.qty >= lot.qty ? ' · take all' : ' · small qty'}
                        </div>
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="price-cell">
                    {winTotal == null ? (
                      <span className="muted">Hidden</span>
                    ) : (
                      <>
                        {usd(winTotal)}
                        <div className="muted tiny">{stats.myPcs} pcs allocated</div>
                      </>
                    )}
                  </td>
                  <td>
                    <TimeLeft endsAt={lot.endsAt} warn />
                  </td>
                  <td>
                    <InlineBid lot={lot} withWatch />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="auction-cards" aria-label="Auction lots">
        {lots.map((lot) => {
          const last = myLastBid(lot.id)
          const stats = fillStats(lot, bids, me)
          const closed = lot.endsAt <= Date.now()
          const st = bidStatus(lot, stats.myPcs, last?.qty, Date.now(), settings)
          const yourTotal = last ? last.qty * last.amount : null
          const winTotal =
            isSealedLot(lot, settings) ? null : stats.myPcs > 0 && last ? stats.myPcs * last.amount : 0
          return (
            <article key={lot.id} className={`auction-card ${closed ? 'is-closed' : ''}`}>
              {onToggleCompare ? (
                <label className="compare-check">
                  <input
                    type="checkbox"
                    checked={compareIds?.includes(lot.id) || false}
                    onChange={() => onToggleCompare(lot.id)}
                  />
                  Compare
                </label>
              ) : null}
              <ItemLink lot={lot} />
              <div className="auction-card-meta">
                <span className={`grade-inline grade-${lot.grade}`}>{lot.grade}</span>
                <span>{lot.qty.toLocaleString()} pcs</span>
                <TimeLeft endsAt={lot.endsAt} warn />
              </div>
              <FillBar
                total={lot.qty}
                myPcs={stats.myPcs}
                sealed={isSealedLot(lot, settings)}
                status={st}
                kind={lotTypeLabel(lot, settings)}
                kindClass={typePillClass(lot, settings)}
              />
              <div className="auction-card-prices">
                <span>
                  High / pc <strong>{usd(lot.currentPrice)}</strong>
                </span>
                <span>
                  Your bid{' '}
                  <strong>{yourTotal != null && last ? usd(yourTotal) : '—'}</strong>
                </span>
                <span>
                  Winning{' '}
                  <strong>{winTotal == null ? 'Hidden' : usd(winTotal)}</strong>
                </span>
              </div>
              <InlineBid lot={lot} withWatch />
            </article>
          )
        })}
      </div>
    </>
  )
}
