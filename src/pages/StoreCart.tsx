import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { api, type StoreProductDto } from '../lib/api'
import { usd } from '../lib/format'
import { storeProductFallback, storeProductImage } from '../lib/storePhotos'
import {
  clearStoreCart,
  readStoreCart,
  setStoreCartQty,
  storeCartCount,
  type StoreCartLine,
} from '../lib/storeCart'
import { useStore } from '../store'

type PayMethod = 'card' | 'paypal' | 'bank'

export function StoreCart() {
  const { settings, user } = useStore()
  const navigate = useNavigate()
  const [lines, setLines] = useState<StoreCartLine[]>(() => readStoreCart())
  const [products, setProducts] = useState<StoreProductDto[]>([])
  const [email, setEmail] = useState(user?.email || '')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [pay, setPay] = useState<PayMethod>('card')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => setLines(readStoreCart())
    window.addEventListener('livebid-store-cart', sync)
    return () => window.removeEventListener('livebid-store-cart', sync)
  }, [])

  useEffect(() => {
    void api
      .storeProducts()
      .then((res) => setProducts(res.products))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email)
  }, [user, email])

  const rows = useMemo(() => {
    return lines
      .map((l) => {
        const p = products.find((x) => x.id === l.productId)
        return p ? { line: l, product: p } : null
      })
      .filter(Boolean) as Array<{ line: StoreCartLine; product: StoreProductDto }>
  }, [lines, products])

  const cartN = storeCartCount()
  const subtotal = rows.reduce((n, r) => n + r.product.price * r.line.qty, 0)
  const shipping = subtotal >= 200 || subtotal === 0 ? 0 : 9.9
  const total = Math.round((subtotal + shipping) * 100) / 100

  async function checkout(e: FormEvent) {
    e.preventDefault()
    if (!rows.length) {
      setErr('Cart is empty.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const res = await api.placeStoreOrder({
        email: email.trim(),
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim(),
        note: note.trim() || undefined,
        paymentMethod: pay,
        lines: rows.map((r) => ({ productId: r.product.id, qty: r.line.qty })),
      })
      clearStoreCart()
      navigate(`/store/orders?placed=${encodeURIComponent(res.order.id)}`)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Checkout failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!settings.showStore) {
    return (
      <PublicShell mode="consumer">
        <p className="muted" style={{ padding: 24 }}>
          Retail store is turned off.
        </p>
      </PublicShell>
    )
  }

  const storeName = settings.storeLabel || 'Store'

  return (
    <PublicShell mode="consumer">
      <div className="retail-store retail-cart">
        <div className="store-command-bar" aria-label="Cart">
          <div className="store-command">
            <h2>
              Cart
              <em>{cartN}</em>
            </h2>
            <Link to="/" className="store-command-link is-orders">
              ← {storeName}
            </Link>
            <Link to="/store/orders" className="store-command-link is-orders">
              Orders
            </Link>
          </div>
        </div>

        {!rows.length ? (
          <div className="store-cart-empty">
            <p className="muted">Your cart is empty.</p>
            <Link to="/" className="btn btn-primary btn-sm">
              Shop collection
            </Link>
          </div>
        ) : (
          <div className="retail-checkout-grid">
            <div className="store-cart-lines">
              {rows.map(({ line, product }) => {
                const img = storeProductImage(product, 160)
                return (
                  <article key={product.id} className="store-cart-line">
                    <Link to={`/store/p/${product.slug}`} className="store-cart-thumb">
                      <img
                        src={img}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.onerror = null
                          e.currentTarget.src = storeProductFallback(product)
                        }}
                      />
                    </Link>
                    <div className="store-cart-line-body">
                      <Link to={`/store/p/${product.slug}`} className="store-cart-title">
                        {product.title}
                      </Link>
                      <p className="muted tiny">
                        {usd(product.price)} / unit · {product.category}
                      </p>
                      <div className="store-cart-line-actions">
                        <label className="store-cart-qty">
                          <span className="sr-only">Qty</span>
                          <input
                            className="retail-qty"
                            type="number"
                            min={1}
                            max={product.stock}
                            value={line.qty}
                            onChange={(e) =>
                              setStoreCartQty(product.id, Number(e.target.value) || 0)
                            }
                          />
                        </label>
                        <strong className="store-cart-line-total">
                          {usd(product.price * line.qty)}
                        </strong>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setStoreCartQty(product.id, 0)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}

              <div className="retail-totals">
                <div>
                  <span>Subtotal</span>
                  <strong>{usd(subtotal)}</strong>
                </div>
                <div>
                  <span>Shipping{subtotal >= 200 ? ' (free over $200)' : ''}</span>
                  <strong>{usd(shipping)}</strong>
                </div>
                <div className="is-grand">
                  <span>Total</span>
                  <strong>{usd(total)}</strong>
                </div>
              </div>
            </div>

            <form className="retail-checkout" onSubmit={(e) => void checkout(e)}>
              <h2>Ship to</h2>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Full name</span>
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="field">
                <span>Address</span>
                <textarea
                  required
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Phone (optional)</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="field">
                <span>Note (optional)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} />
              </label>

              <h2>Payment</h2>
              <div className="retail-pay-options">
                {(
                  [
                    ['card', 'Card'],
                    ['paypal', 'PayPal'],
                    ['bank', 'Bank transfer'],
                  ] as const
                ).map(([id, label]) => (
                  <label key={id} className={pay === id ? 'on' : undefined}>
                    <input
                      type="radio"
                      name="pay"
                      checked={pay === id}
                      onChange={() => setPay(id)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p className="muted tiny store-pay-hint">Demo checkout — live keys later.</p>

              {err ? <p className="tiny imei-err">{err}</p> : null}
              <button type="submit" className="btn btn-primary store-checkout-btn" disabled={busy}>
                {busy
                  ? 'Placing…'
                  : pay === 'bank'
                    ? `Place order · ${usd(total)}`
                    : `Pay ${usd(total)}`}
              </button>
            </form>
          </div>
        )}
      </div>
    </PublicShell>
  )
}
