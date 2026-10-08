import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AuthFrame } from '../components/AuthFrame'
import { useStore } from '../store'

export function Register() {
  const { user, register, settings } = useStore()
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [accountId, setAccountId] = useState('')
  const [password, setPassword] = useState('')
  const [updates, setUpdates] = useState(true)
  const [step, setStep] = useState<'email' | 'profile'>('email')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (user) return <Navigate to="/auctions" replace />
  if (!settings.features.register && !done) return <Navigate to="/login" replace />

  function onEmail(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid work email.')
      return
    }
    setError(null)
    if (!accountId) {
      const local = email.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()
      setAccountId(local ? `LB-${local}` : '')
    }
    setStep('profile')
  }

  function onProfile(e: FormEvent) {
    e.preventDefault()
    const err = register(accountId, company, email, password)
    if (err) setError(err)
    else setDone(true)
  }

  return (
    <AuthFrame>
      {done ? (
        <>
          <h1>Application received</h1>
          <p>{settings.copy.pendingApproval}</p>
          <ol className="reg-steps">
            <li className="is-done">Application submitted</li>
            <li className="is-current">Waiting for Super Admin approval</li>
            <li>Sign in with your account ID, then bid or buy</li>
          </ol>
          <p className="muted tiny">
            Prices stay hidden until your account is accepted. Demo: Super → Accounts → Accept.
          </p>
          <p className="auth-foot">
            <Link to="/login">Sign In</Link>
          </p>
        </>
      ) : step === 'email' ? (
        <>
          <h1>Welcome to {settings.brandName}! Let&apos;s get started.</h1>
          <form onSubmit={onEmail}>
            <p>First, we&apos;ll need your email address.</p>
            <label>
              <span className="sr-only">Email Address</span>
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="check-inline">
              <input type="checkbox" checked={updates} onChange={(e) => setUpdates(e.target.checked)} />
              Email me updates on exclusive inventory offerings, special promotions, and new storefront launches.
            </label>
            {error ? <p className="error">{error}</p> : null}
            <p className="tiny muted">
              By clicking &quot;Agree and Start&quot;, you acknowledge you have read and agree to the Equarios buyer terms.
            </p>
            <button className="btn-bstock" type="submit">
              Agree and Start
            </button>
          </form>
          <p className="auth-foot">
            Already have an account? <Link to="/login">Sign In</Link>
          </p>
        </>
      ) : (
        <>
          <h1>Tell us about your business</h1>
          <form onSubmit={onProfile}>
            <p className="muted">{settings.copy.signUpIntro}</p>
            <label>
              Company name
              <input value={company} onChange={(e) => setCompany(e.target.value)} />
            </label>
            <label>
              Desired account ID
              <input value={accountId} onChange={(e) => setAccountId(e.target.value)} />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button className="btn-bstock" type="submit">
              {settings.copy.signUpButton}
            </button>
            <p>
              <button type="button" className="linkish" onClick={() => { setStep('email'); setError(null) }}>
                Use a different email
              </button>
            </p>
          </form>
        </>
      )}
    </AuthFrame>
  )
}
