import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, type StoreOrderDto, type StoreProductDto } from '../lib/api'
import { usd } from '../lib/format'
import { storeProductImage } from '../lib/storePhotos'

const MAX_IMAGES = 8

export function StoreDesk() {
  const [tab, setTab] = useState<'products' | 'orders'>('products')
  const [products, setProducts] = useState<StoreProductDto[]>([])
  const [orders, setOrders] = useState<StoreOrderDto[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('199')
  const [compareAt, setCompareAt] = useState('')
  const [stock, setStock] = useState('10')
  const [category, setCategory] = useState('Phones')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [editId, setEditId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setErr(null)
    try {
      const [p, o] = await Promise.all([api.storeProducts(), api.storeOrders()])
      setProducts(p.products)
      setOrders(o.orders)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load store desk.')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  function resetForm() {
    setTitle('')
    setDescription('')
    setImageUrl('')
    setImages([])
    setEditId(null)
    setPrice('199')
    setCompareAt('')
    setStock('10')
    setCategory('Phones')
  }

  async function onPickFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    const room = MAX_IMAGES - images.length
    if (room <= 0) {
      setErr(`At most ${MAX_IMAGES} photos per product.`)
      return
    }
    const files = Array.from(fileList).slice(0, room)
    setBusy(true)
    setErr(null)
    try {
      const res = await api.uploadStoreImages(files)
      setImages((prev) => [...prev, ...res.urls].slice(0, MAX_IMAGES))
      setMsg(`Uploaded ${res.urls.length} photo${res.urls.length === 1 ? '' : 's'} (auto-resized).`)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  function addUrl() {
    const u = imageUrl.trim()
    if (!u) return
    if (images.includes(u)) {
      setErr('That URL is already in the gallery.')
      return
    }
    if (images.length >= MAX_IMAGES) {
      setErr(`At most ${MAX_IMAGES} photos per product.`)
      return
    }
    setImages((prev) => [...prev, u])
    setImageUrl('')
  }

  function moveImage(from: number, dir: -1 | 1) {
    setImages((prev) => {
      const to = from + dir
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  async function saveProduct(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const body = {
        title: title.trim(),
        price: Number(price),
        compareAt: compareAt.trim() ? Number(compareAt) : null,
        stock: Math.max(0, Math.floor(Number(stock) || 0)),
        category: category.trim() || 'Phones',
        description: description.trim(),
        images,
        imageUrl: images[0] || null,
        active: true,
      }
      if (editId) {
        await api.updateStoreProduct(editId, body)
        setMsg(`Updated “${body.title}”.`)
      } else {
        await api.createStoreProduct(body)
        setMsg(`Listed “${body.title}”.`)
      }
      resetForm()
      await refresh()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(p: StoreProductDto) {
    setEditId(p.id)
    setTitle(p.title)
    setPrice(String(p.price))
    setCompareAt(p.compareAt != null ? String(p.compareAt) : '')
    setStock(String(p.stock))
    setCategory(p.category)
    setDescription(p.description || '')
    setImages(p.images?.length ? [...p.images] : p.imageUrl ? [p.imageUrl] : [])
    setImageUrl('')
    setTab('products')
    setMsg(`Editing “${p.title}”.`)
  }

  async function patchStock(p: StoreProductDto, stockNext: number) {
    setBusy(true)
    try {
      await api.updateStoreProduct(p.id, { stock: stockNext })
      await refresh()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Update failed.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(p: StoreProductDto) {
    setBusy(true)
    try {
      await api.updateStoreProduct(p.id, { active: !p.active })
      await refresh()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Update failed.')
    } finally {
      setBusy(false)
    }
  }

  async function removeProduct(p: StoreProductDto) {
    if (!confirm(`Delete ${p.title}?`)) return
    setBusy(true)
    try {
      await api.deleteStoreProduct(p.id)
      if (editId === p.id) resetForm()
      setMsg(`Deleted ${p.title}.`)
      await refresh()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Delete failed.')
    } finally {
      setBusy(false)
    }
  }

  async function setOrderStatus(o: StoreOrderDto, status: 'paid' | 'shipped' | 'cancelled') {
    setBusy(true)
    try {
      await api.updateStoreOrder(o.id, { status })
      setMsg(`${o.id} → ${status}`)
      await refresh()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Order update failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mh-desk store-desk">
      <header className="mh-desk-head">
        <h2>
          Retail store
          <em>{tab === 'products' ? products.length : orders.length}</em>
        </h2>
        <p className="mh-desk-note">
          Consumer catalog and orders — separate from wholesale. Up to {MAX_IMAGES} photos; server
          compresses to WebP.
        </p>
        <div className="mh-desk-actions">
          <button
            type="button"
            className={`btn btn-ghost btn-sm ${tab === 'products' ? 'on' : ''}`}
            onClick={() => setTab('products')}
          >
            Products
          </button>
          <button
            type="button"
            className={`btn btn-ghost btn-sm ${tab === 'orders' ? 'on' : ''}`}
            onClick={() => setTab('orders')}
          >
            Orders ({orders.length})
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </header>

      {msg ? <p className="tiny imei-msg">{msg}</p> : null}
      {err ? <p className="tiny imei-err">{err}</p> : null}

      {tab === 'products' ? (
        <>
          <form className="imei-upload" onSubmit={(e) => void saveProduct(e)}>
            <label className="field">
              <span>Title</span>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="field">
              <span>Price (USD)</span>
              <input required value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <label className="field">
              <span>Compare-at</span>
              <input value={compareAt} onChange={(e) => setCompareAt(e.target.value)} placeholder="Optional" />
            </label>
            <label className="field">
              <span>Stock</span>
              <input required value={stock} onChange={(e) => setStock(e.target.value)} />
            </label>
            <label className="field">
              <span>Category</span>
              <input value={category} onChange={(e) => setCategory(e.target.value)} />
            </label>
            <label className="field imei-note-field">
              <span>Description</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>

            <div className="field imei-note-field store-desk-gallery">
              <span>Photos ({images.length}/{MAX_IMAGES})</span>
              <div className="store-desk-thumbs">
                {images.map((url, i) => (
                  <div key={`${url}-${i}`} className="store-desk-thumb">
                    <img src={url} alt="" />
                    {i === 0 ? <em>Cover</em> : null}
                    <div className="store-desk-thumb-actions">
                      <button type="button" disabled={i === 0 || busy} onClick={() => moveImage(i, -1)}>
                        ←
                      </button>
                      <button
                        type="button"
                        disabled={i === images.length - 1 || busy}
                        onClick={() => moveImage(i, 1)}
                      >
                        →
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <label className="store-desk-file btn btn-ghost btn-sm">
                Upload photos
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  hidden
                  disabled={busy || images.length >= MAX_IMAGES}
                  onChange={(e) => {
                    void onPickFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
              <div className="store-desk-url-row">
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Or paste image URL…"
                />
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={addUrl}>
                  Add URL
                </button>
              </div>
            </div>

            <div className="imei-upload-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                {editId ? 'Save product' : 'Add product'}
              </button>
              {editId ? (
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={resetForm}>
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>

          <div className="table-wrap">
            <table className="auction-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Price</th>
                  <th className="num">Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="store-desk-row">
                        <img
                          className="store-desk-row-thumb"
                          src={storeProductImage(p, 160)}
                          alt=""
                        />
                        <div>
                          <strong>{p.title}</strong>
                          <div className="muted tiny">
                            {p.category} · {p.images?.length || (p.imageUrl ? 1 : 0)} photo
                            {(p.images?.length || 0) === 1 ? '' : 's'} · /store/p/{p.slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="num">{usd(p.price)}</td>
                    <td className="num">
                      <input
                        className="retail-qty"
                        type="number"
                        min={0}
                        value={p.stock}
                        disabled={busy}
                        onChange={(e) => void patchStock(p, Math.max(0, Number(e.target.value) || 0))}
                      />
                    </td>
                    <td>{p.active ? 'Live' : 'Hidden'}</td>
                    <td className="imei-row-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void toggleActive(p)}>
                        {p.active ? 'Hide' : 'Show'}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void removeProduct(p)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!products.length ? (
              <div className="mh-empty">
                <p>No retail products yet. Add a SKU to open the consumer catalog.</p>
              </div>
            ) : null}
          </div>
        </>
      ) : !orders.length ? (
        <div className="mh-empty">
          <p>No retail orders yet.</p>
        </div>
      ) : (
        <div className="table-wrap desk-list-scroll">
          <table className="auction-table mh-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Pay</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <span className="mono">{o.id}</span>
                    <div className="muted tiny">
                      {o.lines.map((l) => `${l.qty}× ${l.title}`).join(', ')}
                    </div>
                  </td>
                  <td>
                    {o.name}
                    <div className="muted tiny">{o.email}</div>
                  </td>
                  <td>{o.paymentMethod}</td>
                  <td>{o.status.replace(/_/g, ' ')}</td>
                  <td className="num">{usd(o.total)}</td>
                  <td className="imei-row-actions">
                    {o.status === 'pending_payment' ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => void setOrderStatus(o, 'paid')}
                      >
                        Mark paid
                      </button>
                    ) : null}
                    {o.status === 'paid' ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => void setOrderStatus(o, 'shipped')}
                      >
                        Mark shipped
                      </button>
                    ) : null}
                    {o.status !== 'cancelled' && o.status !== 'shipped' ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => void setOrderStatus(o, 'cancelled')}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
