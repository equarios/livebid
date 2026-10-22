import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { StoreRail } from '../components/StoreRail'
import { api } from '../lib/api'
import { useStoreFx } from '../lib/storeFx'
import { pushToast } from '../lib/toast'
import {
  DEFAULT_TRADE_IN_DEVICES,
  TRADE_IN_MAX_PHOTOS,
  TRADE_IN_MIN_PHOTOS,
  TRADE_IN_PHOTO_SLOTS,
  estimateTradeIn,
  isValidTradeInImei,
  normTradeInImei,
  tradeInPhotosReady,
  writeTradeInPending,
  type TradeInDevice,
  type TradeInGrade,
  type TradeInPhotoSlotId,
} from '../lib/tradeIn'
import { useStore } from '../store'

const GRADES: TradeInGrade[] = ['S', 'A', 'B', 'C']

type SlotMap = Partial<Record<TradeInPhotoSlotId, string>>

/** Consumer trade-in estimate — provisional credit pending inspection. */
export function StoreTradeInPage() {
  const { settings } = useStore()
  const { money } = useStoreFx()
  const navigate = useNavigate()
  const storeName = settings.storeLabel || 'Store'

  const [devices, setDevices] = useState<TradeInDevice[]>(DEFAULT_TRADE_IN_DEVICES)
  const [imeiInput, setImeiInput] = useState('')
  const [lockedImei, setLockedImei] = useState<string | null>(null)
  const [lookupLabel, setLookupLabel] = useState<string | null>(null)
  const [lookupBusy, setLookupBusy] = useState(false)
  const [matchedIds, setMatchedIds] = useState<string[] | null>(null)
  const brands = useMemo(() => [...new Set(devices.map((d) => d.brand))], [devices])
  const [brand, setBrand] = useState(brands[0] || 'Apple')
  const pool = useMemo(() => {
    if (matchedIds?.length) return devices.filter((d) => matchedIds.includes(d.id))
    return devices
  }, [devices, matchedIds])
  const models = useMemo(() => pool.filter((d) => d.brand === brand), [pool, brand])
  const [deviceId, setDeviceId] = useState(models[0]?.id || '')
  const [grade, setGrade] = useState<TradeInGrade>('A')
  const [battery, setBattery] = useState(90)
  const [simLocked, setSimLocked] = useState(false)
  const [activationLocked, setActivationLocked] = useState(false)
  const [slots, setSlots] = useState<SlotMap>({})
  const [extras, setExtras] = useState<string[]>([])
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  /** TAC matched — brand/model locked to Matrix hits. */
  const tacLocked = Boolean(matchedIds?.length)
  const imeiReady = Boolean(lockedImei && isValidTradeInImei(lockedImei))
  const slotInputRefs = useRef<Partial<Record<TradeInPhotoSlotId, HTMLInputElement | null>>>({})
  const extraInputRef = useRef<HTMLInputElement | null>(null)
  const bulkInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    void api
      .storeTradeInDevices()
      .then((res) => {
        if (cancelled) return
        const list = (res.devices || []).filter((d) => d.active !== false && d.baseUsd > 0)
        if (list.length) {
          setDevices(list)
          setBrand((prev) => (list.some((d) => d.brand === prev) ? prev : list[0].brand))
        }
      })
      .catch(() => {
        /* keep DEFAULT_TRADE_IN_DEVICES */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const brandList = [...new Set(pool.map((d) => d.brand))]
    if (!brandList.includes(brand) && brandList[0]) setBrand(brandList[0])
  }, [pool, brand])

  const activeId = models.some((d) => d.id === deviceId) ? deviceId : models[0]?.id || ''
  const quote = activeId
    ? estimateTradeIn(
        {
          deviceId: activeId,
          grade,
          battery,
          simLocked,
          activationLocked,
        },
        pool,
      )
    : null

  async function lookupImei() {
    setLookupBusy(true)
    try {
      const digits = normTradeInImei(imeiInput)
      if (!isValidTradeInImei(digits)) {
        pushToast('Enter a valid 15-digit IMEI (*#06#).')
        return
      }
      const res = await api.lookupTradeInImei(digits)
      if (res.ok && res.matches?.length && res.imei) {
        setLockedImei(res.imei)
        setImeiInput(res.imei)
        setMatchedIds(res.matches.map((m) => m.id))
        setLookupLabel(
          `${res.brand} ${res.model}${res.name && res.name !== res.model ? ` (${res.name})` : ''}`,
        )
        setBrand(res.matches[0].brand)
        setDeviceId(res.matches[0].id)
        pushToast('Device matched — confirm capacity if needed.')
        return
      }
      // Valid IMEI but unknown TAC / not on buy auto-list — manual Matrix pick.
      setLockedImei(digits)
      setImeiInput(digits)
      setMatchedIds(null)
      setLookupLabel(null)
      pushToast(
        res.error
          ? `${res.error} Pick brand/model from the list.`
          : 'IMEI saved — pick brand/model from the list.',
      )
    } catch (ex) {
      pushToast(ex instanceof Error ? ex.message : 'IMEI lookup failed.')
    } finally {
      setLookupBusy(false)
    }
  }

  function clearImeiLock() {
    setLockedImei(null)
    setMatchedIds(null)
    setLookupLabel(null)
    setImeiInput('')
  }

  const orderedImages = [
    ...TRADE_IN_PHOTO_SLOTS.map((s) => slots[s.id]).filter(
      (u): u is string => typeof u === 'string' && !!u.trim(),
    ),
    ...extras,
  ]
  const photosOk = tradeInPhotosReady(orderedImages)
  const canAddExtra = orderedImages.length < TRADE_IN_MAX_PHOTOS

  async function uploadBatch(files: File[]) {
    const urls: string[] = []
    for (let i = 0; i < files.length; i += 4) {
      const chunk = files.slice(i, i + 4)
      const res = await api.uploadTradeInPhotos(chunk)
      urls.push(...res.urls.filter((u) => typeof u === 'string' && u.trim()))
    }
    return urls
  }

  async function uploadFiles(files: FileList | File[], target: TradeInPhotoSlotId | 'extra' | 'bulk') {
    const all = Array.from(files)
    if (!all.length) return
    setUploading(target)
    try {
      if (target === 'bulk') {
        const room = TRADE_IN_MAX_PHOTOS - orderedImages.length
        const list = all.slice(0, Math.max(0, room))
        if (!list.length) return
        const urls = await uploadBatch(list)
        if (!urls.length) throw new Error('No photo returned.')
        const nextSlots: SlotMap = { ...slots }
        let i = 0
        for (const slot of TRADE_IN_PHOTO_SLOTS) {
          if (nextSlots[slot.id]) continue
          if (i >= urls.length) break
          nextSlots[slot.id] = urls[i++]
        }
        setSlots(nextSlots)
        const leftover = urls.slice(i)
        if (leftover.length) {
          setExtras((ex) =>
            [...ex, ...leftover].slice(0, TRADE_IN_MAX_PHOTOS - TRADE_IN_MIN_PHOTOS),
          )
        }
        return
      }
      const list = all.slice(0, target === 'extra' ? TRADE_IN_MAX_PHOTOS - orderedImages.length : 1)
      if (!list.length) return
      const urls = await uploadBatch(list)
      if (!urls.length) throw new Error('No photo returned.')
      if (target === 'extra') {
        setExtras((prev) => [...prev, ...urls].slice(0, TRADE_IN_MAX_PHOTOS - TRADE_IN_MIN_PHOTOS))
      } else {
        setSlots((prev) => ({ ...prev, [target]: urls[0] }))
      }
    } catch (ex) {
      pushToast(ex instanceof Error ? ex.message : 'Photo upload failed.')
    } finally {
      setUploading(null)
    }
  }

  async function uploadVideo(file: File) {
    setUploading('video')
    try {
      const res = await api.uploadTradeInVideo(file)
      setVideoUrl(res.url)
    } catch (ex) {
      pushToast(ex instanceof Error ? ex.message : 'Video upload failed.')
    } finally {
      setUploading(null)
    }
  }

  if (!settings.showStore) {
    return (
      <PublicShell mode="consumer">
        <p className="muted store-off-note">Retail store is turned off.</p>
      </PublicShell>
    )
  }

  return (
    <PublicShell mode="consumer">
      <div className="retail-store">
        <StoreRail
          page="tradein"
          title="Trade-in"
          note="Estimate your device, add condition photos, apply provisional credit in cart, then send it in for inspection."
          label={storeName}
        />

        <div className="store-tradein">
          <section className="store-tradein-card" aria-labelledby="tradein-how">
            <h2 id="tradein-how">How it works</h2>
            <ol className="store-tradein-steps">
              <li>Enter IMEI (*#06#) — we auto-match when we can; otherwise pick from our buy list.</li>
              <li>Confirm model/capacity, then grade / battery / locks.</li>
              <li>Upload clear photos of all sides (min {TRADE_IN_MIN_PHOTOS}). Optional short video.</li>
              <li>Shop the {storeName} — credit shows as pending in your cart.</li>
              <li>Ship or drop off the device. We inspect condition &amp; locks.</li>
              <li>Final credit applies after QC (may be adjusted).</li>
            </ol>
            <p className="muted tiny">
              Estimate is not a payout. Credit cannot exceed your cart total. No cash-out in this
              program.
            </p>
            <p className="muted tiny store-we-buy-note">
              Bulk supplier?{' '}
              <Link to="/sellers#sell-to-us">Sell inventory to us</Link> (wholesale offer desk).
            </p>
          </section>

          <section className="store-tradein-card" aria-labelledby="tradein-form">
            <h2 id="tradein-form">Your device</h2>
            <div className="store-tradein-imei">
              <label className="field">
                <span>IMEI</span>
                <input
                  value={imeiInput}
                  onChange={(e) => {
                    setImeiInput(e.target.value.replace(/\D/g, '').slice(0, 16))
                    if (tacLocked || lockedImei) {
                      setMatchedIds(null)
                      setLookupLabel(null)
                      setLockedImei(null)
                    }
                  }}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="15 digits (*#06#)"
                  disabled={lookupBusy}
                  required
                />
              </label>
              <div className="store-tradein-imei-actions">
                {imeiReady ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={clearImeiLock}>
                    Clear IMEI
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={lookupBusy || imeiInput.replace(/\D/g, '').length < 14}
                  onClick={() => void lookupImei()}
                >
                  {lookupBusy ? 'Looking up…' : 'Look up'}
                </button>
              </div>
            </div>
            {lookupLabel && tacLocked ? (
              <p className="muted tiny store-tradein-imei-hit">
                Matched from IMEI: <strong>{lookupLabel}</strong> (capacity selectable if several)
              </p>
            ) : imeiReady ? (
              <p className="muted tiny store-tradein-imei-hit">
                IMEI saved — pick brand/model from our buy list below.
              </p>
            ) : (
              <p className="muted tiny">
                Enter IMEI and Look up. If we can’t auto-match, pick the model yourself.
              </p>
            )}
            <div className="store-tradein-grid">
              <label className="field">
                <span>Brand</span>
                <select
                  value={brand}
                  disabled={tacLocked && [...new Set(pool.map((d) => d.brand))].length <= 1}
                  onChange={(e) => {
                    const next = e.target.value
                    setBrand(next)
                    const first = pool.find((d) => d.brand === next)
                    if (first) setDeviceId(first.id)
                  }}
                >
                  {[...new Set(pool.map((d) => d.brand))].map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Model / capacity</span>
                <select
                  value={activeId}
                  disabled={tacLocked && models.length <= 1}
                  onChange={(e) => setDeviceId(e.target.value)}
                >
                  {models.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.model} · {d.capacity}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Condition grade</span>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value as TradeInGrade)}
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      Grade {g}
                      {g === 'C' ? ' (as-is)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Battery health %</span>
                <input
                  type="number"
                  className="retail-qty"
                  min={0}
                  max={100}
                  value={battery}
                  onChange={(e) => setBattery(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                />
              </label>
            </div>
            <div className="store-tradein-locks">
              <label className="store-tradein-check">
                <input
                  type="checkbox"
                  checked={simLocked}
                  onChange={(e) => setSimLocked(e.target.checked)}
                />
                <span>SIM locked</span>
              </label>
              <label className="store-tradein-check">
                <input
                  type="checkbox"
                  checked={activationLocked}
                  onChange={(e) => setActivationLocked(e.target.checked)}
                />
                <span>Activation locked</span>
              </label>
            </div>
          </section>

          <section className="store-tradein-card" aria-labelledby="tradein-photos">
            <h2 id="tradein-photos">Condition photos</h2>
            <p className="muted tiny" style={{ marginTop: 0 }}>
              Required: front, back, left, and right. Up to {TRADE_IN_MAX_PHOTOS} photos total.
            </p>
            <div className="store-tradein-bulk">
              <input
                ref={bulkInputRef}
                type="file"
                accept="image/*"
                hidden
                multiple
                onChange={(e) => {
                  const files = e.target.files
                  e.target.value = ''
                  if (files?.length) void uploadFiles(files, 'bulk')
                }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!!uploading || orderedImages.length >= TRADE_IN_MAX_PHOTOS}
                onClick={() => bulkInputRef.current?.click()}
              >
                {uploading === 'bulk' ? 'Uploading…' : 'Add all sides at once'}
              </button>
              <span className="muted tiny">
                Pick {TRADE_IN_MIN_PHOTOS}+ photos — fills empty slots in order (front → right).
              </span>
            </div>
            <div className="store-tradein-photos">
              {TRADE_IN_PHOTO_SLOTS.map((slot) => {
                const url = slots[slot.id]
                const busy = uploading === slot.id
                return (
                  <div key={slot.id} className="store-tradein-photo-slot">
                    <input
                      ref={(el) => {
                        slotInputRefs.current[slot.id] = el
                      }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      hidden
                      onChange={(e) => {
                        const files = e.target.files
                        e.target.value = ''
                        if (files?.length) void uploadFiles(files, slot.id)
                      }}
                    />
                    {url ? (
                      <button
                        type="button"
                        className="store-tradein-photo-thumb"
                        disabled={!!uploading}
                        onClick={() => slotInputRefs.current[slot.id]?.click()}
                        aria-label={`Replace ${slot.label} photo`}
                      >
                        <img src={url} alt="" />
                        <span className="store-tradein-photo-label">{slot.label}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="store-tradein-photo-add"
                        disabled={!!uploading}
                        onClick={() => slotInputRefs.current[slot.id]?.click()}
                      >
                        <span className="store-tradein-photo-label">{slot.label}</span>
                        <span className="muted tiny">{busy ? 'Uploading…' : slot.hint}</span>
                      </button>
                    )}
                    {url ? (
                      <button
                        type="button"
                        className="linkish tiny store-tradein-photo-clear"
                        disabled={!!uploading}
                        onClick={() =>
                          setSlots((prev) => {
                            const next = { ...prev }
                            delete next[slot.id]
                            return next
                          })
                        }
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
            {extras.length || canAddExtra ? (
              <div className="store-tradein-extras">
                {extras.map((url, i) => (
                  <div key={`${url}-${i}`} className="store-tradein-photo-slot">
                    <div className="store-tradein-photo-thumb">
                      <img src={url} alt="" />
                      <span className="store-tradein-photo-label">More</span>
                    </div>
                    <button
                      type="button"
                      className="linkish tiny store-tradein-photo-clear"
                      disabled={!!uploading}
                      onClick={() => setExtras((prev) => prev.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {canAddExtra ? (
                  <div className="store-tradein-photo-slot">
                    <input
                      ref={extraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      hidden
                      multiple
                      onChange={(e) => {
                        const files = e.target.files
                        e.target.value = ''
                        if (files?.length) void uploadFiles(files, 'extra')
                      }}
                    />
                    <button
                      type="button"
                      className="store-tradein-photo-add"
                      disabled={!!uploading}
                      onClick={() => extraInputRef.current?.click()}
                    >
                      <span className="store-tradein-photo-label">More photos</span>
                      <span className="muted tiny">
                        {uploading === 'extra' ? 'Uploading…' : 'Select several at once'}
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="store-tradein-video">
              <h3 className="store-tradein-video-title">Condition video (optional)</h3>
              <p className="muted tiny" style={{ marginTop: 0 }}>
                Short clip showing screen + body — MP4 / WebM / MOV, under 40 MB.
              </p>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                capture="environment"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void uploadVideo(file)
                }}
              />
              {videoUrl ? (
                <div className="store-tradein-video-preview">
                  <video src={videoUrl} controls playsInline preload="metadata" />
                  <div className="store-tradein-video-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={!!uploading}
                      onClick={() => videoInputRef.current?.click()}
                    >
                      {uploading === 'video' ? 'Uploading…' : 'Replace'}
                    </button>
                    <button
                      type="button"
                      className="linkish tiny"
                      disabled={!!uploading}
                      onClick={() => setVideoUrl(null)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!!uploading}
                  onClick={() => videoInputRef.current?.click()}
                >
                  {uploading === 'video' ? 'Uploading…' : 'Add video'}
                </button>
              )}
            </div>
          </section>

          {quote ? (
            <section className="store-tradein-card store-tradein-quote" aria-live="polite">
              <h2>Estimated credit</h2>
              <p className="store-tradein-range">
                {money(quote.lowUsd)} – {money(quote.highUsd)}
              </p>
              <p className="muted">
                Provisional cart credit: <strong>{money(quote.creditUsd)}</strong> for {quote.label}
              </p>
              <ul className="store-tradein-notes">
                {quote.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              {!photosOk ? (
                <p className="muted tiny">Add all {TRADE_IN_MIN_PHOTOS} required angles to apply.</p>
              ) : null}
              <div className="store-buy-actions">
                <button
                  type="button"
                  className="btn btn-primary store-buy-primary"
                  disabled={!photosOk || !imeiReady || !!uploading}
                  onClick={() => {
                    try {
                      if (!quote || !lockedImei) return
                      writeTradeInPending(quote, orderedImages, videoUrl, lockedImei)
                      navigate('/store/cart')
                    } catch (ex) {
                      pushToast(ex instanceof Error ? ex.message : 'Could not apply trade-in.')
                    }
                  }}
                >
                  Apply to cart
                </button>
                <Link to="/store" className="btn btn-ghost store-buy-secondary">
                  Keep shopping
                </Link>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </PublicShell>
  )
}
