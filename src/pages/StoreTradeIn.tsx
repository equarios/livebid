import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PublicShell } from '../components/PublicShell'
import { SearchSelect } from '../components/SearchSelect'
import { StoreRail } from '../components/StoreRail'
import { api } from '../lib/api'
import { useStoreFx } from '../lib/storeFx'
import { pushToast } from '../lib/toast'
import {
  DEFAULT_TRADE_IN_DEVICES,
  TRADE_IN_FEATURES,
  TRADE_IN_MAX_PHOTOS,
  TRADE_IN_MIN_PHOTOS,
  TRADE_IN_PHOTO_SLOTS,
  customTradeInDeviceId,
  estimateTradeIn,
  gradeFromCondition,
  isValidTradeInImei,
  normTradeInImei,
  pendingTradeInQuote,
  tradeInDeviceLabel,
  tradeInPhotosReady,
  writeTradeInPending,
  type TradeInBody,
  type TradeInCondition,
  type TradeInDevice,
  type TradeInPhotoSlotId,
  type TradeInScreen,
} from '../lib/tradeIn'
import { useStore } from '../store'

type SlotMap = Partial<Record<TradeInPhotoSlotId, string>>

const STEPS = ['Device', 'Condition', 'Photos', 'Credit'] as const

const SCREEN_OPTS: Array<{ id: TradeInScreen; label: string; hint: string }> = [
  { id: 'perfect', label: 'Perfect', hint: 'No marks or scratches' },
  { id: 'light', label: 'Light wear', hint: 'Minor scratches, no cracks' },
  { id: 'cracked', label: 'Cracked', hint: 'Chips or visible cracks' },
]

const BODY_OPTS: Array<{ id: TradeInBody; label: string; hint: string }> = [
  { id: 'perfect', label: 'Perfect', hint: 'Looks like new' },
  { id: 'light', label: 'Light wear', hint: 'Scuffs on edges or back' },
  { id: 'dented', label: 'Dented', hint: 'Bends, deep dents or cracks' },
]

