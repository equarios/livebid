import { bidStatus, fillStats } from '../lib/allocate'
import { isSealedLot, typePillClass } from '../lib/auctionLists'
import { ConfirmBidDialog } from './ConfirmBidDialog'
import { fillCopy, lotTypeLabel, usd } from '../lib/format'
import { BatteryMark } from './BatteryMark'
import { lotMoq, moqLabel } from '../lib/moq'
import { lotPhotos, photoFallback } from '../lib/photos'
import { useState } from 'react'
import type { Lot } from '../types'
import { useNow, useStore } from '../store'
import { FavHeart } from './FavHeart'
import { FillBar } from './FillBar'
import { InlineBid } from './InlineBid'
import { useLotPreview } from './LotPreview'
import { EndsIn } from './TimeLeft'

export function LotCard({ lot }: { lot: Lot }) {
  const { openLot } = useLotPreview()
  const now = useNow()
  const { addToCart, placeOffer, bids, user, myLastBid, settings, cart } = useStore()
  const inCart = cart.find((c) => c.lotId === lot.id)?.qty ?? 0
  const left = Math.max(0, lot.qty - inCart)
  const [cartOpen, setCartOpen] = useState(false)
  const [offerOpen, setOfferOpen] = useState(false)
  const [cartMsg, setCartMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const listPrice = lot.buyNowPrice ?? lot.currentPrice
  const offerPrice = Math.max(1, listPrice - 1)
  const last = myLastBid(lot.id)
  const stats = fillStats(lot, bids, user?.accountId)
  const st = bidStatus(lot, stats.myPcs, last?.qty, now, settings)
  const sealedOpen = isSealedLot(lot, settings) && lot.endsAt > now

  return (
    <article className="card lot-card">
      <button type="button" className="lot-photo-link" onClick={() => openLot(lot.id)}>
        <img
          src={lotPhotos(lot, 640)[0]}
          alt={`${lot.manufacturer} ${lot.model}`}
          decoding="async"
          onError={(e) => {
            e.currentTarget.src = photoFallback(lot)
          }}
        />
        <span className={`grade grade-${lot.grade}`}>Grade {lot.grade}</span>
      </button>
      <div className="lot-body">
        <div className="lot-meta">
          <span className={`pill pill-${typePillClass(lot, settings)}`}>
            {lotTypeLabel(lot, settings)}
          </span>
          <span className="muted">{lot.id}</span>
        </div>
        <h3>
          <button type="button" className="item-link" onClick={() => openLot(lot.id)}>
            {lot.model}
            {lot.modelNumber ? ` ${lot.modelNumber}` : ''} {lot.capacity}
          </button>
        </h3>
        <p className="muted item-specs">
          {lot.color} · <BatteryMark value={lot.battery} /> · Total pcs {lot.qty.toLocaleString()}
          {lot.channel === 'marketplace' ? ` · ${left.toLocaleString()} left` : ''} · {moqLabel(lot, settings.copy.noMoq)}
        </p>
        <div className="lot-price-row">
          <div>
            <div className="label">
              {lot.channel === 'marketplace'
                ? 'Buy now'
                : sealedOpen
                  ? 'Start'
                  : 'Current'}
            </div>
            <div className="price">
              {usd(
                lot.buyNowPrice ??
                  (lot.channel === 'auction' && sealedOpen ? lot.startPrice : lot.currentPrice),
              )}
              {lot.qty > 1 ? <small> / unit</small> : null}
            </div>
          </div>
          <div className="right">
            {lot.channel === 'auction' ? (
              <EndsIn endsAt={lot.endsAt} />
            ) : (
              <>
                <div className="label">Stock</div>
                <div>
                  {left.toLocaleString()} left
                  <div className="muted tiny">{lot.qty.toLocaleString()} listed{inCart ? ` · ${inCart} in cart` : ''}</div>
                </div>
              </>
            )}
          </div>
        </div>
        {lot.channel === 'auction' ? (
          <FillBar
            total={lot.qty}
            myPcs={sealedOpen ? last?.qty ?? 0 : stats.myPcs}
            sealed={sealedOpen}
            status={st}
          />
        ) : null}
        {lot.channel === 'auction' ? <InlineBid lot={lot} stacked /> : null}
        <div className="lot-actions">
          {lot.channel === 'marketplace' ? (
            <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!settings.features.cart}
              onClick={() => setCartOpen(true)}
            >
              {settings.copy.btnBuy}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!settings.features.offers}
              onClick={() => setOfferOpen(true)}
            >
              {settings.copy.btnOffer}
            </button>
            </>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => openLot(lot.id)}>
              {settings.copy.btnPhotos}
            </button>
          )}
          {settings.features.favourites ? <FavHeart lotId={lot.id} /> : null}
        </div>
        {cartMsg ? <div className={cartMsg.ok ? 'ok tiny' : 'error tiny'}>{cartMsg.text}</div> : null}
        {cartOpen ? (
          <ConfirmBidDialog
            lot={lot}
            qty={lotMoq(lot)}
            unitPrice={listPrice}
            title={settings.copy.confirmCartTitle}
            body={fillCopy(settings.copy.confirmCartBody, { n: lotMoq(lot) })}
            priceLabel="List price / pc"
            onCancel={() => setCartOpen(false)}
            onConfirm={() => {
              const q = lotMoq(lot)
              const err = addToCart(lot.id, q)
              setCartOpen(false)
              setCartMsg({ ok: !err, text: err ?? fillCopy(settings.copy.okAddedCart, { n: q }) })
            }}
          />
        ) : null}
        {offerOpen ? (
          <ConfirmBidDialog
            lot={lot}
            qty={lotMoq(lot)}
            unitPrice={offerPrice}
            title={settings.copy.confirmOfferTitle}
            body={settings.copy.confirmOfferBody}
            priceLabel="Your offer / pc"
            onCancel={() => setOfferOpen(false)}
            onConfirm={() => {
              const q = lotMoq(lot)
              const err = placeOffer(lot.id, q, offerPrice)
              setOfferOpen(false)
              setCartMsg({ ok: !err, text: err ?? settings.copy.okOffer })
            }}
          />
        ) : null}
      </div>
    </article>
  )
}
