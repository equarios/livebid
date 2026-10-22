import { lotItemSub, lotItemTitle } from '../lib/itemLine'
import { moqLabel } from '../lib/moq'
import { lotThumb, photoFallback } from '../lib/photos'
import { useStore } from '../store'
import { BatteryMark } from './BatteryMark'
import { StoreConditionBadges } from './StoreConditionBadges'
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
  const title = lotItemTitle(lot)
  const sub = lotItemSub(lot)

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
        <span className="item-details-cue">Details</span>
        <span className="item-chips">
          <span className="item-chip">
            <BatteryMark value={lot.battery} />
          </span>
          {showGrade ? <span className="item-chip">Grade {lot.grade}</span> : null}
          {showMoq ? <span className="item-chip">{moqLabel(lot, settings.copy.noMoq)}</span> : null}
        </span>
        <StoreConditionBadges product={lot} />
      </span>
    </button>
  )
}
