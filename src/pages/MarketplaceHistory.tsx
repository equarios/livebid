import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CartDesk } from '../components/CartDesk'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InvoicePreview } from '../components/InvoicePreview'
import { ItemLink } from '../components/ItemLink'
import { OfferDesk } from '../components/OfferDesk'
import { downloadCsv } from '../lib/csv'
import { formatDateTime, usd, usdAmt } from '../lib/format'
import {
  catalogFeePct,
  invoicePill,
  invoiceStatusLabel,
  invoiceTotals,
  invoiceVisibleToBuyer,
  quoteMoney,
} from '../lib/invoices'
import { useStore } from '../store'

export function MarketplaceHistory() {
  const { hash } = useLocation()
  const {
    invoices,
    lots,
    user,
    isStaff,
    settings,
    cart,
    cartOrders,
    removeFromCart,
    checkoutCart,
    offers,
  } = useStore()
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  useEffect(() => {
    if (!hash) return
    const id = hash.replace(/^#/, '')
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash, cart.length, cartOrders.length])

  const marketFeePct = catalogFeePct('marketplace', undefined, settings)
  const cartRows = cart
    .map((item) => {
      const lot = lots.find((l) => l.id === item.lotId)
      if (!lot || !lot.buyNowPrice) return null
      const goods = lot.buyNowPrice * item.qty
      return { item, lot, goods, quote: quoteMoney(item.qty, lot.buyNowPrice, marketFeePct) }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
  const cartGoods = cartRows.reduce((sum, row) => sum + row.goods, 0)
  const cartQuote = quoteMoney(1, cartGoods, marketFeePct)

  const openCartOrders = (cartOrders || []).filter(
    (o) =>
      o.accountId === user?.accountId &&
      (o.status === 'pending' || o.status === 'accepted'),
  ).length

  const myOffers = (offers || []).filter(
    (o) =>
      o.accountId === user?.accountId &&
      (o.status === 'pending' || o.status === 'accepted'),
  ).length

  const rows = invoices.filter((inv) => {
    if (inv.channel !== 'marketplace') return false
    if (!isStaff && !invoiceVisibleToBuyer(inv)) return false
    if (isStaff) return true
    return !inv.accountId || inv.accountId === user?.accountId
  })

  function exportCsv() {
    downloadCsv(
      'marketplace-history.csv',
      ['Date', 'Invoice', 'Items', 'Quantity', 'Current Price', 'Total', 'Status'],
      rows.map((inv) => {
        const lot = lots.find((l) => l.id === inv.lotId)
        return [
          formatDateTime(inv.createdAt),
          inv.id,
          lot ? `${lot.manufacturer} ${lot.model}` : inv.lotId,
          inv.qty,
          inv.unitPrice,
          invoiceTotals(inv, settings).total,
          invoiceStatusLabel(inv.status),
        ]
      }),
    )
  }

  function submitCheckout() {
    setCheckoutOpen(false)
    void checkoutCart().then((err) => {
      if (err) {
        setNotice({ ok: false, text: err })
        return
      }
      setNotice({
        ok: true,
        text: 'Cart sent for admin review. You will confirm after they accept.',
      })
    })
  }

  return (
    <div className="market-history-page">
      <section id="cart" className="cart-panel card">
        <div className="cart-panel-head">
          <h2>
            {settings.copy.cartTitle}
            {cartRows.length ? <em>{cartRows.length}</em> : null}
          </h2>
        </div>
        <p className="muted tiny">
          Add items on Marketplace, then send for admin availability review. After accept, confirm to
          create an invoice.
        </p>
        {!cartRows.length ? (
          <p className="muted">{settings.copy.emptyCart}</p>
        ) : (
          <>
            <div className="table-wrap cart-table-wrap">
              <table className="auction-table">
                <thead>
                  <tr>
                    <th>Items</th>
                    <th>Quantity</th>
                    <th>Current Price</th>
                    <th>Total amount</th>
                  </tr>
                </thead>
                <tbody>
                  {cartRows.map(({ item, lot, quote }) => (
                    <tr key={item.lotId}>
                      <td className="item-col">
                        <ItemLink lot={lot} showMoq={false} showGrade={false} showLotId />
                      </td>
                      <td className="lot-qty">{item.qty}</td>
                      <td className="price-cell">{usd(lot.buyNowPrice ?? 0)}</td>
                      <td className="price-cell cart-total-cell">
                        <div className="cart-total-actions">
                          <strong>{usd(quote.goods)}</strong>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => removeFromCart(item.lotId)}
                          >
                            {settings.copy.btnRemove}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="auction-cards cart-cards">
              {cartRows.map(({ item, lot, quote }) => (
                <article key={item.lotId} className="auction-card">
                  <ItemLink lot={lot} showMoq={false} showGrade={false} showLotId />
                  <div className="auction-card-meta">
                    <span className={`grade-inline grade-${lot.grade}`}>{lot.grade}</span>
                    <span className="lot-qty">{item.qty} pcs</span>
                    <span>{usd(lot.buyNowPrice ?? 0)} / pc</span>
                    <span>
                      Goods <strong>{usd(quote.goods)}</strong>
                    </span>
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => removeFromCart(item.lotId)}
                    >
                      {settings.copy.btnRemove}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="cart-foot">
              <div className="cart-foot-sum">
                <strong>Est. total {usd(cartQuote.total)}</strong>
                {cartQuote.feePct > 0 ? (
                  <span className="muted tiny">
                    Goods {usd(cartQuote.goods)} · Fee {cartQuote.feePct}% {usd(cartQuote.fee)}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCheckoutOpen(true)}
              >
                {settings.copy.btnCheckout}
              </button>
            </div>
          </>
        )}
        {notice ? <p className={notice.ok ? 'ok' : 'error'}>{notice.text}</p> : null}

        <div className="cart-panel-head market-history-head" style={{ marginTop: 14 }}>
          <h2>
            Checkout requests
            {openCartOrders ? <em className="is-open">{openCartOrders}</em> : null}
          </h2>
        </div>
        <CartDesk staff={isStaff} />
      </section>

      {checkoutOpen ? (
        <ConfirmDialog
          title={settings.copy.confirmCheckoutTitle}
          body={settings.copy.confirmCheckoutBody}
          onCancel={() => setCheckoutOpen(false)}
          onConfirm={submitCheckout}
        >
          <div className="confirm-summary">
            <div>
              <dt>Lines</dt>
              <dd>{cartRows.length}</dd>
            </div>
            <div>
              <dt>Quantity</dt>
              <dd>{cartRows.reduce((n, r) => n + r.item.qty, 0).toLocaleString()} pcs</dd>
            </div>
            <div>
              <dt>Goods</dt>
              <dd>{usd(cartQuote.goods)}</dd>
            </div>
            {cartQuote.feePct > 0 ? (
              <div>
                <dt>Fee {cartQuote.feePct}%</dt>
                <dd>{usd(cartQuote.fee)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Est. total</dt>
              <dd>{usd(cartQuote.total)}</dd>
            </div>
          </div>
        </ConfirmDialog>
      ) : null}

      <section id="offers" className="cart-panel card">
        <div className="cart-panel-head">
          <h2>
            Offers
            {myOffers ? <em className="is-open">{myOffers}</em> : null}
          </h2>
        </div>
        <OfferDesk staff={isStaff} />
      </section>

      <section id="orders" className="cart-panel card">
        <div className="cart-panel-head market-history-head">
          <h2>
            Orders
            <em>{rows.length}</em>
          </h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
        <div className="table-wrap gbs-table-wrap">
          <table className="gbs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Items</th>
                <th>Quantity</th>
                <th>Current Price</th>
                <th>Total</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const lot = lots.find((l) => l.id === inv.lotId)
                return (
                  <tr key={inv.id}>
                    <td className="mono">{formatDateTime(inv.createdAt)}</td>
                    <td>{inv.id}</td>
                    <td>{lot ? <ItemLink lot={lot} /> : inv.lotId}</td>
                    <td>{inv.qty}</td>
                    <td>{usdAmt(inv.unitPrice)}</td>
                    <td>{usdAmt(invoiceTotals(inv, settings).total)}</td>
                    <td>
                      <span className={`pill ${invoicePill(inv.status)}`}>
                        {invoiceStatusLabel(inv.status)}
                      </span>
                    </td>
                    <td>
                      {invoiceVisibleToBuyer(inv) ? (
                        <button type="button" className="linkish" onClick={() => setPreviewId(inv.id)}>
                          View invoice
                        </button>
                      ) : (
                        <span className="muted tiny">Awaiting issue</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!rows.length ? <p className="empty">No marketplace orders yet.</p> : null}
        </div>
        <div className="inv-cards">
          {rows.map((inv) => {
            const lot = lots.find((l) => l.id === inv.lotId)
            return (
              <article key={inv.id} className="inv-card">
                {lot ? <ItemLink lot={lot} /> : <strong>{inv.lotId}</strong>}
                <div className="muted tiny">
                  {inv.id} · {formatDateTime(inv.createdAt)}
                </div>
                <div className="inv-card-meta">
                  <span>{inv.qty} pcs</span>
                  <span>{usdAmt(inv.unitPrice)} / pc</span>
                  <span>{usdAmt(invoiceTotals(inv, settings).total)}</span>
                </div>
                <span className={`pill ${invoicePill(inv.status)}`}>{invoiceStatusLabel(inv.status)}</span>
                {invoiceVisibleToBuyer(inv) ? (
                  <button type="button" className="linkish" onClick={() => setPreviewId(inv.id)}>
                    View invoice
                  </button>
                ) : null}
              </article>
            )
          })}
        </div>
      </section>

      {previewId && invoices.some((i) => i.id === previewId) ? (
        <InvoicePreview
          invoice={invoices.find((i) => i.id === previewId)!}
          onClose={() => setPreviewId(null)}
        />
      ) : null}
    </div>
  )
}
