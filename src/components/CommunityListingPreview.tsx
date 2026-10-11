import { ModalShell } from './ModalShell'
import { moneyUsd } from '../lib/format'
import type { CommunityListingDto } from '../lib/api'

type Props = {
  listing: CommunityListingDto
  onClose: () => void
  onInterest?: (listing: CommunityListingDto) => void
}

function priceLabel(listing: CommunityListingDto) {
  if (listing.price == null) return 'Ask / offer'
  return `${moneyUsd(listing.price, listing.currency)} / pc`
}

/** Board row detail — skim specs, then Interest without leaving the desk. */
export function CommunityListingPreview({ listing, onClose, onInterest }: Props) {
  const canInterest = listing.status === 'live' && !listing.mine && onInterest

  return (
    <ModalShell onClose={onClose} className="lot-backdrop">
      <div
        className="modal card lot-modal cm-listing-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cm-listing-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lot-modal-head">
          <div>
            <span className="pill pill-hybrid">Community</span>
            {listing.featured ? <span className="cm-feat"> ★ Featured</span> : null}
            <h2 id="cm-listing-title">{listing.title}</h2>
            <p className="muted">
              {priceLabel(listing)} · {listing.qty.toLocaleString('en-US')} pcs · {listing.sellerName}
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="cm-listing-media" aria-hidden>
          {listing.imageUrl ? (
            <img src={listing.imageUrl} alt="" />
          ) : (
            <span>{listing.category.slice(0, 1)}</span>
          )}
        </div>

        <dl className="specs">
          <div>
            <dt>Category</dt>
            <dd>{listing.category}</dd>
          </div>
          {listing.manufacturer ? (
            <div>
              <dt>Brand</dt>
              <dd>{listing.manufacturer}</dd>
            </div>
          ) : null}
          {listing.model ? (
            <div>
              <dt>Model</dt>
              <dd>{listing.model}</dd>
            </div>
          ) : null}
          {listing.capacity ? (
            <div>
              <dt>Capacity</dt>
              <dd>{listing.capacity}</dd>
            </div>
          ) : null}
          {listing.grade ? (
            <div>
              <dt>Grade</dt>
              <dd>{listing.grade}</dd>
            </div>
          ) : null}
          <div>
            <dt>Price</dt>
            <dd>{priceLabel(listing)}</dd>
          </div>
          <div>
            <dt>Qty</dt>
            <dd>{listing.qty.toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`cm-pill status-${listing.status}`}>{listing.status}</span>
            </dd>
          </div>
          {listing.interestCount > 0 ? (
            <div>
              <dt>Interest</dt>
              <dd>{listing.interestCount}</dd>
            </div>
          ) : null}
        </dl>

        <h3 className="detail-notes-title">Notes</h3>
        <p className="cm-listing-desc">
          {listing.description?.trim() || 'No extra notes — inquire for condition and shipping.'}
        </p>

        <div className="cm-listing-actions">
          {canInterest ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClose()
                onInterest(listing)
              }}
            >
              Send interest
            </button>
          ) : null}
          {listing.mine ? <span className="tiny muted">This is your listing.</span> : null}
          {!canInterest && !listing.mine ? (
            <span className="tiny muted">Interest opens when the listing is live.</span>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Back to board
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
