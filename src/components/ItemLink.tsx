import { moqLabel } from '../lib/moq'
import { lotThumb, photoFallback } from '../lib/photos'
import { useStore } from '../store'
import { BatteryMark } from './BatteryMark'
import { useLotPreview } from './LotPreview'
import type { Lot } from '../types'

export function ItemLink({
  lot,
  showMoq = true,
  showGrade = true,
  showLotId = false,
}: {
  lot: Lot
  showMoq?: boolean
  showGrade?: boolean
  showLotId?: boolean
}) {
  const { openLot } = useLotPreview()
  const { settings } = useStore()
  const title = [lot.manufacturer, lot.model, lot.modelNumber].filter(Boolean).join(' ')
  const sub = [lot.capacity, lot.origin || 'INT', lot.color].filter(Boolean).join(' · ')

  return (
    <button type="button" className="item-link item-cell" onClick={() => openLot(lot.id)}>
      <img
        className="item-thumb"
        src={lotThumb(lot)}
        alt=""
        onError={(e) => {
          e.currentTarget.src = photoFallback(lot)
        }}
      />
      <span className="item-copy">
        {showLotId ? <span className="item-lot mono">{lot.id}</span> : null}
        <span className="item-title item-name">{title}</span>
        <span className="item-sub">{sub}</span>
        <span className="item-chips">
          <span className="item-chip">
            <BatteryMark value={lot.battery} />
          </span>
          {showGrade ? <span className="item-chip">Grade {lot.grade}</span> : null}
          <span className={`item-chip${lot.simLocked ? ' lock' : ''}`}>
            {lot.simLocked ? 'SIM locked' : 'SIM unlocked'}
          </span>
          <span className={`item-chip${lot.activationLocked ? ' lock' : ''}`}>
            {lot.activationLocked ? 'Act locked' : 'Act open'}
          </span>
          {showMoq ? <span className="item-chip">{moqLabel(lot, settings.copy.noMoq)}</span> : null}
        </span>
      </span>
    </button>
  )
}
