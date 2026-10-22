import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { AskAboutItem } from './AskAboutItem'
import { LotPhotos } from './LotPhotos'
import { ModalShell } from './ModalShell'
import { PastPriceComps } from './PastPriceComps'
import { isSealedLot, originLabel, typePillClass } from '../lib/auctionLists'
import { lotTypeLabel, usd } from '../lib/format'
import { lotItemSub, lotItemTitle } from '../lib/itemLine'
import { lotPhotos, photoFallback } from '../lib/photos'
import { BatteryMark } from './BatteryMark'
import { StoreConditionBadges } from './StoreConditionBadges'
import { moqLabel } from '../lib/moq'
import { useNow, useStore } from '../store'
import { TimeLeft } from './TimeLeft'
import { CopyId } from './CopyId'
import { pushRecentLot } from '../lib/recent'
import type { Lot } from '../types'

const LotPreviewContext = createContext<{ openLot: (id: string) => void } | null>(null)

export function useLotPreview() {
  const ctx = useContext(LotPreviewContext)
  if (!ctx) throw new Error('useLotPreview must be used inside LotPreviewProvider')
  return ctx
}

export function LotPreviewProvider({ children }: { children: ReactNode }) {
  const [lotId, setLotId] = useState<string | null>(null)
  return (
    <LotPreviewContext.Provider value={{ openLot: setLotId }}>
      {children}
      {lotId ? <LotDetailDialog lotId={lotId} onClose={() => setLotId(null)} /> : null}
    </LotPreviewContext.Provider>
  )
}

function LotDetailDialog({ lotId, onClose }: { lotId: string; onClose: () => void }) {
  const now = useNow()
  const { lots, settings } = useStore()
  const lot = lots.find((l) => l.id === lotId)
  useEffect(() => {
    pushRecentLot(lotId)
  }, [lotId])

  if (!lot) {
    return (
      <ModalShell onClose={onClose}>
        <div className="modal card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <p>Listing is gone (sold or closed).</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell onClose={onClose} className="lot-backdrop">
      <div
        className="modal card lot-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lot-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lot-modal-head">
          <div>
            <span className={`pill pill-${typePillClass(lot, settings)}`}>
              {lotTypeLabel(lot, settings)}
            </span>
            <h2 id="lot-preview-title">{lotItemTitle(lot)}</h2>
            <p className="muted item-specs">{lotItemSub(lot)}</p>
            <p className="muted">
              <CopyId value={lot.id} /> ·{' '}
              {lot.channel === 'auction' && isSealedLot(lot, settings) && lot.endsAt > now
                ? `${usd(lot.startPrice)} start`
                : `${usd(lot.buyNowPrice ?? lot.currentPrice)} / pc`}
              {lot.channel === 'auction' ? (
                <>
                  {' · '}
                  <TimeLeft endsAt={lot.endsAt} />
                </>
              ) : (
                ''
              )}
            </p>
            <PastPriceComps lotId={lot.id} />
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <LotPhotos lot={lot} />
        <dl className="specs">
          <div>
            <dt>Model #</dt>
            <dd>{lot.modelNumber || '—'}</dd>
          </div>
          <div>
            <dt>Color</dt>
            <dd>{lot.color}</dd>
          </div>
          <div>
            <dt>Grade</dt>
            <dd>Grade {lot.grade}</dd>
          </div>
          <div>
            <dt>Origin</dt>
            <dd>{originLabel(lot.origin)}</dd>
          </div>
          <div>
            <dt>Battery</dt>
            <dd>
              <BatteryMark value={lot.battery} size={22} />
            </dd>
          </div>
          <div>
            <dt>Quantity</dt>
            <dd>{lot.qty.toLocaleString()}</dd>
          </div>
          <div>
            <dt>MOQ</dt>
            <dd>{moqLabel(lot, settings.copy.noMoq)}</dd>
          </div>
        </dl>
        <h3 className="detail-notes-title">Condition & locks</h3>
        <StoreConditionBadges product={lot} variant="detail" />
        <h3 className="detail-notes-title">Condition notes</h3>
        <p>{lot.description}</p>
        <div className="lot-modal-ask" style={{ marginTop: 12 }}>
          <AskAboutItem
            channel={lot.channel === 'marketplace' ? 'marketplace' : 'auction'}
            itemId={lot.id}
            itemTitle={lotItemTitle(lot)}
            itemHref={lot.channel === 'marketplace' ? '/marketplace' : '/'}
          />
        </div>
        <SimilarLots lot={lot} />
      </div>
    </ModalShell>
  )
}

function SimilarLots({ lot }: { lot: Lot }) {
  const now = useNow()
  const { lots, settings } = useStore()
  const { openLot } = useLotPreview()
  const similar = lots
    .filter(
      (l) =>
        l.id !== lot.id &&
        (l.manufacturer === lot.manufacturer || l.model === lot.model) &&
        (l.channel === 'marketplace' || l.endsAt > now),
    )
    .slice(0, 4)
  if (!similar.length) return null
  return (
    <div className="similar-lots store-similar-preview">
      <h3 className="detail-notes-title">Similar listings</h3>
      <div className="store-similar-tiles" role="list">
        {similar.map((row) => {
          const sealed = row.channel === 'auction' && isSealedLot(row, settings) && row.endsAt > now
          const price = sealed ? row.startPrice : (row.buyNowPrice ?? row.currentPrice)
          const sub = lotItemSub(row)
          return (
            <button
              key={row.id}
              type="button"
              className="store-similar-tile"
              role="listitem"
              onClick={() => openLot(row.id)}
            >
              <img
                src={lotPhotos(row)[0]}
                alt=""
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = photoFallback(row)
                }}
              />
              <span className="store-similar-tile-name">{lotItemTitle(row)}</span>
              {sub ? <span className="store-similar-tile-sub muted">{sub}</span> : null}
              <span className="store-similar-tile-price">{usd(price)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
