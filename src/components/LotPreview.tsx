import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { LotPhotos } from './LotPhotos'
import { ModalShell } from './ModalShell'
import { isSealedLot, typePillClass } from '../lib/auctionLists'
import { lotTypeLabel, specLocks, usd } from '../lib/format'
import { BatteryMark } from './BatteryMark'
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
            <h2 id="lot-preview-title">
              {lot.manufacturer} {lot.model}
              {lot.modelNumber ? ` ${lot.modelNumber}` : ''} {lot.capacity}
            </h2>
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
            <dd>{lot.origin || 'INT'}</dd>
          </div>
          <div>
            <dt>Battery</dt>
            <dd>
              <BatteryMark value={lot.battery} size={22} />
            </dd>
          </div>
          <div>
            <dt>SIM</dt>
            <dd>{lot.simLocked ? 'Locked' : 'Unlocked'}</dd>
          </div>
          <div>
            <dt>Activation</dt>
            <dd>{lot.activationLocked ? 'Locked' : 'Open'}</dd>
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
        <p className="muted tiny item-specs">
          Grade {lot.grade} · <BatteryMark value={lot.battery} /> · {specLocks(lot)}
        </p>
        <h3 className="detail-notes-title">Condition notes</h3>
        <p>{lot.description}</p>
        <SimilarLots lot={lot} />
      </div>
    </ModalShell>
  )
}

function SimilarLots({ lot }: { lot: Lot }) {
  const now = useNow()
  const { lots } = useStore()
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
    <div className="similar-lots">
      <h3 className="detail-notes-title">Similar listings</h3>
      <div className="similar-row">
        {similar.map((row) => (
          <button key={row.id} type="button" className="similar-chip" onClick={() => openLot(row.id)}>
            {row.manufacturer} {row.model} {row.capacity} · Grade {row.grade}
          </button>
        ))}
      </div>
    </div>
  )
}
