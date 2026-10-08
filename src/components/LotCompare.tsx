import { BatteryMark } from './BatteryMark'
import { TimeLeft } from './TimeLeft'
import { isSealedLot, typePillClass } from '../lib/auctionLists'
import { lotTypeLabel, specLocks, usd } from '../lib/format'
import { moqLabel } from '../lib/moq'
import { useNow, useStore } from '../store'
import type { Lot } from '../types'

export function LotCompare({
  ids,
  onClose,
  onClear,
}: {
  ids: string[]
  onClose: () => void
  onClear: (id: string) => void
}) {
  const { lots, settings } = useStore()
  const now = useNow()
  const rows = ids.map((id) => lots.find((l) => l.id === id)).filter((l): l is Lot => Boolean(l))
  if (rows.length < 2) return null

  return (
    <div className="compare-tray">
      <div className="compare-tray-head">
        <strong>Compare lots</strong>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="compare-grid">
        {rows.map((lot) => (
          <div key={lot.id} className="compare-col">
            <div className="compare-col-head">
              <span className={`pill pill-${typePillClass(lot, settings)}`}>{lotTypeLabel(lot, settings)}</span>
              <button type="button" className="linkish" onClick={() => onClear(lot.id)}>
                Remove
              </button>
            </div>
            <h3>
              {lot.manufacturer} {lot.model} {lot.capacity}
            </h3>
            <p className="muted tiny">{lot.id}</p>
            <dl className="specs">
              <div>
                <dt>Grade</dt>
                <dd>Grade {lot.grade}</dd>
              </div>
              <div>
                <dt>Battery</dt>
                <dd>
                  <BatteryMark value={lot.battery} />
                </dd>
              </div>
              <div>
                <dt>Locks</dt>
                <dd>{specLocks(lot)}</dd>
              </div>
              <div>
                <dt>Pcs / MOQ</dt>
                <dd>
                  {lot.qty.toLocaleString()} · {moqLabel(lot, settings.copy.noMoq)}
                </dd>
              </div>
              <div>
                <dt>
                  {lot.channel === 'auction' && isSealedLot(lot, settings) && lot.endsAt > now
                    ? 'Start / pc'
                    : 'Price / pc'}
                </dt>
                <dd>
                  {usd(
                    lot.buyNowPrice ??
                      (lot.channel === 'auction' &&
                      isSealedLot(lot, settings) &&
                      lot.endsAt > now
                        ? lot.startPrice
                        : lot.currentPrice),
                  )}
                </dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{lot.channel === 'auction' ? <TimeLeft endsAt={lot.endsAt} /> : 'Buy now'}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  )
}
