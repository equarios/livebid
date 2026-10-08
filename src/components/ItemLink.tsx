import { specLocks } from '../lib/format'
import { moqLabel } from '../lib/moq'
import { lotThumb, photoFallback } from '../lib/photos'
import { useStore } from '../store'
import { BatteryMark } from './BatteryMark'
import { useLotPreview } from './LotPreview'
import type { Lot } from '../types'

export function ItemLink({ lot }: { lot: Lot }) {
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
      <span>
        <span className="item-name">
          {lot.manufacturer} {lot.model}
          {lot.modelNumber ? ` ${lot.modelNumber}` : ''} {lot.capacity}
        </span>
        <span className="muted tiny item-specs">
          {lot.color} · Grade {lot.grade} · {lot.origin || 'INT'} · <BatteryMark value={lot.battery} /> · {specLocks(lot)} ·{' '}
          {moqLabel(lot, settings.copy.noMoq)}
        </span>
      </span>
    </button>
  )
}
