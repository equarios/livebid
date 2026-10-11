import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CartDesk } from '../components/CartDesk'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InvoicePreview } from '../components/InvoicePreview'
import { ItemLink } from '../components/ItemLink'
import { OfferDesk } from '../components/OfferDesk'
import { downloadCsv } from '../lib/csv'
import { formatDateTime, usd, usdAmt, usdCents } from '../lib/format'
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
    <div className="market-history-page mypage-listings">
      <section id="cart" className="mh-desk">
        <header className="mh-desk-head">
          <h2>
            {settings.copy.cartTitle}
            <em>{cartRows.length}</em>
          </h2>
          <p className="mh-desk-note">Buy at list price on Marketplace, then send for review.</p>
          {cartRows.length ? (
            <div className="mh-desk-actions">
              <div className="mh-desk-sum">
                <strong>Est. {usdCents(cartQuote.total)}</strong>
                {cartQuote.feePct > 0 ? (
                  <span className="muted tiny">
                    Goods {usdCents(cartQuote.goods)} · Fee {cartQuote.feePct}%
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setCheckoutOpen(true)}
              >
                {settings.copy.btnCheckout}
              </button>
            </div>
          ) : null}
        </header>

        <div className="mh-table-wrap">
          <table className="gbs-table mh-table">
            <thead>
              <tr>
                <th>Items</th>
                <th>Quantity</th>
                <th>Current Price</th>
                <th>Total amount</th>
                <th />
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
                  <td className="price-cell">
                    <strong>{usd(quote.goods)}</strong>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => removeFromCart(item.lotId)}
                    >
                      {settings.copy.btnRemove}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!cartRows.length ? (
            <div className="mh-empty">
              <p>{settings.copy.emptyCart}</p>
              <Link to="/marketplace" className="btn btn-sm">
                Open Marketplace
              </Link>
            </div>
          ) : null}
        </div>
        {notice ? <p className={notice.ok ? 'ok' : 'error'}>{notice.text}</p> : null}

        <header className="mh-desk-head is-sub">
          <h2>
            Checkout requests
            <em className={openCartOrders ? 'is-open' : undefined}>{openCartOrders}</em>
          </h2>
          <p className="mh-desk-note">Awaiting staff review, then your confirm.</p>
        </header>
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
              <dd>{usdCents(cartQuote.goods)}</dd>
            </div>
            {cartQuote.feePct > 0 ? (
              <div>
                <dt>Fee {cartQuote.feePct}%</dt>
                <dd>{usdCents(cartQuote.fee)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Est. total</dt>
              <dd>{usdCents(cartQuote.total)}</dd>
            </div>
          </div>
        </ConfirmDialog>
      ) : null}

      <section id="offers" className="mh-desk">
        <header className="mh-desk-head">
          <h2>
            Offers
            <em className={myOffers ? 'is-open' : undefined}>{myOffers}</em>
          </h2>
          <p className="mh-desk-note">Your prices on listings — staff accept, then you confirm.</p>
        </header>
        <OfferDesk staff={isStaff} />
      </section>

      <section id="orders" className="mh-desk">
        <header className="mh-desk-head">
          <h2>
            Orders
            <em>{rows.length}</em>
          </h2>
          <p className="mh-desk-note">Invoiced marketplace buys and confirmed offers.</p>
          <div className="mh-desk-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv}>
              Export CSV
            </button>
          </div>
        </header>
        <div className="mh-table-wrap">
          <table className="gbs-table mh-table market-history-table">
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
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => setPreviewId(inv.id)}
                        >
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
          {!rows.length ? (
            <div className="mh-empty">
              <p>No marketplace orders yet.</p>
              <Link to="/marketplace" className="btn btn-sm">
                Open Marketplace
              </Link>
            </div>
          ) : null}
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
