import { useState } from 'react'
import { lotPhotos, photoFallback } from '../lib/photos'
import type { Lot } from '../types'

function handleError(lot: Lot, e: { currentTarget: HTMLImageElement }) {
  e.currentTarget.src = photoFallback(lot)
}

export function LotPhotos({ lot }: { lot: Lot }) {
  const photos = lotPhotos(lot)
  const [active, setActive] = useState(0)

  return (
    <div className="lot-photos">
      <div className="lot-photo-main" style={{ background: lot.accent }}>
        <img
          src={photos[active]}
          alt={`${lot.manufacturer} ${lot.model}`}
          onError={(e) => handleError(lot, e)}
        />
        <span className={`grade grade-${lot.grade}`}>Grade {lot.grade}</span>
      </div>
      <div className="lot-photo-thumbs">
        {photos.map((src, i) => (
          <button
            key={src}
            type="button"
            className={i === active ? 'on' : ''}
            aria-label={`Photo ${i + 1}`}
            onClick={() => setActive(i)}
          >
            <img src={src} alt="" onError={(e) => handleError(lot, e)} />
          </button>
        ))}
      </div>
    </div>
  )
}
