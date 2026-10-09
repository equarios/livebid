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
}: {
  lot: Lot
  showMoq?: boolean
  showGrade?: boolean
}) {
  const { openLot } = useLotPreview()
  const { settings } = useStore()
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
        <span className="item-name">
          {lot.manufacturer} {lot.model}
          {lot.modelNumber ? ` ${lot.modelNumber}` : ''} {lot.capacity}
        </span>
        <span className="muted tiny item-specs">
          <span>{lot.color}</span>
          {showGrade ? <span>Grade {lot.grade}</span> : null}
          <span>{lot.origin || 'INT'}</span>
          <span>
            <BatteryMark value={lot.battery} />
          </span>
          <span>{lot.simLocked ? 'SIM locked' : 'SIM unlocked'}</span>
          <span>{lot.activationLocked ? 'Act locked' : 'Act open'}</span>
          {showMoq ? <span>{moqLabel(lot, settings.copy.noMoq)}</span> : null}
        </span>
      </span>
    </button>
  )
}
