import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { canUseWholesaleDesk } from '../lib/channelAccess'
import { useStore } from '../store'
import type { WholesaleStatus } from '../types'

type Payload = Record<string, string>

const STEPS = [
  { id: 'company', title: 'Company' },
  { id: 'contact', title: 'Contact' },
  { id: 'tax', title: 'Tax & resale' },
  { id: 'ops', title: 'Operations' },
  { id: 'review', title: 'Review' },
] as const

const EMPTY: Payload = {
  companyLegal: '',
  dba: '',
  businessType: '',
  website: '',
  yearsInBusiness: '',
  contactName: '',
  contactTitle: '',
  phone: '',
  billingEmail: '',
  shippingAddress: '',
  taxId: '',
  resaleCert: '',
  stateOfIncorp: '',
  monthlyVolume: '',
  categories: '',
  howHeard: '',
  notes: '',
}

export function WholesaleApply() {
  const { user, isStaff } = useStore()
  const [step, setStep] = useState(0)
  const [payload, setPayload] = useState<Payload>(EMPTY)
  const [appStatus, setAppStatus] = useState('draft')
  const [staffNote, setStaffNote] = useState('')
  const [wholesaleStatus, setWholesaleStatus] = useState<WholesaleStatus>(
    user?.wholesaleStatus || 'none',
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.getWholesaleApplication()
        if (cancelled) return
        setAppStatus(res.application.status)
        setStaffNote(res.application.staffNote || '')
        setWholesaleStatus((res.application.wholesaleStatus || 'none') as WholesaleStatus)
        setPayload({ ...EMPTY, ...(res.application.payload as Payload) })
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load application.')
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!user) return null
  if (canUseWholesaleDesk(user, isStaff) || wholesaleStatus === 'approved') {
    return (
      <div className="wholesale-apply">
        <p className="muted tiny mypage-intro">
          Approved — desk is active. Bid, buy marketplace, and pay invoices.
        </p>
        <div className="account-overview-actions">
          <Link className="btn btn-primary" to="/auctions">
            Open auctions
          </Link>
          <Link className="btn" to="/marketplace">
            Marketplace
          </Link>
          <Link className="btn" to="/account/documents">
            Documents
          </Link>
        </div>
      </div>
    )
  }

  function setField(key: string, value: string) {
    setPayload((p) => ({ ...p, [key]: value }))
  }

  async function save(submit: boolean) {
    setSaving(true)
    setError(null)
    try {
      const res = await api.saveWholesaleApplication({ payload, submit })
      setAppStatus(res.application.status)
      if (submit) setWholesaleStatus('under_review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function onNext(e: FormEvent) {
    e.preventDefault()
    if (step < STEPS.length - 1) {
      await save(false)
      setStep((s) => s + 1)
      return
    }
    await save(true)
  }

  if (!loaded) return <p className="muted tiny">Loading application…</p>

  const locked = appStatus === 'submitted' || appStatus === 'under_review' || wholesaleStatus === 'under_review'

  return (
    <div className="wholesale-apply">
      <p className="muted tiny mypage-intro">
        Company, tax/resale, and how you buy. Staff may request documents after you submit.
      </p>
      <p className={`tiny wholesale-status-pill is-${wholesaleStatus || appStatus}`}>
        {(wholesaleStatus || appStatus).replace(/_/g, ' ')}
        {staffNote ? ` · ${staffNote}` : ''}
      </p>

      <ol className="wholesale-steps">
        {STEPS.map((s, i) => (
          <li key={s.id} className={i === step ? 'is-current' : i < step ? 'is-done' : ''}>
            {s.title}
          </li>
        ))}
      </ol>

      {locked && step === STEPS.length - 1 ? (
        <div className="account-panel">
          <p>Application is with staff for review. Upload extra files under Documents if requested.</p>
          <Link className="btn btn-primary" to="/account/documents">
            Documents
          </Link>
        </div>
      ) : (
        <form className="wholesale-form" onSubmit={onNext}>
          {step === 0 ? (
            <>
              <label>
                Legal company name
                <input value={payload.companyLegal} onChange={(e) => setField('companyLegal', e.target.value)} required />
              </label>
              <label>
                DBA / trading as
                <input value={payload.dba} onChange={(e) => setField('dba', e.target.value)} />
              </label>
              <label>
                Business type
                <select value={payload.businessType} onChange={(e) => setField('businessType', e.target.value)} required>
                  <option value="">Select…</option>
                  <option>Reseller / Refurbisher</option>
                  <option>Retailer</option>
                  <option>Distributor</option>
                  <option>Exporter</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                Website
                <input value={payload.website} onChange={(e) => setField('website', e.target.value)} />
              </label>
              <label>
                Years in business
                <input value={payload.yearsInBusiness} onChange={(e) => setField('yearsInBusiness', e.target.value)} />
              </label>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <label>
                Primary contact
                <input value={payload.contactName} onChange={(e) => setField('contactName', e.target.value)} required />
              </label>
              <label>
                Title
                <input value={payload.contactTitle} onChange={(e) => setField('contactTitle', e.target.value)} />
              </label>
              <label>
                Phone
                <input value={payload.phone} onChange={(e) => setField('phone', e.target.value)} required />
              </label>
              <label>
                Billing email
                <input
                  type="email"
                  value={payload.billingEmail}
                  onChange={(e) => setField('billingEmail', e.target.value)}
                  required
                />
              </label>
              <label>
                Shipping / warehouse address
                <textarea
                  rows={3}
                  value={payload.shippingAddress}
                  onChange={(e) => setField('shippingAddress', e.target.value)}
                  required
                />
              </label>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <label>
                Tax ID / EIN / VAT
                <input value={payload.taxId} onChange={(e) => setField('taxId', e.target.value)} required />
              </label>
              <label>
                Resale certificate #
                <input value={payload.resaleCert} onChange={(e) => setField('resaleCert', e.target.value)} />
              </label>
              <label>
                State / country of incorporation
                <input value={payload.stateOfIncorp} onChange={(e) => setField('stateOfIncorp', e.target.value)} />
              </label>
              <p className="muted tiny">
                Upload PDF scans of tax / resale docs on the{' '}
                <Link to="/account/documents">Documents</Link> tab after submit.
              </p>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <label>
                Estimated monthly purchase volume (USD)
                <input value={payload.monthlyVolume} onChange={(e) => setField('monthlyVolume', e.target.value)} />
              </label>
              <label>
                Categories of interest
                <input
                  value={payload.categories}
                  onChange={(e) => setField('categories', e.target.value)}
                  placeholder="Phones, tablets, wearables…"
                />
              </label>
              <label>
                How did you hear about Equarios?
                <input value={payload.howHeard} onChange={(e) => setField('howHeard', e.target.value)} />
              </label>
              <label>
                Notes for staff
                <textarea rows={3} value={payload.notes} onChange={(e) => setField('notes', e.target.value)} />
              </label>
            </>
          ) : null}

          {step === 4 ? (
            <div className="account-panel">
              <h3>Review</h3>
              <dl className="wholesale-review">
                {Object.entries(payload)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
              </dl>
              <p className="muted tiny">Submitting notifies staff. You can still upload documents afterward.</p>
            </div>
          ) : null}

          {error ? <p className="error">{error}</p> : null}
          <div className="wholesale-form-actions">
            {step > 0 ? (
              <button type="button" className="btn" onClick={() => setStep((s) => s - 1)} disabled={saving}>
                Back
              </button>
            ) : null}
            <button type="button" className="btn" disabled={saving} onClick={() => void save(false)}>
              Save draft
            </button>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {step === STEPS.length - 1 ? 'Submit application' : 'Continue'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
