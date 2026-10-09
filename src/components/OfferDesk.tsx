import { ItemLink } from './ItemLink'
import { formatDateTime, usd } from '../lib/format'
import { useStore } from '../store'
import type { MarketOffer } from '../types'

function statusLabel(status: MarketOffer['status']) {
  if (status === 'pending') return 'Pending review'
  if (status === 'accepted') return 'Accepted — confirm'
  if (status === 'confirmed') return 'Invoiced'
  if (status === 'declined') return 'Declined'
  return 'Cancelled'
}

export function OfferDesk({ staff }: { staff?: boolean }) {
  const { offers, lots, accounts, user, settings, reviewOffer, confirmOffer, cancelOffer } = useStore()
  const rows = (offers || [])
    .filter((o) => (staff ? true : o.accountId === user?.accountId))
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)

  if (!rows.length) {
    return <p className="muted">{staff ? 'No marketplace offers yet.' : 'No offers yet. Send a price from a listing.'}</p>
  }

  const actionButtons = (offer: MarketOffer) => (
    <div className="row-actions">
      {staff && offer.status === 'pending' ? (
        <>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void reviewOffer(offer.id, 'accepted')}
          >
            {settings.copy.btnAccept}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void reviewOffer(offer.id, 'declined')}
          >
            {settings.copy.btnDecline}
          </button>
        </>
      ) : null}
      {!staff && offer.status === 'accepted' ? (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void confirmOffer(offer.id)}
        >
          {settings.copy.btnConfirm}
        </button>
      ) : null}
      {(offer.status === 'pending' || offer.status === 'accepted') &&
      (staff || offer.accountId === user?.accountId) ? (
        <button type="button" className="btn" onClick={() => cancelOffer(offer.id)}>
          {settings.copy.btnCancel}
        </button>
      ) : null}
    </div>
  )

  return (
    <>
    <div className="table-wrap offer-table-wrap">
      <table className="auction-table">
        <thead>
          <tr>
            <th>When</th>
            {staff ? <th>Buyer</th> : null}
            <th>Items</th>
            <th>Quantity</th>
            <th>Offer Price</th>
            <th>Current Price</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((offer) => {
            const lot = lots.find((l) => l.id === offer.lotId)
            const buyer = accounts.find((a) => a.accountId === offer.accountId)
            return (
              <tr key={offer.id}>
                <td className="mono">{formatDateTime(offer.createdAt)}</td>
                {staff ? <td>{buyer?.company || offer.accountId}</td> : null}
                <td className="item-col">
                  {lot ? <ItemLink lot={lot} showMoq={false} showGrade={false} showLotId /> : offer.lotId}
                </td>
                <td className="lot-qty">{offer.qty}</td>
                <td className="price-cell">{usd(offer.unitPrice)}</td>
                <td className="price-cell">{usd(offer.listedPrice)}</td>
                <td>
                  <span className={`pill pill-${offer.status === 'accepted' ? 'live' : offer.status === 'confirmed' ? 'win' : offer.status === 'pending' ? 'hybrid' : 'sealed'}`}>
                    {statusLabel(offer.status)}
                  </span>
                </td>
                <td className="cart-actions-col">{actionButtons(offer)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    <div className="auction-cards offer-cards">
      {rows.map((offer) => {
        const lot = lots.find((l) => l.id === offer.lotId)
        const buyer = accounts.find((a) => a.accountId === offer.accountId)
        return (
          <article key={offer.id} className="auction-card">
            {lot ? (
              <ItemLink lot={lot} showMoq={false} showGrade={false} showLotId />
            ) : (
              <strong>{offer.lotId}</strong>
            )}
            {staff ? <div className="muted tiny">{buyer?.company || offer.accountId}</div> : null}
            <div className="auction-card-meta">
              <span>{offer.qty} pcs</span>
              <span>Offer {usd(offer.unitPrice)}</span>
              <span>List {usd(offer.listedPrice)}</span>
            </div>
            <span className={`pill pill-${offer.status === 'accepted' ? 'live' : offer.status === 'confirmed' ? 'win' : offer.status === 'pending' ? 'hybrid' : 'sealed'}`}>
              {statusLabel(offer.status)}
            </span>
            {actionButtons(offer)}
          </article>
        )
      })}
    </div>
    </>
  )
}
