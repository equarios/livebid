import { Link } from 'react-router-dom'
import { timeLeft, typeLabel, usd } from '../lib/format'
import type { Lot } from '../types'
import { useStore } from '../store'

export function LotCard({ lot }: { lot: Lot }) {
  const { now, myBid, watchlist, toggleWatch, addToCart } = useStore()
  const mine = myBid(lot.id)
  const watching = watchlist.includes(lot.id)
  const closed = lot.endsAt <= now
  const winning =
    lot.auctionType === 'sealed'
      ? null
      : mine != null && mine >= lot.currentPrice
        ? true
        : mine != null
          ? false
          : null

  return (
    <article className="card lot-card">
      <div className="device" style={{ background: lot.accent }}>
        <div className="device-screen">
          <span>{lot.manufacturer}</span>
          <strong>{lot.model}</strong>
        </div>
        <span className={`grade grade-${lot.grade}`}>Grade {lot.grade}</span>
      </div>
      <div className="lot-body">
        <div className="lot-meta">
          <span className={`pill pill-${lot.auctionType || 'market'}`}>
            {lot.channel === 'marketplace'
              ? typeLabel.marketplace
              : typeLabel[lot.auctionType || 'live']}
          </span>
          <span className="muted">{lot.id}</span>
        </div>
        <h3>
          {lot.model} {lot.capacity}
        </h3>
        <p className="muted">
          {lot.color} · Batt {lot.battery}% · Total pcs {lot.qty}
        </p>
        <div className="lot-price-row">
          <div>
            <div className="label">
              {lot.channel === 'marketplace' ? 'Buy now' : 'Current'}
            </div>
            <div className="price">
              {usd(lot.buyNowPrice ?? lot.currentPrice)}
              {lot.qty > 1 ? <small> / unit</small> : null}
            </div>
          </div>
          <div className="right">
            {lot.channel === 'auction' ? (
              <>
                <div className="label">{closed ? 'Closed' : 'Ends in'}</div>
                <div className={`countdown ${closed ? 'closed' : ''}`}>
                  {closed ? '00:00:00' : timeLeft(lot.endsAt, now)}
                </div>
              </>
            ) : (
              <>
                <div className="label">Stock</div>
                <div>{lot.qty} units</div>
              </>
            )}
          </div>
        </div>
        {lot.channel === 'auction' && lot.auctionType !== 'sealed' && winning != null && (
          <div className={`status ${winning ? 'win' : 'lose'}`}>
            {winning ? 'Winning' : 'Outbid'}
          </div>
        )}
        {lot.channel === 'auction' && lot.auctionType === 'sealed' && mine != null && (
          <div className="status sealed">Your bid submitted</div>
        )}
        <div className="lot-actions">
          {lot.channel === 'marketplace' ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => addToCart(lot.id, 1)}
            >
              Add to cart
            </button>
          ) : (
            <Link className="btn btn-primary" to="/auctions">
              Bid
            </Link>
          )}
          <button
            type="button"
            className={`btn btn-ghost ${watching ? 'on' : ''}`}
            onClick={() => toggleWatch(lot.id)}
          >
            {watching ? 'Watching' : 'Watch'}
          </button>
        </div>
      </div>
    </article>
  )
}