/** Consumer trade-in estimate — provisional credit pending inspection. */
export function StoreTradeInPage() {
  const { settings } = useStore()
  const { money } = useStoreFx()
  const navigate = useNavigate()
  const storeName = settings.storeLabel || 'Store'

  const [step, setStep] = useState(0)
  const [devices, setDevices] = useState<TradeInDevice[]>(DEFAULT_TRADE_IN_DEVICES)
  const [imeiInput, setImeiInput] = useState('')
  const [lockedImei, setLockedImei] = useState<string | null>(null)
  const [lookupLabel, setLookupLabel] = useState<string | null>(null)
  const [lookupBusy, setLookupBusy] = useState(false)
  const [matchedIds, setMatchedIds] = useState<string[] | null>(null)
  const [imeiOpen, setImeiOpen] = useState(false)
  /** Free-form device when not in the price matrix — we still buy it. */
  const [customDevice, setCustomDevice] = useState(false)

  const brands = useMemo(() => [...new Set(devices.map((d) => d.brand))], [devices])
  const [brand, setBrand] = useState(brands[0] || 'Apple')
  const pool = useMemo(() => {
    if (matchedIds?.length) return devices.filter((d) => matchedIds.includes(d.id))
    return devices
  }, [devices, matchedIds])
  const models = useMemo(() => pool.filter((d) => d.brand === brand), [pool, brand])
  const [modelName, setModelName] = useState(models[0]?.model || '')
  const [modelNumber, setModelNumber] = useState(models[0]?.modelNumber || '')
  const [capacity, setCapacity] = useState(models[0]?.capacity || '')
  const [deviceId, setDeviceId] = useState(models[0]?.id || '')

  const modelNames = useMemo(
    () => [...new Set(models.map((d) => d.model))].sort((a, b) => a.localeCompare(b)),
    [models],
  )
  const byModelName = useMemo(
    () => models.filter((d) => d.model === modelName),
    [models, modelName],
  )
  const modelNumbers = useMemo(
    () =>
      [...new Set(byModelName.map((d) => (d.modelNumber || '').trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [byModelName],
  )
  const capacities = useMemo(() => {
    if (!modelNumber) return byModelName
    return byModelName.filter((d) => (d.modelNumber || '').trim() === modelNumber)
  }, [byModelName, modelNumber])

  const brandOptions = useMemo(
    () =>
      [...new Set(pool.map((d) => d.brand))]
        .sort((a, b) => a.localeCompare(b))
        .map((b) => {
          const rows = pool.filter((d) => d.brand === b)
          const top = rows.reduce((n, d) => Math.max(n, d.baseUsd), 0)
          return {
            value: b,
            label: b,
            hint: `up to ${money(top)}`,
            keywords: `${b} ${[...new Set(rows.map((d) => d.model))].join(' ')}`,
          }
        }),
    [pool, money],
  )

  const modelOptions = useMemo(
    () =>
      modelNames.map((name) => {
        const rows = models.filter((d) => d.model === name)
        const top = rows.reduce((n, d) => Math.max(n, d.baseUsd), 0)
        return {
          value: name,
          label: name,
          hint: `up to ${money(top)}`,
          keywords: `${brand} ${name}`,
        }
      }),
    [modelNames, models, brand, money],
  )

  const modelNumberOptions = useMemo(
    () =>
      modelNumbers.map((num) => {
        const rows = byModelName.filter((d) => (d.modelNumber || '').trim() === num)
        const top = rows.reduce((n, d) => Math.max(n, d.baseUsd), 0)
        return {
          value: num,
          label: num,
          hint: `up to ${money(top)}`,
          keywords: `${brand} ${modelName} ${num}`,
        }
      }),
    [modelNumbers, byModelName, brand, modelName, money],
  )

  const capacityOptions = useMemo(() => {
    const seen = new Set<string>()
    return capacities
      .filter((d) => {
        if (seen.has(d.capacity)) return false
        seen.add(d.capacity)
        return true
      })
      .map((d) => ({
        value: d.capacity,
        label: d.capacity,
        hint: `up to ${money(d.baseUsd)}`,
      }))
  }, [capacities, money])

  const [condition, setCondition] = useState<TradeInCondition>({
    screen: 'perfect',
    body: 'perfect',
    works: TRADE_IN_FEATURES.map((f) => f.id),
    battery: null,
    simLocked: false,
    activationLocked: false,
  })

  const [slots, setSlots] = useState<SlotMap>({})
  const [extras, setExtras] = useState<string[]>([])
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)

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
    if (customDevice) return
    const brandList = [...new Set(pool.map((d) => d.brand))]
    if (!brandList.includes(brand) && brandList[0]) setBrand(brandList[0])
  }, [pool, brand, customDevice])

  /** Keep matrix picks consistent — skipped in free-form mode. */
  useEffect(() => {
    if (customDevice) return
    if (!models.length) {
      setModelName('')
      setModelNumber('')
      setCapacity('')
      setDeviceId('')
      return
    }
    const name = models.some((d) => d.model === modelName) ? modelName : models[0].model
    if (name !== modelName) setModelName(name)
    const named = models.filter((d) => d.model === name)
    const nums = [
      ...new Set(named.map((d) => (d.modelNumber || '').trim()).filter(Boolean)),
    ]
    const num =
      modelNumber && nums.includes(modelNumber) ? modelNumber : nums[0] || ''
    if (num !== modelNumber) setModelNumber(num)
    const rows = num
      ? named.filter((d) => (d.modelNumber || '').trim() === num)
      : named
    const cap = rows.some((d) => d.capacity === capacity) ? capacity : rows[0]?.capacity || ''
    if (cap !== capacity) setCapacity(cap)
    const row = rows.find((d) => d.capacity === cap) || rows[0]
    if (row && row.id !== deviceId) setDeviceId(row.id)
  }, [models, modelName, modelNumber, capacity, deviceId, customDevice])

  const grade = gradeFromCondition(condition)
  const deviceReady =
    Boolean(brand.trim()) && Boolean(modelName.trim()) && Boolean(capacity.trim())

  const quote = useMemo(() => {
    if (!deviceReady) return null
    const batt = condition.battery ?? 0
    if (customDevice) {
      const id = customTradeInDeviceId({
        brand: brand.trim(),
        model: modelName.trim(),
        modelNumber: modelNumber.trim(),
        capacity: capacity.trim(),
      })
      const label = tradeInDeviceLabel({
        id,
        brand: brand.trim(),
        model: modelName.trim(),
        modelNumber: modelNumber.trim(),
        capacity: capacity.trim(),
        baseUsd: 0,
      })
      return pendingTradeInQuote({
        deviceId: id,
        label,
        grade,
        battery: batt,
        simLocked: condition.simLocked,
        activationLocked: condition.activationLocked,
      })
    }
    if (!deviceId) return null
    return estimateTradeIn(
      {
        deviceId,
        grade,
        battery: batt,
        simLocked: condition.simLocked,
        activationLocked: condition.activationLocked,
      },
      pool,
    )
  }, [
    deviceReady,
    customDevice,
    brand,
    modelName,
    modelNumber,
    capacity,
    deviceId,
    grade,
    condition.battery,
    condition.simLocked,
    condition.activationLocked,
    pool,
  ])

  const orderedImages = [
    ...TRADE_IN_PHOTO_SLOTS.map((s) => slots[s.id]).filter(
      (u): u is string => typeof u === 'string' && !!u.trim(),
    ),
    ...extras,
  ]
  const photosOk = tradeInPhotosReady(orderedImages)
  const canAddExtra = orderedImages.length < TRADE_IN_MAX_PHOTOS

  async function lookupImei() {
    setLookupBusy(true)
    try {
      const digits = normTradeInImei(imeiInput)
      if (!isValidTradeInImei(digits)) {
        pushToast('Enter a valid 15-digit IMEI (*#06#).')
        return
      }
      const res = await api.lookupTradeInImei(digits)
      const imei = res.imei || digits
      setLockedImei(imei)
      setImeiInput(imei)

      if (res.ok && res.matches?.length) {
        setCustomDevice(false)
        setMatchedIds(res.matches.map((m) => m.id))
        setLookupLabel(
          `${res.brand || res.matches[0].brand} ${res.model || res.matches[0].model}${
            res.name && res.name !== res.model ? ` (${res.name})` : ''
          }`,
        )
        setBrand(res.matches[0].brand)
        setModelName(res.matches[0].model)
        setModelNumber(res.matches[0].modelNumber || '')
        setCapacity(res.matches[0].capacity)
        setDeviceId(res.matches[0].id)
        pushToast('Device matched — confirm storage if needed.')
        return
      }

      // Recognized or unknown — never reject; let them confirm / enter details.
      setMatchedIds(null)
      if (res.brand || res.model) {
        setCustomDevice(true)
        if (res.brand) setBrand(res.brand)
        if (res.model) setModelName(res.model)
        setLookupLabel(
          `${res.brand || ''} ${res.model || ''}${
            res.name && res.name !== res.model ? ` (${res.name})` : ''
          }`.trim(),
        )
      } else {
        setLookupLabel(null)
      }
      pushToast(res.hint || res.error || 'IMEI saved — pick or enter your device below.')
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

  /** Validate and lock IMEI without changing the chosen device. */
  function saveImeiOnly() {
    const digits = normTradeInImei(imeiInput)
    if (!isValidTradeInImei(digits)) {
      pushToast('Enter a valid 15-digit IMEI (*#06#).')
      return
    }
    setLockedImei(digits)
    setImeiInput(digits)
    pushToast('IMEI saved.')
  }

  function useListedDevice() {
    setCustomDevice(false)
    setMatchedIds(null)
  }

  function useOtherDevice() {
    setCustomDevice(true)
    setMatchedIds(null)
  }

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

  function toggleFeature(id: string) {
    setCondition((c) => ({
      ...c,
      works: c.works.includes(id) ? c.works.filter((x) => x !== id) : [...c.works, id],
    }))
  }

  function applyToCart() {
    try {
      if (!quote) return
      if (!lockedImei || !isValidTradeInImei(lockedImei)) {
        pushToast('Add or save your IMEI (*#06#) below.')
        setStep(3)
        return
      }
      writeTradeInPending(quote, orderedImages, videoUrl, lockedImei)
      navigate('/store/cart')
    } catch (ex) {
      pushToast(ex instanceof Error ? ex.message : 'Could not apply trade-in.')
    }
  }

  const canContinue = step === 0 ? deviceReady : true

  if (!settings.showStore) {
    return (
      <PublicShell mode="consumer">
        <p className="muted store-off-note">Retail store is turned off.</p>
      </PublicShell>
    )
  }

  const estimateLabel = !quote
    ? '—'
    : quote.pendingQuote || quote.creditUsd <= 0
      ? 'Pending'
      : money(quote.creditUsd)

  const rangePct = (low: number, high: number, mid: number) => {
    if (high <= low) return 100
    return Math.min(100, Math.max(0, Math.round(((mid - low) / (high - low)) * 100)))
  }

  return (
    <PublicShell mode="consumer">
      <div className="retail-store">
        <StoreRail
          page="tradein"
          title="Trade-in"
          headline="Trade in your phone"
          note="We buy every model and condition online. Instant estimate when priced — otherwise credit after inspection."
          label={storeName}
          hero
          trust={[
            'Ship-in instructions by email',
            'Inspect within 48h of arrival',
            'Store credit only — no cash-out',
          ]}
        />

        <div className="store-tradein">
          <aside className="ti-aside" aria-label="How trade-in works">
            <div className="ti-aside-card ti-aside-quote">
              <span className="ti-aside-eyebrow">Your estimate</span>
              <strong className="ti-aside-amount">{estimateLabel}</strong>
              <p className="ti-aside-model">
                {quote ? quote.label : 'Pick a device to see your range'}
              </p>
              {quote && !quote.pendingQuote && quote.creditUsd > 0 ? (
                <div className="ti-aside-range">
                  <span>{money(quote.lowUsd)}</span>
                  <span className="ti-aside-range-track" aria-hidden>
                    <i style={{ width: `${rangePct(quote.lowUsd, quote.highUsd, quote.creditUsd)}%` }} />
                  </span>
                  <span>{money(quote.highUsd)}</span>
                </div>
              ) : null}
              <p className="ti-aside-note">
                {quote && quote.pendingQuote
                  ? 'Not in our price list yet — we still buy it. Credit set after inspection.'
                  : 'Provisional credit. Final amount confirmed after a 48h inspection.'}
              </p>
            </div>

            <div className="ti-aside-card">
              <h2 className="ti-aside-title">How it works</h2>
              <ol className="ti-how">
                <li>
                  <span className="ti-how-dot">1</span>
                  <div>
                    <strong>Tell us the device</strong>
                    <em>Model, storage and a few condition questions.</em>
                  </div>
                </li>
                <li>
                  <span className="ti-how-dot">2</span>
                  <div>
                    <strong>Add photos + IMEI</strong>
                    <em>{TRADE_IN_MIN_PHOTOS} photos and your IMEI lock the quote.</em>
                  </div>
                </li>
                <li>
                  <span className="ti-how-dot">3</span>
                  <div>
                    <strong>Credit hits your cart</strong>
                    <em>Spend it right away on any store item.</em>
                  </div>
                </li>
                <li>
                  <span className="ti-how-dot">4</span>
                  <div>
                    <strong>Ship it in</strong>
                    <em>Label by email. We inspect within 48h of arrival.</em>
                  </div>
                </li>
              </ol>
            </div>

            <div className="ti-aside-card ti-aside-facts">
              <h2 className="ti-aside-title">Good to know</h2>
              <ul className="ti-facts">
                <li>
                  <strong>Every model accepted</strong>
                  <span>Cracked screens, dead batteries, locked phones — send it anyway.</span>
                </li>
                <li>
                  <strong>Data wiped on arrival</strong>
                  <span>We factory-reset and erase before anything else.</span>
                </li>
                <li>
                  <strong>Store credit only</strong>
                  <span>No cash-out. Credit never exceeds your cart total.</span>
                </li>
                <li>
                  <strong>Free to decline</strong>
                  <span>Not happy with the final number? We return the device.</span>
                </li>
              </ul>
            </div>

            <div className="ti-aside-help">
              <p>Questions before you send it?</p>
              <Link to="/support" className="ti-aside-help-link">
                Talk to the store team →
              </Link>
            </div>
          </aside>

          <div className="ti-main">
          <ol className="ck-steps is-bar ti-steps" aria-label="Progress">
            {STEPS.map((label, i) => (
              <li
                key={label}
                className={`${i === step ? 'is-on' : ''}${i < step ? ' is-done' : ''}`.trim()}
                aria-current={i === step ? 'step' : undefined}
              >
                <span className="ck-steps-dot" aria-hidden>
                  {i < step ? '✓' : i + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>

          {step === 0 ? (
            <section className="store-tradein-card" aria-labelledby="ti-device">
              <h2 id="ti-device" className="cart2-step-title">
                <span className="cart2-step-num">1</span>
                <span className="cart2-step-copy">
                  Device
                  <em>Which device are you trading in?</em>
                </span>
              </h2>

              <div className="ti-imei-cta">
                {imeiOpen ? (
                  <div className="ti-imei-panel">
                    <div className="store-tradein-imei">
                      <label className="field">
                        <span>IMEI (*#06#)</span>
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
                          placeholder="15 digits"
                          disabled={lookupBusy}
                        />
                      </label>
                      <div className="store-tradein-imei-actions">
                        {imeiReady || imeiInput ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={clearImeiLock}>
                            Clear
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={lookupBusy || imeiInput.replace(/\D/g, '').length < 14}
                          onClick={saveImeiOnly}
                        >
                          Save
                        </button>
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
                    {lookupLabel ? (
                      <p className="ti-panel-hint store-tradein-imei-hit">
                        From IMEI: <strong>{lookupLabel}</strong>
                        {tacLocked ? ' — confirm storage below.' : ' — confirm or edit details below.'}
                      </p>
                    ) : imeiReady ? (
                      <p className="ti-panel-hint store-tradein-imei-hit">
                        IMEI saved — pick or enter your device below.
                      </p>
                    ) : (
                      <p className="ti-panel-hint store-tradein-imei-hit">
                        Dial *#06# on the phone, then Look up to auto-fill the model.
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ti-imei-open"
                    onClick={() => setImeiOpen(true)}
                  >
                    Know your IMEI? Auto-fill the model →
                  </button>
                )}
              </div>

              {customDevice ? (
                <div className="ti-custom-fields">
                  <label className="field">
                    <span>Brand</span>
                    <input
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="e.g. Apple"
                      autoComplete="off"
                    />
                  </label>
                  <label className="field">
                    <span>Model name</span>
                    <input
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      placeholder="e.g. iPhone 15"
                      autoComplete="off"
                    />
                  </label>
                  <label className="field">
                    <span>Model number</span>
                    <input
                      value={modelNumber}
                      onChange={(e) => setModelNumber(e.target.value)}
                      placeholder="e.g. A3090 (optional)"
                      autoComplete="off"
                    />
                  </label>
                  <label className="field">
                    <span>Storage</span>
                    <input
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      placeholder="e.g. 128GB"
                      autoComplete="off"
                    />
                  </label>
                  <p className="muted tiny ti-custom-note">
                    Not in our instant-price list — we’ll quote after inspection. You can still
                    apply the trade-in online.
                  </p>
                  <button type="button" className="ti-imei-open ti-other-device" onClick={useListedDevice}>
                    ← Back to listed models
                  </button>
                </div>
              ) : (
                <>
                  <div className="ti-selects">
                    <SearchSelect
                      label="Brand"
                      value={brand}
                      placeholder="Choose a brand"
                      searchPlaceholder="Search brands…"
                      disabled={tacLocked && brandOptions.length <= 1}
                      options={brandOptions}
                      onChange={(next) => setBrand(next)}
                    />
                    <SearchSelect
                      label="Model name"
                      value={modelName}
                      placeholder="Choose a model"
                      searchPlaceholder="Search model…"
                      disabled={tacLocked && modelOptions.length <= 1}
                      options={modelOptions}
                      onChange={(next) => setModelName(next)}
                    />
                    {modelNumberOptions.length ? (
                      <SearchSelect
                        label="Model number"
                        value={modelNumber}
                        placeholder="Choose model number"
                        searchPlaceholder="Search Axxxx / SM-…"
                        disabled={tacLocked && modelNumberOptions.length <= 1}
                        options={modelNumberOptions}
                        onChange={(next) => setModelNumber(next)}
                      />
                    ) : null}
                    <SearchSelect
                      label="Storage"
                      value={capacity}
                      placeholder="Choose storage"
                      searchPlaceholder="Search GB / TB…"
                      disabled={capacityOptions.length <= 1}
                      options={capacityOptions}
                      onChange={(next) => setCapacity(next)}
                    />
                  </div>
                  <button type="button" className="ti-imei-open ti-other-device" onClick={useOtherDevice}>
                    Don’t see your device? Enter it →
                  </button>
                </>
              )}
            </section>
          ) : null}

          {step === 1 ? (
            <section className="store-tradein-card" aria-labelledby="ti-condition">
              <h2 id="ti-condition" className="cart2-step-title">
                <span className="cart2-step-num">2</span>
                <span className="cart2-step-copy">
                  Condition
                  <em>How is it holding up?</em>
                </span>
              </h2>

              <fieldset className="ti-fieldset">
                <legend>Screen</legend>
                <div className="ti-option-grid">
                  {SCREEN_OPTS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={`ti-option${condition.screen === o.id ? ' is-active' : ''}`}
                      aria-pressed={condition.screen === o.id}
                      title={o.hint}
                      onClick={() => setCondition((c) => ({ ...c, screen: o.id }))}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="ti-fieldset">
                <legend>Body &amp; frame</legend>
                <div className="ti-option-grid">
                  {BODY_OPTS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={`ti-option${condition.body === o.id ? ' is-active' : ''}`}
                      aria-pressed={condition.body === o.id}
                      title={o.hint}
                      onClick={() => setCondition((c) => ({ ...c, body: o.id }))}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="ti-fieldset">
                <legend>What still works?</legend>
                <div className="ti-chips">
                  {TRADE_IN_FEATURES.map((f) => {
                    const on = condition.works.includes(f.id)
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className={`ti-chip${on ? ' is-active' : ''}`}
                        aria-pressed={on}
                        onClick={() => toggleFeature(f.id)}
                      >
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <fieldset className="ti-fieldset">
                <legend>Battery health</legend>
                <div className={`ti-panel ti-battery-panel${condition.battery == null ? ' is-unknown' : ''}`}>
                  <div className="ti-battery-top">
                    <strong className="ti-battery-value">
                      {condition.battery == null ? 'Unknown' : `${condition.battery}%`}
                    </strong>
                    <button
                      type="button"
                      className={`ti-chip${condition.battery == null ? ' is-active' : ''}`}
                      aria-pressed={condition.battery == null}
                      onClick={() =>
                        setCondition((c) => ({
                          ...c,
                          battery: c.battery == null ? 90 : null,
                        }))
                      }
                    >
                      I don’t know
                    </button>
                  </div>
                  <input
                    className="ti-battery-range"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={condition.battery ?? 90}
                    disabled={condition.battery == null}
                    onChange={(e) =>
                      setCondition((c) => ({ ...c, battery: Number(e.target.value) }))
                    }
                  />
                  <p className="ti-panel-hint">Check Settings → Battery → Battery health.</p>
                </div>
              </fieldset>

              <fieldset className="ti-fieldset">
                <legend>Locks</legend>
                <div className="ti-panel ti-locks">
                  <button
                    type="button"
                    className={`ti-lock-row${condition.activationLocked ? ' is-on' : ''}`}
                    aria-pressed={condition.activationLocked}
                    onClick={() =>
                      setCondition((c) => ({ ...c, activationLocked: !c.activationLocked }))
                    }
                  >
                    <span className="ti-lock-copy">
                      <strong>Activation / iCloud</strong>
                      <em>Find My / activation lock</em>
                    </span>
                    <span className="ti-lock-state">{condition.activationLocked ? 'On' : 'Off'}</span>
                  </button>
                  <button
                    type="button"
                    className={`ti-lock-row${condition.simLocked ? ' is-on' : ''}`}
                    aria-pressed={condition.simLocked}
                    onClick={() => setCondition((c) => ({ ...c, simLocked: !c.simLocked }))}
                  >
                    <span className="ti-lock-copy">
                      <strong>SIM / carrier</strong>
                      <em>Network locked to a carrier</em>
                    </span>
                    <span className="ti-lock-state">{condition.simLocked ? 'On' : 'Off'}</span>
                  </button>
                  <p className="ti-panel-hint">Locked devices get a lower band until you unlock them.</p>
                </div>
              </fieldset>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="store-tradein-card" aria-labelledby="ti-photos">
              <h2 id="ti-photos" className="cart2-step-title">
                <span className="cart2-step-num">3</span>
                <span className="cart2-step-copy">
                  Photos
                  <em>Add 4 photos — front, back, left and right</em>
                </span>
              </h2>
              <p className="muted tiny" style={{ marginTop: 0 }}>
                Good light, screen on if you can.
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
                <span className="store-tradein-bulk-count">
                  {orderedImages.length}/{TRADE_IN_MAX_PHOTOS} photos
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
                        <div className="store-tradein-photo-thumb">
                          <button
                            type="button"
                            className="store-tradein-photo-replace"
                            disabled={!!uploading}
                            onClick={() => slotInputRefs.current[slot.id]?.click()}
                            aria-label={`Replace ${slot.label} photo`}
                          >
                            <img src={url} alt="" />
                            <span className="store-tradein-photo-label">{slot.label}</span>
                          </button>
                          <button
                            type="button"
                            className="store-tradein-photo-clear"
                            disabled={!!uploading}
                            aria-label={`Remove ${slot.label} photo`}
                            onClick={() =>
                              setSlots((prev) => {
                                const next = { ...prev }
                                delete next[slot.id]
                                return next
                              })
                            }
                          >
                            ×
                          </button>
                        </div>
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
                    </div>
                  )
                })}
              </div>
              {extras.length || canAddExtra ? (
                <div className="store-tradein-extras-wrap">
                  <p className="store-tradein-subhead">More photos (optional)</p>
                  <div className="store-tradein-extras">
                    {extras.map((url, i) => (
                      <div key={`${url}-${i}`} className="store-tradein-photo-slot">
                        <div className="store-tradein-photo-thumb">
                          <div className="store-tradein-photo-replace">
                            <img src={url} alt="" />
                            <span className="store-tradein-photo-label">More</span>
                          </div>
                          <button
                            type="button"
                            className="store-tradein-photo-clear"
                            disabled={!!uploading}
                            aria-label="Remove extra photo"
                            onClick={() => setExtras((prev) => prev.filter((_, j) => j !== i))}
                          >
                            ×
                          </button>
                        </div>
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
                          <span className="store-tradein-photo-label">Add more</span>
                          <span className="muted tiny">
                            {uploading === 'extra' ? 'Uploading…' : 'Optional'}
                          </span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <details className="store-tradein-video">
                <summary className="store-tradein-video-title">Condition video (optional)</summary>
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
              </details>
            </section>
          ) : null}

          {step === 3 && quote ? (
            <section className="store-tradein-card store-tradein-quote" aria-live="polite">
              <h2 className="cart2-step-title">
                <span className="cart2-step-num">4</span>
                <span className="cart2-step-copy">
                  Credit
                  <em>{quote.pendingQuote ? 'Trade-in ready' : 'Your estimate'}</em>
                </span>
              </h2>
              {quote.pendingQuote ? (
                <>
                  <p className="store-tradein-range">Quote after inspection</p>
                  <p className="muted">
                    We’ll buy <strong>{quote.label}</strong> — final credit is set when we receive
                    and inspect it.
                  </p>
                </>
              ) : (
                <>
                  <p className="store-tradein-range">
                    {money(quote.lowUsd)} – {money(quote.highUsd)}
                  </p>
                  <p className="muted">
                    Provisional cart credit <strong>{money(quote.creditUsd)}</strong> for{' '}
                    {quote.label}
                  </p>
                </>
              )}
              <ul className="store-tradein-notes">
                {quote.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
                {condition.battery == null ? (
                  <li>Battery health unknown — confirmed at inspection.</li>
                ) : null}
              </ul>

              <div className="ti-imei-panel ti-apply-imei">
                <div className="store-tradein-imei">
                  <label className="field">
                    <span>IMEI (*#06#){imeiReady ? '' : ' — required'}</span>
                    <input
                      value={imeiInput}
                      onChange={(e) => {
                        setImeiInput(e.target.value.replace(/\D/g, '').slice(0, 16))
                        if (lockedImei) setLockedImei(null)
                      }}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="15 digits"
                      disabled={lookupBusy}
                    />
                  </label>
                  <div className="store-tradein-imei-actions">
                    {imeiReady || imeiInput ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={clearImeiLock}>
                        Clear
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={lookupBusy || imeiInput.replace(/\D/g, '').length < 14}
                      onClick={saveImeiOnly}
                    >
                      Save
                    </button>
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
                {imeiReady ? (
                  <p className="ti-panel-hint">Saved: {lockedImei}</p>
                ) : (
                  <p className="ti-panel-hint">Save a valid IMEI to apply this trade-in.</p>
                )}
              </div>

              <div className="store-buy-actions">
                <button
                  type="button"
                  className="btn btn-primary store-buy-primary"
                  disabled={!photosOk || !imeiReady || !!uploading}
                  onClick={applyToCart}
                >
                  {quote.pendingQuote
                    ? 'Apply trade-in to cart'
                    : `Apply ${money(quote.creditUsd)} to cart`}
                </button>
                <Link to="/store" className="btn btn-ghost store-buy-secondary">
                  Keep shopping
                </Link>
              </div>
              {!photosOk ? (
                <p className="muted tiny">Add the {TRADE_IN_MIN_PHOTOS} photos to apply.</p>
              ) : null}
              <p className="muted tiny">
                {quote.pendingQuote
                  ? 'We buy all models and conditions online. Final credit after inspection.'
                  : 'Estimate only — final credit may be adjusted after inspection. Credit can’t exceed your cart total.'}
              </p>
            </section>
          ) : null}

          <div className="ti-bar">
            <div className="ti-bar-estimate">
              <span className="muted tiny">Estimate</span>
              <strong>{estimateLabel}</strong>
            </div>
            {step > 0 ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </button>
            ) : null}
            {step < 3 ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canContinue || !!uploading}
                onClick={() => setStep((s) => Math.min(3, s + 1))}
              >
                {step === 2 && !photosOk ? `Add ${TRADE_IN_MIN_PHOTOS - orderedImages.length} more` : 'Continue'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!photosOk || !imeiReady || !!uploading || !quote}
                onClick={applyToCart}
              >
                Apply to cart
              </button>
            )}
          </div>
          </div>
        </div>
      </div>
    </PublicShell>
  )
}
