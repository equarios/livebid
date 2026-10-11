import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AuthFrame } from '../components/AuthFrame'
import { canUseWholesaleDesk, publicHome, wholesaleHome } from '../lib/channelAccess'
import { useStore } from '../store'

export function Register() {
  const { user, register, verifyEmail, resendVerifyEmail, settings, isStaff } = useStore()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [emailConfirm, setEmailConfirm] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [updates, setUpdates] = useState(true)
  const [step, setStep] = useState<'form' | 'verify'>('form')
  const [ident, setIdent] = useState('')
  const [code, setCode] = useState('')
  const [issuedCode, setIssuedCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (user) {
    const dest = canUseWholesaleDesk(user, isStaff) ? wholesaleHome(settings) : publicHome(settings)
    return <Navigate to={dest === '/' ? '/account' : dest} replace />
  }
  if (!settings.features.register && step === 'form') return <Navigate to="/login" replace />

  async function onRegister(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase()) {
      setError('Email addresses do not match.')
      return
    }
    if (password !== passwordConfirm) {
      setError('Passwords do not match.')
      return
    }
    const result = await register({
      firstName,
      lastName,
      email,
      emailConfirm,
      password,
      passwordConfirm,
    })
    if (typeof result === 'string') {
      setError(result)
      return
    }
    setIdent(result.accountId || email)
    setIssuedCode(result.code || null)
    setStep('verify')
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const err = await verifyEmail(ident, code)
    if (err) setError(err)
  }

  async function onResend() {
    setError(null)
    const result = await resendVerifyEmail(ident || email)
    if ('error' in result) {
      setError(result.error)
      return
    }
    if (result.code) setIssuedCode(result.code)
  }

  return (
    <AuthFrame>
      {step === 'verify' ? (
        <>
          <h1>Verify your email</h1>
          <p className="muted">
            We sent a code to <strong>{email || ident}</strong>. Enter it to activate your account and open My
            Page.
          </p>
          {issuedCode ? (
            <p className="ok tiny">
              Local/dev code: <strong>{issuedCode}</strong>
            </p>
          ) : null}
          <form onSubmit={onVerify}>
            <label>
              Verification code
              <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button className="btn-bstock" type="submit">
              Verify and continue
            </button>
          </form>
          <p>
            <button type="button" className="linkish" onClick={() => void onResend()}>
              Resend code
            </button>
          </p>
          <p className="auth-foot">
            <Link to="/login">Sign In</Link>
          </p>
        </>
      ) : (
        <>
          <h1>Create your Equarios account</h1>
          <p className="muted">
            Shop the consumer store right after email verification. Apply for wholesale later from My Page —
            no invite code required.
          </p>
          <form onSubmit={onRegister}>
            <div className="auth-row">
              <label>
                First name
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" />
              </label>
              <label>
                Last name
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" />
              </label>
            </div>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label>
              Confirm email
              <input
                type="email"
                value={emailConfirm}
                onChange={(e) => setEmailConfirm(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirm password
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>
            <label className="check-inline">
              <input type="checkbox" checked={updates} onChange={(e) => setUpdates(e.target.checked)} />
              Email me updates on inventory and promotions.
            </label>
            {error ? <p className="error">{error}</p> : null}
            <p className="tiny muted">
              By creating an account you agree to Equarios buyer terms. Wholesale access is a separate
              application after signup.
            </p>
            <button className="btn-bstock" type="submit">
              {settings.copy.signUpButton}
            </button>
          </form>
          <p className="auth-foot">
            Already have an account? <Link to="/login">Sign In</Link>
          </p>
        </>
      )}
    </AuthFrame>
  )
}
